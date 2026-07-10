import { prefersReducedMotion } from '@/utils/animations';

type SoundId =
  | 'place'
  | 'placeHeavy'
  | 'invalid'
  | 'sell'
  | 'objective'
  | 'victory'
  | 'combo'
  | 'measure';

interface Tone {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
}

const SOUNDS: Record<SoundId, Tone[]> = {
  place: [{ frequency: 520, duration: 0.06, type: 'sine', gain: 0.08 }],
  placeHeavy: [
    { frequency: 180, duration: 0.1, type: 'triangle', gain: 0.12 },
    { frequency: 90, duration: 0.14, type: 'sine', gain: 0.06 },
  ],
  invalid: [
    { frequency: 220, duration: 0.08, type: 'square', gain: 0.05 },
    { frequency: 160, duration: 0.1, type: 'square', gain: 0.04 },
  ],
  sell: [
    { frequency: 640, duration: 0.05, type: 'sine', gain: 0.07 },
    { frequency: 880, duration: 0.08, type: 'sine', gain: 0.05 },
  ],
  objective: [
    { frequency: 440, duration: 0.08, type: 'sine', gain: 0.09 },
    { frequency: 660, duration: 0.1, type: 'sine', gain: 0.08 },
    { frequency: 880, duration: 0.14, type: 'sine', gain: 0.07 },
  ],
  victory: [
    { frequency: 523, duration: 0.1, type: 'sine', gain: 0.1 },
    { frequency: 659, duration: 0.1, type: 'sine', gain: 0.09 },
    { frequency: 784, duration: 0.12, type: 'sine', gain: 0.08 },
    { frequency: 1047, duration: 0.2, type: 'sine', gain: 0.07 },
  ],
  combo: [
    { frequency: 700, duration: 0.05, type: 'triangle', gain: 0.09 },
    { frequency: 950, duration: 0.07, type: 'triangle', gain: 0.08, slideTo: 1100 },
  ],
  measure: [{ frequency: 380, duration: 0.05, type: 'sine', gain: 0.06 }],
};

export class SoundManager {
  private ctx: AudioContext | null = null;
  private muted = false;

  ensureReady(): void {
    if (this.ctx || prefersReducedMotion()) {
      return;
    }
    this.ctx = new AudioContext();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  play(id: SoundId): void {
    if (this.muted || prefersReducedMotion()) {
      return;
    }

    this.ensureReady();
    if (!this.ctx) {
      return;
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const tones = SOUNDS[id];
    let offset = 0;
    for (const tone of tones) {
      this.scheduleTone(tone, offset);
      offset += tone.duration * 0.85;
    }
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  private scheduleTone(tone: Tone, delay: number): void {
    if (!this.ctx) {
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const start = this.ctx.currentTime + delay;
    const end = start + tone.duration;

    osc.type = tone.type ?? 'sine';
    osc.frequency.setValueAtTime(tone.frequency, start);
    if (tone.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(tone.slideTo, end);
    }

    const peak = tone.gain ?? 0.08;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}
