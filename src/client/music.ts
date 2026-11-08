// Фоновая музыка главного меню. Файлы не нужны: мелодия «играется» синтезатором Web Audio прямо в браузере.
// Спокойная деревенская тема: перебор струн, мягкий фон, флейта. Тональность ре мажор, прогрессия I–V–vi–IV.

const KEY = 'ts-music';
const BPM = 84;
const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Детерминированный генератор: одна и та же «партитура» для одного номера такта. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Chord {
  bass: number;
  pad: [number, number];
  arp: [number, number, number, number];
}
const D: Chord = { bass: 38, pad: [50, 57], arp: [57, 62, 66, 69] };
const A: Chord = { bass: 45, pad: [45, 52], arp: [57, 61, 64, 69] };
const Bm: Chord = { bass: 47, pad: [47, 54], arp: [59, 62, 66, 71] };
const G: Chord = { bass: 43, pad: [43, 50], arp: [55, 59, 62, 67] };
const PROGRESSION: Chord[] = [D, A, Bm, G, D, A, G, A];
const PATTERNS = [
  [0, 1, 2, 3, 2, 1, 2, 1],
  [0, 2, 1, 3, 2, 1, 3, 2],
];
const PENTATONIC = [69, 71, 74, 76, 78, 81, 83, 86]; // A4 B4 D5 E5 F#5 A5 B5 D6 (ре-мажорная пентатоника)

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function pluck(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, vel: number) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'triangle';
  o2.type = 'sine';
  o.frequency.value = hz(midi);
  o2.frequency.value = hz(midi + 12);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(700, t + 0.6);
  env(g, t, 0.2 * vel, 0.006, 1.0);
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  o.connect(f);
  o2.connect(g2);
  g2.connect(f);
  f.connect(g);
  g.connect(out);
  o.start(t);
  o2.start(t);
  o.stop(t + 1.3);
  o2.stop(t + 1.3);
}

function bassNote(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.value = hz(midi);
  env(g, t, 0.28, 0.02, 1.4);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + 1.7);
}

function pad(ctx: BaseAudioContext, out: AudioNode, t: number, notes: number[], len: number) {
  for (const m of notes) {
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = hz(m);
      o.detune.value = detune;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.045, t + 0.9);
      g.gain.setValueAtTime(0.045, t + len - 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.9);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + len + 1);
    }
  }
}

function flute(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, dur: number) {
  const o = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lg = ctx.createGain();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = hz(midi);
  lfo.frequency.value = 5.2;
  lg.gain.value = 5;
  lfo.connect(lg);
  lg.connect(o.detune);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.085, t + 0.05);
  g.gain.setValueAtTime(0.07, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  o.connect(g);
  g.connect(out);
  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.3);
  lfo.stop(t + dur + 0.3);
}

function bell(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = hz(midi);
  env(g, t, 0.05, 0.004, 2.2);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + 2.4);
}

/** Один такт музыки (4 доли). Используется и живым плеером, и офлайн-проверкой. */
export function scheduleBar(ctx: BaseAudioContext, out: AudioNode, t0: number, bar: number) {
  const chord = PROGRESSION[bar % PROGRESSION.length];
  const rnd = seeded(bar * 7919 + 13);
  const pattern = PATTERNS[Math.floor(bar / PROGRESSION.length) % 2 === 0 ? bar % 2 : (bar + 1) % 2];

  pad(ctx, out, t0, chord.pad, BAR);
  bassNote(ctx, out, t0, chord.bass);
  bassNote(ctx, out, t0 + BEAT * 2, chord.bass + (bar % 2 ? 7 : 0));
  pattern.forEach((idx, i) => {
    const human = (rnd() - 0.5) * 0.016;
    pluck(ctx, out, t0 + i * (BEAT / 2) + human, chord.arp[idx], i % 2 === 0 ? 1 : 0.7);
  });

  // Флейта: плавное «блуждание» по пентатонике, на сильной доле — звук аккорда
  let cur = PENTATONIC[2 + Math.floor(rnd() * 3)];
  for (let beat = 0; beat < 4; beat++) {
    if (beat === 0 || rnd() < 0.5) {
      if (beat === 0) cur = chord.arp[1 + Math.floor(rnd() * 3)] + 12;
      else {
        const i = Math.max(0, PENTATONIC.indexOf(cur));
        cur = PENTATONIC[Math.min(PENTATONIC.length - 1, Math.max(0, i + (rnd() < 0.5 ? -1 : 1)))];
      }
      const dur = rnd() < 0.4 ? BEAT * 2 : BEAT;
      flute(ctx, out, t0 + beat * BEAT, cur, dur);
      if (dur > BEAT) beat++;
    }
  }
  if (bar % 4 === 3) bell(ctx, out, t0 + BEAT * 2.5, 88);
}

/** Простая «комната»: затухающий шум как импульс реверберации. */
function makeReverb(ctx: BaseAudioContext): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * 2.4);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const rnd = seeded(42);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

/** Собирает цепочку «шина → сухой звук + реверберация → выход». */
function buildChain(ctx: BaseAudioContext, dest: AudioNode): GainNode {
  const bus = ctx.createGain();
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  const rev = makeReverb(ctx);
  bus.connect(dest);
  bus.connect(rev);
  rev.connect(wet);
  wet.connect(dest);
  return bus;
}

/** Самопроверка: «играет» несколько тактов в памяти и возвращает громкость и пик (для тестов). */
export async function renderDemo(bars = 4): Promise<{ rms: number; peak: number; windows: number[] }> {
  const sr = 22050;
  const secs = bars * BAR + 3;
  const ctx = new OfflineAudioContext(1, Math.floor(secs * sr), sr);
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  const bus = buildChain(ctx, comp);
  for (let b = 0; b < bars; b++) scheduleBar(ctx, bus, 0.05 + b * BAR, b);
  const buf = await ctx.startRendering();
  const data = buf.getChannelData(0);
  let sum = 0;
  let peak = 0;
  let bad = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (!Number.isFinite(v)) bad++;
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
  }
  const win = Math.floor(BAR * sr);
  const windows: number[] = [];
  for (let w = 0; w < bars; w++) {
    let s = 0;
    for (let i = w * win; i < Math.min(data.length, (w + 1) * win); i++) s += data[i] * data[i];
    windows.push(Math.sqrt(s / win));
  }
  return { rms: bad ? NaN : Math.sqrt(sum / data.length), peak, windows };
}

/** Запись фрагмента в виде чисел (для прослушивания «вживую»: можно сохранить в WAV). */
export async function renderPcm(bars = 16, sr = 22050): Promise<number[]> {
  const ctx = new OfflineAudioContext(1, Math.floor((bars * BAR + 3) * sr), sr);
  const comp = ctx.createDynamicsCompressor();
  const master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(comp);
  comp.connect(ctx.destination);
  const bus = buildChain(ctx, master);
  for (let b = 0; b < bars; b++) scheduleBar(ctx, bus, 0.05 + b * BAR, b);
  const buf = await ctx.startRendering();
  return Array.from(buf.getChannelData(0));
}

// ---------------------------------------------------------------------------
// Живой плеер: включение/выключение, громкость, автозапуск после первого касания
// ---------------------------------------------------------------------------

interface Settings {
  on: boolean;
  vol: number; // 0…1
}
function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && typeof s.vol === 'number') return { on: s.on !== false, vol: Math.min(1, Math.max(0, s.vol)) };
  } catch {
    /* нет сохранённых настроек */
  }
  return { on: true, vol: 0.4 };
}
let settings = load();
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bus: GainNode | null = null;
let timer: number | undefined;
let nextT = 0;
let bar = 0;
let gestured = false;
let menuVisible = false;
let suspendTimer: number | undefined;

const targetGain = () => (settings.on && menuVisible ? Math.pow(settings.vol, 1.6) * 0.55 : 0);

function ensure() {
  if (ctx) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);
  bus = buildChain(ctx, master);
}

function tick() {
  if (!ctx || !bus) return;
  while (nextT < ctx.currentTime + 2.5) {
    scheduleBar(ctx, bus, nextT, bar++);
    nextT += BAR;
  }
}

function sync() {
  const play = settings.on && menuVisible && gestured;
  if (play) {
    ensure();
    if (!ctx || !master) return;
    clearTimeout(suspendTimer);
    void ctx.resume();
    if (timer === undefined) {
      nextT = ctx.currentTime + 0.15;
      timer = window.setInterval(tick, 400);
      tick();
    }
    master.gain.setTargetAtTime(targetGain(), ctx.currentTime, 0.4);
  } else if (ctx && master) {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    clearTimeout(suspendTimer);
    suspendTimer = window.setTimeout(() => {
      if (ctx && timer === undefined) void ctx.suspend();
    }, 1500);
  }
}

export const music = {
  get on() {
    return settings.on;
  },
  get vol() {
    return settings.vol;
  },
  setOn(on: boolean) {
    settings = { ...settings, on };
    localStorage.setItem(KEY, JSON.stringify(settings));
    if (on) gestured = true; // нажатие кнопки — тоже жест пользователя
    sync();
  },
  setVolume(v: number) {
    settings = { ...settings, vol: Math.min(1, Math.max(0, v)) };
    localStorage.setItem(KEY, JSON.stringify(settings));
    if (ctx && master && settings.on && menuVisible && timer !== undefined) master.gain.setTargetAtTime(targetGain(), ctx.currentTime, 0.08);
    else if (settings.on) sync();
  },
  /** Музыка звучит только в меню (на экране входа и в комнате ожидания). */
  setMenuVisible(v: boolean) {
    if (menuVisible === v) return;
    menuVisible = v;
    sync();
  },
  /** Браузеры разрешают звук только после касания — запускаем при первом касании. */
  userGesture() {
    if (gestured) return;
    gestured = true;
    sync();
  },
};

(window as unknown as { __tsMusicTest: typeof renderDemo; __tsMusicPcm: typeof renderPcm }).__tsMusicTest = renderDemo;
(window as unknown as { __tsMusicPcm: typeof renderPcm }).__tsMusicPcm = renderPcm;
