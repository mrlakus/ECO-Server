// Настройки пользователя и уведомления («ваш ход», новое сообщение): звук, вибрация, мигание вкладки, системное уведомление.

const KEY = 'ts-prefs';

export interface Prefs {
  notifySound: boolean; // короткий звук, когда пришёл ваш ход / новое сообщение
  notifyVibrate: boolean; // вибрация на телефоне (когда вкладка не в фокусе)
  notifyBrowser: boolean; // системное уведомление браузера (когда вкладка не в фокусе)
}
const DEFAULTS: Prefs = { notifySound: true, notifyVibrate: true, notifyBrowser: false };

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}) };
  } catch {
    return { ...DEFAULTS };
  }
}
export const prefs: Prefs = load();
export function savePrefs() {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

// ---------- звук ----------
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  void ctx.resume();
  return ctx;
}
function tone(c: AudioContext, t: number, freq: number, dur: number, vol: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}
/** «Динь-дзынь» — ваш ход. */
export function chime() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  tone(c, t, 784, 0.35, 0.16);
  tone(c, t + 0.16, 1175, 0.5, 0.14);
}
/** Тихий «поп» — новое сообщение. */
export function pop() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.01;
  tone(c, t, 660, 0.12, 0.1);
  tone(c, t + 0.07, 880, 0.14, 0.08);
}
document.addEventListener('pointerdown', () => void (ctx && ctx.resume()), { passive: true });

// ---------- мигание заголовка вкладки ----------
const baseTitle = document.title;
let blinkTimer: number | undefined;
export function startBlink(text: string) {
  if (blinkTimer !== undefined) return;
  let on = false;
  blinkTimer = window.setInterval(() => {
    on = !on;
    document.title = on ? text : baseTitle;
  }, 900);
  document.title = text;
}
export function stopBlink() {
  if (blinkTimer !== undefined) clearInterval(blinkTimer);
  blinkTimer = undefined;
  document.title = baseTitle;
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) stopBlink();
});
window.addEventListener('focus', stopBlink);

// ---------- системные уведомления ----------
export const browserNotifySupported = () => 'Notification' in window;
export async function enableBrowserNotifications(): Promise<boolean> {
  if (!browserNotifySupported()) return false;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  prefs.notifyBrowser = perm === 'granted';
  savePrefs();
  return prefs.notifyBrowser;
}
function systemNotify(title: string, body: string, tag: string) {
  if (!prefs.notifyBrowser || !browserNotifySupported() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag, icon: '/art/icon.svg' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* на некоторых телефонах конструктор недоступен — тогда остаются звук и вибрация */
  }
}

/** Пришёл ваш ход. */
export function notifyTurn() {
  if (prefs.notifySound) chime();
  if (document.hidden) {
    if (prefs.notifyVibrate) navigator.vibrate?.([180, 80, 180]);
    startBlink('🔔 Ваш ход!');
    systemNotify('Три сестры', 'Ваш ход!', 'turn');
  }
}
/** Новое сообщение в чате. */
export function notifyChat(from: string, text: string) {
  if (prefs.notifySound) pop();
  if (document.hidden) {
    startBlink(`💬 ${from}`);
    systemNotify(`Сообщение от ${from}`, text.slice(0, 100), 'chat');
  }
}
