import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
try {
  const context = await browser.newContext({ hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#settings-toggle').tap();
  await page.locator('#letter-speech').uncheck();
  await page.locator('#settings-close').tap();
  for (const value of 'ВАЛЯ ДОМА') {
    if (value === ' ') await page.locator('#space').tap();
    else await page.locator(`[data-letter="${value}"]`).tap();
  }
  await mkdir('artifacts', { recursive: true });
  for (const [name, width, height] of [
    ['mobile', 390, 700],
    ['phone-landscape', 844, 320],
    ['tablet-portrait', 768, 1024],
    ['tablet-landscape', 1024, 768],
    ['desktop', 1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
  }
  await page.locator('#settings-toggle').screenshot({ path: 'artifacts/settings-button.png', scale: 'css' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#settings-toggle').tap();
  await page.screenshot({ path: 'artifacts/mobile-settings.png', fullPage: true });
  console.log('Saved phone, tablet, desktop and settings previews in artifacts/.');
} finally { await browser.close(); }
