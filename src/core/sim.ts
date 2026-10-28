/** 模拟：时间推进、饲养、繁殖、销售、装备与研究的玩家操作 */

import {
  MAGIC,
  SPECIES,
  breedGenome,
  fishValue,
  fullName,
  isLeaf,
  magicIndexOf,
} from './genetics';
import {
  ADULT_AGE,
  EGG_YEARS,
  ITEM_MAP,
  RESEARCH_MAP,
  SPEEDS,
  TANK2_PRICE,
  YEAR_SECONDS,
  type ResearchLine,
} from './items';
import { clamp } from './rng';
import {
  addFish,
  capacityOf,
  createGame,
  isAdult,
  log,
  randomEggGenome,
  rand,
  tankEffects,
  tankFish,
} from './state';
import type { Customer, Fish, GameState, NpcKind, TankId } from './types';

export const MAX_OFFLINE_YEARS = 1.5;

/** 每帧调用：realSeconds 为真实经过秒数 */
export function tick(state: GameState, realSeconds: number): void {
  const speed = SPEEDS[state.speedIdx] ?? 1;
  advance(state, (realSeconds * speed) / YEAR_SECONDS);
  state.hawkCd = Math.max(0, state.hawkCd - realSeconds);
  saleTick(state, realSeconds);
  storeVisualTick(state, realSeconds);
}

/** 推进游戏内年数（分块，保证稳定） */
export function advance(state: GameState, years: number): void {
  let left = Math.min(years, 4);
  while (left > 0) {
    const dt = Math.min(0.02, left);
    stepYears(state, dt);
    left -= dt;
  }
}

function stepYears(state: GameState, dt: number): void {
  state.time += dt;

  if (state.researchJob) {
    const job = state.researchJob;
    job.remaining -= dt;
    if (job.remaining <= 0) {
      state.research[job.line] += 1;
      log(state, `研究完成：${RESEARCH_MAP[job.line].name} ${state.research[job.line]} 级`, 'good');
      state.researchJob = null;
    }
  }

  const effectCache: Record<string, ReturnType<typeof tankEffects>> = {};
  for (const tankId of ['tank1', 'tank2', 'sale'] as TankId[]) {
    const tank = state.tanks[tankId];
    if (!tank.owned) continue;
    effectCache[tankId] = tankEffects(state, tankId);

    // 自动投食
    if (effectCache[tankId].autoFeed && tank.food < 18 && (state.stock.food1 ?? 0) > 0) {
      state.stock.food1 -= 1;
      tank.food = Math.min(200, tank.food + (ITEM_MAP.food1.feed ?? 130));
    }
    // 销售缸由店员照顾：自动从库存投喂，避免玩家盯着别的缸时店里的鱼悄悄饿死
    if (tankId === 'sale' && tank.food < 20 && (state.stock.food1 ?? 0) > 0) {
      state.stock.food1 -= 1;
      tank.food = Math.min(200, tank.food + (ITEM_MAP.food1.feed ?? 130));
    }

    // 污染
    let pollution = tank.pollution;
    if (tank.food > 90) pollution += dt * ((tank.food - 90) / 30) * 2.2;
    pollution -= dt * (0.7 + effectCache[tankId].pollutionClean);
    tank.pollution = clamp(pollution, 0, 100);
    if (tank.pollution > 0) tank.food = Math.max(0, tank.food - dt * 1.5);
  }

  // 鱼
  for (const f of state.fish) {
    if (f.dead) continue;
    const tank = state.tanks[f.tank];
    if (!tank.owned) continue;
    const fx = effectCache[f.tank] ?? tankEffects(state, f.tank);

    if (f.egg) {
      f.age += dt;
      if (f.age >= EGG_YEARS) {
        f.egg = false;
        f.age = 0;
        f.health = 92;
        const m = magicIndexOf(f.sp, f.fin);
        if (m >= 0) log(state, `✨ ${MAGIC[m].name} 破卵而出！`, 'good');
      }
      continue;
    }

    f.age += dt * fx.growth;
    f.fed = clamp(f.fed - dt * 9 * fx.hungerScale, 0, 100);

    // 进食
    if (f.fed < 92 && tank.food > 0) {
      const take = Math.min(tank.food, dt * 40);
      tank.food -= take;
      f.fed = clamp(f.fed + take * 1.5, 0, 100);
    }

    // 健康
    let dh = 0;
    if (f.fed < 18) dh -= 10 * (1 - (f.fed / 18) * 0.55);
    if (tank.pollution > 55) dh -= ((tank.pollution - 55) / 30) * 3.6;
    if (f.disease) dh -= 5;
    if (f.fragile && state.research.env < 2) dh -= 1.7;
    if (fx.heal) dh += fx.heal;
    if (!f.disease && f.fed > 30 && tank.pollution < 50) dh += 2;
    f.health = clamp(f.health + dh * dt, 0, 100);

    // 患病
    if (!f.disease) {
      const rate =
        0.06 *
        (1 - fx.diseaseReduce) *
        (1 + tank.pollution / 45) *
        (f.fed < 20 ? 1.8 : 1) *
        (f.health < 50 ? 1.4 : 1);
      if (rand(state) < rate * dt) {
        f.disease = rand(state) < 0.5 ? 1 : 2;
        log(
          state,
          `${fullName(f.sp, f.fin)} 患上了${f.disease === 1 ? '真菌病' : '白点病'}`,
          'bad',
        );
      }
    } else if (fx.selfHeal && rand(state) < dt * 0.8) {
      f.disease = 0;
      log(state, `${fullName(f.sp, f.fin)} 在 Crimson Comet 的守护下自愈了`, 'good');
    }

    if (f.health <= 0) {
      f.dead = true;
      f.health = 0;
      state.stats.died += 1;
      tank.pollution = clamp(tank.pollution + 4, 0, 100);
      log(state, `${fullName(f.sp, f.fin)} 死了…记得用 🗑 清理`, 'bad');
      continue;
    }

    // 怀孕
    if (f.pregnancy > 0) {
      f.pregnancy -= dt * fx.growth;
      if (f.pregnancy <= 0) {
        f.pregnancy = 0;
        layEggs(state, f, fx.offspring, fx.mutation);
      }
    }
  }

  // 死亡尸体持续污染
  const deadCount = state.fish.filter((f) => f.dead).length;
  if (deadCount > 0) {
    for (const tankId of ['tank1', 'tank2', 'sale'] as TankId[]) {
      const tank = state.tanks[tankId];
      if (!tank.owned) continue;
      const n = state.fish.filter((f) => f.dead && f.tank === tankId).length;
      if (n > 0) tank.pollution = clamp(tank.pollution + dt * n * 10 * 0.35, 0, 100);
    }
  }

  // 繁殖
  for (const tankId of ['tank1', 'tank2'] as TankId[]) {
    if (!state.tanks[tankId].owned) continue;
    courtship(state, tankId);
  }

  state.stats.peak = Math.max(state.stats.peak, state.fish.filter((f) => !f.dead).length);
}

function courtship(state: GameState, tank: TankId): void {
  const ready = tankFish(state, tank).filter(
    (f) => isAdult(f) && f.health >= 25 && f.pregnancy <= 0 && f.fed > 12,
  );
  const males = ready.filter((f) => f.sex === 'm');
  const females = ready.filter((f) => f.sex === 'f' && f.tank === tank);
  if (!males.length || !females.length) return;
  const capacity = capacityOf(state, tank);
  if (tankFish(state, tank).length >= capacity) return;

  for (const female of females) {
    const mate = males[Math.floor(rand(state) * males.length)];
    if (!mate) continue;
    if (rand(state) < 0.02) {
      female.pregnancy = 0.6;
      female.sireSp = mate.sp;
      female.sireFin = mate.fin;
    }
  }
}

function layEggs(state: GameState, mother: Fish, bonus: number, mutation: number): void {
  const tank = mother.tank;
  const capacity = capacityOf(state, tank);
  let room = capacity - tankFish(state, tank).length;
  if (room <= 0) return;
  let count = 1 + (rand(state) < 0.5 ? 1 : 0) + bonus;
  count = Math.min(count, room);
  let born = 0;
  for (let i = 0; i < count; i++) {
    const child = breedGenome(
      mother.sp,
      mother.fin,
      mother.sireSp >= 0 ? mother.sireSp : mother.sp,
      mother.sireFin >= 0 ? mother.sireFin : mother.fin,
      () => rand(state),
      mutation,
    );
    addFish(state, {
      sp: child.sp,
      fin: child.fin,
      egg: true,
      tank,
      fragile: child.fragile,
    });
    born += 1;
    state.stats.bred += 1;
    if (child.magic >= 0) {
      log(state, `✨ 一对鱼产下了 ${MAGIC[child.magic].name} 的卵！`, 'good');
    }
  }
  if (born > 0) {
    log(state, `${fullName(mother.sp, mother.fin)} 产下了 ${born} 枚卵`, 'good');
  }
  mother.sireSp = -1;
  mother.sireFin = -1;
}

// ---- 销售 ----

function willingness(state: GameState, f: Fish, fx: ReturnType<typeof tankEffects>): number {
  const base = fishValue(f.sp, f.fin);
  const healthFactor = 0.55 + 0.45 * clamp(f.health / 100, 0, 1);
  const mood = 0.78 + rand(state) * 0.5;
  return base * mood * healthFactor * (1 + fx.willing + state.research.ads * 0.06);
}

export interface SaleEvent {
  name: string;
  price: number;
  sp: number;
  fin: number;
  ok: boolean;
}

export let lastSale: SaleEvent | null = null;
export let lastSaleAt = 0;

function saleTick(state: GameState, realSeconds: number): void {
  if (!state.tanks.sale.owned) return;
  const fx = tankEffects(state, 'sale');
  state.saleTimer += realSeconds;
  const interval =
    (state.screen === 'store' ? 3.0 : 9.0) /
    (1 + state.research.ads * 0.35) /
    (1 + fx.customerRate) /
    (1 + fx.willing);
  if (state.saleTimer < interval) return;
  state.saleTimer = 0;
  const result = attemptSale(state);
  if (state.screen === 'store') spawnCustomer(state, result?.ok ? result : null, 'door');
}

/** 一次顾客购买判定 */
export function attemptSale(state: GameState): SaleEvent | null {
  const forSale = state.fish.filter((f) => f.tank === 'sale' && !f.dead && !f.egg && isAdult(f));
  if (!forSale.length) {
    lastSale = null;
    return null;
  }
  const fx = tankEffects(state, 'sale');
  const f = forSale[Math.floor(rand(state) * forSale.length)];
  const limit = willingness(state, f, fx);
  const ok = f.price <= limit;
  if (ok) {
    state.cash += f.price;
    state.stats.sold += 1;
    state.stats.earned += f.price;
    removeFish(state, f.id);
    log(state, `售出 ${fullName(f.sp, f.fin)}  $${f.price}`, 'good');
  }
  lastSale = { name: fullName(f.sp, f.fin), price: f.price, sp: f.sp, fin: f.fin, ok };
  lastSaleAt = Date.now();
  return lastSale;
}

/** 手动兜售：立即成交，只能拿到 65% */
export function hawkFish(state: GameState, fishId: string | null): boolean {
  if (state.hawkCd > 0) return false;
  const f = fishId
    ? state.fish.find((x) => x.id === fishId)
    : state.fish.find((x) => x.tank === 'sale' && !x.dead && isAdult(x));
  if (!f || f.dead || f.egg) return false;
  if (f.tank !== 'sale') {
    log(state, '先把鱼移到销售缸', 'bad');
    return false;
  }
  const price = Math.max(1, Math.round(f.price * 0.65));
  state.cash += price;
  state.stats.sold += 1;
  state.stats.earned += price;
  log(state, `兜售 ${fullName(f.sp, f.fin)}  $${price}`, 'good');
  removeFish(state, f.id);
  state.hawkCd = 0.6;
  return true;
}

export function removeFish(state: GameState, id: string): void {
  state.fish = state.fish.filter((f) => f.id !== id);
  if (state.selected === id) state.selected = null;
}

export function cleanDead(state: GameState, tank: TankId): number {
  const dead = state.fish.filter((f) => f.dead && f.tank === tank);
  if (!dead.length) return 0;
  state.fish = state.fish.filter((f) => !(f.dead && f.tank === tank));
  state.tanks[tank].pollution = clamp(state.tanks[tank].pollution - dead.length * 3, 0, 100);
  log(state, `清理了 ${dead.length} 条死鱼`, 'info');
  return dead.length;
}

// ---- 玩家操作 ----

export function feedTank(state: GameState, foodId = 'food1'): boolean {
  const tankId = state.activeTank;
  if (tankId === 'sale' && !state.tanks.sale.owned) return false;
  const item = ITEM_MAP[foodId];
  if (!item?.feed) return false;
  if ((state.stock[foodId] ?? 0) <= 0) {
    log(state, '这种鱼粮用完了，去补给商店买一些', 'bad');
    return false;
  }
  state.stock[foodId] -= 1;
  const tank = state.tanks[tankId];
  tank.food = clamp(tank.food + item.feed, 0, 200);
  if (item.heal) {
    for (const f of tankFish(state, tankId)) f.health = clamp(f.health + item.heal, 0, 100);
  }
  if (tank.food > 140) log(state, '水里的食物太多了，会开始污染水质', 'bad');
  else log(state, `投喂 ${item.name}`, 'info');
  return true;
}

export function useConsumable(state: GameState, itemId: string): boolean {
  const item = ITEM_MAP[itemId];
  if (!item) return false;
  if ((state.stock[itemId] ?? 0) <= 0) {
    log(state, `${item.name} 库存不足`, 'bad');
    return false;
  }
  const tankId = state.activeTank;
  const tank = state.tanks[tankId];
  const fin = state.fish.find((f) => f.id === state.selected && !f.dead);

  if (item.feed) {
    return feedTank(state, itemId);
  }
  if (item.cure) {
    const sick = tankFish(state, tankId).filter((f) => f.disease === item.cure);
    if (!sick.length) {
      log(state, '缸里没有这种病的鱼', 'info');
      return false;
    }
    state.stock[itemId] -= 1;
    for (const f of sick) {
      f.disease = 0;
      f.health = clamp(f.health + 6, 0, 100);
    }
    log(state, `${item.name} 治好了 ${sick.length} 条鱼`, 'good');
    return true;
  }
  if (item.heal && !item.feed) {
    if (!fin) {
      log(state, '先选中一条鱼', 'info');
      return false;
    }
    state.stock[itemId] -= 1;
    fin.health = clamp(fin.health + item.heal, 0, 100);
    log(state, `${fullName(fin.sp, fin.fin)} 恢复健康 +${item.heal}`, 'good');
    return true;
  }
  if (item.pollutionCut) {
    state.stock[itemId] -= 1;
    tank.pollution = clamp(tank.pollution - item.pollutionCut, 0, 100);
    log(state, `水质改善，污染 −${item.pollutionCut}`, 'good');
    return true;
  }
  if (item.egg) {
    const capacity = capacityOf(state, tankId);
    if (tankFish(state, tankId).length >= capacity) {
      log(state, '这个缸已经满了', 'bad');
      return false;
    }
    state.stock[itemId] -= 1;
    const g = randomEggGenome(state, item.egg);
    addFish(state, { sp: g.sp, fin: g.fin, egg: true, tank: tankId });
    state.stats.eggsBought += 1;
    log(state, `放入了一枚 ${item.name}`, 'good');
    return true;
  }
  return false;
}

export function buyItem(state: GameState, itemId: string): boolean {
  const item = ITEM_MAP[itemId];
  if (!item) return false;
  if (state.cash < item.price) {
    log(state, '现金不够', 'bad');
    return false;
  }
  if (item.kind === 'consumable') {
    state.cash -= item.price;
    state.stock[itemId] = (state.stock[itemId] ?? 0) + (item.pack ?? 1);
    log(state, `购买 ${item.name}${item.pack ? ` ×${item.pack}` : ''}`, 'info');
    return true;
  }
  const tankId = state.activeTank === 'sale' ? 'tank1' : state.activeTank;
  if (state.tanks[tankId].installed.includes(itemId)) {
    log(state, `这个缸已经装了 ${item.name}`, 'bad');
    return false;
  }
  if (state.activeTank === 'sale') {
    log(state, '陈设与装备只能装进饲养缸', 'bad');
    return false;
  }
  state.cash -= item.price;
  state.tanks[tankId].installed.push(itemId);
  log(state, `${item.name} 已装入${tankId === 'tank1' ? '一号缸' : '二号缸'}`, 'good');
  return true;
}

export function buySecondTank(state: GameState): boolean {
  if (state.tanks.tank2.owned) return false;
  if (state.cash < TANK2_PRICE) {
    log(state, `需要 $${TANK2_PRICE} 才能买二号缸`, 'bad');
    return false;
  }
  state.cash -= TANK2_PRICE;
  state.tanks.tank2.owned = true;
  state.tanks.sale.owned = true;
  log(state, '买下了二号缸，销售缸同时开张！', 'good');
  return true;
}

export function startResearch(state: GameState, line: ResearchLine): boolean {
  if (state.researchJob) {
    log(state, '正在研究别的项目', 'bad');
    return false;
  }
  const level = state.research[line];
  if (level >= 3) return false;
  const def = RESEARCH_MAP[line];
  const cost = def.costs[level];
  if (state.cash < cost) {
    log(state, '现金不够', 'bad');
    return false;
  }
  state.cash -= cost;
  state.researchJob = { line, remaining: def.years[level], total: def.years[level] };
  log(state, `开始研究 ${def.name} ${level + 1} 级`, 'info');
  return true;
}

export function moveFish(state: GameState, fishId: string, target: TankId): boolean {
  const f = state.fish.find((x) => x.id === fishId);
  if (!f || f.dead) return false;
  if (f.tank === target) return true;
  if (!state.tanks[target].owned) {
    log(state, '这个缸还没买下来', 'bad');
    return false;
  }
  if (tankFish(state, target).length >= capacityOf(state, target)) {
    log(state, '目标缸已经满了', 'bad');
    return false;
  }
  f.tank = target;
  f.x = 0.2 + rand(state) * 0.6;
  f.y = 0.25 + rand(state) * 0.5;
  if (target === 'sale') {
    f.price = state.askingPrice;
    log(state, `${fullName(f.sp, f.fin)} 移入销售缸，标价 $${f.price}`, 'info');
  }
  return true;
}

export function setAskingPrice(state: GameState, price: number, applyAll = false): void {
  state.askingPrice = Math.max(1, Math.round(price));
  const target = state.fish.find((f) => f.id === state.selected);
  if (applyAll) {
    for (const f of state.fish) if (f.tank === 'sale') f.price = state.askingPrice;
  } else if (target && target.tank === 'sale') {
    target.price = state.askingPrice;
  }
}

export function resetGame(seed?: number): GameState {
  const s = createGame(seed ?? Math.floor(Math.random() * 100000));
  return s;
}

// ---- 顾客（鱼店画面） ----

const HAIRS = ['#2b2b33', '#5a3a22', '#a8552d', '#d8c07a', '#8a3f5c', '#3f4f78'];
const SHIRTS = ['#4f8fd8', '#d8615a', '#5fae72', '#e0b13f', '#9a6fd0', '#d87fa8', '#4fb8c4'];
const PANTS = ['#33405a', '#5a4632', '#2f5a4a', '#4a3a5a'];

const CUSTOMER_NPCS: NpcKind[] = [
  'student',
  'office',
  'kid',
  'kid',
  'woman',
  'woman',
  'business',
  'elder-man',
  'elder-woman',
  'worker',
];

// ---------- 导航网格：销售缸 / 柜台是实体障碍 ----------

export interface Footprint {
  l: number;
  r: number;
  top: number;
  bottom: number;
}

interface Pt {
  x: number;
  y: number;
}

interface Nav {
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  blocked: Uint8Array;
  free: Pt[];
  zones: { sale: Pt[]; wall: Pt[]; counter: Pt[] };
}

let obstacles: Footprint[] = [{ l: 0.35, r: 0.6, top: 0.12, bottom: 0.82 }];
let navCache: Nav | null = null;
let obstaclesReady = false;

function tankFootprint(): Footprint {
  return obstacles[0];
}

export function setStoreObstacles(list: Footprint[]): void {
  if (!list.length) return;
  const same =
    list.length === obstacles.length &&
    list.every(
      (f, i) =>
        Math.abs(f.l - obstacles[i].l) < 0.002 &&
        Math.abs(f.r - obstacles[i].r) < 0.002 &&
        Math.abs(f.top - obstacles[i].top) < 0.002 &&
        Math.abs(f.bottom - obstacles[i].bottom) < 0.002,
    );
  obstaclesReady = true;
  if (same) return;
  obstacles = list;
  navCache = null;
}

function buildNav(): Nav {
  const cols = 36;
  const rows = 22;
  const cw = 1 / cols;
  const ch = 0.94 / rows;
  const blocked = new Uint8Array(cols * rows);
  const free: Pt[] = [];
  const pad = 0.014;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cw;
      const y = (r + 0.5) * ch;
      const inArea = x > 0.14 && x < 0.99 && y > 0.01 && y < 0.9;
      const inside = obstacles.some(
        (f) => x > f.l - pad && x < f.r + pad && y > f.top - pad && y < f.bottom + pad,
      );
      const i = r * cols + c;
      if (!inArea || inside) {
        blocked[i] = 1;
        continue;
      }
      free.push({ x, y });
    }
  }
  const fp = tankFootprint();
  const zones = {
    sale: free.filter(
      (p) => p.y > fp.bottom + 0.03 && p.y < fp.bottom + 0.2 && p.x > fp.l - 0.14 && p.x < fp.r + 0.14,
    ),
    wall: free.filter((p) => p.y < 0.3 && (p.x < fp.l - 0.02 || p.x > fp.r + 0.02)),
    counter: free.filter((p) => p.x > 0.22 && p.x < 0.36 && p.y > 0.3 && p.y < 0.62),
  };
  return { cols, rows, cw, ch, blocked, free, zones };
}

function nav(): Nav {
  if (!navCache) navCache = buildNav();
  return navCache;
}

function nearestFreeCell(n: Nav, p: Pt): number {
  const c = Math.max(0, Math.min(n.cols - 1, Math.floor(p.x / n.cw)));
  const r = Math.max(0, Math.min(n.rows - 1, Math.floor(p.y / n.ch)));
  const start = r * n.cols + c;
  if (!n.blocked[start]) return start;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < n.blocked.length; i++) {
    if (n.blocked[i]) continue;
    const cc = i % n.cols;
    const rr = (i - cc) / n.cols;
    const dx = (cc + 0.5) * n.cw - p.x;
    const dy = (rr + 0.5) * n.ch - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function findPathPoints(from: Pt, to: Pt): Pt[] {
  const n = nav();
  const start = nearestFreeCell(n, from);
  const goal = nearestFreeCell(n, to);
  if (start < 0 || goal < 0) return [{ x: to.x, y: to.y }];
  const total = n.cols * n.rows;
  const prev = new Int32Array(total).fill(-1);
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  while (head < tail) {
    const cur = queue[head++];
    if (cur === goal) break;
    const cx = cur % n.cols;
    const cy = (cur - cx) / n.cols;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= n.cols || ny >= n.rows) continue;
      const ni = ny * n.cols + nx;
      if (n.blocked[ni] || seen[ni]) continue;
      if (dx !== 0 && dy !== 0) {
        if (n.blocked[cy * n.cols + nx] || n.blocked[ny * n.cols + cx]) continue;
      }
      seen[ni] = 1;
      prev[ni] = cur;
      queue[tail++] = ni;
    }
  }
  if (!seen[goal]) return [{ x: to.x, y: to.y }];
  const cells: number[] = [];
  let cur = goal;
  while (cur !== start && cur >= 0) {
    cells.push(cur);
    cur = prev[cur];
  }
  cells.reverse();
  const pts: Pt[] = [];
  for (const i of cells) {
    const c = i % n.cols;
    const r = (i - c) / n.cols;
    const p = { x: (c + 0.5) * n.cw, y: (r + 0.5) * n.ch };
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.04) pts.push(p);
  }
  // 最后一段直接冲向真实目标
  if (pts.length) pts.shift();
  pts.push({ x: to.x, y: to.y });
  return pts;
}

/** 选一个落点：多摇几次，优先挑离其他顾客最远的位置，避免几个人叠在一起 */
/** 门口：顾客只能从这里进出，不允许从右侧墙面穿出去 */
const DOOR: Pt = { x: 0.935, y: 0.13 };

function pickSpot(state: GameState, r: () => number, saleWeight: number): Pt {
  const n = nav();
  const roll = r();
  const list = roll < saleWeight ? n.zones.sale : roll < saleWeight + 0.3 ? n.zones.wall : n.zones.counter;
  const pool = list.length ? list : n.free;
  const others = state.customers.filter((c) => c.state !== 'leave');
  let best = pool[0];
  let bestD = -1;
  for (let i = 0; i < 8; i++) {
    const p = pool[Math.min(pool.length - 1, Math.floor(r() * pool.length))];
    let near = 1;
    for (const c of others) near = Math.min(near, Math.hypot(c.x - p.x, c.y - p.y));
    if (near > bestD) {
      bestD = near;
      best = p;
    }
  }
  return best;
}

/** 给顾客安排一条路线，路点依次放进 path，第一个作为当前目标 */
function assignPath(c: Customer, to: Pt): void {
  const pts = findPathPoints({ x: c.x, y: c.y }, to);
  c.goal = { x: to.x, y: to.y };
  c.path = pts;
  const first = c.path.shift();
  c.tx = first ? first.x : to.x;
  c.ty = first ? first.y : to.y;
  c.stuck = 0;
}


function spawnCustomer(
  state: GameState,
  bought: SaleEvent | null,
  at: 'door' | 'inside',
  forceNpc?: NpcKind,
): void {
  if (state.customers.length > 16) return;
  const r = () => rand(state);
  const bubbles = bought?.ok ? ['💰'] : ['?', '$', '♥', '!', '💰'];
  const npc = forceNpc ?? CUSTOMER_NPCS[Math.min(CUSTOMER_NPCS.length - 1, Math.floor(r() * CUSTOMER_NPCS.length))];

  let sx: number;
  let sy: number;
  if (at === 'door') {
    sx = 0.97;
    sy = DOOR.y + (r() - 0.5) * 0.04;
  } else {
    // 一开始就散开站在店里，别都挤在柜台那一小块
    const spot = pickSpot(state, r, 0.5);
    sx = spot.x;
    sy = spot.y;
  }

  const c: Customer = {
    id: `c${state.nextId++}`,
    kind: Math.floor(r() * 4),
    npc,
    x: sx,
    y: sy,
    tx: sx,
    ty: sy,
    state: 'enter',
    timer: 1 + r() * 2,
    bubble: bought?.ok ? '💰' : bubbles[Math.min(bubbles.length - 1, Math.floor(r() * bubbles.length))],
    speed: 0.05 + r() * 0.03,
    stay: 1.5 + r() * 2.5,
    hair: HAIRS[Math.floor(r() * HAIRS.length)],
    shirt: SHIRTS[Math.floor(r() * SHIRTS.length)],
    pants: PANTS[Math.floor(r() * PANTS.length)],
    target: null,
    facing: 1,
    stuck: 0,
  };
  state.customers.push(c);
  assignPath(c, pickSpot(state, r, 0.62));
}

let ambientTimer = 0;

export function storeDebug(state: GameState): unknown {
  return {
    ready: obstaclesReady,
    obstacles: obstacles.map((o) => ({ ...o })),
    sample: state.customers.slice(0, 3).map((c) => ({
      x: +c.x.toFixed(3),
      y: +c.y.toFixed(3),
      tx: +c.tx.toFixed(3),
      ty: +c.ty.toFixed(3),
      st: c.state,
      path: c.path ? c.path.length : -1,
      speed: c.speed,
    })),
  };
}

export function storeVisualTick(state: GameState, realSeconds: number): void {
  if (state.screen !== 'store') {
    if (state.customers.length) state.customers.length = 0;
    ambientTimer = 0;
    state.storeSeeded = false;
    return;
  }
  if (!state.storeSeeded) {
    state.storeSeeded = true;
    const pool = [...new Set(CUSTOMER_NPCS)];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand(state) * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i = 0; i < 4; i++) spawnCustomer(state, null, 'inside', pool[i % pool.length]);
  }

  ambientTimer += realSeconds;
  const fx = tankEffects(state, 'sale');
  const interval = 2.4 / (1 + state.research.ads * 0.4) / (1 + fx.customerRate);
  if (ambientTimer >= interval) {
    ambientTimer = 0;
    if (state.customers.length < 9) spawnCustomer(state, null, 'door');
  }

  for (const c of state.customers) {
    // 统一用钳制过的 dt 驱动，帧卡顿时不会让顾客瞬移
    const dt = Math.min(realSeconds, 0.1);

    // 离店：先走到门口，再从门口跨出去（不许贴右墙平移穿墙）
    if (c.state === 'leave') {
      const lx = c.tx - c.x;
      const ly = c.ty - c.y;
      const ld = Math.hypot(lx, ly);
      if (ld > 0.002) {
        const step = Math.min(c.speed * 1.15 * dt, ld);
        if (Math.abs(lx) > 0.006) c.facing = lx >= 0 ? 1 : -1;
        c.x += (lx / ld) * step;
        c.y += (ly / ld) * step;
      }
      if (ld <= 0.02) {
        if (c.path && c.path.length) {
          const next = c.path.shift();
          if (next) {
            c.tx = next.x;
            c.ty = next.y;
          }
        } else if (!c.exiting) {
          // 已经站在门口，接着往外走一步就退场
          c.exiting = true;
          c.tx = 0.985;
          c.ty = DOOR.y;
        }
      }
      continue;
    }

    // 计时永远在走，跟有没有到位解耦，避免卡在 browse 一动不动
    c.timer -= dt;

    // 走向当前路点
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.002) {
      const step = Math.min(c.speed * dt, dist);
      if (Math.abs(dx) > 0.006) c.facing = dx >= 0 ? 1 : -1;
      c.x += (dx / dist) * step;
      c.y += (dy / dist) * step;
      c.stuck = (c.stuck ?? 0) + dt;
    }
    if (dist <= 0.02 && c.path && c.path.length) {
      const next = c.path.shift();
      if (next) {
        c.tx = next.x;
        c.ty = next.y;
      }
      c.stuck = 0;
    }

    // 超时就开始逛，不再等走完路点（否则路点没走完会永远停在 enter）
    if (c.state === 'enter' && c.timer <= 0) {
      c.state = 'browse';
      c.timer = c.stay;
    } else if (c.state === 'browse' && c.timer <= 0) {
      c.visits = (c.visits ?? 0) + 1;
      if (c.visits <= 2 && Math.random() < 0.45) {
        assignPath(c, pickSpot(state, () => Math.random(), 0.5));
        c.state = 'enter';
        c.timer = 2 + Math.random() * 3;
      } else {
        c.state = 'leave';
        c.exiting = false;
        assignPath(c, DOOR);
      }
    }

    // 卡住兜底：8 秒没推进就直接离店，任何情况下都不会永久堵死
    if ((c.stuck ?? 0) > 8) {
      c.stuck = 0;
      c.state = 'leave';
      c.exiting = false;
      assignPath(c, DOOR);
    }
  }
  // 人数硬上限：超过 9 人就让最早进店的人离场，绝不允许无限堆积
  if (state.customers.length > 9) {
    const stuck = state.customers.find((c) => c.state !== 'leave');
    if (stuck) {
      stuck.state = 'leave';
      stuck.exiting = false;
      assignPath(stuck, DOOR);
    }
  }

  state.customers = state.customers.filter((c) => !(c.state === 'leave' && c.x > 0.955));
}


export { ADULT_AGE, MAGIC, SPECIES, fishValue, fullName, isLeaf };
