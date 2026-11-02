import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => console.log('PAGE ERROR', error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('CONSOLE', message.text()); });
  page.on('requestfailed', request => console.log('FAILED', request.url(), request.failure()));
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  console.log('VOICES', await page.evaluate(() => speechSynthesis.getVoices().filter(v => /^ru/i.test(v.lang)).map(v => ({ name: v.name, lang: v.lang, local: v.localService }))));
  await mkdir('artifacts', { recursive: true });
  await page.locator('#settings-toggle').click();
  await page.locator('#letter-speech').uncheck();
  await page.locator('#settings-close').click();
  for (const value of 'ВАЛЯ') await page.locator(`[data-letter="${value}"]`).click();
  await page.evaluate(() => {
    window.speechEvents = [];
    const nativeSpeak = speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak = utterance => {
      for (const name of ['start', 'end', 'error']) utterance.addEventListener(name, event => window.speechEvents.push({ name, error: event.error }));
      nativeSpeak(utterance);
    };
  });
  await page.locator('#speak').click();
  try {
    await page.waitForFunction(() => window.speechEvents.some(e => e.name === 'end' || e.name === 'error'), null, { timeout: 15000 });
  } catch { /* Report the actual events; do not infer audible playback. */ }
  console.log('REAL SPEECH EVENTS', await page.evaluate(() => window.speechEvents));
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  await page.locator('[data-letter="Ё"]').click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#message')).toHaveText('ВАЛЯЁ');
  console.log('OFFLINE RELOAD OK');
  await page.screenshot({ path: 'artifacts/offline.png', fullPage: true });
} finally { await browser.close(); }
