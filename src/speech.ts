/**
 * The single seam for audio. Everything that makes a sound goes through a
 * Speaker, so replacing browser speech synthesis with recorded files later
 * would touch this file and nothing else.
 */
export interface Speaker {
  readonly supported: boolean;
  speak(text: string): void;
  cancel(): void;
}

const SILENT: Speaker = {
  supported: false,
  speak() {},
  cancel() {},
};

class BrowserSpeaker implements Speaker {
  readonly supported = true;
  private voice: SpeechSynthesisVoice | null = null;

  constructor(private readonly synth: SpeechSynthesis) {
    this.pickVoice();
    // Chrome returns an empty voice list on the first call and fills it later.
    try {
      this.synth.addEventListener?.("voiceschanged", () => this.pickVoice());
    } catch {
      /* ignore */
    }
  }

  private pickVoice(): void {
    try {
      const voices = this.synth.getVoices?.() ?? [];
      this.voice =
        voices.find((v) => v.lang === "en-US" && v.localService) ??
        voices.find((v) => v.lang === "en-US") ??
        voices.find((v) => v.lang?.startsWith("en")) ??
        null;
    } catch {
      this.voice = null;
    }
  }

  speak(text: string): void {
    const words = text.trim();
    if (words === "") return;
    try {
      // Drop anything still talking, so quick answers do not pile up a backlog.
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(words);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      if (this.voice !== null) utterance.voice = this.voice;
      this.synth.speak(utterance);
    } catch {
      /* A failure to speak must never interrupt the drill. */
    }
  }

  cancel(): void {
    try {
      this.synth.cancel();
    } catch {
      /* ignore */
    }
  }
}

/**
 * A Speaker for this browser, or a silent one where speech synthesis is missing
 * or unusable. Callers check `supported` to decide whether to show controls.
 */
export function createSpeaker(): Speaker {
  try {
    const synth = globalThis.speechSynthesis as SpeechSynthesis | undefined;
    if (synth === undefined || typeof SpeechSynthesisUtterance === "undefined") return SILENT;
    return new BrowserSpeaker(synth);
  } catch {
    return SILENT;
  }
}
