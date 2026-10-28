/** 游戏状态：创建、查询与通用操作 */

import {
  COMMON_FINS,
  FINS,
  MAGIC,
  SPECIES,
  breedKey,
  isLeaf,
  magicIndexOf,
} from './genetics';
import {
  ADULT_AGE,
  BASE_CAPACITY,
  EGG_YEARS,
  ITEM_MAP,
  RESEARCH_MAP,
  START_CASH,
  type ResearchLine,
} from './items';
import { clamp, mulberry32 } from './rng';
import type { Fish, GameState, TankId } from './types';

export const TANK_IDS: TankId[] = ['tank1', 'tank2', 'sale'];

export function createGame(seed = Date.now() % 100000): GameState {
  const state: GameState = {
    version: 1,
    time: 0,
    cash: START_CASH,
    speedIdx: 1,
    tanks: {
      tank1: { id: 'tank1', owned: true, pollution: 4, food: 0, installed: [] },
      tank2: { id: 'tank2', owned: false, pollution: 0, food: 0, installed: [] },
      sale: { id: 'sale', owned: true, pollution: 2, food: 0, installed: [] },
    },
    fish: [],
    stock: { food1: 4 },
    research: { env: 0, nutrition: 0, ads: 0 },
    researchJob: null,
    discovered: [],
    magicFound: MAGIC.map(() => false),
    screen: 'tank',
    activeTank: 'tank1',
    selected: null,
    customers: [],
    stats: { sold: 0, earned: 0, bred: 0, died: 0, eggsBought: 0, peak: 0, magicBorn: 0 },
    askingPrice: 130,
    hawkCd: 0,
    saleTimer: 0,
    seed,
    messages: [],
    nextId: 1,
    onboarding: false,
    lastSavedWall: 0,
  };

  // 店里的两条成年展示鱼（同种但鳍基因不同）+ 两枚杂交卵
  const starters: { sp: number; fin: number; sex: 'm' | 'f'; age?: number; egg?: boolean }[] = [
    { sp: 0, fin: 8, sex: 'f', age: 22 },
    { sp: 0, fin: 14, sex: 'm', age: 24 },
    { sp: 1, fin: 9, sex: 'f', egg: true },
    { sp: 2, fin: 10, sex: 'm', egg: true },
  ];
  for (const s of starters) {
    addFish(state, { ...s, tank: 'tank1' });
  }
  state.stats.peak = state.fish.length;
  return state;
}

export function rnd(state: GameState): () => number {
  const gen = mulberry32(state.seed);
  state.seed = (state.seed + 0x9e3779b9) >>> 0;
  return gen;
}

/** 快速单次随机 0..1（推进种子，保证可复现） */
export function rand(state: GameState): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

export function log(state: GameState, text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
  state.messages.push({ text, kind, id: state.nextId++ });
  if (state.messages.length > 4) state.messages.splice(0, state.messages.length - 4);
}

export interface NewFish {
  sp: number;
  fin: number;
  sex?: 'm' | 'f';
  age?: number;
  egg?: boolean;
  tank: TankId;
  fragile?: boolean;
  health?: number;
  price?: number;
}

export function addFish(state: GameState, opts: NewFish): Fish {
  const gender = opts.sex ?? (state.seed % 2 === 0 ? 'f' : 'm');
  const fish: Fish = {
    id: `f${state.nextId++}`,
    sp: opts.sp,
    fin: opts.fin,
    sex: gender,
    age: opts.age ?? (opts.egg ? 0 : 0.02),
    egg: opts.egg ?? false,
    health: opts.health ?? 100,
    fed: 78,
    disease: 0,
    pregnancy: 0,
    sireSp: -1,
    sireFin: -1,
    fragile: opts.fragile ?? false,
    dead: false,
    tank: opts.tank,
    x: 0.12 + ((state.nextId * 37) % 70) / 100,
    y: 0.2 + ((state.nextId * 53) % 55) / 100,
    vx: ((state.nextId % 2 === 0 ? 1 : -1) * 0.02) + 0.01,
    vy: 0.004,
    seed: (state.nextId * 2654435761) % 1000,
    price: opts.price ?? state.askingPrice,
    soldFlash: 0,
  };
  state.fish.push(fish);
  const key = breedKey(fish.sp, fish.fin);
  if (!state.discovered.includes(key)) state.discovered.push(key);
  const m = magicIndexOf(fish.sp, fish.fin);
  if (m >= 0 && !state.magicFound[m]) {
    state.magicFound[m] = true;
    state.stats.magicBorn++;
    log(state, `✨ 发现魔法鱼：${MAGIC[m].name}！`, 'good');
  }
  return fish;
}

export function tankFish(state: GameState, tank: TankId): Fish[] {
  return state.fish.filter((f) => f.tank === tank && !f.dead);
}

export function allTankFish(state: GameState, tank: TankId): Fish[] {
  return state.fish.filter((f) => f.tank === tank);
}

export interface TankEffects {
  diseaseReduce: number;
  pollutionClean: number;
  offspring: number;
  willing: number;
  customerRate: number;
  heal: number;
  autoFeed: boolean;
  growth: number;
  hungerScale: number;
  selfHeal: boolean;
  mutation: number;
  magicAlive: boolean[];
}

export function capacityOf(state: GameState, tank: TankId): number {
  if (tank === 'sale') return 6;
  let cap = BASE_CAPACITY + state.research.env * 3;
  for (const id of state.tanks[tank].installed) {
    const item = ITEM_MAP[id];
    if (item?.capacity) cap += item.capacity;
  }
  return cap;
}

export function tankEffects(state: GameState, tank: TankId): TankEffects {
  const fx: TankEffects = {
    diseaseReduce: 0,
    pollutionClean: 0,
    offspring: 0,
    willing: 0,
    customerRate: 0,
    heal: 0,
    autoFeed: false,
    growth: 1,
    hungerScale: 1,
    selfHeal: false,
    mutation: 0,
    magicAlive: MAGIC.map(() => false),
  };
  const t = state.tanks[tank];
  for (const id of t.installed) {
    const item = ITEM_MAP[id];
    if (!item) continue;
    fx.diseaseReduce += item.diseaseReduce ?? 0;
    fx.pollutionClean += item.pollutionClean ?? 0;
    fx.offspring += item.offspring ?? 0;
    fx.willing += item.willing ?? 0;
    fx.customerRate += item.customerRate ?? 0;
    fx.heal += item.heal ?? 0;
    if (item.autoFeed) fx.autoFeed = true;
  }
  for (const f of state.fish) {
    if (f.tank !== tank || f.dead || f.egg) continue;
    const m = magicIndexOf(f.sp, f.fin);
    if (m < 0) continue;
    fx.magicAlive[m] = true;
  }
  if (fx.magicAlive[0]) fx.offspring += 1; // Greenfin Spotanus
  if (fx.magicAlive[1]) fx.hungerScale *= 0.7; // Spekled Leaffish
  if (fx.magicAlive[2]) fx.selfHeal = true; // Crimson Comet
  if (fx.magicAlive[4]) fx.growth *= 1.25; // Oriental Goldbulb
  if (fx.magicAlive[5]) fx.heal += 2.4; // Orange Snooper
  if (fx.magicAlive[6]) fx.mutation += 0.2; // Wasp Grouper
  fx.diseaseReduce = Math.min(0.75, fx.diseaseReduce + state.research.nutrition * 0.08);
  return fx;
}

export function isAdult(f: Fish): boolean {
  return !f.egg && f.age >= ADULT_AGE;
}

export function growthProgress(f: Fish): number {
  return clamp(f.age / ADULT_AGE, 0, 1);
}

export function statusText(f: Fish): string {
  if (f.dead) return '已死亡';
  if (f.egg) return `孵化中 ${Math.ceil((EGG_YEARS - f.age) * 600)} 秒`;
  if (f.pregnancy > 0) return '怀孕中';
  if (f.disease === 1) return '真菌病';
  if (f.disease === 2) return '白点病';
  if (!isAdult(f)) return '幼鱼';
  return '成熟';
}

/** 随机生成一条可用鱼卵的基因 */
export function randomEggGenome(
  state: GameState,
  kind: 'common' | 'rare' | 'mystery',
): { sp: number; fin: number } {
  const r = rnd(state);
  const leaves = SPECIES.map((_, i) => (isLeaf(i) ? i : -1)).filter((i) => i >= 0);
  let sp: number;
  if (kind === 'common') sp = leaves[Math.floor(r() * 5)];
  else if (kind === 'rare') sp = leaves[4 + Math.floor(r() * 4)];
  else sp = leaves[7 + Math.floor(r() * 4)];
  const magicChance = kind === 'mystery' ? 0.24 : kind === 'rare' ? 0.06 : 0;
  let fin: number;
  if (r() < magicChance) {
    fin = Math.floor(r() * 7);
  } else {
    fin = COMMON_FINS[Math.floor(r() * COMMON_FINS.length)];
  }
  return { sp, fin };
}

export function researchCost(state: GameState, line: ResearchLine): number | null {
  const level = state.research[line];
  if (level >= 3) return null;
  return RESEARCH_MAP[line].costs[level];
}

export function finName(fin: number): string {
  return FINS[fin].name;
}

export function speciesName(sp: number): string {
  return SPECIES[sp].name;
}
