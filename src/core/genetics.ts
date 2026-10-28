/**
 * 育子系统：21 鱼种（二叉树）+ 21 鳍基因（环形突变）= 441 品种。
 */

export interface SpeciesShape {
  /** 体长（相对单位，1 ≈ 60px 基准） */
  len: number;
  /** 体高 */
  h: number;
  /** 吻部突出 */
  snout: number;
  /** 背鳍高度 */
  dorsal: number;
  /** 臀鳍/腹鳍 */
  ventral: number;
  /** 眼睛大小 */
  eye: number;
  /** 身体弧度（0 扁, 1 圆） */
  arch: number;
}

export interface Species {
  name: string;
  egg?: number;
  combine?: [number, number];
  shape: SpeciesShape;
  /** [背部, 体侧, 腹部] */
  colors: [string, string, string];
  pattern: 'none' | 'spots' | 'bars' | 'stripe' | 'gradient' | 'mesh';
  /** 基础价值 */
  value: number;
  /** 树叶掩码 */
  mask: number;
}

const S = (
  name: string,
  shape: Partial<SpeciesShape>,
  colors: [string, string, string],
  pattern: Species['pattern'],
  value: number,
  egg?: number,
  combine?: [number, number],
): Species => ({
  name,
  egg,
  combine,
  shape: { len: 0.9, h: 0.34, snout: 0, dorsal: 0.22, ventral: 0.16, eye: 0.055, arch: 0.7, ...shape },
  colors,
  pattern,
  value,
  mask: 0,
});

export const SPECIES: Species[] = [
  S('Spotanus', { len: 0.86, h: 0.33, dorsal: 0.2, arch: 0.55 }, ['#5d7b90', '#a9c2cf', '#e7f1f6'], 'spots', 90, 160),
  S('Goldbulb', { len: 0.78, h: 0.44, dorsal: 0.24, arch: 1 }, ['#b06a10', '#eda92f', '#ffe19a'], 'gradient', 90, 160),
  S('Fire-Arrow', { len: 1, h: 0.26, snout: 0.1, dorsal: 0.16, arch: 0.35 }, ['#c8402a', '#e8734a', '#ffd8b0'], 'stripe', 150, 240),
  S('Leaffish', { len: 0.72, h: 0.52, dorsal: 0.3, arch: 1 }, ['#3c7a3a', '#6fae4c', '#d6edab'], 'bars', 150, 240),
  S('Snooper', { len: 0.92, h: 0.36, snout: 0.2, dorsal: 0.2, arch: 0.5 }, ['#b06018', '#e08c33', '#ffd39a'], 'bars', 210, 320),
  S('Grouper', { len: 0.84, h: 0.47, snout: 0.06, dorsal: 0.28, arch: 0.9 }, ['#5f6b34', '#8b9a52', '#d9d69a'], 'mesh', 210, 320),
  S('Goldshark', { len: 1.08, h: 0.3, snout: 0.09, dorsal: 0.3, arch: 0.4 }, ['#a97b22', '#dcb44f', '#f7e7b8'], 'gradient', 260, 400),
  S('Fruitfish', { len: 0.76, h: 0.5, dorsal: 0.22, arch: 1 }, ['#b4652a', '#e2933f', '#ffe0b8'], 'spots', 260, 400),
  S('Flashfish', { len: 1.02, h: 0.28, snout: 0.05, dorsal: 0.14, arch: 0.3 }, ['#b34d78', '#e88bb0', '#ffd9e8'], 'stripe', 320, 520),
  S('Comet', { len: 0.92, h: 0.32, dorsal: 0.24, arch: 0.7 }, ['#a8243c', '#e04558', '#ffc3c9'], 'gradient', 320, 520),
  S('Carp', { len: 0.98, h: 0.4, snout: 0.06, dorsal: 0.24, arch: 0.8 }, ['#c9502c', '#f2f1ea', '#ffffff'], 'spots', 380, 640),
  S('Mint Rasbora', { len: 0.88, h: 0.34, dorsal: 0.2, arch: 0.6 }, ['#3f7f72', '#8ed3b4', '#e4fff3'], 'mesh', 170, undefined, [0, 1]),
  S('Silk Danio', { len: 0.9, h: 0.38, snout: 0.05, dorsal: 0.26, arch: 0.7 }, ['#6f6a3a', '#b9c071', '#f0f4c8'], 'stripe', 170, undefined, [2, 3]),
  S('Amber Perch', { len: 0.92, h: 0.4, snout: 0.1, dorsal: 0.28, arch: 0.7 }, ['#8a5518', '#d19a3c', '#ffe2ac'], 'bars', 210, undefined, [4, 5]),
  S('Pearl Gourami', { len: 0.9, h: 0.36, snout: 0.05, dorsal: 0.26, arch: 0.6 }, ['#7d7f96', '#dfe0ee', '#fbfbff'], 'spots', 210, undefined, [6, 7]),
  S('Opal Betta', { len: 0.86, h: 0.3, dorsal: 0.3, arch: 0.5 }, ['#8a5a9c', '#c9a3e0', '#ffe8ff'], 'gradient', 240, undefined, [8, 9]),
  S('Jade Cichlid', { len: 0.9, h: 0.44, snout: 0.06, dorsal: 0.3, arch: 0.85 }, ['#1f6b52', '#3fae7c', '#d6ffe8'], 'mesh', 260, undefined, [11, 12]),
  S('Topaz Discus', { len: 0.82, h: 0.52, snout: 0.04, dorsal: 0.3, arch: 1 }, ['#4a5f8a', '#9fb6d8', '#f0f6ff'], 'bars', 280, undefined, [13, 14]),
  S('Coral Arowana', { len: 1.05, h: 0.34, snout: 0.14, dorsal: 0.2, arch: 0.5 }, ['#a33a3a', '#f08070', '#ffd8cc'], 'stripe', 320, undefined, [15, 10]),
  S('Prism Angelfish', { len: 0.84, h: 0.62, dorsal: 0.42, ventral: 0.3, arch: 1 }, ['#6d4f9c', '#b18ee0', '#ffeaff'], 'gradient', 380, undefined, [16, 17]),
  S('Dragon Koi', { len: 1.04, h: 0.46, snout: 0.08, dorsal: 0.34, arch: 0.9 }, ['#2c3f5a', '#5fa3c9', '#e8fbff'], 'spots', 520, undefined, [19, 18]),
];

// ---- 树叶掩码 ----
SPECIES.forEach((s, i) => {
  if (s.combine) {
    s.mask = SPECIES[s.combine[0]].mask | SPECIES[s.combine[1]].mask;
  } else {
    s.mask = 1 << i;
  }
});

export const SPECIES_COUNT = SPECIES.length;

export function isLeaf(sp: number): boolean {
  return SPECIES[sp].combine === undefined;
}

/** 两条亲鱼的子代鱼种：包含两者基因的最小节点（即它们在树上的共同祖先） */
export function unite(a: number, b: number): number {
  const mask = SPECIES[a].mask | SPECIES[b].mask;
  let best = -1;
  let bestBits = Infinity;
  for (let i = 0; i < SPECIES.length; i++) {
    const m = SPECIES[i].mask;
    if ((m & mask) !== mask) continue;
    let bits = m;
    let n = 0;
    while (bits) {
      n += bits & 1;
      bits >>= 1;
    }
    if (n < bestBits) {
      bestBits = n;
      best = i;
    }
  }
  return best >= 0 ? best : Math.max(a, b);
}

/** 杂交跨度（1 = 同种/近亲） */
export function crossSpan(a: number, b: number): number {
  let bits = SPECIES[a].mask | SPECIES[b].mask;
  let n = 0;
  while (bits) {
    n += bits & 1;
    bits >>= 1;
  }
  return n;
}

// ---- 鳍基因 ----

export type TailKind = 'fan' | 'forked' | 'veil' | 'sword' | 'lyre';

export interface FinGene {
  name: string;
  /** 中文前缀，用在水缸提示里 */
  cn: string;
  color: string;
  glow: string;
  tail: TailKind;
  pattern: 'none' | 'spots' | 'bars' | 'stripe' | 'rim';
  value: number;
  /** 只会从突变/神秘鱼卵出现 */
  rare: boolean;
}

const F = (
  name: string,
  cn: string,
  color: string,
  glow: string,
  tail: TailKind,
  pattern: FinGene['pattern'],
  value: number,
  rare = false,
): FinGene => ({ name, cn, color, glow, tail, pattern, value, rare });

/** 环形顺序见 FIN_RING：突变为相邻鳍基因 */
export const FINS: FinGene[] = [
  F('Greenfin', '绿鳍', '#3fae5a', '#b6f5c8', 'fan', 'none', 70, true),
  F('Spekled', '斑点', '#b9c6d4', '#ffffff', 'forked', 'spots', 70, true),
  F('Crimson', '绯红', '#d1303f', '#ffb3b8', 'veil', 'stripe', 74, true),
  F('Canary', '金丝雀', '#f2c531', '#fff3b0', 'sword', 'none', 96, true),
  F('Oriental', '东方', '#d9452d', '#ffd28a', 'lyre', 'bars', 78, true),
  F('Orange', '橘色', '#f08a2a', '#ffe0a8', 'fan', 'rim', 66, true),
  F('Wasp', '胡蜂', '#f0b324', '#fff0a0', 'forked', 'bars', 72, true),
  F('Tiger', '虎纹', '#d7a53a', '#ffe1a0', 'fan', 'bars', 34, false),
  F('Pink', '粉红', '#e874a8', '#ffd3e6', 'veil', 'none', 30, false),
  F('Blue', '蓝鳍', '#3d7fd1', '#bfe0ff', 'forked', 'none', 28, false),
  F('Silver', '银白', '#cfd8e0', '#ffffff', 'fan', 'rim', 24, false),
  F('Gold', '金鳍', '#e8b73c', '#fff0b8', 'lyre', 'none', 32, false),
  F('Violet', '紫罗兰', '#8f5bd8', '#e3ccff', 'veil', 'none', 30, false),
  F('Jade', '翡翠', '#3fbf9b', '#c2ffe9', 'sword', 'rim', 32, false),
  F('Copper', '赤铜', '#c0713a', '#ffd2ab', 'fan', 'none', 26, false),
  F('Onyx', '墨黑', '#2f3a4a', '#8fa2bb', 'forked', 'rim', 36, false),
  F('Ivory', '象牙', '#f0e6d2', '#fffaf0', 'veil', 'none', 28, false),
  F('Sunset', '晚霞', '#f2713f', '#ffd0a8', 'lyre', 'stripe', 34, false),
  F('Moon', '月光', '#b9c6f2', '#f2f5ff', 'fan', 'rim', 30, false),
  F('Ember', '余烬', '#e2542b', '#ffb894', 'sword', 'spots', 38, false),
  F('Storm', '暴风', '#6f7fa6', '#d8e2ff', 'forked', 'bars', 36, false),
];

export const FIN_COUNT = FINS.length;

/**
 * 突变环：数组顺序决定「相邻」。稀有鳍基因（0-6）两两夹在常见鳍基因（7-13）旁边，
 * 所以每条魔法鱼需要的鳍基因都只需一次突变就能碰到。
 */
export const FIN_RING = [0, 7, 1, 8, 2, 9, 3, 10, 4, 11, 5, 12, 6, 13, 14, 15, 16, 17, 18, 19, 20];

export function finStep(idx: number, delta: number): number {
  const pos = FIN_RING.indexOf(idx);
  if (pos < 0) return idx;
  const next = (pos + delta + FIN_RING.length) % FIN_RING.length;
  return FIN_RING[next];
}

/** 可从商店鱼卵获得的鳍基因 */
export const COMMON_FINS = FINS.map((f, i) => (f.rare ? -1 : i)).filter((i) => i >= 0);

// ---- 魔法鱼 ----

export interface MagicFish {
  sp: number;
  fin: number;
  name: string;
  effect: string;
  riddle: string;
  value: number;
}

export const MAGIC: MagicFish[] = [
  {
    sp: 0,
    fin: 0,
    name: 'Greenfin Spotanus',
    effect: '同缸怀孕的鱼每窝多产 1 条',
    riddle: '第一位守护者戴着翠绿的鳍，落在最平凡的那尾斑点鱼身上。',
    value: 320,
  },
  {
    sp: 3,
    fin: 1,
    name: 'Spekled Leaffish',
    effect: '同缸鱼饥饿速度 −30%',
    riddle: '斑点会说话，可只有叶形的鱼听得见。',
    value: 340,
  },
  {
    sp: 9,
    fin: 2,
    name: 'Crimson Comet',
    effect: '同缸病鱼有概率自愈',
    riddle: '要让病鱼好起来，得先追上那条拖着绯红长尾的彗星。',
    value: 360,
  },
  {
    sp: 2,
    fin: 3,
    name: 'Canary Fire-Arrow',
    effect: '售价极高（最高约 $475）',
    riddle: '最贵的那支箭，尾巴是金丝雀的颜色。',
    value: 475,
  },
  {
    sp: 1,
    fin: 4,
    name: 'Oriental Goldbulb',
    effect: '同缸鱼成长速度 +25%',
    riddle: '东方的圆肚里装着一盏金灯，能让时间走得快些。',
    value: 380,
  },
  {
    sp: 4,
    fin: 5,
    name: 'Orange Snooper',
    effect: '同缸鱼持续恢复健康',
    riddle: '橘色的长嘴家伙，会替你舔好每一道伤口。',
    value: 350,
  },
  {
    sp: 5,
    fin: 6,
    name: 'Wasp Grouper',
    effect: '同缸繁殖的子代基因更容易突变',
    riddle: '黄黑相间的胡蜂，藏在石斑的身体里。',
    value: 400,
  },
];

export function magicIndexOf(sp: number, fin: number): number {
  return MAGIC.findIndex((m) => m.sp === sp && m.fin === fin);
}

export function breedKey(sp: number, fin: number): string {
  return `${sp}-${fin}`;
}

export function fullName(sp: number, fin: number): string {
  return `${FINS[fin].name} ${SPECIES[sp].name}`;
}

/** 鱼的基础售价（顾客心理价的基准） */
export function fishValue(sp: number, fin: number): number {
  const m = magicIndexOf(sp, fin);
  if (m >= 0) return MAGIC[m].value;
  return Math.round(SPECIES[sp].value + FINS[fin].value);
}

/** 该品种是否属于魔法鱼 */
export function isMagic(sp: number, fin: number): boolean {
  return magicIndexOf(sp, fin) >= 0;
}

// ---- 配种 ----

export interface ChildGenome {
  sp: number;
  fin: number;
  fragile: boolean;
  mutated: boolean;
  magic: number;
}

/**
 * 计算子代基因。
 * @param mutBoost 额外突变概率（魔法鱼 Wasp Grouper 在场时提升）
 */
export function breedGenome(
  aSp: number,
  aFin: number,
  bSp: number,
  bFin: number,
  rnd: () => number,
  mutBoost = 0,
): ChildGenome {
  const sp = unite(aSp, bSp);
  const span = crossSpan(aSp, bSp);
  let fin = rnd() < 0.5 ? aFin : bFin;
  let mutated = false;

  const mutChance = 0.12 + mutBoost;
  if (rnd() < mutChance) {
    const dir = rnd() < 0.5 ? -1 : 1;
    fin = finStep(fin, dir);
    mutated = true;
  }

  const fragile = sp !== aSp && sp !== bSp && span >= 3;
  return { sp, fin, fragile, mutated, magic: magicIndexOf(sp, fin) };
}

export function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}
