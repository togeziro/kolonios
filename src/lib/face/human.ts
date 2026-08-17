import Human from '@vladmandic/human';

let humanInstance: Human | null = null;

export async function getHuman(): Promise<Human> {
  if (humanInstance) return humanInstance;

  humanInstance = new Human({
    backend: 'webgl',
    modelBasePath: '/models/human/',
    debug: false,
    async: true,
    warmup: 'full',
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

  await humanInstance.load();
  return humanInstance;
}

export function isHumanLoaded(): boolean {
  return humanInstance !== null;
}
