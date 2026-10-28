/** 待售缸立绘：白底泛洪抠图 + 裁切，返回可直接 drawImage 的画布 */

import saleTankSrc from '../assets/art/sale-tank.webp';

export interface TankSprite {
  canvas: HTMLCanvasElement;
  /** 宽 / 高 */
  ratio: number;
}

let cached: TankSprite | null = null;
let loading = false;

/** 缸体玻璃前脸在立绘里的相对位置（由素材量出，随裁切后的包围盒归一化） */
export const TANK_GLASS = {
  x0: 0.03,
  x1: 0.66,
  y0: 0.15,
  y1: 0.66,
};

export function getSaleTank(): TankSprite | null {
  if (cached) return cached;
  if (loading) return null;
  loading = true;

  const img = new Image();
  img.onload = () => {
    cached = process(img);
    loading = false;
  };
  img.onerror = () => {
    loading = false;
  };
  img.src = saleTankSrc;
  return null;
}

function process(img: HTMLImageElement): TankSprite {
  const maxW = 900;
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  const sctx = src.getContext('2d');
  if (!sctx) return { canvas: src, ratio: w / h };
  sctx.drawImage(img, 0, 0, w, h);

  const data = sctx.getImageData(0, 0, w, h);
  const px = data.data;

  // 泛洪：从四边把接近纯白的背景去掉（内部白色砾石不会受影响）
  const nearWhite = (i: number): boolean =>
    px[i] > 228 && px[i + 1] > 228 && px[i + 2] > 228;
  const visited = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    if (!nearWhite(p * 4)) return;
    visited[p] = 1;
    stack[sp++] = p;
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    const y = (p - x) / w;
    px[p * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  // 边缘羽化：紧贴透明区域的浅色像素半透明，避免白边
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = (y * w + x) * 4;
      if (px[p + 3] === 0) continue;
      const a =
        px[p - 4 + 3] === 0 ||
        px[p + 4 + 3] === 0 ||
        px[p - w * 4 + 3] === 0 ||
        px[p + w * 4 + 3] === 0;
      if (a && nearWhite(p)) px[p + 3] = 120;
    }
  }
  sctx.putImageData(data, 0, 0);

  // 裁到内容包围盒
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return { canvas: src, ratio: w / h };

  const pad = 2;
  const cw = Math.min(w - x0, x1 - x0 + pad * 2);
  const ch = Math.min(h - y0, y1 - y0 + pad * 2);
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  if (octx) octx.drawImage(src, x0 - pad, y0 - pad, cw, ch, 0, 0, cw, ch);
  return { canvas: out, ratio: cw / ch };
}
