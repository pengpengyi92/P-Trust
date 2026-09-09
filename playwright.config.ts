import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  use: { baseURL: process.env.PTRUST_BASE_URL || 'http://127.0.0.1:8801', launchOptions: { channel: process.env.CI ? undefined : 'chrome' } },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
});
