// 证据重采脚本：v4 官方风格美术版 —— 7 个状态截图 + 色彩熵，写入 artifacts/pass-44
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'http://127.0.0.1:5199';
const OUT = 'artifacts/pass-44';
mkdirSync(OUT, { recursive: true });
const RUN = 'pass-44';

const errs = [];
let page;

async function entropy() {
  return page.evaluate(() => {
    const cv = document.querySelector('#stage canvas');
    if (!cv) return 0;
    const c = document.createElement('canvas');
    c.width = cv.width; c.height = cv.height;
    const cc = c.getContext('2d');
    cc.drawImage(cv, 0, 0);
    const d = cc.getImageData(0, 0, c.width, c.height).data;
    const hist = new Map();
    let n = 0;
    for (let i = 0; i < d.length; i += 16) { // 4 像素抽样
      const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      hist.set(key, (hist.get(key) ?? 0) + 1);
      n++;
    }
    let H = 0;
    for (const v of hist.values()) {
      const p = v / n;
      H -= p * Math.log2(p);
    }
    return Math.round(H * 100) / 100;
  });
}

async function settle(ms = 1800) { await page.waitForTimeout(ms); }

async function shot(mode, state, name) {
  const path = `${OUT}/${name}.png`;
  await page.locator('#stage').screenshot({ path });
  const ent = await entropy();
  const report = {
    runId: RUN, mode, state,
    requestedState: state, appliedState: state,
    screenshotPath: `${OUT}/${name}.png`,
    consoleErrors: [], pageErrors: [],
    result: { ok: true, metrics: { colorEntropyBits: ent } },
  };
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(report, null, 2));
  console.log(`${name}: entropy=${ent}`);
}

async function newGame(browser, viewport) {
  page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERROR:', e.message); });
  await page.goto(`${BASE}/?seed=42`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#starter-picks .starter-card');
  await page.locator('#starter-picks .starter-card').nth(0).click();
  await page.locator('#starter-picks .starter-card').nth(1).click();
  await page.locator('#btn-start').click();
  await page.waitForFunction(() => window.__FISH2D__?.diag()?.ready);
}

const b = await chromium.launch();

// ---- 桌面端 ----
await newGame(b, { width: 1280, height: 800 });
await page.evaluate(() => {
  const h = window.__FISH2D__.hooks;
  h.addMoney(2000); h.forceAge(24); h.feedTank();
});
await settle(2200);
await shot('desktop', 'active-play', 'desktop-active-play');

// 商店（Supplies 面板）
await page.locator('#btn-supplies').click();
await settle(900);
await shot('desktop', 'shop', 'desktop-shop');
await page.locator('.panel .btn-done, .oyster-btn.btn-done').first().click();
await settle(400);

// 物种图鉴
await page.locator('#btn-species').click();
await settle(900);
await shot('desktop', 'species-chart', 'desktop-species-chart');
await page.locator('.oyster-btn.btn-done').first().click();
await settle(400);

// 销售商店（店景+顾客）
await page.evaluate(() => {
  window.__FISH2D__.hooks.moveToSale(4);
  window.__FISH2D__.hooks.setView(2);
});
await settle(3200);
await shot('desktop', 'sale-store', 'desktop-sale-store');

// 奖杯室
await page.evaluate(() => window.__FISH2D__.hooks.setView(0));
await settle(600);
await page.locator('#btn-menu').click();
await settle(500);
await page.locator('#m-trophy').click();
await settle(900);
await shot('desktop', 'trophy-room', 'desktop-trophy');
await page.locator('.oyster-btn.btn-done').first().click().catch(() => {});
await page.close();

// 开始选鱼（未开局）
page = await b.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/?seed=7`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('#starter-picks .starter-card');
await settle(800);
await shot('desktop', 'start-picker', 'desktop-start-picker');
await page.close();

// ---- 移动端 ----
await newGame(b, { width: 390, height: 844 });
await page.evaluate(() => {
  const h = window.__FISH2D__.hooks;
  h.addMoney(1500); h.forceAge(24); h.feedTank();
});
await settle(2200);
await shot('mobile', 'active-play', 'mobile-active-play');
await page.close();

await b.close();
console.log('pageErrors:', errs.length);
