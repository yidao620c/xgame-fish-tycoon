// 《养鱼大亨》核心模拟：实时成长（10 分钟=1 岁）、饱食/健康/疾病、怀孕产仔、
// 研究、商店、销售缸顾客、污染、离线进度追赶、存档
// 与 fish-tycoon-3d 版同源；新增：开局自选 2 条创始鱼；存档键独立
import { breed, isHybridChild, isMagic, suggestedPrice, type Genes, type MagicDef } from './genetics';

export const YEAR_SECONDS = 600; // 10 分钟 = 1 岁（忠实原版）
export const ADULT_AGE = 20;
export const EGG_YEARS = 0.12; // v6.8：孵化期约 72 秒（原来 0.35 年≈3.5 分钟，新手等太久以为缸里没鱼） // 鱼卵孵化期（手册：drop the starter eggs → wait for them to hatch）
export const SAVE_KEY = 'fishTycoon2D_v1';

export type SickType = null | 'fungus' | 'ick';
export type TankId = 0 | 1 | 2; // 0=一号缸 1=二号缸 2=销售缸

export type FishState = {
  id: number;
  sp: number;
  fin: number;
  age: number;
  fullness: number; // 0..100
  health: number; // 0..100
  sick: SickType;
  tank: TankId;
  female: boolean;
  pregnant: number; // 剩余怀孕年数，0=未孕
  pendingGenes: Genes | null;
  pendingFragile: boolean;
  fragile: boolean;
  dead: boolean;
};

export type TankState = {
  food: number;
  fouling: number;
};

export type ResearchId = 'env' | 'food' | 'ad';
export type ItemId =
  | 'tank2' | 'thermostat' | 'aeration' | 'snail' | 'plant'
  | 'coral' | 'pagoda' | 'ship' | 'egg_common' | 'egg_rare' | 'egg_exotic'
  | 'food_bag' | 'med_fungus' | 'med_ick' | 'vitamin'
  // v6.7 新增 9 件（补齐 24 格商品位）
  | 'heater' | 'filter' | 'water_test' | 'light' | 'auto_feeder'
  | 'basket' | 'premium_food' | 'algae_cleaner' | 'sign';

export type SimEvents = {
  toast: (text: string, kind: 'good' | 'bad' | 'info' | 'gold') => void;
  magicFound: (m: MagicDef) => void;
  win: () => void;
};

export const RESEARCH_DEF: Record<ResearchId, { cn: string; desc: string; costs: number[]; years: number[] }> = {
  env: { cn: '鱼缸环境', desc: '每级 +3 容量；2 级起杂交弱质鱼不再慢性死亡', costs: [500, 1000, 2000], years: [0.6, 1.2, 2.0] },
  food: { cn: '营养学', desc: '鱼粮更耐饿、抗病力提升（每级）', costs: [200, 450, 900], years: [0.4, 0.8, 1.5] },
  ad: { cn: '广告营销', desc: '吸引更多顾客光顾鱼店', costs: [350, 700, 1400], years: [0.5, 1.0, 1.8] },
};

export const ITEM_DEF: Record<ItemId, { cn: string; price: number; desc: string; once?: boolean; icon: string }> = {
  egg_common: { cn: '普通鱼卵', price: 35, desc: '孵化出低阶基因的鱼（1-7 号基因）', icon: '🥚' },
  egg_rare: { cn: '稀有鱼卵', price: 120, desc: '中阶基因（8-14 号）', icon: '🥚' },
  egg_exotic: { cn: '奇异鱼卵', price: 400, desc: '高阶基因（15-21 号），直接跳代', icon: '🐣' },
  food_bag: { cn: '袋装鱼粮', price: 10, desc: '补充饲料库存 ×10 份', icon: '🥫' },
  med_fungus: { cn: '真菌药', price: 40, desc: '治疗真菌病（绿褐色絮状物）', icon: '💊' },
  med_ick: { cn: '白点药', price: 40, desc: '治疗白点病（白色斑点）', icon: '🧪' },
  vitamin: { cn: '维生素', price: 25, desc: '为一条鱼恢复 30 健康', icon: '🍶' },
  tank2: { cn: '二号缸', price: 450, desc: '增加一个养殖缸，便于分缸规划', once: true, icon: '🛁' },
  thermostat: { cn: '恒温器', price: 170, desc: '全店生病几率 -30%', once: true, icon: '🌡️' },
  aeration: { cn: '增氧泵', price: 70, desc: '全店生病几率 -20%', once: true, icon: '🫧' },
  snail: { cn: '清洁蜗牛', price: 60, desc: '持续清理各缸污染，从不疲倦', once: true, icon: '🐌' },
  plant: { cn: '特殊水草', price: 90, desc: '各缸鱼健康恢复加快', once: true, icon: '🌿' },
  coral: { cn: '珊瑚装饰', price: 80, desc: '顾客购买意愿 +6%', once: true, icon: '🪸' },
  pagoda: { cn: '宝塔装饰', price: 120, desc: '顾客购买意愿 +6%', once: true, icon: '🏯' },
  ship: { cn: '沉船装饰', price: 250, desc: '顾客购买意愿 +8%', once: true, icon: '⛵' },
  // ---- v6.7 新增 ----
  heater: { cn: '加热棒', price: 150, desc: '全店生病几率 -10%', once: true, icon: '🌡️' },
  filter: { cn: '过滤器', price: 220, desc: '各缸污染清理速度 +80%', once: true, icon: '🌀' },
  water_test: { cn: '水质测试剂', price: 30, desc: '立即降低各缸 50% 污染', icon: '🧪' },
  light: { cn: '鱼缸灯', price: 130, desc: '顾客购买意愿 +3%', once: true, icon: '💡' },
  auto_feeder: { cn: '自动投食器', price: 160, desc: '每 0.15 年自动投喂 1 份', once: true, icon: '⏲️' },
  basket: { cn: '繁殖篮', price: 180, desc: '每次产仔数量 +1', once: true, icon: '🧺' },
  premium_food: { cn: '优质鱼粮', price: 45, desc: '补充饲料库存 ×20 份', icon: '🥫' },
  algae_cleaner: { cn: '除藻剂', price: 35, desc: '立即清除各缸全部污染', icon: '🧴' },
  sign: { cn: '店招招牌', price: 200, desc: '顾客购买意愿 +4%', once: true, icon: '🪧' },
};

/** 4 条创始纯种鱼（开局任选 2 条） */
export const FOUNDERS: Array<{ sp: number; fin: number; cn: string; en: string }> = [
  { sp: 21, fin: 21, cn: '双鳍星点鱼', en: 'Twin-fin Spotanus' },
  { sp: 21, fin: 1, cn: '丝鳍星点鱼', en: 'Silky Spotanus' },
  { sp: 1, fin: 21, cn: '双鳍鲨鱼', en: 'Twin-fin Shark' },
  { sp: 1, fin: 1, cn: '丝鳍鲨鱼', en: 'Silky Shark' },
];

export type SimSnapshot = ReturnType<Sim['snapshot']>;

export class Sim {
  years = 1;
  money = 150;
  autoFeedAcc = 0; // 自动投食器累计时间
  speed = 1; // 时间流速 1/4/20
  priceScale = 1; // 销售价倍率
  fish: FishState[] = [];
  tanks: TankState[] = [
    { food: 20, fouling: 0 },
    { food: 0, fouling: 0 },
    { food: 0, fouling: 0 },
  ];
  research: Record<ResearchId, number> = { env: 0, food: 0, ad: 0 };
  activeResearch: { id: ResearchId; level: number; remaining: number } | null = null;
  owned: Partial<Record<ItemId, number>> = {};
  discovered = new Set<number>(); // sp*100+fin
  magicFound: string[] = [];
  stats = { sold: 0, earned: 0, born: 0, died: 0, discovered: 0 };
  won = false;
  paused = false;

  private nextId = 1;
  private customerTimer = 20;
  private events: SimEvents;
  private rng: () => number;

  constructor(events: SimEvents, rng: () => number, picks?: [number, number]) {
    this.events = events;
    this.rng = rng;
    this.seedStarters(picks ?? [0, 1]);
  }

  private rand(): number {
    return this.rng();
  }

  /** 开局（手册流程）：玩家选 2 份创始鱼卵投入一号缸，等待孵化（age<0 = 卵期） */
  private seedStarters(picks: [number, number]): void {
    for (let i = 0; i < 2; i++) {
      const f = FOUNDERS[picks[i]];
      const fish = this.addFish(f.sp, f.fin, 0, -EGG_YEARS);
      fish.female = i === 0;
    }
    this.stats.discovered = this.discovered.size;
  }

  addFish(sp: number, fin: number, tank: TankId, age = 0, fragile?: boolean): FishState {
    const f: FishState = {
      id: this.nextId++,
      sp, fin, age,
      fullness: 80,
      health: fragile ? 45 : 100,
      sick: null,
      tank,
      female: this.rand() < 0.5,
      pregnant: 0,
      pendingGenes: null,
      pendingFragile: false,
      fragile: fragile ?? false,
      dead: false,
    };
    this.fish.push(f);
    this.markDiscovered(f);
    return f;
  }

  private markDiscovered(f: FishState): void {
    if (f.age < ADULT_AGE) return;
    const key = f.sp * 100 + f.fin;
    if (!this.discovered.has(key)) {
      this.discovered.add(key);
      this.stats.discovered = this.discovered.size;
      const magic = isMagic({ sp: f.sp, fin: f.fin });
      if (magic && !this.magicFound.includes(magic.id)) {
        this.magicFound.push(magic.id);
        this.events.magicFound(magic);
        if (this.magicFound.length >= 7 && !this.won) {
          this.won = true;
          this.events.win();
        }
      }
    }
  }

  // ---------- 查询辅助 ----------
  tankCapacity(t: TankId): number {
    if (t === 2) return 10;
    if (t === 1 && !this.owned.tank2) return 0;
    return 20 + this.research.env * 3;
  }

  tankFish(t: TankId): FishState[] {
    return this.fish.filter((f) => f.tank === t);
  }

  fishById(id: number): FishState | null {
    return this.fish.find((f) => f.id === id) ?? null;
  }

  magicInTank(t: TankId, id: string): boolean {
    return this.fish.some((f) => f.tank === t && !f.dead && isMagic({ sp: f.sp, fin: f.fin })?.id === id);
  }

  hasItem(id: ItemId): boolean {
    return (this.owned[id] ?? 0) > 0;
  }

  isDiscovered(sp: number, fin: number): boolean {
    return this.discovered.has(sp * 100 + fin);
  }

  // ---------- 玩家操作 ----------
  feedTank(t: TankId): string | null {
    if (!this.hasItem('food_bag') && this.money < 10) return '没有鱼粮且资金不足';
    if ((this.owned.food_bag ?? 0) <= 0) {
      this.money -= 10;
    } else {
      this.owned.food_bag = (this.owned.food_bag ?? 0) - 1;
    }
    this.tanks[t].food = Math.min(100, this.tanks[t].food + 35);
    if (this.tanks[t].food >= 100) return '鱼缸饲料已满——过度喂食有害！';
    return null;
  }

  moveFish(id: number, tank: TankId): string | null {
    const f = this.fishById(id);
    if (!f) return '找不到这条鱼';
    if (f.dead) return '请直接丢弃死鱼';
    if (this.tankFish(tank).length >= this.tankCapacity(tank)) return '目标缸已满';
    f.tank = tank;
    return null;
  }

  pairFish(aId: number, bId: number): string | null {
    const a = this.fishById(aId);
    const b = this.fishById(bId);
    if (!a || !b || a.dead || b.dead) return '所选的鱼不可用';
    if (a.age < ADULT_AGE || b.age < ADULT_AGE) return '两条鱼都必须成年（20 岁）';
    const female = a.female ? a : b.female ? b : null;
    if (!female) return '需要一雌一雄';
    if (female.pregnant > 0) return '母鱼已怀孕';
    if (a.health < 25 || b.health < 25) return '健康过低的鱼无法繁殖';
    if (a.tank !== b.tank) return '两条鱼必须在同一个缸里';
    const tank = a.tank;
    const mutate = this.magicInTank(tank, 'mutation') ? 0.3 : 0;
    female.pendingGenes = breed({ sp: a.sp, fin: a.fin }, { sp: b.sp, fin: b.fin }, mutate);
    female.pendingFragile = isHybridChild({ sp: a.sp, fin: a.fin }, { sp: b.sp, fin: b.fin });
    female.pregnant = 0.4;
    return `母鱼已怀孕！`;
  }

  useMedicine(id: number, kind: 'fungus' | 'ick'): string | null {
    const f = this.fishById(id);
    if (!f || f.dead) return '无效目标';
    if (f.sick !== kind) return '这条鱼没有患这种病';
    const item = kind === 'fungus' ? 'med_fungus' : 'med_ick';
    if (!this.hasItem(item)) return `没有${kind === 'fungus' ? '真菌药' : '白点药'}，请到商店购买`;
    this.owned[item] = (this.owned[item] ?? 0) - 1;
    f.sick = null;
    return null;
  }

  useVitamin(id: number): string | null {
    const f = this.fishById(id);
    if (!f || f.dead) return '无效目标';
    if (!this.hasItem('vitamin')) return '没有维生素，请到商店购买';
    this.owned.vitamin = (this.owned.vitamin ?? 0) - 1;
    f.health = Math.min(100, f.health + 30);
    return null;
  }

  disposeFish(id: number): string | null {
    const f = this.fishById(id);
    if (!f) return '找不到这条鱼';
    if (!f.dead) return '这条鱼还活着！';
    this.fish = this.fish.filter((x) => x.id !== id);
    return null;
  }

  /** 立即出售（销售缸直接卖——原版顾客自动购买，此为玩家手动兜售通道） */
  sellNow(id: number): string | null {
    const f = this.fishById(id);
    if (!f || f.dead) return '无效目标';
    if (f.tank !== 2) return '只有销售缸里的鱼才能出售';
    if (f.age < ADULT_AGE) return '太小的鱼没人买（需成年）';
    const price = this.sellPrice(f);
    const ornamentBonus = (this.hasItem('coral') ? 0.06 : 0) + (this.hasItem('pagoda') ? 0.06 : 0) + (this.hasItem('ship') ? 0.08 : 0)
      + (this.hasItem('light') ? 0.03 : 0) + (this.hasItem('sign') ? 0.04 : 0);
    const willingness = 0.78 + this.rand() * 0.55 + ornamentBonus;
    if (this.priceScale > willingness) {
      this.events.toast(`顾客嫌 $${price} 太贵，摇摇头走了`, 'bad');
      return null;
    }
    this.money += price;
    this.stats.earned += price;
    this.stats.sold += 1;
    this.fish = this.fish.filter((x) => x.id !== f.id);
    this.events.toast(`💵 鱼以 $${price} 售出！`, 'good');
    return null;
  }

  sellPrice(f: FishState): number {
    return Math.round(suggestedPrice({ sp: f.sp, fin: f.fin }) * this.priceScale);
  }

  buyItem(id: ItemId, tank: TankId = 0): string | null {
    const def = ITEM_DEF[id];
    if (def.once && this.hasItem(id)) return '已经拥有';
    if (this.money < def.price) return '资金不足';
    this.money -= def.price;
    if (id.startsWith('egg_')) {
      if (this.tankFish(tank).length >= this.tankCapacity(tank)) return '鱼缸已满';
      const [lo, hi] = id === 'egg_common' ? [1, 7] : id === 'egg_rare' ? [8, 14] : [15, 21];
      const sp = lo + Math.floor(this.rand() * (hi - lo + 1));
      const fin = lo + Math.floor(this.rand() * (hi - lo + 1));
      this.addFish(sp, fin, tank, -EGG_YEARS);
      return null;
    }
    // 消耗品即时效果
    if (id === 'premium_food') { this.owned.premium_food = (this.owned.premium_food ?? 0) + 1; this.owned.food_bag = (this.owned.food_bag ?? 0) + 20; return null; }
    if (id === 'water_test') { for (const t of this.tanks) t.fouling = Math.max(0, t.fouling * 0.5); return null; }
    if (id === 'algae_cleaner') { for (const t of this.tanks) t.fouling = 0; return null; }
    this.owned[id] = (this.owned[id] ?? 0) + 1;
    return null;
  }

  buyResearch(id: ResearchId): string | null {
    const def = RESEARCH_DEF[id];
    const level = this.research[id];
    if (level >= 3) return '该项研究已完成';
    if (this.activeResearch) return '已有研究正在进行';
    const cost = def.costs[level];
    if (this.money < cost) return `资金不足（需要 $${cost}）`;
    this.money -= cost;
    this.activeResearch = { id, level, remaining: def.years[level] };
    return null;
  }

  setPriceScale(v: number): void {
    this.priceScale = Math.min(2, Math.max(0.5, v));
  }

  // ---------- 每帧 / 离线推进 ----------
  update(dtReal: number, offline = false): void {
    if (this.paused) return;
    const mult = offline ? 1 : this.speed;
    const dtYears = (dtReal / YEAR_SECONDS) * mult;
    this.simulateYears(dtYears, offline);
  }

  /** 以「游戏年」为步长推进整个世界（含年份时钟——离线追赶也走这里） */
  private simulateYears(dtYears: number, offline: boolean): void {
    this.years += dtYears;
    if (this.activeResearch) {
      this.activeResearch.remaining -= dtYears;
      if (this.activeResearch.remaining <= 0) {
        const r = this.activeResearch;
        this.research[r.id] = r.level + 1;
        if (!offline) this.events.toast(`🔬 研究完成：${RESEARCH_DEF[r.id].cn} Lv.${r.level + 1}`, 'good');
        this.activeResearch = null;
      }
    }

    // 自动投食器：每 0.15 年自动投喂 1 份（消耗鱼粮库存，不花钱）
    if (this.hasItem('auto_feeder')) {
      this.autoFeedAcc = (this.autoFeedAcc ?? 0) + dtYears;
      while (this.autoFeedAcc >= 0.15) {
        this.autoFeedAcc -= 0.15;
        const idx = this.tanks.findIndex((t) => t.food < 70 && (this.owned.food_bag ?? 0) > 0);
        if (idx < 0) break;
        this.owned.food_bag = (this.owned.food_bag ?? 0) - 1;
        this.tanks[idx].food = Math.min(100, this.tanks[idx].food + 35);
      }
    }

    for (let ti = 0; ti < this.tanks.length; ti++) {
      const t = this.tanks[ti];
      t.fouling = Math.max(0, t.fouling - (3 * dtYears + (this.hasItem('snail') ? 12 * dtYears : 0)) * (this.hasItem('filter') ? 1.8 : 1));
      if (t.food >= 100) t.fouling = Math.min(100, t.fouling + 6 * dtYears);
    }

    const birthQueue: Array<{ tank: TankId; genes: Genes; fragile: boolean }> = [];
    const infectQueue: Array<FishState> = [];

    for (const f of this.fish) {
      if (f.dead) continue;
      const tank = this.tanks[f.tank];
      const growth = this.magicInTank(f.tank, 'growth') ? 1.25 : 1;
      const wasEgg = f.age < 0;
      f.age += dtYears * growth;
      if (wasEgg && f.age >= 0) {
        if (!offline) this.events.toast('🐟 一颗鱼卵孵化了！', 'good');
      }
      if (f.age < 0) continue; // 卵期：不吃食、不生病、不掉健康，只等待孵化

      const hungerMult =
        (this.magicInTank(f.tank, 'sustenance') ? 0.7 : 1) *
        [1, 0.85, 0.7, 0.55][this.research.food];
      if (tank.food > 0 && f.fullness < 100) {
        const eat = Math.min(tank.food, 130 * dtYears);
        tank.food -= eat;
        f.fullness = Math.min(100, f.fullness + eat);
      }
      f.fullness = Math.max(0, f.fullness - 2.2 * hungerMult * dtYears);

      const snooper = this.magicInTank(f.tank, 'health');
      if (f.fullness < 20) f.health -= 25 * dtYears;
      if (!offline) {
        if (f.sick === 'fungus') f.health -= 55 * dtYears;
        if (f.sick === 'ick') f.health -= 40 * dtYears;
      }
      if (f.fragile && this.research.env < 2) f.health -= 18 * dtYears;
      if (f.fullness > 50 && !f.sick) {
        const cap = f.fragile && this.research.env < 2 ? 70 : 100;
        f.health = Math.min(cap, f.health + (10 + (this.hasItem('plant') ? 8 : 0) + (snooper ? 18 : 0)) * dtYears);
      }
      if (snooper && f.sick) f.health += 6 * dtYears;

      if (!f.sick && !offline) {
        let p = 0.10;
        if (f.fullness < 35) p *= 2.2;
        if (tank.fouling > 50) p *= 2;
        if (f.fullness < 15) p *= 1.5;
        p *= [1, 0.8, 0.65, 0.5][this.research.food];
        if (this.hasItem('thermostat')) p *= 0.7;
        if (this.hasItem('aeration')) p *= 0.8;
        if (this.hasItem('heater')) p *= 0.9;
        if (snooper) p *= 0.6;
        if (this.rand() < p * dtYears) {
          f.sick = this.rand() < 0.55 ? 'fungus' : 'ick';
          if (!offline) this.events.toast(`🤒 一条鱼生病了（${f.sick === 'fungus' ? '真菌' : '白点'}），快用药！`, 'bad');
        }
      } else if (this.magicInTank(f.tank, 'curing') && this.rand() < 0.35 * dtYears) {
        f.sick = null;
        if (!offline) this.events.toast('✨ 治愈魔法鱼治好了一条病鱼', 'good');
      }

      if (f.sick && this.rand() < 0.9 * dtYears) infectQueue.push(f);

      if (f.health <= 0) {
        f.dead = true;
        f.sick = null;
        this.stats.died += 1;
        if (!offline) this.events.toast('💀 一条鱼死亡了——死尸会污染水体，请尽快丢弃', 'bad');
      }

      if (f.pregnant > 0) {
        f.pregnant -= dtYears;
        if (f.pregnant <= 0 && f.pendingGenes) {
          birthQueue.push({ tank: f.tank, genes: f.pendingGenes, fragile: f.pendingFragile });
          f.pendingGenes = null;
          f.pregnant = 0;
        }
      }

      if (f.age >= ADULT_AGE) this.markDiscovered(f);
    }

    for (const source of infectQueue) {
      if (source.sick === null || source.dead) continue;
      const mates = this.fish.filter((x) => !x.dead && x.tank === source.tank && x.id !== source.id && x.sick === null);
      if (mates.length > 0) {
        const victim = mates[Math.floor(this.rand() * mates.length)];
        victim.sick = source.sick;
        if (!offline) this.events.toast('🦠 疾病在缸内传染了！', 'bad');
      }
    }

    for (const b of birthQueue) {
      if (this.tankFish(b.tank).length >= this.tankCapacity(b.tank)) continue;
      const bonus = (this.magicInTank(b.tank, 'fertility') ? 1 : 0) + (this.hasItem('basket') ? 1 : 0);
      const n = 3 + Math.floor(this.rand() * 3) + bonus;
      for (let i = 0; i < n; i++) {
        if (this.tankFish(b.tank).length >= this.tankCapacity(b.tank)) break;
        this.addFish(b.genes.sp, b.genes.fin, b.tank, 0, b.fragile);
        this.stats.born += 1;
      }
    }

    for (let ti = 0; ti < this.tanks.length; ti++) {
      const corpses = this.fish.filter((f) => f.dead && f.tank === ti).length;
      if (corpses > 0) this.tanks[ti].fouling = Math.min(100, this.tanks[ti].fouling + corpses * 10 * dtYears);
    }

    if (!offline) this.customerTick(dtYears);
  }

  private customerTick(dtYears: number): void {
    this.customerTimer -= dtYears * YEAR_SECONDS;
    if (this.customerTimer > 0) return;
    const adLv = this.research.ad;
    const interval = [40, 30, 22, 14][adLv];
    this.customerTimer = interval * (0.7 + this.rand() * 0.6);
    const sale = this.tankFish(2).filter((f) => !f.dead && f.age >= ADULT_AGE);
    if (sale.length === 0) return;
    const f = sale[Math.floor(this.rand() * sale.length)];
    const ornamentBonus = (this.hasItem('coral') ? 0.06 : 0) + (this.hasItem('pagoda') ? 0.06 : 0) + (this.hasItem('ship') ? 0.08 : 0)
      + (this.hasItem('light') ? 0.03 : 0) + (this.hasItem('sign') ? 0.04 : 0);
    const willingness = 0.78 + this.rand() * 0.55 + ornamentBonus;
    const price = this.sellPrice(f);
    if (this.priceScale <= willingness) {
      this.money += price;
      this.stats.earned += price;
      this.stats.sold += 1;
      this.fish = this.fish.filter((x) => x.id !== f.id);
      this.events.toast(`💵 顾客以 $${price} 买走了一条鱼`, 'good');
    }
  }

  // ---------- 存档 / 离线 ----------
  save(): void {
    const data = {
      v: 1,
      realTime: Date.now(),
      years: this.years,
      money: this.money,
      priceScale: this.priceScale,
      fish: this.fish,
      tanks: this.tanks,
      research: this.research,
      activeResearch: this.activeResearch,
      owned: this.owned,
      discovered: [...this.discovered],
      magicFound: this.magicFound,
      stats: this.stats,
      won: this.won,
      nextId: this.nextId,
      paused: this.paused,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* 存储不可用则跳过 */ }
  }

  static load(events: SimEvents, rng: () => number): Sim | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1) return null;
      const sim = new Sim(events, rng);
      sim.fish = [];
      sim.nextId = d.nextId ?? 1;
      sim.years = d.years;
      sim.money = d.money;
      sim.priceScale = d.priceScale ?? 1;
      sim.tanks = d.tanks;
      sim.research = d.research;
      sim.activeResearch = d.activeResearch;
      sim.owned = d.owned ?? {};
      sim.discovered = new Set(d.discovered ?? []);
      sim.magicFound = d.magicFound ?? [];
      sim.stats = d.stats ?? sim.stats;
      sim.won = d.won ?? false;
      sim.paused = d.paused ?? false;
      sim.fish = d.fish;
      const elapsed = Math.min(8 * 3600, Math.max(0, (Date.now() - d.realTime) / 1000));
      if (elapsed > 5) {
        const step = 30;
        let remaining = elapsed;
        while (remaining > 0) {
          sim.simulateYears(Math.min(step, remaining) / YEAR_SECONDS, true);
          remaining -= step;
        }
      }
      return sim;
    } catch {
      return null;
    }
  }

  static clearSave(): void {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }

  snapshot() {
    return {
      years: this.years,
      money: this.money,
      speed: this.speed,
      priceScale: this.priceScale,
      fish: this.fish.map((f) => ({
        id: f.id, sp: f.sp, fin: f.fin, age: f.age, fullness: f.fullness,
        health: f.health, sick: f.sick, tank: f.tank, female: f.female,
        pregnant: f.pregnant, fragile: f.fragile, dead: f.dead,
      })),
      tanks: this.tanks,
      research: this.research,
      activeResearch: this.activeResearch,
      owned: { ...this.owned },
      discoveredCount: this.discovered.size,
      magicFound: [...this.magicFound],
      stats: { ...this.stats },
      won: this.won,
      paused: this.paused,
    };
  }
}
