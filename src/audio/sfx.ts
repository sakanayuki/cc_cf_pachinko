let ctx: AudioContext | null = null;

export function resumeAudio(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
}

interface ToneOpts {
  freq: number;
  freqEnd?: number;
  duration: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
}

function tone({ freq, freqEnd, duration, type = 'sine', vol = 0.3, delay = 0 }: ToneOpts): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration);
}

export const sfx = {
  /** spring plunger twang */
  launch(): void {
    tone({ freq: 320, freqEnd: 90, duration: 0.18, type: 'square', vol: 0.12 });
    tone({ freq: 1200, freqEnd: 400, duration: 0.08, type: 'triangle', vol: 0.15 });
  },
  /** short metallic click when hitting a nail */
  nail(): void {
    const f = 1600 + Math.random() * 900;
    tone({ freq: f, freqEnd: f * 0.7, duration: 0.04, type: 'square', vol: 0.06 });
  },
  /** ball drops into a hole */
  hole(): void {
    tone({ freq: 523, duration: 0.1, vol: 0.28 });
    tone({ freq: 784, duration: 0.16, vol: 0.28, delay: 0.09 });
  },
  /** a new line is completed */
  bingo(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      tone({ freq: f, duration: 0.18, vol: 0.3, delay: i * 0.09 });
      tone({ freq: f * 2, duration: 0.18, vol: 0.08, delay: i * 0.09 });
    });
  },
  /** weak shot rolled back to the launcher: ball returned */
  refund(): void {
    tone({ freq: 440, freqEnd: 220, duration: 0.2, type: 'triangle', vol: 0.18 });
  },
  /** ball drained without scoring */
  out(): void {
    tone({ freq: 180, freqEnd: 120, duration: 0.12, type: 'triangle', vol: 0.1 });
  },
  end(): void {
    [392, 523, 659, 784].forEach((f, i) => {
      tone({ freq: f, duration: 0.3, vol: 0.25, delay: i * 0.14 });
    });
  },
};
