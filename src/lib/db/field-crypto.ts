// Application-level encryption (AES-256-GCM) for the most sensitive free text:
// students' private check-in notes, counselor follow-up notes and support
// request messages. The database only ever stores ciphertext, so a leaked
// database credential or backup does not reveal them.
//
// Key: DATA_ENCRYPTION_KEY = 32 random bytes, base64-encoded
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Keep it in the hosting provider's secret store. Losing it makes the
// encrypted fields unreadable; rotating it requires re-encryption.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
let cachedKey: Buffer | null = null;
let warned = false;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, "base64");
    if (k.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
    cachedKey = k;
    return k;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATA_ENCRYPTION_KEY is not set. It is required in production.");
  }
  if (!warned) {
    console.warn("[crypto] DATA_ENCRYPTION_KEY not set — using an insecure development key.");
    warned = true;
  }
  cachedKey = createHash("sha256").update("educonnect-insecure-development-key").digest();
  return cachedKey;
}

export function encryptField(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy/plain value
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key (e.g. DATA_ENCRYPTION_KEY changed) or corrupted value: never
    // crash the page, never leak ciphertext — show the field as unavailable.
    console.error("[crypto] a protected field could not be decrypted (check DATA_ENCRYPTION_KEY).");
    return "[unavailable — encrypted with a different key]";
  }
}
