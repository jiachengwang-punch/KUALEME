// Web Audio API — 无需外部音频文件，程序生成 ASMR 级音效

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function playTone(
  frequency: number, duration: number, type: OscillatorType = 'sine',
  attackTime = 0.01, releaseTime = 0.3, gain = 0.15
) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gainNode = c.createGain();
  osc.connect(gainNode);
  gainNode.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, c.currentTime);
  gainNode.gain.setValueAtTime(0, c.currentTime);
  gainNode.gain.linearRampToValueAtTime(gain, c.currentTime + attackTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration + releaseTime);
}

export const Sounds = {
  // 清脆水滴声 — 点赞
  like: () => {
    playTone(1200, 0.08, 'sine', 0.005, 0.15, 0.12);
    setTimeout(() => playTone(900, 0.06, 'sine', 0.005, 0.12, 0.08), 80);
  },

  // 远方风铃声 — 冠军诞生
  champion: () => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => playTone(f, 0.5, 'sine', 0.01, 0.6, 0.1), i * 180));
  },

  // 纸张摩擦声 — 攻坚投递
  deliver: () => {
    playTone(200, 0.12, 'sawtooth', 0.005, 0.2, 0.05);
    setTimeout(() => playTone(180, 0.1, 'sawtooth', 0.005, 0.15, 0.04), 60);
  },

  // AI 润色完成
  aiDone: () => {
    playTone(880, 0.15, 'sine', 0.01, 0.25, 0.1);
    setTimeout(() => playTone(1100, 0.2, 'sine', 0.01, 0.3, 0.08), 120);
  },
};
