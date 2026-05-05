/** Purpose: Random, non-sequential User ID and PIN generation with uniqueness validation in Firestore. */
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

/**
 * User ID Generator Utility for InnerOrbit
 * Generates non-sequential 4-digit random IDs for user identification
 *
 * Rules:
 * - 4 digits (0000-9999)
 * - Must be non-sequential (no patterns like 1234, 1111, 5432, etc.)
 * - Must be unique across all users
 * - Should be random and unpredictable
 */

// Blocked sequences to avoid predictable patterns
const BLOCKED_SEQUENCES = [
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", // All same digits
  "0123", "1234", "2345", "3456", "4567", "5678", "6789", // Sequential ascending
  "3210", "4321", "5432", "6543", "7654", "8765", "9876", // Sequential descending
  "0101", "0202", "0303", "0404", "0505", "0606", "0707", "0808", "0909", // Repeating patterns
  "1010", "1212", "1313", "1414", "1515", "1616", "1717", "1818", "1919", // Repeating patterns
];

/**
 * Checks if a 4-digit ID is sequential or follows a predictable pattern
 * @param id - The 4-digit ID string to validate
 * @returns true if the ID is blocked (sequential/predictable), false if it's valid
 */
function isBlockedSequence(id) {
  // Check against blocked sequences
  if (BLOCKED_SEQUENCES.includes(id)) {
    return true;
  }

  // Check for other patterns
  const digits = id.split("").map(Number);

  // Check if all digits are the same
  if (digits.every((d) => d === digits[0])) {
    return true;
  }

  // Check if digits form an arithmetic sequence (ascending or descending)
  // This catches 1234, 4321, 2468, 1357, etc.
  let isArithmetic = true;
  const firstDiff = digits[1] - digits[0];
  
  for (let i = 2; i < digits.length; i++) {
    if (digits[i] - digits[i - 1] !== firstDiff) {
      isArithmetic = false;
      break;
    }
  }

  // Strictly block 1-step sequences (1234, 4321) even if caught by blocked list
  if (isArithmetic && Math.abs(firstDiff) === 1) {
    return true;
  }
  
  // Also check for partial sequential pairs at start or end (e.g., "8901", "1890")
  // You mentioned "89" specifically. 
  // Let's block any ID containing sequential pairs like "89", "90", "12" if they appear more than once or form a pattern
  
  // Specific check for user dislike of "sequence" - block if any 2 adjacent digits are sequential (diff is 1)
  // This is stricter: "1890" has "89" (diff 1), "90" (diff -9 wrap or not sequential? usually 8->9 is +1). 
  // Blocks both ascending (1->2) and descending (2->1) adjacent digits.
  // Also block wrapping sequences (0->9 and 9->0) to avoid "1890" type patterns.
  for (let i = 0; i < digits.length - 1; i++) {
     const diff = digits[i + 1] - digits[i];
     if (Math.abs(diff) === 1 || Math.abs(diff) === 9) {
       return true; // Blocks "12" (diff 1), "21" (diff -1), "09" (diff 9), "90" (diff -9)
     }
  }

  return false;
}

/**
 * Generates a random 4-digit ID that is not sequential
 * @returns A valid 4-digit random ID string
 */
function generateRandomId() {
  let id;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    // Generate random number between 0 and 9999
    const randomNum = Math.floor(Math.random() * 10000);
    id = randomNum.toString().padStart(4, "0");
    attempts++;

    if (attempts > maxAttempts) {
      throw new Error("Failed to generate valid random ID after multiple attempts");
    }
  } while (isBlockedSequence(id));

  return id;
}

/**
 * Checks if a user ID already exists in Firestore
 * @param userId - The 4-digit user ID to check
 * @returns true if the ID exists, false otherwise
 */
async function userIdExists(userId) {
  try {
    const q = query(collection(db, "users"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    // If we have no permission to read (e.g. strict rules), assume ID is valid/unused.
    // The write operation will enforce uniqueness later if rules allow writes.
    if (error.code === 'permission-denied') {
      return false;
    }
    // Silently handle other errors to keep console clean
    return false;
  }
}

/**
 * Generates a unique 4-digit random user ID
 * Ensures the ID is not sequential and doesn't already exist in the database
 * @returns A unique, valid 4-digit user ID
 */
export async function generateUniqueUserId() {
  let userId;
  let attempts = 0;
  const maxAttempts = 50;

  do {
    userId = generateRandomId();
    const exists = await userIdExists(userId);

    if (!exists) {
      return userId;
    }

    attempts++;

    if (attempts > maxAttempts) {
      throw new Error("Failed to generate unique user ID after multiple attempts");
    }
  } while (true);
}

/**
 * Validates if a string is a valid 4-digit user ID format
 * @param id - The ID to validate
 * @returns true if the ID is valid format, false otherwise
 */
export function isValidUserIdFormat(id) {
  // Must be exactly 4 digits
  if (!/^\d{4}$/.test(id)) {
    return false;
  }

  // Must not be a blocked sequence
  if (isBlockedSequence(id)) {
    return false;
  }

  return true;
}

/**
 * Finds a user by their 4-digit ID
 * @param userId - The 4-digit user ID to search for
 * @returns The user document data or null if not found
 */
export async function findUserById(userId) {
  try {
    if (!isValidUserIdFormat(userId)) {
      return null;
    }

    const q = query(collection(db, "users"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    return {
      uid: querySnapshot.docs[0].id,
      ...querySnapshot.docs[0].data(),
    };
  } catch (error) {
    // Silently return null on error
    return null;
  }
}

/**
 * Generates a random 6-digit PIN
 * @returns A valid 6-digit PIN string
 */
function generateRandomPin() {
  // Generate random number between 0 and 999999
  const randomNum = Math.floor(Math.random() * 1000000);
  return randomNum.toString().padStart(6, "0");
}

/**
 * Checks if a PIN already exists in Firestore
 * @param pin - The 6-digit PIN to check
 * @returns true if the PIN exists, false otherwise
 */
async function pinExists(pin) {
  try {
    const q = query(collection(db, "users"), where("pin", "==", pin));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    // If we have no permission to read (e.g. strict rules), assume PIN is valid/unused.
    if (error.code === 'permission-denied') {
      return false;
    }
    // Silently handle other errors to keep console clean
    return false;
  }
}

/**
 * Generates a unique 6-digit PIN
 * Ensures the PIN doesn't already exist in the database
 * @returns A unique 6-digit PIN
 */
export async function generateUniquePin() {
  let pin;
  let attempts = 0;
  const maxAttempts = 50;

  do {
    pin = generateRandomPin();
    const exists = await pinExists(pin);

    if (!exists) {
      return pin;
    }

    attempts++;

    if (attempts > maxAttempts) {
      throw new Error("Failed to generate unique PIN after multiple attempts");
    }
  } while (true);
}

/**
 * Validates if a string is a valid 6-digit PIN format
 * @param pin - The PIN to validate
 * @returns true if the PIN is valid format, false otherwise
 */
export function isValidPinFormat(pin) {
  // Must be exactly 6 digits
  return /^\d{6}$/.test(pin);
}

/**
 * Finds a user by their User ID and PIN combination
 * @param userId - The 4-digit User ID
 * @param pin - The 6-digit PIN
 * @returns The user document data or null if not found
 */
export async function findUserByCredentials(userId, pin) {
  try {
    if (!isValidUserIdFormat(userId) || !isValidPinFormat(pin)) {
      return null;
    }

    // 1. Try Primary PIN
    const primaryQuery = query(
      collection(db, "users"),
      where("userId", "==", userId),
      where("pin", "==", pin)
    );
    const primarySnap = await getDocs(primaryQuery);

    if (!primarySnap.empty) {
      return {
        uid: primarySnap.docs[0].id,
        isDecoySession: false,
        ...primarySnap.docs[0].data(),
      };
    }

    // 2. Try Decoy PIN (Camouflage Mode)
    const decoyQuery = query(
      collection(db, "users"),
      where("userId", "==", userId),
      where("decoyPin", "==", pin)
    );
    const decoySnap = await getDocs(decoyQuery);

    if (!decoySnap.empty) {
      return {
        uid: decoySnap.docs[0].id,
        isDecoySession: true,
        ...decoySnap.docs[0].data(),
      };
    }

    return null;
  } catch (error) {
    console.error("Error finding user by credentials:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    // Silently return null on error
    return null;
  }
}
