/**
 * Purpose: Manages user profile state and lifecycle. Handles real-time Firestore synchronization,
 * profile creation for new users, and image upload orchestration for profile pictures.
 */
import { useState, useEffect, useRef } from 'react';
import * as firestoreService from '../lib/firestore-service';
import { Logger } from '../lib/logger';

export function useProfile(user, showError, showSuccess) {
  const [myUserId, setMyUserId] = useState("Loading...");
  const [userPin, setUserPin] = useState("....");
  const [userBio, setUserBio] = useState("");
  const [userPhoto, setUserPhoto] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(true);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [bioStatus, setBioStatus] = useState('idle'); // 'idle', 'saving', 'saved'
  const [nameStatus, setNameStatus] = useState('idle');
  const [isImagePickerVisible, setIsImagePickerVisible] = useState(false);
  const bioTimeoutRef = useRef(null);
  const nameTimeoutRef = useRef(null);

  useEffect(() => {
    if (user?.uid) {
      const { auth } = require('../lib/firebase');
      const isActuallyAuthenticated = auth.currentUser?.uid === user.uid;

      if (!isActuallyAuthenticated) {
        Logger.log('[useProfile] Skipping Firestore: unauthenticated session');
        // If we have profile data in the 'user' object (restored from cache), use it
        if (user.userId) setMyUserId(user.userId);
        if (user.pin) setUserPin(user.pin);
        if (user.bio) setUserBio(user.bio);
        if (user.displayName) setDisplayName(user.displayName);
        if (user.photoURL) setUserPhoto(user.photoURL);
        if (user.confirmLogout !== undefined) setConfirmLogout(user.confirmLogout);
        return;
      }

      // 1. Fetch Profile Details
      Logger.log(`[useProfile] Fetching profile for ${user.uid}...`);
      firestoreService.getUserProfile(user.uid)
        .then(async (profile) => {
          if (profile) {
            Logger.log(`[useProfile] Profile found: ${profile.userId}`);
            if (profile.userId) setMyUserId(profile.userId);
            if (profile.pin) setUserPin(profile.pin);
            if (profile.bio) setUserBio(profile.bio);
            if (profile.displayName) setDisplayName(profile.displayName);
            if (profile.photoURL) setUserPhoto(profile.photoURL);
            if (profile.confirmLogout !== undefined) setConfirmLogout(profile.confirmLogout);
          } else {
            // Profile missing. Check account age to prevent accidental overwrites.
            const creationTime = user.metadata?.creationTime;
            const lastSignInTime = user.metadata?.lastSignInTime;

            // If creationTime is available, check if account is "old" (> 10 minutes)
            let isOldAccount = false;
            if (creationTime) {
              const createdDate = new Date(creationTime);
              const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
              isOldAccount = createdDate < tenMinutesAgo;
            }

            if (isOldAccount) {
              Logger.error(`[useProfile] CRITICAL: Profile missing for OLD account (${creationTime}). preventing overwrite.`);
              showError("Profile sync in progress... Please wait or restart the app.");
              setMyUserId("Syncing...");
              return;
            }

            // Only heal (create new profile) if account is BRAND NEW (< 2 mins)
            // This prevents identity loss on slow connections for existing users
            const isBrandNew = !creationTime || (new Date() - new Date(creationTime)) < 2 * 60 * 1000;

            if (!isBrandNew) {
              Logger.warn('[useProfile] Profile missing for existing account. Waiting for sync...');
              setMyUserId("Wait...");
              return;
            }

            Logger.log('[Home] Brand new user. Initializing profile...');
            try {
              const newProfile = await firestoreService.createUserProfile(user);
              setMyUserId(newProfile.userId);
              setUserPin(newProfile.pin);
              showSuccess("Profile Setup Complete!");
            } catch (err) {
              Logger.error("[Home] Creation failed:", err);
              showError("Setup failed. Please restart.");
            }
          }
        })
        .catch((err) => {
          // If fetching profile fails (e.g. permission denied, network), DO NOT HEAL.
          // Healing should only happen if profile is confirmed missing (null).
          Logger.error("[Home] Profile fetch failed:", err);
          if (err.code === 'permission-denied') {
            // Likely cold start issue, retry or wait. Do not overwrite.
            Logger.warn("[Home] Permission denied. Waiting for auth sync...");
          }
        });

      // 2. Subscribe to My Profile (Real-time updates)
      const unsub = firestoreService.subscribeToUserProfile(user.uid, (profile) => {
        if (profile) {
          if (profile.userId) setMyUserId(profile.userId);
          if (profile.pin) setUserPin(profile.pin);
          if (profile.bio) setUserBio(profile.bio);
          if (profile.displayName) setDisplayName(profile.displayName);
          if (profile.photoURL) setUserPhoto(profile.photoURL);
        }
      });
      return unsub;
    }
  }, [user]);

  const handleUpdateBio = async (newBio) => {
    if (!user) return;
    try {
      setIsUpdatingProfile(true);
      setBioStatus('saving');
      await firestoreService.updateUserProfile(user.uid, { bio: newBio });
      setUserBio(newBio);
      setBioStatus('saved');
      setTimeout(() => setBioStatus('idle'), 2000);
    } catch (e) {
      showError(e);
      setBioStatus('idle');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const onChangeBio = (text) => {
    setUserBio(text);
    if (bioTimeoutRef.current) clearTimeout(bioTimeoutRef.current);
    bioTimeoutRef.current = setTimeout(() => {
      handleUpdateBio(text);
    }, 1500);
  };

  const handleUpdateDisplayName = async (newName) => {
    if (!user) return;
    try {
      setIsUpdatingProfile(true);
      setNameStatus('saving');
      await firestoreService.updateUserProfile(user.uid, { displayName: newName });
      setDisplayName(newName);
      setNameStatus('saved');
      setTimeout(() => setNameStatus('idle'), 2000);
    } catch (e) {
      showError(e);
      setNameStatus('idle');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const onChangeDisplayName = (text) => {
    setDisplayName(text);
    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
    nameTimeoutRef.current = setTimeout(() => {
      handleUpdateDisplayName(text);
    }, 1500);
  };

  const handlePickProfilePicture = () => {
    setIsImagePickerVisible(true);
  };

  const handleSelectImage = async (asset, onSuccess, onError) => {
    setIsImagePickerVisible(false);
    if (!user) return;
    try {
      setIsUpdatingProfile(true);
      const imageUrl = await firestoreService.uploadProfilePicture(asset.uri, user.uid);
      await firestoreService.updateUserProfile(user.uid, { photoURL: imageUrl });
      setUserPhoto(imageUrl);
      onSuccess("Profile picture updated!");
    } catch (e) {
      onError(e);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleToggleConfirmLogout = async () => {
    if (!user) return;
    try {
      const newValue = !confirmLogout;
      setConfirmLogout(newValue); // Optimistic update
      await firestoreService.updateUserProfile(user.uid, { confirmLogout: newValue });
    } catch (e) {
      setConfirmLogout(!confirmLogout); // Revert on error
      showError("Failed to update preference");
    }
  };

  return {
    myUserId,
    userPin,
    userBio,
    setUserBio,
    displayName,
    setDisplayName,
    userPhoto,
    setUserPhoto,
    confirmLogout,
    handleUpdateBio,
    onChangeBio,
    handleUpdateDisplayName,
    onChangeDisplayName,
    handlePickProfilePicture,
    handleToggleConfirmLogout,
    bioStatus,
    nameStatus,
    isUpdatingProfile,
    isImagePickerVisible,
    setIsImagePickerVisible,
    handleSelectImage
  };
}
