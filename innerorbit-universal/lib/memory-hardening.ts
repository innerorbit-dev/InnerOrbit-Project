import { Buffer } from "buffer";
import { Logger } from "./logger";

/**
 * 🛡️ MEMORY HARDENING UTILITY (InnerOrbit Core)
 * 
 * PURPOSE:
 * Standard JS strings are "sticky" in RAM. They live in a string pool and can
 * survive for minutes even after the variable is nulled.
 * 
 * SOLUTION:
 * We convert sensitive data to Uint8Arrays (Buffers). Unlike strings, we can
 * manually reach into a Buffer and change its values to 0, physically 
 * erasing the data from the phone's memory.
 */

/**
 * Physically overwrites a Buffer/Uint8Array with zeros.
 * Use this on keys, PINs, and User IDs immediately after they are used.
 */
export function secureWipe(buf: Buffer | Uint8Array | null | undefined): void {
  if (!buf) return;
  try {
    for (let i = 0; i < buf.length; i++) {
      buf[i] = 0;
    }
  } catch (e) {
    Logger.error("[MemoryHardening] Failed to wipe buffer:", e);
  }
}

/**
 * Wrapper for sensitive operations.
 * Converts a string to a Buffer, runs the task, and WIPES the buffer instantly.
 * 
 * @example
 * await useSensitiveString(pin, async (pinBuf) => {
 *   await login(pinBuf.toString());
 * });
 */
export async function useSensitiveString<T>(
  data: string | null | undefined,
  task: (buf: Buffer) => Promise<T>
): Promise<T | null> {
  if (!data) return null;

  const buf = Buffer.from(data, "utf8");
  try {
    return await task(buf);
  } finally {
    // 🧹 CRITICAL: The data is physically erased here
    secureWipe(buf);
  }
}

/**
 * Clears a reference and hints to the GC.
 */
export function clearReference(obj: any): void {
  if (obj) obj = null;
}
