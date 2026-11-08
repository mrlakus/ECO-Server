// Звуки игры (синтезатор, файлов нет): бросок кубиков, посадка, полив, урожай, подтверждение хода.
import { prefs } from './notify';

type Ctx = BaseAudioContext;

function noise(ctx: Ctx, dur: number): AudioBufferSourceNode {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let a = 12345;
  for (let i = 0; i < len; i++) {
    a = (a * 1664525 + 1013904223) >>> 0;
    d[i] = (a / 4294967296) * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}
function blip(ctx: Ctx, out: AudioNode, t: number, f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.03);
}
function click(ctx: Ctx, out: AudioNode, t: number, freq: number, vol: number) {
  const n = noise(ctx, 0.05);
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.4;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  n.connect(f);
  f.connect(g);
  g.connect(out);
  n.start(t);
}

export type SfxName = 'roll' | 'plant' | 'water' | 'harvest' | 'confirm' | 'pick';

/** Запускает звук в контексте ctx начиная с момента t. vol — общая громкость 0…1. */
export function playSfx(ctx: Ctx, out: AudioNode, name: SfxName, t: number, vol = 1) {
  switch (name) {
    case 'roll': {
      // стук кубиков: серия щелчков с замедлением
      let at = t;
      for (let i = 0; i < 9; i++) {
        click(ctx, out, at, 1600 + ((i * 397) % 1200), (0.5 - i * 0.04) * vol);
        at += 0.045 + i * 0.016;
      }
      blip(ctx, out, at, 330, 200, 0.12, 0.12 * vol, 'triangle');
      break;
    }
    case 'plant':
      blip(ctx, out, t, 180, 90, 0.16, 0.34 * vol, 'sine'); // мягкий «топ» в землю
      click(ctx, out, t, 500, 0.2 * vol);
      blip(ctx, out, t + 0.1, 520, 700, 0.18, 0.1 * vol); // росток
      break;
    case 'water': {
      // плеск: шум с поднимающимся фильтром + пузырьки
      const n = noise(ctx, 0.5);
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.45);
      f.Q.value = 0.9;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28 * vol, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      n.connect(f);
      f.connect(g);
      g.connect(out);
      n.start(t);
      for (let i = 0; i < 4; i++) blip(ctx, out, t + 0.08 + i * 0.09, 500 + i * 220, 900 + i * 260, 0.08, 0.08 * vol);
      break;
    }
    case 'harvest':
      // весёлое арпеджио вверх + блеск
      [523, 659, 784, 1047].forEach((f, i) => blip(ctx, out, t + i * 0.075, f, f, 0.32, 0.16 * vol, 'triangle'));
      blip(ctx, out, t + 0.34, 2093, 2093, 0.45, 0.05 * vol);
      break;
    case 'confirm':
      blip(ctx, out, t, 392, 392, 0.12, 0.16 * vol, 'triangle');
      blip(ctx, out, t + 0.09, 587, 587, 0.2, 0.16 * vol, 'triangle');
      break;
    case 'pick':
      click(ctx, out, t, 900, 0.35 * vol);
      blip(ctx, out, t, 260, 180, 0.09, 0.14 * vol, 'triangle');
      break;
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
function live(): { ctx: AudioContext; out: AudioNode } | null {
  if (!prefs.sfx) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
  }
  void ctx.resume();
  return { ctx, out: master! };
}
/** Проиграть звук игры (если включены «звуки игры»). own=false — чужое действие, тише. */
export function sfx(name: SfxName, own = true) {
  const l = live();
  if (!l) return;
  playSfx(l.ctx, l.out, name, l.ctx.currentTime + 0.01, own ? 1 : 0.45);
}

/** Самопроверка для тестов: «играет» каждый звук в памяти и возвращает громкость (rms) и пик. */
export async function renderSfxTest(): Promise<Record<string, { rms: number; peak: number }>> {
  const names: SfxName[] = ['roll', 'plant', 'water', 'harvest', 'confirm', 'pick'];
  const res: Record<string, { rms: number; peak: number }> = {};
  for (const n of names) {
    const sr = 22050;
    const c = new OfflineAudioContext(1, sr * 2, sr);
    playSfx(c, c.destination, n, 0.02, 1);
    const d = (await c.startRendering()).getChannelData(0);
    let s = 0;
    let p = 0;
    let bad = 0;
    for (const v of d) {
      if (!Number.isFinite(v)) bad++;
      s += v * v;
      p = Math.max(p, Math.abs(v));
    }
    res[n] = { rms: bad ? NaN : Math.sqrt(s / d.length), peak: p };
  }
  return res;
}
(window as unknown as { __tsSfxTest: typeof renderSfxTest }).__tsSfxTest = renderSfxTest;
