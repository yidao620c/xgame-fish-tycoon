/** 程序化鱼的绘制：21 鱼种轮廓 × 21 鳍基因配色/花纹/尾型 */

import { FINS, SPECIES, type TailKind } from '../core/genetics';

export interface FishDrawOpts {
  sp: number;
  fin: number;
  /** 体长像素 */
  size: number;
  /** 动画时间（秒） */
  t: number;
  /** 个体相位 */
  phase: number;
  alpha?: number;
  dead?: boolean;
  /** 幼鱼比例 0..1 用于更圆的身体 */
  baby?: number;
}

function stableRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

function bodyPath(ctx: CanvasRenderingContext2D, sp: number, baby: number): void {
  const sh = SPECIES[sp].shape;
  const L = sh.len;
  const h = sh.h * (1 + baby * 0.28);
  const snout = sh.snout * (1 - baby * 0.6);
  const nose = L * 0.44 + snout;
  const top = -h * (0.86 + 0.18 * sh.arch);
  ctx.beginPath();
  ctx.moveTo(nose, 0);
  ctx.bezierCurveTo(L * 0.32, top * 0.5, L * 0.06, top, -L * 0.26, -h * 0.3);
  ctx.quadraticCurveTo(-L * 0.42, 0, -L * 0.26, h * 0.28);
  ctx.bezierCurveTo(L * 0.04, h * 1.02, L * 0.32, h * 0.6, nose, 0);
  ctx.closePath();
}

function tailPath(
  ctx: CanvasRenderingContext2D,
  kind: TailKind,
  root: number,
  len: number,
  spread: number,
  sway: number,
): void {
  const tip = root - len;
  ctx.beginPath();
  switch (kind) {
    case 'fan': {
      ctx.moveTo(root, 0);
      ctx.bezierCurveTo(root - len * 0.55, -spread * 0.35, tip + len * 0.12, -spread * (0.95 + sway * 0.1), tip, -spread * (0.82 + sway * 0.12));
      ctx.quadraticCurveTo(tip + len * 0.34, 0, tip, spread * (0.82 - sway * 0.12));
      ctx.bezierCurveTo(tip + len * 0.12, spread * (0.95 - sway * 0.1), root - len * 0.55, spread * 0.35, root, 0);
      break;
    }
    case 'forked': {
      ctx.moveTo(root, 0);
      ctx.bezierCurveTo(root - len * 0.45, -spread * 0.3, tip + len * 0.18, -spread * 0.86, tip, -spread * (0.98 + sway * 0.1));
      ctx.quadraticCurveTo(tip + len * 0.5, -spread * 0.18, tip + len * 0.62, 0);
      ctx.quadraticCurveTo(tip + len * 0.5, spread * 0.18, tip, spread * (0.98 - sway * 0.1));
      ctx.bezierCurveTo(tip + len * 0.18, spread * 0.86, root - len * 0.45, spread * 0.3, root, 0);
      break;
    }
    case 'veil': {
      ctx.moveTo(root, 0);
      ctx.bezierCurveTo(root - len * 0.5, -spread * 0.5, tip + len * 0.3, -spread * 0.9, tip - len * 0.1, -spread * (0.75 + sway * 0.2));
      ctx.bezierCurveTo(tip - len * 0.05, -spread * 0.3, tip - len * 0.14, -spread * 0.1, tip - len * 0.1, 0);
      ctx.bezierCurveTo(tip - len * 0.14, spread * 0.1, tip - len * 0.05, spread * 0.3, tip - len * 0.1, spread * (0.75 - sway * 0.2));
      ctx.bezierCurveTo(tip + len * 0.3, spread * 0.9, root - len * 0.5, spread * 0.5, root, 0);
      break;
    }
    case 'sword': {
      ctx.moveTo(root, 0);
      ctx.bezierCurveTo(root - len * 0.5, -spread * 0.38, tip + len * 0.18, -spread * 0.8, tip, -spread * (0.8 + sway * 0.1));
      ctx.quadraticCurveTo(tip + len * 0.55, -spread * 0.1, tip + len * 0.4, 0);
      ctx.quadraticCurveTo(tip + len * 0.6, spread * 0.24, tip - len * 0.5, spread * 1.5);
      ctx.quadraticCurveTo(tip + len * 0.2, spread * 0.4, root, 0);
      break;
    }
    case 'lyre': {
      ctx.moveTo(root, 0);
      ctx.bezierCurveTo(root - len * 0.4, -spread * 0.25, tip + len * 0.2, -spread * 0.7, tip, -spread * (1.05 + sway * 0.15));
      ctx.bezierCurveTo(tip + len * 0.16, -spread * 0.5, tip + len * 0.16, -spread * 0.2, tip + len * 0.5, 0);
      ctx.bezierCurveTo(tip + len * 0.16, spread * 0.2, tip + len * 0.16, spread * 0.5, tip, spread * (1.05 - sway * 0.15));
      ctx.bezierCurveTo(tip + len * 0.2, spread * 0.7, root - len * 0.4, spread * 0.25, root, 0);
      break;
    }
  }
  ctx.closePath();
}

/** 主绘制：鱼中心在原点、朝 +x */
export function drawFish(ctx: CanvasRenderingContext2D, o: FishDrawOpts): void {
  const sp = SPECIES[o.sp];
  const fin = FINS[o.fin];
  const sh = sp.shape;
  const baby = o.baby ?? 0;
  const L = sh.len;
  const h = sh.h * (1 + baby * 0.28);
  const sway = Math.sin(o.t * 5.2 + o.phase);
  const sway2 = Math.sin(o.t * 5.2 + o.phase + 0.8);

  ctx.save();
  ctx.globalAlpha = (o.alpha ?? 1) * (o.dead ? 0.85 : 1);
  ctx.scale(o.size, o.size);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 整体上下浮动 + 轻微俯仰
  ctx.translate(0, sway2 * 0.012);
  ctx.rotate(sway * 0.035 + (o.dead ? Math.PI * 0.92 : 0));

  const accent = fin.color;
  const accentGlow = fin.glow;

  // ---- 尾鳍 ----
  const tailRoot = -L * 0.36;
  const tailLen = (0.24 + (fin.tail === 'veil' ? 0.18 : fin.tail === 'sword' ? 0.14 : 0.07)) * (1 - baby * 0.2);
  const tailSpread = (0.14 + sh.h * 0.26) * (1 - baby * 0.25);
  const tailGrad = ctx.createLinearGradient(tailRoot, 0, tailRoot - tailLen * 1.4, 0);
  tailGrad.addColorStop(0, accentGlow);
  tailGrad.addColorStop(0.45, accent);
  tailGrad.addColorStop(1, shade(accent, -0.25));
  ctx.save();
  ctx.translate(tailRoot, 0);
  ctx.rotate(sway * 0.3);
  ctx.translate(-tailRoot, 0);
  ctx.globalAlpha *= 0.94;
  tailPath(ctx, fin.tail, tailRoot, tailLen, tailSpread, sway);
  ctx.fillStyle = tailGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(12,42,58,0.2)';
  ctx.lineWidth = 0.007;
  ctx.stroke();
  // 鳍条
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = shade(accentGlow, 0.05);
  ctx.globalAlpha *= 0.55;
  ctx.lineWidth = 0.006;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(tailRoot, 0);
    ctx.quadraticCurveTo(tailRoot - tailLen * 0.6, i * tailSpread * 0.02, tailRoot - tailLen * 1.05, i * tailSpread * 0.26);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  // ---- 背鳍 ----
  const dorsalH = sh.dorsal * (1 - baby * 0.3);
  ctx.beginPath();
  ctx.moveTo(L * 0.24, -h * 0.54);
  ctx.bezierCurveTo(
    L * 0.15,
    -h * 0.9,
    -L * 0.02,
    -h * 0.96 - dorsalH * 0.92,
    -L * 0.3,
    -h * 0.5,
  );
  ctx.quadraticCurveTo(-L * 0.12, -h * 0.76, L * 0.24, -h * 0.54);
  ctx.closePath();
  const dorsalGrad = ctx.createLinearGradient(0, -h - dorsalH, 0, -h * 0.5);
  dorsalGrad.addColorStop(0, accentGlow);
  dorsalGrad.addColorStop(0.6, accent);
  dorsalGrad.addColorStop(1, shade(accent, -0.12));
  ctx.globalAlpha *= 0.9;
  ctx.fillStyle = dorsalGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(12,38,52,0.2)';
  ctx.lineWidth = 0.007;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = shade(accentGlow, 0.06);
  ctx.globalAlpha *= 0.4;
  ctx.lineWidth = 0.005;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(L * 0.18 - i * L * 0.07, -h * 0.6);
    ctx.quadraticCurveTo(
      L * 0.06 - i * L * 0.08,
      -h * 0.86 - dorsalH * 0.45,
      -L * 0.06 - i * L * 0.05,
      -h * 0.9 - dorsalH * 0.5,
    );
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha /= 0.9;

  // ---- 臀鳍 ----
  ctx.beginPath();
  ctx.moveTo(-L * 0.04, h * 0.66);
  ctx.bezierCurveTo(-L * 0.08, h * 0.9, -L * 0.18, h * 1.05, -L * 0.28, h * 0.62);
  ctx.quadraticCurveTo(-L * 0.16, h * 0.78, -L * 0.04, h * 0.66);
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.globalAlpha *= 0.82;
  ctx.fill();
  ctx.globalAlpha /= 0.82;

  // ---- 身体 ----
  bodyPath(ctx, o.sp, baby);
  const grad = ctx.createLinearGradient(0, -h * 1.1, 0, h * 1.1);
  grad.addColorStop(0, shade(sp.colors[0], -0.12));
  grad.addColorStop(0.34, sp.colors[0]);
  grad.addColorStop(0.62, sp.colors[1]);
  grad.addColorStop(1, shade(sp.colors[2], -0.1));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(12,38,52,0.26)';
  ctx.lineWidth = 0.012;
  ctx.stroke();

  // 花纹（裁剪到身体内）
  ctx.save();
  bodyPath(ctx, o.sp, baby);
  ctx.clip();
  const rnd = stableRandom(o.sp * 733 + o.fin * 197 + 17);
  switch (sp.pattern) {
    case 'spots': {
      ctx.fillStyle = shade(sp.colors[0], -0.25);
      for (let i = 0; i < 16; i++) {
        const x = (rnd() - 0.5) * L * 0.78;
        const y = (rnd() - 0.5) * h * 1.5;
        const r = 0.012 + rnd() * 0.02;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.2, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'bars': {
      ctx.fillStyle = shade(sp.colors[0], -0.18);
      for (let i = 0; i < 5; i++) {
        const x = -L * 0.34 + i * (L * 0.19);
        ctx.globalAlpha *= 0.5;
        ctx.fillRect(x, -h * 1.2, L * 0.055, h * 2.4);
        ctx.globalAlpha /= 0.5;
      }
      break;
    }
    case 'stripe': {
      const sgrad = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5);
      sgrad.addColorStop(0, accentGlow);
      sgrad.addColorStop(1, accent);
      ctx.globalAlpha *= 0.65;
      ctx.fillStyle = sgrad;
      ctx.fillRect(-L * 0.45, -h * 0.18, L * 0.95, h * 0.36);
      ctx.globalAlpha /= 0.65;
      break;
    }
    case 'mesh': {
      ctx.strokeStyle = shade(sp.colors[0], -0.12);
      ctx.globalAlpha *= 0.4;
      ctx.lineWidth = 0.01;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-L * 0.45, i * h * 0.22);
        ctx.lineTo(L * 0.45, i * h * 0.22 + h * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-L * 0.45, i * h * 0.22 + h * 0.4);
        ctx.lineTo(L * 0.45, i * h * 0.22);
        ctx.stroke();
      }
      ctx.globalAlpha /= 0.4;
      break;
    }
    case 'gradient': {
      const rg = ctx.createRadialGradient(L * 0.02, -h * 0.2, 0.05, L * 0.02, -h * 0.2, L * 0.7);
      rg.addColorStop(0, 'rgba(255,255,255,0.35)');
      rg.addColorStop(0.5, 'rgba(255,255,255,0.06)');
      rg.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = rg;
      ctx.fillRect(-L, -h * 1.4, L * 2, h * 3);
      break;
    }
    case 'none':
      break;
  }

  // 鳍基因花纹
  switch (fin.pattern) {
    case 'spots': {
      ctx.fillStyle = accent;
      ctx.globalAlpha *= 0.55;
      for (let i = 0; i < 12; i++) {
        const x = (rnd() - 0.5) * L * 0.8;
        const y = (rnd() - 0.5) * h * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 0.009 + rnd() * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha /= 0.55;
      break;
    }
    case 'bars': {
      ctx.fillStyle = accent;
      ctx.globalAlpha *= 0.4;
      for (let i = 0; i < 4; i++) {
        const x = -L * 0.3 + i * L * 0.2;
        ctx.fillRect(x, -h * 1.2, L * 0.05, h * 2.4);
      }
      ctx.globalAlpha /= 0.4;
      break;
    }
    case 'stripe': {
      ctx.fillStyle = accent;
      ctx.globalAlpha *= 0.35;
      ctx.fillRect(-L * 0.5, -h * 0.06, L, h * 0.12);
      ctx.globalAlpha /= 0.35;
      break;
    }
    case 'rim': {
      ctx.strokeStyle = accent;
      ctx.globalAlpha *= 0.55;
      ctx.lineWidth = 0.024;
      bodyPath(ctx, o.sp, baby);
      ctx.stroke();
      ctx.globalAlpha /= 0.55;
      break;
    }
    case 'none':
      break;
  }

  // 水体染色，让鱼与背景同处一层水
  const tint = ctx.createLinearGradient(0, -h, 0, h);
  tint.addColorStop(0, 'rgba(46,150,190,0.16)');
  tint.addColorStop(0.5, 'rgba(46,150,190,0.05)');
  tint.addColorStop(1, 'rgba(20,80,110,0.14)');
  ctx.fillStyle = tint;
  ctx.fillRect(-L, -h * 1.4, L * 2, h * 3);

  // 高光
  const spec = ctx.createLinearGradient(0, -h * 0.95, 0, -h * 0.1);
  spec.addColorStop(0, 'rgba(255,255,255,0.28)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.ellipse(L * 0.04, -h * 0.44, L * 0.28, h * 0.28, -0.12, 0, Math.PI * 2);
  ctx.fill();

  // 鳞片纹理（交错小弧，透明度很低）
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 0.005;
  for (let row = 0; row < 3; row++) {
    const y = -h * 0.36 + row * h * 0.3;
    for (let col = 0; col < 7; col++) {
      const x = -L * 0.3 + col * L * 0.1 + (row % 2) * L * 0.05;
      ctx.beginPath();
      ctx.arc(x, y, L * 0.045, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  }
  ctx.restore();

  // 鳃线
  ctx.beginPath();
  ctx.strokeStyle = shade(sp.colors[0], -0.2);
  ctx.globalAlpha *= 0.5;
  ctx.lineWidth = 0.009;
  ctx.moveTo(L * 0.24, -h * 0.52);
  ctx.quadraticCurveTo(L * 0.15, 0, L * 0.24, h * 0.5);
  ctx.stroke();
  ctx.globalAlpha /= 0.5;

  // 胸鳍
  const flick = Math.sin(o.t * 7 + o.phase * 1.7) * 0.5;
  ctx.save();
  ctx.translate(L * 0.19, h * 0.2);
  ctx.rotate(0.55 + flick * 0.45);
  ctx.globalAlpha *= 0.78;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(L * 0.06, h * 0.14, L * 0.02, h * 0.3);
  ctx.quadraticCurveTo(-L * 0.06, h * 0.2, -L * 0.03, h * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(accent, -0.35);
  ctx.lineWidth = 0.006;
  ctx.stroke();
  ctx.restore();

  // 眼睛
  const eyeX = L * 0.32;
  const eyeY = -h * 0.24;
  const eyeR = 0.02 + sh.eye * 0.24;
  ctx.beginPath();
  ctx.fillStyle = '#f7fbff';
  ctx.arc(eyeX, eyeY, eyeR * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = '#101820';
  ctx.arc(eyeX + eyeR * 0.12, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.arc(eyeX + eyeR * 0.4, eyeY - eyeR * 0.38, eyeR * 0.36, 0, Math.PI * 2);
  ctx.fill();
  if (o.dead) {
    ctx.strokeStyle = '#101820';
    ctx.lineWidth = 0.014;
    ctx.beginPath();
    ctx.moveTo(eyeX - eyeR, eyeY - eyeR);
    ctx.lineTo(eyeX + eyeR, eyeY + eyeR);
    ctx.moveTo(eyeX + eyeR, eyeY - eyeR);
    ctx.lineTo(eyeX - eyeR, eyeY + eyeR);
    ctx.stroke();
  }

  // 嘴
  ctx.beginPath();
  ctx.strokeStyle = shade(sp.colors[0], -0.35);
  ctx.lineWidth = 0.011;
  const nose = L * 0.44 + sh.snout * (1 - baby * 0.6);
  ctx.moveTo(nose - 0.02, h * 0.03);
  ctx.quadraticCurveTo(nose, h * 0.09, nose - 0.035, h * 0.11);
  ctx.stroke();

  ctx.restore();
}

/** 鱼卵 */
export function drawEgg(
  ctx: CanvasRenderingContext2D,
  opts: { fin: number; size: number; t: number; phase: number; progress: number },
): void {
  const fin = FINS[opts.fin];
  const r = opts.size;
  const wob = Math.sin(opts.t * 2.4 + opts.phase) * 0.06;
  ctx.save();
  ctx.globalAlpha = 0.92;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(240,250,255,0.55)');
  g.addColorStop(1, 'rgba(190,225,240,0.28)');
  ctx.beginPath();
  ctx.ellipse(0, 0, r * (0.9 + wob), r, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(0.6, r * 0.06);
  ctx.stroke();
  // 胚胎
  ctx.beginPath();
  ctx.fillStyle = fin.color;
  ctx.globalAlpha = 0.35 + opts.progress * 0.5;
  ctx.ellipse(r * 0.05, r * 0.12, r * 0.34, r * 0.26, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = 'rgba(20,30,40,0.55)';
  ctx.arc(r * 0.2, r * 0.02, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function shade(hex: string, amt: number): string {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const n = parseInt(full, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  }
  return `rgb(${r},${g},${b})`;
}

/** 生成一个鱼缩略图 canvas（UI 用） */
export function fishThumb(sp: number, fin: number, w = 96, h = 56, dead = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.scale(dpr, dpr);
  ctx.translate(w / 2, h / 2);
  drawFish(ctx, {
    sp,
    fin,
    size: Math.min(w / 1.95, h / 1.55),
    t: 0.9,
    phase: sp * 1.7,
    dead,
  });
  return c;
}
