/** Purpose: Converts Firebase and system error codes into localized, user-friendly feedback strings. */
/**
 * Centralized Error Parser for Firebase and App Errors.
 * Converts technical error codes into user-friendly messages.
 */
export const getFriendlyErrorMessage = (error) => {
    const msg = (error?.message || "").toLowerCase();
    const code = error?.code || "";

    // --- AUTHENTICATION (Login / Signup) ---

    if (code === "auth/email-already-in-use" || msg.includes("email-already-in-use")) {
        return "This email is already in use. Try signing in or using a different email address.";
    }
    if (code === "auth/invalid-email" || msg.includes("invalid-email")) {
        return "The email format isn't quite right. Please check for typos and try again.";
    }
    if (code === "auth/weak-password" || msg.includes("weak-password")) {
        return "Your password is too short. Please use at least 6 characters for better security.";
    }
    if (
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential" ||
        msg.includes("invalid-credential") ||
        msg.includes("user-not-found") ||
        msg.includes("wrong-password")
    ) {
        return "We couldn't find an account with those details. Please check your email and password, or create a new account.";
    }
    if (code === "auth/too-many-requests" || msg.includes("too-many-requests")) {
        return "There have been too many attempts. For your security, we've temporarily locked access. Please wait a few minutes and try again.";
    }
    if (code === "auth/requires-recent-login" || msg.includes("requires-recent-login")) {
        return "This action requires you to have signed in recently. Please sign out and back in to verify your identity.";
    }
    if (code === "auth/operation-not-allowed") {
        return "This sign-in method is currently disabled. Please contact support if you believe this is an error.";
    }
    if (code === "auth/popup-closed-by-user" || msg.includes("popup-closed-by-user") || msg.includes("popup_closed_by_user")) {
        return "The login window was closed. Please try again and complete the sign-in process.";
    }
    if (code === "auth/popup-blocked" || msg.includes("popup-blocked")) {
        return "The sign-in popup was blocked by your browser. Please allow popups for this site and try again.";
    }
    if (code === "auth/cancelled-popup-request" || msg.includes("cancelled-popup-request")) {
        return "The sign-in process was canceled. Please try again.";
    }

    // --- NETWORK & SYSTEM ---

    if (code === "auth/network-request-failed" || msg.includes("network-request-failed") || msg.includes("failed to fetch")) {
        return "Connection lost. Please check your internet or Wi-Fi settings and try again.";
    }
    if (msg.includes("timeout") || msg.includes("deadline exceeded")) {
        return "The request is taking longer than expected. Please check your connection and try one more time.";
    }
    if (msg.includes("storage/")) {
        if (msg.includes("unauthorized")) return "You don't have permission to upload files. Please check your account settings.";
        if (msg.includes("quota-exceeded")) return "Storage limit reached. We can't save your file right now.";
        return "There was a problem saving your file. Please check your connection and try again.";
    }

    // --- PERMISSIONS ---

    if (msg.includes("permission") || msg.includes("denied")) {
        return "Access was denied. Please enable the required permissions in your device settings to use this feature.";
    }
    if (msg.includes("camera") || msg.includes("microphone")) {
        return "We need access to your camera or microphone. Please enable these in your device settings.";
    }

    // --- CUSTOM APP ERRORS ---

    if (msg.includes("passwords do not match")) {
        return "The passwords you entered don't match. Please re-type them carefully.";
    }
    if (msg.includes("missing info") || msg.includes("fill in all fields")) {
        return "It looks like some information is missing. Please fill in all the required fields to continue.";
    }
    if (msg.includes("invalid user id")) {
        return "The User ID format isn't recognized. Please check the ID and try again.";
    }

    // --- FALLBACK ---

    // Detailed Fallback (strip common technical headers)
    const cleanMsg = msg.replace("firebase: error (", "").replace(").", "").replace("firebase:", "").trim();

    if (cleanMsg.length > 0 && cleanMsg.length < 100) {
        return cleanMsg.charAt(0).toUpperCase() + cleanMsg.slice(1);
    }

    return "Something went wrong on our end. Please try again in a moment.";
};
