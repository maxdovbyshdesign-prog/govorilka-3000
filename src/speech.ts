import type { Settings } from './storage';

export class Speech {
  private synth = typeof window.speechSynthesis === 'undefined' ? null : window.speechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private current: SpeechSynthesisUtterance | null = null;
  private refresh = () => {
    try {
      this.voices = (this.synth?.getVoices() ?? [])
        .filter(voice => /^ru(?:[-_]|$)/i.test(voice.lang))
        .sort((a, b) => this.score(b) - this.score(a) || a.name.localeCompare(b.name, 'ru'));
    } catch { this.voices = []; }
    this.onVoices(this.voices, this.synth !== null);
  };

  constructor(
    private settings: () => Settings,
    private onVoices: (voices: SpeechSynthesisVoice[], supported: boolean) => void,
    private onStatus: (message: string) => void,
  ) {
    this.synth?.addEventListener('voiceschanged', this.refresh);
    this.refresh();
  }

  private score(voice: SpeechSynthesisVoice): number {
    return (/natural|neural|premium|enhanced|естеств/i.test(voice.name) ? 10 : 0)
      + (voice.default ? 2 : 0) + (voice.localService ? 1 : 0);
  }

  get selectedVoice(): SpeechSynthesisVoice | undefined {
    return this.voices.find(voice => voice.voiceURI === this.settings().voiceURI) ?? this.voices[0];
  }

  speak(text: string): void {
    if (!text.trim()) return;
    // Cancel first, including when a voice has since disappeared.
    this.stop();
    const voice = this.selectedVoice;
    if (!this.synth || !voice) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.voice = voice;
      utterance.rate = this.settings().rate;
      utterance.volume = 1;
      this.current = utterance;
      utterance.onstart = () => { if (this.current === utterance) this.onStatus('Говорю…'); };
      utterance.onend = () => {
        if (this.current !== utterance) return;
        this.current = null;
        this.onStatus('Готово');
      };
      utterance.onerror = event => {
        if (this.current !== utterance) return;
        this.current = null;
        if (event.error !== 'interrupted' && event.error !== 'canceled')
          this.onStatus('Не удалось озвучить. Проверьте звук и доступность голоса.');
      };
      this.synth.resume();
      this.synth.speak(utterance);
    } catch {
      this.current = null;
      this.onStatus('Не удалось озвучить. Проверьте настройки голоса.');
    }
  }

  stop(): void {
    this.current = null;
    try { this.synth?.cancel(); } catch { /* Input must work even if speech fails. */ }
    this.onStatus('');
  }
}
