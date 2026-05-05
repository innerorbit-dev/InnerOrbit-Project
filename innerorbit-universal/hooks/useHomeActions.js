/**
 * Purpose: Centralized action orchestrator for the Home screen. Handles complex user flows 
 * including logout, account deletion, user searching, contact renaming, and data exports.
 */
import { useRouter } from "expo-router";
import { useAuth } from "../context/auth-context";
import { auth } from "../lib/firebase";
import * as firestoreService from "../lib/firestore-service";
import * as exportService from "../lib/data-export-service";
import { Alert, Platform } from "react-native";
import { Logger } from "../lib/logger";

export function useHomeActions(ui, user, profile, privacyLevel, isDesktop, setSelectedConversationId, setDesktopDetailView) {
  const { logout } = useAuth();
  const router = useRouter();
  const { showError, showSuccess, setAlertConfig } = ui;

  const handleRenameContact = async (newName) => {
    if (!ui.renameTarget.uid || !user) return;
    try {
      await firestoreService.saveContactNickname(user.uid, ui.renameTarget.uid, newName.trim());
      ui.setShowRenameModal(false);
      ui.setRenameTarget({ uid: null, currentName: '' });
      showSuccess("Contact name updated successfully!");
    } catch (error) {
      showError(error);
    }
  };

  const handleLogout = async () => {
    // Check user preference for confirmation
    if (profile.confirmLogout === false) {
      try {
        await logout();
        router.replace("/");
      } catch (error) {
        showError("Logout failed: " + (error?.message || "Unknown error"));
      }
      return;
    }

    setAlertConfig({
      visible: true,
      title: "Log Out",
      message: "Are you sure you want to log out?",
      type: 'warning',
      buttons: [
        { text: "Cancel", onPress: () => setAlertConfig(prev => ({ ...prev, visible: false })) },
        {
          text: "Log Out",
          style: 'destructive',
          onPress: async () => {
            try {
              setAlertConfig(prev => ({ ...prev, visible: false }));
              await logout();
              router.replace("/");
            } catch (error) {
              showError("Logout failed: " + (error?.message || "Unknown error"));
            }
          }
        }
      ]
    });
  };

  const handleDeleteAccount = async () => {
    setAlertConfig({
      visible: true,
      title: "⚠️ Delete Account?",
      message: "This will PERMANENTLY delete:\n\n• Your profile and account\n• All conversations and messages\n• All uploaded photos\n• All local data\n\nThis action CANNOT be undone!",
      type: 'error',
      buttons: [
        { text: "Cancel", onPress: () => setAlertConfig(prev => ({ ...prev, visible: false })) },
        {
          text: "Delete Everything",
          style: 'destructive',
          onPress: async () => {
            try {
              setAlertConfig(prev => ({ ...prev, visible: false }));
              showSuccess("Deleting all data...");
              await exportService.completeDataDeletion(user.uid, auth);
              router.replace("/login");
            } catch (error) {
              showError("Deletion failed: " + error.message);
            }
          }
        }
      ]
    });
  };

  const handleUserSearch = async (manualQuery) => {
    const query = ((typeof manualQuery === 'string' ? manualQuery : ui.userSearchQuery) || "").trim();
    if (!query) return;
    ui.setIsSearching(true);
    try {
      const result = await firestoreService.searchUserByUserId(query);
      if (result) {
        ui.setSearchResult(result);
      } else {
        ui.setSearchResult(null);
      }
    } catch (error) {
      showError("Search failed");
    } finally {
      ui.setIsSearching(false);
    }
  };

  const handleAddChatUser = async (targetUser) => {
    if (!user || !targetUser) return;
    try {
      // Get current user's public ID for the request
      const currentUserId = profile?.myUserId || "Unknown";

      const result = await firestoreService.sendConnectionRequest(user.uid, targetUser.uid, {
        userId: currentUserId,
      });

      ui.setShowSearchModal(false);
      ui.setShowQRModal(false);

      if (result.status === 'already_connected') {
        // If already connected, just open the chat
        if (isDesktop) {
          setSelectedConversationId(result.conversationId);
        } else {
          router.push({ pathname: "/chat-detail", params: { conversationId: result.conversationId } });
        }
      } else if (result.status === 'request_sent_already') {
        showSuccess("Request already pending");
      } else if (result.autoAccepted) {
        showSuccess("You're connected! Start chatting. 🚀");
      } else {
        showSuccess("Connection request sent!");
      }
      ui.setShowScannedModal(false);
    } catch (error) {
      showError("Failed to send request");
    }
  };

  const handleScanQRCode = () => {
    // Permission handled in hook call or component
    ui.setShowScanner(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    ui.setShowScanner(false);

    // Attempt to parse JSON if it's a rich QR code (e.g. from Connect tab)
    let finalId = data;
    try {
      if (data.startsWith('{')) {
        const parsed = JSON.parse(data);
        if (parsed.userId) finalId = parsed.userId;
      }
    } catch (e) {
      Logger.log("QR Data is a plain string", data);
    }

    // Auto-trigger the search for a seamless connection
    const lookupAndShow = async () => {
      try {
        const result = await firestoreService.searchUserByUserId(finalId);
        if (result) {
          ui.setScannedUser(result);
          ui.setShowScannedModal(true);
        } else {
          showError(`User ID ${finalId} not found`);
        }
      } catch (err) {
        showError("Target lookup failed");
      }
    };
    lookupAndShow();
  };

  const handleScanAgain = () => {
    ui.setShowScannedModal(false);
    ui.setShowScanner(true);
  };

  const handleNewChat = () => {
    ui.setShowSearchModal(true);
    ui.setSearchResult(null);
    ui.setUserSearchQuery("");
  };

  const handleConversationPress = (convId) => {
    if (isDesktop) {
      setSelectedConversationId(convId);
    } else {
      router.push({ pathname: "/chat-detail", params: { conversationId: convId } });
    }
  };

  const handleExportData = async () => {
    try {
      setAlertConfig({
        visible: true,
        title: "Export Your Data",
        message: "This will create a JSON file containing all your personal data, conversations, and messages. This may take a moment.",
        type: 'info',
        buttons: [
          { text: "Cancel", onPress: () => setAlertConfig(prev => ({ ...prev, visible: false })) },
          {
            text: "Export",
            onPress: async () => {
              try {
                setAlertConfig(prev => ({ ...prev, visible: false }));
                showSuccess("Preparing your data export...");
                const exportData = await exportService.exportUserData(user.uid);
                await exportService.downloadDataExport(exportData, profile.myUserId || user.uid);
                showSuccess("Data exported successfully!");
              } catch (error) {
                showError("Failed to export data: " + error.message);
              }
            }
          }
        ]
      });
    } catch (error) {
      showError("Error: " + error.message);
    }
  };

  return {
    handleUserSearch,
    handleScanQRCode,
    handleBarCodeScanned,
    handleNewChat,
    handleAddChatUser,
    handleConversationPress,
    handleLogout,
    handleExportData,
    handleDeleteAccount,
    handleRenameContact,
    handleScanAgain
  };
}
