/** 鱼店等距场景：店内环境 + 顾客 + 销售缸 */

import { drawFish } from './fishArt';
import { ART, coverRect, getImage } from '../art';
import { setStoreObstacles } from '../core/sim';
import { getSaleTank, TANK_GLASS } from './saleTank';
import { getNpc } from './npc';
import type { Customer, GameState } from '../core/types';

const WALL = 0.5;

const SHOPKEEPER_LINES = [
  '欢迎光临！',
  '这些鱼都是自己繁殖的',
  '喜欢哪一条？',
  '标价牌就在缸边～',
  '有新到的鱼卵哦',
];

/** 处理过的房间底图缓存：补满地板、去掉右侧门框、压平暗角 */
let roomCache: { key: string; canvas: HTMLCanvasElement } | null = null;

function getRoomCanvas(img: HTMLImageElement, w: number, h: number, dpr: number): HTMLCanvasElement {
  const key = `${w}x${h}@${dpr}`;
  if (roomCache && roomCache.key === key) return roomCache.canvas;

  const cw = Math.max(1, Math.round(w * dpr));
  const ch = Math.max(1, Math.round(h * dpr));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d', { alpha: false });
  if (!g) return c;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cover = coverRect(img, w, h, 0.5);

  // 先用地板纹理垫底，这样画面里不会再出现纯黑的空洞
  g.fillStyle = '#6d5c88';
  g.fillRect(0, 0, w, h);
  const tile = document.createElement('canvas');
  tile.width = 300;
  tile.height = 200;
  const tg = tile.getContext('2d');
  if (tg) {
    tg.drawImage(
      img,
      img.naturalWidth * 0.36,
      img.naturalHeight * 0.6,
      img.naturalWidth * 0.2,
      img.naturalHeight * 0.14,
      0,
      0,
      300,
      200,
    );
    const pat = g.createPattern(tile, 'repeat');
    if (pat) {
      const k = cover.w / w;
      g.save();
      g.scale(k, k);
      g.fillStyle = pat;
      g.fillRect(0, 0, w / k, h / k);
      g.restore();
    }
  }

  g.drawImage(img, cover.x, cover.y, cover.w, cover.h);

  // 把画面下部/左下的深色底座和暗角按亮度改成透明，露出下面的地板：地板就填满了画面，没有黑洞
  try {
    const data = g.getImageData(0, 0, cw, ch);
    const px = data.data;
    const yStart = ch * 0.42;
    for (let y = Math.floor(yStart); y < ch; y++) {
      const ty = y / ch;
      // 底部渐入，避免出现一条水平分界线
      const fy = Math.max(0, Math.min(1, (ty - 0.62) / 0.2));
      for (let x = 0; x < cw; x++) {
        const tx = x / cw;
        const corner = tx < 0.18 || tx > 0.86 ? 1 : 0;
        const zone = Math.max(corner * Math.max(0, Math.min(1, (ty - 0.45) / 0.12)), fy);
        if (zone <= 0) continue;
        const i = (y * cw + x) * 4;
        const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
        if (lum > 110) continue;
        const a = Math.max(0, Math.min(1, (lum - 52) / 46));
        const keep = Math.round((1 - (1 - a) * zone) * 255);
        if (keep < px[i + 3]) px[i + 3] = keep;
      }
    }
    g.putImageData(data, 0, 0);
  } catch {
    /* 画布过大或跨域时跳过 */
  }

  roomCache = { key, canvas: c };
  return c;
}

export class StoreView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private getState: () => GameState;
  private saleFlash = 0;
  /** 上一帧的屏幕位置与朝向（按真实位移判断，避免倒着走 */
  private lastPos = new Map<string, number>();
  private faceDir = new Map<string, number>();
  private dirAccum = new Map<string, number>();
  private lastSold = -1;
  private cheerTimer = 0;
  private bubbleShow = true;
  private bubbleClock = 3.5;
  private bubbleIndex = 0;
  private bubbleText = '欢迎光临！';

  constructor(canvas: HTMLCanvasElement, getState: () => GameState) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;
    this.getState = getState;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    // 尺寸一变就先把障碍报给寻路，避免用旧布局生成顾客
    if (getImage(ART.store)) this.render(0, 0);
  }

  flashSale(): void {
    this.saleFlash = 1;
  }

  render(dt: number, now: number): void {
    const bg = getImage(ART.store);
    if (!bg) {
      this.renderRoom(dt, now);
      return;
    }
    const ctx = this.ctx;
    const state = this.getState();
    const w = this.w;
    const h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#120f16';
    ctx.fillRect(0, 0, w, h);

    const room = getRoomCanvas(bg, w, h, this.dpr);
    ctx.drawImage(room, 0, 0, w, h);
    // 光线统一：只留极轻微的上下渐变，不再用放射状暗角，避免出现明暗分界线
    ctx.fillStyle = 'rgba(255,208,150,0.03)';
    ctx.fillRect(0, 0, w, h);
    const tone = ctx.createLinearGradient(0, 0, 0, h);
    tone.addColorStop(0, 'rgba(10,8,12,0.10)');
    tone.addColorStop(0.45, 'rgba(10,8,12,0.015)');
    tone.addColorStop(1, 'rgba(10,8,12,0.05)');
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, w, h);

    // ---- 店主（站在柜台后面）----
    this.drawShopkeeper(ctx, bg, now, dt, state, w, h);

    // ---- 远处顾客：沿墙看展示缸，画在销售缸之前 ----
    const floorTop = h * 0.5;
    for (const c of [...state.customers].sort((a, b) => a.y - b.y)) {
      const feetY = floorTop + c.y * (h - floorTop) * 0.95;
      if (feetY < h * 0.775) this.drawCustomer(c, now, floorTop);
    }
    // ---- 待售缸：生成的玻璃缸 + 木柜立绘 ----
    const tankSprite = getSaleTank();
    const tankH = Math.max(170, Math.min(h * 0.46, 430));
    const tankW = tankH * (tankSprite?.ratio ?? 0.86);
    const tankCX = w * 0.46;
    const tankBottom = h * 0.84;
    const tankX = tankCX - tankW / 2;
    const tankY = tankBottom - tankH;

    // 告诉寻路：销售缸 + 左侧柜台都是实体障碍
    const cover = coverRect(bg, w, h, 0.5);
    const toFloor = (nx: number, ny: number) => ({
      x: (cover.x + cover.w * nx) / w,
      y: ((cover.y + cover.h * ny) / h - 0.5) / 0.475,
    });
    const counterTL = toFloor(0.015, 0.56);
    const counterBR = toFloor(0.215, 0.8);
    setStoreObstacles([
      {
        l: tankX / w,
        r: (tankX + tankW) / w,
        top: Math.max(0, (tankY / h - 0.5) / 0.475),
        bottom: (tankBottom / h - 0.5) / 0.475,
      },
      {
        l: Math.max(0, counterTL.x),
        r: counterBR.x,
        top: Math.max(0, counterTL.y),
        bottom: counterBR.y,
      },
    ]);

    // 地面阴影
    ctx.save();
    ctx.fillStyle = 'rgba(36,22,58,0.32)';
    ctx.beginPath();
    ctx.ellipse(tankCX, tankBottom - h * 0.006, tankW * 0.46, h * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (tankSprite) ctx.drawImage(tankSprite.canvas, tankX, tankY, tankW, tankH);

    // 缸内鱼：限制在前玻璃范围内
    const gx = tankX + tankW * TANK_GLASS.x0;
    const gy = tankY + tankH * TANK_GLASS.y0;
    const gw = tankW * (TANK_GLASS.x1 - TANK_GLASS.x0);
    const gh = tankH * (TANK_GLASS.y1 - TANK_GLASS.y0);
    const saleFish = state.fish.filter((f) => f.tank === 'sale' && !f.egg && !f.dead).slice(0, 5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, gy, gw, gh);
    ctx.clip();
    if (!saleFish.length) {
      const fs = Math.max(11, Math.min(18, h * 0.028));
      ctx.font = `600 ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = '待售区空着';
      const tw = ctx.measureText(label).width;
      const bx = gx + gw / 2 - tw / 2 - fs * 0.7;
      const by = gy + gh * 0.34;
      const bh = fs * 2;
      ctx.fillStyle = 'rgba(4,32,48,0.5)';
      ctx.beginPath();
      ctx.roundRect(bx, by, tw + fs * 1.4, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(226,248,255,0.95)';
      ctx.fillText(label, gx + gw / 2, by + bh / 2 + 0.5);
    }
    saleFish.forEach((f, i) => {
      ctx.save();
      const fx = gx + gw * (0.16 + i * 0.17) + Math.sin(now * 0.7 + i) * gw * 0.03;
      const fy = gy + gh * (0.42 + Math.sin(now * 0.9 + i * 2) * 0.16);
      ctx.translate(fx, fy);
      const facing = Math.sin(now * 0.5 + i * 1.7) > 0 ? 1 : -1;
      ctx.scale(facing, 1);
      drawFish(ctx, {
        sp: f.sp,
        fin: f.fin,
        size: Math.min(gw / 5.2, gh * 0.62),
        t: now,
        phase: i * 3,
      });
      ctx.restore();
    });
    if (this.saleFlash > 0) {
      this.saleFlash = Math.max(0, this.saleFlash - dt * 1.2);
      ctx.globalAlpha = this.saleFlash * 0.45;
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.globalAlpha = 1;
    }
    // 玻璃斜向反光
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(gx + gw * 0.12, gy);
    ctx.lineTo(gx + gw * 0.34, gy);
    ctx.lineTo(gx + gw * 0.02, gy + gh);
    ctx.lineTo(gx - gw * 0.08, gy + gh);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // 价格牌：钉在木柜正面
    const tagW = Math.max(56, tankW * 0.3);
    const tagH = Math.max(20, tagW * 0.4);
    const tagX = tankCX - tagW / 2;
    const tagY = tankY + tankH * 0.66;
    ctx.save();
    ctx.translate(tagX + tagW / 2, tagY + tagH / 2);
    ctx.rotate(-0.015);
    ctx.fillStyle = '#f6edd2';
    ctx.fillRect(-tagW / 2, -tagH / 2, tagW, tagH);
    ctx.strokeStyle = '#bda274';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-tagW / 2, -tagH / 2, tagW, tagH);
    ctx.fillStyle = '#5a3f22';
    ctx.font = `700 ${Math.max(10, tagH * 0.6)}px "Trebuchet MS",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${state.askingPrice}`, 0, 1);
    ctx.restore();

    // ---- 近处顾客：销售缸前面 ----
    for (const c of [...state.customers].sort((a, b) => a.y - b.y)) {
      const feetY = floorTop + c.y * (h - floorTop) * 0.95;
      if (feetY >= h * 0.775) this.drawCustomer(c, now, floorTop);
    }
  }

  /** 柜台后方的店主：待机呼吸 / 招手 / 成交道谢 / 招呼气泡 */
  private drawShopkeeper(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    now: number,
    dt: number,
    state: GameState,
    w: number,
    h: number,
  ): void {
    const rect = coverRect(img, w, h, 0.5);

    // 成交 → 道谢
    if (this.lastSold < 0) this.lastSold = state.stats.sold;
    if (state.stats.sold > this.lastSold) {
      this.lastSold = state.stats.sold;
      this.cheerTimer = 3.2;
      this.bubbleShow = true;
      this.bubbleClock = 3.2;
      this.bubbleText = '谢谢惠顾！';
    } else if (this.lastSold !== state.stats.sold) {
      this.lastSold = state.stats.sold;
    }
    if (this.cheerTimer > 0) this.cheerTimer = Math.max(0, this.cheerTimer - dt);

    // 招呼气泡节奏
    this.bubbleClock -= dt;
    if (this.bubbleClock <= 0) {
      this.bubbleShow = !this.bubbleShow;
      if (this.bubbleShow) {
        this.bubbleText = SHOPKEEPER_LINES[this.bubbleIndex++ % SHOPKEEPER_LINES.length];
        this.bubbleClock = 2.8;
      } else {
        this.bubbleClock = 3.5 + Math.random() * 3.5;
      }
    }

    const sprite = getNpc('shopkeeper', 'front');
    // 站在柜台里面：脚落在柜台后方，随后用背景像素把柜台重新盖回去
    const x = Math.max(w * 0.03, Math.min(rect.x + rect.w * 0.072, w * 0.9));
    // 放大一档，同时把脚往下挪，保持腰部仍然对齐柜台顶面（否则会重新露出腿）
    const totalH = Math.max(170, Math.min(390, rect.h * 0.32));
    const feetY = rect.y + rect.h * 0.753;
    const bob = Math.sin(now * 1.5) * totalH * 0.008 + (this.cheerTimer > 0 ? Math.sin(now * 13) * totalH * 0.016 : 0);

    if (sprite) {
      const dw = totalH * sprite.ratio;
      ctx.save();
      ctx.translate(x, feetY + bob);
      ctx.rotate(this.cheerTimer > 0 ? Math.sin(now * 13) * 0.02 : Math.sin(now * 1.1) * 0.004);
      ctx.drawImage(sprite.img, -dw / 2, -totalH, dw, totalH);
      ctx.restore();

      // 用背景原像素重新覆盖柜台：老板的下半身真正被柜台挡住，不会浮在桌面上
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const sx = 0;
      const sy = ih * 0.55;
      const sw = iw * 0.34;
      const sh = ih * 0.32;
      const kx = rect.w / iw;
      const ky = rect.h / ih;
      ctx.drawImage(img, sx, sy, sw, sh, rect.x + sx * kx, rect.y + sy * ky, sw * kx, sh * ky);
    }
    // 招呼气泡
    if (this.bubbleShow && this.bubbleText) {
      const fs = Math.max(10, Math.min(15, h * 0.026));
      ctx.save();
      ctx.font = `600 ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
      const tw = ctx.measureText(this.bubbleText).width;
      const padX = fs * 0.85;
      const padY = fs * 0.6;
      const bw = tw + padX * 2;
      const bh = fs + padY * 2;
      const bx = Math.max(6, Math.min(x - bw / 2, w - bw - 6));
      const by = Math.max(6, feetY + bob - totalH * 1.02 - bh - fs * 0.6);
      const rr = bh * 0.42;
      ctx.fillStyle = 'rgba(252,248,236,0.96)';
      ctx.strokeStyle = 'rgba(90,70,50,0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, rr);
      ctx.fill();
      ctx.stroke();
      // 小尾巴
      const tailX = Math.max(bx + rr, Math.min(x, bx + bw - rr));
      ctx.beginPath();
      ctx.moveTo(tailX - fs * 0.36, by + bh - 1);
      ctx.lineTo(tailX, by + bh + fs * 0.7);
      ctx.lineTo(tailX + fs * 0.36, by + bh - 1);
      ctx.closePath();
      ctx.fillStyle = 'rgba(252,248,236,0.96)';
      ctx.fill();
      ctx.fillStyle = '#3b2f24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.bubbleText, bx + bw / 2, by + bh / 2 + 0.5);
      ctx.restore();
    }
  }

  /** 图片还没加载好时的程序化降级画面 */
  private renderRoom(dt: number, now: number): void {
    const ctx = this.ctx;
    const state = this.getState();
    const w = this.w;
    const h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const wallH = h * WALL;
    const floorTop = wallH;

    // 底色（避免顶部出现未绘制区域）
    ctx.fillStyle = '#1b2622';
    ctx.fillRect(0, 0, w, h);

    // ---- 天花板与灯带 ----
    const ceil = ctx.createLinearGradient(0, 0, 0, h * 0.07);
    ceil.addColorStop(0, '#241b16');
    ceil.addColorStop(1, '#3a2c22');
    ctx.fillStyle = ceil;
    ctx.fillRect(0, 0, w, h * 0.07);
    for (let i = 0; i < 3; i++) {
      const cx = w * (0.24 + i * 0.26);
      const g = ctx.createLinearGradient(cx, 0, cx, h * 0.1);
      g.addColorStop(0, 'rgba(255,248,214,0.95)');
      g.addColorStop(1, 'rgba(255,248,214,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.02, h * 0.055);
      ctx.lineTo(cx + w * 0.02, h * 0.055);
      ctx.lineTo(cx + w * 0.07, h * 0.1);
      ctx.lineTo(cx - w * 0.07, h * 0.1);
      ctx.closePath();
      ctx.fill();
    }

    // ---- 墙面 ----
    const wall = ctx.createLinearGradient(0, h * 0.05, 0, wallH);
    wall.addColorStop(0, '#efe6cf');
    wall.addColorStop(0.65, '#e2d6bb');
    wall.addColorStop(1, '#c9bb9d');
    ctx.fillStyle = wall;
    ctx.fillRect(0, h * 0.06, w, wallH - h * 0.06);
    // 墙面竖向纹理
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#7a6a50';
    for (let x = 0; x < w; x += 26) ctx.fillRect(x, h * 0.06, 12, wallH - h * 0.06);
    ctx.restore();
    // 踢脚线
    ctx.fillStyle = '#8c7355';
    ctx.fillRect(0, wallH - h * 0.018, w, h * 0.018);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(0, wallH - h * 0.018, w, h * 0.004);

    // ---- 海报 ----
    const px = w * 0.055;
    const py = h * 0.11;
    const pw = w * 0.185;
    const ph = wallH * 0.56;
    ctx.save();
    ctx.fillStyle = '#f7f2e2';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#b9a888';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#4f7f95';
    ctx.fillRect(px, py, pw, h * 0.026);
    const posterFish: [number, number][] = [
      [0, 8],
      [2, 17],
      [4, 3],
      [7, 11],
    ];
    posterFish.forEach(([sp, fin], i) => {
      ctx.save();
      ctx.translate(px + pw * (0.28 + (i % 2) * 0.44), py + ph * (0.34 + Math.floor(i / 2) * 0.36));
      drawFish(ctx, { sp, fin, size: Math.min(pw * 0.34, ph * 0.2), t: 0.7, phase: i * 2 });
      ctx.restore();
    });
    ctx.restore();

    // ---- 展示柜 ----
    const sx = w * 0.29;
    const sy = h * 0.16;
    const sw = w * 0.5;
    const sh = wallH * 0.6;
    ctx.save();
    ctx.fillStyle = 'rgba(50,30,70,0.28)';
    ctx.fillRect(sx + w * 0.008, sy + h * 0.012, sw, sh);
    const shelfGrad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    shelfGrad.addColorStop(0, '#6a4a9e');
    shelfGrad.addColorStop(1, '#452f6b');
    ctx.fillStyle = shelfGrad;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = '#2f2048';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, sy, sw, sh);
    // 三层展示缸
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 4; i++) {
        const tw = sw / 4 - w * 0.012;
        const tx = sx + w * 0.006 + i * (sw / 4);
        const ty = sy + sh * (0.1 + row * 0.44);
        const th = sh * 0.3;
        const g = ctx.createLinearGradient(0, ty, 0, ty + th);
        g.addColorStop(0, '#a9eefb');
        g.addColorStop(0.55, '#3d9dc4');
        g.addColorStop(1, '#124f74');
        ctx.fillStyle = g;
        ctx.fillRect(tx, ty, tw, th);
        ctx.strokeStyle = 'rgba(240,252,255,0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx, ty, tw, th);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(tx, ty, tw, th * 0.16);
        // 缸内小鱼
        ctx.save();
        const fx = tx + tw * (0.34 + 0.34 * ((Math.sin(now * 0.6 + i + row) + 1) / 2));
        ctx.translate(fx, ty + th * 0.55);
        drawFish(ctx, {
          sp: (i * 3 + row * 5 + 1) % 11,
          fin: (i * 5 + row * 3 + 2) % 21,
          size: Math.min(tw, th) * 0.5,
          t: now,
          phase: i + row,
        });
        ctx.restore();
      }
    }
    // 柜面装饰
    ctx.fillStyle = '#e8dfc6';
    ctx.fillRect(sx - w * 0.012, sy - h * 0.018, sw + w * 0.024, h * 0.02);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ['#d2564a', '#3f8fc0', '#e0b23a'][i];
      ctx.fillRect(sx + w * 0.03 + i * w * 0.028, sy + h * 0.006, w * 0.016, h * 0.028);
    }
    ctx.restore();

    // ---- 地面 ----
    const fg = ctx.createLinearGradient(0, floorTop, 0, h);
    fg.addColorStop(0, '#a696c8');
    fg.addColorStop(0.55, '#b7a6d8');
    fg.addColorStop(1, '#8d7cb5');
    ctx.fillStyle = fg;
    ctx.fillRect(0, floorTop, w, h - floorTop);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, floorTop, w, h - floorTop);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1.2;
    const vpX = w * 0.5;
    for (let i = -12; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(vpX + i * w * 0.055, floorTop);
      ctx.lineTo(vpX + i * w * 0.24, h);
      ctx.stroke();
    }
    for (let i = 1; i <= 7; i++) {
      const t = i / 7;
      const y = floorTop + (h - floorTop) * (t * t);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // 地面反光
    const sheen = ctx.createLinearGradient(0, floorTop, 0, h * 0.8);
    sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, floorTop, w, h * 0.3);
    ctx.restore();

    // ---- 门（右侧）----
    const dx = w * 0.845;
    const dw = w * 0.135;
    const doorTop = h * 0.1;
    ctx.fillStyle = '#3d4c52';
    ctx.fillRect(dx, doorTop, dw, wallH - doorTop + h * 0.01);
    const dg = ctx.createLinearGradient(dx, 0, dx + dw, 0);
    dg.addColorStop(0, 'rgba(206,242,255,0.85)');
    dg.addColorStop(0.55, 'rgba(150,210,232,0.55)');
    dg.addColorStop(1, 'rgba(90,150,175,0.35)');
    ctx.fillStyle = dg;
    ctx.fillRect(dx + dw * 0.1, doorTop + h * 0.02, dw * 0.8, wallH - doorTop - h * 0.02);
    // 门把
    ctx.fillStyle = '#d9b45a';
    ctx.fillRect(dx + dw * 0.12, h * 0.42, w * 0.006, h * 0.03);
    // 门口光
    const doorGlow = ctx.createRadialGradient(dx + dw * 0.5, wallH, 0, dx + dw * 0.5, wallH, w * 0.16);
    doorGlow.addColorStop(0, 'rgba(255,255,230,0.3)');
    doorGlow.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = doorGlow;
    ctx.beginPath();
    ctx.ellipse(dx + dw * 0.5, wallH + h * 0.05, w * 0.16, h * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    // SALE 牌
    ctx.save();
    ctx.translate(dx - w * 0.028, h * 0.19);
    ctx.rotate(0.05);
    ctx.fillStyle = '#c33b32';
    ctx.fillRect(0, 0, w * 0.07, h * 0.09);
    ctx.strokeStyle = '#8d221c';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w * 0.07, h * 0.09);
    ctx.fillStyle = '#fff3e0';
    ctx.font = `700 ${Math.max(10, h * 0.028)}px "Trebuchet MS",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SALE', w * 0.035, h * 0.055);
    ctx.restore();

    // ---- 销售缸（木头展台）----
    const vx = w * 0.3;
    const vy = h * 0.56;
    const vw = w * 0.32;
    const vh = h * 0.2;
    // 展台
    ctx.fillStyle = 'rgba(40,26,16,0.35)';
    ctx.beginPath();
    ctx.ellipse(vx + vw / 2, vy + vh + h * 0.1, vw * 0.62, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    const stand = ctx.createLinearGradient(0, vy + vh, 0, vy + vh + h * 0.11);
    stand.addColorStop(0, '#7d5630');
    stand.addColorStop(1, '#523418');
    ctx.fillStyle = stand;
    ctx.beginPath();
    ctx.moveTo(vx + vw * 0.02, vy + vh);
    ctx.lineTo(vx + vw * 0.98, vy + vh);
    ctx.lineTo(vx + vw * 0.9, vy + vh + h * 0.1);
    ctx.lineTo(vx + vw * 0.1, vy + vh + h * 0.1);
    ctx.closePath();
    ctx.fill();
    // 缸体
    ctx.fillStyle = '#221c33';
    ctx.fillRect(vx - w * 0.008, vy - h * 0.012, vw + w * 0.016, vh + h * 0.024);
    const tg = ctx.createLinearGradient(0, vy, 0, vy + vh);
    tg.addColorStop(0, '#b7f0fb');
    tg.addColorStop(0.45, '#39a2c9');
    tg.addColorStop(1, '#0f4d70');
    ctx.fillStyle = tg;
    ctx.fillRect(vx, vy, vw, vh);
    // 缸内水草与鱼
    ctx.fillStyle = 'rgba(60,150,90,0.55)';
    for (let i = 0; i < 5; i++) {
      const gx = vx + vw * (0.12 + i * 0.18);
      ctx.beginPath();
      ctx.moveTo(gx, vy + vh);
      ctx.quadraticCurveTo(gx + w * 0.01, vy + vh * 0.6, gx + w * 0.004, vy + vh * 0.45);
      ctx.quadraticCurveTo(gx - w * 0.008, vy + vh * 0.7, gx - w * 0.006, vy + vh);
      ctx.closePath();
      ctx.fill();
    }
    const saleFish = state.fish.filter((f) => f.tank === 'sale' && !f.egg && !f.dead).slice(0, 4);
    if (!saleFish.length) {
      ctx.fillStyle = 'rgba(4,28,44,0.5)';
      ctx.font = `600 ${Math.max(10, h * 0.026)}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('待售区空着', vx + vw / 2, vy + vh * 0.56);
    }
    saleFish.forEach((f, i) => {
      ctx.save();
      const fx = vx + vw * (0.18 + i * 0.21) + Math.sin(now * 0.7 + i) * vw * 0.03;
      const fy = vy + vh * (0.5 + Math.sin(now * 0.9 + i * 2) * 0.12);
      ctx.translate(fx, fy);
      drawFish(ctx, {
        sp: f.sp,
        fin: f.fin,
        size: Math.min(vw / 5.4, vh * 0.56),
        t: now,
        phase: i * 3,
      });
      ctx.restore();
    });
    // 玻璃反光
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(vx, vy, vw, vh * 0.18);
    ctx.strokeStyle = 'rgba(240,252,255,0.8)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(vx, vy, vw, vh);
    // 价格牌
    const tagW = w * 0.062;
    const tagH = h * 0.038;
    const tagX = vx + vw - tagW * 0.9;
    const tagY = vy + vh + h * 0.012;
    ctx.fillStyle = '#f4ecd2';
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.strokeStyle = '#b7a072';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tagX, tagY, tagW, tagH);
    ctx.fillStyle = '#5a3f22';
    ctx.font = `700 ${Math.max(9, h * 0.021)}px "Trebuchet MS",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`$${state.askingPrice}`, tagX + tagW / 2, tagY + tagH * 0.7);

    if (this.saleFlash > 0) {
      this.saleFlash = Math.max(0, this.saleFlash - dt * 1.2);
      ctx.save();
      ctx.globalAlpha = this.saleFlash * 0.4;
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(vx - w * 0.02, vy - h * 0.02, vw + w * 0.04, vh + h * 0.06);
      ctx.restore();
    }

    // ---- 柜台 ----
    const cw = w * 0.17;
    const ch = h * 0.14;
    const cx = w * 0.02;
    const cy = h * 0.68;
    ctx.fillStyle = 'rgba(30,20,40,0.32)';
    ctx.beginPath();
    ctx.ellipse(cx + cw / 2, cy + ch + h * 0.02, cw * 0.62, h * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    const cg = ctx.createLinearGradient(cx, cy, cx, cy + ch);
    cg.addColorStop(0, '#7a5aa8');
    cg.addColorStop(1, '#4c356e');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + cw, cy - h * 0.02);
    ctx.lineTo(cx + cw, cy + ch);
    ctx.lineTo(cx, cy + ch + h * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9b7cc4';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + cw, cy - h * 0.02);
    ctx.lineTo(cx + cw, cy - h * 0.004);
    ctx.lineTo(cx, cy + h * 0.016);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2c3b44';
    ctx.fillRect(cx + cw * 0.52, cy - h * 0.07, cw * 0.3, h * 0.07);
    ctx.fillStyle = '#8ee4f0';
    ctx.fillRect(cx + cw * 0.55, cy - h * 0.062, cw * 0.24, h * 0.036);
    // 柜台上的小摆件
    ctx.fillStyle = '#d9b45a';
    ctx.beginPath();
    ctx.arc(cx + cw * 0.18, cy - h * 0.01, h * 0.018, 0, Math.PI * 2);
    ctx.fill();

    // ---- 盆栽 ----
    const plantX = w * 0.79;
    const plantY = h * 0.72;
    ctx.fillStyle = 'rgba(30,20,40,0.3)';
    ctx.beginPath();
    ctx.ellipse(plantX, plantY + h * 0.1, w * 0.026, h * 0.014, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a8762f';
    ctx.beginPath();
    ctx.moveTo(plantX - w * 0.02, plantY);
    ctx.lineTo(plantX + w * 0.02, plantY);
    ctx.lineTo(plantX + w * 0.014, plantY + h * 0.08);
    ctx.lineTo(plantX - w * 0.014, plantY + h * 0.08);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = ['#3f8a56', '#56a86a', '#2f7046'][i % 3];
      ctx.beginPath();
      ctx.ellipse(
        plantX + Math.cos(i * 1.2) * w * 0.016,
        plantY - h * 0.03 + Math.sin(i * 1.7) * h * 0.03,
        w * 0.013,
        h * 0.035,
        i * 0.7,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // ---- 顾客 ----
    const sorted = [...state.customers].sort((a, b) => a.y - b.y);
    for (const c of sorted) this.drawCustomer(c, now, floorTop);

    // ---- 顶部光束与暗角 ----
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const bx = w * (0.24 + i * 0.26);
      const g = ctx.createLinearGradient(bx, h * 0.08, bx, h * 0.75);
      g.addColorStop(0, 'rgba(255,246,210,0.1)');
      g.addColorStop(1, 'rgba(255,246,210,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx - w * 0.02, h * 0.08);
      ctx.lineTo(bx + w * 0.02, h * 0.08);
      ctx.lineTo(bx + w * 0.1, h * 0.75);
      ctx.lineTo(bx - w * 0.1, h * 0.75);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(8,10,8,0.4)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  private drawCustomer(c: Customer, now: number, floorTop: number): void {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const x = c.x * w;
    const y = floorTop + c.y * (h - floorTop) * 0.95;
    // 朝向：位移低通累积，超过阈值才允许翻面（迟滞），避免遇到人时左右乱转
    const prevX = this.lastPos.get(c.id);
    let accum = this.dirAccum.get(c.id) ?? 0;
    if (prevX !== undefined) accum = accum * 0.9 + (x - prevX);
    const current = this.faceDir.get(c.id) ?? ((c.facing ?? 1) > 0 ? 1 : -1);
    if (accum > 7) {
      this.faceDir.set(c.id, 1);
      accum = 7;
    } else if (accum < -7) {
      this.faceDir.set(c.id, -1);
      accum = -7;
    } else {
      this.faceDir.set(c.id, current);
    }
    this.dirAccum.set(c.id, accum);
    this.lastPos.set(c.id, x);
    const faceRight = (this.faceDir.get(c.id) ?? 1) > 0;
    // 朝右 / 朝左各一套立绘，不做镜像
    const sprite = getNpc(c.npc, faceRight ? 'side' : 'left');
    if (!sprite) {
      this.drawChibi(c, now, floorTop);
      return;
    }
    // 统一身高：不做「走近变大」，避免看起来像被缩放
    const targetH = Math.max(54, Math.min(185, h * 0.235));
    const dw = targetH * sprite.ratio;
    const walking = c.state !== 'browse';
    const phase = c.x * 9 + (c.kind + 1) * 1.7;
    const bob = walking ? Math.abs(Math.sin(now * 6.5 + phase)) * targetH * 0.02 : 0;

    // 接地阴影
    ctx.save();
    ctx.fillStyle = 'rgba(36,24,56,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, dw * 0.36, targetH * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y - bob);
    ctx.drawImage(sprite.img, -dw / 2, -targetH, dw, targetH);
    ctx.restore();

    // 想气泡
    const br = Math.max(9, targetH * 0.13);
    const bx = x + dw * (faceRight ? 0.44 : -0.44);
    const by = y - targetH - br * 0.5;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.beginPath();
    ctx.arc(x + dw * 0.22, y - targetH * 0.88, br * 0.28, 0, Math.PI * 2);
    ctx.arc(bx - br * 0.65, y - targetH * 0.97, br * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx, by, br, br * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8562a';
    ctx.font = `700 ${Math.max(9, br * 1.15)}px "Trebuchet MS",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.bubble, bx, by + 1);
    ctx.restore();
  }

  private drawChibi(c: Customer, now: number, floorTop: number): void {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const scale = h * 0.0011 + 0.7;
    const x = c.x * w;
    const y = floorTop + c.y * (h - floorTop) * 0.95;
    const walking = c.state !== 'browse';
    const walk = Math.sin(now * 7 + c.id.length) * (walking ? 1 : 0.15);
    const bodyH = h * 0.085 * scale;
    const headR = h * 0.024 * scale;

    ctx.save();
    ctx.translate(x, y);
    // 影子
    ctx.fillStyle = 'rgba(36,24,56,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, headR * 1.2, headR * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    // 腿
    ctx.strokeStyle = c.pants;
    ctx.lineWidth = Math.max(2, headR * 0.34);
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-headR * 0.3 + i * headR * 0.6, -bodyH * 0.3);
      ctx.lineTo(-headR * 0.3 + i * headR * 0.6 + walk * headR * 0.2, 0);
      ctx.stroke();
    }
    // 身体
    ctx.fillStyle = c.shirt;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.66, -bodyH * 0.92);
    ctx.quadraticCurveTo(0, -bodyH * 1.04, headR * 0.66, -bodyH * 0.92);
    ctx.lineTo(headR * 0.5, -bodyH * 0.28);
    ctx.lineTo(-headR * 0.5, -bodyH * 0.28);
    ctx.closePath();
    ctx.fill();
    // 手臂
    ctx.strokeStyle = '#f0c9a8';
    ctx.lineWidth = Math.max(2, headR * 0.26);
    ctx.beginPath();
    ctx.moveTo(-headR * 0.62, -bodyH * 0.84);
    ctx.lineTo(-headR * 0.8 - walk * headR * 0.12, -bodyH * 0.42);
    ctx.moveTo(headR * 0.62, -bodyH * 0.84);
    ctx.lineTo(headR * 0.8 + walk * headR * 0.12, -bodyH * 0.42);
    ctx.stroke();
    // 头
    ctx.fillStyle = '#f7d7b6';
    ctx.beginPath();
    ctx.arc(0, -bodyH * 1.24, headR, 0, Math.PI * 2);
    ctx.fill();
    // 头发
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.arc(0, -bodyH * 1.29, headR * 1.03, Math.PI * 1.03, Math.PI * 1.97);
    ctx.fill();
    if (c.kind % 3 === 0) {
      ctx.beginPath();
      ctx.ellipse(-headR * 0.86, -bodyH * 1.18, headR * 0.36, headR * 0.8, 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    // 眼睛
    ctx.fillStyle = '#2b2b33';
    for (const ex of [-headR * 0.3, headR * 0.3]) {
      ctx.beginPath();
      ctx.arc(ex, -bodyH * 1.26, Math.max(1, headR * 0.11), 0, Math.PI * 2);
      ctx.fill();
    }
    // 想气泡
    const bx = headR * 1.7;
    const by = -bodyH * 1.85;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(headR * 0.9, -bodyH * 1.6, headR * 0.14, 0, Math.PI * 2);
    ctx.arc(bx - headR * 0.5, -bodyH * 1.72, headR * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + headR * 0.1, by, headR * 0.92, headR * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8562a';
    ctx.font = `700 ${Math.max(9, headR * 0.92)}px "Trebuchet MS",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.bubble, bx + headR * 0.1, by + headR * 0.02);
    ctx.restore();
  }
}