import { describe, expect, it } from 'vitest';
import { getFontsForTheme, loadFont, loadFontsForTheme } from './fonts';

describe('getFontsForTheme', () => {
  it('returns the font keys for a known preset', () => {
    expect(getFontsForTheme('brutalist')).toEqual(['dm-sans', 'space-mono']);
  });

  it('returns the font keys for tangerine', () => {
    expect(getFontsForTheme('tangerine')).toEqual(['inter', 'jetbrains-mono']);
  });

  it('returns an empty array for unknown themes', () => {
    expect(getFontsForTheme('nope')).toEqual([]);
  });
});

describe('loadFont', () => {
  it('no-ops outside the browser', async () => {
    await expect(loadFont('dm-sans')).resolves.toBeUndefined();
  });

  it('no-ops for unknown fonts', async () => {
    await expect(loadFont('nope')).resolves.toBeUndefined();
  });
});

describe('loadFontsForTheme', () => {
  it('resolves for unknown themes', async () => {
    await expect(loadFontsForTheme('nope')).resolves.toBeUndefined();
  });
});
