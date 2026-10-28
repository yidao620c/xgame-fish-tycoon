/** 存档（localStorage）+ 离线补算 */

import { YEAR_SECONDS } from './items';
import { createGame } from './state';
import { MAX_OFFLINE_YEARS, advance } from './sim';
import type { GameState } from './types';

const KEY = 'fish-tycoon-cn-v1';

export function save(state: GameState): void {
  try {
    const data: GameState = {
      ...state,
      customers: [],
      messages: [],
      lastSavedWall: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 隐私模式下忽略 */
  }
}

export interface LoadResult {
  state: GameState;
  offlineYears: number;
}

export function load(): LoadResult | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (!parsed || parsed.version !== 1 || !parsed.tanks || !Array.isArray(parsed.fish)) return null;
    const base = createGame(parsed.seed ?? 12345);
    const state: GameState = {
      ...base,
      ...parsed,
      tanks: { ...base.tanks, ...parsed.tanks },
      research: { ...base.research, ...parsed.research },
      stock: { ...parsed.stock },
      stats: { ...base.stats, ...parsed.stats },
      magicFound: (parsed.magicFound ?? base.magicFound).slice(0, 7),
      customers: [],
      messages: [],
      screen: 'tank',
      selected: null,
      hawkCd: 0,
    };
    const elapsedWall = Math.max(0, (Date.now() - (parsed.lastSavedWall ?? Date.now())) / 1000);
    const offlineYears = Math.min(MAX_OFFLINE_YEARS, (elapsedWall * 1) / YEAR_SECONDS);
    if (offlineYears > 0.02) advance(state, offlineYears);
    return { state, offlineYears };
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
