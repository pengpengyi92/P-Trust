import { test, expect } from '@playwright/test';

test('fixtures, evidence, filters, downloads and responsive layout', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Evidence before autonomy.' })).toBeVisible();
  await expect(page.locator('.welcome img')).toHaveJSProperty('complete', true);
  expect(await page.locator('.welcome img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100);
  await page.screenshot({ path: `output/${info.project.name}-home.png`, fullPage: true });
  await page.getByRole('button', { name: 'Open an evidence-backed example' }).click();
  await expect(page.getByText('SYNTHETIC BENCHMARK · NOT A REAL REPOSITORY')).toBeVisible();
  await expect(page.locator('.finding')).toHaveCount(4);
  await page.getByText('Shell interpretation enabled', { exact: true }).click();
  await expect(page.locator('.finding[open] pre')).toContainText('shell=True');
  await page.screenshot({ path: `output/${info.project.name}-report.png`, fullPage: true });
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('.json');
  await page.getByRole('tab', { name: 'Permissions', exact: true }).click();
  await expect(page.locator('.finding')).toHaveCount(4);
  await page.getByRole('tab', { name: 'Trajectory', exact: true }).click();
  await expect(page.locator('.finding')).toHaveCount(6);
  await page.getByRole('tab', { name: 'Coverage', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What this inspection can establish' })).toBeVisible();
  await page.getByRole('button', { name: 'Methodology', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('all fixture contracts work on the actual Worker', async ({ request }) => {
  const fixtures = await (await request.get('/api/fixtures')).json();
  expect(fixtures).toHaveLength(7);
  for (const f of fixtures) {
    const response = await request.get(`/api/fixtures/${f.id}`); expect(response.ok()).toBe(true);
    expect((await response.json()).dimensions).toHaveLength(7);
  }
});
test('HTTP boundaries reject invalid destinations and unknown reports', async ({ request }) => {
  const bad = await request.post('/api/analyze', { data: { repository: 'http://127.0.0.1/private' } }); expect(bad.status()).toBe(400);
  const origin = await request.post('/api/analyze', { headers: { Origin: 'https://evil.example' }, data: { repository: 'https://github.com/a/b' } }); expect(origin.status()).toBe(403);
  const missing = await request.get(`/api/reports/${'a'.repeat(64)}`); expect(missing.status()).toBe(404);
  const health = await (await request.get('/api/health')).json(); expect(health.ai).toBe(false);
});
