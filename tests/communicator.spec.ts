import { test, expect, type Page } from '@playwright/test';

// The speech double verifies browser API requests; real audible quality needs a device check.
async function speechDouble(page: Page, mode: 'ready' | 'delayed' | 'missing' | 'throws' = 'ready') {
  await page.addInitScript(({ mode }) => {
    const calls: { text: string; lang: string; rate: number; volume: number; voice: string }[] = [];
    let canceled = 0;
    const events = new EventTarget();
    const voice = { voiceURI: 'test-ru', name: 'Русский тестовый', lang: 'ru-RU', localService: true, default: true };
    let ready = mode !== 'delayed' && mode !== 'missing';
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class {
      text: string;
      constructor(text: string) { this.text = text; }
    } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => ready ? [voice] : [],
      addEventListener: events.addEventListener.bind(events),
      cancel: () => { canceled++; },
      resume: () => {},
      speak: (utterance: SpeechSynthesisUtterance) => {
        if (mode === 'throws') throw new Error('Audio unavailable');
        calls.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate, volume: utterance.volume, voice: utterance.voice!.voiceURI });
      },
    } });
    Object.assign(window, {
      speechCalls: calls,
      cancelCount: () => canceled,
      loadVoices: () => { ready = true; events.dispatchEvent(new Event('voiceschanged')); },
    });
  }, { mode });
}
const letter = (page: Page, value: string) => page.locator(`[data-letter="${value}"]`);
const calls = (page: Page) => page.evaluate(() => (window as any).speechCalls);

test('ВАЛЯ, phrase, correction, repeat and reload', async ({ page }) => {
  await speechDouble(page);
  await page.goto('./');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const value of 'ВАЛЯ') await letter(page, value).click();
  await expect(page.locator('#message')).toHaveText('ВАЛЯ');
  expect((await calls(page)).map((c: any) => c.text)).toEqual(['вэ', 'а', 'эль', 'я']);
  await page.getByRole('button', { name: 'Сказать', exact: true }).click();
  expect((await calls(page)).at(-1)).toEqual({ text: 'Валя', lang: 'ru-RU', rate: 0.85, volume: 1, voice: 'test-ru' });
  await page.locator('#space').click();
  for (const value of 'ДОМАА') await letter(page, value).click();
  await page.locator('#delete').click();
  await expect(page.locator('#message')).toHaveText('ВАЛЯ ДОМА');
  await page.locator('#speak').click();
  await page.locator('#speak').click();
  expect((await calls(page)).slice(-2).map((c: any) => c.text)).toEqual(['Валя дома', 'Валя дома']);
  expect(await page.evaluate(() => (window as any).cancelCount())).toBeGreaterThanOrEqual(12);
  await page.reload();
  await expect(page.locator('#message')).toHaveText('ВАЛЯ ДОМА');
  await expect(page.locator('#message')).toHaveAttribute('aria-readonly', 'true');
  expect(await page.locator('#message').evaluate(el => (el as HTMLElement).isContentEditable)).toBe(false);
  expect(errors).toEqual([]);
});

test('all 33 letters have pronunciation; special signs', async ({ page }) => {
  await speechDouble(page);
  await page.goto('./');
  await expect(page.locator('.letter')).toHaveCount(33);
  const alphabet = await page.locator('.letter').allTextContents();
  expect(alphabet.join('')).toBe('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ');
  for (const value of alphabet) await letter(page, value).click();
  expect((await calls(page)).length).toBe(33);
  for (const [value, name] of [['Й', 'и краткое'], ['Ъ', 'твёрдый знак'], ['Ь', 'мягкий знак'], ['Ы', 'ы']]) {
    await letter(page, value).click();
    expect((await calls(page)).at(-1).text).toBe(name);
  }
});

test('clear requires confirmation and removes stored text', async ({ page }) => {
  await speechDouble(page);
  await page.goto('./');
  await letter(page, 'Я').click();
  await page.locator('#clear').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Оставить текст' })).toBeFocused();
  await page.getByRole('button', { name: 'Оставить текст' }).click();
  await expect(page.locator('#message')).toHaveText('Я');
  await page.locator('#clear').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#message')).toHaveText('Я');
  await page.locator('#clear').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Очистить', exact: true }).click();
  await expect(page.locator('#message')).toBeEmpty();
  expect(await page.evaluate(() => localStorage.getItem('govorilka.text.v1'))).toBeNull();
  await page.reload();
  await expect(page.locator('#message')).toBeEmpty();
  await expect(page.locator('#speak')).toBeDisabled();
  expect(await calls(page)).toEqual([]);
});

test('settings persist and physical keyboard works', async ({ page }) => {
  await speechDouble(page);
  await page.goto('./');
  await page.locator('#settings-toggle').click();
  await page.getByLabel('Медленно', { exact: true }).check();
  await page.getByLabel('Увеличенный').check();
  await page.getByLabel('Озвучивать каждую букву').uncheck();
  await page.locator('#voice').selectOption('test-ru');
  await page.locator('#settings-close').click();
  await page.locator('#message').focus();
  // Playwright's keyboard.type inserts Cyrillic without keydown; dispatch the
  // DOM events produced by a physical keyboard in the Russian layout.
  for (const key of 'ВАЛЯ') await page.locator('#message').dispatchEvent('keydown', { key, bubbles: true });
  await page.keyboard.press('Space');
  await page.locator('#message').dispatchEvent('keydown', { key: 'Я', bubbles: true });
  await page.keyboard.press('Backspace');
  await expect(page.locator('#message')).toHaveText('ВАЛЯ ');
  expect(await calls(page)).toEqual([]);
  await page.keyboard.press('Enter');
  expect((await calls(page)).at(-1).rate).toBe(0.7);
  await page.reload();
  await page.locator('#settings-toggle').click();
  await expect(page.getByLabel('Медленно', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Увеличенный')).toBeChecked();
  await expect(page.getByLabel('Озвучивать каждую букву')).not.toBeChecked();
  await expect(page.locator('#voice')).toHaveValue('test-ru');
  await expect(page.locator('html')).toHaveAttribute('data-size', 'large');
});

for (const mode of ['missing', 'delayed', 'throws'] as const) {
  test(`speech ${mode} does not block text input`, async ({ page }) => {
    await speechDouble(page, mode);
    await page.goto('./');
    await letter(page, 'Я').click();
    await expect(page.locator('#message')).toHaveText('Я');
    if (mode === 'throws') await expect(page.locator('#speech-status')).toContainText('Не удалось');
    else await expect(page.locator('#notice-summary')).toHaveText('Нет русского голоса');
    if (mode === 'delayed') {
      await page.evaluate(() => (window as any).loadVoices());
      await expect(page.locator('#voice-warning')).toBeHidden();
      await page.locator('#speak').click();
      expect((await calls(page)).at(-1).text).toBe('Я');
    }
  });
}

test('missing speech API and denied storage leave input usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined });
    Object.defineProperty(window, 'localStorage', { get: () => { throw new Error('Denied'); } });
  });
  await page.goto('./');
  await letter(page, 'Ё').click();
  await expect(page.locator('#message')).toHaveText('Ё');
  await expect(page.locator('#notice-summary')).toBeVisible();
  await page.locator('#settings-toggle').click();
  await expect(page.locator('#voice-warning')).toContainText('не поддерживает');
  await expect(page.locator('#storage-warning')).toBeVisible();
});

for (const [width, height] of [[320, 480], [320, 568], [360, 640], [390, 650], [390, 700], [390, 844], [430, 932], [568, 320], [600, 960], [667, 320], [667, 375], [844, 290], [844, 390], [768, 1024], [820, 1180], [1024, 768], [1180, 820], [1366, 1024], [1440, 900]]) {
  test(`touch targets and overflow at ${width}x${height}`, async ({ page }) => {
    await speechDouble(page);
    await page.setViewportSize({ width, height });
    await page.goto('./');
    for (const size of ['normal', 'large']) {
      if (size === 'large') {
        await page.locator('#settings-toggle').click();
        await page.getByLabel('Увеличенный').check();
        await page.locator('#settings-close').click();
      }
      const measurements = await page.locator('.letter, .action').evaluateAll(elements => elements.map(el => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height, top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };
      }));
      expect(measurements.every(rect => rect.width >= 44 && rect.height >= 44)).toBe(true);
      expect(measurements.every(rect => rect.top >= 0 && rect.left >= 0 && rect.right <= width + 1 && rect.bottom <= height + 1)).toBe(true);
      const overlaps = await page.locator('.letter').evaluateAll(elements => {
        const bounds = elements.map(el => el.getBoundingClientRect());
        return bounds.some((a, i) => bounds.slice(i + 1).some(b =>
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
      });
      expect(overlaps).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
      await letter(page, 'Ъ').click();
      await page.locator('#settings-toggle').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#settings-close').click();
    }
  });
}

for (const [width, height] of [[390, 844], [768, 1024]]) {
  test(`touch input and rotation at ${width}x${height}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
    try {
      const page = await context.newPage();
      await speechDouble(page);
      await page.goto(baseURL!);
      await page.locator('#settings-toggle').tap();
      await expect(page.locator('#settings-panel')).toBeVisible();
      await page.locator('#letter-speech').uncheck();
      await page.locator('#settings-close').tap();
      for (const value of 'ВАЛЯ') await letter(page, value).tap();
      await page.setViewportSize({ width: height, height: width });
      await expect(page.locator('#message')).toHaveText('ВАЛЯ');
      await page.locator('#space').tap();
      await letter(page, 'Я').tap();
      await page.locator('#delete').tap();
      await expect(page.locator('#message')).toHaveText('ВАЛЯ ');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#clear').tap();
      await page.getByRole('button', { name: 'Оставить текст' }).tap();
      await expect(page.locator('#message')).toHaveText('ВАЛЯ ');
      await page.setViewportSize({ width, height });
      await expect(page.locator('#message')).toHaveText('ВАЛЯ ');
    } finally { await context.close(); }
  });
}

test('ordinary tablet layout keeps all actions on screen', async ({ page }) => {
  await speechDouble(page);
  for (const [width, height] of [[768, 1024], [1024, 768], [820, 1180], [1180, 820]]) {
    await page.setViewportSize({ width, height });
    await page.goto('./');
    expect(await page.locator('.actions').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  }
});

test('installed service worker serves interface offline with saved text', async ({ page, context }) => {
  await speechDouble(page);
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await letter(page, 'Ё').click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#message')).toHaveText('Ё');
  await letter(page, 'Ж').click();
  await expect(page.locator('#message')).toHaveText('ЁЖ');
  await expect(page.locator('#notice-summary')).toHaveText('Нет интернета');
  await context.setOffline(false);
});

test('phone browser bars, safe areas and long text keep all controls visible', async ({ page }) => {
  await speechDouble(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('./');
  await page.locator('#settings-toggle').click();
  await page.locator('#letter-speech').uncheck();
  await page.locator('#settings-close').click();
  await page.evaluate(() => localStorage.setItem('govorilka.text.v1', 'ДЛИННЫЙ ТЕКСТ '.repeat(100)));
  await page.reload();
  for (const [width, height] of [[390, 650], [390, 720], [844, 290], [844, 340], [568, 320]]) {
    await page.setViewportSize({ width, height });
    const insetStyle = await page.addStyleTag({ content: width > height
      ? '.communicator { padding-left: 47px !important; padding-right: 47px !important; padding-bottom: 21px !important; }'
      : '.communicator { padding-bottom: 34px !important; }' });
    await expect(async () => {
      const boxes = await page.locator('.letter, .action, #settings-toggle').evaluateAll(elements => elements.map(el => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      }));
      expect(boxes.every(box => box.top >= 0 && box.bottom <= height + 1 && box.left >= 0 && box.right <= width + 1)).toBe(true);
      expect(boxes.every(box => box.width >= 44 && box.height >= 44)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('#message').evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 2)).toBe(true);
    }).toPass();
    await letter(page, 'Я').click();
    await expect(page.locator('#message')).toContainText('Я');
    await insetStyle.evaluate(el => el.parentNode?.removeChild(el));
  }
  await page.locator('#settings-toggle').click();
  await expect(page.locator('#settings-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-panel')).toBeHidden();
  await expect(page.locator('#settings-toggle')).toBeFocused();
});
