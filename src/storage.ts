export const TEXT_KEY = 'govorilka.text.v1';
export const SETTINGS_KEY = 'govorilka.settings.v1';

export interface Settings {
  voiceURI: string;
  rate: 0.7 | 0.85;
  letters: boolean;
  size: 'normal' | 'large';
}

export const DEFAULT_SETTINGS: Settings = { voiceURI: '', rate: 0.85, letters: true, size: 'normal' };

export function loadState(): { text: string; settings: Settings; storageAvailable: boolean } {
  try {
    const text = localStorage.getItem(TEXT_KEY) ?? '';
    let parsed: Partial<Settings> = {};
    try { parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') ?? {}; } catch { /* Use defaults. */ }
    return { text, storageAvailable: true, settings: {
      voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : '',
      rate: parsed.rate === 0.7 ? 0.7 : 0.85,
      letters: typeof parsed.letters === 'boolean' ? parsed.letters : true,
      size: parsed.size === 'large' ? 'large' : 'normal',
    } };
  } catch {
    return { text: '', settings: { ...DEFAULT_SETTINGS }, storageAvailable: false };
  }
}

export function persist(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}
