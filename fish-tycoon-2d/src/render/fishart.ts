// 程序化 2D 鱼类绘制（写实向）：
// 分层绘制 = 尾鳍(半透明膜+鳍条) → 背鳍/腹鳍 → 身体(背部暗-腹部亮的渐变) →
// 鳞片纹理 → 花纹(柔边条纹/斑点/闪带) → 鳃盖(渐变弧) → 胸鳍 → 眼(多层) → 金属光泽
import { finOf, MAGIC_INDEX } from '../game/genetics';

export type BodyParam = { len: number; hi: number; snout: number; tail: number; dorsal: number };

/** 21 种鱼身的 2D 轮廓参数（len=半身长 hi=半身高 snout=吻长 tail=尾比例 dorsal=背鳍高） */
export const BODY_2D: Record<number, BodyParam> = {
  1: { len: 30, hi: 15, snout: 8, tail: 1.1, dorsal: 0.6 },   // 鲨鱼：鱼雷形
  2: { len: 32, hi: 12, snout: 4, tail: 0.9, dorsal: 0.35 },  // 鲶鱼：细长
  3: { len: 28, hi: 11, snout: 10, tail: 1.0, dorsal: 0.45 }, // 箭鱼：尖吻
  4: { len: 26, hi: 12, snout: 13, tail: 0.85, dorsal: 0.45 },// 长鼻鱼
  5: { len: 22, hi: 19, snout: 3, tail: 0.75, dorsal: 0.55 }, // 肥脂鱼：圆胖
  6: { len: 25, hi: 13, snout: 9, tail: 0.9, dorsal: 0.55 },  // 探测鱼
  7: { len: 29, hi: 16, snout: 5, tail: 1.2, dorsal: 0.75 },  // 金鲨
  8: { len: 30, hi: 11, snout: 11, tail: 1.25, dorsal: 0.45 },// 火箭鱼
  9: { len: 20, hi: 16, snout: 4, tail: 0.85, dorsal: 0.65 }, // 果鱼：圆润
  10: { len: 19, hi: 18, snout: 2, tail: 0.7, dorsal: 0.55 }, // 金球鱼：球状
  11: { len: 24, hi: 13, snout: 6, tail: 1.35, dorsal: 0.55 },// 彗星鱼：长尾
  12: { len: 34, hi: 9, snout: 5, tail: 0.75, dorsal: 0.3 },  // 棍鱼：细长条
  13: { len: 26, hi: 18, snout: 4, tail: 0.85, dorsal: 0.85 },// 石斑：敦实
  14: { len: 16, hi: 14, snout: 3, tail: 0.65, dorsal: 0.45 },// 侏儒：迷你
  15: { len: 24, hi: 15, snout: 4, tail: 0.95, dorsal: 0.55 },// 鲤鱼
  16: { len: 20, hi: 17, snout: 4, tail: 1.4, dorsal: 0.95 }, // 斗鱼：大尾
  17: { len: 26, hi: 12, snout: 6, tail: 0.8, dorsal: 0.45 }, // 香蕉鱼：弯月
  18: { len: 27, hi: 12, snout: 7, tail: 1.15, dorsal: 0.4 }, // 水银鱼：侧扁
  19: { len: 22, hi: 14, snout: 6, tail: 1.05, dorsal: 0.7 }, // 闪光鱼
  20: { len: 28, hi: 10, snout: 5, tail: 0.85, dorsal: 0.28 },// 叶鱼：扁长
  21: { len: 27, hi: 14, snout: 6, tail: 1.1, dorsal: 0.75 }, // 星点鱼
};

/** 鱼身基调（species 1..21）：[背部深色, 体侧中色, 腹部亮色] —— v4 高饱和色板，对齐官方彩色鱼群 */
const BODY_TONE: Record<number, [string, string, string]> = {
  1: ['#3d6b8a', '#5a9cc0', '#dff0f8'], 2: ['#4a5c38', '#7a9058', '#e2ecd0'], 3: ['#2e7a68', '#4aae90', '#dcf4ea'],
  4: ['#8a7a2e', '#c4b050', '#f6eec6'], 5: ['#a05c28', '#d88a48', '#f8e4cc'], 6: ['#7a6e1e', '#b8a840', '#f2ecbe'],
  7: ['#a87818', '#e0b040', '#faeec0'], 8: ['#b05418', '#e88a3c', '#fce4c4'], 9: ['#9a6a1e', '#d8a448', '#f8ecca'],
  10: ['#b8880e', '#eec83a', '#fcf4c2'], 11: ['#8a6e2e', '#ccb060', '#f6eec6'], 12: ['#4e6458', '#7a9484', '#e0ece4'],
  13: ['#7a5c20', '#b09048', '#f0e6c4'], 14: ['#96604a', '#cc8f70', '#f8e6da'], 15: ['#7a701e', '#b8ac48', '#f2ecc0'],
  16: ['#7a2848', '#c05878', '#f8dce6'], 17: ['#9a8212', '#d8bc38', '#faf2bc'], 18: ['#4e6a86', '#88aac8', '#e6f2fa'],
  19: ['#8a6c22', '#c8ac58', '#f6eec4'], 20: ['#3e6e2a', '#6aa448', '#e2f0d0'], 21: ['#3e5a72', '#6a90ac', '#e2eef6'],
};

export function cssColor(num: number, alpha = 1): string {
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

/** 鱼卵簇（age<0）：沉在缸底的半透明卵团，带鳍色 tint（手册：starter eggs 等待孵化） */
export function drawEggCluster(ctx: CanvasRenderingContext2D, x: number, y: number, finNum: number): void {
  // 白砂底上必须高对比：暖橙红卵 + 深色描边（原版鱼缸风格）
  const offsets: Array<[number, number, number]> = [[-13, 3, 11], [12, 6, 9.6], [0, -7, 11.6]];
  const tint = cssColor(finNum, 1);
  // 落影
  ctx.fillStyle = 'rgba(50,38,26,0.38)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 12, 20, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [ox, oy, r] of offsets) {
    // 主体：饱和橙红渐变
    const g = ctx.createRadialGradient(x + ox - r * 0.3, y + oy - r * 0.35, r * 0.1, x + ox, y + oy, r);
    g.addColorStop(0, '#ffd9a0');
    g.addColorStop(0.45, '#f08a2c');
    g.addColorStop(1, '#c9451a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
    ctx.fill();
    // 深色描边（白砂上也能看清轮廓）
    ctx.strokeStyle = 'rgba(90,36,8,0.9)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // 顶部高光
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x + ox - r * 0.3, y + oy - r * 0.35, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  // 鳍色小点（保留基因色提示）
  ctx.fillStyle = tint;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x, y - 10, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}


export type FishLook = { sp: number; fin: number; age: number; pregnant: number; sick: string | null; dead: boolean };

/** 成鱼体长像素（鱼苗按年龄缩放；整体放大以贴近原作比例） */
export function fishScale(age: number): number {
  if (age >= 20) return 1.7;
  return (0.28 + 0.72 * Math.min(1, age / 20)) * 1.7;
}

/** 颜色混合 */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar * (1 - t) + br * t);
  const g = Math.round(ag * (1 - t) + bg * t);
  const bl = Math.round(ab * (1 - t) + bb * t);
  return (r << 16) | (g << 8) | bl;
}

function tintNum(sp: number): number {
  return parseInt(BODY_TONE[sp][1].slice(1), 16);
}

// ---- HSL 空间混色（官方鱼体高饱和的关键：RGB 平均会发灰，HSL 混色保色相） ----
function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}
function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [Math.round(l * 255), Math.round(l * 255), Math.round(l * 255)];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [Math.round(hue2rgb(p, q, h + 1 / 3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1 / 3) * 255)];
}
/** HSL 空间混色 + 饱和度提升：用于鱼身主色 = 鳍色 × 体型色（官方彩色鱼群核心） */
function vividMix(a: number, b: number, t: number, satBoost = 1.35): number {
  const [h1, s1, l1] = rgb2hsl((a >> 16) & 255, (a >> 8) & 255, a & 255);
  const [h2, s2, l2] = rgb2hsl((b >> 16) & 255, (b >> 8) & 255, b & 255);
  let dh = h2 - h1;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  const h = (h1 + dh * t + 1) % 1;
  const s = Math.min(1, (s1 + (s2 - s1) * t) * satBoost);
  const l = l1 + (l2 - l1) * t;
  const [r, g, bl] = hsl2rgb(h, s, l);
  return (r << 16) | (g << 8) | bl;
}
function hex6(num: number): string {
  return '#' + num.toString(16).padStart(6, '0');
}

/**
 * 绘制一条写实风格的鱼：原点在身体中心，朝右。wag 为尾摆相位。
 */
export function drawFish(ctx: CanvasRenderingContext2D, look: FishLook, x: number, y: number, wag: number, selected: boolean): void {
  const p = BODY_2D[look.sp];
  const fin = finOf(look.fin);
  const s = fishScale(look.age);
  const magic = MAGIC_INDEX[`${look.fin}_${look.sp}`];
  const finNum = magic ? 0xf2c14e : fin.color;
  const finCol = cssColor(finNum);
  const [toneDark, toneMid] = BODY_TONE[look.sp];
  // v4：鱼身主色由鳍色主导（HSL 混色保饱和），对齐官方彩色鱼群
  const toneMidNum = parseInt(toneMid.slice(1), 16);
  const bodyMidNum = magic ? 0xe8c25a : vividMix(finNum, toneMidNum, 0.42, 1.4);
  const bodyMid = magic ? '#e8c25a' : hex6(bodyMidNum);
  const bodyDark = magic ? '#a8802a' : hex6(shade(bodyMidNum, 0.55));
  const detail = s > 0.55; // 小鱼省略细节层

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (look.dead) { ctx.rotate(Math.PI); ctx.globalAlpha = 0.7; }

  const L = p.len, H = p.hi;
  const tailX = L - 2;
  const tailWag = look.dead ? 0 : Math.sin(wag) * 7;

  // ========== 1. 尾鳍：半透明扇膜 + 鳍条 ==========
  ctx.save();
  ctx.translate(tailX, 0);
  ctx.rotate(tailWag * 0.03);
  const tw = p.tail * 1.18; // v4：尾鳍整体加大，对齐官方夸张鳍型
  const tailGrad = ctx.createLinearGradient(0, 0, 24 * tw, 0);
  tailGrad.addColorStop(0, cssColor(finNum, 0.85));
  tailGrad.addColorStop(0.55, cssColor(finNum, 0.62));
  tailGrad.addColorStop(1, cssColor(lightenNum(finNum, 1.25), 0.3));
  ctx.fillStyle = tailGrad;
  const tailPath = new Path2D();
  switch (fin.pattern) {
    case 'sail': case 'flag': // 大扇尾
      tailPath.moveTo(0, -2);
      tailPath.bezierCurveTo(10 * tw, -14 * tw, 20 * tw, -17 * tw, 27 * tw, -12 * tw);
      tailPath.bezierCurveTo(21 * tw, -4 * tw, 21 * tw, 4 * tw, 27 * tw, 12 * tw);
      tailPath.bezierCurveTo(20 * tw, 17 * tw, 10 * tw, 14 * tw, 0, 2);
      break;
    case 'twin': // 双叉尾
      tailPath.moveTo(0, 0);
      tailPath.bezierCurveTo(8 * tw, -8 * tw, 16 * tw, -13 * tw, 22 * tw, -15 * tw);
      tailPath.bezierCurveTo(16 * tw, -6 * tw, 14 * tw, -2 * tw, 13 * tw, 0);
      tailPath.bezierCurveTo(14 * tw, 2 * tw, 16 * tw, 6 * tw, 22 * tw, 15 * tw);
      tailPath.bezierCurveTo(16 * tw, 13 * tw, 8 * tw, 8 * tw, 0, 0);
      break;
    case 'razor': // 尖刀尾
      tailPath.moveTo(0, -3);
      tailPath.lineTo(24 * tw, -9 * tw);
      tailPath.quadraticCurveTo(19 * tw, 0, 24 * tw, 9 * tw);
      tailPath.lineTo(0, 3);
      break;
    case 'stripe': // 三叉尾
      tailPath.moveTo(0, 0);
      tailPath.lineTo(19 * tw, -11 * tw);
      tailPath.quadraticCurveTo(11 * tw, -2 * tw, 12 * tw, 0);
      tailPath.quadraticCurveTo(11 * tw, 2 * tw, 19 * tw, 11 * tw);
      tailPath.lineTo(0, 0);
      break;
    default: // 圆弧尾
      tailPath.moveTo(0, -2);
      tailPath.bezierCurveTo(12 * tw, -13 * tw, 22 * tw, -11 * tw, 23 * tw, -6 * tw);
      tailPath.bezierCurveTo(15 * tw, -1 * tw, 15 * tw, 1 * tw, 23 * tw, 6 * tw);
      tailPath.bezierCurveTo(22 * tw, 11 * tw, 12 * tw, 13 * tw, 0, 2);
  }
  ctx.fill(tailPath);
  // 鳍条（放射细线）
  if (detail) {
    ctx.save();
    ctx.clip(tailPath);
    ctx.strokeStyle = cssColor(darkenNum(finNum, 0.6), 0.4);
    ctx.lineWidth = 0.8;
    const rays = fin.pattern === 'sail' || fin.pattern === 'flag' ? 7 : 5;
    for (let i = 0; i < rays; i++) {
      const a = (i / (rays - 1) - 0.5) * 1.15;
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.lineTo(24 * tw * Math.cos(a), 24 * tw * Math.sin(a) * (a > 0 ? 1 : 1.05));
      ctx.stroke();
    }
    // 尾缘暗边
    const edge = ctx.createLinearGradient(18 * tw, 0, 25 * tw, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,20,0.18)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, -20 * tw, 30 * tw, 40 * tw);
    ctx.restore();
  }
  ctx.restore();

  // ========== 2. 背鳍 / 臀鳍（半透明膜+鳍条） ==========
  const dh = p.dorsal;
  const finMembrane = (path: Path2D, x0: number, x1: number) => {
    ctx.fillStyle = cssColor(finNum, 0.6);
    ctx.fill(path);
    if (detail) {
      ctx.save();
      ctx.clip(path);
      ctx.strokeStyle = cssColor(darkenNum(finNum, 0.62), 0.45);
      ctx.lineWidth = 0.7;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const rx = x0 + ((x1 - x0) * (i + 0.5)) / n;
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        ctx.lineTo(rx + 2, -H * (0.62 + dh));
        ctx.stroke();
      }
      ctx.restore();
    }
  };
  const dorsalPath = new Path2D();
  dorsalPath.moveTo(-L * 0.5, -H * 0.6);
  dorsalPath.bezierCurveTo(-L * 0.28, -H * (0.62 + dh * 1.35), L * 0.12, -H * (0.6 + dh * 1.15), L * 0.34, -H * 0.52);
  dorsalPath.quadraticCurveTo(-L * 0.08, -H * 0.74, -L * 0.5, -H * 0.6);
  finMembrane(dorsalPath, -L * 0.5, L * 0.34);
  const analPath = new Path2D();
  analPath.moveTo(-L * 0.3, H * 0.55);
  analPath.bezierCurveTo(-L * 0.16, H * (0.58 + dh * 0.62), L * 0.04, H * (0.56 + dh * 0.5), L * 0.18, H * 0.5);
  analPath.quadraticCurveTo(-L * 0.05, H * 0.68, -L * 0.3, H * 0.55);
  finMembrane(analPath, -L * 0.3, L * 0.18);

  // ========== 3. 身体：三层渐变（背暗/中亮/腹白） + 怀孕隆腹 ==========
  const preg = look.pregnant > 0 ? 0.16 : 0;
  const bodyPath = new Path2D();
  bodyPath.moveTo(L + p.snout, 0);
  // 上缘：尖吻 → 背脊弧 → 尾柄
  bodyPath.bezierCurveTo(
    L * 0.62, -H * (0.98 + preg * 0.3),
    -L * 0.3, -H * (1.02 + preg * 0.2),
    -L - 2, -H * 0.26,
  );
  bodyPath.lineTo(-L - 2, H * 0.22);
  // 下缘：尾柄 → 腹部隆起 → 下吻
  bodyPath.bezierCurveTo(
    -L * 0.26, H * (1.08 + preg * 1.5),
    L * 0.48, H * (0.94 + preg * 0.7),
    L + p.snout, 0,
  );
  bodyPath.closePath();
  const bodyGrad = ctx.createLinearGradient(0, -H * 1.05, 0, H * 1.1);
  bodyGrad.addColorStop(0, bodyDark);
  bodyGrad.addColorStop(0.42, bodyMid);
  bodyGrad.addColorStop(0.78, cssColor(mixColor(parseInt(bodyMid.slice(1), 16), 0xf4f4ec, 0.72)));
  bodyGrad.addColorStop(1, '#f8f6ee');
  ctx.fillStyle = bodyGrad;
  ctx.fill(bodyPath);

  // ========== 4. 鳞片纹理（错位圆弧排布，低透明度） ==========
  if (detail) {
    ctx.save();
    ctx.clip(bodyPath);
    ctx.strokeStyle = 'rgba(20,30,40,0.10)';
    ctx.lineWidth = 0.6;
    const sc = Math.max(3, H * 0.28);
    for (let row = 0; row < Math.ceil(H / sc) + 1; row++) {
      const sy = -H + row * sc;
      const off = row % 2 ? sc / 2 : 0;
      for (let sx = -L + off; sx < L + p.snout; sx += sc) {
        ctx.beginPath();
        ctx.arc(sx, sy, sc * 0.55, -0.6, 1.8);
        ctx.stroke();
      }
    }
    // 背部二次加深
    const backShade = ctx.createLinearGradient(0, -H * 1.05, 0, -H * 0.1);
    backShade.addColorStop(0, 'rgba(10,20,30,0.28)');
    backShade.addColorStop(1, 'rgba(10,20,30,0)');
    ctx.fillStyle = backShade;
    ctx.fillRect(-L - 4, -H * 1.1, (L + p.snout) * 2 + 8, H * 1.1);
    ctx.restore();
  }

  // ========== 5. 花纹（裁剪进身体，柔边） ==========
  ctx.save();
  ctx.clip(bodyPath);
  drawPattern(ctx, fin.pattern, finNum, L, H, look.sp, detail);
  ctx.restore();

  // ========== 6. 鳃盖（渐变弧）+ 侧线 ==========
  if (detail) {
    ctx.save();
    ctx.clip(bodyPath);
    const gillGrad = ctx.createLinearGradient(L * 0.28, 0, L * 0.52, 0);
    gillGrad.addColorStop(0, 'rgba(30,40,50,0.22)');
    gillGrad.addColorStop(1, 'rgba(30,40,50,0)');
    ctx.fillStyle = gillGrad;
    ctx.fillRect(L * 0.28, -H, L * 0.3, H * 2);
    ctx.strokeStyle = 'rgba(20,30,40,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(L * 0.3, 0, H * 0.72, -1.15, 1.15);
    ctx.stroke();
    // 侧线
    ctx.strokeStyle = 'rgba(20,30,40,0.18)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-L * 0.75, -H * 0.05);
    ctx.quadraticCurveTo(0, -H * 0.16, L * 0.72, -H * 0.1);
    ctx.stroke();
    ctx.restore();
  }

  // ========== 7. 胸鳍（摆动的半透明小鳍） ==========
  ctx.save();
  ctx.translate(L * 0.3, H * 0.18);
  ctx.rotate(Math.sin(wag * 1.3) * 0.22 + 0.5);
  const pect = new Path2D();
  pect.moveTo(0, 0);
  pect.quadraticCurveTo(H * 0.5, H * 0.5, H * 0.15, H * 1.05);
  pect.quadraticCurveTo(-H * 0.2, H * 0.55, 0, 0);
  const pectGrad = ctx.createLinearGradient(0, 0, 0, H);
  pectGrad.addColorStop(0, cssColor(finNum, 0.62));
  pectGrad.addColorStop(1, cssColor(finNum, 0.2));
  ctx.fillStyle = pectGrad;
  ctx.fill(pect);
  ctx.restore();

  // ========== 8. 眼睛（多层：眼窝/巩膜/虹膜/瞳孔/高光） ==========
  const ex = L * 0.64, ey = -H * 0.22;
  const er = Math.max(2.4, H * 0.2);
  ctx.fillStyle = 'rgba(30,30,36,0.35)';
  ctx.beginPath(); ctx.arc(ex, ey, er * 1.18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4f2ea';
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
  const iris = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 0.72);
  iris.addColorStop(0, '#d8b040');
  iris.addColorStop(0.7, '#a87818');
  iris.addColorStop(1, '#6a4a10');
  ctx.fillStyle = iris;
  ctx.beginPath(); ctx.arc(ex, ey, er * 0.72, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#14141c';
  ctx.beginPath(); ctx.arc(ex + er * 0.1, ey, er * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(ex - er * 0.26, ey - er * 0.3, er * 0.2, 0, Math.PI * 2); ctx.fill();

  // 嘴（小弧线）
  ctx.strokeStyle = 'rgba(20,25,30,0.55)';
  ctx.lineWidth = Math.max(0.8, H * 0.05);
  ctx.beginPath();
  ctx.arc(L + p.snout - H * 0.14, H * 0.1, H * 0.16, Math.PI * 0.15, Math.PI * 0.75);
  ctx.stroke();

  // ========== 9. 金属光泽（斜向高光带） ==========
  ctx.save();
  ctx.clip(bodyPath);
  const sheen = ctx.createLinearGradient(-L * 0.5, -H, L * 0.3, H * 0.4);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  sheen.addColorStop(0.6, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-L - 4, -H * 1.1, (L + p.snout) * 2 + 8, H * 2.2);
  ctx.restore();

  // ========== 10. 生病 / 选中 / 魔法标记 ==========
  if (look.sick === 'ick') {
    ctx.fillStyle = 'rgba(250,250,245,0.95)';
    for (let i = 0; i < 7; i++) {
      const a = i * 1.05 + 0.4;
      const rr = H * 0.58;
      const wx = Math.cos(a) * rr * 0.75, wy = Math.sin(a) * rr * 0.62;
      const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, 2.4);
      wg.addColorStop(0, 'rgba(255,255,250,0.98)');
      wg.addColorStop(1, 'rgba(255,255,250,0.35)');
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.arc(wx, wy, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  } else if (look.sick === 'fungus') {
    // 棉絮状菌斑：多团灰绿绒毛
    for (let i = 0; i < 4; i++) {
      const fx2 = -L * 0.35 + i * L * 0.16;
      const fy2 = -H * 0.4 + (i % 2) * H * 0.3;
      const fg = ctx.createRadialGradient(fx2, fy2, 0, fx2, fy2, H * 0.34);
      fg.addColorStop(0, 'rgba(190,205,170,0.75)');
      fg.addColorStop(0.6, 'rgba(150,170,130,0.4)');
      fg.addColorStop(1, 'rgba(120,140,110,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(fx2, fy2, H * 0.34, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (selected) {
    ctx.strokeStyle = '#ffe259';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -wag * 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, L + p.snout + 12, H + 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (magic) {
    ctx.fillStyle = 'rgba(255,240,160,0.9)';
    const tw2 = wag * 0.8;
    for (let i = 0; i < 3; i++) {
      const ang = tw2 + i * 2.1;
      star(ctx, Math.cos(ang) * (L + 14), Math.sin(ang * 0.8) * (H + 16), 2.4);
    }
  }

  ctx.restore();
}

function drawPattern(ctx: CanvasRenderingContext2D, pattern: string, finNum: number, L: number, H: number, sp: number, detail: boolean): void {
  const col = cssColor(finNum, 0.55);
  const colSoft = cssColor(lightenNum(finNum, 1.2), 0.4);
  switch (pattern) {
    case 'tiger': { // 柔边垂直虎纹（渐变条带）
      for (let i = -2; i <= 2; i++) {
        const bx = i * L * 0.36;
        const g = ctx.createLinearGradient(bx - 5, 0, bx + 5, 0);
        g.addColorStop(0, 'rgba(30,30,30,0)');
        g.addColorStop(0.5, cssColor(darkenNum(finNum, 0.45), 0.62));
        g.addColorStop(1, 'rgba(30,30,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx - 7, -H);
        ctx.quadraticCurveTo(bx - 1, 0, bx - 6, H);
        ctx.lineTo(bx + 6, H);
        ctx.quadraticCurveTo(bx + 1, 0, bx + 7, -H);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'speckled': { // 大小不一的斑点（带暗边高光）
      for (let i = 0; i < 20; i++) {
        const px = (((i * 73) % 100) - 50) / 50 * L * 0.88;
        const py = (((i * 41) % 100) - 50) / 50 * H * 0.82;
        const r = 1.2 + ((i * 7) % 5) * 0.55;
        ctx.fillStyle = cssColor(darkenNum(finNum, 0.5), 0.55);
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'stripe': { // 水平条带（柔边）
      const g1 = ctx.createLinearGradient(0, -H * 0.55, 0, -H * 0.1);
      g1.addColorStop(0, 'rgba(0,0,0,0)');
      g1.addColorStop(0.5, cssColor(darkenNum(finNum, 0.5), 0.5));
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(-L, -H * 0.55, L * 2, H * 0.45);
      const g2 = ctx.createLinearGradient(0, H * 0.05, 0, H * 0.5);
      g2.addColorStop(0, 'rgba(0,0,0,0)');
      g2.addColorStop(0.5, cssColor(darkenNum(finNum, 0.5), 0.5));
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(-L, H * 0.05, L * 2, H * 0.45);
      break;
    }
    case 'swirl': { // 旋涡纹（渐细弧线）
      ctx.strokeStyle = cssColor(darkenNum(finNum, 0.55), 0.6);
      for (let i = 0; i < 3; i++) {
        ctx.lineWidth = 1.6 - i * 0.3;
        ctx.beginPath();
        ctx.arc(-L * 0.3 + i * L * 0.32, (i - 1) * H * 0.3, H * 0.24, 0.4, 4.2);
        ctx.stroke();
      }
      break;
    }
    case 'shine': { // 珍珠光泽鳞片高光
      for (let i = 0; i < 12; i++) {
        const px = (((i * 67) % 100) - 50) / 50 * L * 0.8;
        const py = (((i * 37) % 100) - 50) / 50 * H * 0.7;
        const g = ctx.createRadialGradient(px, py, 0, px, py, H * 0.22);
        g.addColorStop(0, 'rgba(255,252,220,0.55)');
        g.addColorStop(1, 'rgba(255,252,220,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, H * 0.22, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'razor': { // 背部锯齿纹
      ctx.fillStyle = cssColor(darkenNum(finNum, 0.5), 0.5);
      ctx.beginPath();
      ctx.moveTo(-L, -H * 0.25);
      for (let i = 0; i <= 6; i++) {
        const bx = -L + (i / 6) * L * 1.6;
        ctx.lineTo(bx, -H * 0.8 + (i % 2) * H * 0.34);
      }
      ctx.lineTo(L, -H * 0.25);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'flag': { // 侧身三角旗纹（渐变）
      const g = ctx.createLinearGradient(-L * 0.5, 0, L * 0.1, 0);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-L * 0.55, -H * 0.55);
      ctx.lineTo(L * 0.12, 0);
      ctx.lineTo(-L * 0.55, H * 0.55);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'twin': { // 前后双色（柔过渡）
      const g = ctx.createLinearGradient(-L * 0.2, 0, L * 0.2, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, colSoft);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(L * 0.1, -H, L, H * 2);
      break;
    }
    case 'sail': { // 上半身淡染
      const g = ctx.createLinearGradient(0, -H, 0, H * 0.2);
      g.addColorStop(0, cssColor(finNum, 0.3));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-L, -H, L * 2, H * 1.2);
      break;
    }
    default: { // plain：珠光侧线带
      if (detail) {
        const g = ctx.createLinearGradient(0, -H * 0.3, 0, H * 0.2);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,240,0.22)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-L, -H * 0.3, L * 2, H * 0.5);
      }
    }
  }
  // 叶鱼/棍鱼脊线
  if (sp === 20 || sp === 12) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-L, 0);
    ctx.lineTo(L, 0);
    ctx.stroke();
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function shade(num: number, f: number): number {
  const r = Math.round(((num >> 16) & 0xff) * f);
  const g = Math.round(((num >> 8) & 0xff) * f);
  const b = Math.round((num & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

function darkenNum(num: number, f: number): number {
  return shade(num, f);
}
function lightenNum(num: number, f: number): number {
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((num & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}
