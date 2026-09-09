import { test, expect } from '@playwright/test';
test('real public report survives reload and exports its pinned commit', async ({ page, request }, info) => {
  const id = process.env.PTRUST_REPORT_ID;
  test.skip(!id, 'Set PTRUST_REPORT_ID only after a real public scan completes.');
  const report = await (await request.get(`/api/reports/${id}`)).json();
  expect(report.repository.source).toBe('github');
  await page.goto(`/?report=${id}`);
  await expect(page.getByText('PUBLIC REPOSITORY SNAPSHOT', { exact: true })).toBeVisible();
  await expect(page.locator('.main-score strong')).toHaveText(String(report.overall_score));
  await page.reload();
  await expect(page.locator('.main-score strong')).toHaveText(String(report.overall_score));
  await page.getByRole('tab', { name: 'Coverage', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Skipped files' })).toBeVisible();
  await page.screenshot({ path: `output/${info.project.name}-self-scan.png`, fullPage: true });
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download Markdown' }).click();
  expect((await download).suggestedFilename()).toBe('p-trust-P-Trust.md');
});
