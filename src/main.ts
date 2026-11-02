import './style.css';
import { LETTERS, PRONUNCIATION, toSpokenText } from './alphabet';
import { loadState, persist, TEXT_KEY, SETTINGS_KEY } from './storage';
import { Speech } from './speech';
import settingsIcon from './assets/settings.svg?raw';

const icons = {
  speak: '<path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  delete: '<path d="M9 5h12v14H9l-7-7 7-7Z"/><path d="m12 9 6 6m0-6-6 6"/>',
  space: '<path d="M4 8v8h16V8"/>',
  clear: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/>',
  bubble: '<path d="M4 4h16v12H10l-6 5V4Z"/><path d="M8 8h8m-8 4h5"/>',
};
function icon(name: keyof typeof icons | 'settings') {
  if (name === 'settings') return settingsIcon.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="communicator">
    <header class="header">
      <div class="brand"><span class="brand-mark">${icon('bubble')}</span><div><h1>Говорилка <span>3000</span></h1><p>Русский коммуникатор</p></div></div>
      <button id="settings-toggle" class="settings-toggle" aria-expanded="false" aria-controls="settings-panel">${icon('settings')}<span>Настройки</span></button>
    </header>

    <section id="settings-panel" class="settings-panel" aria-label="Настройки" hidden>
      <div class="panel-heading"><h2>Настройки</h2><button id="settings-close" class="plain-button">Закрыть</button></div>
      <label class="voice-setting" for="voice">Русский голос<select id="voice"></select></label>
      <fieldset><legend>Скорость речи</legend><div class="choices"><label><input type="radio" name="rate" value="0.7">Медленно</label><label><input type="radio" name="rate" value="0.85">Обычно</label></div></fieldset>
      <fieldset><legend>Размер кнопок</legend><div class="choices"><label><input type="radio" name="size" value="normal">Обычный</label><label><input type="radio" name="size" value="large">Увеличенный</label></div></fieldset>
      <label class="check-setting"><input type="checkbox" id="letter-speech">Озвучивать каждую букву</label>
      <p class="settings-note">Интерфейс доступен без интернета после первого открытия. Для озвучивания без сети нужен установленный русский голос. Сетевые голоса могут передавать текст службе озвучивания браузера или устройства.</p>
    </section>

    <p id="voice-warning" class="notice" role="status" hidden></p>
    <p id="storage-warning" class="notice" role="status" hidden>Не удаётся сохранить текст. После закрытия страницы он может потеряться.</p>
    <p id="offline-warning" class="notice" role="status" hidden></p>
    <p id="cache-warning" class="notice" role="status" hidden>Не удалось сохранить интерфейс для работы без сети. Откройте приложение ещё раз с интернетом.</p>

    <section class="message-section" aria-labelledby="message-label">
      <div class="section-heading"><h2 id="message-label">Ваш текст</h2><span id="speech-status" role="status" aria-live="polite"></span></div>
      <div class="message-box"><div id="message" class="message" role="textbox" aria-label="Набранный текст" aria-readonly="true" aria-multiline="true" tabindex="0"></div><p id="placeholder">Нажимайте буквы ниже</p></div>
    </section>

    <section class="keyboard-section" aria-labelledby="keyboard-label">
      <div class="section-heading"><h2 id="keyboard-label">Алфавит</h2><span class="keyboard-hint">Буква за буквой</span></div>
      <div id="keyboard" class="keyboard">${LETTERS.map(([letter, name]) => `<button class="letter" data-letter="${letter}" aria-label="Буква ${letter}${name.length > 2 ? `, ${name}` : ''}">${letter}</button>`).join('')}</div>
    </section>

    <div class="actions" aria-label="Действия с текстом" role="group">
      <button id="space" class="action secondary">${icon('space')}<span>Пробел</span></button>
      <button id="delete" class="action secondary">${icon('delete')}<span>Удалить</span></button>
      <button id="speak" class="action primary">${icon('speak')}<span>Сказать</span></button>
      <button id="clear" class="action clear">${icon('clear')}<span>Очистить</span></button>
    </div>
    <footer><span class="privacy-dot" aria-hidden="true"></span>Текст сохраняется только в этом браузере</footer>
  </main>

  <dialog id="clear-dialog" aria-labelledby="clear-title" aria-describedby="clear-description">
    <h2 id="clear-title">Очистить весь текст?</h2>
    <p id="clear-description">Набранный текст будет удалён.</p>
    <form method="dialog"><button value="cancel" autofocus>Оставить текст</button><button value="confirm" class="confirm-clear">Очистить</button></form>
  </dialog>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const initial = loadState();
let text = initial.text;
const settings = initial.settings;
const message = $('message');
const voiceSelect = $<HTMLSelectElement>('voice');
const dialog = $<HTMLDialogElement>('clear-dialog');
let speech: Speech;

function saveText() {
  $('storage-warning').hidden = persist(TEXT_KEY, text || null);
}
function saveSettings() {
  $('storage-warning').hidden = persist(SETTINGS_KEY, JSON.stringify(settings));
}
function renderText() {
  message.textContent = text;
  $('placeholder').hidden = text.length > 0;
  for (const id of ['delete', 'clear', 'speak']) $<HTMLButtonElement>(id).disabled = text.length === 0 || (id === 'speak' && !text.trim());
  message.scrollTop = message.scrollHeight;
}
function updateOfflineNotice() {
  const offline = !navigator.onLine;
  const local = speech?.selectedVoice?.localService;
  $('offline-warning').hidden = !offline;
  $('offline-warning').textContent = local
    ? 'Нет интернета. Интерфейс работает; выбран локальный голос.'
    : 'Нет интернета. Можно набирать текст. Для речи нужен локальный русский голос — выберите его в настройках.';
}
speech = new Speech(() => settings, (voices, supported) => {
  voiceSelect.replaceChildren();
  for (const voice of voices) {
    const option = document.createElement('option');
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} · ${voice.localService ? 'на устройстве' : 'сетевой'}`;
    voiceSelect.add(option);
  }
  voiceSelect.disabled = voices.length === 0;
  if (voices.length) voiceSelect.value = voices.find(v => v.voiceURI === settings.voiceURI)?.voiceURI ?? voices[0].voiceURI;
  else voiceSelect.add(new Option('Русский голос недоступен', ''));
  $('voice-warning').hidden = voices.length > 0;
  $('voice-warning').textContent = supported
    ? 'Русский голос пока недоступен. Установите русский голос в настройках речи устройства и откройте приложение снова. Набирать текст можно.'
    : 'Этот браузер не поддерживает озвучивание. Набирать текст можно. Для речи откройте приложение в браузере с поддержкой синтеза речи.';
  updateOfflineNotice();
}, status => { $('speech-status').textContent = status; });

function append(value: string) {
  text += value;
  renderText();
  saveText();
  document.querySelector('.last-used')?.classList.remove('last-used');
  if (PRONUNCIATION.has(value)) {
    document.querySelector(`[data-letter="${value}"]`)?.classList.add('last-used');
    if (settings.letters) speech.speak(PRONUNCIATION.get(value)!);
  }
}
function removeLast() {
  if (!text) return;
  speech.stop();
  text = Array.from(text).slice(0, -1).join('');
  renderText();
  saveText();
}
function speakText() { speech.speak(toSpokenText(text)); }
function requestClear() { if (text && !dialog.open) dialog.showModal(); }
function toggleSettings(open: boolean) {
  $('settings-panel').hidden = !open;
  $('settings-toggle').setAttribute('aria-expanded', String(open));
  if (!open) $('settings-toggle').focus();
}

$('keyboard').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-letter]');
  if (button) append(button.dataset.letter!);
});
$('space').addEventListener('click', () => append(' '));
$('delete').addEventListener('click', removeLast);
$('speak').addEventListener('click', speakText);
$('clear').addEventListener('click', requestClear);
$('settings-toggle').addEventListener('click', () => toggleSettings($('settings-panel').hidden));
$('settings-close').addEventListener('click', () => toggleSettings(false));
dialog.addEventListener('close', () => {
  if (dialog.returnValue !== 'confirm') return;
  speech.stop();
  text = '';
  renderText();
  saveText();
  document.querySelector('.last-used')?.classList.remove('last-used');
  document.querySelector<HTMLButtonElement>('.letter')?.focus();
});
voiceSelect.addEventListener('change', () => {
  speech.stop();
  settings.voiceURI = voiceSelect.value;
  saveSettings();
  updateOfflineNotice();
});
document.querySelectorAll<HTMLInputElement>('input[name="rate"]').forEach(input => {
  input.checked = Number(input.value) === settings.rate;
  input.addEventListener('change', () => {
    speech.stop();
    settings.rate = input.value === '0.7' ? 0.7 : 0.85;
    saveSettings();
  });
});
document.querySelectorAll<HTMLInputElement>('input[name="size"]').forEach(input => {
  input.checked = input.value === settings.size;
  input.addEventListener('change', () => {
    settings.size = input.value === 'large' ? 'large' : 'normal';
    document.documentElement.dataset.size = settings.size;
    saveSettings();
  });
});
const lettersInput = $<HTMLInputElement>('letter-speech');
lettersInput.checked = settings.letters;
lettersInput.addEventListener('change', () => {
  settings.letters = lettersInput.checked;
  if (!settings.letters) speech.stop();
  saveSettings();
});
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing || dialog.open) return;
  const target = event.target as HTMLElement;
  if (target.closest('input, select, textarea, [contenteditable="true"]')) return;
  const letter = event.key.toLocaleUpperCase('ru-RU');
  if (PRONUNCIATION.has(letter)) { event.preventDefault(); append(letter); }
  else if (event.key === 'Backspace') { event.preventDefault(); removeLast(); }
  // Focused buttons retain native Space/Enter activation for keyboard navigation.
  else if (!target.closest('button')) {
    if (event.key === ' ') { event.preventDefault(); append(' '); }
    if (event.key === 'Enter') { event.preventDefault(); speakText(); }
  }
});
window.addEventListener('online', updateOfflineNotice);
window.addEventListener('offline', updateOfflineNotice);
window.addEventListener('pagehide', () => speech.stop());

document.documentElement.dataset.size = settings.size;
$('storage-warning').hidden = initial.storageAvailable;
renderText();
updateOfflineNotice();

// Only production has the complete build asset list; dev never caches source files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      $('cache-warning').hidden = false;
    });
  });
}
