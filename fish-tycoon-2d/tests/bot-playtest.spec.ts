// 机器人经济闭环测试：开局选鱼 → 强制成年 → 配对 → 产仔 → 移出售缸 → 卖鱼
// 同时验证主视图/商店面板渲染与零报错
import { test, expect, type Page } from '@playwright/test';

async function bootFresh(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?seed=42');
  // 开局选鱼：点前两张卡
  await page.waitForSelector('#starter-picks .starter-card');
  await page.locator('#starter-picks .starter-card').nth(0).click();
  await page.locator('#starter-picks .starter-card').nth(1).click();
  await page.locator('#btn-start').click();
  await page.waitForFunction(() => (window as any).__FISH2D__?.diag()?.ready);
}

test('完整经济闭环：选鱼→成年→配对→产仔→出售缸→售出', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await bootFresh(page);

  // 1. 开局状态：$150、2 颗创始鱼卵（未成年 → 发现数 0）
  let state = await page.evaluate(() => (window as any).__FISH2D__.hooks.getState());
  expect(state.money).toBe(150);
  expect(state.fish).toHaveLength(2);
  expect(state.discoveredCount).toBe(0);

  // 2. 强制成年 + 配对（成年后记录发现）
  await page.evaluate(() => (window as any).__FISH2D__.hooks.forceAge(24));
  state = await page.evaluate(() => (window as any).__FISH2D__.hooks.getState());
  expect(state.discoveredCount).toBe(2);
  const pairResult = await page.evaluate(() => (window as any).__FISH2D__.hooks.pairFirstTwo());
  expect(pairResult ?? '').toContain('怀孕');

  // 3. 20x 速度等待产仔（0.4 年 = 24 秒真实时间 → 20x 下 1.2 秒）
  await page.evaluate(() => (window as any).__FISH2D__.hooks.setSpeed(20));
  await page.waitForFunction(() => {
    const s = (window as any).__FISH2D__.hooks.getState();
    return s.fish.length >= 5;
  }, { timeout: 20000 });
  state = await page.evaluate(() => (window as any).__FISH2D__.hooks.getState());
  expect(state.fish.length).toBeGreaterThanOrEqual(5);
  expect(state.money).toBe(150); // 产仔不花钱

  // 4. 移 2 条到出售缸并加速成年，等顾客购买
  await page.evaluate(() => (window as any).__FISH2D__.hooks.moveToSale(2));
  await page.evaluate(() => (window as any).__FISH2D__.hooks.growAll());
  // 降低价格滑杆提高成交率：通过 setPriceScale
  await page.evaluate(() => (window as any).__FISH2D__.sim().setPriceScale(0.6));
  await page.waitForFunction(() => {
    const s = (window as any).__FISH2D__.hooks.getState();
    return s.stats.sold > 0;
  }, { timeout: 45000 });

  state = await page.evaluate(() => (window as any).__FISH2D__.hooks.getState());
  expect(state.money).toBeGreaterThan(150);
  expect(errors).toEqual([]);
});

test('主视图渲染：满屏水族箱与鱼群绘制', async ({ page }) => {
  await bootFresh(page);
  await page.waitForTimeout(1200);
  // 画布非空白采样
  const sample = await page.evaluate(() => {
    const cv = document.getElementById('tank-canvas') as HTMLCanvasElement;
    const g = cv.getContext('2d')!;
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let colored = 0;
    for (let i = 0; i < d.length; i += 40) {
      if (d[i + 3] > 0 && (d[i] + d[i + 1] + d[i + 2] > 60)) colored++;
    }
    return { colored, total: d.length / 40 };
  });
  expect(sample.colored / sample.total).toBeGreaterThan(0.9);
  // UI 元素存在
  await expect(page.locator('#btn-supplies')).toBeVisible();
  await expect(page.locator('#btn-species')).toBeVisible();
  await expect(page.locator('#btn-sellfish')).toBeVisible();
  await expect(page.locator('#info-cash')).toContainText('$150');
});

test('补给商店与图鉴面板可开合', async ({ page }) => {
  await bootFresh(page);
  // 图鉴按"已发现的成年鱼"渲染 → 先强制成年（开局为鱼卵）
  await page.evaluate(() => (window as any).__FISH2D__.hooks.forceAge(24));
  await page.locator('#btn-supplies').click();
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('.sup-net .sup-cell').first()).toBeVisible();
  await page.locator('#modal .btn-done').last().click();
  await expect(page.locator('#modal')).toBeHidden();

  await page.locator('#btn-species').click();
  await expect(page.locator('.spec-list .sp-card').first()).toBeVisible();
  await page.locator('#modal .btn-done').last().click();
  await expect(page.locator('#modal')).toBeHidden();
});
