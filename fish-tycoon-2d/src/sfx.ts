// WebAudio 合成音效：点击/买入/卖出/魔法发现/死亡/产卵
let ctxRef: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctxRef) ctxRef = new AudioContext();
  return ctxRef;
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.15, delay = 0): void {
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + delay);
    o.stop(c.currentTime + delay + dur);
  } catch { /* 音频不可用静默跳过 */ }
}

export const Sfx = {
  click: () => tone(660, 0.06, 'square', 0.06),
  buy: () => { tone(520, 0.08, 'square', 0.1); tone(780, 0.1, 'square', 0.1, 0.08); },
  sell: () => { tone(780, 0.08, 'square', 0.12); tone(1040, 0.14, 'square', 0.12, 0.09); },
  error: () => tone(180, 0.18, 'sawtooth', 0.1),
  magic: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.11)); },
  born: () => { tone(880, 0.07, 'sine', 0.1); tone(1174, 0.09, 'sine', 0.1, 0.07); },
  dead: () => { tone(220, 0.3, 'sawtooth', 0.08); tone(160, 0.4, 'sawtooth', 0.06, 0.12); },
  feed: () => tone(300, 0.1, 'sine', 0.09),
};
