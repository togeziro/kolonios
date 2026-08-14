import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, isEncryptedSecret } from './secret-crypto';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('storage secret crypto', () => {
  beforeEach(() => {
    process.env.STORAGE_ENCRYPTION_KEY = TEST_KEY;
  });
  afterEach(() => {
    delete process.env.STORAGE_ENCRYPTION_KEY;
  });

  it('round-trips a secret through encrypt + decrypt', () => {
    const plain = 'super-secret-key';
    const encrypted = encryptSecret(plain);
    expect(encrypted).not.toBe(plain);
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe(plain);
  });

  it('produces a unique ciphertext per call (random IV)', () => {
    const plain = 'same-secret';
    const a = encryptSecret(plain);
    const b = encryptSecret(plain);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(plain);
    expect(decryptSecret(b)).toBe(plain);
  });

  it('decrypts with the sha256-derived key when the env value is not 64-hex', () => {
    process.env.STORAGE_ENCRYPTION_KEY = 'not-hex-but-stable-passphrase';
    const plain = 'secret';
    const encrypted = encryptSecret(plain);
    expect(decryptSecret(encrypted)).toBe(plain);
  });

  it('does not survive a key rotation (GCM tag fails)', () => {
    const plain = 'secret';
    const encrypted = encryptSecret(plain);
    process.env.STORAGE_ENCRYPTION_KEY = 'feedface'.repeat(8);
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it('passes through legacy plaintext values unchanged', () => {
    expect(isEncryptedSecret('plain-old-secret')).toBe(false);
    expect(decryptSecret('plain-old-secret')).toBe('plain-old-secret');
  });

  it('returns empty values untouched', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('throws for malformed encrypted payloads', () => {
    expect(() => decryptSecret('enc:v1:not-a-valid-payload')).toThrow();
  });
});
