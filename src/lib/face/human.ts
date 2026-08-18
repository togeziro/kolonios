import Human from '@vladmandic/human';

let humanInstance: Human | null = null;
let loadPromise: Promise<Human> | null = null;

export async function getHuman(): Promise<Human> {
  if (humanInstance) return humanInstance;
  // Guard against concurrent first calls (double-tap / parallel renders):
  // share a single load promise so only one instance is ever created.
  if (!loadPromise) {
    loadPromise = (async () => {
      const human = new Human({
        backend: 'webgl',
        modelBasePath: '/models/human/',
        debug: false,
        async: true,
        warmup: 'full',
        // Only face is bundled/needed; disable everything else so warmup does
        // not try to fetch model JSONs that are not deployed (e.g. handtrack).
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        face: {
          enabled: true,
          detector: { maxDetected: 1, rotation: true },
          mesh: { enabled: false },
          iris: { enabled: false },
          description: { enabled: true },
          emotion: { enabled: false },
          antispoof: { enabled: true },
          liveness: { enabled: true }
        }
      });
      await human.load();
      humanInstance = human;
      return human;
    })();
  }
  try {
    return await loadPromise;
  } catch (error) {
    // A failed load must not poison the singleton: allow a fresh retry
    // and never cache a half-initialized instance.
    loadPromise = null;
    throw error;
  }
}

export function isHumanLoaded(): boolean {
  return humanInstance !== null;
}
