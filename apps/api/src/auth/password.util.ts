import * as crypto from "crypto";

/**
 * Secure password hashing using Node standard library scrypt.
 * Stores salt and derived key in format: <salt_hex>:<hash_hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Validates a plaintext candidate password against the stored salt:hash string
 * using constant-time comparison to prevent timing side-channels.
 */
export function verifyPassword(
  password: string,
  storedHash?: string | null,
): boolean {
  if (!storedHash || !storedHash.includes(":")) {
    return false;
  }

  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;

    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, keyBuffer.length);

    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}
