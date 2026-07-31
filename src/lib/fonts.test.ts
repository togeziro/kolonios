import { describe, expect, it } from 'vitest';
import { getFontsForTheme, loadFont, loadFontsForTheme } from './fonts';

describe('getFontsForTheme', () => {
  it('returns the font keys for a known theme', () => {
    expect(getFontsForTheme('vercel')).toEqual(['geist-sans', 'geist-mono']);
  });

  it('returns an empty array for themes without fonts', () => {
    expect(getFontsForTheme('claude')).toEqual([]);
  });

  it('returns an empty array for unknown themes', () => {
    expect(getFontsForTheme('nope')).toEqual([]);
  });
});

describe('loadFont', () => {
  it('no-ops outside the browser', async () => {
    await expect(loadFont('geist-sans')).resolves.toBeUndefined();
  });

  it('no-ops for unknown fonts', async () => {
    await expect(loadFont('nope')).resolves.toBeUndefined();
  });
});

describe('loadFontsForTheme', () => {
  it('resolves for themes without fonts', async () => {
    await expect(loadFontsForTheme('claude')).resolves.toBeUndefined();
  });

  it('resolves for unknown themes', async () => {
    await expect(loadFontsForTheme('nope')).resolves.toBeUndefined();
  });
});
