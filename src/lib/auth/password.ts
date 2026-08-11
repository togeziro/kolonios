import { randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 14;

export function generateTemporaryPassword(): string {
  const bytes = randomBytes(LENGTH);
  let password = '';
  for (let i = 0; i < LENGTH; i++) {
    password += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return password;
}
