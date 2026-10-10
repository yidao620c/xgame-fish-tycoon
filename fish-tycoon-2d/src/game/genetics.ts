// 基因系统：21 鱼身 × 21 鳍型 = 441 组合，繁殖公式 floor((a+b)/2)，7 魔法鱼
// 考证来源：Fish Tycoon 社区配对表（数值已交叉验证）

export type SpeciesDef = { num: number; en: string; cn: string };
export type FinDef = { num: number; en: string; cn: string; color: number; pattern: Pattern };

export type Pattern = 'plain' | 'tiger' | 'speckled' | 'swirl' | 'shine' | 'stripe' | 'flag' | 'sail' | 'razor' | 'twin';

/** 21 种鱼身（编号 1-21，数字越大越稀有；Shark=1 与 Spotanus=21 为纯种） */
export const SPECIES: SpeciesDef[] = [
  { num: 1, en: 'Shark', cn: '鲨鱼' },
  { num: 2, en: 'Catfish', cn: '鲶鱼' },
  { num: 3, en: 'Arrowfish', cn: '箭鱼' },
  { num: 4, en: 'Snout', cn: '长鼻鱼' },
  { num: 5, en: 'Fatfish', cn: '肥脂鱼' },
  { num: 6, en: 'Snooper', cn: '探测鱼' },
  { num: 7, en: 'Goldshark', cn: '金鲨' },
  { num: 8, en: 'Fire-Arrow', cn: '火箭鱼' },
  { num: 9, en: 'Fruitfish', cn: '果鱼' },
  { num: 10, en: 'Goldbulb', cn: '金球鱼' },
  { num: 11, en: 'Comet', cn: '彗星鱼' },
  { num: 12, en: 'Stickfish', cn: '棍鱼' },
  { num: 13, en: 'Grouper', cn: '石斑鱼' },
  { num: 14, en: 'Pigmy', cn: '侏儒鱼' },
  { num: 15, en: 'Carp', cn: '鲤鱼' },
  { num: 16, en: 'Beta', cn: '斗鱼' },
  { num: 17, en: 'Bananafish', cn: '香蕉鱼' },
  { num: 18, en: 'Quicksilver', cn: '水银鱼' },
  { num: 19, en: 'Flashfish', cn: '闪光鱼' },
  { num: 20, en: 'Leaffish', cn: '叶鱼' },
  { num: 21, en: 'Spotanus', cn: '星点鱼' },
];

/** 21 种鳍型（颜色/纹样；Silky=1 与 Twin-fin=21 为纯种鳍） */
export const FINS: FinDef[] = [
  { num: 1, en: 'Silky', cn: '丝质', color: 0xcfd8e3, pattern: 'plain' },
  { num: 2, en: 'Tiger', cn: '虎纹', color: 0xd98a2b, pattern: 'tiger' },
  { num: 3, en: 'Hornet', cn: '大黄蜂', color: 0xe8c53a, pattern: 'stripe' },
  { num: 4, en: 'Fanned', cn: '扇尾', color: 0x74b9e0, pattern: 'sail' },
  { num: 5, en: 'Pink', cn: '粉红', color: 0xf0a7c0, pattern: 'plain' },
  { num: 6, en: 'Snubbed', cn: '短鼻', color: 0x9aa5b8, pattern: 'plain' },
  { num: 7, en: 'Wasp', cn: '黄蜂', color: 0x3d3a26, pattern: 'stripe' },
  { num: 8, en: 'Canary', cn: '金丝雀', color: 0xf7e04a, pattern: 'plain' },
  { num: 9, en: 'Orange', cn: '橙色', color: 0xf08a3c, pattern: 'plain' },
  { num: 10, en: 'Oriental', cn: '东方', color: 0xe8748a, pattern: 'swirl' },
  { num: 11, en: 'Golden', cn: '黄金', color: 0xf2c14e, pattern: 'shine' },
  { num: 12, en: 'Crimson', cn: '绯红', color: 0xd64545, pattern: 'plain' },
  { num: 13, en: 'Spined', cn: '棘刺', color: 0x8a7f6a, pattern: 'razor' },
  { num: 14, en: 'Stubby', cn: '矮胖', color: 0xb8a98a, pattern: 'plain' },
  { num: 15, en: 'Speckled', cn: '斑点', color: 0x7fae8e, pattern: 'speckled' },
  { num: 16, en: 'Razorback', cn: '剃刀', color: 0x6a8a9a, pattern: 'razor' },
  { num: 17, en: 'Greenfin', cn: '绿鳍', color: 0x5fae6f, pattern: 'plain' },
  { num: 18, en: 'Great-sail', cn: '大帆', color: 0x5a7fd9, pattern: 'sail' },
  { num: 19, en: 'Flagged', cn: '旗帜', color: 0xc978b8, pattern: 'flag' },
  { num: 20, en: 'Finless', cn: '无鳍', color: 0x8a9a7a, pattern: 'plain' },
  { num: 21, en: 'Twin-fin', cn: '双鳍', color: 0x64d8cb, pattern: 'twin' },
];

export type MagicId = 'fertility' | 'sustenance' | 'curing' | 'fortune' | 'growth' | 'health' | 'mutation';

export type MagicDef = {
  id: MagicId;
  fin: number; // 鳍编号
  sp: number; // 身编号
  cn: string;
  en: string;
  title: string;
  power: string;
};

/** 7 条魔法鱼（Isola 之魂） */
export const MAGIC_FISH: MagicDef[] = [
  { id: 'fertility', fin: 17, sp: 21, cn: '绿鳍星点鱼', en: 'Greenfin Spotanus', title: '生育魔法鱼', power: '同缸怀孕的鱼每窝多产 1 条鱼苗' },
  { id: 'sustenance', fin: 15, sp: 20, cn: '斑点叶鱼', en: 'Speckled Leaffish', title: '果腹魔法鱼', power: '同缸鱼的饥饿速度降低 30%' },
  { id: 'curing', fin: 12, sp: 11, cn: '绯红彗星鱼', en: 'Crimson Comet', title: '治愈魔法鱼', power: '同缸生病的鱼有机会自愈' },
  { id: 'fortune', fin: 8, sp: 8, cn: '金丝雀火箭鱼', en: 'Canary Fire-Arrow', title: '黄金古比', power: '售价极高，建议价 $475' },
  { id: 'growth', fin: 10, sp: 10, cn: '东方金球鱼', en: 'Oriental Goldbulb', title: '成长魔法鱼', power: '同缸鱼的成长速度提高 25%' },
  { id: 'health', fin: 9, sp: 6, cn: '橙色探测鱼', en: 'Orange Snooper', title: '健康魔法鱼', power: '同缸鱼持续恢复健康' },
  { id: 'mutation', fin: 7, sp: 13, cn: '黄蜂石斑鱼', en: 'Wasp Grouper', title: '突变魔法鱼', power: '同缸繁殖的子代基因可能突变' },
];

export const MAGIC_INDEX: Record<string, MagicDef> = {};
for (const m of MAGIC_FISH) MAGIC_INDEX[`${m.fin}_${m.sp}`] = m;

export function speciesOf(num: number): SpeciesDef {
  return SPECIES[num - 1];
}
export function finOf(num: number): FinDef {
  return FINS[num - 1];
}

export type Genes = { sp: number; fin: number };

export function comboName(g: Genes): string {
  const magic = MAGIC_INDEX[`${g.fin}_${g.sp}`];
  if (magic) return `${magic.cn} ✦`;
  return `${finOf(g.fin).cn}${speciesOf(g.sp).cn}`;
}

export function comboNameEn(g: Genes): string {
  const magic = MAGIC_INDEX[`${g.fin}_${g.sp}`];
  if (magic) return magic.en;
  return `${finOf(g.fin).en} ${speciesOf(g.sp).en}`;
}

export function isMagic(g: Genes): MagicDef | null {
  return MAGIC_INDEX[`${g.fin}_${g.sp}`] ?? null;
}

/** 建议售价：魔法鱼 $475；普通组合按稀有度（两基因编号乘积）平滑定价 */
export function suggestedPrice(g: Genes): number {
  if (isMagic(g)) return 475;
  const rarity = Math.pow(g.sp * g.fin, 0.62);
  const v = 3 + rarity * 1.05;
  return Math.max(3, Math.round(v));
}

/**
 * 繁殖：子代两基因各取 floor((父+母)/2)。
 * 基因突变（黄蜂石斑鱼在场）：每条基因有几率 ±1（限制在 1..21）。
 */
export function breed(a: Genes, b: Genes, mutateChance = 0): Genes {
  const mutate = (v: number): number => {
    if (mutateChance > 0 && Math.random() < mutateChance) {
      v += Math.random() < 0.5 ? -1 : 1;
    }
    return Math.min(21, Math.max(1, v));
  };
  return {
    sp: mutate(Math.floor((a.sp + b.sp) / 2)),
    fin: mutate(Math.floor((a.fin + b.fin) / 2)),
  };
}

/** 是否杂交（父母不同身或不同鳍 → 子代为杂交弱质鱼） */
export function isHybridChild(a: Genes, b: Genes): boolean {
  return a.sp !== b.sp || a.fin !== b.fin;
}

export const TOTAL_COMBOS = 441;
