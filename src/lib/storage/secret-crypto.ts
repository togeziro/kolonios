import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getEnv } from '@/lib/env';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  // AES-256-GCM uses a 32-byte key. A 64-char hex string is used as-is; any
  // other value is hashed with SHA-256 to derive a stable 32-byte key.
  const material = getEnv('STORAGE_ENCRYPTION_KEY');
  if (!material) {
    throw new Error('STORAGE_ENCRYPTION_KEY is not set');
  }
  if (/^[0-9a-fA-F]{64}$/.test(material)) {
    return Buffer.from(material, 'hex');
  }
  return createHash('sha256').update(material).digest();
}

/**
 * True when the value was produced by `encryptSecret` (starts with the
 * `enc:v1:` prefix). Used to detect plaintext legacy values transparently.
 */
export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Encrypts a storage secret access key at rest using AES-256-GCM with a
 * random IV + auth tag. Output format: `enc:v1:<iv>.<tag>.<ciphertext>`
 * (all standard base64). Returns the input unchanged when empty.
 */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const parts = [iv, tag, ciphertext].map((buf) => buf.toString('base64'));
  return `${PREFIX}${parts.join('.')}`;
}

/**
 * Decrypts a value produced by `encryptSecret`. Values not carrying the
 * `enc:v1:` prefix are returned as-is (legacy plaintext), so existing rows
 * keep working without a migration. Throws when the value cannot be
 * decrypted (wrong key or tampered ciphertext) — GCM tag verification.
 */
export function decryptSecret(stored: string): string {
  if (!stored) return stored;
  if (!isEncryptedSecret(stored)) return stored;
  const [, , payload] = stored.split(':');
  const [ivB64, tagB64, ciphertextB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted secret payload');
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64 as string, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64 as string, 'base64')),
    decipher.final()
  ]);
  return plain.toString('utf8');
}
