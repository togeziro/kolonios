import { describe, expect, it } from 'vitest';
import { getColorForName, getInitials } from './avatar-color';

describe('getInitials', () => {
  it('extracts first and last name initials', () => {
    expect(getInitials('Olivia Rhye')).toBe('OR');
  });

  it('extracts initials from multi-part names', () => {
    expect(getInitials('John Fitzgerald Kennedy')).toBe('JK');
  });

  it('uses first letter for single-word names', () => {
    expect(getInitials('Cher')).toBe('C');
  });

  it('uppercases lowercase input', () => {
    expect(getInitials('olivia rhye')).toBe('OR');
  });

  it('returns empty string for empty input', () => {
    expect(getInitials('')).toBe('');
  });
});

describe('getColorForName', () => {
  it('returns a deterministic palette entry for the same name', () => {
    expect(getColorForName('Olivia Rhye')).toEqual(getColorForName('Olivia Rhye'));
  });

  it('returns entries within the palette', () => {
    const colors = ['Olivia Rhye', 'Noah Pierre', 'Koray Okumus', 'Candice Wu', 'Mia Romberg'];
    for (const name of colors) {
      const entry = getColorForName(name);
      expect(entry.bg).toMatch(/^bg-/);
      expect(entry.fg).toMatch(/^text-/);
    }
  });

  it('distributes across multiple colors', () => {
    const names = Array.from({ length: 32 }, (_, i) => `User ${i}`);
    const unique = new Set(names.map((n) => getColorForName(n).bg));
    expect(unique.size).toBeGreaterThan(1);
  });
});
