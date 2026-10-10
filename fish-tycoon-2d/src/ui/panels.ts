// 五大面板：补给商店 / 鱼种图谱 / 奖杯室 / 统计 / 菜单 —— 按原作截图主题复刻
import { MAGIC_FISH, MAGIC_INDEX, comboName, comboNameEn, suggestedPrice, breed, type Genes } from '../game/genetics';
import { ITEM_DEF, RESEARCH_DEF, type ItemId, type ResearchId, type Sim } from '../game/sim';
import { drawFish } from '../render/fishart';
import { itemSpriteUrl, ITEM_SPRITES, BOOK_SPRITE, NET_BG, SHELF_SPRITES, SPECIES_UI, SHELF_ITEMS, ROPE_NET, SUPPLIES_BG } from '../render/decorsprites';

export function openModal(boxHtml: () => HTMLElement): void {
  const modal = document.getElementById('modal')!;
  const box = document.getElementById('modal-box')!;
  box.innerHTML = '';
  box.appendChild(boxHtml());
  modal.hidden = false;
}
export function closeModal(): void {
  document.getElementById('modal')!.hidden = true;
}
export function modalOpen(): boolean {
  return !document.getElementById('modal')!.hidden;
}

/** 小画布上画一条鱼（用于卡片头像） */
export function fishPortrait(sp: number, fin: number, w = 100, h = 44, scale = 1): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.save();
  ctx.translate(w / 2, h * 0.52);
  ctx.scale(scale, scale);
  drawFish(ctx, { sp, fin, age: 20, pregnant: 0, sick: null, dead: false }, 0, 0, 0, false);
  ctx.restore();
  return cv;
}

function cashLine(sim: Sim): string {
  return `<div class="cash-line">Your cash: $${sim.money}</div>`;
}

// ============ Fish Supplies：水下背景+渔网商品+木架研究层 ============
/** 商品英文名（对照原版 Fish Supplies：每格物品下方显示英文名） */
const ITEM_EN: Partial<Record<ItemId, string>> = {
  egg_common: 'Common Egg', egg_rare: 'Rare Egg', egg_exotic: 'Exotic Egg',
  food_bag: 'Fish Food', med_fungus: 'Fungus Cure', med_ick: 'White Spot Cure',
  vitamin: 'Vitamins', tank2: 'Tank Two', thermostat: 'Thermostat',
  aeration: 'Air Pump', snail: 'Cleaning Snail', plant: 'Special Plant',
  coral: 'Coral Ornament', pagoda: 'Pagoda Ornament', ship: 'Shipwreck Ornament',
  heater: 'Heater', filter: 'Filter', water_test: 'Water Test Kit',
  light: 'Tank Light', auto_feeder: 'Auto Feeder', basket: 'Breeding Basket',
  premium_food: 'Premium Food', algae_cleaner: 'Algae Cleaner', sign: 'Shop Sign',
};

/** 物品长介绍（左下角属性卡的介绍段落） */
const LONG_DESC: Partial<Record<ItemId, string>> = {
  egg_common: '普通鱼卵是新手最容易上手的起点：它们孵化出的鱼基因区间在 1-7 号之间，体质稳定、价格便宜。把鱼卵放进一号缸后耐心等待，小鱼会先以卵黄为食，孵化后再开始抢食鱼粮。建议开局先买上几份，把缸里的人口做起来，才有本钱做后续的研究与繁殖。',
  egg_rare: '稀有鱼卵携带 8-14 号的中阶基因，孵化出的品种在花纹与体型上明显更精致，成年后能卖出更好的价钱。缺点是价格不菲，且中阶基因的杂交更容易产生脆弱后代 —— 建议先把「鱼缸环境」研究到 2 级再大量投入。',
  egg_exotic: '奇异鱼卵携带 15-21 号的高阶基因，属于直接跳代的捷径，是冲击魔法鱼的关键资源。它们价格昂贵，但一旦孵化出优良个体，无论是自留繁殖还是放到出售缸，收益都远高于普通鱼卵。资金充裕时优先囤几份。',
  food_bag: '袋装鱼粮是店铺的日常消耗品，每袋提供 10 份投喂量。鱼的饱食度会随时间下降，饥饿会持续掉健康并显著提高患病概率。注意不要把饲料喂到 100% —— 过度投喂会污染水体，反而让整缸鱼更容易生病。',
  med_fungus: '真菌药用于治疗真菌病：患病的鱼体表会出现灰绿色絮状斑块，健康值快速流失，还会在缸内传染给同伴。一瓶药可治愈一条鱼，病程拖得越久越难挽回，建议在发现症状的当天就用药。',
  med_ick: '白点药治疗白点病：病鱼身上布满细小的白色颗粒，游动迟缓、进食减少，同样具有传染性。与真菌病要区分用药 —— 用错药是浪费钱，点错病名可看信息卡上的状态提示。',
  vitamin: '维生素为单条鱼立即恢复 30 点健康，是抢救虚弱个体与提升繁殖成功率的常备品。健康低于 25 的鱼无法配对，先用维生素把状态拉起来再配对，能显著提高产仔数量与后代存活率。',
  tank2: '二号缸是经营规模的分水岭：多一个养殖缸意味着可以把繁殖缸与待售缸分开管理，避免幼苗被成鱼抢食，也让不同品种的配对互不干扰。攒够钱后应尽早购买，回本速度很快。',
  thermostat: '恒温器稳定各缸水温，全店鱼儿的患病概率下降约 30%。它是被动生效的长期投资 —— 买下之后无需操作，所有缸永久受益，适合在鱼群规模变大、密度上升之前先行配置。',
  aeration: '增氧泵提升水体溶氧量，全店患病概率再降约 20%，可与恒温器叠加生效。缸里鱼越多、污染越重，增氧的收益越明显。价格不高，属于早期就能负担的性价比装备。',
  snail: '清洁蜗牛会不知疲倦地清理各缸污染，显著降低死尸与残饵造成的水质恶化。有了它，你可以把精力集中在繁殖与销售上，而不用频繁盯着污染度手动处理。',
  plant: '特殊水草改善水质并促进鱼儿恢复，让健康恢复速度明显加快。它同时让缸内景观更自然美观，是一举两得的装饰型道具。配合增氧泵使用效果更好。',
  coral: '珊瑚装饰提升店铺的观感，让顾客的购买意愿提高约 6%。装饰类道具不影响鱼的数值，只影响成交概率 —— 当你的鱼定价偏高、成交变慢时，摆上装饰能有效缓解。',
  pagoda: '宝塔装饰是另一件提升购买意愿约 6% 的摆件，可与珊瑚叠加。造型古典别致，很适合摆在鱼店门口吸引顾客驻足。属于纯经营向投资，越早铺开越早回本。',
  ship: '沉船装饰是购买意愿加成最高的摆件（约 8%），价格也最贵。它体积大、视觉冲击强，是鱼店成熟期的标配。与珊瑚、宝塔同时拥有时，高定价的鱼也能稳定出手。',
};

export function openSupplies(sim: Sim, onBuyItem: (id: ItemId) => void, onBuyResearch: (id: ResearchId) => void): HTMLElement {
  const root = document.createElement('div');
  root.className = 'panel-supplies';
  root.style.cssText = 'display:flex;flex-direction:column;height:100%';

  const items = Object.keys(ITEM_DEF) as ItemId[];
  let selected: ItemId = 'food_bag';

  // 研究项 → 鱼具图标（上层木架摆放与鱼具有关的研究用品）
  const resIcon: Record<ResearchId, string> = {
    env: SHELF_SPRITES.thermometer,
    food: SHELF_SPRITES.foodCan,
    ad: SHELF_SPRITES.fishNet,
  };

  // 三层木架：上层 Food（水盆+2 瓶）/ 中层 Environment（宽鱼缸+瓶）/ 下层 Advertising（叠书+竖书）
  const shelfLayer: Array<{ id: ResearchId; label: string }> = [
    { id: 'food', label: 'Research Food' },
    { id: 'env', label: 'Research Environment' },
    { id: 'ad', label: 'Research Advertising' },
  ];
  const layerGoods: Record<ResearchId, string> = {
    food: `<img class="g" src="${SHELF_ITEMS.waterBowl}" alt=""><img class="g" src="${SHELF_ITEMS.bottleA}" alt=""><img class="g" src="${SHELF_ITEMS.bottleB}" alt="">`,
    env: `<img class="g wide" src="${SHELF_ITEMS.wideTank}" alt=""><img class="g" src="${SHELF_ITEMS.bottleC}" alt=""><img class="g" src="${SHELF_ITEMS.bottleA}" alt=""><img class="g" src="${SHELF_ITEMS.bottleB}" alt="">`,
    ad: `<img class="g wide" src="${SHELF_ITEMS.bookStack}" alt=""><img class="g" src="${SHELF_ITEMS.book}" alt="">`,
  };

  root.innerHTML = `
    <div class="sup-head">
      <div class="sup-slots">
        ${['food_bag', 'med_ick', 'vitamin', 'egg_common'].map((id) => {
          const url = itemSpriteUrl(id as ItemId);
          return `<span class="sup-slot">${url ? `<img src="${url}" alt="">` : (ITEM_DEF[id as ItemId]?.icon ?? '')}</span>`;
        }).join('')}
      </div>
      <h1>Fish Supplies</h1>
    </div>
    <div class="sup-body">
      <div class="sup-net"></div>
      <div class="sup-bottom">
        <div class="sup-detail">
          <h3 class="d-name"></h3>
          <div class="d-desc d"></div>
          <div class="d-story"></div>
        </div>
        <div class="d-price p"></div>
        <div class="sup-shelf">
          <span class="shelf-post left"></span>
          <span class="shelf-post right"></span>
          ${shelfLayer.map(({ id, label }) => `
            <div class="shelf-board" data-res="${id}" title="点击研究">
              <span class="shelf-tag">${label}</span>
              <div class="board-goods">${layerGoods[id]}</div>
              <div class="board-foot"><span data-lv="${id}"></span><span class="cost" data-cost="${id}"></span></div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="panel-foot">
      ${cashLine(sim)}
      <div style="display:flex;gap:14px">
        <button class="oyster-btn d-buy">Buy</button>
        <button class="oyster-btn btn-done">Done</button>
      </div>
    </div>
  `;

  const grid = root.querySelector('.sup-net') as HTMLElement;
  grid.style.setProperty('--net-img', `url(${NET_BG})`);
  grid.style.setProperty('--bg-img', `url(${SUPPLIES_BG})`);
  const dName = root.querySelector('.d-name')!;
  const dDesc = root.querySelector('.d-desc')!;
  const dStory = root.querySelector('.d-story') as HTMLElement;
  const dPrice = root.querySelector('.d-price')!;
  const dBuy = root.querySelector('.d-buy')! as HTMLButtonElement;

  function refreshDetail(): void {
    const def = ITEM_DEF[selected];
    dName.textContent = def.cn;
    dDesc.textContent = def.desc;
    dStory.textContent = LONG_DESC[selected] ?? '';
    dPrice.textContent = `Price: $${def.price}`;
    const onceOwned = def.once && sim.hasItem(selected);
    dBuy.disabled = onceOwned || sim.money < def.price;
    dBuy.textContent = onceOwned ? 'Owned 已拥有' : 'Buy';
  }
  function refreshGrid(): void {
    grid.innerHTML = '';
    for (const id of items) {
      const def = ITEM_DEF[id];
      const cell = document.createElement('div');
      cell.className = 'sup-cell' + (id === selected ? ' sel' : '');
      // v6：有 AI 生成素材的物品用真实图片，其余沿用 emoji
      const art = itemSpriteUrl(id);
      cell.innerHTML = `<div class="ico">${art ? `<img src="${art}" alt="${def.cn}">` : def.icon}</div>`
        + `<div class="nm">${def.cn}</div><div class="nm-en">${ITEM_EN[id] ?? ''}</div><div class="pr">$${def.price}</div>`;
      cell.addEventListener('click', () => { selected = id; SfxClick(); refreshDetail(); refreshGrid(); });
      grid.appendChild(cell);
    }
  }
  function refreshResearch(): void {
    for (const id of ['env', 'food', 'ad'] as ResearchId[]) {
      const lv = sim.research[id];
      root.querySelector(`[data-lv="${id}"]`)!.textContent = lv >= 3 ? 'Lv.3 已完成 ★★★' : `Lv.${lv} → ${lv + 1}`;
      root.querySelector(`[data-cost="${id}"]`)!.textContent = lv >= 3 ? '—' : `$${RESEARCH_DEF[id].costs[lv]}`;
      root.querySelector(`[data-res="${id}"]`)!.classList.toggle('done', lv >= 3);
    }
  }
  function refreshAll(): void { refreshDetail(); refreshGrid(); refreshResearch(); root.querySelectorAll('.cash-line').forEach((el) => { el.textContent = `Your cash: $${sim.money}`; }); }

  dBuy.addEventListener('click', () => { onBuyItem(selected); refreshAll(); });
  root.querySelectorAll('.shelf-board').forEach((row) => {
    row.addEventListener('click', () => { onBuyResearch(row.getAttribute('data-res') as ResearchId); refreshAll(); });
  });
  root.querySelectorAll('.btn-done').forEach((b) => b.addEventListener('click', closeModal));

  refreshAll();
  return root;
}

// ============ Species Chart：贝壳卡片+配种预测+计算器键盘+441 图鉴 ============
export function openSpecies(sim: Sim, onSetPrice: (v: number) => void): HTMLElement {
  const root = document.createElement('div');
  root.className = 'panel-species';
  root.style.cssText = 'display:flex;flex-direction:column;height:100%';

  const known: Genes[] = [];
  for (const key of sim.discovered) known.push({ sp: Math.floor(key / 100), fin: key % 100 });
  known.sort((a, b) => (a.sp * a.fin) - (b.sp * b.fin));

  let pickA: Genes | null = null;
  let pickB: Genes | null = null;
  let buffer = ''; // 键盘输入的价格百分比（100=1.0x）

  root.innerHTML = `
    <div class="spec-head"><h1>Species Chart</h1></div>
    <div class="spec-body">
      <img class="spec-starfish sf-a" src="${SPECIES_UI.starfish}" alt="">
      <img class="spec-starfish sf-b" src="${SPECIES_UI.starfish}" alt="">
      <img class="spec-starfish sf-c" src="${SPECIES_UI.starfish}" alt="">
      <div class="spec-list"></div>
      <div class="spec-side">
        <div class="price-tag" id="sp-price-tag">Price: <b id="sp-price">${Math.round(sim.priceScale * 100)}</b></div>
        <div class="breed-row">
          <div class="breed-slot" id="slot-a">父本<br>点选左侧鱼</div>
          <span class="spec-arrow">＋</span>
          <div class="breed-slot" id="slot-b">母本<br>再点一条鱼</div>
          <span class="spec-arrow">→</span>
          <div class="breed-slot" id="slot-c" style="border-color:var(--gold)">子代预测</div>
        </div>
        <div class="keypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
          <button data-k="back" class="op">←</button>
          <button data-k="0">0</button>
          <button data-k="c" class="op">C</button>
          <button data-k="plus" class="op">+$</button>
          <button data-k="minus" class="op">-$</button>
        </div>
        <div class="chart-total">图鉴进度 <b id="known-count">${known.length}</b> / 441</div>
        <div class="chart-grid" id="chart-grid"></div>
        <div style="font-size:11px;color:#123;font-weight:bold">键盘输入售价百分比（100=建议价），子代 = ⌊(父+母)÷2⌋，金格=魔法鱼</div>
      </div>
    </div>
    <div class="panel-foot">${cashLine(sim)}<button class="oyster-btn teal btn-done">Done</button></div>
  `;

  const list = root.querySelector('.spec-list')!;
  for (const g of known) {
    const magic = MAGIC_INDEX[`${g.fin}_${g.sp}`];
    const card = document.createElement('div');
    card.className = 'sp-card';
    card.title = magic ? `${comboName(g)}（魔法鱼：${magic.title}）` : comboName(g);
    card.appendChild(fishPortrait(g.sp, g.fin, 100, 40, 0.55));
    const nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = magic ? `✦ ${magic.en}` : comboNameEn(g);
    card.appendChild(nm);
    card.addEventListener('click', () => {
      if (!pickA || (pickA && pickB)) { pickA = g; pickB = null; }
      else { pickB = g; }
      renderPrediction();
      SfxClick();
    });
    list.appendChild(card);
  }
  if (known.length === 0) list.innerHTML = '<div style="padding:20px;color:#123;font-weight:bold;font-size:13px">还没有发现成年鱼种</div>';

  const gridEl = root.querySelector('#chart-grid')!;
  for (let spI = 1; spI <= 21; spI++) {
    for (let finI = 1; finI <= 21; finI++) {
      const cell = document.createElement('div');
      const isKnown = sim.isDiscovered(spI, finI);
      const isM = !!MAGIC_INDEX[`${finI}_${spI}`];
      cell.className = 'chart-cell' + (isKnown ? (isM ? ' magic' : ' known') : '');
      cell.title = isKnown ? comboName({ sp: spI, fin: finI }) : '???';
      gridEl.appendChild(cell);
    }
  }

  function setPriceTag(html: string): void {
    root.querySelector('#sp-price-tag')!.innerHTML = html;
  }
  function renderPrediction(): void {
    const sa = root.querySelector('#slot-a')!;
    const sb = root.querySelector('#slot-b')!;
    const sc = root.querySelector('#slot-c')!;
    sa.innerHTML = ''; sb.innerHTML = ''; sc.innerHTML = '';
    if (pickA) { sa.appendChild(fishPortrait(pickA.sp, pickA.fin, 100, 52, 0.62)); }
    if (pickB) { sb.appendChild(fishPortrait(pickB.sp, pickB.fin, 100, 52, 0.62)); }
    if (pickA && pickB) {
      const child = breed(pickA, pickB, 0);
      sc.appendChild(fishPortrait(child.sp, child.fin, 100, 52, 0.62));
      const nm = document.createElement('div');
      nm.textContent = comboName(child);
      nm.style.cssText = 'font-size:9px;color:#ffe9a0';
      sc.appendChild(nm);
      const magic = MAGIC_INDEX[`${child.fin}_${child.sp}`];
      setPriceTag(magic
        ? `✦ 魔法鱼！建议价 <b>$475</b>`
        : `子代建议价 <b>$${suggestedPrice(child)}</b>`);
    } else {
      setPriceTag(`Price: <b>${Math.round(sim.priceScale * 100)}</b>`);
    }
  }

  root.querySelectorAll('.keypad button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.getAttribute('data-k')!;
      if (/^[0-9]$/.test(k)) {
        buffer = (buffer + k).slice(-3);
      } else if (k === 'back') buffer = buffer.slice(0, -1);
      else if (k === 'c') buffer = '';
      else if (k === 'plus') { sim.setPriceScale(sim.priceScale + 0.05); buffer = String(Math.round(sim.priceScale * 100)); }
      else if (k === 'minus') { sim.setPriceScale(sim.priceScale - 0.05); buffer = String(Math.round(sim.priceScale * 100)); }
      if (buffer.length > 0) {
        const v = Math.min(200, Math.max(50, parseInt(buffer, 10) || 100));
        sim.setPriceScale(v / 100);
        onSetPrice(v / 100);
      }
      setPriceTag(`Price: <b>${Math.round(sim.priceScale * 100)}</b> <span style="font-size:12px;color:#9cd">(${sim.priceScale.toFixed(2)}× 建议价)</span>`);
      SfxClick();
    });
  });

  root.querySelectorAll('.btn-done').forEach((b) => b.addEventListener('click', closeModal));
  return root;
}

// ============ Trophy Room：紫星纹理+金画框 ============
export function openTrophy(sim: Sim): HTMLElement {
  const root = document.createElement('div');
  root.className = 'panel-trophy';
  root.style.cssText = 'display:flex;flex-direction:column;height:100%';
  root.innerHTML = `
    <div class="troph-head"><h1>Trophy Room</h1></div>
    <div class="trophy-grid"></div>
    <div class="troph-foot">
      <button class="oyster-btn btn-stats">Statistics</button>
      <button class="oyster-btn btn-done">Done</button>
    </div>
  `;
  const gridEl = root.querySelector('.trophy-grid')!;
  // v7.4 对照 trophy_room.png：7 个相框按 **2 / 3 / 2** 排列，框内右下角显示 #N/7，顶部红色蝴蝶结挂钩
  const COLS: Record<number, string> = { 0: '2 / span 2', 1: '4 / span 2', 2: '1 / span 2', 3: '3 / span 2', 4: '5 / span 2', 5: '2 / span 2', 6: '4 / span 2' };
  MAGIC_FISH.forEach((m, i) => {
    const found = sim.magicFound.includes(m.id);
    const frame = document.createElement('div');
    frame.className = 'trophy-frame' + (found ? ' found' : '');
    frame.style.gridColumn = COLS[i] ?? 'auto';
    const art = document.createElement('div');
    art.className = 'art';
    if (found) {
      art.appendChild(fishPortrait(m.sp, m.fin, 220, 120, 1.0));
    } else {
      art.innerHTML = '<div class="q">?</div>';
    }
    // 框内底部编号条（#N/7）+ 解锁后显示名称
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = `#${i + 1}/7`;
    art.appendChild(tag);
    if (found) {
      const nm = document.createElement('div');
      nm.className = 'f-name';
      nm.textContent = comboName({ sp: m.sp, fin: m.fin });
      art.appendChild(nm);
    }
    frame.appendChild(art);
    // 解锁后在框外下方显示说明
    if (found) {
      const pw = document.createElement('div');
      pw.className = 'pw';
      pw.textContent = `✦ ${m.title}：${m.power}`;
      frame.appendChild(pw);
    }
    gridEl.appendChild(frame);
  });
  root.querySelector('.btn-done')!.addEventListener('click', closeModal);
  root.querySelector('.btn-stats')!.addEventListener('click', () => {
    openModal(() => {
      const st = document.createElement('div');
      st.className = 'panel-trophy';
      st.style.cssText = 'display:flex;flex-direction:column;height:100%';
      const s = sim.stats;
      st.innerHTML = `
        <div class="troph-head"><h1>Statistics</h1></div>
        <div class="stats-list">
          <div>游戏年：<b>${sim.years.toFixed(1)}</b></div><div>累计收入：<b>$${s.earned}</b></div>
          <div>售出鱼数：<b>${s.sold}</b></div><div>繁殖鱼苗：<b>${s.born}</b></div>
          <div>死亡鱼数：<b>${s.died}</b></div><div>发现组合：<b>${s.discovered}/441</b></div>
          <div>当前资金：<b>$${sim.money}</b></div><div>魔法鱼：<b>${sim.magicFound.length}/7</b></div>
        </div>
        <div class="troph-foot"><button class="oyster-btn" id="st-back">返回</button></div>`;
      st.querySelector('#st-back')!.addEventListener('click', () => openTrophy(sim));
      return st;
    });
  });
  return root;
}

// ============ Menu：岩石风格菜单 ============
export function openMenu(onHelp: () => void, onTrophy: () => HTMLElement, sim: Sim, onRestart: () => void): HTMLElement {
  const root = document.createElement('div');
  root.className = 'panel-trophy';
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;gap:16px';
  root.innerHTML = `
    <h1 style="font-family:Georgia,serif;font-size:34px;color:#fff;text-shadow:0 2px 5px rgba(0,0,0,0.5);letter-spacing:3px">Menu</h1>
    <button class="oyster-btn" id="m-resume" style="min-width:200px">返回游戏</button>
    <button class="oyster-btn" id="m-help" style="min-width:200px">玩法说明</button>
    <button class="oyster-btn" id="m-trophy" style="min-width:200px">奖杯室</button>
    <button class="oyster-btn" id="m-restart" style="min-width:200px;background:radial-gradient(ellipse at 50% 28%, #e08a80, #b04030 60%, #802818 85%);border-color:#601a10">重新开始（清档）</button>
    <div class="cash-line">Your cash: $${sim.money}</div>`;
  root.querySelector('#m-help')!.addEventListener('click', () => { closeModal(); onHelp(); });
  root.querySelector('#m-trophy')!.addEventListener('click', () => { openModal(() => onTrophy()); });
  root.querySelector('#m-resume')!.addEventListener('click', closeModal);
  root.querySelector('#m-restart')!.addEventListener('click', onRestart);
  return root;
}

function SfxClick(): void {
  try {
    window.dispatchEvent(new CustomEvent('fish2d-sfx', { detail: 'click' }));
  } catch { /* ignore */ }
}
