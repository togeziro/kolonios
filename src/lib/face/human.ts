import Human from '@vladmandic/human';

let humanInstance: Human | null = null;
let loadPromise: Promise<Human> | null = null;
// Bumped on every dispose so an in-flight load can detect it was superseded
// and release its fresh models instead of resurrecting the singleton.
let loadGeneration = 0;

export async function getHuman(): Promise<Human> {
  if (humanInstance) return humanInstance;
  // Guard against concurrent first calls (double-tap / parallel renders):
  // share a single load promise so only one instance is ever created.
  if (!loadPromise) {
    const generation = ++loadGeneration;
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
      if (generation !== loadGeneration) {
        // Disposed while loading: release the fresh models immediately
        // instead of caching an instance nobody owns anymore.
        human.models.reset();
        throw new Error('Human.js load discarded: disposed during load');
      }
      humanInstance = human;
      return human;
    })();
  }
  const pending = loadPromise;
  try {
    return await pending;
  } catch (error) {
    // A failed load must not poison the singleton: allow a fresh retry
    // and never cache a half-initialized instance. Only clear when this
    // caller is still awaiting the current shared promise — a dispose that
    // happened mid-flight already reset it for the next load.
    if (loadPromise === pending) loadPromise = null;
    throw error;
  }
}

export function isHumanLoaded(): boolean {
  return humanInstance !== null;
}

/**
 * Release all loaded models (CPU/GPU tensors) and reset the singleton so the
 * next getHuman() starts a fresh load. Safe to call when nothing is loaded.
 * Registered as the Vite HMR dispose handler below so dev-time module
 * reloads cannot orphan a WebGL backend + model weights in memory.
 */
export function disposeHuman(): void {
  loadGeneration += 1;
  loadPromise = null;
  if (humanInstance) {
    humanInstance.models.reset();
    humanInstance = null;
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => disposeHuman());
}
