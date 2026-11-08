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

// ---------------------------------------------------------------------------
// Состояние клиента
// ---------------------------------------------------------------------------

interface RoomInfo {
  code: string;
  hostId: string;
  started: boolean;
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
const die = (v: number, size: '' | 'lg' | 'sm' = '') =>
  `<span class="die ${size}" role="img" aria-label="кубик ${v}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'p' : ''}"></i>`).join('')}</span>`;
const cell = (kind: 's' | 'c', on: boolean, extra = '') => `<i class="cell ${kind}${on ? ' on' : ''} ${extra}"></i>`;
const me = () => state?.players.find((p) => p.id === you) ?? null;
const nameOf = (id: string) => state?.players.find((p) => p.id === id)?.name ?? '';
let pendingName = '';
const flowerOf = (c: string, on = true) => `<span class="fl ${on ? '' : 'off'}">${flower(FLOWER_COLORS[c])}</span>`;

/** Масштаб: вся сцена (180×106 «единиц») всегда целиком помещается в окно. */
const STAGE_W = 180;
const STAGE_H = 106;
let portrait = false;
function fit() {
  const cs = getComputedStyle(document.documentElement);
  const hh = parseFloat(cs.getPropertyValue('--hh')) || 46;
  const dh = parseFloat(cs.getPropertyValue('--dh')) || 56;
  const w = window.innerWidth - 4;
  const h = window.innerHeight - hh - dh - 4;
  const u = Math.max(2, Math.min(14, w / STAGE_W, h / STAGE_H));
  document.documentElement.style.setProperty('--u', `${u.toFixed(3)}px`);
  const p = window.innerHeight > window.innerWidth * 1.1;
  if (p !== portrait) {
    portrait = p;
    if (state) render();
  }
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
fit();

// ---------------------------------------------------------------------------
// Экраны
// ---------------------------------------------------------------------------

function render() {
  const scrollY = window.scrollY;
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
    <div class="logo"><div class="logo-ic">${ic.pumpkin}${ic.corn}${ic.bean}</div><h1>Три сестры</h1><p>Онлайн-версия настольной игры для 2–4 игроков</p></div>
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
    <nav class="tabs">
      <button data-a="tab" data-v="board" class="${tab === 'board' ? 'on' : ''}">Поле</button>
      <button data-a="tab" data-v="sheet" class="${tab === 'sheet' ? 'on' : ''}">Планшет</button>
    </nav>
  </header>
  ${portrait ? '<div class="rotate-hint">↻ Поверните устройство горизонтально — так планшет виден крупнее</div>' : ''}
  <main class="fit"><div class="stage">${tab === 'board' ? renderBoard() : renderSheet()}</div></main>
  ${renderDock()}
  ${over && showResults ? `<div class="overlay">${renderResults()}</div>` : ''}`;
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
    const can = picking && options!.pickCells!.includes(i);
    const nt = NOTE[f.id];
    return `<button class="note ${nt.kind} pin-${nt.pin} ${can ? 'pick' : ''}" data-a="pick" data-v="${i}" ${can ? '' : 'disabled'}>
      <span class="n">${i + 1}</span><span class="nicons">${nt.icons}</span><span class="name">${esc(f.name)}</span>
      <span class="dice">${dice.map((v) => die(v)).join('')}</span>
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
    <div class="bside">
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

const PEREN_TEXT: Record<string, string[]> = {
  tulip: ['★ бонус в саду', 'персики: 2 товара', '—', 'персики: 3 товара', '—', 'конец: 1 ПО за сбор фруктов/ягод (до 15)'],
  hydrangea: ['★ яблоки', '—', '★ ежевика', '★ малина', '★ персики', 'конец: 7 ПО'],
  iris: ['+1 компост', 'кубик ±1', '—', 'кубик ±1–2', '—', 'конец: 12 ПО'],
  hyacinth: ['2 товара', '2 товара', '—', '2 товара', '—', 'конец: 10 ПО'],
  crocus: ['+2 компоста', '+1 компост', '+1 компост', '+2 компоста', '—', 'конец: 6 ПО'],
  narcissus: ['★ сарай', '—', '★ сарай', '★ сарай', '★ сарай', 'конец: 4 ПО'],
};
const PL: Record<string, string[]> = {
  tulip: ['★', '2т', '', '3т', '', '≤15'],
  hydrangea: ['★яб', '', '★еж', '★мал', '★пер', '7'],
  iris: ['+1к', '±1', '', '±2', '', '12'],
  hyacinth: ['2т', '2т', '', '2т', '', '10'],
  crocus: ['+2к', '+1к', '+1к', '+2к', '', '6'],
  narcissus: ['★ср', '', '★ср', '★ср', '★ср', '4'],
};
const MAIN_TXT = ['', '★', '', '★★', ''];
const WAX_TXT = ['2т·2', '4т·2', '', '4т·5'];
const HONEY_TXT = ['5', '5', '', '8'];
const HIVE_TXT = ['3', 'пос.', '★★★', '2×'];
const ROW_TXT: Record<GardenRow, string> = { apple: '3', peach: 'пол', blackberry: '2', raspberry: '3т' };
const ROW_ICON: Record<GardenRow, string> = { apple: ic.apple, peach: ic.peach, blackberry: ic.blackberry, raspberry: ic.raspberry };

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
  const cropBtn = (id: string, inner: string, done: boolean) => {
    const planting = mineView && sel && options?.plant?.find((b) => b.bed === sel.bed)?.crops?.includes(id);
    const chosen = sel?.crops.includes(id);
    return `<button class="crop ${planting ? 'pick' : ''} ${chosen ? 'chosen' : ''} ${done ? 'done' : ''}" ${planting ? `data-a="crop" data-v="${id}"` : 'disabled'}>${inner}</button>`;
  };
  const unit = (i: number) =>
    `<div class="unit">${cropBtn(`c${i}`, `${ic.corn}${cellsRow(CORN_CELLS, p.corn[i], 'h')}${rosette(3)}`, p.corn[i] >= CORN_CELLS)}${cropBtn(`b${i}`, `${ic.bean}${cellsRow(BEAN_CELLS, p.beans[i], 'h')}${rosette(1)}`, p.beans[i] >= BEAN_CELLS)}</div>`;
  const bedHtml = (b: number) => {
    const plantOpt = mineView && !sel ? options?.plant?.find((o) => o.bed === b) : undefined;
    const waterOpt = mineView && !sel ? options?.water?.find((o) => o.bed === b) : undefined;
    const btns =
      (plantOpt ? `<button class="bb" data-a="plantbed" data-v="${b}" title="Посадка">${ic.seedling}${plantOpt.cost ? `<i>−${plantOpt.cost}</i>` : ''}</button>` : '') +
      (waterOpt ? `<button class="bb w" data-a="water" data-v="${b}" title="Полив">${ic.can}${waterOpt.cost ? `<i>−${waterOpt.cost}</i>` : ''}</button>` : '');
    return `<div class="bed b${b} ${plantOpt || waterOpt ? 'ok' : ''} ${sel?.bed === b ? 'sel' : ''}" id="bed-${b}">
      <div class="bh"><b class="bnum">${b}</b><span class="bact">${btns}</span>${die(b, 'sm')}</div>
      <div class="units">${UNIT_BED.map((ub, i) => (ub === b ? unit(i) : '')).join('')}</div></div>`;
  };
  const pk = (i: number, dir: 'h' | 'v') => {
    const d = PUMPKINS[i];
    const f = p.pumpkins[i];
    return `<div class="pk ${dir}">${cropBtn(`p${i}`, `${goodsBadge(d.goods)}${cellsRow(d.cells, f, dir)}<small class="bt">${d.bed}</small>`, f >= d.cells)}</div>`;
  };
  const sy = (i: number) => `<span class="sy" title="${PERENNIAL_NAMES[PUMPKIN_SYMBOLS[i]]}">${flowerOf(PUMPKIN_SYMBOLS[i], p.symbols[i])}</span>`;
  // Кольцо тыкв по периметру: P0 слева-сверху, дальше по часовой стрелке в обратном порядке номеров
  const top = [pk(0, 'h'), sy(11), pk(11, 'h'), sy(10), pk(10, 'h'), sy(9)];
  const right = [pk(9, 'v'), sy(8), pk(8, 'v'), sy(7), pk(7, 'v'), sy(6)];
  const bottom = [sy(3), pk(4, 'h'), sy(4), pk(5, 'h'), sy(5), pk(6, 'h')];
  const left = [sy(0), pk(1, 'v'), sy(1), pk(2, 'v'), sy(2), pk(3, 'v')];
  const garden = `<div class="garden">
    <div class="rtop">${top.join('')}</div><div class="rleft">${left.join('')}</div>
    <div class="beds">${[1, 2, 3, 6, 5, 4].map(bedHtml).join('')}</div>
    <div class="rright">${right.join('')}</div><div class="rbot">${bottom.join('')}</div></div>`;

  // ---- Клумба ----
  const per = PERENNIALS.map((c, i) => {
    const f = p.perennial[i];
    let rowsH = '';
    for (let j = PERENNIAL_CELLS - 1; j >= 0; j--) rowsH += `<div class="prow" title="${esc(PEREN_TEXT[c][j])}">${cell(j === 5 ? 'c' : 's', j < f)}<span class="tx">${PL[c][j]}</span></div>`;
    return `<div class="pcol ${hot('perennial', c) ? 'hl' : ''}" style="--fc:${FLOWER_COLORS[c]}"${tattr('perennial', c)}><div class="ph">${flower(FLOWER_COLORS[c])}<span>${PERENNIAL_NAMES[c]}</span></div>${rowsH}</div>`;
  }).join('');

  // ---- Пасека ----
  const lockedApiary = p.main < APIARY_MAIN.length;
  const acol = (id: string, title: string, n: number, cells: { kind: 's' | 'c'; txt: string }[], locked: boolean) => {
    let h = '';
    for (let j = cells.length - 1; j >= 0; j--) h += `<div class="prow">${cell(cells[j].kind, j < n)}<span class="tx">${cells[j].txt}</span></div>`;
    return `<div class="acol ${locked ? 'lock' : ''} ${hot('apiary', id) ? 'hl' : ''}"${tattr('apiary', id)}><h4>${title}</h4>${h}</div>`;
  };
  const apiary = `<div class="box apiarybox"><h3 class="bt2">${ic.bee}Пасека</h3><div class="apiary">
    ${acol('main', 'Улей', p.main, APIARY_MAIN.map((c, i) => ({ kind: c.kind, txt: MAIN_TXT[i] })), false)}
    ${acol('wax', 'Воск', p.wax, APIARY_WAX.map((c, i) => ({ kind: c.kind, txt: WAX_TXT[i] })), lockedApiary)}
    ${acol('honey', 'Мёд', p.honey, APIARY_HONEY.map((c, i) => ({ kind: c.kind, txt: HONEY_TXT[i] })), lockedApiary)}
    ${acol('hive2', 'Семья', p.hive2, APIARY_HIVE2.map((_, i) => ({ kind: 'c' as const, txt: HIVE_TXT[i] })), lockedApiary)}</div></div>`;

  // ---- Сад ----
  const orchard = `<div class="box orchardbox"><h3 class="bt2">${ic.apple}Сад</h3>${GARDEN_ROWS.map((r) => {
    const cells = GARDEN_CELLS[r]
      .map((k, i) => `<span class="gc">${cell(k, i < p.garden[r], r === 'raspberry' && (i + 1) % 3 === 0 ? 'mark' : '')}<span class="tx">${k === 'c' ? ROW_TXT[r] : ''}</span></span>`)
      .join('');
    return `<div class="orow ${hot('garden', r) ? 'hl' : ''}"${tattr('garden', r)} title="${GARDEN_NAMES[r]}">${ROW_ICON[r]}<div class="ocells">${cells}</div></div>`;
  }).join('')}</div>`;

  // ---- Сарай ----
  const barn = `<div class="box barnbox"><h3 class="bt2">${ic.barn}Сарай</h3><div class="barn">${BARN_ITEMS.map((it) => {
    const d = BARN[it];
    const n = p.barn[it];
    const ready = n >= d.cells.length;
    return `<div class="item ${ready ? 'ready' : ''} ${hot('barn', it) ? 'hl' : ''}"${tattr('barn', it)} title="${esc(d.name)}: ${esc(d.desc)}">
      <div class="in"><span>${d.name}</span>${d.vp ? rosette(d.vp) : '<small>особо</small>'}</div>
      <div class="cells">${d.cells.map((k, i) => cell(k, i < n)).join('')}</div></div>`;
  }).join('')}</div></div>`;

  // ---- Шкалы и итог ----
  let g = '';
  for (let i = 1; i <= GOODS_MAX; i++) g += `<div class="sq ${i % 5 === 0 ? 'star' : ''} ${i <= p.goods ? 'on' : ''}">${i % 5 === 0 ? '★' : ''}</div>`;
  let c = '';
  for (let i = 1; i <= COMPOST_MAX; i++) c += `<div class="sq cp ${i <= p.compostSpent ? 'spent' : i <= p.compostGained ? 'on' : ''}"></div>`;
  const scales = `<div class="box goodsbox"><h3 class="bt2">${ic.crate}Товары: ${p.goods}</h3><div class="grid15">${g}</div></div>
    <div class="box compostbox"><h3 class="bt2">${ic.compost}Компост: ${compostAvail(p)}</h3><div class="grid10">${c}</div></div>
    <div class="box scorebox"><h3 class="bt2">Итог</h3><table class="sc"><tbody>
      <tr><td>Огород</td><td>${sc.garden}</td></tr><tr><td>Клумба</td><td>${sc.perennials}</td></tr><tr><td>Пасека</td><td>${sc.apiary}</td></tr>
      <tr><td>Сад</td><td>${sc.orchard}</td></tr><tr><td>Сарай</td><td>${sc.barn}</td></tr><tr class="tot"><td>Всего</td><td>${sc.total}</td></tr></tbody></table></div>`;

  return `<div class="sheet">
    <div class="pbar">${chips}<span class="legend2">крестики — закрашено · подсвеченные места можно нажимать</span></div>
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
