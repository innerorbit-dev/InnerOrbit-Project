/**
 * Purpose: WebRTC voice calling with Firestore-only signaling (Firebase Spark–friendly).
 * Uses STUN by default; optional TURN via user profile or app extra (see call-context).
 */

import { db } from './firebase';
import { Logger } from './logger';
import {
    collection,
    doc,
    setDoc,
    addDoc,
    onSnapshot,
    updateDoc,
    query,
    where,
} from 'firebase/firestore';

import { isWeb } from '../utils/platform';

let RTCConnection, RTCICecandidate, RTCSessDescription, mediaDevs;

if (isWeb) {
    RTCConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    RTCICecandidate = window.RTCIceCandidate;
    RTCSessDescription = window.RTCSessionDescription;
    mediaDevs = navigator.mediaDevices;
} else {
    const RNWebRTC = require('react-native-webrtc');
    RTCConnection = RNWebRTC.RTCPeerConnection;
    RTCICecandidate = RNWebRTC.RTCIceCandidate;
    RTCSessDescription = RNWebRTC.RTCSessionDescription;
    mediaDevs = RNWebRTC.mediaDevices;
}

const defaultIceServers = [
    {
        urls: [
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
        ],
    },
];

export class WebRTCService {
    constructor(currentUserId, options = {}) {
        this.currentUserId = currentUserId;
        /** @type {{ protectIP?: boolean, turnServers?: object[], onStreamsChanged?: Function, onCallEnded?: () => void }} */
        this.options = options;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.callDocRef = null;
        this.unsubscribeCall = null;
        this.unsubscribeAnswer = null;
        this._iceUnsubs = [];
        this._pendingRemoteIce = [];
        this._hangupLock = false;
    }

    _pushIceUnsub(unsub) {
        if (typeof unsub === 'function') this._iceUnsubs.push(unsub);
    }

    _clearIceUnsubs() {
        this._iceUnsubs.forEach((u) => {
            try {
                u();
            } catch (_) { /* noop */ }
        });
        this._iceUnsubs = [];
    }

    _notifyStreams(local, remote) {
        try {
            this.options.onStreamsChanged?.({ local, remote });
        } catch (e) {
            Logger.warn('[WebRTC] onStreamsChanged error:', e?.message);
        }
    }

    _flushPendingIce() {
        if (!this.peerConnection?.remoteDescription) return;
        while (this._pendingRemoteIce.length) {
            const c = this._pendingRemoteIce.shift();
            this.peerConnection.addIceCandidate(c).catch(() => {});
        }
    }

    _safeAddIceCandidate(candidate) {
        if (!this.peerConnection) return;
        if (!this.peerConnection.remoteDescription) {
            this._pendingRemoteIce.push(candidate);
            return;
        }
        this.peerConnection.addIceCandidate(candidate).catch((e) => {
            Logger.warn('[WebRTC] addIceCandidate:', e?.message);
        });
    }

    async _disposePeerLocalOnly() {
        this._clearIceUnsubs();
        if (this.unsubscribeCall) {
            try {
                this.unsubscribeCall();
            } catch (_) { /* noop */ }
            this.unsubscribeCall = null;
        }
        if (this.unsubscribeAnswer) {
            try {
                this.unsubscribeAnswer();
            } catch (_) { /* noop */ }
            this.unsubscribeAnswer = null;
        }

        if (this.peerConnection) {
            try {
                this.peerConnection.onicecandidate = null;
                this.peerConnection.ontrack = null;
                this.peerConnection.close();
            } catch (_) { /* noop */ }
            this.peerConnection = null;
        }

        if (this.localStream) {
            try {
                this.localStream.getTracks().forEach((t) => t.stop());
            } catch (_) { /* noop */ }
            this.localStream = null;
        }

        this.remoteStream = null;
        this._pendingRemoteIce = [];
        this._notifyStreams(null, null);
    }

    /**
     * Mic + RTCPeerConnection. Safe to call again (tears down previous peer).
     */
    async initConnection(isVideoEnabled = false) {
        await this._disposePeerLocalOnly();

        try {
            Logger.log('[WebRTC] Initializing voice peer connection...');

            const finalConfig = {
                iceServers: [...defaultIceServers],
                iceCandidatePoolSize: 10,
            };

            if (this.options.turnServers?.length) {
                finalConfig.iceServers = [...finalConfig.iceServers, ...this.options.turnServers];
            }

            if (this.options.protectIP) {
                if (this.options.turnServers?.length) {
                    Logger.log('[WebRTC] IP protection: relay-only (TURN configured).');
                    finalConfig.iceTransportPolicy = 'relay';
                } else {
                    Logger.warn('[WebRTC] protectIP set but no TURN servers — falling back to STUN (IP may leak). Add TURN for true relay.');
                }
            }

            this.peerConnection = new RTCConnection(finalConfig);

            const stream = await mediaDevs.getUserMedia({
                audio: true,
                video: isVideoEnabled ? { facingMode: 'user' } : false,
            });

            this.localStream = stream;
            stream.getTracks().forEach((track) => {
                this.peerConnection.addTrack(track, stream);
            });

            this.peerConnection.ontrack = (event) => {
                Logger.log('[WebRTC] Remote track received');
                if (event.streams?.[0]) {
                    this.remoteStream = event.streams[0];
                    this._notifyStreams(this.localStream, this.remoteStream);
                }
            };

            this._notifyStreams(this.localStream, null);
            return this.localStream;
        } catch (error) {
            Logger.error('[WebRTC] Initialization failed:', error);
            await this._disposePeerLocalOnly();
            throw error;
        }
    }

    /**
     * Caller: create offer + Firestore room.
     * @param {string} recipientId
     * @param {{ callerName?: string, conversationId?: string | null, recipientName?: string | null }} metadata
     */
    async startCall(recipientId, metadata = {}) {
        if (!this.peerConnection) throw new Error('Call not initialized');

        const callDoc = doc(collection(db, 'calls'));
        this.callDocRef = callDoc;

        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(offerCandidates, event.candidate.toJSON()).catch(() => {});
            }
        };

        const offerDescription = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        const callerName = metadata.callerName || 'InnerOrbit user';
        const conversationId = metadata.conversationId || null;
        const recipientName = metadata.recipientName || null;
        const participantIds = [this.currentUserId, recipientId].sort();

        await setDoc(callDoc, {
            callerId: this.currentUserId,
            recipientId,
            participantIds,
            callerName,
            recipientName,
            conversationId,
            offer,
            status: 'ringing',
            timestamp: Date.now(),
        });

        Logger.log('[WebRTC] Call ringing:', recipientId);

        this.unsubscribeAnswer = onSnapshot(callDoc, (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            if (data?.status === 'ended') {
                this.hangUp();
                return;
            }

            if (!this.peerConnection) return;

            if (!this.peerConnection.currentRemoteDescription && data.answer) {
                const answerDescription = new RTCSessDescription(data.answer);
                void this.peerConnection
                    .setRemoteDescription(answerDescription)
                    .then(() => this._flushPendingIce())
                    .catch((e) => Logger.error('[WebRTC] setRemoteDescription (answer):', e));
            }
        });

        const unsubIce = onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    try {
                        const candidate = new RTCICecandidate(change.doc.data());
                        this._safeAddIceCandidate(candidate);
                    } catch (e) {
                        Logger.warn('[WebRTC] ICE parse:', e?.message);
                    }
                }
            });
        });
        this._pushIceUnsub(unsubIce);

        return callDoc.id;
    }

    async hangUp() {
        if (this._hangupLock) return;
        this._hangupLock = true;
        try {
            Logger.log('[WebRTC] Hanging up...');

            if (this.unsubscribeAnswer) {
                try {
                    this.unsubscribeAnswer();
                } catch (_) { /* noop */ }
                this.unsubscribeAnswer = null;
            }
            if (this.unsubscribeCall) {
                try {
                    this.unsubscribeCall();
                } catch (_) { /* noop */ }
                this.unsubscribeCall = null;
            }

            this._clearIceUnsubs();

            if (this.callDocRef) {
                await updateDoc(this.callDocRef, { status: 'ended' }).catch(() => {});
            }

            this.callDocRef = null;

            if (this.peerConnection) {
                try {
                    this.peerConnection.close();
                } catch (_) { /* noop */ }
                this.peerConnection = null;
            }

            if (this.localStream) {
                try {
                    this.localStream.getTracks().forEach((track) => track.stop());
                } catch (_) { /* noop */ }
                this.localStream = null;
            }

            this.remoteStream = null;
            this._pendingRemoteIce = [];
            this._notifyStreams(null, null);
        } finally {
            this._hangupLock = false;
            try {
                this.options.onCallEnded?.();
            } catch (_) { /* noop */ }
        }
    }

    listenForIncomingCalls(onIncomingCall, onRingingGone) {
        const callsQuery = query(
            collection(db, 'calls'),
            where('recipientId', '==', this.currentUserId),
            where('status', '==', 'ringing'),
        );

        return onSnapshot(callsQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'removed') {
                    onRingingGone?.(change.doc.id);
                    return;
                }
                if (change.type === 'modified') {
                    const d = change.doc.data();
                    if (d.status !== 'ringing') {
                        onRingingGone?.(change.doc.id);
                        return;
                    }
                }
                if (change.type === 'added' || change.type === 'modified') {
                    const data = change.doc.data();
                    if (data.recipientId === this.currentUserId && data.status === 'ringing') {
                        onIncomingCall({ callId: change.doc.id, ...data });
                    }
                }
            });
        });
    }

    async answerCall(callId, offerDescription) {
        if (!this.peerConnection) throw new Error('Call not initialized');

        this.callDocRef = doc(db, 'calls', callId);
        const offerCandidates = collection(this.callDocRef, 'offerCandidates');
        const answerCandidates = collection(this.callDocRef, 'answerCandidates');

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(answerCandidates, event.candidate.toJSON()).catch(() => {});
            }
        };

        await this.peerConnection.setRemoteDescription(new RTCSessDescription(offerDescription));
        this._flushPendingIce();

        const answerDescription = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answerDescription);

        const answer = {
            sdp: answerDescription.sdp,
            type: answerDescription.type,
        };

        await updateDoc(this.callDocRef, {
            answer,
            status: 'answered',
        });

        const unsubOfferIce = onSnapshot(offerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    try {
                        const candidate = new RTCICecandidate(change.doc.data());
                        this._safeAddIceCandidate(candidate);
                    } catch (e) {
                        Logger.warn('[WebRTC] ICE parse (offer):', e?.message);
                    }
                }
            });
        });
        this._pushIceUnsub(unsubOfferIce);

        this.unsubscribeCall = onSnapshot(this.callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (data?.status === 'ended') {
                void this.hangUp();
            }
        });
    }

    async rejectCall(callId) {
        const callDoc = doc(db, 'calls', callId);
        await updateDoc(callDoc, { status: 'ended' }).catch(() => {});
    }

    /** @returns {boolean} muted */
    setMicMuted(muted) {
        if (!this.localStream) return false;
        const audio = this.localStream.getAudioTracks()[0];
        if (!audio) return false;
        audio.enabled = !muted;
        return muted;
    }
}
