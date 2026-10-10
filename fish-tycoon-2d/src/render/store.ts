// ============ 等距俯视鱼店场景（v7.0）============
// 参照 references/fish_store.jpg：2:1 等距菱形地板、斜向侧墙、立体货架与柜台、
// 右侧店门分隔内外空间（门外台阶上挤满顾客）。
// 人物 z 序按 y 排序（近大远小），全部元素统一在此坐标系内绘制。

export const ISO = {
  tw: 68,   // 菱形地砖宽
  th: 34,   // 菱形地砖高（= tw/2，等距 2:1）
  horizon: 0.34,  // 地平线（画面比例）
};

/** 菱形路径（中心 cx,cy） */
export function isoTile(ctx: CanvasRenderingContext2D, cx: number, cy: number, tw = ISO.tw, th = ISO.th): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - th / 2);
  ctx.lineTo(cx + tw / 2, cy);
  ctx.lineTo(cx, cy + th / 2);
  ctx.lineTo(cx - tw / 2, cy);
  ctx.closePath();
}

/** 人物等距缩放：y 越靠下（越近）越大 */
export function isoScale(y: number, h: number): number {
  const t = (y / h - ISO.horizon) / (1 - ISO.horizon);
  return 0.72 + Math.max(0, Math.min(1, t)) * 0.52;
}

/** 地面落影（椭圆） */
export function isoShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha = 0.32): void {
  ctx.save();
  ctx.fillStyle = `rgba(40,26,70,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 紫灰色地板（对照 fish_store.png）：原版是**接近平面**的紫灰地面，
 * 只有很淡的斜向格纹与墙脚暗带，不画明显菱形格。
 */
export function drawIsoFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const y0 = h * ISO.horizon;
  const g = ctx.createLinearGradient(0, y0, 0, h);
  g.addColorStop(0, '#8c86b0');      // 远处偏暗偏灰
  g.addColorStop(0.45, '#9d97bd');
  g.addColorStop(1, '#aaa4c6');      // 近处偏亮
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, w, h - y0);

  // 极淡的斜向格纹（原版几乎不可见，只提供纵深暗示）
  ctx.strokeStyle = 'rgba(90,86,130,0.10)';
  ctx.lineWidth = 1;
  const step = ISO.tw * 1.6;
  for (let x = -h; x < w + h; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + (h - y0) * 0.55, h);
    ctx.stroke();
  }
  for (let x = -h + step / 2; x < w + h; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x - (h - y0) * 0.55, h);
    ctx.stroke();
  }
  // 墙脚暗带
  const sh = ctx.createLinearGradient(0, y0 - 30, 0, y0 + 46);
  sh.addColorStop(0, 'rgba(24,10,52,0.5)');
  sh.addColorStop(1, 'rgba(24,10,52,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, y0 - 30, w, 76);
}

/**
 * 后墙 + 左右斜侧墙（等距透视：左右墙向内收）—— v7.9 版（用户要求还原）
 */
export function drawIsoWalls(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const y0 = h * ISO.horizon;
  // 背墙（正面）
  const g = ctx.createLinearGradient(0, 0, 0, y0);
  g.addColorStop(0, '#c9b978');
  g.addColorStop(0.6, '#d6c88a');
  g.addColorStop(1, '#bfae6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, y0 + 6);
  // 背墙横缝
  ctx.strokeStyle = 'rgba(120,100,50,0.22)';
  ctx.lineWidth = 1.5;
  for (let y = 18; y < y0; y += 26) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  // 踢脚线
  ctx.fillStyle = '#8a7a48';
  ctx.fillRect(0, y0 - 12, w, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, y0 - 12, w, 3);

  // 左斜墙（v7.9：加宽到 12.5%w + 斜向横缝 + 踢脚线）
  const lw = w * 0.125;
  const lg = ctx.createLinearGradient(0, 0, lw, y0);
  lg.addColorStop(0, '#a2925a');
  lg.addColorStop(0.6, '#b8a868');
  lg.addColorStop(1, '#c6b578');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(lw, y0 * 0.30);
  ctx.lineTo(lw, y0 + 6);
  ctx.lineTo(0, y0 + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,92,44,0.25)';
  ctx.lineWidth = 1.5;
  for (let y = 0; y < y0 * 0.34; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(lw, y * 0.30 + y0 * 0.30);
    ctx.stroke();
  }
  ctx.fillStyle = '#8a7a48';
  ctx.beginPath();
  ctx.moveTo(0, y0 - 10); ctx.lineTo(lw, y0 - 4); ctx.lineTo(lw, y0 + 6); ctx.lineTo(0, y0 + 6);
  ctx.closePath(); ctx.fill();

  // 右斜墙
  ctx.fillStyle = '#b5a068';
  ctx.beginPath();
  ctx.moveTo(w, 0); ctx.lineTo(w * 0.945, y0 * 0.24);
  ctx.lineTo(w * 0.945, y0 + 6); ctx.lineTo(w, y0 + 6);
  ctx.closePath();
  ctx.fill();
}

/**
 * 后墙大型鱼缸柜（对照 fish_store.png）：**横跨大半面墙**的紫色大柜，
 * 上下两层、每层 4 个大缸，缸内有鱼；柜顶有横置的紫色檐板 + 瓶罐装饰。
 * 这是店里最大的视觉元素（原版就是一面墙的鱼缸）。
 */
export function drawIsoShelf(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  drawTank: (cx: number, cy: number, tw: number, th: number, idx: number) => void,
): void {
  const depth = 12;
  // 柜体主色（紫色）
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#9b86e8');
  g.addColorStop(0.5, '#7a62cc');
  g.addColorStop(1, '#523c96');
  ctx.fillStyle = g;
  ctx.fillRect(x - 10, y - 12, w + 20, h + 24);
  // 顶面（等距斜面）
  ctx.fillStyle = '#b3a2f4';
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 12);
  ctx.lineTo(x - 10 + depth, y - 12 - depth * 0.5);
  ctx.lineTo(x + w + 10 + depth, y - 12 - depth * 0.5);
  ctx.lineTo(x + w + 10, y - 12);
  ctx.closePath();
  ctx.fill();
  // 右侧暗面
  ctx.fillStyle = 'rgba(28,14,68,0.5)';
  ctx.beginPath();
  ctx.moveTo(x + w + 10, y - 12);
  ctx.lineTo(x + w + 10 + depth, y - 12 - depth * 0.5);
  ctx.lineTo(x + w + 10 + depth, y + h + 12 - depth * 0.5);
  ctx.lineTo(x + w + 10, y + h + 12);
  ctx.closePath();
  ctx.fill();
  // 柜顶横檐（原版有一道紫色檐板）
  ctx.fillStyle = '#8b74d8';
  ctx.fillRect(x - 12, y - 16, w + 24, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x - 12, y - 16, w + 24, 2.5);

  // 上下两层 × 每层 4 缸
  const rows = 2, cols = 4;
  const gap = 7;
  const bw = (w - gap * (cols - 1)) / cols;
  const bh = (h - gap * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = x + c * (bw + gap);
      const ty = y + r * (bh + gap);
      ctx.fillStyle = 'rgba(18,8,52,0.55)';       // 缸洞阴影
      ctx.fillRect(tx - 3, ty - 3, bw + 6, bh + 6);
      drawTank(tx, ty, bw, bh, r * cols + c);
      ctx.fillStyle = 'rgba(255,255,255,0.13)';   // 玻璃高光
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + bw * 0.32, ty);
      ctx.lineTo(tx, ty + bh * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    // 层间紫色横板
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x - 6, y + r * (bh + gap) + bh + 1, w + 12, 2);
  }
}

/**
 * L 形柜台（对照 fish_store.png + 用户指定）：
 * - 长边沿**南→北**方向延伸，紧贴**西墙**，一直到接近北墙
 * - 短边沿**西→东**伸出（南端横向段），构成 L
 * - 又矮又窄、实心不透明；老板站在柜台内侧（靠西墙一侧）
 */
export function drawIsoCounter(
  ctx: CanvasRenderingContext2D, cw: number, ch: number,
  boss: HTMLImageElement | null, items: { wallet: HTMLImageElement | null; food: HTMLImageElement | null; plant: HTMLImageElement | null },
): void {
  // 矮长条柜台（横向水平放置，靠画面左下；又矮又窄、实心不透明）
  const cx0 = cw * 0.035;
  const cy0 = ch * 0.715;
  const cw0 = cw * 0.125;
  const chh = ch * 0.115;
  const dx = cw0 * 0.20, dy = chh * 0.26;

  // 老板（完整绘制，由随后的柜台正面自然遮挡下半身）
  if (boss && boss.complete && boss.naturalWidth) {
    const bh = chh * 1.65, bw = bh * boss.naturalWidth / boss.naturalHeight;
    isoShadow(ctx, cx0 + cw0 * 0.58, cy0 + chh * 0.02, bw * 0.32, 0.3);
    ctx.drawImage(boss, cx0 + cw0 * 0.58 - bw / 2, cy0 - bh * 0.72, bw, bh);
  }

  // 正面（实心不透明紫色）
  const g = ctx.createLinearGradient(cx0, cy0, cx0, cy0 + chh);
  g.addColorStop(0, '#8b74d8');
  g.addColorStop(0.45, '#7058c4');
  g.addColorStop(1, '#4c3890');
  ctx.fillStyle = g;
  ctx.fillRect(cx0, cy0, cw0, chh);
  // 竖向分格
  ctx.strokeStyle = 'rgba(40,22,86,0.5)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    const gx = cx0 + (cw0 / 4) * i;
    ctx.beginPath(); ctx.moveTo(gx, cy0 + 3); ctx.lineTo(gx, cy0 + chh); ctx.stroke();
  }
  // 台面（浅斜板 + 受光高光）
  ctx.fillStyle = '#c9bcf6';
  ctx.beginPath();
  ctx.moveTo(cx0, cy0);
  ctx.lineTo(cx0 + dx, cy0 - dy);
  ctx.lineTo(cx0 + cw0 + dx, cy0 - dy);
  ctx.lineTo(cx0 + cw0, cy0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(cx0, cy0 - 2, cw0 + dx, 2.5);
  // 台面下暗部
  ctx.fillStyle = 'rgba(40,20,80,0.35)';
  ctx.fillRect(cx0, cy0 + chh - 2, cw0, 3);
  // 右侧暗面
  ctx.fillStyle = 'rgba(30,16,70,0.4)';
  ctx.beginPath();
  ctx.moveTo(cx0 + cw0, cy0);
  ctx.lineTo(cx0 + cw0 + dx, cy0 - dy);
  ctx.lineTo(cx0 + cw0 + dx, cy0 + chh - dy);
  ctx.lineTo(cx0 + cw0, cy0 + chh);
  ctx.closePath();
  ctx.fill();

  // 台面物品（沿斜向排布）
  const place = (img: HTMLImageElement | null, i: number, ih: number) => {
    if (!img || !img.complete || !img.naturalWidth) return;
    const iw = ih * img.naturalWidth / img.naturalHeight;
    const px = cx0 + cw0 * (0.2 + i * 0.3) + dx * 0.45;
    const py = cy0 - dy * (0.2 + i * 0.14);
    ctx.drawImage(img, px - iw / 2, py - ih, iw, ih);
  };
  place(items.wallet, 0, 20);
  place(items.food, 1, 20);
  place(items.plant, 2, 22);
}

/**
 * 两层靠墙柜（对照 fish_store.png 鱼缸左侧）：
 * 上层 = 小鱼缸（内有鱼）；下层 = 鱼瓶 / 药品 / 鱼食物等货品。
 */
export function drawTwoTierCabinet(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  drawFish: (c: CanvasRenderingContext2D, f: { sp: number; fin: number; age: number; pregnant: number; sick: string | null; dead: boolean }, x: number, y: number, t: number, sel: boolean) => void,
): void {
  // 柜体（实心深紫）
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#7a62c8');
  g.addColorStop(1, '#4a3690');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(35,18,80,0.65)'; ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // ---- 上层：两个小鱼缸（内有鱼）----
  const upH = h * 0.46;
  const cw = (w - 10) / 2;
  for (let i = 0; i < 2; i++) {
    const tx = x + 4 + i * (cw + 2);
    const ty = y + 4;
    const tw = cw - 2, thh = upH - 6;
    // 缸框 + 水
    ctx.fillStyle = '#3a2c14';
    ctx.fillRect(tx - 2, ty - 2, tw + 4, thh + 4);
    const wg = ctx.createLinearGradient(0, ty, 0, ty + thh);
    wg.addColorStop(0, 'rgba(130,205,240,0.95)');
    wg.addColorStop(1, 'rgba(70,150,215,0.98)');
    ctx.fillStyle = wg;
    ctx.fillRect(tx, ty, tw, thh);
    // 砂底
    ctx.fillStyle = '#d8d0be';
    ctx.fillRect(tx, ty + thh * 0.78, tw, thh * 0.22);
    // 缸内小鱼（1-2 条）
    for (let k = 0; k < 2; k++) {
      ctx.save();
      ctx.translate(tx + tw * (0.34 + k * 0.34), ty + thh * (0.42 + k * 0.2));
      ctx.scale(tw / 190, tw / 190);
      drawFish(ctx, { sp: 1 + ((i * 3 + k * 7) % 21), fin: 1 + ((i * 5 + k * 9) % 21), age: 20, pregnant: 0, sick: null, dead: false }, 0, 0, 0, false);
      ctx.restore();
    }
    // 玻璃高光
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(tx, ty); ctx.lineTo(tx + tw * 0.3, ty); ctx.lineTo(tx, ty + thh * 0.55);
    ctx.closePath(); ctx.fill();
  }
  // 层间横板
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x, y + upH, w, 2.5);

  // ---- 下层：货品（鱼瓶 / 药品 / 鱼粮罐）----
  const dy0 = y + upH + 4;
  const dh = h - upH - 8;
  ctx.fillStyle = 'rgba(28,14,66,0.55)';
  ctx.fillRect(x + 4, dy0, w - 8, dh);
  // 瓶子（细高）+ 药瓶（矮胖）+ 鱼粮罐（中）
  const items = 7;
  for (let i = 0; i < items; i++) {
    const bx = x + 8 + i * ((w - 16) / items);
    const kind = i % 3;
    const col = ['#e05a4a', '#4a9ae0', '#e0c04a', '#7ae05a', '#b05ae0', '#e08a4a', '#7ad4c8'][i % 7];
    ctx.fillStyle = col;
    if (kind === 0) {          // 细高鱼瓶
      ctx.fillRect(bx + 2, dy0 + dh * 0.22, 6, dh * 0.72);
      ctx.fillRect(bx + 3.5, dy0 + dh * 0.1, 3, dh * 0.14);
    } else if (kind === 1) {   // 矮胖药瓶
      ctx.beginPath();
      ctx.ellipse(bx + 5, dy0 + dh * 0.68, 5.5, dh * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(bx + 4, dy0 + dh * 0.36, 2.5, dh * 0.2);
    } else {                   // 鱼粮罐
      ctx.fillRect(bx + 1.5, dy0 + dh * 0.3, 7, dh * 0.62);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillRect(bx + 2, dy0 + dh * 0.32, 1.8, dh * 0.5);
  }
}

/** 背墙紫色货架：上层放瓶罐，下层是展示格（原版左侧墙） */
export function drawIsoWallShelf(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
): void {
  // 柜体（实心深紫）
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#7a62c8');
  g.addColorStop(1, '#4a3690');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(35,18,80,0.6)'; ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  // 上层：瓶罐
  const colors = ['#e05a4a', '#4a7ae0', '#e0c04a', '#7ae05a', '#b05ae0', '#e08a4a'];
  const bw = w / 6;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(x + i * bw + 4, y + 4, bw - 8, h * 0.34);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + i * bw + 4, y + 4, 2.5, h * 0.34);
  }
  // 中层横板
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y + h * 0.38, w, 2.5);
  // 下层：空的深色展示格
  ctx.fillStyle = 'rgba(28,14,66,0.6)';
  ctx.fillRect(x + 4, y + h * 0.46, w - 8, h * 0.5);
  ctx.strokeStyle = 'rgba(120,90,200,0.35)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) {
    const gx = x + (w / 3) * i;
    ctx.beginPath(); ctx.moveTo(gx, y + h * 0.46); ctx.lineTo(gx, y + h * 0.96); ctx.stroke();
  }
}

/** 白色展示柜（原版左上：白色柜子 + 彩色货格） */
export function drawIsoWhiteCabinet(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
): void {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#f6f8fa');
  g.addColorStop(1, '#c8d0d8');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(80,90,105,0.55)'; ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  const goods = ['#e8737a', '#7ab6e8', '#8fd47a', '#e8c87a', '#b48ae0', '#7ad4c8', '#f0a8d0', '#a8d0f0'];
  const cols = 4, rows = 2;
  const cw = (w - 8) / cols, ch = (h - 10) / rows;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      ctx.fillStyle = goods[(r * cols + i) % goods.length];
      ctx.fillRect(x + 4 + i * cw + 2, y + 5 + r * ch + 2, cw - 4, ch - 4);
    }
  }
  ctx.fillStyle = 'rgba(90,100,115,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
}

/** 壁画兜底鱼（出售缸为空时使用） */
const FALLBACK_POSTER_FISH = [
  { sp: 1, fin: 1, age: 20 }, { sp: 7, fin: 7, age: 20 }, { sp: 14, fin: 14, age: 20 },
];

/** 墙上的鱼壁画（原版左墙挂画） */
export function drawFishPoster(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  fish: ReadonlyArray<{ sp: number; fin: number; age: number }>,
  drawFish: (c: CanvasRenderingContext2D, f: { sp: number; fin: number; age: number; pregnant: number; sick: string | null; dead: boolean }, x: number, y: number, t: number, sel: boolean) => void,
): void {
  // 画框
  ctx.fillStyle = '#3f5f8f';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f0f4f8';
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = '#dce8f4';
  ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
  // 画中鱼（3 条）—— saleFish 可能为空数组，必须兜底，否则 undefined.sp 会中断整个 drawStore
  // 画中鱼：原版是"很多鱼的照片"——铺满 3×3 网格，共 9 条
  const pool = fish.length > 0 ? fish : FALLBACK_POSTER_FISH;
  const rows = 3, cols = 3;
  const sc = (w / 100) * 0.62;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const f0 = pool[i % pool.length] ?? FALLBACK_POSTER_FISH[i % FALLBACK_POSTER_FISH.length];
      if (!f0) continue;
      ctx.save();
      ctx.translate(
        x + 8 + (w - 16) * ((c + 0.5) / cols),
        y + 7 + (h - 22) * ((r + 0.5) / rows),
      );
      ctx.scale(sc, sc);
      drawFish(ctx, { sp: f0.sp, fin: f0.fin, age: f0.age, pregnant: 0, sick: null, dead: false }, 0, 0, 0, false);
      ctx.restore();
    }
  }
  // 标题条
  ctx.fillStyle = '#3a5f8f';
  ctx.fillRect(x + 5, y + h - 13, w - 10, 10);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.max(7, w / 22)}px Verdana, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Know Your Fish!', x + w / 2, y + h - 4.5);
}

/** 右侧店门 + 门外台阶区（等距：门外地面向右上倾斜） */
export function drawIsoDoorArea(ctx: CanvasRenderingContext2D, w: number, h: number, doorImg: HTMLImageElement | null = null): { doorX: number } {
  const doorX = w * 0.80;
  // 门外地面（向右上倾斜的灰色平台 = 等距纵深）
  const g = ctx.createLinearGradient(doorX, 0, w, h * 0.6);
  g.addColorStop(0, '#9a9aa4');
  g.addColorStop(1, '#5e5e6a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(doorX + w * 0.085, h * 0.20);
  ctx.lineTo(w, h * 0.10);
  ctx.lineTo(w, h);
  ctx.lineTo(doorX + w * 0.085, h);
  ctx.closePath();
  ctx.fill();
  // 台阶线（等距斜线）
  ctx.strokeStyle = 'rgba(35,35,45,0.45)';
  ctx.lineWidth = 2;
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    ctx.beginPath();
    ctx.moveTo(doorX + w * 0.085 + (w - doorX - w * 0.085) * t * 0.1, h * (0.22 + t * 0.75));
    ctx.lineTo(w, h * (0.16 + t * 0.8));
    ctx.stroke();
  }
  // 真实双开门素材（AI 生成，照片级木门+石阶）
  if (doorImg && doorImg.complete && doorImg.naturalWidth) {
    const dh = h * 0.62;
    const dw = dh * doorImg.naturalWidth / doorImg.naturalHeight;
    ctx.save();
    ctx.translate(doorX - dw * 0.42, h * 0.12);
    ctx.drawImage(doorImg, 0, 0, dw, dh);
    ctx.restore();
  }
  // 门框立柱（等距：上下右斜的柱面）
  const postW = 15;
  ctx.fillStyle = '#3c3c46';
  ctx.beginPath();
  ctx.moveTo(doorX, h * 0.16);
  ctx.lineTo(doorX + postW, h * 0.13);
  ctx.lineTo(doorX + postW, h * 0.98);
  ctx.lineTo(doorX, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(doorX + 3, h * 0.16);
  ctx.lineTo(doorX + 7, h * 0.155);
  ctx.lineTo(doorX + 7, h * 0.97);
  ctx.lineTo(doorX + 3, h * 0.98);
  ctx.closePath();
  ctx.fill();
  // 门楣
  ctx.fillStyle = '#4e4e5a';
  ctx.beginPath();
  ctx.moveTo(doorX, h * 0.16);
  ctx.lineTo(w, h * 0.10);
  ctx.lineTo(w, h * 0.145);
  ctx.lineTo(doorX, h * 0.205);
  ctx.closePath();
  ctx.fill();
  // 门槛亮线
  ctx.strokeStyle = 'rgba(255,220,150,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(doorX + postW, h * 0.205);
  ctx.lineTo(doorX + postW, h);
  ctx.stroke();
  return { doorX };
}
