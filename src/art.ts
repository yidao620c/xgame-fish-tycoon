/** 生成位图资源（Vite 会做 hash 与 base 重写） */

import tankOne from './assets/art/tank-one.webp';
import tankTwo from './assets/art/tank-two.webp';
import tankSale from './assets/art/tank-sale.webp';
import store from './assets/art/store.webp';
import supplies from './assets/art/supplies.webp';
import species from './assets/art/species.webp';
import trophy from './assets/art/trophy.webp';
import type { TankId } from './core/types';

export const ART = {
  supplies,
  species,
  trophy,
  store,
} as const;

export const TANK_BG: Record<TankId, string> = {
  tank1: tankOne,
  tank2: tankTwo,
  sale: tankSale,
};

const images = new Map<string, HTMLImageElement>();

/** 取得（并缓存）已解码的图片；未就绪时返回 null，渲染端会用程序化降级方案 */
export function getImage(src: string): HTMLImageElement | null {
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = src;
    images.set(src, img);
  }
  if (img.complete && img.naturalWidth > 0) return img;
  return null;
}

export function preloadArt(): void {
  for (const src of [tankOne, tankTwo, tankSale, store, supplies, species, trophy]) {
    getImage(src);
  }
}

/** 居中裁剪后图片在画布上的实际矩形（与 drawCover 一致） */
export function coverRect(
  img: HTMLImageElement,
  w: number,
  h: number,
  offsetY = 0.5,
): { x: number; y: number; w: number; h: number } {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  return { x: (w - dw) / 2, y: (h - dh) * offsetY, w: dw, h: dh };
}

/** 居中裁剪绘制（background-size: cover） */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  offsetY = 0.5,
): void {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) * offsetY, dw, dh);
}

/**
 * 水缸背景：横屏用 cover；竖屏（如手机）按宽度铺底、底面对齐，
 * 上方用与水体同色的渐变延伸，避免把两侧水草全部裁掉、只剩空水。
 */
export function drawTankBackdrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  waterTop: string,
): void {
  const aspect = w / h;
  if (aspect >= 1.12) {
    drawCover(ctx, img, w, h, 0.5);
    return;
  }
  const scale = w / img.naturalWidth;
  const dh = img.naturalHeight * scale;
  if (dh >= h) {
    drawCover(ctx, img, w, h, 0.5);
    return;
  }
  const base = waterTop;
  const y = h - dh;
  const g = ctx.createLinearGradient(0, 0, 0, y);
  g.addColorStop(0, shade(base, 0.46));
  g.addColorStop(0.55, shade(base, 0.16));
  g.addColorStop(1, base);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, y);
  ctx.drawImage(img, 0, y, w, dh);
  // 接缝处向下渐隐，柔化被裁切的水草顶端
  const seam = ctx.createLinearGradient(0, y, 0, y + dh * 0.16);
  seam.addColorStop(0, base);
  seam.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = seam;
  ctx.fillRect(0, y, w, dh * 0.16);
  ctx.restore();
}

function shade(hex: string, amt: number): string {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const n = parseInt(full, 16);
  const mix = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}
