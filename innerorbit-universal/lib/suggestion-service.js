/** Purpose: Privacy-preserving local message suggestion engine based on keyword matching and context. */
/**
 * Suggestion Service
 * Provides contextual reply suggestions based on message content.
 * Runs client-side only for privacy.
 */

const GENERIC_SUGGESTIONS = ["Cool", "Nice", "Ok", "👍"];

const KEYWORD_MAP = {
  "how are you": ["I'm good, you?", "Doing well!", "Great, thanks!"],
  "what's up": ["Not much", "All good!", "Yo!"],
  "hello": ["Hey!", "Hi there!", "Hello!"],
  "hi": ["Hey!", "Hi there!", "Hello!"],
  "hey": ["Hi!", "Hello!", "What's up?"],
  "where": ["At home", "On my way", "Just arrived"],
  "when": ["In 5 mins", "Tomorrow", "Later today"],
  "plans": ["Busy atm", "Free later", "Nothing much"],
  "weekend": ["Busy atm", "Free later", "Nothing much"],
  "done": ["Great!", "Perfect", "Nice work"],
  "thanks": ["You're welcome!", "No problem", "Anytime!"],
  "thank you": ["You're welcome!", "No problem", "Anytime!"],
  "yes": ["👍", "Sure!", "Ok", "Agreed"],
  "no": ["Sorry, can't", "No problem", "Maybe later"],
  "ok": ["Cool", "Great", "Nice"],
  "good night": ["Sleep well!", "Good night!", "Night!"],
  "good morning": ["Morning!", "Good morning!", "Top of the morning!"],
  "bye": ["See ya!", "Goodbye", "Take care"],
  "see you": ["See you!", "Later!", "Can't wait"],
  "?": ["Yes", "No", "Maybe", "Not sure"]
};

/**
 * Generates reply suggestions for a given message text.
 * @param {string} text - The received message text.
 * @returns {string[]} Array of suggested replies.
 */
export function getSuggestions(text) {
  if (!text) return GENERIC_SUGGESTIONS;
  
  const normalized = text.toLowerCase().trim();
  
  // Try longest keys first for more specific matches
  const sortedKeys = Object.keys(KEYWORD_MAP).sort((a, b) => b.length - a.length);
  
  for (const key of sortedKeys) {
    // If it's a special character like '?', handle it specially
    if (key === '?') {
      if (normalized.includes('?')) return KEYWORD_MAP[key];
      continue;
    }
    
    // Use word boundaries to avoid matching keywords inside other words (e.g. "no" in "random")
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(normalized)) {
      return KEYWORD_MAP[key];
    }
  }
  
  // Default to generic
  return GENERIC_SUGGESTIONS;
}

// Support for CommonJS in verify script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getSuggestions };
}
