// Progress and settings in localStorage, failing quietly (private mode, etc).

export interface Save {
  stars: Record<string, number>;
  muted: boolean;
  patterns: boolean;
  seenHints: Record<string, boolean>;
  daily: Record<string, { stars: number; share: string }>;
}

const KEY = 'lanternfall.v1';

export function loadSave(): Save {
  const base: Save = { stars: {}, muted: false, patterns: false, seenHints: {}, daily: {} };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...base, ...JSON.parse(raw) } : base;
  } catch {
    return base;
  }
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
