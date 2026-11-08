import {
  APIARY_HIVE2,
  APIARY_HONEY,
  APIARY_MAIN,
  APIARY_WAX,
  BARN,
  BARN_ITEMS,
  BEAN_CELLS,
  BEDS,
  CORN_CELLS,
  COMPOST_MAX,
  EVENT_NAMES,
  FIELD,
  GARDEN_CELLS,
  GARDEN_NAMES,
  GARDEN_ROWS,
  GOODS_MAX,
  MARKET,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PERENNIALS,
  PERENNIAL_CELLS,
  PERENNIAL_NAMES,
  PUMPKINS,
  PUMPKIN_SYMBOLS,
  ROUNDS,
  ROUND_EVENTS,
  UNIT_BED,
  UNIT_COUNT,
  type GardenRow,
} from '../shared/data';
import { beansDone, cornDone, scorePlayer, compostAvail, isPrepared } from '../shared/engine';
import type { Action, GameState, Options, PlayerState, Target } from '../shared/types';
import { FLOWER_COLORS, flower, goodsBadge, ic, rosette } from './icons';
import { VERSION } from '../shared/version';

// ---------------------------------------------------------------------------
// Состояние клиента
// ---------------------------------------------------------------------------

interface RoomInfo {
  code: string;
  hostId: string;
  started: boolean;
  vote?: { by: string; byName: string; waiting: string[] } | null;
  members: { id: string; name: string; connected: boolean; bot?: boolean }[];
}
interface Session {
  code: string;
  token: string;
  name: string;
}
type Tab = 'board' | 'sheet';

let ws: WebSocket | null = null;
let session: Session | null = loadSession();
let you = '';
let room: RoomInfo | null = null;
let state: GameState | null = null;
let options: Options | null = null;
let connected = false;
let tab: Tab = 'board';
let viewId = '';
let selection: { bed: number; crops: string[]; max: number } | null = null;
let pendingScroll: string | null = null;
let lastOptionsKey = '';
let retry = 0;
let showResults = true;

const app = document.getElementById('app')!;

function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem('ts-session') ?? 'null');
  } catch {
    return null;
  }
}
function saveSession(s: Session | null) {
  session = s;
  if (s) localStorage.setItem('ts-session', JSON.stringify(s));
  else localStorage.removeItem('ts-session');
}

// ---------------------------------------------------------------------------
// Сеть
// ---------------------------------------------------------------------------

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => {
    connected = true;
    retry = 0;
    if (session) send({ type: 'join', code: session.code, token: session.token, name: session.name });
    render();
  };
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
  ws.onclose = () => {
    connected = false;
    render();
    setTimeout(connect, Math.min(8000, 700 * 2 ** retry++));
  };
}

function send(msg: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
function act(action: Action) {
  send({ type: 'action', action });
}

function onMessage(m: any) {
  switch (m.type) {
    case 'joined':
      saveSession({ code: m.code, token: m.token, name: session?.name ?? pendingName });
      you = m.you;
      history.replaceState(null, '', `?room=${m.code}`);
      break;
    case 'update': {
      room = m.room;
      you = m.you;
      state = m.state ?? null;
      options = m.options ?? null;
      if (state?.phase !== 'over') showResults = true;
      if (!viewId || !state?.players.some((p) => p.id === viewId)) viewId = you;
      const key = options ? JSON.stringify([options.kind, options.die, options.hint, state?.round, state?.phase]) : '';
      if (key !== lastOptionsKey) {
        lastOptionsKey = key;
        selection = null;
        if (options?.kind === 'pick') tab = 'board';
        else if (options && ['turn', 'act', 'field'].includes(options.kind) && tab === 'board' && state?.phase !== 'over') tab = 'sheet';
      }
      break;
    }
    case 'ended':
      saveSession(null);
      room = null;
      state = null;
      options = null;
      selection = null;
      history.replaceState(null, '', location.pathname);
      toast(m.message);
      break;
    case 'left':
      saveSession(null);
      room = null;
      state = null;
      options = null;
      history.replaceState(null, '', location.pathname);
      break;
    case 'error':
      toast(m.message);
      if (!room && session) {
        // Комната не найдена при автопереподключении — сбрасываем сессию
        if (/не найдена|началась/.test(m.message)) saveSession(null);
      }
      break;
  }
  render();
}

let toastTimer: number | undefined;
function toast(msg: string) {
  const el = document.getElementById('toast')!;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------------------------------------------------------------------------
// Вспомогательные функции разметки
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const die = (v: number, size: '' | 'lg' | 'sm' | 'ghost' = '') =>
  `<span class="die ${size}" role="img" aria-label="кубик ${v}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'p' : ''}"></i>`).join('')}</span>`;
const cell = (kind: 's' | 'c', on: boolean, extra = '') => `<i class="cell ${kind}${on ? ' on' : ''} ${extra}"></i>`;
const me = () => state?.players.find((p) => p.id === you) ?? null;
const nameOf = (id: string) => state?.players.find((p) => p.id === id)?.name ?? '';
let pendingName = '';
const flowerOf = (c: string, on = true) => `<span class="fl ${on ? '' : 'off'}">${flower(FLOWER_COLORS[c])}</span>`;

/** Масштаб: вся сцена всегда целиком помещается в окно. Есть две раскладки: обычная (180×106) и широкая (232×88) — выбирается та, что даёт крупнее. */
let wide = false;
let portrait = false;
function fit() {
  const cs = getComputedStyle(document.documentElement);
  const hh = parseFloat(cs.getPropertyValue('--hh')) || 46;
  const dh = parseFloat(cs.getPropertyValue('--dh')) || 56;
  const w = window.innerWidth - 4;
  const h = window.innerHeight - hh - dh - 4;
  const uN = Math.min(w / 180, h / 106);
  const uW = Math.min(w / 232, h / 88);
  const useWide = uW > uN * 1.03;
  const u = Math.max(2, Math.min(16, useWide ? uW : uN));
  document.documentElement.style.setProperty('--u', `${u.toFixed(3)}px`);
  const p = window.innerHeight > window.innerWidth * 1.1;
  if (p !== portrait || useWide !== wide) {
    portrait = p;
    wide = useWide;
    if (state) render();
  }
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
document.addEventListener('fullscreenchange', fit);
fit();

// ---------------------------------------------------------------------------
// Экраны
// ---------------------------------------------------------------------------

function render() {
  const scrollY = window.scrollY;
  document.getElementById('tip')?.classList.remove('show');
  if (!room) app.innerHTML = renderLobby();
  else if (!state) app.innerHTML = renderRoom();
  else app.innerHTML = renderGame();
  window.scrollTo(0, scrollY);
}

const windowWrap = (inner: string) => `<div class="window"><div class="shutter"></div><div class="cork">${inner}</div><div class="shutter r"></div></div>`;

function renderLobby(): string {
  const params = new URLSearchParams(location.search);
  const code = (params.get('room') ?? '').toUpperCase();
  const saved = session?.name ?? localStorage.getItem('ts-name') ?? '';
  return `
  <div class="screen">
    <div class="logo"><div class="logo-ic">${ic.pumpkin}${ic.corn}${ic.bean}</div><h1>Три сестры</h1><p>Онлайн-версия настольной игры для 2–4 игроков</p><p class="verno">версия ${VERSION}</p></div>
    ${connected ? '' : '<div class="hint">Подключаемся к серверу…</div>'}
    ${windowWrap(`
    <div class="paper"><h3 class="script">Ваше имя</h3>
      <input type="text" id="name" maxlength="20" placeholder="Например, Алексей" value="${esc(saved)}" autocomplete="nickname"></div>
    <div class="paper"><h3 class="script">Новая комната</h3>
      <button class="btn block" data-a="create">Создать комнату</button></div>
    <div class="paper"><h3 class="script">Подключиться к другу</h3>
      <div class="row">
        <input type="text" id="code" maxlength="5" placeholder="Код комнаты" value="${esc(code)}" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase">
        <button class="btn" data-a="join" style="flex:none">Войти</button>
      </div></div>`)}
  </div>`;
}

function renderRoom(): string {
  const r = room!;
  const isHost = r.hostId === you;
  const link = `${location.origin}/?room=${r.code}`;
  return `
  <div class="screen">
    <div class="logo"><div class="logo-ic">${ic.pumpkin}${ic.corn}${ic.bean}</div><h1>Комната</h1><p>Отправьте код или ссылку друзьям</p></div>
    ${windowWrap(`
    <div class="paper"><div class="code">${r.code}</div>
      <div class="row"><button class="btn sec" data-a="copy" data-v="${esc(link)}">Скопировать ссылку</button>
      ${typeof navigator.share === 'function' ? `<button class="btn sec" data-a="share" data-v="${esc(link)}">Поделиться</button>` : ''}</div></div>
    <div class="paper"><h3 class="script">Игроки (${r.members.length}/${MAX_PLAYERS})</h3>
      <ul class="members">
        ${r.members
          .map(
            (m) =>
              `<li><span class="dot ${m.connected ? 'on' : ''}"></span>${esc(m.name)}${m.id === you ? ' <small>(вы)</small>' : ''}${m.id === r.hostId ? '<span class="badge">хозяин</span>' : ''}${m.bot && isHost ? `<button class="btn sec" data-a="removebot" data-v="${m.id}" style="flex:none;min-height:32px;padding:0 10px;margin-left:auto">✕</button>` : ''}</li>`,
          )
          .join('')}
      </ul>
      ${isHost && r.members.length < MAX_PLAYERS ? '<button class="btn sec block" style="margin-top:10px" data-a="addbot">🤖 Добавить бота</button>' : ''}
    </div>
    ${
      isHost
        ? `<button class="btn block" data-a="start" ${r.members.length < MIN_PLAYERS ? 'disabled' : ''}>${r.members.length < MIN_PLAYERS ? 'Ждём ещё игроков…' : 'Начать игру'}</button>`
        : '<div class="hint">Ждём, пока хозяин комнаты начнёт игру…</div>'
    }`)}
    <button class="btn sec block" data-a="leave">Выйти из комнаты</button>
  </div>`;
}

function renderGame(): string {
  const s = state!;
  const over = s.phase === 'over';
  const ev = ROUND_EVENTS[s.round - 1];
  const phaseName = { pick: 'Фаза садоводства', final: 'Последний кубик', event: `Событие: ${EVENT_NAMES[ev]}`, over: 'Конец игры' }[s.phase];
  return `
  <header class="top">
    <span class="round">Раунд ${Math.min(s.round, ROUNDS)}/${ROUNDS}</span>
    <span class="ev">${phaseName}${connected ? '' : ' · ⚠ нет связи'}</span>
    <span class="ver" title="Версия приложения">v${VERSION}</span>
    ${over ? '' : '<button class="hbtn" data-a="proposeend" title="Предложить всем закончить игру и выйти в меню">🏳 <span>Закончить игру</span></button>'}
    ${document.fullscreenEnabled ? `<button class="fs" data-a="fullscreen" title="На весь экран">${document.fullscreenElement ? '✕' : '⛶'}</button>` : ''}
    <nav class="tabs">
      <button data-a="tab" data-v="board" class="${tab === 'board' ? 'on' : ''}">Поле</button>
      <button data-a="tab" data-v="sheet" class="${tab === 'sheet' ? 'on' : ''}">Планшет</button>
    </nav>
  </header>
  ${portrait ? '<div class="rotate-hint">↻ Поверните устройство горизонтально — так планшет виден крупнее</div>' : ''}
  <main class="fit"><div class="stage ${wide ? 'wide' : ''}">${tab === 'board' ? renderBoard() : renderSheet()}</div></main>
  ${renderDock()}
  ${over && showResults ? `<div class="overlay">${renderResults()}</div>` : ''}
  ${renderVote()}`;
}

/** Окно голосования «закончить игру»: у остальных игроков — вопрос, у предложившего — ожидание. */
function renderVote(): string {
  const v = room?.vote;
  if (!v || !state || state.phase === 'over') return '';
  if (v.waiting.includes(you))
    return `<div class="overlay vote"><div class="paper results-card"><h3 class="script">🏳 ${esc(v.byName)} предлагает закончить игру</h3>
      <p class="legend" style="margin:0 0 12px;font-size:1rem">Если согласны все, партия прервётся и все выйдут в главное меню. Если кто-то откажется, игра продолжится.</p>
      <div class="row"><button class="btn" data-a="voteyes">Да, закончить</button><button class="btn sec" data-a="voteno">Нет, играем дальше</button></div></div></div>`;
  if (v.by === you) {
    const names = v.waiting.map((id) => esc(nameOf(id))).join(', ');
    return `<div class="overlay vote"><div class="paper results-card"><h3 class="script">Вы предложили закончить игру</h3>
      <p class="legend" style="margin:0 0 12px;font-size:1rem">Ждём ответа: <b>${names || '…'}</b>. Боты согласны.</p>
      <button class="btn sec block" data-a="cancelend">Отозвать предложение</button></div></div>`;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Общее поле
// ---------------------------------------------------------------------------

const NOTE: Record<string, { kind: string; pin: string; icons: string }> = {
  plantWater: { kind: 'photo', pin: 'green', icons: ic.seedling + ic.can },
  barn: { kind: 'sticky', pin: 'green', icons: ic.shears },
  barn2: { kind: 'sticky', pin: 'green', icons: ic.barn },
  compostGoods: { kind: 'collage', pin: 'green', icons: ic.compost + ic.crate },
  apiaryGarden: { kind: 'lined', pin: 'blue', icons: ic.bee + ic.apple },
  apiaryGardenGold: { kind: 'lined', pin: 'gold', icons: ic.bee + ic.apple },
  market: { kind: 'news', pin: 'green', icons: ic.crate },
};
const EVENT_ICON = { barn: ic.barn, rain: ic.can, market: ic.crate };
const EVENT_LABEL = { barn: 'Сарай', rain: 'Дождь', market: 'Рынок' };

function renderBoard(): string {
  const s = state!;
  const picking = options?.kind === 'pick';
  const first = s.players[s.first];
  const rounds = ROUND_EVENTS.map(
    (e, i) =>
      `<div class="rd ${i + 1 === s.round ? 'cur' : i + 1 < s.round ? 'done' : ''}" title="${EVENT_NAMES[e]}"><b>${i + 1}</b><span class="ei">${EVENT_ICON[e]}</span><span class="el">${EVENT_LABEL[e]}</span></div>`,
  ).join('');
  const noteHtml = (i: number) => {
    const f = FIELD[i];
    const dice = s.field[i];
    const ghosts = Math.max(0, (s.fieldStart?.[i]?.length ?? 0) - dice.length);
    const ghostVal = s.fieldStart?.[i]?.[0] ?? 1;
    const can = picking && options!.pickCells!.includes(i);
    const nt = NOTE[f.id];
    return `<button class="note ${nt.kind} pin-${nt.pin} ${can ? 'pick' : ''}" data-a="pick" data-v="${i}" ${can ? '' : 'disabled'}>
      <span class="n">${i + 1}</span><span class="nicons">${nt.icons}</span><span class="name">${esc(f.name)}</span>
      <span class="dice">${dice.map((v) => die(v)).join('')}${Array.from({ length: ghosts }, () => die(ghostVal, 'ghost')).join('')}</span>
      ${s.edith === i ? `<span class="edith" title="Фишка Эдит">${ic.edith}</span>` : ''}
    </button>`;
  };
  // Раскладка как на оригинальном поле: верхний ряд слева направо, нижний — справа налево (по часовой стрелке)
  const grid = [0, 1, 2, 3].map(noteHtml).join('') + [6, 5, 4].map(noteHtml).join('');
  const marker = `<div class="note marker"><span class="nicons">🥇</span><span class="name">Первый игрок</span><b class="who">${esc(first.name)}</b></div>`;

  const myGoods = me()?.goods ?? 0;
  const fl = flower('#f4f1ea', '#cfc7b0');
  const rows = MARKET.map((r, i) => {
    const next = MARKET[i + 1];
    const cur = myGoods >= r.min && (!next || myGoods < next.min);
    const range = next ? `${r.min}–${next.min - 1}` : `≥${r.min}`;
    const bonus = [
      r.perennial ? `<span class="bn">${fl}${r.perennial > 1 ? `×${r.perennial}` : ''}</span>` : '',
      r.gardenBonus ? `<span class="bn">${ic.star} в саду</span>` : '',
      r.anyBonus ? `<span class="bn">${ic.star} любое</span>` : '',
      r.compost ? `<span class="bn">${r.compost} компост</span>` : '',
    ]
      .filter(Boolean)
      .join(' и ');
    return `<tr class="${cur ? 'you' : ''}"><td>${range}</td><td>${bonus}</td></tr>`;
  }).join('');
  const active = s.phase === 'pick' ? s.players[(s.first + s.pickPos) % s.players.length] : null;
  const players = s.players
    .map((p) => {
      const sc = scorePlayer(p);
      const turn = active === p || (s.phase !== 'pick' && p.tasks.length > 0);
      return `<button class="pl ${turn ? 'turn' : ''}" data-a="viewsheet" data-v="${p.id}"><b>${esc(p.name)}${p.id === you ? ' (вы)' : ''}</b>
        <span class="stat"><span class="st">${ic.crate}${p.goods}</span><span class="st">${ic.compost}${compostAvail(p)}</span><span class="st sc">≈${sc.total}</span></span></button>`;
    })
    .join('');
  const log = [...s.log].reverse().slice(0, 9).map((l) => `<li class="${l.startsWith('—') ? 'sep' : ''}">${esc(l)}</li>`).join('');

  return `<div class="bboard">
    <div class="bleft">${windowWrap(`
      <div class="paper rounds-paper"><div class="rounds">${rounds}</div></div>
      <div class="field">${grid}${marker}</div>`)}</div>
    <div class="bcol">
      <div class="paper torn market-paper"><div class="mtitle">Фермерский рынок</div>
        <table class="market"><thead><tr><th>Товары</th><th>Бонусы</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="pl-list">${players}</div>
      <ul class="log">${log}</ul>
    </div>
  </div>`;
}

function renderResults(): string {
  const s = state!;
  const sc = s.scores!;
  const rows = s.players
    .map((p, i) => {
      const x = sc[i];
      return `<tr class="${s.winners.includes(p.id) ? 'win' : ''}"><td>${s.winners.includes(p.id) ? '🏆 ' : ''}${esc(p.name)}</td><td>${x.garden}</td><td>${x.perennials}</td><td>${x.apiary}</td><td>${x.orchard}</td><td>${x.barn}</td><td>${x.total}</td></tr>`;
    })
    .join('');
  const win = s.winners.map(nameOf).join(' и ');
  return `<div class="paper results-card"><h3 class="script">🏆 Победил${s.winners.length > 1 ? 'и' : ''}: ${esc(win)}</h3>
    <table class="results"><thead><tr><th></th><th>Огород</th><th>Клумба</th><th>Пасека</th><th>Сад</th><th>Сарай</th><th>Итого</th></tr></thead><tbody>${rows}</tbody></table>
    ${room?.hostId === you ? '<button class="btn block" style="margin-top:10px" data-a="restart">Новая партия в этой комнате</button>' : '<p class="legend">Хозяин комнаты может начать новую партию.</p>'}
    <div class="row" style="margin-top:8px"><button class="btn sec" data-a="closeresults">Посмотреть планшеты</button><button class="btn sec" data-a="leave">Выйти</button></div></div>`;
}

// ---------------------------------------------------------------------------
// Планшет игрока (всё на одном экране, расположение как у печатного листа)
// ---------------------------------------------------------------------------

const whiteFlower = flower('#f4f1ea', '#cfc7b0');
const TARGET_ICON: Record<string, string> = {
  garden: ic.apple,
  barn: ic.barn,
  apiary: ic.bee,
  apple: ic.apple,
  peach: ic.peach,
  blackberry: ic.blackberry,
  raspberry: ic.raspberry,
  any: '',
};

/** Мини-язык значков: vp:3 (ПО), goods:2 (товары), compost:1, star:garden (бонусное действие), die:±1, x:2 и т.д. */
function tk(t: string): string {
  const [k, v] = t.split(':');
  switch (k) {
    case 'vp':
      return rosette(v);
    case 'goods':
      return goodsBadge(v);
    case 'compost':
      return `<span class="fxc">${ic.compost}<b>+${v}</b></span>`;
    case 'cn':
      return `<span class="fxc">${ic.compost}<b>${v}</b></span>`;
    case 'star':
      return `<span class="fxs">${ic.star}${TARGET_ICON[v] ?? ''}</span>`;
    case 'die':
      return `<span class="fxd">${ic.die}<b>${v}</b></span>`;
    case 'plant':
      return ic.seedling;
    case 'water':
      return ic.can;
    case 'x':
      return `<b class="fxx">×${v}</b>`;
    case 'bean':
      return ic.bean;
    case 'pumpkin':
      return ic.pumpkin;
    case 'peach':
      return ic.peach;
    case 'fruit':
      return ic.apple + ic.raspberry;
    case 'flower':
      return whiteFlower;
    case 'fl':
      return flower(FLOWER_COLORS[v]);
    case 'blank':
      return rosette('');
    default:
      return '';
  }
}
const fx = (...ts: string[]) => `<span class="fx">${ts.map(tk).join('')}</span>`;

/** Эффекты ячеек многолетников (снизу вверх) значками. */
const PEREN_FX: Record<string, string[][]> = {
  tulip: [['star:garden'], ['peach', 'goods:2'], [], ['peach', 'goods:3'], [], ['vp:1', 'fruit']],
  hydrangea: [['star:apple'], [], ['star:blackberry'], ['star:raspberry'], ['star:peach'], ['vp:7']],
  iris: [['compost:1'], ['die:±1'], [], ['die:±2'], [], ['vp:12']],
  hyacinth: [['goods:2'], ['goods:2'], [], ['goods:2'], [], ['vp:10']],
  crocus: [['compost:2'], ['compost:1'], ['compost:1'], ['compost:2'], [], ['vp:6']],
  narcissus: [['star:barn'], [], ['star:barn'], ['star:barn'], ['star:barn'], ['vp:4']],
};
const PEREN_TIP: Record<string, string[]> = {
  tulip: [
    'Выполните бонусное действие в саду.',
    'Всякий раз, собрав персики, вы получаете 2 товара.',
    'Нет бонуса.',
    'Всякий раз, собрав персики, вы получаете 3 товара (вместо 2).',
    'Нет бонуса.',
    'В конце игры получите 1 ПО за каждый сбор фруктов и/или ягод в саду (максимум 15 ПО).',
  ],
  hydrangea: ['Выполните бонусное действие с яблоками.', 'Нет бонуса.', 'Выполните бонусное действие с ежевикой.', 'Выполните бонусное действие с малиной.', 'Выполните бонусное действие с персиками.', 'В конце игры получите 7 ПО.'],
  iris: [
    'Получите 1 компост.',
    'Всякий раз, прежде чем выполнить посадку или полив, можете считать, что значение кубика больше или меньше на 1.',
    'Нет бонуса.',
    'Всякий раз, прежде чем выполнить посадку или полив, можете считать, что значение кубика больше или меньше на 1–2.',
    'Нет бонуса.',
    'В конце игры получите 12 ПО. (Значение 1 можно уменьшить до 6, а 6 увеличить до 1.)',
  ],
  hyacinth: ['Получите 2 товара.', 'Получите 2 товара.', 'Нет бонуса.', 'Получите 2 товара.', 'Нет бонуса.', 'В конце игры получите 10 ПО.'],
  crocus: ['Получите 2 компоста.', 'Получите 1 компост.', 'Получите 1 компост.', 'Получите 2 компоста.', 'Нет бонуса.', 'В конце игры получите 6 ПО.'],
  narcissus: ['Выполните бонусное действие в сарае.', 'Нет бонуса.', 'Выполните бонусное действие в сарае.', 'Выполните бонусное действие в сарае.', 'Выполните бонусное действие в сарае.', 'В конце игры получите 4 ПО.'],
};

const MAIN_FX = [[], ['star:garden'], [], ['star:garden', 'x:2'], []];
const WAX_FX = [['goods:2', 'vp:2'], ['goods:4', 'vp:2'], [], ['goods:4', 'vp:5']];
const HONEY_FX = [['vp:5'], ['vp:5'], [], ['vp:8']];
const HIVE_FX = [['vp:3'], ['plant'], ['star:garden', 'x:3'], ['plant', 'water', 'x:2']];
const MAIN_TIP = ['', 'Основной улей: выполните 1 бонусное действие в саду.', '', 'Основной улей: выполните 2 бонусных действия в саду.', 'Когда вы закрасите последнюю ячейку, вам станут доступны воск, мёд и деление семьи.'];
const WAX_TIP = ['Воск (1-й сбор): 2 товара сразу и 2 ПО в конце игры.', 'Воск (2-й сбор): 4 товара сразу и 2 ПО в конце игры.', '', 'Воск (3-й сбор): 4 товара сразу и 5 ПО в конце игры.'];
const HONEY_TIP = ['Мёд (1-й сбор): 5 ПО в конце игры.', 'Мёд (2-й сбор): 5 ПО в конце игры.', '', 'Мёд (3-й сбор): 8 ПО в конце игры.'];
const HIVE_TIP = ['Деление семьи: 3 ПО в конце игры.', 'Деление семьи: выполните действие посадки на любой грядке.', 'Деление семьи: выполните 3 бонусных действия в саду.', 'Деление семьи: выполните 2 действия посадки и/или полива на любых грядках (можно оба на одной грядке или по одному на разных).'];

const ROW_NAME_TIP: Record<GardenRow, string> = {
  apple: 'Яблоки: всего 6 сборов. Каждый сбор приносит 3 ПО в конце игры.',
  peach: 'Персики: всего 4 сбора. Всякий раз, собрав персики, выполните действие полива на любой грядке.',
  blackberry: 'Ежевика: всего 7 сборов. Каждый сбор приносит 2 ПО в конце игры.',
  raspberry: 'Малина: всего 9 сборов. Каждый сбор даёт 3 товара. За 3-й, 6-й и 9-й сбор в конце игры получите 1, 2 и 3 ПО.',
};
const ROW_ICON: Record<GardenRow, string> = { apple: ic.apple, peach: ic.peach, blackberry: ic.blackberry, raspberry: ic.raspberry };
const ROW_FX: Record<GardenRow, string[]> = { apple: ['vp:3'], peach: ['water'], blackberry: ['vp:2'], raspberry: ['goods:3'] };
const RASP_VP: Record<number, string> = { 3: 'vp:1', 6: 'vp:2', 9: 'vp:3' };

/** Краткий текст предметов сарая — как на печатном листе, но со значками. */
const BARN_SHORT: Record<string, string> = {
  preserves: `${fx('goods:1')} за сбор ежевики`,
  buffet: `${fx('goods:1')} за сбор яблока/персика`,
  shovel: `Потратьте ${fx('cn:3')} чтобы 1 ${fx('star:any')}`,
  fruitbowl: `1/2/3/4 разных фруктов — 1/4/7/10 ${fx('blank')}`,
  barrel: `После дождя: полейте в 1 зоне ${fx('water')}`,
  casserole: `${fx('vp:1')} за 2 фасоли ${fx('bean')}`,
  labels: `+${fx('flower')} на рынке`,
  chisel: `Когда ${fx('fl:crocus')} крокус: ${fx('star:apiary')} пасека`,
  pitchfork: `Когда ${fx('fl:hydrangea')} гортензия: ${fx('compost:1')}`,
  trimmer: '',
  wheelbarrow: `${fx('goods:1')} после действия в сарае`,
  mulch: `Сделайте 1 ${fx('flower')} вместо действия рондели`,
  tractor: '',
  carving: `${fx('vp:1')} за тыкву в самой длинной цепочке`,
  seeder: `При посадке закрашивайте первую клетку в трёх культурах`,
};

/** Подсказка-«лупа»: крупная карточка с полным текстом. */
const tip = (title: string, body: string, extra = '') => esc(`<div class="tt"><h5>${title}</h5>${extra}<p>${body}</p></div>`);

/** Какие места на планшете сейчас можно нажать (для текущего запроса игры). */
function targetMap(): Map<string, number | undefined> {
  const m = new Map<string, number | undefined>();
  const o = options;
  if (!o) return m;
  if (o.kind === 'turn' && o.cellLeft) for (const t of [...(o.cellTargets ?? []), ...(o.mulchTargets ?? [])]) m.set(`${t.area}:${t.target}`, undefined);
  if (o.kind === 'act') (o.slots ?? []).forEach((sl, i) => sl.targets.forEach((t) => !m.has(`${t.area}:${t.target}`) && m.set(`${t.area}:${t.target}`, i)));
  return m;
}

function renderSheet(): string {
  const s = state!;
  const p = s.players.find((x) => x.id === viewId) ?? me()!;
  const mineView = p.id === you;
  const tmap = mineView ? targetMap() : new Map<string, number | undefined>();
  const hot = (area: string, target: string) => tmap.has(`${area}:${target}`);
  const tattr = (area: string, target: string) =>
    hot(area, target) ? ` data-a="target" data-area="${area}" data-target="${target}"${tmap.get(`${area}:${target}`) !== undefined ? ` data-slot="${tmap.get(`${area}:${target}`)}"` : ''}` : '';
  const sc = scorePlayer(p);

  const chips = s.players
    .map((x) => `<button class="${x.id === p.id ? 'on' : ''}" data-a="view" data-v="${x.id}">${esc(x.name)}${x.id === you ? ' (я)' : ''}</button>`)
    .join('');

  // ---- Огород ----
  const sel = selection;
  const cellsRow = (n: number, f: number, dir: 'h' | 'v') => {
    let h = '';
    if (dir === 'h') for (let j = 0; j < n; j++) h += cell(j === n - 1 ? 'c' : 's', j < f);
    else for (let j = n - 1; j >= 0; j--) h += cell(j === n - 1 ? 'c' : 's', j < f);
    return h;
  };
  const cropBtn = (id: string, inner: string, done: boolean, tipHtml = '') => {
    const planting = mineView && sel && options?.plant?.find((b) => b.bed === sel.bed)?.crops?.includes(id);
    const chosen = sel?.crops.includes(id);
    return `<button class="crop ${planting ? 'pick' : ''} ${chosen ? 'chosen' : ''} ${done ? 'done' : ''}" ${planting ? `data-a="crop" data-v="${id}"` : 'disabled'} ${tipHtml ? `data-tip="${tipHtml}"` : ''}>${inner}</button>`;
  };
  const unit = (i: number) =>
    `<div class="unit">${cropBtn(`c${i}`, `${ic.corn}${cellsRow(CORN_CELLS, p.corn[i], 'h')}${rosette(3)}`, p.corn[i] >= CORN_CELLS, tip('Кукуруза', 'Растёт на этой грядке: 4 ячейки. Каждый собранный урожай кукурузы приносит 3 ПО в конце игры.'))}${cropBtn(`b${i}`, `${ic.bean}${cellsRow(BEAN_CELLS, p.beans[i], 'h')}${rosette(1)}`, p.beans[i] >= BEAN_CELLS, tip('Фасоль', '2 ячейки. Сажать можно, только если на соседней кукурузе закрашены хотя бы 2 ячейки. Каждый собранный урожай фасоли приносит 1 ПО в конце игры.'))}</div>`;
  const pk = (i: number, dir: 'h' | 'v') => {
    const d = PUMPKINS[i];
    const f = p.pumpkins[i];
    return `<div class="pk ${dir}">${cropBtn(`p${i}`, `${goodsBadge(d.goods)}${cellsRow(d.cells, f, dir)}`, f >= d.cells, tip(`Тыква #${i + 1} (грядка ${d.bed})`, `Собрав тыкву, вы сразу получаете ${d.goods} ${d.goods === 1 ? 'товар' : 'товара'}. Тыквы не приносят ПО. Собрав две соседние тыквы, закрасьте цветок между ними и сделайте действие с этим многолетником.`))}</div>`;
  };
  /** Цветок между двумя соседними тыквами — с подписью, какой это многолетник. */
  const sy = (i: number) => {
    const name = PERENNIAL_NAMES[PUMPKIN_SYMBOLS[i]];
    return `<span class="sy ${p.symbols[i] ? 'on' : ''}" data-tip="${tip(`Цветок: ${name}`, `Между тыквами #${i + 1} и #${((i + 1) % 12) + 1}. Когда обе собраны, закрасьте этот цветок и выполните действие с многолетником «${name}»: закрасьте следующую ячейку его столбца на клумбе.`)}">${flowerOf(PUMPKIN_SYMBOLS[i], p.symbols[i])}<span class="sn">${name}</span></span>`;
  };
  // Кольцо тыкв идёт по контуру огорода, но каждая тыква лежит внутри своей грядки — у её внешнего края.
  // p<N> — тыква, s<N> — цветок между тыквами N и N+1. Порядок — по часовой стрелке.
  const STRIPS: Record<number, { top?: string[]; bottom?: string[]; left?: string[]; right?: string[] }> = {
    1: { top: ['p0', 's11'], left: ['s0', 'p1', 's1', 'p2', 's2'] },
    2: { top: ['p11', 's10'] },
    3: { top: ['p10', 's9'], right: ['p9', 's8'] },
    4: { right: ['p8', 's7', 'p7', 's6'], bottom: ['s5', 'p6'] },
    5: { bottom: ['s4', 'p5'] },
    6: { left: ['p3'], bottom: ['s3', 'p4'] },
  };
  const ringItem = (x: string, dir: 'h' | 'v') => (x[0] === 'p' ? pk(Number(x.slice(1)), dir) : sy(Number(x.slice(1))));
  const strip = (cls: string, items: string[] | undefined, dir: 'h' | 'v') => (items ? `<div class="${cls}">${items.map((x) => ringItem(x, dir)).join('')}</div>` : '');
  const bedHtml = (b: number) => {
    const plantOpt = mineView && !sel ? options?.plant?.find((o) => o.bed === b) : undefined;
    const waterOpt = mineView && !sel ? options?.water?.find((o) => o.bed === b) : undefined;
    const btns =
      (plantOpt ? `<button class="bb" data-a="plantbed" data-v="${b}" title="Посадка">${ic.seedling}${plantOpt.cost ? `<i>−${plantOpt.cost}</i>` : ''}</button>` : '') +
      (waterOpt ? `<button class="bb w" data-a="water" data-v="${b}" title="Полив">${ic.can}${waterOpt.cost ? `<i>−${waterOpt.cost}</i>` : ''}</button>` : '');
    const st = STRIPS[b] ?? {};
    return `<div class="bed b${b} ${plantOpt || waterOpt ? 'ok' : ''} ${sel?.bed === b ? 'sel' : ''}" id="bed-${b}">
      ${strip('btop', st.top, 'h') || '<div></div>'}
      <div class="bmid">${strip('bside', st.left, 'v')}
        <div class="bmain"><div class="bh"><b class="bnum">${b}</b><span class="bact">${btns}</span>${die(b, 'sm')}</div>
          <div class="units">${UNIT_BED.map((ub, i) => (ub === b ? unit(i) : '')).join('')}</div></div>
        ${strip('bside', st.right, 'v')}</div>
      ${strip('bbot', st.bottom, 'h') || '<div></div>'}</div>`;
  };
  const garden = `<div class="garden"><div class="beds">${[1, 2, 3, 6, 5, 4].map(bedHtml).join('')}</div></div>`;

  // ---- Клумба ----
  const per = PERENNIALS.map((c, i) => {
    const f = p.perennial[i];
    let rowsH = '';
    for (let j = PERENNIAL_CELLS - 1; j >= 0; j--)
      rowsH += `<div class="prow" data-tip="${tip(`${PERENNIAL_NAMES[c]} — ячейка ${j + 1}`, PEREN_TIP[c][j], j === 5 ? '' : '')}">${cell(j === 5 ? 'c' : 's', j < f)}${fx(...PEREN_FX[c][j])}</div>`;
    return `<div class="pcol ${hot('perennial', c) ? 'hl' : ''}" style="--fc:${FLOWER_COLORS[c]}"${tattr('perennial', c)}><div class="ph">${flower(FLOWER_COLORS[c])}<span>${PERENNIAL_NAMES[c]}</span></div>${rowsH}</div>`;
  }).join('');

  // ---- Пасека ----
  const lockedApiary = p.main < APIARY_MAIN.length;
  const acol = (id: string, title: string, n: number, kinds: ('s' | 'c')[], fxs: string[][], tips: string[], locked: boolean) => {
    let h = '';
    for (let j = kinds.length - 1; j >= 0; j--)
      h += `<div class="prow"${tips[j] ? ` data-tip="${tip(title, tips[j])}"` : ''}>${cell(kinds[j], j < n)}${fx(...fxs[j])}</div>`;
    return `<div class="acol ${locked ? 'lock' : ''} ${hot('apiary', id) ? 'hl' : ''}"${tattr('apiary', id)}><h4>${title}</h4>${h}</div>`;
  };
  const apiary = `<div class="box apiarybox"><h3 class="bt2">${ic.bee}Пасека</h3><div class="apiary">
    ${acol('main', 'Улей', p.main, APIARY_MAIN.map((c) => c.kind), MAIN_FX, MAIN_TIP, false)}
    ${acol('wax', 'Воск', p.wax, APIARY_WAX.map((c) => c.kind), WAX_FX, WAX_TIP, lockedApiary)}
    ${acol('honey', 'Мёд', p.honey, APIARY_HONEY.map((c) => c.kind), HONEY_FX, HONEY_TIP, lockedApiary)}
    ${acol('hive2', 'Семья', p.hive2, APIARY_HIVE2.map(() => 'c' as const), HIVE_FX, HIVE_TIP, lockedApiary)}</div></div>`;

  // ---- Сад ----
  const orchard = `<div class="box orchardbox"><h3 class="bt2">${ic.apple}Сад</h3>${GARDEN_ROWS.map((r) => {
    const cells = GARDEN_CELLS[r]
      .map((k, i) => {
        const extra = r === 'raspberry' && RASP_VP[i + 1] ? [RASP_VP[i + 1]] : [];
        return `<span class="gc">${cell(k, i < p.garden[r], extra.length ? 'mark' : '')}${k === 'c' ? fx(...ROW_FX[r]) : '<span class="fx"></span>'}${r === 'raspberry' ? fx(...extra) : ''}</span>`;
      })
      .join('');
    return `<div class="orow ${hot('garden', r) ? 'hl' : ''}"${tattr('garden', r)} data-tip="${tip(GARDEN_NAMES[r], ROW_NAME_TIP[r])}">${ROW_ICON[r]}<div class="ocells">${cells}</div></div>`;
  }).join('')}</div>`;

  // ---- Сарай ----
  const barn = `<div class="box barnbox"><h3 class="bt2">${ic.barn}Сарай</h3><div class="barn">${BARN_ITEMS.map((it, idx) => {
    const d = BARN[it];
    const n = p.barn[it];
    const ready = n >= d.cells.length;
    const big = tip(d.name, d.desc, `<div class="ttcells">${d.cells.map((k, i) => cell(k, i < n)).join('')}${d.vp ? rosette(d.vp) : ''}</div>`);
    return `<div class="item ${ready ? 'ready' : ''} ${hot('barn', it) ? 'hl' : ''} col${idx % 3}"${tattr('barn', it)} data-tip="${big}">
      <div class="in"><span>${d.name}</span>${d.vp ? rosette(d.vp) : '<small>особо</small>'}</div>
      <div class="cells">${d.cells.map((k, i) => cell(k, i < n)).join('')}</div>
      <div class="btx">${BARN_SHORT[it]}</div></div>`;
  }).join('')}</div></div>`;

  // ---- Шкалы и итог ----
  let g = '';
  for (let i = 1; i <= GOODS_MAX; i++) g += `<div class="sq ${i % 5 === 0 ? 'star' : ''} ${i <= p.goods ? 'on' : ''}">${i % 5 === 0 ? '★' : ''}</div>`;
  let c = '';
  for (let i = 1; i <= COMPOST_MAX; i++) c += `<div class="sq cp ${i <= p.compostSpent ? 'spent' : i <= p.compostGained ? 'on' : ''}"></div>`;
  const scales = `<div class="box goodsbox" data-tip="${tip('Шкала товаров', 'Получая товары, закрашивайте клетки слева направо, сверху вниз. Закрасив клетку со звездой (каждая 5-я), немедленно выполните любое бонусное действие (кроме огорода). От числа товаров зависят бонусы фермерского рынка. Товары никогда не тратятся.')}"><h3 class="bt2">${ic.crate}Товары: ${p.goods}</h3><div class="grid15">${g}</div></div>
    <div class="box compostbox" data-tip="${tip('Шкала компоста', 'Компост можно потратить перед посадкой или поливом: каждая единица меняет значение кубика на 1 (1 можно уменьшить до 6, а 6 увеличить до 1).')}"><h3 class="bt2">${ic.compost}Компост: ${compostAvail(p)}</h3><div class="grid10">${c}</div></div>
    <div class="box scorebox"><h3 class="bt2">Итог</h3><table class="sc"><tbody>
      <tr><td>Огород</td><td>${sc.garden}</td></tr><tr><td>Клумба</td><td>${sc.perennials}</td></tr><tr><td>Пасека</td><td>${sc.apiary}</td></tr>
      <tr><td>Сад</td><td>${sc.orchard}</td></tr><tr><td>Сарай</td><td>${sc.barn}</td></tr><tr class="tot"><td>Всего</td><td>${sc.total}</td></tr></tbody></table></div>`;

  return `<div class="sheet">
    <div class="pbar">${chips}<span class="legend2">наведите мышь на ячейку — крупное описание · подсвеченное можно нажимать</span></div>
    <div class="panels">
      <div class="gpanel">${garden}<div class="box perbox"><div class="per">${per}</div></div></div>
      <div class="rpanel"><div class="rA"><div class="lcol">${apiary}${orchard}</div>${barn}</div><div class="rB">${scales}</div></div>
    </div></div>`;
}

// ---------------------------------------------------------------------------
// Нижняя панель (контекст + кнопки)
// ---------------------------------------------------------------------------

function renderDock(): string {
  const o = options;
  const s = state!;
  const over = s.phase === 'over';
  let text = o?.hint ?? '';
  let btns = '';
  let dieHtml = '';
  if (over) {
    text = 'Партия окончена';
    btns = `<button class="chip auto" data-a="openresults">Итоги</button>`;
  } else if (selection) {
    const left = selection.max - selection.crops.length;
    text = `Посадка на грядке ${selection.bed}: нажимайте культуры на планшете (${selection.crops.length}/${selection.max})${left > 0 ? '' : ' — максимум'}`;
    btns = `<button class="chip auto" data-a="confirmplant" ${selection.crops.length ? '' : 'disabled'}>✔ Посадить</button><button class="chip" data-a="cancelplant">Отмена</button>`;
  } else if (o && o.kind === 'pick') {
    text = 'Ваш ход: нажмите на группу кубиков на общем поле';
  } else if (o && o.kind === 'turn') {
    dieHtml = die(o.die!, 'lg');
    const shift = [o.compost ? `компост ${o.compost}` : '', o.irisShift ? `ирис ±${o.irisShift}` : ''].filter(Boolean).join(', ');
    text = `Огород: нажмите 🌱 или 💧 у подсвеченной грядки · Клетка «${o.cellName}»${o.cellLeft ? '' : ' (готово)'}${shift ? ` · ${shift}` : ''}`;
    if (o.cellLeft && o.cellKind === 'auto') btns += `<button class="chip auto" data-a="cell">${esc(o.autoLabel ?? '')}</button>`;
    else if (o.cellLeft && o.cellKind === 'act') text += ' — выберите место на планшете';
  } else if (o && o.kind === 'act') {
    const sl = o.slots ?? [];
    text = `${sl[0]?.label ?? 'Бонус'}${sl.length > 1 ? ` (+ ещё ${sl.length - 1})` : ''} — нажмите подсвеченное место на планшете`;
  } else if (o && o.kind === 'field') {
    text = `${o.hint}: нажмите 🌱 или 💧 у грядки`;
  }
  const active = !!o && !['wait', 'over', 'rain', 'pick'].includes(o.kind);
  if (active && !selection) {
    if (o!.canShovel) btns += `<button class="chip" data-a="shovel">Лопата −3</button>`;
    btns += `<button class="chip link" data-a="skip">Пропустить</button>`;
  }
  return `<div class="dock"><div class="dtext">${dieHtml}<span>${esc(text).replace('🌱', ic.seedling).replace('💧', ic.can)}</span></div><div class="dbtns">${btns}</div></div>`;
}

// ---------------------------------------------------------------------------
// События
// ---------------------------------------------------------------------------

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-a]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const a = el.dataset.a!;
  const v = el.dataset.v ?? '';
  switch (a) {
    case 'create':
    case 'join': {
      const name = (document.getElementById('name') as HTMLInputElement).value.trim();
      if (!name) return toast('Введите имя');
      localStorage.setItem('ts-name', name);
      pendingName = name;
      session = { code: '', token: '', name };
      if (a === 'create') send({ type: 'create', name });
      else {
        const code = (document.getElementById('code') as HTMLInputElement).value.trim().toUpperCase();
        if (code.length < 4) return toast('Введите код комнаты');
        send({ type: 'join', code, name });
      }
      return;
    }
    case 'start':
      return send({ type: 'start' });
    case 'restart':
      return send({ type: 'restart' });
    case 'addbot':
      return send({ type: 'addbot' });
    case 'removebot':
      return send({ type: 'removebot', id: v });
    case 'leave':
      if (confirm('Выйти из комнаты?')) send({ type: 'leave' });
      return;
    case 'copy':
      navigator.clipboard?.writeText(v).then(() => toast('Ссылка скопирована'), () => toast(v));
      return;
    case 'share':
      navigator.share?.({ title: 'Три сестры', text: 'Заходи играть в «Три сестры»!', url: v }).catch(() => {});
      return;
    case 'tab':
      tab = v as Tab;
      return render();
    case 'view':
      viewId = v;
      return render();
    case 'proposeend':
      if (confirm('Предложить всем закончить игру? Если все согласятся, партия прервётся и все выйдут в главное меню.')) send({ type: 'proposeend' });
      return;
    case 'voteyes':
      return send({ type: 'voteend', yes: true });
    case 'voteno':
      return send({ type: 'voteend', yes: false });
    case 'cancelend':
      return send({ type: 'cancelend' });
    case 'fullscreen':
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
      return;
    case 'viewsheet':
      viewId = v;
      tab = 'sheet';
      return render();
    case 'closeresults':
      showResults = false;
      tab = 'sheet';
      return render();
    case 'openresults':
      showResults = true;
      return render();
    case 'pick':
      return act({ t: 'pick', cell: Number(v) });
    case 'plantbed': {
      const b = options?.plant?.find((x) => x.bed === Number(v));
      if (!b) return;
      selection = { bed: b.bed, crops: [], max: b.max ?? 2 };
      tab = 'sheet';
      viewId = you;
      pendingScroll = `bed-${b.bed}`;
      return render();
    }
    case 'crop': {
      if (!selection) return;
      const i = selection.crops.indexOf(v);
      if (i >= 0) selection.crops.splice(i, 1);
      else if (selection.crops.length < selection.max) selection.crops.push(v);
      else toast(`Не более ${selection.max} культур`);
      return render();
    }
    case 'cancelplant':
      selection = null;
      return render();
    case 'confirmplant': {
      if (!selection) return;
      const s = selection;
      selection = null;
      return act({ t: 'plant', bed: s.bed, crops: s.crops });
    }
    case 'water':
      return act({ t: 'water', bed: Number(v) });
    case 'cell':
      return act({ t: 'cell' });
    case 'target': {
      const slot = el.dataset.slot;
      return act({ t: 'act', area: el.dataset.area as any, target: el.dataset.target!, ...(slot !== undefined ? { slot: Number(slot) } : {}) });
    }
    case 'shovel':
      return act({ t: 'shovel' });
    case 'skip':
      if (confirm('Пропустить это действие? Бонус пропадёт.')) act({ t: 'skip' });
      return;
  }
});

// Подсказка-«лупа»: крупное описание при наведении на любую ячейку (на телефоне — по нажатию)
const tipEl = document.getElementById('tip')!;
let tipTimer: number | undefined;
function placeTip(x: number, y: number) {
  const r = tipEl.getBoundingClientRect();
  let left = x + 18;
  let top = y + 18;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 18;
  if (left < 8) left = 8;
  if (top + r.height > window.innerHeight - 8) top = window.innerHeight - r.height - 8;
  if (top < 8) top = 8;
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${top}px`;
}
function showTip(el: HTMLElement, x: number, y: number) {
  const html = el.dataset.tip ?? '';
  if (tipEl.dataset.src !== html) {
    tipEl.innerHTML = html;
    tipEl.dataset.src = html;
  }
  tipEl.classList.add('show');
  placeTip(x, y);
}
const hideTip = () => {
  tipEl.classList.remove('show');
  tipEl.dataset.src = '';
};
app.addEventListener('mousemove', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
  if (el) showTip(el, e.clientX, e.clientY);
  else hideTip();
});
app.addEventListener('mouseleave', hideTip);
app.addEventListener('click', (e) => {
  if (!window.matchMedia('(hover: none)').matches) return;
  const t = e.target as HTMLElement;
  if (t.closest('[data-a]')) return;
  const el = t.closest<HTMLElement>('[data-tip]');
  if (!el) return hideTip();
  showTip(el, e.clientX, e.clientY);
  clearTimeout(tipTimer);
  tipTimer = window.setTimeout(hideTip, 5000);
});

// Сохранение имени при вводе
app.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === 'code') t.value = t.value.toUpperCase();
});

// Подсказки по таймеру не нужны; держим соединение живым
setInterval(() => send({ type: 'ping' }), 30000);

render();
connect();

// Чтобы tree-shaking не выкинул проверочные функции (используются в подсчётах интерфейса)
void isPrepared;
