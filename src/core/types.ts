/** 共享类型定义 */

export type ScreenId = 'tank' | 'store' | 'supplies' | 'species' | 'trophy';

export type TankId = 'tank1' | 'tank2' | 'sale';

export type Disease = 0 | 1 | 2; // 0 健康, 1 真菌病, 2 白点病

/** 商店里的人物类型（对应 src/assets/npc/ 下的立绘） */
export type NpcKind =
  | 'shopkeeper'
  | 'student'
  | 'office'
  | 'kid'
  | 'elder-man'
  | 'business'
  | 'woman'
  | 'elder-woman'
  | 'worker';

export interface Fish {
  id: string;
  /** 鱼种索引 0..20 */
  sp: number;
  /** 鳍基因索引 0..20 */
  fin: number;
  sex: 'm' | 'f';
  /** 年龄（鱼年，含小数） */
  age: number;
  /** 0 = 卵 */
  egg: boolean;
  health: number;
  fed: number;
  disease: Disease;
  /** 怀孕进度（鱼年），0 表示未怀孕 */
  pregnancy: number;
  /** 孩子父亲的鳍基因 / 鱼种 */
  sireSp: number;
  sireFin: number;
  /** 杂交弱质 */
  fragile: boolean;
  dead: boolean;
  tank: TankId;
  /** 归一化位置 0..1 */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 渲染随机种子 */
  seed: number;
  /** 售价（销售缸） */
  price: number;
  /** 已被买家预订（视觉用） */
  soldFlash: number;
}

export interface Tank {
  id: TankId;
  owned: boolean;
  /** 0..100 污染 */
  pollution: number;
  /** 0..100 水中食物量 */
  food: number;
  /** 已安装装备/陈设 item id */
  installed: string[];
}

export interface Customer {
  id: string;
  kind: number;
  /** 立绘类型 */
  npc: NpcKind;
  x: number;
  y: number;
  tx: number;
  ty: number;
  state: 'enter' | 'browse' | 'pay' | 'leave';
  timer: number;
  bubble: string;
  /** 行走速度（归一化坐标/秒） */
  speed: number;
  /** 停留时长 */
  stay: number;
  hair: string;
  shirt: string;
  pants: string;
  /** 目标鱼 */
  target: string | null;
  /** 绕开销售缸的路径点 */
  path?: { x: number; y: number }[];
  /** 最终目的地（用于卡死重规划） */
  goal?: { x: number; y: number };
  /** 最近一次检查周期内实际走过的距离 */
  moved?: number;
  /** 卡死检测计时 */
  checkTimer?: number;
  /** 当前朝向（1 右 / -1 左），避免频繁翻转 */
  facing?: number;
  /** 连续卡住时长（秒），超过阈值强制离店 */
  waitTime?: number;
  stuck?: number;
  /** 已经换过几次位置，到达上限必定离店，保证店内人数有出有进 */
  visits?: number;
  /** 已经走到门口、正在跨出门槛 */
  exiting?: boolean;
}

export interface ResearchJob {
  line: 'env' | 'nutrition' | 'ads';
  /** 剩余鱼年 */
  remaining: number;
  total: number;
}

export interface GameState {
  version: number;
  /** 游戏内时间（鱼年） */
  time: number;
  cash: number;
  speedIdx: number;
  tanks: Record<TankId, Tank>;
  fish: Fish[];
  /** 消耗品库存 */
  stock: Record<string, number>;
  research: Record<'env' | 'nutrition' | 'ads', number>;
  researchJob: ResearchJob | null;
  /** 已发现的品种 key（`sp-fin`） */
  discovered: string[];
  /** 已发现的魔法鱼（7） */
  magicFound: boolean[];
  /** 当前屏幕 */
  screen: ScreenId;
  activeTank: TankId;
  selected: string | null;
  /** 商店顾客（运行时） */
  customers: Customer[];
  /** 统计 */
  stats: {
    sold: number;
    earned: number;
    bred: number;
    died: number;
    eggsBought: number;
    peak: number;
    magicBorn: number;
  };
  /** 玩家自定售价（销售缸新鱼默认价） */
  askingPrice: number;
  /** 兜售冷却（秒） */
  hawkCd: number;
  /** 顾客计时器 */
  saleTimer: number;
  /** 种子 */
  seed: number;
  /** 通知流 */
  messages: { text: string; kind: 'info' | 'good' | 'bad'; id: number }[];
  nextId: number;
  /** 已看过引导 */
  onboarding: boolean;
  lastSavedWall: number;
  /** 本次进店是否已经生成过初始顾客（挂在存档上，避免旧实例干扰） */
  storeSeeded?: boolean;
}
