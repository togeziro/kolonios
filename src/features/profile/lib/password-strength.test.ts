import { describe, expect, it } from 'vitest';
import { assessPasswordStrength } from './password-strength';

describe('assessPasswordStrength', () => {
  it('scores empty input as weak with score 0', () => {
    const result = assessPasswordStrength('');
    expect(result.score).toBe(0);
    expect(result.tier).toBe('weak');
    expect(result.labelKey).toBe('changePassword.strength.weak');
  });

  it('rejects anything shorter than 8 characters (Better Auth minimum)', () => {
    expect(assessPasswordStrength('Ab1!').tier).toBe('weak');
    expect(assessPasswordStrength('Ab1!').score).toBe(0);
    expect(assessPasswordStrength('Ab1!LongButTooShortIsFine').tier).not.toBe('weak');
  });

  it('scores an 8-char lowercase-only password as weak', () => {
    const result = assessPasswordStrength('password');
    expect(result.tier).toBe('weak');
    expect(result.labelKey).toBe('changePassword.strength.weak');
  });

  it('keeps long single-class passwords weak', () => {
    expect(assessPasswordStrength('aaaaaaaaaaaaaaaaaaaa').tier).toBe('weak');
  });

  it('scores mixed case plus digit as fair', () => {
    const result = assessPasswordStrength('Password1');
    expect(result.tier).toBe('fair');
    expect(result.score).toBe(2);
    expect(result.labelKey).toBe('changePassword.strength.fair');
  });

  it('boosts to good when a symbol joins mixed case and digit', () => {
    const result = assessPasswordStrength('Password1!');
    expect(result.tier).toBe('good');
    expect(result.score).toBe(3);
    expect(result.labelKey).toBe('changePassword.strength.good');
  });

  it('reaches strong with 12+ chars and full character variety', () => {
    const result = assessPasswordStrength('Str0ng!Passw0rd');
    expect(result.tier).toBe('strong');
    expect(result.score).toBe(4);
    expect(result.labelKey).toBe('changePassword.strength.strong');
  });

  it('treats length >= 12 as one boosting criterion among others', () => {
    // 12+ chars but no upper/symbol -> length + digit criteria met (score 2)
    expect(assessPasswordStrength('password123456').score).toBe(2);
    expect(assessPasswordStrength('password1234').tier).toBe('fair');
  });
});
