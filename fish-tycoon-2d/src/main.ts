// 养鱼大亨 2D —— 主编排器：游戏循环、缸/鱼店双视图、点击选鱼+隔离缸、
// 配对、屏保模式、UI 联动、自动存档、离线追赶、测试钩子
import './styles.css';
import { Sim, FOUNDERS, YEAR_SECONDS, EGG_YEARS, ADULT_AGE, type FishState, type TankId, type ItemId, type ResearchId } from './game/sim';
import { comboName, suggestedPrice, finOf, MAGIC_INDEX, type MagicDef, type Genes } from './game/genetics';
import { buildDecor, createBubbles, updateBubbles, drawTankBackground, loadDecorOverrides, saveDecorOverrides, applyDecorOverrides, type Decor, type Bubble } from './render/tank';
import { drawFish, drawEggCluster, fishScale } from './render/fishart';
import { drawSpriteFish, spriteFishReady } from './render/fishsprites';
import { drawStore, spawnCustomer, updateCustomers, updateOutsidePeople, POSTER_RECT, type Customer, type SoldRecord } from './render/crowd';
import { openModal, closeModal, modalOpen, openSupplies, openSpecies, openTrophy, openMenu, fishPortrait } from './ui/panels';
import { Sfx } from './sfx';

// ---------- 基础设施 ----------
const $ = (sel: string): HTMLElement => {
  const q = sel.startsWith('#') || sel.startsWith('.') ? sel : `#${sel}`;
  const el = document.querySelector(q);
  if (!el) throw new Error(`Missing element ${q}`);
  return el as HTMLElement;
};

const urlSeed = new URLSearchParams(location.search).get('seed');
const rngSeed = urlSeed ? parseInt(urlSeed, 10) : Math.floor(Math.random() * 2 ** 31);
function makeRng(): () => number {
  let a = rngSeed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SwimState = { x: number; y: number; tx: number; ty: number; ang: number; wag: number; speed: number };

const canvas = $('tank-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const isoCanvas = $('iso-canvas') as HTMLCanvasElement;
const isoCtx = isoCanvas.getContext('2d')!;

let sim: Sim | null = null;
let currentTank: TankId = 0;
let selectedId: number | null = null;
let pairModeId: number | null = null;
let swims = new Map<number, SwimState>();
const decors: Decor[] = [buildDecor(0), buildDecor(1), buildDecor(2)];
// 应用玩家拖拽过的装饰位置（Customizable Tanks）
const decorOv = loadDecorOverrides();
decors.forEach((d, i) => applyDecorOverrides(d, i, decorOv));
const bubbles: Bubble[][] = [createBubbles(14), createBubbles(10), createBubbles(8)];
const customers: Customer[] = [];
const soldFeed: SoldRecord[] = [];
let lastSoldCount = 0;
let lastSoldInfo: { name: string; sp: number; fin: number; price: number } | null = null;
let prevSaleIds = new Set<number>();
let spawnTimer = 2;
let gameTime = 0;
let screensaver = false;

// ---------- Toast ----------
function toast(text: string, kind: 'good' | 'bad' | 'info' | 'gold' = 'info'): void {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
  while (box.children.length > 5) box.firstChild!.remove();
}

const simEvents = {
  toast,
  magicFound: (m: MagicDef) => {
    Sfx.magic();
    toast(`✦✦ 发现魔法鱼：${m.cn}（${m.title}）✦✦`, 'gold');
  },
  win: () => {
    if (!sim) return;
    const s = sim.stats;
    $('win-stats').textContent = `游戏年 ${sim.years.toFixed(1)} ｜ 累计收入 $${s.earned} ｜ 售出 ${s.sold} 条 ｜ 繁殖 ${s.born} 条`;
    $('win-overlay').hidden = false;
  },
};

// ---------- 游泳 AI ----------
function boundsOf(): { minX: number; maxX: number; minY: number; maxY: number } {
  return { minX: 40, maxX: canvas.width - 40, minY: 50, maxY: canvas.height * 0.84 };
}
function syncSwims(): void {
  if (!sim) return;
  const b = boundsOf();
  const alive = new Set<number>();
  for (const f of sim.tankFish(currentTank)) {
    alive.add(f.id);
    if (!swims.has(f.id)) {
      const s: SwimState = {
        x: b.minX + Math.random() * (b.maxX - b.minX),
        y: b.minY + Math.random() * (b.maxY - b.minY),
        tx: 0, ty: 0, ang: Math.random() * Math.PI * 2, wag: Math.random() * 10,
        speed: 26 + Math.random() * 30,
      };
      s.tx = s.x; s.ty = s.y;
      swims.set(f.id, s);
    }
  }
  for (const id of [...swims.keys()]) if (!alive.has(id)) swims.delete(id);
}
function updateSwims(dt: number): void {
  const b = boundsOf();
  for (const f of sim?.tankFish(currentTank) ?? []) {
    const s = swims.get(f.id);
    if (!s) continue;
    if (f.dead) {
      s.y += (b.minY - 6 - s.y) * Math.min(1, dt * 1.2);
      s.wag += dt * 0.5;
      continue;
    }
    const slow = f.sick ? 0.4 : 1;
    const dx = s.tx - s.x, dy = s.ty - s.y;
    if (dx * dx + dy * dy < 400) {
      s.tx = b.minX + 20 + Math.random() * (b.maxX - b.minX - 40);
      s.ty = b.minY + 10 + Math.random() * (b.maxY - b.minY - 20);
    }
    const ang = Math.atan2(dy, dx);
    let diff = ang - s.ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    s.ang += diff * Math.min(1, dt * 2.2);
    s.x += Math.cos(s.ang) * s.speed * slow * dt;
    s.y += Math.sin(s.ang) * s.speed * slow * dt;
    s.x = Math.max(b.minX, Math.min(b.maxX, s.x));
    s.y = Math.max(b.minY, Math.min(b.maxY, s.y));
    s.wag += dt * (7 + s.speed * 0.08);
  }
}

// ---------- 隔离小缸渲染（选中鱼在迷你缸里游动） ----------
let isoWag = 0;
function renderIsoTank(dt: number): void {
  const w = isoCanvas.width, h = isoCanvas.height;
  const g = isoCtx;
  // 水体
  const water = g.createLinearGradient(0, 0, 0, h);
  water.addColorStop(0, '#7cc0ea');
  water.addColorStop(1, '#4a9ad0');
  g.fillStyle = water;
  g.fillRect(0, 0, w, h);
  // 白卵石底
  g.fillStyle = '#ece8e0';
  g.beginPath();
  g.moveTo(0, h * 0.72);
  for (let x = 0; x <= w; x += 12) g.lineTo(x, h * 0.72 + Math.sin(x * 0.3) * 2);
  g.lineTo(w, h); g.lineTo(0, h);
  g.fill();
  g.fillStyle = 'rgba(200,190,170,0.7)';
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    g.ellipse((i * 29 + 7) % w, h * 0.78 + ((i * 13) % 12), 2.5, 1.8, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 选中鱼来回游
  const f = selectedId !== null ? sim?.fishById(selectedId) : null;
  if (f) {
    isoWag += dt * 8;
    const swimX = w * 0.5 + Math.sin(gameTime * 0.9) * w * 0.24;
    const dir = Math.cos(gameTime * 0.9) > 0 ? 1 : -1;
    g.save();
    g.translate(swimX, h * 0.48);
    if (dir < 0) g.scale(-1, 1);
    g.translate(-swimX, -h * 0.48);
    drawFish(g, f, swimX, h * 0.48, isoWag, false);
    g.restore();
  } else {
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = '10px Verdana, sans-serif';
    g.textAlign = 'center';
    g.fillText('点击鱼放入隔离缸', w / 2, h / 2 - 4);
  }
}

// ---------- 视图切换（主缸 UI ↔ Fish Store 全屏） ----------
function applyView(): void {
  const isStore = currentTank === 2;
  $('tank-ui').hidden = isStore;
  $('store-ui').hidden = !isStore;
  if (isStore && customers.length < 14) {
    // v6.9：进店即铺满 14-18 人；**按分层随机分布**（模拟均匀逛店，避免全挤门口/两侧）
    const target = 14 + Math.floor(Math.random() * 5);
    for (let i = customers.length; i < target; i++) {
      const c = spawnCustomer(Math.random);
      // 80% 直接在店内随机位置（分 3 段均匀铺开），20% 从门口走入
      if (i % 5 !== 0) {
        const seg = i % 3;
        c.x = 60 + seg * 290 + Math.random() * 260;
        c.y = 350 + Math.random() * 190;
        c.pauseT = 0.6 + Math.random() * 4;   // 已在店内，先站一会儿再逛
      }
      customers.push(c);
    }
  }
}

// ---------- 渲染 ----------
function render(): void {
  if (!sim) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (currentTank === 2) {
    // v7.8：单帧渲染异常不应让整个商店画面消失——捕获后至少保证底图可见
    try {
      // v7.8：单帧渲染异常不应让整个商店画面消失——捕获后至少保证底图可见
    try {
      drawStore(ctx, w, h, gameTime, customers, sim.tankFish(2).filter((f) => !f.dead).slice(0, 7), soldFeed);
    } catch (e) {
      console.error('[drawStore] 渲染异常，已降级为底图', e);
      ctx.fillStyle = '#6b52b8';
      ctx.fillRect(0, 0, w, h);
    }
    } catch (e) {
      console.error('[drawStore] 渲染异常，已降级为底图', e);
      ctx.fillStyle = '#6b52b8';
      ctx.fillRect(0, 0, w, h);
    }
  } else {
    drawTankBackground(ctx, w, h, decors[currentTank], bubbles[currentTank], gameTime);
    const fishList = sim.tankFish(currentTank);
    // v6.8：缸内状态提示（成鱼数 / 鱼卵孵化倒计时）—— 解决"看不到鱼"的困惑
    const adults = fishList.filter((f) => f.age >= 0 && !f.dead).length;
    const eggs = fishList.filter((f) => f.age < 0).length;
    {
      // 左上角常驻状态牌（原版风格：深底 + 黄字），空缸也给引导
      const parts: string[] = [];
      if (adults > 0) parts.push(`🐟 ${adults} 条鱼`);
      if (eggs > 0) {
        const remain = Math.max(0, Math.min(...fishList.filter((f) => f.age < 0).map((f) => -f.age)));
        parts.push(`🥚 ${eggs} 枚 · ${Math.ceil(remain * YEAR_SECONDS)}s 孵化`);
      }
      const line = parts.length ? parts.join('　') : '空缸 · 去商店买鱼卵投进来';
      ctx.save();
      ctx.font = 'bold 14px Verdana, sans-serif';
      const tw2 = ctx.measureText(line).width + 24;
      ctx.fillStyle = 'rgba(10,22,40,0.78)';
      ctx.fillRect(12, 40, tw2, 28);
      ctx.strokeStyle = 'rgba(255,220,150,0.7)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(12, 40, tw2, 28);
      ctx.fillStyle = parts.length ? '#ffe9a0' : '#9fd8ff';
      ctx.textAlign = 'left';
      ctx.fillText(line, 24, 59);
      // v7.14：缸内中央大字倒计时（刷新后第一眼可见）
      if (eggs > 0) {
        const remain = Math.max(0, Math.min(...fishList.filter((f) => f.age < 0).map((f) => -f.age)));
        const secs = Math.ceil(remain * YEAR_SECONDS);
        const big = `鱼卵孵化中　${secs}s`;
        ctx.font = 'bold 26px Verdana, sans-serif';
        ctx.textAlign = 'center';
        const bw3 = ctx.measureText(big).width + 36;
        const pulseA = 0.72 + 0.12 * Math.sin(gameTime * 2.4);
        ctx.fillStyle = `rgba(8,18,34,${pulseA})`;
        ctx.fillRect(w / 2 - bw3 / 2, h * 0.14, bw3, 44);
        ctx.strokeStyle = 'rgba(255,220,150,0.9)'; ctx.lineWidth = 2;
        ctx.strokeRect(w / 2 - bw3 / 2, h * 0.14, bw3, 44);
        ctx.fillStyle = '#ffe9a0';
        ctx.fillText(big, w / 2, h * 0.14 + 31);
        // 提示：可按速度键加速
        ctx.font = 'bold 12px Verdana, sans-serif';
        ctx.fillStyle = 'rgba(200,230,255,0.9)';
        ctx.fillText('（可用 4× / 20× 加速时间）', w / 2, h * 0.14 + 62);
      }

      // 有鱼卵时补一条**孵化进度条**（原版的等待提示就是显眼的横条）
      if (eggs > 0) {
        const remain = Math.max(0, Math.min(...fishList.filter((f) => f.age < 0).map((f) => -f.age)));
        const pct = Math.max(0, Math.min(1, 1 - remain / EGG_YEARS));
        const bx = 12, by = 76, bw2 = tw2, bh = 9;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(bx, by, bw2, bh);
        const pg = ctx.createLinearGradient(bx, 0, bx + bw2, 0);
        pg.addColorStop(0, '#4fc3f7');
        pg.addColorStop(1, '#a8e6a0');
        ctx.fillStyle = pg;
        ctx.fillRect(bx, by, bw2 * pct, bh);
        ctx.strokeStyle = 'rgba(255,220,150,0.7)'; ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw2, bh);
        ctx.fillStyle = '#eaf6ff';
        ctx.font = 'bold 10px Verdana, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`孵化中 ${Math.round(pct * 100)}%`, bx + 4, by + bh + 12);
      }
      ctx.restore();
    }

    const sorted = [...fishList].sort((a, b) => a.age - b.age);
    for (const f of sorted) {
      if (f.age < 0) {
        // 鱼卵：静置缸底等待孵化（加大 + 呼吸光晕，确保玩家一眼看见）
        // 摆在缸底中央的空旷砂面（避开两侧水草），确保一眼可见
        const eggSlot = fishList.filter((x) => x.age < 0).indexOf(f);
        const ex = w * 0.5 + (eggSlot - (eggs - 1) / 2) * 62;
        const ey = h * 0.80 - ((f.id * 13) % 10);
        const pulse = 0.5 + 0.5 * Math.sin(gameTime * 2.2 + f.id);
        ctx.save();
        ctx.globalAlpha = 0.18 + pulse * 0.16;
        ctx.fillStyle = '#fff2b0';
        ctx.beginPath();
        ctx.ellipse(ex, ey - 2, 30 + pulse * 6, 20 + pulse * 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const magic = MAGIC_INDEX[`${f.fin}_${f.sp}`];
        drawEggCluster(ctx, ex, ey, magic ? 0xf2c14e : finOf(f.fin).color);
        // 卵上方倒计时标签
        const left = Math.ceil(-f.age * YEAR_SECONDS);
        ctx.save();
        ctx.font = 'bold 12px Verdana, sans-serif';
        ctx.textAlign = 'center';
        const txt = `孵化 ${left}s`;
        ctx.font = 'bold 13px Verdana, sans-serif';
        const bw2 = ctx.measureText(txt).width + 18;
        const byy = ey - 52;
        ctx.fillStyle = 'rgba(10,18,34,0.88)';
        ctx.fillRect(ex - bw2 / 2, byy, bw2, 22);
        ctx.strokeStyle = 'rgba(255,225,150,0.85)'; ctx.lineWidth = 1.2;
        ctx.strokeRect(ex - bw2 / 2, byy, bw2, 22);
        ctx.fillStyle = '#ffe9a0';
        ctx.fillText(txt, ex, byy + 15);
        ctx.restore();
        continue;
      }
      // v7.15：未成年鱼头顶显示**成长进度条**（原版幼鱼上方有年龄/成长标记）
      if (!f.dead && f.age >= 0 && f.age < ADULT_AGE) {
        const pct = Math.max(0, Math.min(1, f.age / ADULT_AGE));
        const sw = swims.get(f.id);
        if (sw) {
          const fishH = 60 * fishScale(f.age) * (f.sp === 5 || f.sp === 10 ? 1.15 : 1.0);
          const bx = sw.x - 17, by = sw.y - fishH - 14;
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(bx, by, 34, 5);
          ctx.fillStyle = '#7fe07f';
          ctx.fillRect(bx, by, 34 * pct, 5);
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.8;
          ctx.strokeRect(bx, by, 34, 5);
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.font = 'bold 9px Verdana, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.floor(f.age)}/${ADULT_AGE}`, bx + 17, by - 3);
        }
      }

      const s = swims.get(f.id);
      if (!s) continue;
      const dir = Math.cos(s.ang) < 0 ? -1 : 1;
      ctx.save();
      ctx.translate(s.x, s.y);
      if (dir < 0) ctx.scale(-1, 1);
      ctx.translate(-s.x, -s.y);
      // v6：AI sprite 合成渲染（素材就绪时），否则回退矢量管线
      if (spriteFishReady()) drawSpriteFish(ctx, f, s.x, s.y, s.wag, selectedId === f.id);
      else drawFish(ctx, f, s.x, s.y, s.wag, selectedId === f.id);
      ctx.restore();
    }
  }
}

// ---------- 售出检测（更新 SOLD 卡） ----------
function trackSales(): void {
  if (!sim) return;
  const cur = new Set(sim.tankFish(2).map((f) => f.id));
  if (sim.stats.sold > lastSoldCount) {
    for (const id of prevSaleIds) {
      if (!cur.has(id)) {
        const pf = prevSaleFish.get(id);
        if (pf) {
          lastSoldInfo = { name: comboName({ sp: pf.sp, fin: pf.fin }), sp: pf.sp, fin: pf.fin, price: 0 };
          lastSoldInfo.price = Math.round(suggestedPrice({ sp: pf.sp, fin: pf.fin }) * sim.priceScale);
          soldFeed.push({ name: lastSoldInfo.name, price: lastSoldInfo.price, t: gameTime });
        }
        break;
      }
    }
    lastSoldCount = sim.stats.sold;
    if (lastSoldInfo) {
      $('sold-name').textContent = lastSoldInfo.name;
      const art = $('sold-fish-art');
      art.innerHTML = '';
      art.appendChild(fishPortrait(lastSoldInfo.sp, lastSoldInfo.fin, 100, 44, 0.6));
    }
  }
  prevSaleIds = cur;
  prevSaleFish = new Map(sim.tankFish(2).map((f) => [f.id, { sp: f.sp, fin: f.fin }]));
}
let prevSaleFish = new Map<number, { sp: number; fin: number }>();

// ---------- UI 刷新 ----------
function refreshTankBadges(): void {
  if (!sim) return;
  for (let ti = 0; ti < 3; ti++) {
    const el = document.getElementById(`badge-${ti}`);
    if (!el) continue;
    const list = sim.tankFish(ti as TankId);
    const adults = list.filter((f) => f.age >= 0 && !f.dead).length;
    const eggs = list.filter((f) => f.age < 0).length;
    const deads = list.filter((f) => f.dead).length;
    el.textContent = adults > 0 || eggs > 0 ? `🐟${adults} 🥚${eggs}` : '空';
    if (deads > 0) el.textContent += ` ☠${deads}`;
  }
}

function refreshHud(): void {
  refreshTankBadges();
  if (!sim) return;
  $('info-cash').textContent = `Your cash: $${sim.money}`;
  $('year-num').textContent = sim.years.toFixed(1);
  $('magic-count').textContent = String(sim.magicFound.length);
  $('store-cash').textContent = `Your cash: $${sim.money}`;

  // 工具箱数量
  $('n-food').textContent = String(sim.owned.food_bag ?? 0);
  $('n-fungus').textContent = String(sim.owned.med_fungus ?? 0);
  $('n-ick').textContent = String(sim.owned.med_ick ?? 0);
  $('n-vit').textContent = String(sim.owned.vitamin ?? 0);

  // 缸状态行
  const t = sim.tanks[currentTank];
  $('tank-state').textContent = `饲料 ${Math.round(t.food)}% · 污染 ${Math.round(t.fouling)}%`;

  // 选中鱼
  const f = selectedId !== null ? sim.fishById(selectedId) : null;
  if (f) {
    $('info-name').textContent = comboName({ sp: f.sp, fin: f.fin }) + (f.dead ? ' 💀' : '');
    const st = $('info-status');
    if (f.dead) { st.textContent = 'Status: Dead'; st.className = ''; }
    else if (f.age < 0) { st.textContent = 'Status: Egg 孵化中…'; st.className = 'pregnant'; }
    else if (f.sick === 'fungus') { st.textContent = 'Status: Fungus! 真菌感染'; st.className = 'sick'; }
    else if (f.sick === 'ick') { st.textContent = 'Status: Ick! 白点病'; st.className = 'sick'; }
    else if (f.pregnant > 0) { st.textContent = 'Status: Pregnant 怀孕中'; st.className = 'pregnant'; }
    else { st.textContent = `Status: ${f.female ? 'Female' : 'Male'}${f.fragile ? ' · 弱质' : ''}`; st.className = ''; }
    // 原版格式：Age: x / 20，未成年时附带"距成年还有多久"
    if (f.age < 0) {
      $('info-age').textContent = `Age: 孵化中（剩余 ${Math.ceil(-f.age * YEAR_SECONDS)} 秒）`;
    } else if (f.age < ADULT_AGE) {
      const growLeft = Math.ceil((ADULT_AGE - f.age) * YEAR_SECONDS);
      $('info-age').textContent = `Age: ${Math.floor(f.age)} / ${ADULT_AGE} · 距成年还有 ${growLeft} 秒`;
    } else {
      $('info-age').textContent = `Age: ${Math.floor(f.age)} / ${ADULT_AGE} · 已成年`;
    }
    if (f.dead) {
      $('info-age').textContent += '　→ 按「🗑 丢弃」移出缸，或点右下角垃圾桶一次清完';
    }
    $('bar-health').style.width = `${Math.max(0, f.health)}%`;
    $('bar-fed').style.width = `${Math.max(0, f.fullness)}%`;
    const acts = $('fish-actions');
    acts.hidden = false;
    acts.querySelectorAll('button').forEach((b) => {
      const act = b.getAttribute('data-act')!;
      let disabled = f.dead && act !== 'dispose';
      if (act === 'dispose') disabled = !f.dead;
      if (act === 'sell') disabled = f.dead || f.tank !== 2 || f.age < 20;
      if (act === 'pair') disabled = f.dead || f.age < 20;
      if (act === 'med-fungus' || act === 'med-ick') disabled = f.dead || f.sick !== (act === 'med-fungus' ? 'fungus' : 'ick');
      if (act === 'vitamin') disabled = f.dead || f.age < 0;
      if (act === 'move1') disabled = f.dead || !sim!.hasItem('tank2');
      (b as HTMLButtonElement).disabled = disabled;
    });
  } else {
    // v7.14：未选中鱼时，若缸里有鱼卵，底部信息栏直接显示倒计时（刷新页面也能看到）
    const tankAll = sim ? sim.tankFish(currentTank) : [];
    const eggList = tankAll.filter((f) => f.age < 0);
    const growing = tankAll.filter((f) => f.age >= 0 && f.age < ADULT_AGE && !f.dead);
    const deadInTank = tankAll.filter((f) => f.dead).length;
    if (eggList.length > 0) {
      const left = Math.ceil(Math.max(...eggList.map((f) => -f.age)) * YEAR_SECONDS);
      $('info-name').textContent = `鱼卵 × ${eggList.length}`;
      $('info-status').textContent = 'Status: 孵化中';
      $('info-status').className = '';
      $('info-age').textContent = `Age: 孵化中（剩余 ${left} 秒）`
        + (growing.length > 0 ? ` · 另有 ${growing.length} 条鱼在成长` : '');
    } else if (deadInTank > 0) {
      $('info-name').textContent = `缸内有 ${deadInTank} 条死鱼`;
      $('info-status').textContent = 'Status: 已死亡';
      $('info-status').className = 'sick';
      $('info-age').textContent = '点右下角 🗑 垃圾桶可一键清理（死鱼会持续增加污染）';
    } else if (growing.length > 0) {
      const nearest = Math.min(...growing.map((f) => ADULT_AGE - f.age));
      $('info-name').textContent = `成长中 ${growing.length} 条鱼`;
      $('info-status').textContent = 'Status: 幼鱼期';
      $('info-status').className = 'pregnant';
      $('info-age').textContent = `最近一条再有 ${Math.ceil(nearest * YEAR_SECONDS)} 秒成年`;
    } else {
      $('info-name').textContent = '— 点击一条鱼查看 —';
      $('info-status').textContent = 'Status: —';
      $('info-status').className = '';
      $('info-age').textContent = 'Age: —';
    }
    $('bar-health').style.width = '100%';
    $('bar-fed').style.width = '100%';
    $('fish-actions').hidden = true;
  }

  // 缸标签
  const tab2 = $('tab-tank2') as HTMLButtonElement;
  tab2.disabled = !sim.hasItem('tank2');
  document.querySelectorAll('.bubble-tab').forEach((el) => {
    el.classList.toggle('on', Number(el.getAttribute('data-tank')) === currentTank);
  });
  document.querySelectorAll('.speed-mini button').forEach((el) => {
    el.classList.toggle('on', Number(el.getAttribute('data-speed')) === sim!.speed);
  });

  // 鱼店信息
  if (currentTank === 2) {
    const saleAdults = sim.tankFish(2).filter((f2) => !f2.dead && f2.age >= 20);
    $('sale-count').textContent = String(saleAdults.length);
    $('sale-price').textContent = saleAdults.length > 0
      ? `$${sim.sellPrice(saleAdults[0])}${saleAdults.length > 1 ? '+' : ''}`
      : `$${Math.round(20 * sim.priceScale)}`;
  }
}

// ---------- 交互 ----------
function pickFish(mx: number, my: number): FishState | null {
  if (!sim) return null;
  let best: FishState | null = null;
  let bestD = 48 * 48;
  for (const f of sim.tankFish(currentTank)) {
    const s = swims.get(f.id);
    if (!s) continue;
    const d = (s.x - mx) ** 2 + (s.y - my) ** 2;
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

// 手册 Tips（点击鱼店海报循环显示）
const STORE_TIPS = [
  '研究"鱼缸环境"！否则脆弱的杂交鱼会慢慢死亡',
  '鱼卖得太快说明定价太低；没人买说明定价太高',
  '研究广告学能吸引更多顾客光临你的鱼店',
  '魔法鱼的增益只对同缸且活着的鱼生效',
  '同品种的两条鱼配对，后代不会失去健康',
  '拖拽缸里的水草、沉木和岩石，可以把它们摆到任意位置',
  '开局先喂熟你选的鱼卵孵出的鱼，攒钱再研究',
];
let tipIdx = 0;

canvas.addEventListener('click', (e) => {
  if (!sim || modalOpen()) return;
  if (screensaver) { exitScreensaver(); return; }
  const rect = canvas.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const my = ((e.clientY - rect.top) / rect.height) * canvas.height;
  // 拖拽装饰后的 click：不选鱼
  if (decorDragged) { decorDragged = false; return; }
  // 鱼店海报 → 提示（手册：If you click on the fish poster of the fish store you find additional tips）
  if (currentTank === 2) {
    const nx = mx / canvas.width, ny = my / canvas.height;
    if (nx >= POSTER_RECT.x0 && nx <= POSTER_RECT.x1 && ny >= POSTER_RECT.y0 && ny <= POSTER_RECT.y1) {
      Sfx.click();
      toast(`💡 ${STORE_TIPS[tipIdx++ % STORE_TIPS.length]}`, 'info');
      return;
    }
  }
  const f = pickFish(mx, my);
  if (!f) return;
  Sfx.click();
  if (pairModeId !== null && pairModeId !== f.id) {
    const err = sim.pairFish(pairModeId, f.id);
    if (err) { toast(err, 'bad'); Sfx.error(); }
    else { toast('💘 母鱼已怀孕！0.4 年后产仔', 'good'); Sfx.born(); }
    pairModeId = null;
    $('pair-hint').hidden = true;
    selectedId = f.id;
  } else {
    selectedId = f.id;
  }
  refreshHud();
});

// ---------- 拖拽装饰（手册：Customizable Tanks — place your ornaments where you like most） ----------
let decorDrag: { kind: 'plant' | 'wood' | 'rock'; idx: number; offX: number; offY: number; downX: number; downY: number } | null = null;
let decorDragged = false;
let decorRebuildT = 0;

function canvasXY(e: { clientX: number; clientY: number }): { mx: number; my: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    mx: ((e.clientX - rect.left) / rect.width) * canvas.width,
    my: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function decorHitTest(mx: number, my: number): { kind: 'plant' | 'wood' | 'rock'; idx: number } | null {
  const d = decors[currentTank];
  const w = canvas.width, h = canvas.height;
  // 前层植物（z 大优先）
  const order = d.plants.map((p, i) => ({ p, i })).sort((a, b) => b.p.z - a.p.z);
  for (const { p, i } of order) {
    if (p.z >= 0.45 && Math.abs(p.x * w - mx) < 36 && my > h - p.h * h - 36) return { kind: 'plant', idx: i };
  }
  for (let i = d.woods.length - 1; i >= 0; i--) {
    const wd = d.woods[i];
    if (Math.abs(wd.x * w - mx) < 95 && Math.abs(wd.y * h - 30 - my) < 62) return { kind: 'wood', idx: i };
  }
  for (let i = d.rocks.length - 1; i >= 0; i--) {
    const r = d.rocks[i];
    if (Math.abs(r.x * w - mx) < r.w * w * 0.62 && Math.abs(r.y * h - r.h * h * 0.45 - my) < r.h * h * 0.9) return { kind: 'rock', idx: i };
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (!sim || modalOpen() || screensaver || currentTank === 2) return;
  const { mx, my } = canvasXY(e);
  const hit = decorHitTest(mx, my);
  if (!hit) return;
  const d = decors[currentTank];
  const curX = hit.kind === 'plant' ? d.plants[hit.idx].x : hit.kind === 'wood' ? d.woods[hit.idx].x : d.rocks[hit.idx].x;
  const curY = hit.kind === 'plant' ? 0 : hit.kind === 'wood' ? d.woods[hit.idx].y : d.rocks[hit.idx].y;
  decorDrag = {
    kind: hit.kind, idx: hit.idx,
    offX: mx - curX * canvas.width,
    offY: my - curY * canvas.height,
    downX: mx, downY: my,
  };
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!decorDrag) return;
  const { mx, my } = canvasXY(e);
  if (Math.abs(mx - decorDrag.downX) + Math.abs(my - decorDrag.downY) > 5) decorDragged = true;
  if (!decorDragged) return;
  const d = decors[currentTank];
  const nx = Math.max(0.04, Math.min(0.96, (mx - decorDrag.offX) / canvas.width));
  if (decorDrag.kind === 'plant') {
    d.plants[decorDrag.idx].x = nx;
  } else if (decorDrag.kind === 'wood') {
    d.woods[decorDrag.idx].x = nx;
    d.woods[decorDrag.idx].y = Math.max(0.72, Math.min(0.95, (my - decorDrag.offY) / canvas.height));
  } else {
    d.rocks[decorDrag.idx].x = nx;
    d.rocks[decorDrag.idx].y = Math.max(0.8, Math.min(0.97, (my - decorDrag.offY) / canvas.height));
  }
  if (gameTime - decorRebuildT > 0.12) { d.layer = null; decorRebuildT = gameTime; } // 节流重建静态层
});
canvas.addEventListener('pointerup', () => {
  if (!decorDrag) return;
  const d = decors[currentTank];
  d.layer = null; // 最终重建
  const key = `${currentTank}:${decorDrag.kind}:${decorDrag.idx}`;
  if (decorDrag.kind === 'plant') {
    decorOv[key] = { x: d.plants[decorDrag.idx].x };
  } else if (decorDrag.kind === 'wood') {
    decorOv[key] = { x: d.woods[decorDrag.idx].x, y: d.woods[decorDrag.idx].y };
  } else {
    decorOv[key] = { x: d.rocks[decorDrag.idx].x, y: d.rocks[decorDrag.idx].y };
  }
  saveDecorOverrides(decorOv);
  if (decorDragged) toast('🪸 装饰已重新摆放（刷新后仍会保留）', 'info');
  decorDrag = null;
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (screensaver) { exitScreensaver(); return; }
    pairModeId = null;
    $('pair-hint').hidden = true;
    closeModal();
  }
});

// 底部操作按钮
$('fish-actions').addEventListener('click', (e) => {
  if (!sim || selectedId === null) return;
  const act = (e.target as HTMLElement).getAttribute('data-act');
  if (!act) return;
  const f = sim.fishById(selectedId);
  if (!f) return;
  let err: string | null = null;
  switch (act) {
    case 'pair':
      pairModeId = f.id;
      $('pair-hint').hidden = false;
      return;
    case 'move0': err = sim.moveFish(f.id, 0); break;
    case 'move1': err = sim.moveFish(f.id, 1); break;
    case 'move2': err = sim.moveFish(f.id, 2); break;
    case 'sell': err = sim.sellNow(f.id); if (!err) { Sfx.sell(); selectedId = null; } else Sfx.error(); break;
    case 'med-fungus': err = sim.useMedicine(f.id, 'fungus'); break;
    case 'med-ick': err = sim.useMedicine(f.id, 'ick'); break;
    case 'vitamin': err = sim.useVitamin(f.id); break;
    case 'dispose': err = sim.disposeFish(f.id); if (!err) { Sfx.dead(); selectedId = null; } break;
  }
  if (err) { toast(err, 'bad'); Sfx.error(); }
  refreshHud();
});

// 顶栏工具箱
$('quick-feed').addEventListener('click', () => {
  if (!sim) return;
  const err = sim.feedTank(currentTank);
  if (err) { toast(err, err.includes('满') ? 'info' : 'bad'); Sfx.error(); } else { Sfx.feed(); toast('🥫 已投喂当前鱼缸', 'good'); }
  refreshHud();
});
function quickMed(kind: 'fungus' | 'ick'): void {
  if (!sim || selectedId === null) { toast('请先点选一条生病的鱼', 'info'); return; }
  const err = sim.useMedicine(selectedId, kind);
  if (err) { toast(err, 'bad'); Sfx.error(); } else { toast('💊 用药成功，鱼恢复了！', 'good'); Sfx.born(); }
  refreshHud();
}
$('quick-med-fungus').addEventListener('click', () => quickMed('fungus'));
$('quick-med-ick').addEventListener('click', () => quickMed('ick'));
$('quick-vitamin').addEventListener('click', () => {
  if (!sim || selectedId === null) { toast('请先点选一条鱼', 'info'); return; }
  const err = sim.useVitamin(selectedId);
  if (err) { toast(err, 'bad'); Sfx.error(); } else toast('🍶 维生素已使用 (+30 健康)', 'good');
  refreshHud();
});

// 缸切换（气泡标签）
document.querySelectorAll('.bubble-tab').forEach((el) => {
  el.addEventListener('click', () => {
    if (!sim) return;
    const t = Number(el.getAttribute('data-tank')) as TankId;
    if (t === 1 && !sim.hasItem('tank2')) { toast('二号缸需要先在商店购买（$450）', 'info'); return; }
    switchView(t);
    Sfx.click();
  });
});
function switchView(t: TankId): void {
  currentTank = t;
  selectedId = null;
  // 进入出售缸时预填充人群（官方店景即有 30+ 顾客，不等自然积攒）
  if (t === 2 && customers.length < 12) {
    for (let i = customers.length; i < 22; i++) customers.push(spawnCustomer(Math.random)); // v6.9：店内人口更密集
  }
  applyView();
  syncSwims();
  refreshHud();
}
// 速度
document.querySelectorAll('.speed-mini button').forEach((el) => {
  el.addEventListener('click', () => {
    if (!sim) return;
    sim.speed = Number(el.getAttribute('data-speed'));
    refreshHud();
    Sfx.click();
  });
});
// 底部按钮
$('btn-supplies').addEventListener('click', () => {
  if (!sim) return;
  Sfx.click();
  openModal(() => openSupplies(sim!, onBuyItem, onBuyResearch));
});
$('btn-species').addEventListener('click', () => {
  if (!sim) return;
  Sfx.click();
  openModal(() => openSpecies(sim!, () => {}));
});
$('btn-sellfish').addEventListener('click', () => {
  if (!sim) return;
  Sfx.click();
  switchView(2);
});
$('btn-store-done').addEventListener('click', () => {
  Sfx.click();
  switchView(0);
});
$('btn-menu').addEventListener('click', () => {
  if (!sim) return;
  Sfx.click();
  openModal(() => openMenu(
    () => { $('help-overlay').hidden = false; },
    () => openTrophy(sim!),
    sim!,
    () => { wipingSave = true; Sim.clearSave(); location.reload(); },
  ));
});
$('btn-trash').addEventListener('click', () => {
  if (!sim) return;
  const deads = sim.tankFish(currentTank).filter((f) => f.dead);
  if (deads.length === 0) { toast('当前缸没有死鱼', 'info'); return; }
  for (const d of deads) sim.disposeFish(d.id);
  Sfx.dead();
  toast(`🗑 已清理 ${deads.length} 条死鱼`, 'info');
  selectedId = null;
  refreshHud();
});

// 屏保模式
function enterScreensaver(): void {
  screensaver = true;
  $('tank-ui').hidden = true;
  $('store-ui').hidden = true;
  $('screensaver-exit').hidden = false;
}
function exitScreensaver(): void {
  screensaver = false;
  $('screensaver-exit').hidden = true;
  applyView();
}
$('btn-screensaver').addEventListener('click', enterScreensaver);

function onBuyItem(id: ItemId): void {
  if (!sim) return;
  const err = sim.buyItem(id, currentTank === 2 ? 0 : currentTank);
  if (err) { toast(err, 'bad'); Sfx.error(); }
  else { Sfx.buy(); toast(id.startsWith('egg_') ? '🥚 鱼卵已放入一号缸孵化' : '✅ 购买成功', 'good'); }
  refreshHud();
}
function onBuyResearch(id: ResearchId): void {
  if (!sim) return;
  const err = sim.buyResearch(id);
  if (err) { toast(err, 'bad'); Sfx.error(); }
  else { Sfx.buy(); toast(`🔬 开始研究：${id}`, 'good'); }
  refreshHud();
}

$('btn-help-close').addEventListener('click', () => { $('help-overlay').hidden = true; });
$('btn-win-close').addEventListener('click', () => { $('win-overlay').hidden = true; });
window.addEventListener('fish2d-sfx', (e) => {
  if ((e as CustomEvent).detail === 'click') Sfx.click();
});

// ---------- 开局 ----------
function showStartPicker(): void {
  const box = $('starter-picks');
  box.innerHTML = '';
  const picks: number[] = [];
  FOUNDERS.forEach((fd, i) => {
    const card = document.createElement('div');
    card.className = 'starter-card';
    card.innerHTML = `<div class="sex">${i % 2 === 0 ? '♀ 雌' : '♂ 雄'}</div>`;
    card.appendChild(fishPortrait(fd.sp, fd.fin, 100, 48, 0.85));
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = fd.cn;
    card.appendChild(nm);
    card.addEventListener('click', () => {
      const idx = picks.indexOf(i);
      if (idx >= 0) picks.splice(idx, 1);
      else if (picks.length < 2) picks.push(i);
      else { picks.shift(); picks.push(i); }
      box.querySelectorAll('.starter-card').forEach((c) => c.classList.remove('pick'));
      picks.forEach((p) => box.children[p].classList.add('pick'));
      const btn = $('btn-start') as HTMLButtonElement;
      btn.disabled = picks.length !== 2;
      btn.textContent = picks.length === 2 ? `以 ${FOUNDERS[picks[0]].cn} + ${FOUNDERS[picks[1]].cn} 鱼卵开始` : '选择 2 份鱼卵后开始';
      Sfx.click();
    });
    box.appendChild(card);
  });
  $('btn-start').addEventListener('click', () => {
    if (picks.length !== 2) return;
    startNewGame([picks[0], picks[1]]);
  });
}

function startNewGame(picks: [number, number]): void {
  wipingSave = false;        // v7.6：新档创建完成，恢复正常自动存档
  sim = new Sim(simEvents, makeRng(), picks);
  currentTank = 0;
  selectedId = null;
  swims = new Map();
  prevSaleFish = new Map();
  prevSaleIds = new Set();
  applyView();
  syncSwims();
  $('start-overlay').hidden = true;
  refreshHud();
  toast('🎣 欢迎来到伊苏拉鱼店！鱼卵很快孵化（约 3 分钟），成年（20 岁）后配对繁殖', 'gold');
}

// ---------- 主循环 ----------
let lastT = performance.now();
let saveTimer = 0;
let hudTimer = 0;

function loop(now: number): void {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  gameTime += dt;
  if (sim) {
    sim.update(dt);
    syncSwims();
    if (currentTank === 2) {
      const maxCrowd = 34 + sim.research.ad * 6;
      // v6.9：按"在店人数"补齐（此前只在 applyView 里补，setView 不走该分支 → 店里只有 3-4 人）
      const inStore = customers.filter((c) => c.x > 30 && c.x < 1050).length;
      const target = Math.min(maxCrowd, 32 + sim.research.ad * 2);
      if (inStore < target) {
        let guard = 0;
        const recentVariants = customers.slice(-4).map((c) => c.variant);  // 造型去重：避免并排出现同一素材
        const batchVariants = [...recentVariants];
        while (inStore + guard < target && guard < 14) {
          const c = spawnCustomer(Math.random, batchVariants);
          batchVariants.push(c.variant);                  // 同批次内也去重，杜绝 4 个连排重影
          const seg = (customers.length + guard) % 3;
          c.x = 205 + seg * 200 + Math.random() * 190;      // 活动区：柜台右侧 ~ 门框左侧
          c.y = 330 + Math.random() * 245;                     // 覆盖整个中部空地
          c.pauseT = 0.5 + Math.random() * 4.5;           // 先驻足浏览，再走
          customers.push(c);
          guard++;
        }
      } else {
        spawnTimer -= dt;
        if (spawnTimer < 0 && customers.length < maxCrowd) {
          customers.push(spawnCustomer(Math.random, customers.slice(-4).map((c) => c.variant)));
          spawnTimer = Math.max(0.3, 1.1 - sim.research.ad * 0.18);
        }
      }
      updateCustomers(customers, dt, Math.random);
      updateOutsidePeople(dt, Math.random, 16 + Math.floor(Math.random() * 5));
      trackSales();
    }
    updateBubbles(bubbles[currentTank], dt, canvas.width, canvas.height);
    updateSwims(dt);
    render();
    if (!screensaver) renderIsoTank(dt);
    hudTimer += dt;
    if (hudTimer > 0.25) { hudTimer = 0; refreshHud(); }
    saveTimer += dt;
    if (saveTimer > 5) { saveTimer = 0; sim.save(); }
  } else {
    updateBubbles(bubbles[0], dt, canvas.width, canvas.height);
    drawTankBackground(ctx, canvas.width, canvas.height, decors[0], bubbles[0], gameTime);
  }
  requestAnimationFrame(loop);
}

// ---------- 启动 ----------
function boot(): void {
  const loaded = Sim.load(simEvents, makeRng());
  if (loaded) {
    sim = loaded;
    $('start-overlay').hidden = true;
    applyView();
    syncSwims();
    lastSoldCount = sim.stats.sold;
    prevSaleIds = new Set(sim.tankFish(2).map((f) => f.id));
    refreshHud();
    toast('存档已恢复（鱼在你离开时继续长大了）', 'info');
  } else {
    showStartPicker();
  }
  requestAnimationFrame(loop);
}
boot();

// v7.6：清档期间禁止自动存档——否则 location.reload() 触发的 beforeunload
// 会把旧存档（含死鱼与旧现金）再写回去，等于清档被自己撤销
let wipingSave = false;
window.addEventListener('beforeunload', () => { if (!wipingSave) sim?.save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !wipingSave) sim?.save(); });

// ---------- 测试钩子 ----------
declare global {
  interface Window {
    __FISH2D__: {
      sim: () => Sim | null;
      hooks: {
        newGame: (a?: number, b?: number) => void;
        getState: () => unknown;
        customers: () => Array<{ x: number; y: number; v: number; pause: boolean }>;
        forceAge: (age: number) => void;
        pairFirstTwo: () => string | null;
        moveToSale: (n: number) => void;
        growAll: () => void;
        addMoney: (n: number) => void;
        setSpeed: (s: number) => void;
        feedTank: () => void;
        setView: (t: TankId) => void;
        pickFishAt: (fx: number, fy: number) => number | null;
      };
      diag: () => unknown;
    };
  }
}

window.__FISH2D__ = {
  sim: () => sim,
  hooks: {
    newGame(a = 0, b = 1) {
      wipingSave = true;      // v7.6：清档后立即重建，禁止旧状态被自动存档写回
      Sim.clearSave();
      startNewGame([a, b]);
    },
    getState() { return sim?.snapshot() ?? null; },
    customers() { return customers.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), v: c.variant, pause: c.pauseT > 0 })); },
    forceAge(age: number) {
      if (!sim) return;
      for (const f of sim.fish) f.age = age;
      for (const f of sim.fish) (sim as unknown as { markDiscovered(f: FishState): void })['markDiscovered'](f);
    },
    pairFirstTwo() {
      if (!sim) return null;
      const adults = sim.tankFish(currentTank).filter((f) => !f.dead && f.age >= 20);
      if (adults.length < 2) return '不足两条成年鱼';
      return sim.pairFish(adults[0].id, adults[1].id);
    },
    moveToSale(n: number) {
      if (!sim) return;
      const candidates = sim.tankFish(0).filter((f) => !f.dead && f.age >= 20);
      for (let i = 0; i < Math.min(n, candidates.length); i++) sim.moveFish(candidates[i].id, 2);
      syncSwims();
    },
    growAll() {
      if (!sim) return;
      for (const f of sim.fish) if (!f.dead) f.age = Math.max(f.age, 20);
    },
    addMoney(n: number) { if (sim) sim.money += n; },
    setSpeed(s: number) { if (sim) sim.speed = s; },
    feedTank() { sim?.feedTank(currentTank); },
    setView(t: TankId) { switchView(t); },
    pickFishAt(fx: number, fy: number) {
      const f = pickFish(fx * canvas.width, fy * canvas.height);
      return f?.id ?? null;
    },
  },
  diag() {
    if (!sim) return { ready: false };
    return {
      ready: true,
      view: currentTank,
      years: sim.years,
      money: sim.money,
      fishCount: sim.fish.length,
      discovered: sim.discovered.size,
      magic: sim.magicFound.length,
      tankFood: sim.tanks[currentTank].food,
      fouling: sim.tanks[currentTank].fouling,
      customers: customers.length,
      screensaver,
    };
  },
};

void fishScale;
