// 鱼店销售场景：店内地板/背墙货架鱼缸、往来顾客（成型小人：发型/服装/裤鞋/走路摆臂）、
// 思想泡泡（鱼/$/?/♥）、SOLD 记录 —— 参照原作 Fish Store 截图
import { drawFish } from './fishart';
import { ISO, drawIsoFloor, drawIsoWalls, drawIsoShelf, drawIsoCounter, drawIsoDoorArea, drawTwoTierCabinet, drawFishPoster, isoShadow, isoScale } from './store';
import { mulberry } from './tank';
import { PERSON_SPRITES, personSpritesReady, WALK_VARIANT_COUNT, SHOP_PROPS, SHOP_DOOR } from './decorsprites';
const BOSS_CLERK = SHOP_PROPS.boss;
const ITEM_WALLET = SHOP_PROPS.wallet;
const ITEM_PLANT = SHOP_PROPS.plant;
const ITEM_FOOD = SHOP_PROPS.foodCan;

export type Customer = {
  x: number; y: number; vx: number;
  body: string; bodyDark: string; pants: string; hair: string; skin: string;
  hairStyle: number; // 0短发 1波波头 2帽子 3光头胡茬 4长发
  variant: number; // sprite 造型索引（0..10）
  h: number;
  phase: number;
  bubble: 'fish' | 'money' | 'quest' | 'heart' | null;
  bubbleT: number;
  pauseT: number;   // 店内浏览停留倒计时（站着看鱼，不走）
  facing: 1 | -1;  // 朝向（固定，不逐帧翻转）
  step: number;    // 步态相位（由位移驱动，与速度无关）
};

export type SoldRecord = { name: string; price: number; t: number };

/** 展示缸样品鱼（出售缸为空时用，保证陈列缸有鱼） */
/** 9 组差异明显的样品鱼：sp 决定体型、fin 决定颜色与花纹 */
const DEMO_TANK_FISH = [
  { sp: 1, fin: 1, age: 20 },    { sp: 4, fin: 2, age: 20 },    { sp: 7, fin: 3, age: 20 },
  { sp: 10, fin: 4, age: 20 },   { sp: 13, fin: 5, age: 20 },   { sp: 16, fin: 6, age: 20 },
  { sp: 19, fin: 7, age: 20 },   { sp: 21, fin: 8, age: 20 },   { sp: 2, fin: 9, age: 20 },
  { sp: 5, fin: 10, age: 20 },   { sp: 8, fin: 11, age: 20 },   { sp: 11, fin: 12, age: 20 },
  { sp: 14, fin: 13, age: 20 },  { sp: 17, fin: 14, age: 20 },  { sp: 20, fin: 15, age: 20 },
  { sp: 3, fin: 16, age: 20 },   { sp: 6, fin: 17, age: 20 },   { sp: 9, fin: 18, age: 20 },
  { sp: 12, fin: 19, age: 20 },  { sp: 15, fin: 20, age: 20 },  { sp: 18, fin: 21, age: 20 },
  { sp: 21, fin: 2, age: 20 },   { sp: 10, fin: 12, age: 20 },  { sp: 4, fin: 16, age: 20 },
];

/** 门外等候区：灰色台阶上挤着想进店的人（参考图右侧门外人群） */
export type OutsidePerson = { x: number; y: number; v: number; bob: number; step: number };
export const outsidePeople: OutsidePerson[] = [];

export function updateOutsidePeople(dt: number, rand: () => number, count: number): void {
  // 门外队列：两列纵队排在台阶上，队首缓慢向门口蠕动（绝不"到处跑"）
  while (outsidePeople.length < count) {
    const i = outsidePeople.length;
    const lane = i % 2;            // 两列
    const rank = Math.floor(i / 2);// 队列序号
    outsidePeople.push({
      x: 0.930 + lane * 0.036 + rank * 0.004,  // 横向：两列
      y: 0.30 + rank * 0.075 + lane * 0.04,     // 纵深：沿台阶往下排（容纳更多人）
      v: (i * 3 + 2) % WALK_VARIANT_COUNT,
      bob: rand() * Math.PI * 2,
      step: rand() * Math.PI * 2,
    });
  }
  while (outsidePeople.length > count) outsidePeople.pop();
  for (let i = 0; i < outsidePeople.length; i++) {
    const p = outsidePeople[i];
    p.bob += dt * 0.9;
    // 步态由实际位移驱动（与店内顾客同机制），移动速度同量级 26-44px/s
    const targetX = 0.930 + (i % 2) * 0.036 + Math.floor(i / 2) * 0.004;
    const dx = (targetX - p.x) * Math.min(1, dt * 0.6);
    p.x += dx;
    p.step += Math.abs(dx) * 0.075;
    p.bob = p.step;                              // 与店内一致：步态=位移驱动
    if (i < 2) p.x -= dt * 0.012;               // 队首缓慢向门口挪（26-44px/s 量级）
    p.x = Math.max(0.892, p.x);
  }
}

/** 海报区域（相对坐标）——手册：点击鱼店的鱼海报可查看额外提示 */
export const POSTER_RECT = { x0: 0.135, y0: 0.06, x1: 0.305, y1: 0.3 };

const SHIRTS: Array<[string, string]> = [
  ['#d65848', '#a03024'], ['#4878d8', '#2c4c98'], ['#48a058', '#2c7038'],
  ['#d8a83c', '#9a7020'], ['#9a50cc', '#6a2c96'], ['#d07838', '#984c1c'],
  ['#38a898', '#207064'], ['#d05888', '#983258'], ['#5858c8', '#383890'],
];
const PANTS = ['#3a4a6a', '#4a3a30', '#2c3a2c', '#5a4a3a', '#3a3a44'];
const HAIRS = ['#2a2018', '#54341c', '#7a4a20', '#a8722c', '#1a1a1a', '#8a8078', '#b83828'];
const SKINS = ['#f2cba0', '#e8b888', '#d09c68', '#b07c50'];

export function spawnCustomer(rand: () => number, avoid: number[] = []): Customer {
  const [body, bodyDark] = SHIRTS[Math.floor(rand() * SHIRTS.length)];
  const fromLeft = rand() < 0.5;
  const y = 330 + rand() * 215;
  // v6.9：步行速度 26-44 px/s（悠闲逛店，不再快走）
  const speed = 26 + rand() * 18;
  return {
    x: fromLeft ? -60 - rand() * 420 : 900 + rand() * 380,
    y,
    vx: (fromLeft ? 1 : -1) * speed,
    step: rand() * Math.PI * 2,
    facing: fromLeft ? 1 : -1,
    pauseT: 0,
    body, bodyDark,
    pants: PANTS[Math.floor(rand() * PANTS.length)],
    hair: HAIRS[Math.floor(rand() * HAIRS.length)],
    skin: SKINS[Math.floor(rand() * SKINS.length)],
    hairStyle: Math.floor(rand() * 5),
  variant: Math.floor(rand() * 11), // v6.1：11 种人物造型（老人/小孩/学生/上班族…）
    // v4：官方是小卡通人（25-45px、2.5 头身），近大远小弱透视
    h: 27 + (y - 320) * 0.088,
    phase: rand() * Math.PI * 2,
    bubble: rand() < 0.62 ? (['fish', 'heart', 'quest'] as const)[Math.floor(rand() * 3)] : null,
    bubbleT: 2 + rand() * 6,
  };
}

// 左侧柜台的右边界（顾客不可越过；对照参考图：柜台沿左墙长条布置）
const COUNTER_RIGHT = 186;   // 柜台右缘：顾客活动区左界

export function updateCustomers(list: Customer[], dt: number, rand: () => number): void {
  for (const c of list) {
    if (c.pauseT > 0) {
      // 店内停留：站在货架前看鱼（不位移，步态静止）
      c.pauseT -= dt;
      c.phase = 0;
    } else {
      const dx = c.vx * dt;
      c.x += dx;
      c.step += Math.abs(dx) * 0.075;  // 步态与实际位移绑定：走多快就摆多快
      c.phase = c.step;
      // 到店中部随机停留一下，模拟浏览（营造"逛店"节奏而非直穿）
      if (c.x > 120 && c.x < 840 && rand() < dt * 0.16) c.pauseT = 1.2 + rand() * 3.2;
    }
    c.bubbleT -= dt;
    if (c.bubbleT < 0) {
      c.bubble = c.bubble ? null : rand() < 0.6 ? (['fish', 'money', 'quest', 'heart'] as const)[Math.floor(rand() * 4)] : null;
      c.bubbleT = 1.5 + rand() * 5;
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i];
    if (c.x < -120 || c.x > 1040) { list.splice(i, 1); continue; }
    // 柜台碰撞：走到柜台左侧时停住（不能穿过柜台）
    if (c.x < COUNTER_RIGHT) {
      c.x = COUNTER_RIGHT;            // 硬边界：任何情况都不进入柜台区域
      if (c.vx < 0) { c.vx = Math.abs(c.vx); c.facing = 1; }
    }
  }
}

/** 绘制整个鱼店场景 */
export function drawStore(
  ctx: CanvasRenderingContext2D, w: number, h: number, time: number,
  customers: Customer[], saleFish: Array<{ sp: number; fin: number; age: number }>,
  soldFeed: SoldRecord[],
): void {
  const floorY = h * 0.55;

  // ==================== 等距场景（v7.0，对照 references/fish_store.jpg）====================
  const y0 = h * ISO.horizon;
  // 分层渲染表：按 y 排序后绘制，保证"近处遮挡远处"（原版核心观感）
  const layers: Array<{ y: number; draw: () => void }> = [];
  drawIsoFloor(ctx, w, h);
  drawIsoWalls(ctx, w, h);

  // 右侧门 + 门外台阶（先画，作为最远层）
  drawIsoDoorArea(ctx, w, h, SHOP_DOOR);

  // 背墙元素：Know Your Fish 海报 + 洗手池 + 灯箱
  // 右上角鱼缸货架：加入 y 排序表（与顾客共同按远近排序，远处顾客被货架正确遮挡）
  // v7.7：鱼缸墙贴背墙、右侧留出 SALE 牌与门（原版布局：缸只占中上，右边是门）
  // v7.24：鱼缸缩小并上移贴北墙；左边界避开壁画(到0.20)，右边界避开门(到0.76)
  const shelfX = w * 0.255, shelfY0 = y0 - h * 0.10, shelfW = w * 0.455, shelfH = h * 0.145;
  layers.push({ y: shelfY0 + shelfH, draw: () => drawIsoShelf(ctx, shelfX, shelfY0, shelfW, shelfH,
    (tx, ty, tw2, th2, idx) => drawStoreTank(ctx, tx, ty, tw2, th2, saleFish, idx)) });

  // 海报（挂背墙）
  (() => {
    const px = w * 0.115, py = y0 - h * 0.30, pw = w * 0.145, ph = h * 0.24;
    ctx.fillStyle = '#f2f4f8';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#2a3a6a';
    ctx.font = 'bold 10px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Know Your Fish!', px + pw / 2, py + 15);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.translate(px + pw * (0.22 + (i % 3) * 0.28), py + ph * (0.36 + Math.floor(i / 3) * 0.32));
      ctx.scale(0.26, 0.26);
      drawFish(ctx, { sp: 1 + ((i * 5) % 21), fin: 1 + ((i * 3) % 21), age: 20, pregnant: 0, sick: null, dead: false }, 0, 0, 0, false);
      ctx.restore();
    }
    ctx.strokeStyle = '#8894b8'; ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
  })();

  // 鱼缸左侧：两层靠墙柜（上层小鱼缸养鱼 / 下层摆鱼瓶药品鱼粮，对照原版）
  drawTwoTierCabinet(ctx, w * 0.16, y0 - h * 0.215, w * 0.075, h * 0.165,
    (c, f, x2, y2, t2, sel2) => drawFish(c, { sp: f.sp, fin: f.fin, age: f.age, pregnant: 0, sick: null, dead: false }, x2, y2, t2, sel2));

  // 左墙上：鱼的海报（两张，斜贴在左墙面上）
  drawFishPoster(ctx, w * 0.012, y0 - h * 0.40, w * 0.058, h * 0.105, saleFish,
    (c, f, x2, y2, t2, sel2) => drawFish(c, { sp: f.sp, fin: f.fin, age: f.age, pregnant: 0, sick: null, dead: false }, x2, y2, t2, sel2));
  drawFishPoster(ctx, w * 0.012, y0 - h * 0.275, w * 0.052, h * 0.092, saleFish,
    (c, f, x2, y2, t2, sel2) => drawFish(c, { sp: f.sp, fin: f.fin, age: f.age, pregnant: 0, sick: null, dead: false }, x2, y2, t2, sel2));

  // 柜台（又矮又窄的长条形，实心不透明，对照 fish_store.png）
  drawIsoCounter(ctx, w, h, BOSS_CLERK, {
    wallet: ITEM_WALLET, food: ITEM_FOOD, plant: ITEM_PLANT,
  });


  // SALE 招牌（挂在门内背墙）
  ctx.save();
  ctx.translate(w * 0.762, y0 - h * 0.215);
  ctx.transform(1, -0.09, 0, 1, 0, 0);
  const sg = ctx.createLinearGradient(0, 0, 0, 54);
  sg.addColorStop(0, '#e0563c');
  sg.addColorStop(1, '#9e2014');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, 62, 54);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, 0, 62, 3);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 19px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('SALE', 31, 26);
  ctx.font = 'bold 5.5px Verdana, sans-serif';
  ctx.fillText('EVERYTHING MUST GO!', 31, 38);
  ctx.restore();

  // 门外指示牌
  ctx.fillStyle = '#b02820';
  ctx.beginPath();
  ctx.moveTo(w * 0.855, h * 0.055);
  ctx.lineTo(w * 0.985, h * 0.025);
  ctx.lineTo(w * 0.985, h * 0.075);
  ctx.lineTo(w * 0.855, h * 0.105);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('FISH STORE', w * 0.92, h * 0.075);

    // ---- 顾客（近处遮挡远处） ----
  const sorted = [...customers].sort((a, b) => a.y - b.y);
  for (const c of sorted) {
    // 等距：脚底落影 + 近大远小（入层排序）
    const ch = c.h * isoScale(c.y, 600);
    layers.push({ y: c.y, draw: () => {
      isoShadow(ctx, c.x, c.y, c.h * 0.34, 0.3);
      drawPerson(ctx, c.x, c.y, ch, c.body, c.bodyDark, c.pants, c.hair, c.skin, c.hairStyle, time, c.phase, c.pauseT <= 0, c.variant, c.vx >= 0 ? 1 : -1);
    } });
    const bub = c.bubble;
    if (bub) {
      layers.push({ y: c.y - 0.5, draw: () => drawThoughtBubble(ctx, c.x + (c.vx > 0 ? 14 : -14), c.y - ch - 6, bub, time) });
    }
  }

  // ---- 按 y 排序统一绘制（近处遮挡远处，等距核心观感）----
  layers.sort((a, b) => a.y - b.y);
  for (const L of layers) L.draw();

  // ---- SOLD 滚动记录 ----
  let fy = h - 16 - soldFeed.length * 20;
  for (const rec of soldFeed.slice(-4)) {
    ctx.fillStyle = 'rgba(24,52,30,0.82)';
    ctx.fillRect(w * 0.03, fy - 13, 200, 19);
    ctx.fillStyle = '#aef0ae';
    ctx.font = '11px Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SOLD  ${rec.name}  $${rec.price}`, w * 0.04, fy);
    fy += 20;
  }
}

function drawStoreTank(ctx: CanvasRenderingContext2D, x: number, y: number, tw: number, th: number, fish: Array<{ sp: number; fin: number; age: number }>, tankIdx = 0): void {
  // 木纹外框
  ctx.fillStyle = '#6a4a28';
  ctx.fillRect(x - 4, y - 4, tw + 8, th + 8);
  ctx.fillStyle = '#8a6840';
  ctx.fillRect(x - 4, y - 4, tw + 8, 5);
  // 水
  const g = ctx.createLinearGradient(0, y, 0, y + th);
  g.addColorStop(0, 'rgba(120,200,240,0.9)');
  g.addColorStop(1, 'rgba(60,140,210,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, tw, th);
  // 缸内装饰：小卵石+水草
  ctx.fillStyle = '#d8d0be';
  ctx.fillRect(x, y + th * 0.78, tw, th * 0.22);
  ctx.fillStyle = 'rgba(160,150,130,0.6)';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(x + ((i * 31 + 9) % tw), y + th * 0.85 + ((i * 7) % 6), 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2c8a3c';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const px = x + tw * (0.2 + i * 0.3);
    ctx.beginPath();
    ctx.moveTo(px, y + th * 0.82);
    ctx.quadraticCurveTo(px + 3, y + th * 0.6, px + 1, y + th * 0.45);
    ctx.stroke();
  }
  // 缸内小鱼：更小、朝向随机（按 id 决定方向）、分层游动
  // v7.25：出售缸为空时用"样品鱼"兜底，保证每个缸里都有鱼（原版陈列缸一直有展示鱼）
  // v7.27：每个缸专属 3 条鱼，24 个组合互不重复（不同缸的鱼明确不同）
  const base = (tankIdx * 3) % DEMO_TANK_FISH.length;
  const picked: Array<{ sp: number; fin: number; age: number }> = [];
  for (let k = 0; k < 3; k++) picked.push(DEMO_TANK_FISH[(base + k) % DEMO_TANK_FISH.length]);
  const useFish = fish.length > 0 ? fish : picked;
  for (let i = 0; i < useFish.length; i++) {
    const f = useFish[i];
    const dir = (i % 2 === 0) ? 1 : -1;                       // 一半向左一半向右
    const layer = i % 3;                                      // 前后三层，制造纵深
    const sp0 = 700 + layer * 430;
    const fx = x + tw * 0.5 + Math.sin(Date.now() / sp0 + i * 2.4) * tw * 0.22;
    const fy = y + th * (0.36 + layer * 0.15) + Math.cos(Date.now() / (sp0 * 1.3) + i) * th * 0.06;
    // 鱼缩到缸内能容纳的尺寸（原来 0.34 会铺满整个缸，看起来像一条白色横带）
    const fscale = Math.min(0.20, (tw * 0.30) / 110);
    ctx.save();
    ctx.translate(fx, fy);
    if (dir < 0) ctx.scale(-fscale, fscale); else ctx.scale(fscale, fscale);
    drawFish(ctx, { sp: f.sp, fin: f.fin, age: f.age, pregnant: 0, sick: null, dead: false }, 0, 0, Date.now() / 200 + i, false);
    ctx.restore();
  }
}

/** 小卡通人（v4 对齐官方 2.5 头身比例）：大头(0.26) / 短身 / 短腿 / 走路摆臂 */
function drawPerson(
  ctx: CanvasRenderingContext2D, x: number, y: number, hgt: number,
  body: string, bodyDark: string, pants: string, hair: string, skin: string,
  hairStyle: number, time: number, phase: number, walking: boolean, variant = 0, vxDir = 1,
): void {
  // v6：AI 生成写实顾客 sprite（素材就绪时优先），保留矢量小人作为回退
  if (personSpritesReady()) {
    const img = PERSON_SPRITES[variant % PERSON_SPRITES.length];
    if (img.complete && img.naturalWidth > 0) {
      const ph = hgt * 1.35;
      const pw = (img.naturalWidth / img.naturalHeight) * ph;
      // v6.9：去掉左右摇摆与倾斜——只保留极轻微的垂直重心起伏（走路本该有的）
      const bob2 = walking ? Math.abs(Math.sin(phase)) * 1.1 : 0;
      ctx.save();
      ctx.translate(x, y - bob2);
      // 向左行走时水平镜像素材（素材统一朝右），一次性切换、无逐帧抖动
      if (vxDir < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -pw / 2, -ph, pw, ph);
      ctx.restore();
      return;
    }
  }

  const legSwing = walking ? Math.sin(phase) * 3.4 : 0;
  const armSwing = walking ? Math.sin(phase + Math.PI) * 4 : 0;
  const bob = walking ? Math.abs(Math.sin(phase)) * 1.2 : 0;
  const top = y - hgt - bob;
  const headR = hgt * 0.26; // 大头身比（官方卡通小人）

  ctx.save();
  ctx.translate(x, 0);

  // 腿（裤色，短腿）+鞋
  ctx.strokeStyle = pants;
  ctx.lineWidth = hgt * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-hgt * 0.055, y - hgt * 0.3);
  ctx.lineTo(-hgt * 0.055 + legSwing, y - 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hgt * 0.055, y - hgt * 0.3);
  ctx.lineTo(hgt * 0.055 - legSwing, y - 1.5);
  ctx.stroke();
  // 鞋
  ctx.fillStyle = '#2a2a32';
  ctx.beginPath();
  ctx.ellipse(-hgt * 0.055 + legSwing + 1.2, y - 0.8, hgt * 0.075, hgt * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hgt * 0.055 - legSwing + 1.2, y - 0.8, hgt * 0.075, hgt * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // 躯干（衣服渐变，短身）
  const torsoTop = top + headR * 1.85;
  const torsoH = hgt * 0.34;
  const tg = ctx.createLinearGradient(0, torsoTop, 0, torsoTop + torsoH);
  tg.addColorStop(0, body);
  tg.addColorStop(1, bodyDark);
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.roundRect(-hgt * 0.15, torsoTop, hgt * 0.3, torsoH, hgt * 0.05);
  ctx.fill();
  // 衣领
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-hgt * 0.05, torsoTop, hgt * 0.1, hgt * 0.03);

  // 手臂（袖+手）
  ctx.strokeStyle = body;
  ctx.lineWidth = hgt * 0.06;
  ctx.beginPath();
  ctx.moveTo(-hgt * 0.13, torsoTop + hgt * 0.04);
  ctx.lineTo(-hgt * 0.2 - armSwing * 0.3, torsoTop + torsoH * 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hgt * 0.13, torsoTop + hgt * 0.04);
  ctx.lineTo(hgt * 0.2 + armSwing * 0.3, torsoTop + torsoH * 0.72);
  ctx.stroke();
  // 手（肤色小圆）
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(-hgt * 0.2 - armSwing * 0.3, torsoTop + torsoH * 0.75, hgt * 0.032, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hgt * 0.2 + armSwing * 0.3, torsoTop + torsoH * 0.75, hgt * 0.032, 0, Math.PI * 2);
  ctx.fill();

  // 头（肤色渐变，大头）
  const headY = top + headR;
  const hg = ctx.createRadialGradient(-headR * 0.3, headY - headR * 0.3, headR * 0.2, 0, headY, headR);
  hg.addColorStop(0, lightenCss(skin, 1.12));
  hg.addColorStop(1, skin);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  // 眼睛
  ctx.fillStyle = '#20202a';
  ctx.beginPath();
  ctx.arc(headR * 0.26, headY - headR * 0.05, headR * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(headR * 0.6, headY - headR * 0.05, headR * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // 发型
  ctx.fillStyle = hair;
  switch (hairStyle) {
    case 1: // 波波头
      ctx.beginPath();
      ctx.arc(0, headY - headR * 0.12, headR * 1.05, Math.PI * 0.86, Math.PI * 2.14);
      ctx.fill();
      ctx.fillRect(-headR * 1.0, headY - headR * 0.3, headR * 0.3, headR * 0.9);
      ctx.fillRect(headR * 0.7, headY - headR * 0.3, headR * 0.3, headR * 0.9);
      break;
    case 2: // 棒球帽
      ctx.fillStyle = bodyDark;
      ctx.beginPath();
      ctx.arc(0, headY - headR * 0.15, headR * 1.02, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      ctx.fillRect(headR * 0.3, headY - headR * 0.32, headR * 1.0, headR * 0.22);
      break;
    case 3: // 光头+胡茬
      ctx.fillStyle = 'rgba(60,50,40,0.4)';
      ctx.beginPath();
      ctx.arc(headR * 0.3, headY + headR * 0.42, headR * 0.5, 0, Math.PI);
      ctx.fill();
      break;
    case 4: // 长发
      ctx.beginPath();
      ctx.arc(0, headY - headR * 0.1, headR * 1.08, Math.PI * 0.78, Math.PI * 2.22);
      ctx.fill();
      ctx.fillRect(-headR * 1.06, headY - headR * 0.2, headR * 0.35, headR * 1.6);
      ctx.fillRect(headR * 0.71, headY - headR * 0.2, headR * 0.35, headR * 1.6);
      break;
    default: // 短发
      ctx.beginPath();
      ctx.arc(0, headY - headR * 0.12, headR * 1.02, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
  }

  ctx.restore();
}

function lightenCss(css: string, f: number): string {
  const m = css.match(/\w\w/g)!;
  const [r, g, b] = m.map((v) => Math.min(255, Math.round(parseInt(v, 16) * f)));
  return `rgb(${r},${g},${b})`;
}

function drawThoughtBubble(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, time: number): void {
  // v7.10：气泡内容统一为 💗 / ❓ 两种符号（原版如此），不再画鱼/$ 等导致出现"白色条"
  const r = 10;
  ctx.save();
  ctx.translate(x, y);
  const pulse = 1 + Math.sin(time * 2.2) * 0.045;
  ctx.scale(pulse, pulse);
  // 气泡体（白圆 + 灰边）
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = 'rgba(110,120,135,0.9)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 下方小泡（两个尾泡）
  ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.95, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-r * 0.85, r * 1.65, 2.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 内容：鱼 / 心 / 问号（原版三种）
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (kind === 'fish') {
    // 矢量小鱼：椭圆身 + 三角尾 + 圆眼（跨平台渲染一致）
    const fw = r * 1.05, fh = r * 0.62;
    ctx.fillStyle = '#3aa0e0';
    ctx.beginPath();
    ctx.ellipse(r * 0.12, 0, fw * 0.5, fh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();                       // 尾鳍
    ctx.moveTo(-fw * 0.34, 0);
    ctx.lineTo(-fw * 0.72, -fh * 0.42);
    ctx.lineTo(-fw * 0.72, fh * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f3b5c';              // 眼睛
    ctx.beginPath();
    ctx.arc(fw * 0.36, -fh * 0.06, 1.05, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'heart') {
    ctx.font = `${r}px Verdana, sans-serif`;
    ctx.fillStyle = '#e0407a';
    ctx.fillText('♥', 0, 1);
  } else {
    ctx.font = `bold ${Math.round(r * 1.25)}px Georgia, serif`;
    ctx.fillStyle = '#3f7fd0';
    ctx.fillText('?', 0, 1);
  }
  ctx.restore();
}
