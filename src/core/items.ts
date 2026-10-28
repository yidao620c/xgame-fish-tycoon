/** 补给商店 24 件商品 + 研究线 */

export type ItemKind = 'equipment' | 'consumable' | 'decor';
export type IconKey =
  | 'bottle'
  | 'jar'
  | 'jug'
  | 'can'
  | 'pump'
  | 'filter'
  | 'snail'
  | 'seahorse'
  | 'plant'
  | 'coral'
  | 'pagoda'
  | 'ship'
  | 'basket'
  | 'feeder'
  | 'lamp'
  | 'sign'
  | 'food'
  | 'egg'
  | 'pill'
  | 'flask';

export interface Item {
  id: string;
  name: string;
  desc: string;
  price: number;
  kind: ItemKind;
  icon: IconKey;
  tint: string;
  /** 消耗品一次购买数量 */
  pack?: number;
  /** 单缸装备上限 1 */
  diseaseReduce?: number;
  pollutionClean?: number;
  capacity?: number;
  offspring?: number;
  autoFeed?: boolean;
  willing?: number;
  customerRate?: number;
  cure?: 1 | 2;
  heal?: number;
  feed?: number;
  pollutionCut?: number;
  egg?: 'common' | 'rare' | 'mystery';
  growth?: number;
}

export const ITEMS: Item[] = [
  {
    id: 'thermo',
    name: '恒温器',
    desc: '恒定的水温让鱼儿少生病。缸内患病率 −30%。',
    price: 150,
    kind: 'equipment',
    icon: 'bottle',
    tint: '#e8d24a',
    diseaseReduce: 0.3,
  },
  {
    id: 'airpump',
    name: '增氧泵',
    desc: '细密气泡让水一直在流动。缸内患病率 −20%。',
    price: 120,
    kind: 'equipment',
    icon: 'pump',
    tint: '#8fa4b8',
    diseaseReduce: 0.2,
  },
  {
    id: 'heater',
    name: '加热棒',
    desc: '老式玻璃加热棒，勉强管用。缸内患病率 −10%。',
    price: 90,
    kind: 'equipment',
    icon: 'flask',
    tint: '#c4574a',
    diseaseReduce: 0.1,
  },
  {
    id: 'filter',
    name: '过滤器',
    desc: '强力过滤，水质净化速度 ×1.8，是烂水缸的救命稻草。',
    price: 220,
    kind: 'equipment',
    icon: 'filter',
    tint: '#5d7f9c',
    pollutionClean: 0.9,
  },
  {
    id: 'basket',
    name: '繁殖篮',
    desc: '给新生儿一个安全角落，每窝多产 1 条。',
    price: 260,
    kind: 'equipment',
    icon: 'basket',
    tint: '#a9803f',
    offspring: 1,
  },
  {
    id: 'feeder',
    name: '自动投食器',
    desc: '食物低于 12% 时自动投喂普通鱼粮（消耗库存）。',
    price: 300,
    kind: 'equipment',
    icon: 'feeder',
    tint: '#7fa3b5',
    autoFeed: true,
  },
  {
    id: 'lamp',
    name: '鱼缸灯',
    desc: '灯光一打，鱼的颜色都亮一档。购买意愿 +8%。',
    price: 180,
    kind: 'equipment',
    icon: 'lamp',
    tint: '#f0d070',
    willing: 0.08,
  },
  {
    id: 'storesign',
    name: '店招招牌',
    desc: '门口那块闪亮的牌子。到店顾客 +20%。',
    price: 340,
    kind: 'equipment',
    icon: 'sign',
    tint: '#d8763f',
    customerRate: 0.2,
  },
  {
    id: 'snail',
    name: '清洁蜗牛',
    desc: '这只小蜗牛从不知疲倦地擦拭玻璃。污染净化 +0.5/年。',
    price: 80,
    kind: 'equipment',
    icon: 'snail',
    tint: '#c9b79a',
    pollutionClean: 0.5,
  },
  {
    id: 'plant',
    name: '特殊水草',
    desc: '一丛能吃掉硝酸盐的水草。污染净化 +0.3/年，鱼更放松。',
    price: 140,
    kind: 'equipment',
    icon: 'plant',
    tint: '#46a05a',
    pollutionClean: 0.3,
    heal: 0.4,
  },
  {
    id: 'coral',
    name: '珊瑚摆件',
    desc: '粉红珊瑚，客人一眼就看见。购买意愿 +10%。',
    price: 200,
    kind: 'decor',
    icon: 'coral',
    tint: '#d8627d',
    willing: 0.1,
  },
  {
    id: 'pagoda',
    name: '宝塔摆件',
    desc: '蓝瓷小塔，店里的镇店之宝。购买意愿 +12%。',
    price: 240,
    kind: 'decor',
    icon: 'pagoda',
    tint: '#5a8fc0',
    willing: 0.12,
  },
  {
    id: 'shipwreck',
    name: '沉船摆件',
    desc: '半截沉船，孩子们最爱。购买意愿 +14%。',
    price: 260,
    kind: 'decor',
    icon: 'ship',
    tint: '#8a6b3f',
    willing: 0.14,
  },
  {
    id: 'food1',
    name: '普通鱼粮',
    desc: '一罐基础薄片鱼粮，够投喂 5 次。',
    price: 20,
    kind: 'consumable',
    icon: 'food',
    tint: '#d8a13c',
    pack: 5,
    feed: 130,
  },
  {
    id: 'food2',
    name: '浓缩鱼粮',
    desc: '高密度颗粒，一份顶两份，不容易剩。5 次装。',
    price: 45,
    kind: 'consumable',
    icon: 'food',
    tint: '#b0642a',
    pack: 5,
    feed: 200,
  },
  {
    id: 'food3',
    name: '优质鱼粮',
    desc: '营养全餐，投喂同时让全缸鱼恢复少量健康。4 次装。',
    price: 60,
    kind: 'consumable',
    icon: 'food',
    tint: '#e0c040',
    pack: 4,
    feed: 175,
    heal: 8,
  },
  {
    id: 'med1',
    name: '真菌药',
    desc: '专治绿褐色絮状真菌病。一次一瓶，滴入缸中。',
    price: 70,
    kind: 'consumable',
    icon: 'pill',
    tint: '#5aa05a',
    cure: 1,
  },
  {
    id: 'med2',
    name: '白点药',
    desc: '专治白点病。水温同时略微升高。',
    price: 70,
    kind: 'consumable',
    icon: 'pill',
    tint: '#5aa0c0',
    cure: 2,
  },
  {
    id: 'vitamin',
    name: '维生素',
    desc: '一滴就精神。选中鱼恢复 15 点健康。',
    price: 50,
    kind: 'consumable',
    icon: 'bottle',
    tint: '#e07070',
    heal: 15,
  },
  {
    id: 'testkit',
    name: '水质测试剂',
    desc: '测出精确水质，顺手稀释一部分脏东西。污染 −10。',
    price: 30,
    kind: 'consumable',
    icon: 'flask',
    tint: '#8fc0d8',
    pollutionCut: 10,
  },
  {
    id: 'algae',
    name: '除藻剂',
    desc: '一瓶下去，缸壁和角落都清爽了。污染 −25。',
    price: 60,
    kind: 'consumable',
    icon: 'can',
    tint: '#4a8a6a',
    pollutionCut: 25,
  },
  {
    id: 'egg1',
    name: '普通鱼卵',
    desc: '商店最常见的鱼卵，随机一条基础鱼种。',
    price: 160,
    kind: 'consumable',
    icon: 'egg',
    tint: '#d8c4a0',
    egg: 'common',
  },
  {
    id: 'egg2',
    name: '稀有鱼卵',
    desc: '来自更深处海域的卵，鱼种更高级。',
    price: 420,
    kind: 'consumable',
    icon: 'egg',
    tint: '#b8a0d8',
    egg: 'rare',
  },
  {
    id: 'egg3',
    name: '神秘鱼卵',
    desc: '没人知道里面是什么——可能是拥有稀有鳍基因的个体。',
    price: 900,
    kind: 'consumable',
    icon: 'egg',
    tint: '#8fd8c8',
    egg: 'mystery',
  },
];

export const ITEM_MAP: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ---- 研究 ----

export type ResearchLine = 'env' | 'nutrition' | 'ads';

export interface ResearchDef {
  line: ResearchLine;
  name: string;
  desc: string;
  icon: string;
  costs: number[];
  years: number[];
  perLevel: string;
}

export const RESEARCH: ResearchDef[] = [
  {
    line: 'env',
    name: '鱼缸环境',
    desc: '更大的空间与更稳的水质。',
    icon: 'env',
    costs: [600, 1200, 2400],
    years: [1.5, 3, 5],
    perLevel: '每级鱼缸容量 +3；2 级起杂交弱质鱼不再慢性死亡',
  },
  {
    line: 'nutrition',
    name: '营养学',
    desc: '更耐饿的鱼粮与更强的抗病力。',
    icon: 'nutrition',
    costs: [400, 900, 1800],
    years: [1, 2, 4],
    perLevel: '每级鱼粮更耐饿、患病率 −8%',
  },
  {
    line: 'ads',
    name: '广告营销',
    desc: '门口排队的人会越来越多。',
    icon: 'ads',
    costs: [500, 1000, 2000],
    years: [1, 2, 3.5],
    perLevel: '每级到店顾客 +35%，购买意愿 +6%',
  },
];

export const RESEARCH_MAP = Object.fromEntries(RESEARCH.map((r) => [r.line, r])) as Record<
  ResearchLine,
  ResearchDef
>;

export const SPEEDS = [1, 4, 20];
export const YEAR_SECONDS = 600;
export const ADULT_AGE = 20;
export const EGG_YEARS = 0.12;
export const BASE_CAPACITY = 10;
export const START_CASH = 500;
export const TANK2_PRICE = 1200;
