/** 极简音效：点击、金币、失败 —— 首次交互后启用 */

let ctx: AudioContext | null = null;
let enabled = true;

function ensure(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function soundEnabled(): boolean {
  return enabled;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  click(): void {
    tone(560, 0.06, 'triangle', 0.05);
  },
  select(): void {
    tone(720, 0.08, 'sine', 0.05);
  },
  coin(): void {
    tone(880, 0.09, 'square', 0.035);
    tone(1320, 0.12, 'square', 0.03, 0.07);
  },
  feed(): void {
    tone(320, 0.1, 'sine', 0.04);
  },
  error(): void {
    tone(180, 0.16, 'sawtooth', 0.03);
  },
  magic(): void {
    [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.22, 'sine', 0.045, i * 0.09));
  },
};
