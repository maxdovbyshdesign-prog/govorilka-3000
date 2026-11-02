import { defineConfig } from '@playwright/test';

const origin = `http://127.0.0.1:${process.env.TEST_PORT || '4173'}`;
const baseURL = `${origin}${process.env.TEST_BASE_PATH || '/'}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: { baseURL, headless: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) } }],
  webServer: {
    command: `npm run preview -- --port ${process.env.TEST_PORT || '4173'} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
