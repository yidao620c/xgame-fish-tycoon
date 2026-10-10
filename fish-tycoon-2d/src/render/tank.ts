// 水族箱场景（写实向）：
// 静态层预渲染 = 逐颗卵石底床(带高光阴影) + 多切面岩石群 + 纹理沉木 + 丛生水草(渐变叶/侧脉)
// 动态层 = 顶部光柱 + 气泡流 + 水面波光
// v6：支持 AI 生成背景图（tank_bg）替换绘制式墙面+底砂
import { tankBgReady, getTankBg } from './fishsprites';
import { DECOR_SPRITES, decorSpritesReady } from './decorsprites';
export type Decor = {
  plants: Array<{ x: number; base: number; h: number; hue: 'green' | 'red' | 'broad'; seed: number; z: number }>;
  woods: Array<{ x: number; y: number; s: number; seed: number }>;
  rocks: Array<{ x: number; y: number; w: number; h: number; seed: number }>;
  shell: { x: number; y: number } | null;
  coral: { x: number; y: number } | null; // v6：珊瑚装饰
  gravelSeed: number;
  layer: HTMLCanvasElement | null; // 预渲染静态层
  bgMode?: boolean; // 静态层构建时是否为"背景图模式"（跳过绘制墙面+底砂）
  spritesUsed?: boolean; // 静态层是否由 sprite 造景构建（素材异步就绪后需重建）
};

export type Bubble = { x: number; y: number; r: number; v: number; col: number };

const TANK_W = 960, TANK_H = 600;

/** 依据缸号生成装饰布置（确定性） */
export function buildDecor(tank: number): Decor {
  const rand = mulberry(tank * 777 + 13);
  const plants: Decor['plants'] = [];
  const woods: Decor['woods'] = [];
  const rocks: Decor['rocks'] = [];
  // v6.8：9-11 丛（原版约 8-10 丛）；此前 12-14 丛过高过密会遮挡鱼群
  const clumps = 9 + Math.floor(rand() * 3);
  for (let i = 0; i < clumps; i++) {
    // 左右两侧密、中间稀，让鱼群有活动空间且始终可见
    // v7.20：避开中央大石头（0.34-0.68），水草只分布在左右两侧
    const side = rand();
    const x = side < 0.5 ? 0.03 + rand() * 0.26 : 0.70 + rand() * 0.27;
    // v7.2 对照 fish_tank1.png：主力是**圆叶丛（moneywort）**，配少量细长草；红色羽状草仅少量点缀
    const hue: 'green' | 'red' | 'broad' = i % 7 === 3 ? 'red' : i % 3 === 1 ? 'broad' : 'green';
    plants.push({ x, base: 0, h: 0.26 + rand() * 0.26, hue, seed: Math.floor(rand() * 1000), z: rand() });
  }
  // 单根居中大沉木（官方风格：一块主体占画面中心）
  const nw = 1;
  for (let i = 0; i < nw; i++) {
    woods.push({ x: 0.5, y: 0.84, s: 1.7 + rand() * 0.3, seed: Math.floor(rand() * 1000) });
  }
  // 大岩石群：中央一组（加大）+ 零散小块
  rocks.push({ x: 0.76 + (rand() - 0.5) * 0.05, y: 0.92, w: 0.34, h: 0.42, seed: Math.floor(rand() * 9999) });
  rocks.push({ x: 0.19 + rand() * 0.05, y: 0.93, w: 0.16, h: 0.22, seed: Math.floor(rand() * 9999) });

  const decor: Decor = {
    plants, woods, rocks,
    shell: rand() < 0.6 ? { x: 0.14 + rand() * 0.7, y: 0.95 } : null,
    coral: { x: 0.2 + rand() * 0.6, y: 0.93 },
    gravelSeed: Math.floor(rand() * 9999),
    layer: null,
  };
  return decor;
}

export function createBubbles(count: number): Bubble[] {
  const arr: Bubble[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, v: 0.02 + Math.random() * 0.05, col: i % 3 });
  }
  return arr;
}

export function updateBubbles(bubbles: Bubble[], dt: number, _w: number, h: number): void {
  for (const b of bubbles) {
    b.y -= b.v * dt;
    b.x += Math.sin(b.y * 12) * 0.0006;
    if (b.y < -0.05) { b.y = 1.05; b.x = Math.random(); }
  }
  void h;
}

/** 预渲染静态层（每个缸只做一次）；bgMode=true 时跳过墙面与底砂（由 AI 背景图提供） */
function buildLayer(decor: Decor, bgMode: boolean): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = TANK_W; cv.height = TANK_H;
  const ctx = cv.getContext('2d')!;
  const w = TANK_W, h = TANK_H;

  if (!bgMode) {
    // 背景墙（v4 官方亮蓝渐变，干净少纹）
    const wall = ctx.createLinearGradient(0, 0, 0, h);
    wall.addColorStop(0, '#4cc0f2');
    wall.addColorStop(0.55, '#2ea4e4');
    wall.addColorStop(1, '#1e8ed2');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    // 后壁细微水纹
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 10;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const yy = h * (0.15 + i * 0.12);
      for (let xx = 0; xx <= w; xx += 26) {
        const off = Math.sin(xx * 0.018 + i * 2.2) * 8;
        if (xx === 0) ctx.moveTo(xx, yy + off); else ctx.lineTo(xx, yy + off);
      }
      ctx.stroke();
    }
      drawGravel(ctx, w, h, decor.gravelSeed);
  }

  // v6：造景 sprite（水草/沉木/岩石/珊瑚/扇贝）——素材就绪时优先使用，否则回退矢量绘制
  const useSprites = decorSpritesReady();
  if (useSprites) {
    const drawImg = (img: HTMLImageElement, cx: number, bottom: number, targetH: number) => {
      if (!(img.complete && img.naturalWidth > 0)) return;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const dh = targetH;
      const dw = (iw / ih) * dh;
      ctx.drawImage(img, cx - dw / 2, bottom - dh, dw, dh);
    };
    const plants = [...decor.plants].sort((a, b) => a.z - b.z);
    for (const pl of plants) {
      // 绿色位现在用原版圆叶丛（moneywort），brown 位用细长草
      const img = pl.hue === 'red' ? DECOR_SPRITES.plantRed
        : pl.hue === 'broad' ? DECOR_SPRITES.valisneria
        : DECOR_SPRITES.moneywort;
      drawImg(img, pl.x * w, h * 0.9, pl.h * h * 1.15);
    }
    // 中央主景 = 三块大石头（两侧竖立 + 上面横放），其余位置用沉木
    for (const wd of decor.woods) {
      const isCenter = Math.abs(wd.x - 0.5) < 0.16;
      if (isCenter) {
        // v7.20：中央主石头放大到 0.95h（原 0.30h，约 3 倍）并加宽
        drawRock(ctx, wd.x * w, h * 0.90, h * ROCK_BIG_SCALE, h * ROCK_BIG_SCALE, wd.seed);
      } else {
        drawImg(DECOR_SPRITES.wood, wd.x * w, wd.y * h + h * 0.06, h * 0.2 * wd.s);
      }
    }
    if (decor.coral) drawImg(DECOR_SPRITES.coral, decor.coral.x * w, decor.coral.y * h, h * 0.16);
    if (decor.shell) drawImg(DECOR_SPRITES.shell, decor.shell.x * w, decor.shell.y * h, h * 0.075);
    // For Sale 木牌（原版缸内右侧标牌）
    const sx = w * 0.875, sy = h * 0.905;
    ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - h * 0.072); ctx.stroke();
    ctx.fillStyle = '#e0d2a8'; ctx.fillRect(sx - 36, sy - h * 0.072 - 26, 72, 30);
    ctx.strokeStyle = '#4a3216'; ctx.lineWidth = 2.5; ctx.strokeRect(sx - 36, sy - h * 0.072 - 26, 72, 30);
    ctx.fillStyle = '#4a3216'; ctx.font = 'bold 13px Verdana, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('For Sale!', sx, sy - h * 0.072 - 6);
    return cv;
  }
  // 后层水草（在岩石后）
  for (const pl of decor.plants) if (pl.z < 0.45) drawPlant(ctx, pl.x * w, h, pl.h * h, pl.hue, pl.seed);
  for (const wd of decor.woods) drawWood(ctx, wd.x * w, wd.y * h, wd.s, wd.seed);
  for (const r of decor.rocks) drawRock(ctx, r.x * w, r.y * h, r.w * w, r.h * h, r.seed);
  // 前层水草（在岩石前）
  for (const pl of decor.plants) if (pl.z >= 0.45) drawPlant(ctx, pl.x * w, h, pl.h * h, pl.hue, pl.seed);
  if (decor.shell) drawShell(ctx, decor.shell.x * w, decor.shell.y * h);
  return cv;
}

function drawGravel(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const rand = mulberry(seed);
  const top = h * 0.84;
  // 底床基色（v4：白色珊瑚砂，官方画面的提亮器）
  const g = ctx.createLinearGradient(0, top - 10, 0, h);
  g.addColorStop(0, '#f4f1e8');
  g.addColorStop(1, '#cfc6b2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, top + 8);
  for (let x = 0; x <= w; x += 40) ctx.lineTo(x, top + Math.sin(x * 0.05 + seed) * 5);
  ctx.lineTo(w, h); ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  // 逐颗卵石（三层：暗底/亮面/高光）——白/米白/浅灰系
  const tones: Array<[string, string]> = [
    ['#ffffff', '#d8d2c2'], ['#f8f4ea', '#ccc4b0'], ['#f2ecdc', '#c2b8a2'],
    ['#faf8f0', '#d4ccbc'], ['#eee8dc', '#bab0a0'],
  ];
  for (let i = 0; i < 240; i++) {
    const px = rand() * w;
    const py = top + 2 + rand() * (h - top - 4);
    const pr = 2.5 + rand() * 5;
    const [hi, lo] = tones[Math.floor(rand() * tones.length)];
    const pg = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.4, pr * 0.2, px, py, pr);
    pg.addColorStop(0, hi);
    pg.addColorStop(1, lo);
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * (0.6 + rand() * 0.2), rand() * 0.6 - 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 底床阴影带（白砂用轻阴影）
  const shade2 = ctx.createLinearGradient(0, h - 26, 0, h);
  shade2.addColorStop(0, 'rgba(80,72,58,0)');
  shade2.addColorStop(1, 'rgba(80,72,58,0.22)');
  ctx.fillStyle = shade2;
  ctx.fillRect(0, h - 26, w, 26);
}

/** 装饰植物（v4 对齐官方塑料装饰植物风）：broad=皇冠草(长带叶) green=亮绿圆叶簇 red=鲜红柳 */
function drawPlant(ctx: CanvasRenderingContext2D, x: number, baseY: number, ph: number, hue: string, seed: number): void {
  const rand = mulberry(seed);
  if (hue === 'broad') {
    // 皇冠草：基部长出大叶片（提亮为鲜绿）
    const leaves = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < leaves; i++) {
      const a = -Math.PI / 2 + (i - leaves / 2) * 0.22 + (rand() - 0.5) * 0.1;
      const len = ph * (0.6 + rand() * 0.55);
      const tipX = x + Math.cos(a) * len * 1.15;
      const tipY = baseY + Math.sin(a) * len;
      const midX = x + Math.cos(a) * len * 0.6;
      const midY = baseY + Math.sin(a) * len * 0.6;
      const bow = (rand() - 0.5) * 30;
      const leaf = new Path2D();
      leaf.moveTo(x, baseY);
      leaf.quadraticCurveTo(midX + bow, midY, tipX, tipY);
      leaf.quadraticCurveTo(midX + bow + 10, midY + 6, x, baseY);
      const lg = ctx.createLinearGradient(x, baseY, tipX, tipY);
      lg.addColorStop(0, '#1e8e34');
      lg.addColorStop(0.6, '#3cb850');
      lg.addColorStop(1, '#74dc7c');
      ctx.fillStyle = lg;
      ctx.fill(leaf);
      // 中脉
      ctx.strokeStyle = 'rgba(220,255,210,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(midX + bow * 0.6, midY, tipX, tipY);
      ctx.stroke();
    }
    return;
  }
  if (hue === 'red') {
    // 红柳：高茎对生尖叶，顶部最亮（官方鲜红大叶植物）
    const stems = 7 + Math.floor(rand() * 4);
    for (let s2 = 0; s2 < stems; s2++) {
      const sx = x + (rand() - 0.5) * 36;
      const sh = ph * (0.6 + rand() * 0.45);
      const bend = (rand() - 0.5) * 16;
      ctx.strokeStyle = '#a83028';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.quadraticCurveTo(sx + bend * 0.4, baseY - sh * 0.55, sx + bend, baseY - sh);
      ctx.stroke();
      const layers = Math.floor(sh / 9);
      for (let l = 1; l <= layers; l++) {
        const t = l / (layers + 1);
        const lx = sx + bend * t * t;
        const ly = baseY - sh * t;
        const ll = (9 + rand() * 5) * (1.2 - t * 0.3);
        const bright = t > 0.62 ? '#f2604a' : l % 2 ? '#d84038' : '#e85040';
        ctx.fillStyle = bright;
        // 对生尖叶（上斜）
        ctx.beginPath();
        ctx.ellipse(lx - ll * 0.55, ly - ll * 0.28, ll * 0.62, ll * 0.26, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(lx + ll * 0.55, ly - ll * 0.28, ll * 0.62, ll * 0.26, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // 顶梢亮红新叶
      ctx.fillStyle = '#ff7458';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(sx + bend + (rand() - 0.5) * 7, baseY - sh + k * 4 - 2, 3.4, 5.6, (rand() - 0.5) * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }
  // 亮绿圆叶簇（moneywort）：密集对生圆叶盖满茎，官方最醒目的绿色植物
  const isGreen = true;
  const stems = 10 + Math.floor(rand() * 6);
  const stemCol = '#1e8e34';
  const leafLo = '#2ea83c';
  const leafHi = '#52d45c';
  for (let s2 = 0; s2 < stems; s2++) {
    const sx = x + (rand() - 0.5) * 40;
    const sh = ph * (0.55 + rand() * 0.5);
    const bend = (rand() - 0.5) * 20;
    // 茎（微弯）
    const sg = ctx.createLinearGradient(sx, baseY, sx + bend, baseY - sh);
    sg.addColorStop(0, stemCol);
    sg.addColorStop(1, leafHi);
    ctx.strokeStyle = sg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, baseY);
    ctx.quadraticCurveTo(sx + bend * 0.4, baseY - sh * 0.55, sx + bend, baseY - sh);
    ctx.stroke();
    // 沿茎密集圆叶：每层对生圆叶（官方塑料植物的饱满感）
    const layers = Math.floor(sh / 6.5);
    for (let l = 1; l <= layers; l++) {
      const t = l / (layers + 1);
      const lx = sx + bend * t * t;
      const ly = baseY - sh * t;
      const lr = (4.6 + rand() * 2.2) * (1.12 - t * 0.3); // 底大顶小
      ctx.fillStyle = l % 2 ? leafLo : leafHi;
      ctx.beginPath();
      ctx.ellipse(lx - lr * 0.85, ly, lr, lr * 0.88, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(lx + lr * 0.85, ly, lr, lr * 0.88, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    // 顶梢嫩叶簇（不留秃梢）
    ctx.fillStyle = leafHi;
    for (let k = 0; k < 3; k++) {
      const tx2 = sx + bend + (rand() - 0.5) * 6;
      const ty2 = baseY - sh + k * 4;
      ctx.beginPath();
      ctx.ellipse(tx2, ty2, 3.2, 3.6, (rand() - 0.5) * 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** 沉木：半埋天然原木（曲线轮廓+深浅渐变+木纹+树瘤分支） */
function drawWood(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number): void {
  const rand = mulberry(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // 主体：弯曲木墩（v4 提亮为官方暖棕黄，下半埋入底沙）
  const g = ctx.createLinearGradient(0, -40, 0, 6);
  g.addColorStop(0, '#c09058');
  g.addColorStop(0.35, '#96683c');
  g.addColorStop(0.75, '#6a4622');
  g.addColorStop(1, '#4a3018');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-52, 4);
  ctx.bezierCurveTo(-56, -22, -30, -38, -2, -36);
  ctx.bezierCurveTo(24, -34, 42, -24, 54, -30);
  ctx.bezierCurveTo(64, -34, 72, -28, 74, -20);
  ctx.bezierCurveTo(76, -10, 66, -2, 52, 0);
  ctx.bezierCurveTo(28, 5, -20, 8, -52, 4);
  ctx.closePath();
  ctx.fill();
  // 顶面高光带
  ctx.strokeStyle = 'rgba(220,180,120,0.55)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-40, -26);
  ctx.bezierCurveTo(-18, -34, 8, -32, 30, -26);
  ctx.stroke();
  // 木纹（顺纹理弧线）
  ctx.strokeStyle = 'rgba(38,24,12,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const oy = -26 + i * 5;
    ctx.beginPath();
    ctx.moveTo(-44, oy);
    ctx.bezierCurveTo(-18, oy - 12, 14, oy - 10, 56, oy - 12);
    ctx.stroke();
  }
  // 断口截面（右端年轮）
  ctx.fillStyle = '#b89058';
  ctx.beginPath();
  ctx.ellipse(72, -24, 5, 8, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,30,0.6)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(72, -24, i * 1.4, i * 2.2, 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 树瘤分支（v4：渐细填充枝形，斜向伸出，避免直立短棒感）
  const prong = (bx: number, by: number, tx: number, ty: number, base: number) => {
    const mx = (bx + tx) / 2 + (ty - by) * 0.3;
    const my = (by + ty) / 2;
    ctx.fillStyle = '#7a5230';
    ctx.beginPath();
    ctx.moveTo(bx - base, by);
    ctx.quadraticCurveTo(mx - base * 0.5, my, tx, ty);
    ctx.quadraticCurveTo(mx + base * 0.6, my + base * 0.4, bx + base, by);
    ctx.closePath();
    ctx.fill();
    // 受光边
    ctx.strokeStyle = 'rgba(224,184,124,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx - base, by);
    ctx.quadraticCurveTo(mx - base * 0.5, my, tx, ty);
    ctx.stroke();
  };
  prong(-26, -30, -54, -58, 5.2);  // 左上主枝
  prong(-46, -54, -66, -68, 2.6);  // 左梢
  prong(28, -30, 52, -50, 4);      // 右枝
  prong(8, -34, 14, -56, 3);       // 中枝
  ctx.lineCap = 'butt';
  ctx.restore();
}

/** 岩石（v4 板岩堆叠拱，对齐官方 ss_4076 的扁平石板堆）：2-3 块扁平石板+拱形洞+边缘受光 */
/**
 * 三块大石头（用户指定的最简结构）：**左右两块竖着立 + 上面一块横着放**，
 * 形成"门"字形堆叠。不画碎屑、不画小石头，简洁有力。
 */
/**
 * 三块石头：**左右两块竖着立 + 上面一块横着架**。
 * 材质沿用上一版的层积岩素材（从 rock_slate 切出的左/右/上三块），只改形状不变材质。
 */
/** 中央主石头尺寸系数（h 的倍数）——用户要求至少 3 倍大且很宽 */
const ROCK_BIG_SCALE = 0.95;

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const rand = mulberry(seed);
  const okImg = (img: HTMLImageElement) => img && img.complete && img.naturalWidth > 0;
  const bottom = y;                             // 竖石落地
  const sideH = h * (0.34 + rand() * 0.05);     // 竖石高度
  const topH = h * 0.20;                        // 横石厚度（加厚）
  const gap = w * 0.30;                         // 两竖间距（收窄，紧挨）
  const topY = bottom - sideH - topH * 0.34;

  if (okImg(DECOR_SPRITES.rockLeft) && okImg(DECOR_SPRITES.rockRight) && okImg(DECOR_SPRITES.rockTop)) {
    const lw = sideH * (DECOR_SPRITES.rockLeft.naturalWidth / DECOR_SPRITES.rockLeft.naturalHeight);
    const rw = sideH * (DECOR_SPRITES.rockRight.naturalWidth / DECOR_SPRITES.rockRight.naturalHeight);
    // 横石宽度 = 两个石墩之间的净距 + 两侧各搭 0.42 个墩宽（必须压住石墩才连成一体）
    const tw = (gap * 2 + lw * 0.84) * 1.02;

    // 左竖（略带回转）
    ctx.save();
    ctx.translate(x - gap, bottom);
    ctx.rotate((rand() - 0.5) * 0.09);
    ctx.drawImage(DECOR_SPRITES.rockLeft, -lw * 0.55, -sideH, lw * 1.1, sideH);
    ctx.restore();
    // 右竖
    ctx.save();
    ctx.translate(x + gap, bottom);
    ctx.rotate((rand() - 0.5) * 0.09);
    ctx.drawImage(DECOR_SPRITES.rockRight, -rw * 0.55, -sideH, rw * 1.1, sideH);
    ctx.restore();
    // 上横（斜架在两竖之上）
    ctx.save();
    ctx.translate(x + (rand() - 0.5) * w * 0.12, topY);
    ctx.rotate((rand() - 0.5) * 0.10);
    ctx.drawImage(DECOR_SPRITES.rockTop, -tw / 2, -topH / 2, tw, topH);
    ctx.restore();
    return;
  }

  // 素材未就绪时的兜底：深灰块
  ctx.fillStyle = '#7d8390';
  ctx.fillRect(x - gap, bottom - sideH, sideH * 0.7, sideH);
  ctx.fillRect(x + gap * 0.3, bottom - sideH, sideH * 0.7, sideH);
  ctx.fillRect(x - gap * 0.9, topY, gap * 1.8, topH);
}

function drawShell(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  // 壳体（螺旋渐变）
  const g = ctx.createRadialGradient(-3, -6, 1, 0, 0, 12);
  g.addColorStop(0, '#f6ecd8');
  g.addColorStop(1, '#c8a878');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 10, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // 螺纹
  ctx.strokeStyle = '#a08050';
  ctx.lineWidth = 1.2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(i * 3.6, -9);
    ctx.stroke();
  }
  // 开口
  ctx.fillStyle = '#7a5e3a';
  ctx.beginPath();
  ctx.ellipse(0, 1, 9, 2.4, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();
}

export function drawTankBackground(
  ctx: CanvasRenderingContext2D, w: number, h: number, decor: Decor, bubbles: Bubble[], time: number,
): void {
  const bgMode = tankBgReady();
  const spriteMode = decorSpritesReady(); // 素材异步加载完成后需重建一次静态层
  if (!decor.layer || decor.layer.width !== w || decor.bgMode !== bgMode || decor.spritesUsed !== spriteMode) {
    decor.layer = buildLayer(decor, bgMode);
    decor.bgMode = bgMode;
    decor.spritesUsed = spriteMode;
  }
  if (bgMode) ctx.drawImage(getTankBg(), 0, 0, w, h); // AI 生成水体质感背景
  ctx.drawImage(decor.layer, 0, 0, w, h);

  // 动态：顶部光柱（v4 大幅减弱——官方背景基本无光柱）
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  for (let i = 0; i < 3; i++) {
    const bx = w * (0.2 + i * 0.28) + Math.sin(time * 0.3 + i * 2) * 30;
    const ray = ctx.createLinearGradient(bx, 0, bx + 90, h * 0.75);
    const a = 0.035 + Math.sin(time * 0.6 + i) * 0.012;
    ray.addColorStop(0, `rgba(255,255,235,${a})`);
    ray.addColorStop(1, 'rgba(255,255,235,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(bx - 26, 0);
    ctx.lineTo(bx + 26, 0);
    ctx.lineTo(bx + 120, h * 0.75);
    ctx.lineTo(bx + 30, h * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 气泡（三颗一串的质感：体+高光点）
  for (const b of bubbles) {
    const bx = b.x * w, by = b.y * h;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx, by, b.r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(bx - b.r * 0.35, by - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // 水面波动亮线
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let xx = 0; xx <= w; xx += 18) {
    const yy = 6 + Math.sin(xx * 0.03 + time * 1.6) * 2.5;
    if (xx === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  }
  ctx.stroke();
  const surf = ctx.createLinearGradient(0, 0, 0, 16);
  surf.addColorStop(0, 'rgba(255,255,255,0.4)');
  surf.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = surf;
  ctx.fillRect(0, 0, w, 16);
}

/** 确定性伪随机 */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 可自定义鱼缸（手册：Customizable Tanks — place your ornaments where you like） ----------
const DECOR_KEY = 'fishTycoon2D_decor_v1';
export type DecorOverrides = Record<string, { x?: number; y?: number }>; // key: `${tank}:${kind}:${idx}`

export function loadDecorOverrides(): DecorOverrides {
  try { return JSON.parse(localStorage.getItem(DECOR_KEY) ?? '{}'); } catch { return {}; }
}
export function saveDecorOverrides(o: DecorOverrides): void {
  try { localStorage.setItem(DECOR_KEY, JSON.stringify(o)); } catch { /* ignore */ }
}
/** 把玩家拖拽过的位置覆盖到程序化布置上 */
export function applyDecorOverrides(decor: Decor, tank: number, ov: DecorOverrides): void {
  decor.plants.forEach((p, i) => {
    const o = ov[`${tank}:plant:${i}`];
    if (o?.x !== undefined) p.x = o.x;
  });
  decor.woods.forEach((wd, i) => {
    const o = ov[`${tank}:wood:${i}`];
    if (o?.x !== undefined) wd.x = o.x;
    if (o?.y !== undefined) wd.y = o.y;
  });
  decor.rocks.forEach((r, i) => {
    const o = ov[`${tank}:rock:${i}`];
    if (o?.x !== undefined) r.x = o.x;
    if (o?.y !== undefined) r.y = o.y;
  });
}
