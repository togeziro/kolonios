import { randomInt } from 'node:crypto';

const LOWERCASE = 'abcdefghjkmnpqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWERCASE + UPPERCASE + DIGITS;
const LENGTH = 14;

export function generateTemporaryPassword(): string {
  // First three picks guarantee one char from each class, so the result always
  // contains lowercase, uppercase, and a digit; remaining picks are uniform
  // over the full alphabet. Fisher–Yates shuffle hides the forced positions.
  // randomInt uses rejection sampling, avoiding modulo bias.
  const sets = [LOWERCASE, UPPERCASE, DIGITS];
  const chars: string[] = [];
  for (let i = 0; i < LENGTH; i++) {
    const set = i < sets.length ? sets[i] : ALL;
    chars.push(set[randomInt(set.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
