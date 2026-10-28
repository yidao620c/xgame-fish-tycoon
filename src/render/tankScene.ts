/** 水缸场景：程序化绘制水族箱 + 鱼群动画 + 拾取 */

import { EGG_YEARS, ITEM_MAP, YEAR_SECONDS } from '../core/items';
import { growthProgress, isAdult } from '../core/state';
import type { Fish, GameState, TankId } from '../core/types';
import { drawTankBackdrop, getImage, TANK_BG } from '../art';
import { drawEgg, drawFish, shade } from './fishArt';

const TANK_WATER_TOP: Record<TankId, string> = {
  tank1: '#4ec6e6',
  tank2: '#3aa6d6',
  sale: '#4aa6d8',
};

interface Bubble {
  x: number;
  y: number;
  r: number;
  sp: number;
  ph: number;
}

interface Flake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  life: number;
}

const TANK_THEME: Record<
  TankId,
  { deep: string; mid: string; top: string; glow: string; plants: number; red: boolean; wood: boolean }
> = {
  tank1: { deep: '#0d4a74', mid: '#1f86bd', top: '#8fdcf2', glow: 'rgba(180,240,255,0.30)', plants: 1, red: false, wood: false },
  tank2: { deep: '#0b4368', mid: '#1c7fb4', top: '#84d3ec', glow: 'rgba(170,235,255,0.28)', plants: 0.85, red: true, wood: true },
  sale: { deep: '#12587f', mid: '#2794c4', top: '#9ce3f5', glow: 'rgba(200,245,255,0.32)', plants: 0.45, red: false, wood: false },
};

export class TankView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 1;
  private h = 1;
  private bubbles: Bubble[] = [];
  private flakes: Flake[] = [];
  private screenFish: { fish: Fish; x: number; y: number; r: number }[] = [];
  private facing = new Map<string, number>();
  private pointer: { x: number; y: number; down: boolean } = { x: 0, y: 0, down: false };
  private ripple: { x: number; y: number; t: number }[] = [];
  private gravelCache: HTMLCanvasElement | null = null;
  private gravelKey = '';
  private getState: () => GameState;
  private onSelect: (id: string | null) => void;
  private onTapFood: (x: number, y: number) => void;

  constructor(
    canvas: HTMLCanvasElement,
    getState: () => GameState,
    onSelect: (id: string | null) => void,
    onTapFood: (x: number, y: number) => void,
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;
    this.getState = getState;
    this.onSelect = onSelect;
    this.onTapFood = onTapFood;
    this.bindPointer();
    this.resize();
  }

  private bindPointer(): void {
    const el = this.canvas;
    const toLocal = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };
    el.addEventListener('pointerdown', (ev) => {
      const p = toLocal(ev);
      this.pointer = { ...p, down: true };
      el.setPointerCapture(ev.pointerId);
      const hit = this.hitTest(p.x, p.y);
      this.ripple.push({ x: p.x, y: p.y, t: 0 });
      if (hit) {
        this.onSelect(hit.id);
      } else {
        this.onSelect(null);
        this.onTapFood(p.x, p.y);
      }
    });
    el.addEventListener('pointermove', (ev) => {
      const p = toLocal(ev);
      this.pointer = { ...p, down: this.pointer.down };
      const hit = this.hitTest(p.x, p.y);
      el.style.cursor = hit ? 'pointer' : 'default';
    });
    el.addEventListener('pointerup', () => {
      this.pointer.down = false;
    });
    el.addEventListener('pointerleave', () => {
      this.pointer.down = false;
    });
  }

  private hitTest(x: number, y: number): Fish | null {
    let best: Fish | null = null;
    let bestDist = Infinity;
    for (const s of this.screenFish) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < Math.max(18, s.r * 0.9) && d < bestDist) {
        best = s.fish;
        bestDist = d;
      }
    }
    return best;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  /** 主渲染 */
  render(dt: number, now: number): void {
    for (const r of this.ripple) r.t += dt;
    const ctx = this.ctx;
    const state = this.getState();
    const tankId = state.activeTank;
    const theme = TANK_THEME[tankId];
    const tank = state.tanks[tankId];
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    const w = this.w;
    const h = this.h;
    const gravelY = h * 0.84;
    const bg = getImage(TANK_BG[tankId]);

    if (bg) {
      // ---- 位图背景（生成资产）----
      drawTankBackdrop(ctx, bg, w, h, TANK_WATER_TOP[tankId]);
      // 统一色调，让程序化鱼与照片融合
      ctx.fillStyle = 'rgba(6,52,78,0.12)';
      ctx.fillRect(0, 0, w, h);
      // 流动光柱（高斯模糊，避免硬边）
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(10px)';
      for (let i = 0; i < 3; i++) {
        const x = w * (0.24 + i * 0.25) + Math.sin(now * 0.22 + i * 1.7) * w * 0.025;
        const g = ctx.createLinearGradient(x, 0, x + w * 0.05, h * 0.92);
        g.addColorStop(0, 'rgba(200,246,255,0.16)');
        g.addColorStop(0.55, 'rgba(200,246,255,0.07)');
        g.addColorStop(1, 'rgba(200,246,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.05, 0);
        ctx.lineTo(x + w * 0.06, 0);
        ctx.lineTo(x + w * 0.17, h * 0.92);
        ctx.lineTo(x - w * 0.08, h * 0.92);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // 边角暗角
      const vig = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.34, w / 2, h * 0.5, Math.max(w, h) * 0.72);
      vig.addColorStop(0, 'rgba(2,18,28,0)');
      vig.addColorStop(1, 'rgba(2,18,28,0.42)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    } else {
      // ---- 程序化降级背景（图片还没加载好时）----
      const water = ctx.createLinearGradient(0, 0, 0, h);
      water.addColorStop(0, theme.top);
      water.addColorStop(0.28, theme.mid);
      water.addColorStop(0.72, theme.deep);
      water.addColorStop(1, shade(theme.deep, -0.25));
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.3, -h * 0.15, 0, w * 0.3, -h * 0.15, h * 0.95);
      glow.addColorStop(0, theme.glow);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      this.drawPlants(now, theme, 'back');
      if (theme.wood) this.drawDriftwood(w, h, gravelY);
      else this.drawRocks(w, h, gravelY);
      this.drawGravel(gravelY);
    }

    // ---- 装备与陈设 ----
    this.drawDecor(state, tankId, w, h, gravelY, now);

    // ---- 食物颗粒 ----
    this.updateFlakes(state, tank.food, dt, w, h);
    for (const f of this.flakes) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#e8b552';
      ctx.beginPath();
      ctx.ellipse(0, 0, f.r * 1.5, f.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- 鱼 ----
    this.screenFish = [];
    const fish = state.fish.filter((f) => f.tank === tankId);
    const baseSize = Math.max(40, Math.min(152, Math.min(w, h) * 0.19));
    for (const f of fish) {
      this.drawOneFish(f, now, dt, baseSize, tankId, state);
    }
    // 前景观赏鱼优先级：选中的最后画
    const selectedFish = state.selected ? fish.find((f) => f.id === state.selected && !f.dead) : null;
    if (selectedFish) {
      const pos = this.screenFish.find((s) => s.fish.id === selectedFish.id);
      if (pos) this.drawSelection(pos.x, pos.y, pos.r);
    }

    // ---- 前景水草（仅程序化背景时）----
    if (!bg) this.drawPlants(now, theme, 'front');

    // ---- 气泡 ----
    this.updateBubbles(dt, w, h, gravelY);
    for (const b of this.bubbles) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(235,252,255,0.55)';
      ctx.fillStyle = 'rgba(220,248,255,0.16)';
      ctx.lineWidth = Math.max(0.8, b.r * 0.22);
      ctx.arc(b.x + Math.sin(now * 2 + b.ph) * 3, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // ---- 触摸涟漪 ----
    this.ripple = this.ripple.filter((r) => r.t < 1);
    for (const r of this.ripple) {
      const p = r.t / 1;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - p)})`;
      ctx.lineWidth = 2 * (1 - p) + 0.5;
      ctx.arc(r.x, r.y, 8 + p * 46, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ---- 玻璃反光 ----
    this.drawGlass(w, h, now);

    // ---- 空缸提示 ----
    if (!fish.length) {
      const msg =
        tankId === 'sale' ? '销售缸空着 — 把成鱼移进来标价出售' : '这个缸还空着 — 打开补给商店买一枚鱼卵';
      const fs = Math.max(13, Math.min(20, w * 0.017));
      ctx.save();
      ctx.font = `600 ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
      const tw = ctx.measureText(msg).width;
      const padX = fs * 1.2;
      const bx = w / 2 - tw / 2 - padX;
      const by = h * 0.4;
      const bh = fs * 2.2;
      ctx.fillStyle = 'rgba(3,24,38,0.55)';
      this.roundRect(bx, by, tw + padX * 2, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(230,247,255,0.94)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(msg, w / 2, by + bh / 2);
      ctx.restore();
    }
  }

  private drawOneFish(
    f: Fish,
    now: number,
    dt: number,
    baseSize: number,
    tankId: TankId,
    state: GameState,
  ): void {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const growth = f.egg ? 0 : growthProgress(f);
    const size = baseSize * (0.42 + 0.58 * growth) * (0.86 + 0.24 * (f.pregnancy > 0 ? 1 : 0));

    if (f.egg) {
      // 卵落在砾石床上，带光晖
      const x = f.x * w;
      const p = Math.min(1, f.age / EGG_YEARS);
      const r = Math.max(10, size * 0.22);
      const y = this.h * 0.84 + this.h * 0.02 - r * 0.4;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#04202e';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.72, r * 0.95, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'rgba(180,240,255,0.75)';
      ctx.shadowBlur = r * 0.9;
      drawEgg(ctx, { fin: f.fin, size: r, t: now, phase: f.seed, progress: p });
      ctx.restore();
      this.screenFish.push({ fish: f, x, y, r: r * 1.6 });
      const secs = Math.max(0, Math.ceil((EGG_YEARS - f.age) * YEAR_SECONDS));
      this.label(x, y - r - 10, `${secs}s`, 'rgba(210,245,255,0.95)', Math.max(10, baseSize * 0.2));
      return;
    }

    // 移动
    if (!f.dead) {
      const speed = 0.055 / (0.6 + growth) + 0.01;
      f.vx += (Math.random() - 0.5) * dt * 0.32;
      f.vy += (Math.random() - 0.5) * dt * 0.22;
      const maxV = speed * 0.5;
      f.vx = Math.max(-maxV, Math.min(maxV, f.vx));
      f.vy = Math.max(-maxV * 0.6, Math.min(maxV * 0.6, f.vy));
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const minX = 0.1 + size / w * 0.55;
      const maxX = 0.9 - size / w * 0.55;
      const minY = 0.12 + size / h * 0.6;
      const maxY = 0.79 - size / h * 0.55;
      if (f.x < minX) {
        f.x = minX;
        f.vx = Math.abs(f.vx) + 0.004;
      }
      if (f.x > maxX) {
        f.x = maxX;
        f.vx = -Math.abs(f.vx) - 0.004;
      }
      if (f.y < minY) {
        f.y = minY;
        f.vy = Math.abs(f.vy);
      }
      if (f.y > maxY) {
        f.y = maxY;
        f.vy = -Math.abs(f.vy);
      }
    } else {
      f.y = Math.min(0.94, f.y + dt * 0.01);
      f.x += Math.sin(now * 0.6 + f.seed) * dt * 0.004;
    }

    const x = f.x * w;
    const y = f.y * h;
    if (Math.abs(f.vx) > 0.004) this.facing.set(f.id, f.vx >= 0 ? 1 : -1);
    const facing = this.facing.get(f.id) ?? (f.vx >= 0 ? 1 : -1);

    // 身体投影
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#04202e';
    ctx.beginPath();
    ctx.ellipse(x + size * 0.04, y + size * 0.5, size * 0.42, size * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    if (f.dead) {
      ctx.rotate(Math.sin(now * 0.8 + f.seed) * 0.06);
      ctx.globalAlpha = 1;
    }
    ctx.scale(facing, 1);
    drawFish(ctx, {
      sp: f.sp,
      fin: f.fin,
      size,
      t: now,
      phase: f.seed * 0.37,
      dead: f.dead,
      baby: 1 - growth,
      alpha: f.health < 30 && !f.dead ? 0.82 : 1,
    });
    ctx.restore();

    this.screenFish.push({ fish: f, x, y, r: size * 0.6 });

    // 状态标记
    const topY = y - size * 0.55;
    if (f.dead) {
      this.label(x, topY - 6, '☠ 需要清理', 'rgba(255,170,160,0.95)', Math.max(10, baseSize * 0.2));
    } else if (!isAdult(f)) {
      const yrs = Math.floor(f.age);
      this.progress(x, topY - 8, size * 0.8, growth, String(yrs), '20');
    } else if (tankId === 'sale') {
      this.label(x, topY - 6, `$${f.price}`, 'rgba(255,232,160,0.95)', Math.max(10, baseSize * 0.21));
    }
    if (f.disease) {
      const bx = x + size * 0.52;
      const by = y - size * 0.4;
      const br = Math.max(7, size * 0.11);
      ctx.save();
      ctx.fillStyle = f.disease === 1 ? 'rgba(102,184,120,0.96)' : 'rgba(140,208,236,0.96)';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(6,26,36,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#07242f';
      ctx.font = `700 ${Math.max(9, br * 1.15)}px "PingFang SC",system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('病', bx, by + 0.5);
      ctx.restore();
    }
    void state;
  }

  private label(x: number, y: number, text: string, color: string, px: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `600 ${px}px "PingFang SC","Microsoft YaHei",system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(4,26,38,0.55)';
    const pad = px * 0.45;
    this.roundRect(x - tw / 2 - pad, y - px * 0.72, tw + pad * 2, px * 1.44, px * 0.5);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private progress(x: number, y: number, width: number, ratio: number, cur: string, max: string): void {
    const ctx = this.ctx;
    const bh = Math.max(5, width * 0.12);
    ctx.save();
    ctx.fillStyle = 'rgba(4,26,38,0.6)';
    this.roundRect(x - width / 2, y - bh / 2, width, bh, bh / 2);
    ctx.fill();
    const g = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
    g.addColorStop(0, '#7fd88a');
    g.addColorStop(1, '#e0f07a');
    ctx.fillStyle = g;
    this.roundRect(x - width / 2 + 1, y - bh / 2 + 1, Math.max(bh, (width - 2) * ratio), bh - 2, (bh - 2) / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `600 ${Math.max(9, bh * 1.5)}px "PingFang SC",system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${cur}/${max}`, x, y + 0.5);
    ctx.restore();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private drawSelection(x: number, y: number, r: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,232,150,0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -performance.now() * 0.02;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.25, r * 1.05, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawGravel(gravelY: number): void {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const layer = this.gravelLayer();
    const top = gravelY - h * 0.055;
    ctx.drawImage(layer, 0, top, w, h - top);

    // 与水体衔接的阴影
    const sh = ctx.createLinearGradient(0, gravelY - h * 0.06, 0, gravelY + h * 0.13);
    sh.addColorStop(0, 'rgba(4,28,42,0.45)');
    sh.addColorStop(0.35, 'rgba(4,28,42,0.22)');
    sh.addColorStop(1, 'rgba(4,28,42,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, gravelY - h * 0.06, w, h * 0.22);
  }

  /** 砾石床预渲染一层，避免每帧几百个卵石 */
  private gravelLayer(): HTMLCanvasElement {
    const key = `${Math.round(this.w)}x${Math.round(this.h)}`;
    if (this.gravelCache && this.gravelKey === key) return this.gravelCache;
    const h = this.h;
    const w = this.w;
    const height = Math.max(40, h * 0.24);
    const c = document.createElement('canvas');
    const dpr = this.dpr;
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(height * dpr));
    const g2 = c.getContext('2d');
    if (!g2) return c;
    g2.scale(dpr, dpr);

    const topY = height * 0.23;
    const grad = g2.createLinearGradient(0, topY, 0, height);
    grad.addColorStop(0, '#9aa39c');
    grad.addColorStop(0.2, '#a49c86');
    grad.addColorStop(0.68, '#8a8069');
    grad.addColorStop(1, '#5f5849');
    g2.fillStyle = grad;
    g2.beginPath();
    g2.moveTo(0, topY + height * 0.08);
    g2.quadraticCurveTo(w * 0.16, topY - height * 0.05, w * 0.34, topY + height * 0.03);
    g2.quadraticCurveTo(w * 0.58, topY + height * 0.12, w * 0.76, topY - height * 0.02);
    g2.quadraticCurveTo(w * 0.9, topY - height * 0.09, w, topY + height * 0.04);
    g2.lineTo(w, height);
    g2.lineTo(0, height);
    g2.closePath();
    g2.fill();

    let seed = 20240607;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const pebble = (x: number, y: number, rx: number, ry: number, rot: number, tone: number, alpha: number) => {
      const g = g2.createRadialGradient(x - rx * 0.35, y - ry * 0.45, rx * 0.15, x, y, rx * 1.15);
      g.addColorStop(0, `rgba(${tone + 34},${tone + 28},${tone + 12},${alpha})`);
      g.addColorStop(0.7, `rgba(${tone},${tone - 8},${tone - 24},${alpha})`);
      g.addColorStop(1, `rgba(${tone - 52},${tone - 52},${tone - 56},${alpha * 0.9})`);
      g2.beginPath();
      g2.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      g2.fillStyle = g;
      g2.fill();
    };

    // 后层小石
    const back = Math.floor(w * 0.35);
    for (let i = 0; i < back; i++) {
      const x = rand() * w;
      const y = topY + height * 0.06 + rand() * height * 0.34;
      const rx = 1.6 + rand() * 3;
      pebble(x, y, rx * 1.2, rx, rand() * 3, 168 + Math.floor(rand() * 40), 0.55);
    }
    // 前层大石
    const front = Math.floor(w * 0.22);
    for (let i = 0; i < front; i++) {
      const x = rand() * w;
      const y = topY + height * 0.42 + rand() * height * 0.5;
      const rx = 3 + rand() * 6;
      pebble(x, y, rx * 1.25, rx, rand() * 3, 176 + Math.floor(rand() * 46), 0.9);
    }
    // 少量彩石
    for (let i = 0; i < 12; i++) {
      const x = rand() * w;
      const y = topY + height * 0.5 + rand() * height * 0.4;
      g2.fillStyle = ['rgba(200,150,120,0.55)', 'rgba(150,170,190,0.5)', 'rgba(210,200,150,0.5)'][i % 3];
      g2.beginPath();
      g2.ellipse(x, y, 2.6, 2, rand() * 3, 0, Math.PI * 2);
      g2.fill();
    }

    this.gravelCache = c;
    this.gravelKey = key;
    return c;
  }

  private drawRocks(w: number, h: number, gravelY: number): void {
    const ctx = this.ctx;
    const cx = w * 0.55;
    const cy = gravelY + h * 0.035;
    const s = Math.min(w, h) * 0.36;

    const boulder = (
      ox: number,
      oy: number,
      sx: number,
      sy: number,
      dark: string,
      light: string,
    ) => {
      const x = cx + ox;
      const y = cy + oy;
      const rx = s * sx;
      const ry = s * sy;
      ctx.beginPath();
      ctx.moveTo(x - rx, y);
      ctx.lineTo(x - rx * 0.78, y - ry * 0.62);
      ctx.lineTo(x - rx * 0.34, y - ry * 0.96);
      ctx.lineTo(x + rx * 0.14, y - ry * 0.86);
      ctx.lineTo(x + rx * 0.52, y - ry * 0.98);
      ctx.lineTo(x + rx * 0.9, y - ry * 0.52);
      ctx.lineTo(x + rx, y);
      ctx.closePath();
      const g = ctx.createLinearGradient(x - rx * 0.5, y - ry, x + rx * 0.7, y);
      g.addColorStop(0, light);
      g.addColorStop(0.45, shade(dark, 0.16));
      g.addColorStop(1, shade(dark, -0.3));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(14,30,34,0.4)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // 顶部高光
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.7, y - ry * 0.62);
      ctx.quadraticCurveTo(x - rx * 0.1, y - ry * 1.02, x + rx * 0.6, y - ry * 0.7);
      ctx.strokeStyle = 'rgba(220,240,245,0.28)';
      ctx.lineWidth = Math.max(1.4, s * 0.012);
      ctx.stroke();
    };

    // 地面阴影
    ctx.beginPath();
    ctx.fillStyle = 'rgba(20,26,28,0.3)';
    ctx.ellipse(cx, cy + h * 0.01, s * 0.86, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    boulder(-s * 0.28, -h * 0.02, 0.42, 0.36, '#4e5a58', '#94a4a0');
    boulder(s * 0.3, h * 0.005, 0.5, 0.42, '#445050', '#879794');
    boulder(-s * 0.02, h * 0.01, 0.62, 0.5, '#3a4646', '#788886');

    // 苔藓
    ctx.fillStyle = 'rgba(72,150,96,0.42)';
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.02, cy - s * 0.46, s * 0.3, s * 0.05, 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(96,180,110,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.3, cy - s * 0.3, s * 0.14, s * 0.035, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDriftwood(w: number, h: number, gravelY: number): void {
    const ctx = this.ctx;
    const cx = w * 0.48;
    const cy = gravelY + h * 0.01;
    const s = Math.min(w, h) * 0.34;
    ctx.save();
    const g = ctx.createLinearGradient(cx - s * 0.6, cy - s * 0.5, cx + s * 0.5, cy);
    g.addColorStop(0, '#8a5c33');
    g.addColorStop(0.5, '#a8743f');
    g.addColorStop(1, '#5d3c21');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.72, cy);
    ctx.quadraticCurveTo(cx - s * 0.5, cy - s * 0.34, cx - s * 0.12, cy - s * 0.4);
    ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.52, cx + s * 0.42, cy - s * 0.34);
    ctx.quadraticCurveTo(cx + s * 0.6, cy - s * 0.2, cx + s * 0.66, cy);
    ctx.closePath();
    ctx.fill();
    // 枝干
    ctx.strokeStyle = '#7a5128';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.1, cy - s * 0.38);
    ctx.quadraticCurveTo(cx - s * 0.22, cy - s * 0.72, cx - s * 0.02, cy - s * 0.92);
    ctx.stroke();
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.25, cy - s * 0.4);
    ctx.quadraticCurveTo(cx + s * 0.42, cy - s * 0.62, cx + s * 0.6, cy - s * 0.66);
    ctx.stroke();
    // 木纹
    ctx.strokeStyle = 'rgba(50,30,15,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.5 + i * s * 0.16, cy - s * 0.05);
      ctx.quadraticCurveTo(cx - s * 0.2 + i * s * 0.16, cy - s * 0.3, cx + s * 0.2 + i * s * 0.1, cy - s * 0.18);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPlants(now: number, theme: (typeof TANK_THEME)[TankId], layer: 'back' | 'front'): void {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const gravelY = h * 0.84;

    type Cluster = { x: number; kind: 'hornwort' | 'bush' | 'red' | 'grass'; scale: number };
    const back: Cluster[] = [
      { x: 0.055, kind: 'hornwort', scale: 1.05 },
      { x: 0.175, kind: 'bush', scale: 0.86 },
      { x: 0.845, kind: theme.red ? 'red' : 'hornwort', scale: 1.05 },
      { x: 0.725, kind: 'bush', scale: 0.7 },
    ];
    const front: Cluster[] = [
      { x: 0.03, kind: 'grass', scale: 0.9 },
      { x: 0.965, kind: 'grass', scale: 0.95 },
      { x: 0.45, kind: 'grass', scale: 0.42 },
    ];
    const clusters = layer === 'back' ? back : front;

    const blade = (
      bx: number,
      height: number,
      lean: number,
      width: number,
      top: string,
      bottom: string,
      phase: number,
      alpha: number,
    ) => {
      const sway = Math.sin(now * 0.85 + phase) * height * 0.05;
      const g = ctx.createLinearGradient(bx, gravelY, bx + lean, gravelY - height);
      g.addColorStop(0, bottom);
      g.addColorStop(0.55, top);
      g.addColorStop(1, shade(top, 0.16));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx - width, gravelY);
      ctx.quadraticCurveTo(
        bx + lean * 0.35 + sway * 0.3 - width * 0.55,
        gravelY - height * 0.55,
        bx + lean + sway,
        gravelY - height,
      );
      ctx.quadraticCurveTo(
        bx + lean * 0.35 + sway * 0.3 + width * 0.55,
        gravelY - height * 0.5,
        bx + width,
        gravelY,
      );
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const feather = (
      bx: number,
      height: number,
      lean: number,
      phase: number,
      top: string,
      bottom: string,
      leaf: number,
      alpha: number,
    ) => {
      const sway = Math.sin(now * 0.8 + phase) * height * 0.045;
      const tipX = bx + lean + sway;
      const tipY = gravelY - height;
      const g = ctx.createLinearGradient(bx, gravelY, tipX, tipY);
      g.addColorStop(0, bottom);
      g.addColorStop(1, top);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1.4, h * 0.004);
      ctx.beginPath();
      ctx.moveTo(bx, gravelY);
      ctx.quadraticCurveTo(bx + lean * 0.3 + sway * 0.4, gravelY - height * 0.6, tipX, tipY);
      ctx.stroke();
      // 叶片
      const leaves = 7;
      for (let i = 1; i <= leaves; i++) {
        const t = i / (leaves + 1);
        const px = bx + (lean * 0.35) * t + (tipX - bx) * t;
        const py = gravelY - height * t;
        const size = leaf * (1 - t * 0.45) * (0.8 + 0.4 * ((i * 37) % 10) / 10);
        const dir = i % 2 === 0 ? 1 : -1;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(px + dir * size * 0.42, py, size * 2.3, size * 0.85, dir * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    for (const c of clusters) {
      const baseX = w * c.x;
      const spread = w * 0.075 * c.scale;
      if (c.kind === 'grass') {
        for (let i = 0; i < 16; i++) {
          const bx = baseX + (Math.sin(i * 7.3) * 0.5 + 0.5 - 0.5) * spread * 1.6 + (i / 16 - 0.5) * spread * 1.4;
          const height = h * (0.1 + 0.26 * ((i * 53) % 100) / 100) * c.scale;
          blade(
            bx,
            height,
            (Math.sin(i * 2.7) * 0.5) * w * 0.02,
            Math.max(2.2, h * 0.008),
            '#9fe06a',
            '#2f7a3c',
            i * 0.7 + c.x * 5,
            0.95,
          );
        }
      } else if (c.kind === 'bush') {
        for (let i = 0; i < 26; i++) {
          const bx = baseX + (i / 26 - 0.5) * spread * 1.5;
          const height = h * (0.14 + 0.4 * ((i * 41) % 100) / 100) * c.scale;
          blade(
            bx,
            height,
            (i / 26 - 0.5) * spread * 1.1,
            Math.max(2.4, h * 0.011),
            '#79cf5e',
            '#20643a',
            i * 0.5 + c.x * 7,
            0.92,
          );
        }
      } else if (c.kind === 'hornwort') {
        for (let i = 0; i < 24; i++) {
          const bx = baseX + Math.sin(i * 5.3) * spread * 0.95;
          const height = h * (0.22 + 0.55 * ((i * 47) % 100) / 100) * c.scale;
          blade(
            bx,
            height,
            Math.sin(i * 2.1) * w * 0.015,
            Math.max(1.6, h * 0.0055),
            '#8fdc6a',
            '#1c6b3e',
            i * 0.7 + c.x * 6,
            0.9,
          );
        }
      } else {
        for (let i = 0; i < 9; i++) {
          const bx = baseX + Math.sin(i * 6.7) * spread * 0.9;
          const height = h * (0.28 + 0.45 * ((i * 29) % 100) / 100) * c.scale;
          feather(
            bx,
            height,
            Math.sin(i * 3.1) * spread * 0.7,
            i * 1.1 + c.x * 4,
            '#f08a9b',
            '#8e2340',
            h * 0.011 * c.scale,
            0.92,
          );
        }
        // 底部绿叶
        for (let i = 0; i < 7; i++) {
          blade(
            baseX + Math.sin(i * 5.5) * spread,
            h * (0.08 + 0.12 * ((i * 31) % 100) / 100) * c.scale,
            Math.sin(i * 2.2) * w * 0.01,
            Math.max(2, h * 0.008),
            '#7fc46a',
            '#276b3c',
            i * 0.8,
            0.85,
          );
        }
      }
    }
  }

  private drawGlass(w: number, h: number, now: number): void {
    const ctx = this.ctx;
    const shade1 = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    shade1.addColorStop(0, 'rgba(255,255,255,0.20)');
    shade1.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shade1;
    ctx.fillRect(0, 0, w, h * 0.5);

    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w * 0.08, 0);
    ctx.lineTo(w * 0.22, 0);
    ctx.lineTo(w * 0.06, h);
    ctx.lineTo(w * 0, h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.62, 0);
    ctx.lineTo(w * 0.7, 0);
    ctx.lineTo(w * 0.56, h);
    ctx.lineTo(w * 0.5, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 水面
    ctx.save();
    ctx.strokeStyle = 'rgba(220,250,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const y = h * 0.035 + Math.sin(x * 0.02 + now * 1.7) * h * 0.006;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 顶部暗角
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.12);
    top.addColorStop(0, 'rgba(2,16,26,0.5)');
    top.addColorStop(1, 'rgba(2,16,26,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.12);

    const bottom = ctx.createLinearGradient(0, h * 0.88, 0, h);
    bottom.addColorStop(0, 'rgba(2,16,26,0)');
    bottom.addColorStop(1, 'rgba(2,16,26,0.32)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, h * 0.88, w, h * 0.12);
  }

  private drawDecor(state: GameState, tankId: TankId, w: number, h: number, gravelY: number, now: number): void {
    const ctx = this.ctx;
    const tank = state.tanks[tankId];
    for (const id of tank.installed) {
      const item = ITEM_MAP[id];
      if (!item) continue;
      switch (id) {
        case 'coral': {
          ctx.save();
          ctx.translate(w * 0.78, gravelY);
          ctx.fillStyle = '#d8627d';
          for (let i = 0; i < 6; i++) {
            ctx.save();
            ctx.rotate(-0.9 + i * 0.34);
            ctx.beginPath();
            ctx.ellipse(0, -h * 0.1, h * 0.014, h * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
          break;
        }
        case 'pagoda': {
          ctx.save();
          ctx.translate(w * 0.16, gravelY + h * 0.01);
          ctx.fillStyle = '#7fb2d8';
          for (let i = 0; i < 3; i++) {
            const bw = h * (0.075 - i * 0.016);
            ctx.beginPath();
            ctx.moveTo(-bw * 1.6, -i * h * 0.055);
            ctx.quadraticCurveTo(0, -i * h * 0.055 - h * 0.03, bw * 1.6, -i * h * 0.055);
            ctx.lineTo(bw, -i * h * 0.055 - h * 0.008);
            ctx.lineTo(bw * 0.7, -(i + 1) * h * 0.055);
            ctx.lineTo(-bw * 0.7, -(i + 1) * h * 0.055);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
          break;
        }
        case 'shipwreck': {
          ctx.save();
          ctx.translate(w * 0.3, gravelY + h * 0.02);
          ctx.fillStyle = '#7a5530';
          ctx.beginPath();
          ctx.moveTo(-h * 0.14, 0);
          ctx.lineTo(-h * 0.1, -h * 0.1);
          ctx.lineTo(h * 0.13, -h * 0.11);
          ctx.lineTo(h * 0.09, -h * 0.02);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#5d3f22';
          ctx.lineWidth = h * 0.012;
          ctx.beginPath();
          ctx.moveTo(0, -h * 0.1);
          ctx.lineTo(0, -h * 0.22);
          ctx.stroke();
          ctx.fillStyle = 'rgba(230,225,205,0.85)';
          ctx.beginPath();
          ctx.moveTo(0, -h * 0.21);
          ctx.quadraticCurveTo(h * 0.07, -h * 0.16, h * 0.005, -h * 0.12);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'plant': {
          ctx.save();
          ctx.translate(w * 0.66, gravelY);
          for (let i = 0; i < 5; i++) {
            ctx.fillStyle = '#3fa05a';
            ctx.beginPath();
            ctx.ellipse(0, -h * 0.06 - i * 3, h * 0.012, h * 0.05, -0.4 + i * 0.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          break;
        }
        case 'filter': {
          ctx.save();
          ctx.translate(w * 0.955, h * 0.16);
          ctx.fillStyle = 'rgba(210,225,235,0.9)';
          this.roundRect(-w * 0.022, 0, w * 0.044, h * 0.16, 6);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'heater': {
          ctx.save();
          ctx.translate(w * 0.035, h * 0.3);
          ctx.fillStyle = 'rgba(230,240,245,0.8)';
          this.roundRect(-w * 0.008, 0, w * 0.016, h * 0.3, 6);
          ctx.fill();
          ctx.fillStyle = 'rgba(240,120,80,0.85)';
          this.roundRect(-w * 0.005, h * 0.06, w * 0.01, h * 0.2, 4);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'thermo': {
          ctx.save();
          ctx.translate(w * 0.09, h * 0.24);
          ctx.fillStyle = 'rgba(235,245,250,0.85)';
          this.roundRect(-w * 0.005, 0, w * 0.01, h * 0.22, 5);
          ctx.fill();
          ctx.fillStyle = '#e0503a';
          this.roundRect(-w * 0.003, h * 0.13, w * 0.006, h * 0.085, 3);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'airpump': {
          if (Math.sin(now * 3) > 0.6) {
            this.bubbles.push({ x: w * 0.93, y: h * 0.3, r: 2 + Math.random() * 3, sp: 0.05 + Math.random() * 0.03, ph: Math.random() * 6 });
          }
          break;
        }
        case 'snail': {
          const sx = w * 0.4 + Math.sin(now * 0.3) * w * 0.06;
          ctx.save();
          ctx.translate(sx, gravelY + h * 0.05);
          ctx.fillStyle = '#d8c6a8';
          ctx.beginPath();
          ctx.ellipse(0, 0, h * 0.028, h * 0.016, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#a8906c';
          ctx.lineWidth = h * 0.004;
          ctx.beginPath();
          ctx.arc(h * 0.012, -h * 0.006, h * 0.013, 0.4, 5.4);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'basket': {
          ctx.save();
          ctx.translate(w * 0.13, h * 0.36);
          ctx.strokeStyle = 'rgba(220,235,240,0.55)';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, w * 0.09, h * 0.26);
          ctx.restore();
          break;
        }
        case 'feeder': {
          ctx.save();
          ctx.translate(w * 0.42, h * 0.035);
          ctx.fillStyle = 'rgba(225,235,240,0.9)';
          this.roundRect(-w * 0.03, 0, w * 0.06, h * 0.05, 4);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'lamp': {
          const lg = ctx.createLinearGradient(0, 0, 0, h * 0.4);
          lg.addColorStop(0, 'rgba(255,245,190,0.20)');
          lg.addColorStop(1, 'rgba(255,245,190,0)');
          ctx.fillStyle = lg;
          ctx.fillRect(0, 0, w, h * 0.4);
          break;
        }
        case 'storesign': {
          ctx.save();
          ctx.translate(w * 0.88, h * 0.3);
          ctx.rotate(-0.04);
          ctx.fillStyle = '#2c3a4a';
          this.roundRect(-w * 0.06, -h * 0.05, w * 0.12, h * 0.09, 6);
          ctx.fill();
          ctx.fillStyle = '#ffd45e';
          ctx.font = `700 ${Math.max(9, h * 0.026)}px "Trebuchet MS",sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('SALE', 0, 0);
          ctx.restore();
          break;
        }
        default:
          break;
      }
    }

    if (tankId === 'sale') {
      // 直接把字写在照片里的木牌上
      ctx.save();
      ctx.translate(w * 0.815, h * 0.605);
      ctx.rotate(-0.02);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.max(12, h * 0.032)}px "Trebuchet MS",sans-serif`;
      ctx.fillStyle = 'rgba(40,24,10,0.55)';
      ctx.fillText('FOR SALE', 0, h * 0.004);
      ctx.fillStyle = '#f4e3bb';
      ctx.fillText('FOR SALE', 0, 0);
      ctx.restore();
    }
  }

  private updateBubbles(dt: number, w: number, h: number, gravelY: number): void {
    if (this.bubbles.length < 14 && Math.random() < dt * 2.4) {
      this.bubbles.push({
        x: w * (0.1 + Math.random() * 0.8),
        y: gravelY + Math.random() * h * 0.04,
        r: 1.5 + Math.random() * 3.5,
        sp: 0.04 + Math.random() * 0.05,
        ph: Math.random() * 6.28,
      });
    }
    this.bubbles = this.bubbles.filter((b) => b.y > -10);
    for (const b of this.bubbles) b.y -= b.sp * h * dt;
  }

  private updateFlakes(state: GameState, food: number, dt: number, w: number, h: number): void {
    const target = Math.min(46, Math.round(food * 0.6));
    while (this.flakes.length < target) {
      this.flakes.push({
        x: w * (0.1 + Math.random() * 0.8),
        y: h * (0.04 + Math.random() * 0.1),
        vx: (Math.random() - 0.5) * 6,
        vy: 6 + Math.random() * 10,
        r: 1.6 + Math.random() * 2.4,
        rot: Math.random() * 6.28,
        life: 1,
      });
    }
    while (this.flakes.length > target) this.flakes.pop();
    for (const f of this.flakes) {
      f.x += f.vx * dt + Math.sin(f.y * 0.05) * 4 * dt;
      f.y += f.vy * dt;
      f.rot += dt * 1.4;
      if (f.y > h * 0.85) {
        f.y = h * 0.85;
        f.vy = 0;
      }
    }
    void state;
  }

  get canvasEl(): HTMLCanvasElement {
    return this.canvas;
  }
}
