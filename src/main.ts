/** 入口：加载存档、挂载 UI、驱动主循环、暴露测试桥 */

import './style.css';
import { capacityOf, createGame, growthProgress, tankFish } from './core/state';
import { load } from './core/save';
import { GameUI, showIntro } from './ui/app';
import { fullName } from './core/genetics';
import type { GameState } from './core/types';

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

const loaded = load();
const state: GameState = loaded?.state ?? createGame();
const ui = new GameUI(state, root);
showIntro(state, root.querySelector<HTMLElement>('.stage')!);

if (loaded && loaded.offlineYears > 0.05) {
  ui.notify(`你离开的这段时间里，鱼儿自己长了 ${loaded.offlineYears.toFixed(2)} 鱼年`, 'info');
}

let raf = 0;
const loop = (now: number) => {
  ui.frame(now);
  raf = requestAnimationFrame(loop);
};
cancelAnimationFrame(raf);
raf = requestAnimationFrame(loop);

// ---- 测试桥（正常玩法不依赖） ----
interface PlaytestBridge {
  snapshot(): unknown;
  reset(): void;
  setSeed(seed: number): void;
  step(ms: number): void;
}

function snapshot(): unknown {
  return {
    cash: Math.round(state.cash),
    time: Number(state.time.toFixed(3)),
    screen: state.screen,
    activeTank: state.activeTank,
    speed: [1, 4, 20][state.speedIdx],
    selected: state.selected,
    selectedName: state.selected ? (() => {
      const f = state.fish.find((x) => x.id === state.selected);
      return f ? fullName(f.sp, f.fin) : null;
    })() : null,
    cash_formatted: `$${Math.round(state.cash)}`,
    tanks: Object.fromEntries(
      (['tank1', 'tank2', 'sale'] as const).map((t) => [
        t,
        {
          owned: state.tanks[t].owned,
          pollution: Math.round(state.tanks[t].pollution),
          food: Math.round(state.tanks[t].food),
          count: tankFish(state, t).length,
          capacity: capacityOf(state, t),
        },
      ]),
    ),
    fish: state.fish.map((f) => ({
      id: f.id,
      name: fullName(f.sp, f.fin),
      sp: f.sp,
      fin: f.fin,
      tank: f.tank,
      sex: f.sex,
      age: Number(f.age.toFixed(2)),
      growth: Number(growthProgress(f).toFixed(2)),
      health: Math.round(f.health),
      fed: Math.round(f.fed),
      egg: f.egg,
      dead: f.dead,
      disease: f.disease,
      pregnancy: Number(f.pregnancy.toFixed(2)),
      price: f.price,
    })),
    research: state.research,
    researchJob: state.researchJob,
    discovered: state.discovered.length,
    magicFound: state.magicFound.filter(Boolean).length,
    stats: state.stats,
    inventory: state.stock,
    onboarding: state.onboarding,
    customers: state.customers.length,
    customersLeaving: state.customers.filter((c) => c.state === 'leave').length,
    maxCustomerX: Number(Math.max(0, ...state.customers.map((c) => c.x)).toFixed(3)),
    customerStates: state.customers.map((c) => `${c.state}:${c.x.toFixed(2)}/${c.y.toFixed(2)}`).join(' '),
  };
}

const bridge: PlaytestBridge = {
  snapshot,
  reset() {
    const fresh = createGame(Math.floor(Math.random() * 100000));
    Object.assign(state, fresh);
    ui.refresh();
  },
  setSeed(seed: number) {
    state.seed = seed >>> 0;
  },
  step(ms: number) {
    ui.advanceForTest(ms);
  },
};

(globalThis as unknown as { __OHMYGAME_PLAYTEST__?: PlaytestBridge }).__OHMYGAME_PLAYTEST__ = bridge;
