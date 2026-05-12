/**
 * Purpose: UI hook for cycling through promotional taglines on the login screen, 
 * primarily used for dynamic branding on Desktop versions.
 */
import { useState, useEffect } from 'react';

export function useTaglines(isDesktop) {
  const taglines = [
    "Hidden in Plain Sight",
    "Privacy Beyond Detection",
    "The Messenger No One Sees"
  ];
  const [currentTaglineIndex, setCurrentTaglineIndex] = useState(0);

  // Rotate taglines every 1 minute (desktop only)
  useEffect(() => {
    if (!isDesktop) return; // Only rotate on desktop

    const interval = setInterval(() => {
      setCurrentTaglineIndex((prev) => (prev + 1) % taglines.length);
    }, 8000); // 8s — fast enough to feel dynamic, slow enough to read

    return () => clearInterval(interval);
  }, [isDesktop]);

  return { taglines, currentTaglineIndex };
}
