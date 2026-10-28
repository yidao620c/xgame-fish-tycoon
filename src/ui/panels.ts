/** 面板：补给商店 / 物种图鉴 / 奖杯室 / 鱼店 */

import { ITEMS, ITEM_MAP, RESEARCH, RESEARCH_MAP, SPEEDS, TANK2_PRICE, type ResearchLine } from '../core/items';
import {
  FINS,
  MAGIC,
  SPECIES,
  breedKey,
  isLeaf,
  magicIndexOf,
} from '../core/genetics';
import { capacityOf, isAdult, researchCost, tankFish } from '../core/state';
import {
  buyItem,
  hawkFish,
  lastSale,
  setAskingPrice,
  startResearch,
  useConsumable,
} from '../core/sim';
import type { GameState, ScreenId } from '../core/types';
import { itemIcon } from './itemIcons';
import { fishThumb, drawFish } from '../render/fishArt';
import { StoreView } from '../render/storeScene';
import { sfx } from '../audio';

export interface PanelHost {
  state: GameState;
  refresh(): void;
  openScreen(id: ScreenId): void;
  notify(text: string, kind?: 'info' | 'good' | 'bad'): void;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function header(title: string, sub: string, host: PanelHost): HTMLElement {
  const head = el('header', 'screen-head');
  const wrap = el('div', 'screen-title', `<h2>${title}</h2><span>${sub}</span>`);
  const cash = el('div', 'cash-chip', money(host.state.cash));
  cash.dataset.role = 'cash';
  const back = el('button', 'btn ghost', '返回水缸');
  back.addEventListener('click', () => {
    sfx.click();
    host.openScreen('tank');
  });
  head.append(wrap, cash, back);
  return head;
}

// ---------------------------------------------------------------- 补给商店

export class SuppliesPanel {
  root: HTMLElement;
  private host: PanelHost;
  private grid: HTMLElement;
  private detail: HTMLElement;
  private research: HTMLElement;
  private selected = 'thermo';

  constructor(host: PanelHost) {
    this.host = host;
    this.root = el('section', 'screen screen-supplies');
    this.root.appendChild(header('补给商店', '装备 · 消耗品 · 研究台', host));
    const body = el('div', 'supplies-body');
    this.grid = el('div', 'item-grid');
    this.detail = el('div', 'item-detail');
    this.research = el('div', 'research');
    const side = el('aside', 'supply-side');
    side.append(this.detail, this.research);
    body.append(this.grid, side);
    this.root.appendChild(body);
  }

  refresh(): void {
    const host = this.host;
    const state = host.state;
    const cashEl = this.root.querySelector<HTMLElement>('[data-role="cash"]');
    if (cashEl) cashEl.textContent = money(state.cash);

    this.grid.innerHTML = '';
    for (const item of ITEMS) {
      const tile = el('button', 'item-tile');
      tile.dataset.id = item.id;
      if (item.id === this.selected) tile.classList.add('sel');
      const activeTank = state.activeTank === 'sale' ? 'tank1' : state.activeTank;
      const installed = item.kind !== 'consumable' && state.tanks[activeTank].installed.includes(item.id);
      const stock = state.stock[item.id] ?? 0;
      tile.innerHTML = `<span class="tile-icon">${itemIcon(item.icon, item.tint)}</span>
        <span class="tile-name">${item.name}</span>
        <span class="tile-price">${money(item.price)}</span>
        ${installed ? '<span class="tile-flag">已装</span>' : ''}
        ${item.kind === 'consumable' && stock > 0 ? `<span class="tile-stock">${stock}</span>` : ''}`;
      tile.title = `${item.name} · ${money(item.price)}`;
      tile.addEventListener('click', () => {
        this.selected = item.id;
        sfx.click();
        this.refresh();
      });
      this.grid.appendChild(tile);
    }

    const item = ITEM_MAP[this.selected];
    const activeTank = state.activeTank === 'sale' ? 'tank1' : state.activeTank;
    const installed = item.kind !== 'consumable' && state.tanks[activeTank].installed.includes(item.id);
    const stock = state.stock[item.id] ?? 0;
    const afford = state.cash >= item.price;
    const canInstall = item.kind !== 'consumable' && !installed && state.activeTank !== 'sale';
    this.detail.innerHTML = `
      <div class="detail-top">
        <span class="detail-icon">${itemIcon(item.icon, item.tint)}</span>
        <div>
          <h3>${item.name}</h3>
          <p class="detail-kind">${item.kind === 'consumable' ? '消耗品' : item.kind === 'decor' ? '陈设品' : '一次性装备'}</p>
        </div>
      </div>
      <p class="detail-desc">${item.desc}</p>
      <div class="detail-meta">
        <span>单价 <b>${money(item.price)}</b></span>
        ${item.kind === 'consumable' ? `<span>库存 <b>${stock}</b></span>` : `<span>${installed ? '已装在本缸' : '购买后装入' + (state.activeTank === 'sale' ? '饲养缸' : state.activeTank === 'tank1' ? '一号缸' : '二号缸')}</span>`}
      </div>
      <button class="btn primary buy-btn" ${afford ? '' : 'disabled'}>${
        item.kind === 'consumable' ? `购买${item.pack ? ` ×${item.pack}` : ''} ${money(item.price)}` : installed ? '本缸已安装' : canInstall ? `购买并安装 ${money(item.price)}` : '请切到饲养缸再买'
      }</button>`;
    const buyBtn = this.detail.querySelector<HTMLButtonElement>('.buy-btn');
    if (buyBtn) {
      buyBtn.addEventListener('click', () => {
        if (buyItem(state, item.id)) {
          sfx.coin();
          host.refresh();
        } else {
          sfx.error();
        }
      });
    }

    this.renderResearch();
  }

  private renderResearch(): void {
    const host = this.host;
    const state = host.state;
    this.research.innerHTML = `<h3 class="research-title">三层木架 · 研究台</h3>`;
    for (const def of RESEARCH) {
      const level = state.research[def.line];
      const job = state.researchJob?.line === def.line ? state.researchJob : null;
      const cost = researchCost(state, def.line);
      const row = el('div', 'research-row');
      const pips = Array.from({ length: 3 }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
      row.innerHTML = `
        <div class="res-books" data-line="${def.line}"><span></span><span></span><span></span><span></span></div>
        <div class="res-info">
          <div class="res-name">${def.name}<span class="pips">${pips}</span></div>
          <p>${def.perLevel}</p>
          ${
            job
              ? `<div class="res-prog"><div class="bar"><i style="width:${Math.round((1 - job.remaining / job.total) * 100)}%"></i></div><span>研究 ${def.name} ${level + 1} 级 · 剩余 ${job.remaining.toFixed(1)} 鱼年</span></div>`
              : cost === null
                ? '<div class="res-max">已满级</div>'
                : `<button class="btn small" ${state.cash >= cost && !state.researchJob ? '' : 'disabled'}>研究 ${money(cost)} · ${RESEARCH_MAP[def.line].years[level]} 鱼年</button>`
          }
        </div>`;
      const btn = row.querySelector<HTMLButtonElement>('button');
      if (btn) {
        btn.addEventListener('click', () => {
          if (startResearch(state, def.line as ResearchLine)) {
            sfx.click();
            host.refresh();
          } else {
            sfx.error();
          }
        });
      }
      this.research.appendChild(row);
    }
  }
}

// ---------------------------------------------------------------- 物种图鉴

export class SpeciesPanel {
  root: HTMLElement;
  private host: PanelHost;
  private list: HTMLElement;
  private fins: HTMLElement;
  private plate: HTMLElement;
  private keybuf = '';
  private selected = 0;

  constructor(host: PanelHost) {
    this.host = host;
    this.root = el('section', 'screen screen-species');
    this.root.appendChild(header('物种图鉴', '', host));
    const body = el('div', 'species-body');
    this.list = el('div', 'species-list');
    this.fins = el('div', 'fin-panel');
    this.plate = el('div', 'price-panel');
    body.append(this.list, this.fins, this.plate);
    this.root.appendChild(body);
  }

  refresh(): void {
    const state = this.host.state;
    const sub = this.root.querySelector<HTMLElement>('.screen-title span');
    if (sub) sub.textContent = `已发现 ${state.discovered.length} / ${SPECIES.length * FINS.length} 种组合`;
    const cashEl = this.root.querySelector<HTMLElement>('[data-role="cash"]');
    if (cashEl) cashEl.textContent = money(state.cash);
    if (state.selected) {
      const f = state.fish.find((x) => x.id === state.selected);
      if (f) this.selected = f.sp;
    }
    this.renderList();
    this.renderFins();
    this.renderPrice();
  }

  private renderList(): void {
    const state = this.host.state;
    this.list.innerHTML = '';
    SPECIES.forEach((sp, i) => {
      const found = state.discovered.filter((k) => k.startsWith(`${i}-`)).length;
      const card = el('button', `sp-card${i === this.selected ? ' sel' : ''}`);
      const thumbWrap = el('div', 'sp-thumb');
      if (found > 0) {
        const finIdx = Number(state.discovered.find((k) => k.startsWith(`${i}-`))!.split('-')[1]);
        thumbWrap.appendChild(fishThumb(i, finIdx, 88, 48));
      } else {
        thumbWrap.innerHTML = '<span class="unknown-fish">?</span>';
      }
      const names = sp.combine
        ? `由 ${SPECIES[sp.combine[0]].name} + ${SPECIES[sp.combine[1]].name} 配出`
        : `商店鱼卵 $${sp.egg}`;
      const hint =
        found > 0 || isLeaf(i) || (sp.combine && state.discovered.some((k) => k.startsWith(`${sp.combine![0]}-`)) && state.discovered.some((k) => k.startsWith(`${sp.combine![1]}-`)))
          ? names
          : '杂交发现';
      card.innerHTML = `${''}<div class="sp-text"><b>${found > 0 ? sp.name : '???'}</b><small>${found}/21 鳍基因</small><em>${hint}</em></div>`;
      card.prepend(thumbWrap);
      card.addEventListener('click', () => {
        this.selected = i;
        sfx.click();
        this.refresh();
      });
      this.list.appendChild(card);
    });
  }

  private renderFins(): void {
    const state = this.host.state;
    const sp = this.selected;
    this.fins.innerHTML = `<div class="fin-head"><b>${SPECIES[sp].name}</b><span>${
      state.discovered.filter((k) => k.startsWith(`${sp}-`)).length
    }/21</span></div><div class="fin-grid"></div>`;
    const grid = this.fins.querySelector<HTMLElement>('.fin-grid');
    if (!grid) return;
    FINS.forEach((fin, fi) => {
      const known = state.discovered.includes(breedKey(sp, fi));
      const cell = el('button', `fin-cell${known ? '' : ' locked'}`);
      if (known) {
        cell.appendChild(fishThumb(sp, fi, 86, 46));
        cell.appendChild(el('span', 'fin-name', fin.name));
        if (magicIndexOf(sp, fi) >= 0) cell.classList.add('magic');
      } else {
        cell.innerHTML = '<span class="fin-q">?</span>';
      }
      cell.title = known ? `${fin.name} ${SPECIES[sp].name}` : '尚未发现';
      cell.addEventListener('click', () => {
        const fish = state.fish.find((f) => f.sp === sp && f.fin === fi && !f.dead);
        if (fish) {
          state.selected = fish.id;
          this.host.notify(`已选中 ${fin.name} ${SPECIES[sp].name}`, 'info');
          sfx.select();
        } else if (!known) {
          sfx.error();
        }
      });
      grid.appendChild(cell);
    });
  }

  private renderPrice(): void {
    const state = this.host.state;
    const selectedSale = state.fish.find((f) => f.id === state.selected && f.tank === 'sale');
    const value = selectedSale
      ? Math.round(selectedSale.price)
      : state.askingPrice;
    this.plate.innerHTML = `
      <div class="plate-title">${selectedSale ? '选中鱼标价' : '销售缸标价'}</div>
      <div class="plate-value">${money(value)}</div>
      <div class="keypad"></div>
      <div class="plate-actions">
        <button class="btn small" data-k="all">应用到全部在售</button>
        <button class="btn small" data-k="go">去销售缸</button>
      </div>`;
    const pad = this.plate.querySelector<HTMLElement>('.keypad');
    if (pad) {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '+'];
      for (const k of keys) {
        const b = el('button', 'key', k);
        b.addEventListener('click', () => {
          sfx.click();
          if (k === 'C') this.keybuf = '';
          else if (k === '+') {
            if (this.keybuf === '') this.keybuf = String(Math.round((selectedSale?.price ?? state.askingPrice) / 10) * 10 + 10);
            else this.keybuf = String(Number(this.keybuf) + 10).slice(0, 6);
          } else if (this.keybuf.length < 6) this.keybuf += k;
          if (this.keybuf !== '') {
            const v = Number(this.keybuf);
            setAskingPrice(state, v, false);
            this.host.refresh();
          }
        });
        pad.appendChild(b);
      }
    }
    const all = this.plate.querySelector<HTMLElement>('[data-k="all"]');
    all?.addEventListener('click', () => {
      setAskingPrice(state, selectedSale ? selectedSale.price : state.askingPrice, true);
      this.host.notify('全部在售鱼已按当前标价更新', 'info');
      this.host.refresh();
    });
    const go = this.plate.querySelector<HTMLElement>('[data-k="go"]');
    go?.addEventListener('click', () => {
      state.activeTank = 'sale';
      this.host.openScreen('store');
    });
  }
}

// ---------------------------------------------------------------- 奖杯室

const FRAME_AREAS = [
  '1 / span 3',
  '4 / span 3',
  '1 / span 2',
  '5 / span 2',
  '3 / span 2',
  '2 / span 2',
  '4 / span 2',
];

export class TrophyPanel {
  root: HTMLElement;
  private host: PanelHost;
  private frames: HTMLElement;
  private riddle: HTMLElement;
  private focus = 0;
  private showStats = false;

  constructor(host: PanelHost) {
    this.host = host;
    this.root = el('section', 'screen screen-trophy');
    const head = header('奖杯室', '7 条魔法鱼', host);
    const statsBtn = el('button', 'btn ghost', '统计');
    statsBtn.addEventListener('click', () => {
      this.showStats = !this.showStats;
      sfx.click();
      this.refresh();
    });
    head.insertBefore(statsBtn, head.lastElementChild);
    this.root.appendChild(head);
    this.frames = el('div', 'frames');
    this.riddle = el('div', 'riddle');
    this.root.append(this.frames, this.riddle);
  }

  refresh(): void {
    const state = this.host.state;
    const found = state.magicFound.filter(Boolean).length;
    const sub = this.root.querySelector<HTMLElement>('.screen-title span');
    if (sub) sub.textContent = `${found} / 7 已回到你的缸里`;
    const cashEl = this.root.querySelector<HTMLElement>('[data-role="cash"]');
    if (cashEl) cashEl.textContent = money(state.cash);

    this.frames.innerHTML = '';
    MAGIC.forEach((m, i) => {
      const wrap = el('button', 'frame-wrap');
      wrap.style.gridColumn = FRAME_AREAS[i];
      const has = state.magicFound[i];
      const aliveNow = state.fish.some(
        (f) => !f.dead && !f.egg && magicIndexOf(f.sp, f.fin) === i,
      );
      wrap.innerHTML = `<div class="frame">
          <div class="frame-art">${has ? '' : '<span class="frame-q">?</span>'}</div>
          <div class="frame-label">#${i + 1}/7${aliveNow ? ' · 在缸中' : ''}</div>
        </div>`;
      if (has) {
        const art = wrap.querySelector<HTMLElement>('.frame-art');
        art?.appendChild(fishThumb(m.sp, m.fin, 232, 116));
      }
      if (i === this.focus) wrap.classList.add('focus');
      wrap.addEventListener('click', () => {
        this.focus = i;
        this.showStats = false;
        sfx.click();
        this.refresh();
      });
      this.frames.appendChild(wrap);
    });

    if (this.showStats) {
      const s = state.stats;
      this.riddle.innerHTML = `
        <div class="riddle-head"><b>统计报表</b><span>你的经营成绩</span></div>
        <div class="stats-grid">
          <div><span>累计售出</span><b>${s.sold}</b></div>
          <div><span>营业收入</span><b>${money(s.earned)}</b></div>
          <div><span>繁殖次数</span><b>${s.bred}</b></div>
          <div><span>死亡鱼数</span><b>${s.died}</b></div>
          <div><span>最多同时养</span><b>${s.peak}</b></div>
          <div><span>品种发现</span><b>${state.discovered.length}/441</b></div>
          <div><span>游戏内时间</span><b>${state.time.toFixed(1)} 年</b></div>
          <div><span>魔法鱼</span><b>${state.magicFound.filter(Boolean).length}/7</b></div>
        </div>`;
      return;
    }

    const m = MAGIC[this.focus];
    const has = state.magicFound[this.focus];
    this.riddle.innerHTML = `
      <div class="riddle-head"><b>${has ? m.name : `第 ${this.focus + 1} 条魔法鱼`}</b>
        <span>${has ? '已发现' : '线索'}</span></div>
      <p>${m.riddle}</p>
      <p class="effect">${has ? `效果：${m.effect}` : '育出它并让它活着待在缸里，效果才会生效。'}</p>`;
  }
}

// ---------------------------------------------------------------- 鱼店

export class StorePanel {
  root: HTMLElement;
  private host: PanelHost;
  private canvas: HTMLCanvasElement;
  private view: StoreView | null = null;
  private soldCard: HTMLElement;
  private priceBar: HTMLElement;
  private saleList: HTMLElement;

  constructor(host: PanelHost) {
    this.host = host;
    this.root = el('section', 'screen screen-store');
    const head = header('鱼店', '顾客会自己走进来', host);
    const hawk = el('button', 'btn primary', '兜售 65%');
    hawk.addEventListener('click', () => {
      const f = host.state.fish.find((x) => x.id === host.state.selected) ?? null;
      if (hawkFish(host.state, f?.id ?? null)) {
        sfx.coin();
        host.refresh();
      } else {
        sfx.error();
      }
    });
    head.insertBefore(hawk, head.lastElementChild);
    this.root.appendChild(head);

    const stage = el('div', 'store-stage');
    this.canvas = el('canvas', 'store-canvas');
    this.soldCard = el('div', 'sold-card');
    stage.append(this.canvas, this.soldCard);

    const foot = el('div', 'store-foot');
    this.saleList = el('div', 'sale-list');
    this.priceBar = el('div', 'price-bar');
    foot.append(this.saleList, this.priceBar);
    this.root.append(stage, foot);
  }

  attach(): void {
    if (!this.view) this.view = new StoreView(this.canvas, () => this.host.state);
    this.view.resize();
  }

  render(dt: number, now: number): void {
    if (!this.view) this.attach();
    this.view?.render(dt, now);
  }

  refresh(): void {
    const state = this.host.state;
    const sales = state.fish.filter((f) => f.tank === 'sale' && !f.dead && !f.egg);
    const sub = this.root.querySelector<HTMLElement>('.screen-title span');
    if (sub) sub.textContent = `在售 ${sales.length} 条 · 顾客到店率随广告研究提升`;
    const cashEl = this.root.querySelector<HTMLElement>('[data-role="cash"]');
    if (cashEl) cashEl.textContent = money(state.cash);

    this.renderSold();

    this.saleList.innerHTML = '';
    if (!sales.length) {
      this.saleList.innerHTML = `<p class="empty">销售缸还是空的。回水缸把成鱼移进销售缸，顾客才会掏钱。</p>`;
    }
    for (const f of sales) {
      const chip = el('button', 'sale-chip');
      if (state.selected === f.id) chip.classList.add('sel');
      chip.appendChild(fishThumb(f.sp, f.fin, 72, 40));
      chip.appendChild(el('span', 'sale-name', `${FINS[f.fin].name} ${SPECIES[f.sp].name}`));
      chip.appendChild(el('b', 'sale-price', money(f.price)));
      chip.addEventListener('click', () => {
        state.selected = f.id;
        sfx.select();
        this.host.refresh();
      });
      this.saleList.appendChild(chip);
    }

    const sel = sales.find((f) => f.id === state.selected) ?? sales[0] ?? null;
    if (sel && state.selected !== sel.id) state.selected = sel.id;
    this.priceBar.innerHTML = '';
    if (sel) {
      const label = el('div', 'price-label', `<span>标价</span><b>${money(sel.price)}</b>`);
      const minus = el('button', 'btn small', '−10');
      const plus = el('button', 'btn small', '+10');
      const suggest = el('button', 'btn small', `建议 ${money(fishValueOf(sel.sp, sel.fin))}`);
      minus.addEventListener('click', () => {
        setAskingPrice(state, Math.max(1, sel.price - 10));
        sfx.click();
        this.host.refresh();
      });
      plus.addEventListener('click', () => {
        setAskingPrice(state, sel.price + 10);
        sfx.click();
        this.host.refresh();
      });
      suggest.addEventListener('click', () => {
        setAskingPrice(state, fishValueOf(sel.sp, sel.fin));
        sfx.click();
        this.host.refresh();
      });
      this.priceBar.append(label, minus, plus, suggest);
    } else {
      this.priceBar.innerHTML = `<p class="empty">这里会显示选中鱼的售价</p>`;
    }
  }

  private renderSold(): void {
    const sale = lastSale;
    this.soldCard.innerHTML = '';
    if (!sale) {
      this.soldCard.classList.remove('has');
      this.soldCard.innerHTML = `<div class="sold-empty"><b>等待顾客</b><span>顾客进店后会走到销售缸前挑鱼</span></div>`;
      return;
    }
    if (!sale.ok) {
      this.soldCard.classList.remove('has');
      this.soldCard.innerHTML = `<div class="sold-empty"><b>有人看了看 ${sale.name}</b><span>觉得 ${money(sale.price)} 太贵了，走了</span></div>`;
      return;
    }
    this.soldCard.classList.add('has');
    this.soldCard.innerHTML = `<div class="sold-flag">SOLD</div><div class="sold-name">${sale.name}</div><div class="sold-price">${money(sale.price)}</div>`;
    this.soldCard.appendChild(fishThumb(sale.sp, sale.fin, 96, 50));
  }
}

function fishValueOf(sp: number, fin: number): number {
  const m = magicIndexOf(sp, fin);
  return m >= 0 ? MAGIC[m].value : Math.round(SPECIES[sp].value + FINS[fin].value);
}

// ---------------------------------------------------------------- 菜单弹窗

export function buildMenu(host: PanelHost, onNewGame: () => void, onToggleSound: () => boolean, soundOn: boolean): HTMLElement {
  const state = host.state;
  const modal = el('div', 'modal-wrap');
  const box = el('div', 'modal');
  const pips = Array.from({ length: 3 }, (_, i) => `<i class="${i <= state.speedIdx ? 'on' : ''}"></i>`).join('');
  box.innerHTML = `
    <h3>养鱼大亨</h3>
    <p class="modal-sub">游戏内时间 ${state.time.toFixed(1)} 鱼年 · ${money(state.cash)}</p>
    <div class="menu-rows">
      <div class="menu-row"><span>时间速度</span><div class="speed" data-role="menu-speed"></div></div>
      <div class="menu-row"><span>音效</span><button class="btn small" data-role="sound">${soundOn ? '开' : '关'}</button></div>
      <div class="menu-row"><span>目标</span><span class="goal">${state.magicFound.filter(Boolean).length}/7 魔法鱼</span></div>
    </div>
    <div class="help">
      <b>怎么玩</b>
      <p>投食 → 等鱼长大（20 岁成年）→ 一雌一雄同缸就会繁殖 → 把成鱼移进销售缸、标价卖给顾客。</p>
      <p>配两条不同鱼种可以杂交出新鱼种；鳍基因会继承并在繁殖时小概率向相邻基因突变。7 条魔法鱼需要精确的「鱼种 + 鳍基因」组合，奖杯室里有线索。</p>
      <p>研究「鱼缸环境」能扩大容量并让杂交弱质鱼活下来，是中期关键。</p>
    </div>
    <div class="modal-actions">
      <button class="btn primary" data-role="close">继续游戏</button>
      <button class="btn danger" data-role="reset">重新开局</button>
    </div>`;
  const speedWrap = box.querySelector<HTMLElement>('[data-role="menu-speed"]');
  if (speedWrap) {
    SPEEDS.forEach((sp, i) => {
      const b = el('button', `speed-btn${state.speedIdx === i ? ' on' : ''}`, `${sp}×`);
      b.addEventListener('click', () => {
        state.speedIdx = i;
        sfx.click();
        host.refresh();
        box.querySelectorAll('.speed-btn').forEach((n, j) => n.classList.toggle('on', j === i));
      });
      speedWrap.appendChild(b);
    });
  }
  box.querySelector('[data-role="sound"]')?.addEventListener('click', (ev) => {
    const on = onToggleSound();
    (ev.currentTarget as HTMLElement).textContent = on ? '开' : '关';
  });
  box.querySelector('[data-role="close"]')?.addEventListener('click', () => modal.remove());
  box.querySelector('[data-role="reset"]')?.addEventListener('click', () => {
    onNewGame();
    modal.remove();
  });
  modal.appendChild(box);
  modal.addEventListener('click', (ev) => {
    if (ev.target === modal) modal.remove();
  });
  void pips;
  return modal;
}

export function drawStoreFishPreview(canvas: HTMLCanvasElement, sp: number, fin: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFish(ctx, { sp, fin, size: Math.min(canvas.width, canvas.height) * 0.7, t: 1, phase: 0 });
}

export { TANK2_PRICE, isAdult, tankFish, capacityOf, useConsumable };
