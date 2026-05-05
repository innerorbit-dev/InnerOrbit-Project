/**
 * Purpose: Encapsulates user feedback submission logic. Collects device metadata and sends 
 * validated messages to the support team via Formspree API.
 */
import { useState } from 'react';
import { os } from '../utils/platform';
import { UpdateManager } from '../lib/update-manager';

export function useFeedback(user, showError, showSuccess) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  const handleSendFeedback = async (onSuccess) => {
    if (!feedbackEmail || !feedbackMessage) {
      showError("Please fill in both email and message fields.");
      return;
    }

    // Basic Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(feedbackEmail)) {
      showError("Please enter a valid email address.");
      return;
    }

    try {
      setIsSendingFeedback(true);
      const response = await fetch("https://formspree.io/f/xbddyapz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          email: feedbackEmail,
          message: feedbackMessage,
          platform: os,
          userId: user?.uid || "Anonymous",
          appVersion: UpdateManager?.getCurrentVersion ? UpdateManager.getCurrentVersion() : "1.0.2"
        })
      });

      if (response.ok) {
        showSuccess("Feedback sent successfully! Thank you.");
        setFeedbackMessage("");
        setShowFeedbackModal(false);
        if (onSuccess) onSuccess();
      } else {
        const data = await response.json();
        if (Object.hasOwn(data, 'errors')) {
          showError(data["errors"].map(error => error["message"]).join(", "));
        } else {
          showError("Oops! There was a problem sending your feedback.");
        }
      }
    } catch (error) {
      showError("Network error. Please try again later.");
    } finally {
      setIsSendingFeedback(false);
    }
  };

  return {
    showFeedbackModal,
    setShowFeedbackModal,
    feedbackEmail,
    setFeedbackEmail,
    feedbackMessage,
    setFeedbackMessage,
    isSendingFeedback,
    handleSendFeedback
  };
}
