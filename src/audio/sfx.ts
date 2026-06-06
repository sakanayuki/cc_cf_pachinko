let ctx: AudioContext | null = null;

export function resumeAudio(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.3): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export const sfx = {
  launch(): void {
    tone(220, 0.12, 'sawtooth', 0.2);
  },
  nail(): void {
    tone(800, 0.06, 'square', 0.12);
  },
  hole(): void {
    tone(523, 0.08, 'sine', 0.3);
    setTimeout(() => tone(659, 0.1, 'sine', 0.3), 80);
  },
  bingo(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => tone(f, 0.15, 'sine', 0.35), i * 100);
    });
  },
  end(): void {
    [392, 440, 523].forEach((f, i) => {
      setTimeout(() => tone(f, 0.25, 'sine', 0.3), i * 150);
    });
  },
};
