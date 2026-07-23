type FontDef = {
  family: string;
  variable: string;
};

const FONTS: Record<string, FontDef> = {
  'geist-sans': { family: 'Geist Sans', variable: '--font-geist-sans' },
  'geist-mono': { family: 'Geist Mono', variable: '--font-geist-mono' },
  inter: { family: 'Inter Variable', variable: '--font-inter' },
  'dm-sans': { family: 'DM Sans Variable', variable: '--font-dm-sans' },
  outfit: { family: 'Outfit Variable', variable: '--font-outfit' },
  'fira-code': { family: 'Fira Code Variable', variable: '--font-fira-code' },
  'jetbrains-mono': { family: 'JetBrains Mono Variable', variable: '--font-jetbrains-mono' },
  'architects-daughter': { family: 'Architects Daughter', variable: '--font-architects-daughter' },
  'space-mono': { family: 'Space Mono', variable: '--font-space-mono' }
};

const THEME_FONTS: Record<string, string[]> = {
  vercel: ['geist-sans', 'geist-mono'],
  claude: [],
  neobrutualism: ['dm-sans', 'space-mono'],
  supabase: ['outfit'],
  mono: ['geist-mono'],
  notebook: ['architects-daughter'],
  'light-green': ['inter', 'jetbrains-mono'],
  zen: ['inter', 'jetbrains-mono'],
  'astro-vista': ['outfit', 'fira-code'],
  whatsapp: []
};

const importMap: Record<string, () => Promise<unknown>> = {
  'geist-sans': () => import('@fontsource/geist-sans'),
  'geist-mono': () => import('@fontsource/geist-mono'),
  inter: () => import('@fontsource-variable/inter'),
  'dm-sans': () => import('@fontsource-variable/dm-sans'),
  outfit: () => import('@fontsource-variable/outfit'),
  'fira-code': () => import('@fontsource-variable/fira-code'),
  'jetbrains-mono': () => import('@fontsource-variable/jetbrains-mono'),
  'architects-daughter': () => import('@fontsource/architects-daughter'),
  'space-mono': () => import('@fontsource/space-mono')
};

const loaded = new Set<string>();

export function getFontsForTheme(theme: string): string[] {
  return THEME_FONTS[theme] ?? [];
}

export async function loadFont(key: string): Promise<void> {
  if (loaded.has(key)) return;
  if (typeof window === 'undefined') return;

  const font = FONTS[key];
  if (!font) return;

  try {
    await importMap[key]?.();
    loaded.add(key);
    document.documentElement.style.setProperty(font.variable, font.family);
  } catch {
    // Font failed to load — fallback fonts in the theme CSS will be used
  }
}

export async function loadFontsForTheme(theme: string): Promise<void> {
  const fontKeys = getFontsForTheme(theme);
  await Promise.all(fontKeys.map(loadFont));
}
