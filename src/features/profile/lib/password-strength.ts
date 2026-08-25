export type PasswordTier = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrength {
  /** 0..4, number of boosting criteria met; drives the meter segment fill. */
  score: 0 | 1 | 2 | 3 | 4;
  tier: PasswordTier;
  labelKey: string;
}

/**
 * Pure password strength scoring (no React, no i18n instance).
 *
 * Criteria (each +1 to score):
 *  - length >= 12
 *  - mixed case (lower + upper)
 *  - contains a digit
 *  - contains a symbol (non-alphanumeric)
 *
 * Gate: length >= 8 is the Better Auth minimum — anything shorter scores 0.
 * Tier mapping: 0-1 weak, 2 fair, 3 good, 4 strong.
 */
const MIN_LENGTH = 8;
const LONG_LENGTH = 12;

const TIER_LABEL_KEYS: Record<PasswordTier, string> = {
  weak: 'changePassword.strength.weak',
  fair: 'changePassword.strength.fair',
  good: 'changePassword.strength.good',
  strong: 'changePassword.strength.strong'
};

function tierForScore(score: number): PasswordTier {
  if (score >= 4) return 'strong';
  if (score === 3) return 'good';
  if (score === 2) return 'fair';
  return 'weak';
}

export function assessPasswordStrength(password: string): PasswordStrength {
  if (password.length < MIN_LENGTH) {
    return { score: 0, tier: 'weak', labelKey: TIER_LABEL_KEYS.weak };
  }

  const criteria = [
    password.length >= LONG_LENGTH,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];
  const score = criteria.filter(Boolean).length as PasswordStrength['score'];

  return { score, tier: tierForScore(score), labelKey: TIER_LABEL_KEYS[tierForScore(score)] };
}
