/**
 * Purpose: Handles WebRTC Peer-to-Peer encrypted voice and video calling.
 * Acts as the Signaling Service using Firebase Firestore to connect users before
 * the P2P connection locks in.
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
    deleteDoc, 
    getDoc,
    query,
    where
} from 'firebase/firestore';

// Note: You must run `npm install react-native-webrtc` to use these objects natively
import { isWeb } from '../utils/platform';
let RTCConnection, RTCICecandidate, RTCSessDescription, mediaDevs;

if (isWeb) {
    // Web & Windows (Electron) Native Browser APIs
    RTCConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    RTCICecandidate = window.RTCIceCandidate;
    RTCSessDescription = window.RTCSessionDescription;
    mediaDevs = navigator.mediaDevices;
} else {
    // iOS & Android Native Hardware APIs
    const RNWebRTC = require('react-native-webrtc');
    RTCConnection = RNWebRTC.RTCPeerConnection;
    RTCICecandidate = RNWebRTC.RTCIceCandidate;
    RTCSessDescription = RNWebRTC.RTCSessionDescription;
    mediaDevs = RNWebRTC.mediaDevices;
}

const configuration = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
            ],
        },
    ],
    iceCandidatePoolSize: 10,
};

export class WebRTCService {
    constructor(currentUserId, options = {}) {
        this.currentUserId = currentUserId;
        this.options = options; // { protectIP: boolean, turnServers: [] }
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.callDocRef = null;
        this.unsubscribeCall = null;
        this.unsubscribeAnswer = null;
    }

    /**
     * Step 1: Initialize the Peer Connection and get Local Media (Mic Only)
     */
    async initConnection(isVideoEnabled = false) {
        try {
            Logger.log('[WebRTC] Initializing Voice Peer Connection...');
            
            // Build configuration dynamically
            const finalConfig = { ...configuration };
            
            // If TURN servers are provided in options, add them
            if (this.options.turnServers && this.options.turnServers.length > 0) {
                finalConfig.iceServers = [...finalConfig.iceServers, ...this.options.turnServers];
            }

            // ENFORCING PRIVACY: Force relay if protectIP is enabled
            if (this.options.protectIP) {
                Logger.log('[WebRTC] 🛡️ IP Protection Enabled: Forcing TURN relay mode.');
                finalConfig.iceTransportPolicy = 'relay';
            }

            this.peerConnection = new RTCConnection(finalConfig);

            const stream = await mediaDevs.getUserMedia({
                audio: true,
                video: isVideoEnabled ? { facingMode: 'user' } : false,
            });

            this.localStream = stream;
            
            // Add tracks to the peer connection
            stream.getTracks().forEach((track) => {
                this.peerConnection.addTrack(track, stream);
            });

            // Listen for remote tracks
            this.peerConnection.ontrack = (event) => {
                Logger.log('[WebRTC] Received remote track');
                if (event.streams && event.streams[0]) {
                    this.remoteStream = event.streams[0];
                }
            };

            return this.localStream;
        } catch (error) {
            Logger.error('[WebRTC] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Step 2: Caller - Start a Call (Create Offer)
     */
    async startCall(recipientId) {
        if (!this.peerConnection) throw new Error("Call not initialized");

        const callDoc = doc(collection(db, 'calls'));
        this.callDocRef = callDoc;

        const offerCandidates = collection(callDoc, 'offerCandidates');
        const answerCandidates = collection(callDoc, 'answerCandidates');

        // Save ICE candidates to Firebase
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(offerCandidates, event.candidate.toJSON());
            }
        };

        // Create WebRTC Offer
        const offerDescription = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        // Write offer to Firebase
        await setDoc(callDoc, {
            callerId: this.currentUserId,
            recipientId: recipientId,
            offer: offer,
            status: 'ringing',
            timestamp: new Date().getTime()
        });

        Logger.log('[WebRTC] Call started, ringing user:', recipientId);

        // Listen for an Answer from the recipient
        this.unsubscribeAnswer = onSnapshot(callDoc, (snapshot) => {
            const data = snapshot.data();
            if (!this.peerConnection.currentRemoteDescription && data?.answer) {
                const answerDescription = new RTCSessDescription(data.answer);
                this.peerConnection.setRemoteDescription(answerDescription);
            }
            if (data?.status === 'ended') {
                this.hangUp();
            }
        });

        // Listen for Remote ICE Candidates
        onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCICecandidate(change.doc.data());
                    this.peerConnection.addIceCandidate(candidate);
                }
            });
        });

        return callDoc.id; // Return the Call Room ID
    }

    /**
     * Hang up and clean up resources
     */
    async hangUp() {
        Logger.log('[WebRTC] Hanging up...');
        if (this.unsubscribeCall) this.unsubscribeCall();
        if (this.unsubscribeAnswer) this.unsubscribeAnswer();
        
        if (this.callDocRef) {
            await updateDoc(this.callDocRef, { status: 'ended' }).catch(() => {});
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.remoteStream = null;
    }

    /**
     * Step 3: Receiver - Listen for Incoming Calls
     */
    listenForIncomingCalls(onIncomingCall) {
        const callsQuery = query(
            collection(db, 'calls'),
            where('recipientId', '==', this.currentUserId),
            where('status', '==', 'ringing')
        );

        return onSnapshot(callsQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (data.recipientId === this.currentUserId && data.status === 'ringing') {
                        onIncomingCall({ callId: change.doc.id, ...data });
                    }
                }
            });
        });
    }

    /**
     * Step 4: Receiver - Answer a Call
     */
    async answerCall(callId, offerDescription) {
        if (!this.peerConnection) throw new Error("Call not initialized");

        this.callDocRef = doc(db, 'calls', callId);
        const offerCandidates = collection(this.callDocRef, 'offerCandidates');
        const answerCandidates = collection(this.callDocRef, 'answerCandidates');

        // Save our ICE candidates to Firebase
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(answerCandidates, event.candidate.toJSON());
            }
        };

        // Set remote description from caller's offer
        await this.peerConnection.setRemoteDescription(new RTCSessDescription(offerDescription));

        // Create WebRTC Answer
        const answerDescription = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answerDescription);

        const answer = {
            sdp: answerDescription.sdp,
            type: answerDescription.type,
        };

        // Write answer to Firebase
        await updateDoc(this.callDocRef, { 
            answer: answer,
            status: 'answered'
        });

        // Listen for Caller's ICE Candidates
        onSnapshot(offerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCICecandidate(change.doc.data());
                    this.peerConnection.addIceCandidate(candidate);
                }
            });
        });

        // Listen for Hangup
        this.unsubscribeCall = onSnapshot(this.callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (data?.status === 'ended') {
                this.hangUp();
            }
        });
    }

    /**
     * Step 5: Receiver - Reject a Call
     */
    async rejectCall(callId) {
        const callDoc = doc(db, 'calls', callId);
        await updateDoc(callDoc, { status: 'ended' }).catch(() => {});
    }
}
