/** 主界面：外壳、HUD、水缸交互、面板调度 */

import { ADULT_AGE, BASE_CAPACITY, ITEM_MAP, SPEEDS, TANK2_PRICE, YEAR_SECONDS } from '../core/items';
import { FINS, MAGIC, SPECIES, fishValue, fullName, magicIndexOf } from '../core/genetics';
import {
  capacityOf,
  growthProgress,
  isAdult,
  statusText,
  tankEffects,
  tankFish,
} from '../core/state';
import {
  buySecondTank,
  cleanDead,
  feedTank,
  hawkFish,
  moveFish,
  tick,
  useConsumable,
} from '../core/sim';
import { save } from '../core/save';
import type { GameState, ScreenId, TankId } from '../core/types';
import { TankView } from '../render/tankScene';
import { fishThumb } from '../render/fishArt';
import { ART, preloadArt } from '../art';
import { preloadNpc } from '../render/npc';
import { sfx, setSoundEnabled, soundEnabled } from '../audio';
import {
  SpeciesPanel,
  StorePanel,
  SuppliesPanel,
  TrophyPanel,
  buildMenu,
  el,
  money,
  type PanelHost,
} from './panels';

const TANK_NAME: Record<TankId, string> = { tank1: '一号缸', tank2: '二号缸', sale: '销售缸' };

function ico(name: string): string {
  const paths: Record<string, string> = {
    feed: '<path d="M4 8h16l-2 5H6z"/><path d="M8 13v3M12 13v4M16 13v3"/>',
    med: '<rect x="3" y="9" width="18" height="7" rx="3.5"/><path d="M12 9v7"/>',
    move: '<rect x="3" y="7" width="8" height="10" rx="2"/><rect x="14" y="7" width="7" height="10" rx="2"/><path d="M11 12h3"/>',
    clean: '<path d="M5 7h14l-1.5 13h-11z"/><path d="M9 4h6M9 11v6M15 11v6"/>',
    supplies: '<path d="M4 9h16l-1.5 11H5.5z"/><path d="M8 9a4 4 0 0 1 8 0"/>',
    species: '<path d="M7 4c6 3 6 13 0 16"/><path d="M17 4c-6 3-6 13 0 16"/><path d="M9 8h6M9 12h6M9 16h6"/>',
    store: '<path d="M3 9l2-5h14l2 5"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/><path d="M10 19h4M12 14v5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    play: '<path d="M7 4l12 8-12 8z"/>',
    fish: '<path d="M3 12c4-5 10-5 14 0-4 5-10 5-14 0z"/><path d="M17 12l4-3v6z"/><circle cx="7" cy="11" r="1"/>',
  };
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? ''}</svg>`;
}

export class GameUI implements PanelHost {
  state: GameState;
  root: HTMLElement;
  private tank: TankView;
  private supplies: SuppliesPanel;
  private species: SpeciesPanel;
  private trophy: TrophyPanel;
  private store: StorePanel;
  private screens!: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private mounted: ScreenId | 'tank' = 'tank';
  private lastFrame = 0;
  private hudTimer = 0;
  private storeTimer = 0;
  private saveTimer = 0;
  private lastMessageId = 0;
  private quickOpen: 'med' | 'move' | null = null;

  constructor(state: GameState, root: HTMLElement) {
    this.state = state;
    this.root = root;
    this.buildShell();
    this.screens = this.els.screens;
    this.tank = new TankView(
      this.els.tankCanvas as HTMLCanvasElement,
      () => this.state,
      (id) => this.selectFish(id),
      (x, y) => this.tapWater(x, y),
    );
    this.supplies = new SuppliesPanel(this);
    this.species = new SpeciesPanel(this);
    this.trophy = new TrophyPanel(this);
    this.store = new StorePanel(this);
    this.supplies.root.style.setProperty('--art', `url(${ART.supplies})`);
    this.species.root.style.setProperty('--art', `url(${ART.species})`);
    this.trophy.root.style.setProperty('--art', `url(${ART.trophy})`);
    preloadArt();
    preloadNpc();
    this.screens.append(this.supplies.root, this.species.root, this.trophy.root, this.store.root);
    window.addEventListener('resize', () => {
      this.tank.resize();
      this.store.attach();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) save(this.state);
    });
    window.addEventListener('beforeunload', () => save(this.state));
    this.openScreen('tank');
  }

  private buildShell(): void {
    this.root.innerHTML = `
      <header class="topbar">
        <div class="brand"><span class="brand-mark">${ico('fish')}</span><span class="brand-text">养鱼大亨</span></div>
        <div class="cash" id="cash">$0</div>
        <nav class="tabs" id="tabs" aria-label="切换水缸">
          <button class="tab" data-tank="tank1">一号缸</button>
          <button class="tab" data-tank="tank2">二号缸</button>
          <button class="tab" data-tank="sale">销售缸</button>
        </nav>
        <div class="top-tools">
          <div class="speed" id="speed"></div>
          <button class="btn icon" id="menuBtn" aria-label="菜单">${ico('menu')}</button>
        </div>
      </header>
      <main class="stage" id="stage">
        <canvas id="tankCanvas"></canvas>
        <div class="badges">
          <div class="badge" id="tankBadge"></div>
          <div class="badge status" id="tankStatus"></div>
        </div>
        <div class="quick" id="quick" hidden></div>
        <div class="screens" id="screens"></div>
        <div class="toasts" id="toasts"></div>
      </main>
      <footer class="bottombar">
        <div class="foot-main">
          <div class="fish-card" id="fishCard">
            <div class="portrait" id="portrait"></div>
            <div class="fish-lines">
              <b id="fishName">未选中</b>
              <span id="fishSub">点击缸里的鱼查看详情</span>
              <span id="fishMeta"></span>
            </div>
          </div>
          <div class="meters">
            <div class="meter"><label>健康</label><div class="bar"><i id="hpBar"></i></div><em id="hpVal">—</em></div>
            <div class="meter"><label>饱食</label><div class="bar"><i id="fedBar"></i></div><em id="fedVal">—</em></div>
          </div>
        </div>
        <div class="foot-actions" id="footActions">
          <button class="act" data-act="feed">${ico('feed')}<span>投食</span></button>
          <button class="act" data-act="med">${ico('med')}<span>用药</span></button>
          <button class="act" data-act="move">${ico('move')}<span>移动</span></button>
          <button class="act" data-act="clean">${ico('clean')}<span>清理</span></button>
          <span class="divider"></span>
          <button class="act" data-open="supplies">${ico('supplies')}<span>补给</span></button>
          <button class="act" data-open="species">${ico('species')}<span>图鉴</span></button>
          <button class="act" data-open="store">${ico('store')}<span>鱼店</span></button>
          <button class="act" data-open="trophy">${ico('trophy')}<span>奖杯</span></button>
        </div>
      </footer>`;
    const q = (sel: string) => this.root.querySelector<HTMLElement>(sel)!;
    this.els = {
      cash: q('#cash'),
      tabs: q('#tabs'),
      speed: q('#speed'),
      tankCanvas: q('#tankCanvas'),
      badges: q('.badges'),
      tankBadge: q('#tankBadge'),
      tankStatus: q('#tankStatus'),
      screens: q('#screens'),
      stage: q('#stage'),
      toasts: q('#toasts'),
      quick: q('#quick'),
      fishCard: q('#fishCard'),
      portrait: q('#portrait'),
      fishName: q('#fishName'),
      fishSub: q('#fishSub'),
      fishMeta: q('#fishMeta'),
      hpBar: q('#hpBar'),
      fedBar: q('#fedBar'),
      hpVal: q('#hpVal'),
      fedVal: q('#fedVal'),
      footActions: q('#footActions'),
    };

    this.els.tabs.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
      btn.addEventListener('click', () => this.onTab(btn.dataset.tank as TankId));
    });
    SPEEDS.forEach((sp, i) => {
      const b = el('button', `speed-btn${this.state.speedIdx === i ? ' on' : ''}`, `${sp}×`);
      b.title = `时间速度 ${sp}×`;
      b.addEventListener('click', () => {
        this.state.speedIdx = i;
        sfx.click();
        this.els.speed.querySelectorAll('.speed-btn').forEach((n, j) => n.classList.toggle('on', j === i));
      });
      this.els.speed.appendChild(b);
    });
    this.els.footActions.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => this.onAction(btn.dataset.act as string));
    });
    this.els.footActions.querySelectorAll<HTMLButtonElement>('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        this.openScreen(btn.dataset.open as ScreenId);
      });
    });
    this.root.querySelector('#menuBtn')?.addEventListener('click', () => {
      sfx.click();
      this.showMenu();
    });
    this.els.stage.addEventListener('pointerdown', (ev) => {
      if (this.quickOpen && !(ev.target as HTMLElement).closest('.quick')) this.closeQuick();
    });
  }

  // ---- 面板宿主接口 ----

  refresh(): void {
    this.updateHud();
    if (this.mounted === 'supplies') this.supplies.refresh();
    else if (this.mounted === 'species') this.species.refresh();
    else if (this.mounted === 'trophy') this.trophy.refresh();
    else if (this.mounted === 'store') this.store.refresh();
  }

  openScreen(id: ScreenId): void {
    this.state.screen = id;
    this.mounted = id;
    this.els.screens.dataset.active = id;
    this.screens.querySelectorAll<HTMLElement>('.screen').forEach((s) => {
      s.classList.toggle('active', s.classList.contains(`screen-${id}`));
    });
    this.root.dataset.screen = id;
    this.closeQuick();
    if (id === 'supplies') this.supplies.refresh();
    if (id === 'species') this.species.refresh();
    if (id === 'trophy') this.trophy.refresh();
    if (id === 'store') {
      this.store.attach();
      this.store.refresh();
    }
    if (id === 'tank') this.tank.resize();
    this.updateHud();
  }

  notify(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    this.toast(text, kind);
  }

  // ---- 交互 ----

  private onTab(tank: TankId): void {
    const state = this.state;
    if (tank !== 'sale' && tank !== 'tank1' && !state.tanks.tank2.owned) {
      this.showTankPurchase();
      return;
    }
    if (tank === 'sale' && !state.tanks.sale.owned) {
      this.showTankPurchase();
      return;
    }
    sfx.click();
    state.activeTank = tank;
    if (state.screen !== 'tank') this.openScreen('tank');
    this.updateHud();
    this.tank.resize();
  }

  private onAction(act: string): void {
    const state = this.state;
    if (act === 'feed') {
      const order = ['food1', 'food2', 'food3'];
      const foodId = order.find((id) => (state.stock[id] ?? 0) > 0);
      if (!foodId) {
        this.notify('没有鱼粮了，去补给商店买', 'bad');
        sfx.error();
        this.openScreen('supplies');
        return;
      }
      if (feedTank(state, foodId)) {
        sfx.feed();
        this.updateHud();
      }
      return;
    }
    if (act === 'med') {
      sfx.click();
      this.showQuick('med');
      return;
    }
    if (act === 'move') {
      sfx.click();
      this.showQuick('move');
      return;
    }
    if (act === 'clean') {
      const n = cleanDead(state, state.activeTank);
      if (n > 0) sfx.feed();
      else this.notify('这个缸没有死鱼要清理', 'info');
      this.updateHud();
    }
  }

  private selectFish(id: string | null): void {
    this.state.selected = id;
    if (id) sfx.select();
    this.updateHud();
  }

  private tapWater(x: number, y: number): void {
    // 点空水域：若在销售缸则提示，其它不打扰
    void x;
    void y;
  }

  private showQuick(kind: 'med' | 'move'): void {
    const state = this.state;
    const panel = this.els.quick;
    panel.hidden = false;
    this.quickOpen = kind;
    const selected = state.fish.find((f) => f.id === state.selected) ?? null;
    if (kind === 'med') {
      const options = ['med1', 'med2', 'vitamin', 'testkit', 'algae'].filter((id) => (state.stock[id] ?? 0) > 0);
      panel.innerHTML = `<div class="quick-head">用药与调理<button class="btn tiny" data-close>×</button></div>`;
      if (!options.length) {
        panel.innerHTML += `<p class="quick-empty">没有库存药品，去补给商店买一些。</p>`;
      }
      for (const id of options) {
        const item = ITEM_MAP[id];
        const b = el(
          'button',
          'quick-item',
          `<b>${item.name} ×${state.stock[id]}</b><span>${item.desc}</span>`,
        );
        b.addEventListener('click', () => {
          if (useConsumable(state, id)) {
            sfx.feed();
            this.closeQuick();
            this.updateHud();
          } else {
            sfx.error();
          }
        });
        panel.appendChild(b);
      }
    } else {
      const others = (['tank1', 'tank2', 'sale'] as TankId[]).filter(
        (t) => t !== state.activeTank && state.tanks[t].owned,
      );
      panel.innerHTML = `<div class="quick-head">把选中鱼移到…<button class="btn tiny" data-close>×</button></div>`;
      if (!selected) {
        panel.innerHTML += `<p class="quick-empty">先在水缸里点一条鱼。</p>`;
      } else {
        panel.innerHTML += `<p class="quick-empty">当前：${fullName(selected.sp, selected.fin)}</p>`;
        for (const t of others) {
          const used = tankFish(state, t).length;
          const cap = capacityOf(state, t);
          const b = el('button', 'quick-item', `<b>${TANK_NAME[t]}</b><span>${used}/${cap} 已占用</span>`);
          b.addEventListener('click', () => {
            if (moveFish(state, selected.id, t)) {
              sfx.select();
              this.closeQuick();
              this.updateHud();
              if (t === 'sale') this.openScreen('store');
            } else {
              sfx.error();
            }
          });
          panel.appendChild(b);
        }
        const hawk = el('button', 'quick-item danger', `<b>兜售这条鱼（65% 价格）</b><span>立即换现金</span>`);
        hawk.addEventListener('click', () => {
          if (hawkFish(state, selected.id)) {
            sfx.coin();
            this.closeQuick();
            this.updateHud();
          } else {
            sfx.error();
          }
        });
        panel.appendChild(hawk);
      }
    }
    panel.querySelector('[data-close]')?.addEventListener('click', () => this.closeQuick());
  }

  private closeQuick(): void {
    this.quickOpen = null;
    this.els.quick.hidden = true;
    this.els.quick.innerHTML = '';
  }

  private showTankPurchase(): void {
    const state = this.state;
    const modal = el('div', 'modal-wrap');
    const box = el('div', 'modal narrow');
    box.innerHTML = `
      <h3>二号缸</h3>
      <p class="modal-sub">扩大养殖规模，才能同时养更多鱼、跑更多繁殖组合。</p>
      <ul class="buy-list">
        <li>多出 10 条鱼的养殖空间</li>
        <li>可以在两缸之间分开养鱼，避免拥挤与混血</li>
        <li>鱼缸环境研究每级再 +3 容量</li>
      </ul>
      <p class="modal-sub">价格 ${money(TANK2_PRICE)} · 现有 ${money(state.cash)}</p>
      <div class="modal-actions">
        <button class="btn primary" data-buy ${state.cash >= TANK2_PRICE ? '' : 'disabled'}>购买二号缸</button>
        <button class="btn ghost" data-close>再想想</button>
      </div>`;
    box.querySelector('[data-buy]')?.addEventListener('click', () => {
      if (buySecondTank(state)) {
        sfx.coin();
        modal.remove();
        state.activeTank = 'tank2';
        this.openScreen('tank');
      } else {
        sfx.error();
      }
    });
    box.querySelector('[data-close]')?.addEventListener('click', () => modal.remove());
    modal.appendChild(box);
    this.els.stage.appendChild(modal);
  }

  private showMenu(): void {
    const modal = buildMenu(
      this,
      () => this.newGame(),
      () => {
        const on = !soundEnabled();
        setSoundEnabled(on);
        return on;
      },
      soundEnabled(),
    );
    this.els.stage.appendChild(modal);
  }

  newGame(): void {
    save(this.state);
    try {
      localStorage.removeItem('fish-tycoon-cn-v1');
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  // ---- HUD ----

  updateHud(): void {
    const state = this.state;
    this.els.cash.textContent = money(state.cash);
    this.root.querySelectorAll<HTMLElement>('.cash-chip').forEach((n) => (n.textContent = money(state.cash)));

    this.els.tabs.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
      const tank = btn.dataset.tank as TankId;
      const owned = state.tanks[tank].owned;
      const active = state.activeTank === tank && (state.screen === 'tank' || (tank === 'sale' && state.screen === 'store'));
      btn.classList.toggle('on', active);
      btn.classList.toggle('locked', !owned);
      const count = tankFish(state, tank).length;
      btn.innerHTML = `${TANK_NAME[tank]}${
        owned ? `<em>${count}/${capacityOf(state, tank)}</em>` : '<em>🔒</em>'
      }`;
    });

    const tank = state.activeTank;
    const owned = state.tanks[tank].owned;
    const t = state.tanks[tank];
    if (!owned) {
      this.els.tankBadge.textContent = `${TANK_NAME[tank]} · 未解锁`;
      this.els.tankStatus.textContent = `$${TANK2_PRICE} 购买二号缸`;
    } else {
      const cap = capacityOf(state, tank);
      this.els.tankBadge.textContent = `${TANK_NAME[tank]} · ${tankFish(state, tank).length}/${cap}`;
      const fx = tankEffects(state, tank);
      const flags: string[] = [];
      if (state.research.env > 0) flags.push(`环境 ${state.research.env} 级`);
      if (fx.magicAlive.some(Boolean)) flags.push('✨魔法鱼在缸');
      if (tank === 'sale') flags.push('点「鱼店」开门营业');
      this.els.tankStatus.innerHTML = `<span class="pill ${t.pollution > 55 ? 'warn' : ''}">污染 ${Math.round(t.pollution)}%</span>
        <span class="pill ${t.food > 85 ? 'warn' : ''}">水中食物 ${Math.round(t.food)}%</span>
        ${flags.map((f) => `<span class="pill ok">${f}</span>`).join('')}`;
    }
    this.els.badges.style.display = state.screen === 'tank' ? 'flex' : 'none';

    const fish = state.fish.find((f) => f.id === state.selected);
    if (fish) {
      this.els.fishName.textContent = fullName(fish.sp, fish.fin);
      const tags = [statusText(fish), `${fish.sex === 'f' ? '♀' : '♂'}`];
      if (!fish.egg) tags.push(`${Math.floor(fish.age)} 岁`);
      if (tank === 'sale' && !fish.egg) tags.push(money(fish.price));
      const value = fishValue(fish.sp, fish.fin);
      this.els.fishSub.textContent = tags.join(' · ');
      this.els.fishMeta.textContent = fish.egg
        ? `孵化 ${(Math.max(0, 0.12 - fish.age) * YEAR_SECONDS).toFixed(0)} 秒`
        : `估值 ${money(value)} · 成长 ${Math.round(growthProgress(fish) * 100)}%${isAdult(fish) ? '' : ` (${Math.floor(fish.age)}/${ADULT_AGE})`}`;
      const magic = magicIndexOf(fish.sp, fish.fin);
      this.els.fishCard.classList.toggle('magic', magic >= 0);
      this.els.portrait.innerHTML = '';
      this.els.portrait.appendChild(fishThumb(fish.sp, fish.fin, 92, 54, fish.dead));
      this.els.hpBar.style.width = `${Math.max(0, Math.min(100, fish.health))}%`;
      this.els.hpBar.dataset.level = fish.health < 30 ? 'low' : fish.health < 60 ? 'mid' : 'ok';
      this.els.fedBar.style.width = `${Math.max(0, Math.min(100, fish.fed))}%`;
      this.els.fedBar.dataset.level = fish.fed < 25 ? 'low' : fish.fed < 55 ? 'mid' : 'ok';
      this.els.hpVal.textContent = `${Math.round(fish.health)}`;
      this.els.fedVal.textContent = `${Math.round(fish.fed)}`;
    } else {
      this.els.fishName.textContent = '未选中';
      this.els.fishSub.textContent = '点击缸里的鱼查看详情';
      this.els.fishMeta.textContent = `现金 ${money(state.cash)} · ${state.time.toFixed(1)} 鱼年`;
      this.els.fishCard.classList.remove('magic');
      this.els.portrait.innerHTML = '';
      this.els.hpBar.style.width = '0%';
      this.els.fedBar.style.width = '0%';
      this.els.hpVal.textContent = '—';
      this.els.fedVal.textContent = '—';
    }

    const feedBtn = this.els.footActions.querySelector<HTMLButtonElement>('[data-act="feed"]');
    if (feedBtn) {
      const stock = state.stock.food1 ?? 0;
      feedBtn.classList.toggle('dim', stock <= 0);
      feedBtn.title = stock > 0 ? `投食（普通鱼粮 ×${stock}）` : '没有鱼粮了';
    }
    const cleanBtn = this.els.footActions.querySelector<HTMLButtonElement>('[data-act="clean"]');
    if (cleanBtn) {
      const dead = state.fish.filter((f) => f.dead && f.tank === tank).length;
      cleanBtn.classList.toggle('alert', dead > 0);
      cleanBtn.title = dead > 0 ? `清理 ${dead} 条死鱼` : '没有死鱼';
    }
  }

  private toast(text: string, kind: 'info' | 'good' | 'bad'): void {
    const node = el('div', `toast ${kind}`, text);
    this.els.toasts.appendChild(node);
    requestAnimationFrame(() => node.classList.add('in'));
    setTimeout(() => {
      node.classList.remove('in');
      setTimeout(() => node.remove(), 320);
    }, 3600);
  }

  private drainMessages(): void {
    const state = this.state;
    for (const m of state.messages) {
      if (m.id <= this.lastMessageId) continue;
      this.lastMessageId = m.id;
      if (m.kind === 'good' && m.text.startsWith('售出')) sfx.coin();
      else if (m.kind === 'bad') sfx.error();
      else if (m.text.includes('✨')) sfx.magic();
    }
    if (!state.messages.length && this.lastMessageId === 0) {
      this.lastMessageId = 0;
    }
  }

  // ---- 主循环 ----

  frame(nowMs: number): void {
    const dt = Math.min(0.12, Math.max(0, (nowMs - this.lastFrame) / 1000));
    this.lastFrame = nowMs;
    const state = this.state;
    tick(state, dt);

    if (state.screen === 'tank') this.tank.render(dt, nowMs / 1000);
    else if (state.screen === 'store') this.store.render(dt, nowMs / 1000);

    this.hudTimer += dt;
    if (this.hudTimer > 0.15) {
      this.hudTimer = 0;
      this.updateHud();
    }
    this.storeTimer += dt;
    if (this.storeTimer > 0.8 && state.screen === 'store') {
      this.storeTimer = 0;
      this.store.refresh();
    }
    this.drainMessages();
    this.saveTimer += dt;
    if (this.saveTimer > 8) {
      this.saveTimer = 0;
      save(state);
    }
  }

  /** 测试桥用：立即推进并刷新画面 */
  advanceForTest(ms: number): void {
    tick(this.state, ms / 1000);
    this.updateHud();
    this.refresh();
    this.drainMessages();
  }

  get selectedSummary(): string {
    const f = this.state.fish.find((x) => x.id === this.state.selected);
    return f ? fullName(f.sp, f.fin) : 'none';
  }
}

/** 首次进入的引导 */
export function showIntro(state: GameState, container: HTMLElement): void {
  if (state.onboarding) return;
  const modal = el('div', 'modal-wrap intro');
  const box = el('div', 'modal');
  box.innerHTML = `
    <h3>欢迎回到神秘岛</h3>
    <p class="modal-sub">七条魔法鱼消失了，鱼店的生意也冷清了。它们还会回来吗？</p>
    <ol class="intro-steps">
      <li><b>先照顾缸里的四条鱼</b><span>两条已经成年、随时会繁殖，两条还是卵。点「投食」喂它们，饿肚子会掉健康、更容易生病。</span></li>
      <li><b>成年鱼一雌一雄就会自己繁殖</b><span>同种配对最安全；不同鱼种配对能杂交出新鱼种，但子代一开始体质弱，需要「鱼缸环境」研究撑住。</span></li>
      <li><b>把成鱼移到销售缸标价卖钱</b><span>点鱼 →「移动」→ 销售缸，顾客会自己走进店里挑鱼。攒够 $${TANK2_PRICE} 可以再买一个缸。</span></li>
      <li><b>找出 7 条魔法鱼</b><span>每条魔法鱼都是精确的「鱼种 + 鳍基因」组合，奖杯室里有线索。它们活着待在缸里才会生效。</span></li>
    </ol>
    <p class="modal-sub">时间：1 鱼年 = 10 分钟，20 岁成年。急着看结果就切到 20×，大约 10 分钟成年。</p>
    <div class="modal-actions">
      <button class="btn primary" data-go>开始养鱼</button>
    </div>`;
  box.querySelector('[data-go]')?.addEventListener('click', () => {
    state.onboarding = true;
    modal.remove();
    sfx.click();
  });
  modal.appendChild(box);
  container.appendChild(modal);
  void BASE_CAPACITY;
  void MAGIC;
  void SPECIES;
  void FINS;
}
