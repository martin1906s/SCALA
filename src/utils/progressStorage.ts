const STORAGE_KEY = 'scala-save-v1';

export interface GameSaveData {
  maxCompletedLevel: number;
  stars: Record<number, number>;
}

function defaultSave(): GameSaveData {
  return { maxCompletedLevel: 0, stars: {} };
}

export function loadSave(): GameSaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultSave();
    }
    const parsed = JSON.parse(raw) as Partial<GameSaveData>;
    return {
      maxCompletedLevel: parsed.maxCompletedLevel ?? 0,
      stars: parsed.stars ?? {},
    };
  } catch {
    return defaultSave();
  }
}

export function persistMaxCompleted(levelId: number): void {
  const save = loadSave();
  if (levelId > save.maxCompletedLevel) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...save,
      maxCompletedLevel: levelId,
    }));
  }
}

export function persistLevelStars(levelId: number, stars: number): void {
  const save = loadSave();
  const prev = save.stars[levelId] ?? 0;
  if (stars <= prev) {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...save,
    stars: { ...save.stars, [levelId]: stars },
  }));
}

export function isLevelUnlocked(levelId: number): boolean {
  const save = loadSave();
  return levelId <= save.maxCompletedLevel + 1;
}

export function getContinueLevelIndex(levelCount: number): number {
  const save = loadSave();
  if (save.maxCompletedLevel >= levelCount) {
    return 0;
  }
  return Math.min(save.maxCompletedLevel, levelCount - 1);
}
