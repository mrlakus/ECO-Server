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

// ---------------------------------------------------------------------------
// Состояние клиента
// ---------------------------------------------------------------------------

interface RoomInfo {
  code: string;
  hostId: string;
  started: boolean;
  members: { id: string; name: string; connected: boolean }[];
}
interface Session {
  code: string;
  token: string;
  name: string;
}
type Tab = 'board' | 'sheet' | 'players' | 'log';

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
let dockCollapsed = false;

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
      if (!viewId || !state?.players.some((p) => p.id === viewId)) viewId = you;
      const key = options ? JSON.stringify([options.kind, options.die, options.hint, state?.round, state?.phase]) : '';
      if (key !== lastOptionsKey) {
        lastOptionsKey = key;
        selection = null;
        dockCollapsed = false;
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
const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const die = (v: number, lg = false) => `<span class="die${lg ? ' lg' : ''}">${DICE[v - 1]}</span>`;
const cell = (kind: 's' | 'c', on: boolean, extra = '') => `<i class="cell ${kind}${on ? ' on' : ''} ${extra}"></i>`;
const me = () => state?.players.find((p) => p.id === you) ?? null;
const nameOf = (id: string) => state?.players.find((p) => p.id === id)?.name ?? '';
let pendingName = '';

// ---------------------------------------------------------------------------
// Экраны
// ---------------------------------------------------------------------------

function render() {
  const scrollY = window.scrollY;
  if (!room) app.innerHTML = renderLobby();
  else if (!state) app.innerHTML = renderRoom();
  else app.innerHTML = renderGame();
  if (pendingScroll) {
    document.getElementById(pendingScroll)?.scrollIntoView({ block: 'center' });
    pendingScroll = null;
  } else window.scrollTo(0, scrollY);
}

function renderLobby(): string {
  const params = new URLSearchParams(location.search);
  const code = (params.get('room') ?? '').toUpperCase();
  const saved = session?.name ?? localStorage.getItem('ts-name') ?? '';
  return `
  <div class="screen">
    <div class="logo"><h1>🎃 Три сестры</h1><p>Онлайн-версия настольной игры для 2–4 игроков</p></div>
    ${connected ? '' : '<div class="hint">Подключаемся к серверу…</div>'}
    <div class="card">
      <h3>Ваше имя</h3>
      <input type="text" id="name" maxlength="20" placeholder="Например, Алексей" value="${esc(saved)}" autocomplete="nickname">
    </div>
    <div class="card">
      <h3>Новая комната</h3>
      <button class="btn block" data-a="create">Создать комнату</button>
    </div>
    <div class="card">
      <h3>Подключиться к другу</h3>
      <div class="row">
        <input type="text" id="code" maxlength="5" placeholder="Код комнаты" value="${esc(code)}" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase">
        <button class="btn" data-a="join" style="flex:none">Войти</button>
      </div>
    </div>
  </div>`;
}

function renderRoom(): string {
  const r = room!;
  const isHost = r.hostId === you;
  const link = `${location.origin}/?room=${r.code}`;
  return `
  <div class="screen">
    <div class="logo"><h1>🎃 Комната</h1><p>Отправьте код или ссылку друзьям</p></div>
    <div class="card">
      <div class="code">${r.code}</div>
      <div class="row"><button class="btn sec" data-a="copy" data-v="${esc(link)}">Скопировать ссылку</button>
      ${typeof navigator.share === 'function' ? `<button class="btn sec" data-a="share" data-v="${esc(link)}">Поделиться</button>` : ''}</div>
    </div>
    <div class="card">
      <h3>Игроки (${r.members.length}/${MAX_PLAYERS})</h3>
      <ul class="members">
        ${r.members
          .map(
            (m) =>
              `<li><span class="dot ${m.connected ? 'on' : ''}"></span>${esc(m.name)}${m.id === you ? ' <small>(вы)</small>' : ''}${m.id === r.hostId ? '<span class="badge">хозяин</span>' : ''}</li>`,
          )
          .join('')}
      </ul>
    </div>
    ${
      isHost
        ? `<button class="btn block" data-a="start" ${r.members.length < MIN_PLAYERS ? 'disabled' : ''}>${r.members.length < MIN_PLAYERS ? 'Ждём ещё игроков…' : 'Начать игру'}</button>`
        : '<div class="hint">Ждём, пока хозяин комнаты начнёт игру…</div>'
    }
    <button class="btn sec block" data-a="leave">Выйти из комнаты</button>
  </div>`;
}

function renderGame(): string {
  const s = state!;
  const over = s.phase === 'over';
  const ev = ROUND_EVENTS[s.round - 1];
  const phaseName = { pick: 'Фаза садоводства', final: 'Последний кубик', event: `Событие: ${EVENT_NAMES[ev]}`, over: 'Конец игры' }[s.phase];
  const mine = options && options.kind !== 'wait' && options.kind !== 'over';
  return `
  <div class="top">
    <div class="line"><span class="round">Раунд ${Math.min(s.round, ROUNDS)}/${ROUNDS}</span><span class="ev">${phaseName}</span>${connected ? '' : '<span class="ev">⚠ нет связи</span>'}</div>
    ${options ? `<div class="hint ${mine ? 'mine' : ''}">${esc(options.hint)}</div>` : ''}
  </div>
  <nav class="tabs">
    ${(
      [
        ['board', '🗺 Поле'],
        ['sheet', '📋 Планшет'],
        ['players', '👥 Игроки'],
        ['log', '📜 Журнал'],
      ] as [Tab, string][]
    )
      .map(([t, l]) => `<button data-a="tab" data-v="${t}" class="${tab === t ? 'on' : ''}">${l}</button>`)
      .join('')}
  </nav>
  <main class="${renderDock() ? 'hasdock' : ''}">
    ${over ? renderResults() : ''}
    ${tab === 'board' ? renderBoard() : tab === 'sheet' ? renderSheetTab() : tab === 'players' ? renderPlayers() : renderLog()}
  </main>
  ${renderDock()}`;
}

// ---------------------------------------------------------------------------
// Общее поле
// ---------------------------------------------------------------------------

function renderBoard(): string {
  const s = state!;
  const picking = options?.kind === 'pick';
  const first = s.players[s.first];
  const rounds = ROUND_EVENTS.map((e, i) => {
    const cls = ['rain', 'mk', 'barn'][['rain', 'market', 'barn'].indexOf(e)];
    const label = { barn: '🏚', rain: '🌧', market: '🧺' }[e];
    return `<div class="${cls} ${i + 1 === s.round ? 'cur' : i + 1 < s.round ? 'done' : ''}" title="${EVENT_NAMES[e]}"><b>${i + 1}</b>${label}</div>`;
  }).join('');
  const cells = FIELD.map((f, i) => {
    const dice = s.field[i];
    const can = picking && options!.pickCells!.includes(i);
    return `<button class="fcell ${can ? 'pick' : ''} ${i === 0 ? 'gold' : ''}" data-a="pick" data-v="${i}" ${can ? '' : 'disabled'}>
      <span class="n">${i + 1}</span><span class="name">${esc(f.name)}</span>
      <span class="dice">${dice.map((v) => die(v)).join('')}</span>
      ${s.edith === i ? '<span class="edith" title="Фишка Эдит">👩‍🌾</span>' : ''}
    </button>`;
  }).join('');
  const myGoods = me()?.goods ?? 0;
  const rows = MARKET.map((r, i) => {
    const next = MARKET[i + 1];
    const cur = myGoods >= r.min && (!next || myGoods < next.min);
    const range = next ? `${r.min}–${next.min - 1}` : `≥${r.min}`;
    const bonus = [
      r.perennial ? `${r.perennial}×🌸` : '',
      r.gardenBonus ? '★ в саду' : '',
      r.anyBonus ? '★ любое' : '',
      r.compost ? `${r.compost} компост` : '',
    ]
      .filter(Boolean)
      .join(' + ');
    return `<tr class="${cur ? 'you' : ''}"><td>${range}</td><td>${bonus}</td></tr>`;
  }).join('');
  return `
    <div class="card"><div class="rounds">${rounds}</div>
      <p class="legend" style="margin:8px 0 0">События по раундам: 🏚 сарай · 🌧 дождь · 🧺 рынок. Первый игрок: <b>${esc(first.name)}</b> · Эдит на клетке ${s.edith + 1}</p></div>
    <div><div class="field">${cells}</div></div>
    <div class="card"><h3>Фермерский рынок</h3><table class="market"><tbody>${rows}</tbody></table>
      <p class="legend" style="margin:8px 0 0">🌸 — действие с многолетниками, ★ — бонусное действие. Ваша строка подсвечена (у вас ${myGoods} тов.).</p></div>
    ${renderPlayersList()}`;
}

function renderPlayersList(): string {
  const s = state!;
  const active = s.phase === 'pick' ? s.players[(s.first + s.pickPos) % s.players.length] : null;
  return `<div class="pl-list">${s.players
    .map((p) => {
      const sc = scorePlayer(p);
      const busy = p.tasks.length > 0;
      return `<div class="pl ${active === p || (s.phase !== 'pick' && busy) ? 'turn' : ''}">
        <div><b>${esc(p.name)}</b>${p.id === you ? ' <small>(вы)</small>' : ''}${s.players[s.first] === p ? ' 🥇' : ''}</div>
        <div class="stat">🧺 ${p.goods} · 🟤 ${compostAvail(p)}<br>≈ ${sc.total} ПО</div></div>`;
    })
    .join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Игроки / журнал / итоги
// ---------------------------------------------------------------------------

function renderPlayers(): string {
  return `${renderPlayersList()}<p class="legend">ПО — предварительный подсчёт «если бы игра закончилась сейчас». Откройте вкладку «Планшет» и выберите игрока сверху, чтобы посмотреть его участок.</p>`;
}

function renderLog(): string {
  const s = state!;
  return `<ul class="log">${[...s.log]
    .reverse()
    .map((l) => `<li class="${l.startsWith('—') ? 'sep' : ''}">${esc(l)}</li>`)
    .join('')}</ul>`;
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
  return `<div class="card"><h3>🏆 Победил${s.winners.length > 1 ? 'и' : ''}: ${esc(win)}</h3>
    <table class="results"><thead><tr><th></th><th>Огород</th><th>Клумба</th><th>Пасека</th><th>Сад</th><th>Сарай</th><th>Итого</th></tr></thead><tbody>${rows}</tbody></table>
    ${room?.hostId === you ? '<button class="btn block" style="margin-top:10px" data-a="restart">Новая партия в этой комнате</button>' : '<p class="legend">Хозяин комнаты может начать новую партию.</p>'}
    <button class="btn sec block" style="margin-top:8px" data-a="leave">Выйти</button></div>`;
}

// ---------------------------------------------------------------------------
// Планшет игрока
// ---------------------------------------------------------------------------

const PEREN_TEXT: Record<string, string[]> = {
  tulip: ['★ сад', 'перс. 2т', '—', 'перс. 3т', '—', '1 ПО/сбор'],
  hydrangea: ['★ яблоки', '—', '★ ежев.', '★ малина', '★ перс.', '7 ПО'],
  iris: ['+1 комп.', 'кубик ±1', '—', 'кубик ±2', '—', '12 ПО'],
  hyacinth: ['2 тов.', '2 тов.', '—', '2 тов.', '—', '10 ПО'],
  crocus: ['+2 комп.', '+1 комп.', '+1 комп.', '+2 комп.', '—', '6 ПО'],
  narcissus: ['★ сарай', '—', '★ сарай', '★ сарай', '★ сарай', '4 ПО'],
};
const MAIN_TEXT = ['', '★ сад', '', '★★ сад', ''];
const WAX_TEXT = ['2 тов · 2 ПО', '4 тов · 2 ПО', '', '4 тов · 5 ПО'];
const HONEY_TEXT = ['5 ПО', '5 ПО', '', '8 ПО'];
const HIVE_TEXT = ['3 ПО', 'посадка', '★★★ сад', '2× пос./полив'];
const ROW_TEXT: Record<GardenRow, string> = { apple: '3 ПО', peach: 'полив', blackberry: '2 ПО', raspberry: '3 тов.' };

function describeTarget(p: PlayerState, t: Target): string {
  switch (t.area) {
    case 'perennial': {
      const i = PERENNIALS.indexOf(t.target as (typeof PERENNIALS)[number]);
      return PEREN_TEXT[t.target][p.perennial[i]] || '';
    }
    case 'apiary': {
      const tx = { main: MAIN_TEXT[p.main], wax: WAX_TEXT[p.wax], honey: HONEY_TEXT[p.honey], hive2: HIVE_TEXT[p.hive2] }[t.target as 'main'];
      return tx || '';
    }
    case 'garden': {
      const r = t.target as GardenRow;
      return GARDEN_CELLS[r][p.garden[r]] === 'c' ? ROW_TEXT[r] : '—';
    }
    case 'barn': {
      const d = BARN[t.target as (typeof BARN_ITEMS)[number]];
      const n = p.barn[t.target as (typeof BARN_ITEMS)[number]];
      return `${n + 1}/${d.cells.length}`;
    }
  }
}

function renderSheetTab(): string {
  const s = state!;
  const p = s.players.find((x) => x.id === viewId) ?? me()!;
  const chips = s.players
    .map((x) => `<button class="${x.id === p.id ? 'on' : ''}" data-a="view" data-v="${x.id}">${esc(x.name)}${x.id === you ? ' (я)' : ''}</button>`)
    .join('');
  const mineView = p.id === you;
  return `
  <div class="pchips">${chips}</div>
  <div class="secnav"><a href="#sec-garden" data-a="nav" data-v="sec-garden">Огород</a><a href="#sec-per" data-a="nav" data-v="sec-per">Клумба</a><a href="#sec-api" data-a="nav" data-v="sec-api">Пасека</a><a href="#sec-orch" data-a="nav" data-v="sec-orch">Сад</a><a href="#sec-barn" data-a="nav" data-v="sec-barn">Сарай</a><a href="#sec-scale" data-a="nav" data-v="sec-scale">Шкалы</a></div>
  ${renderGardenSection(p, mineView)}
  ${renderPerennials(p)}
  ${renderApiary(p)}
  ${renderOrchard(p)}
  ${renderBarn(p)}
  ${renderScales(p)}`;
}

function cropHtml(p: PlayerState, id: string, mineView: boolean): string {
  const i = Number(id.slice(1));
  const type = id[0];
  const n = type === 'c' ? CORN_CELLS : type === 'b' ? BEAN_CELLS : PUMPKINS[i].cells;
  const f = type === 'c' ? p.corn[i] : type === 'b' ? p.beans[i] : p.pumpkins[i];
  const label = type === 'c' ? '🌽 3' : type === 'b' ? '🫘 1' : `🎃 ${PUMPKINS[i].goods}🧺`;
  const planting = mineView && selection && options?.plant?.find((b) => b.bed === selection!.bed)?.crops?.includes(id);
  const chosen = selection?.crops.includes(id);
  const cls = ['crop', planting ? 'pick' : '', chosen ? 'chosen' : '', f >= n ? 'done' : ''].join(' ');
  let cells = '';
  for (let j = n - 1; j >= 0; j--) cells += cell(j === n - 1 ? 'c' : 's', j < f);
  const attrs = planting ? `data-a="crop" data-v="${id}"` : 'disabled';
  return `<button class="${cls}" ${attrs}><span class="lbl">${label}${type === 'p' ? ` <small>#${i + 1}</small>` : ''}</span><span class="cc">${cells}</span></button>`;
}

function renderGardenSection(p: PlayerState, mineView: boolean): string {
  const sel = selection;
  const beds: string[] = [];
  for (let b = 1; b <= BEDS; b++) {
    const unitHtml = UNIT_BED.map((ub, i) => (ub === b ? `<div class="crop-pair" style="display:flex;gap:2px">${cropHtml(p, `c${i}`, mineView)}${cropHtml(p, `b${i}`, mineView)}</div>` : '')).join('');
    const pumpHtml = PUMPKINS.map((pk, i) => (pk.bed === b ? cropHtml(p, `p${i}`, mineView) : '')).join('');
    const canPlant = mineView && !sel && options?.plant?.some((o) => o.bed === b);
    const canWater = mineView && !sel && options?.water?.some((o) => o.bed === b);
    beds.push(`<div class="bed ${canPlant || canWater ? 'ok' : ''} ${sel?.bed === b ? 'sel' : ''}" id="bed-${b}">
      <h4><span>Грядка ${b}</span><span>${DICE[b - 1]}</span></h4><div class="crops">${unitHtml}${pumpHtml}</div></div>`);
  }
  const ring = PUMPKINS.map((pk, i) => {
    const done = p.pumpkins[i] >= pk.cells;
    const sy = PUMPKIN_SYMBOLS[i];
    return `<span class="pk ${done ? 'done' : ''}">#${i + 1}</span><span class="sy ${p.symbols[i] ? 'on' : ''}" title="${PERENNIAL_NAMES[sy]}">${PERENNIAL_NAMES[sy].slice(0, 4)}</span>`;
  }).join('');
  return `<section class="sec" id="sec-garden"><h3><span>Огород</span><small>🌽 ${cornDone(p)} · 🫘 ${beansDone(p)} → ${cornDone(p) * 3 + beansDone(p)} ПО</small></h3>
    <div class="beds">${beds.join('')}</div>
    <div class="ring"><b>Тыквы по кругу:</b> ${ring}</div>
    <p class="legend" style="margin:6px 0 0">Тыквы #1…#12 идут по кругу, между соседними — символ многолетника. Собрали две соседние — закрашиваете символ и делаете действие с этим цветком.</p></section>`;
}

function renderPerennials(p: PlayerState): string {
  const pick = options && ['act', 'turn'].some((k) => options!.kind === k);
  const cols = PERENNIALS.map((c, i) => {
    const f = p.perennial[i];
    let html = '';
    for (let j = PERENNIAL_CELLS - 1; j >= 0; j--) html += `<div class="arow">${cell(j === 5 ? 'c' : 's', j < f)}</div><div class="tx">${PEREN_TEXT[c][j]}</div>`;
    return `<div class="pcol ${pick ? '' : ''}"><h4>${PERENNIAL_NAMES[c]}</h4><div class="cc">${html}</div></div>`;
  }).join('');
  return `<section class="sec" id="sec-per"><h3><span>Клумба</span><small>снизу вверх</small></h3><div class="per">${cols}</div></section>`;
}

function renderApiary(p: PlayerState): string {
  const col = (title: string, n: number, cells: { kind: 's' | 'c'; txt: string }[], locked: boolean) => {
    let html = '';
    for (let j = cells.length - 1; j >= 0; j--) html += `<div class="arow">${cell(cells[j].kind, j < n)}</div><div class="tx">${cells[j].txt}</div>`;
    return `<div class="acol ${locked ? 'lock' : ''}"><h4>${title}</h4>${html}</div>`;
  };
  const locked = p.main < APIARY_MAIN.length;
  return `<section class="sec" id="sec-api"><h3><span>Пасека</span><small>снизу вверх${locked ? ' · остальные столбцы откроются после основного улья' : ''}</small></h3>
    <div class="apiary">
      ${col('Основной улей', p.main, APIARY_MAIN.map((c, i) => ({ kind: c.kind, txt: MAIN_TEXT[i] })), false)}
      ${col('Воск', p.wax, APIARY_WAX.map((c, i) => ({ kind: c.kind, txt: WAX_TEXT[i] })), locked)}
      ${col('Мёд', p.honey, APIARY_HONEY.map((c, i) => ({ kind: c.kind, txt: HONEY_TEXT[i] })), locked)}
      ${col('Деление семьи', p.hive2, APIARY_HIVE2.map((_, i) => ({ kind: 'c' as const, txt: HIVE_TEXT[i] })), locked)}
    </div></section>`;
}

function renderOrchard(p: PlayerState): string {
  const rows = GARDEN_ROWS.map((r) => {
    const cells = GARDEN_CELLS[r]
      .map((k, i) => `<span class="gc">${cell(k, i < p.garden[r])}<span class="tx">${k === 'c' ? ROW_TEXT[r] : ''}</span></span>`)
      .join('');
    return `<div class="grow"><h4>${GARDEN_NAMES[r]}</h4>${cells}</div>`;
  }).join('');
  return `<section class="sec" id="sec-orch"><h3><span>Сад</span><small>слева направо · малина: 1/2/3 ПО за 3/6/9-й сбор</small></h3>${rows}</section>`;
}

function renderBarn(p: PlayerState): string {
  const items = BARN_ITEMS.map((it) => {
    const d = BARN[it];
    const n = p.barn[it];
    const ready = n >= d.cells.length;
    const cells = d.cells.map((k, i) => cell(k, i < n)).join('');
    const vp = d.vp ? `${d.vp} ПО` : 'особо';
    return `<div class="item ${ready ? 'ready' : ''}"><h4><span>${d.name}</span><small>${vp}</small></h4><div class="cells">${cells}</div><div class="tx">${d.desc}</div></div>`;
  }).join('');
  return `<section class="sec" id="sec-barn"><h3><span>Сарай</span><small>слева направо</small></h3><div class="barn">${items}</div></section>`;
}

function renderScales(p: PlayerState): string {
  let g = '';
  for (let i = 1; i <= GOODS_MAX; i++) g += `<div class="sq ${i % 5 === 0 ? 'star' : ''} ${i <= p.goods ? 'on' : ''}">${i % 5 === 0 && i % 10 !== 0 ? '★' : i % 10 === 0 ? '★' : ''}</div>`;
  let c = '';
  for (let i = 1; i <= COMPOST_MAX; i++) c += `<div class="sq cp ${i <= p.compostSpent ? 'spent' : i <= p.compostGained ? 'on' : ''}"></div>`;
  return `<section class="sec" id="sec-scale"><h3><span>Шкалы</span></h3>
    <div class="scales"><div><b>🧺 Товары: ${p.goods}</b> <small>каждая 5-я клетка — ★ бонусное действие</small><div class="grid15">${g}</div></div>
    <div><b>🟤 Компост: ${compostAvail(p)}</b> <small>(получено ${p.compostGained}, потрачено ${p.compostSpent})</small><div class="grid5">${c}</div></div></div></section>`;
}

// ---------------------------------------------------------------------------
// Панель действий
// ---------------------------------------------------------------------------

const AREA_ICON = { perennial: '🌸', apiary: '🐝', garden: '🍎', barn: '🏚' } as const;

function targetChips(p: PlayerState, targets: Target[], slot?: number, extra = ''): string {
  return targets
    .map(
      (t) =>
        `<button class="chip ${extra}" data-a="target" data-area="${t.area}" data-target="${t.target}" ${slot === undefined ? '' : `data-slot="${slot}"`}>${AREA_ICON[t.area]} ${esc(t.label)}<small>${esc(describeTarget(p, t))}</small></button>`,
    )
    .join('');
}

function bedChips(o: Options): string {
  const costTxt = (c: number) => (c ? ` · −${c} комп.` : '');
  const plant = (o.plant ?? []).map((b) => `<button class="chip ${b.cost ? 'cost' : ''}" data-a="plantbed" data-v="${b.bed}">🌱 Грядка ${b.bed}<small>посадка${costTxt(b.cost)}</small></button>`).join('');
  const water = (o.water ?? []).map((b) => `<button class="chip water ${b.cost ? 'cost' : ''}" data-a="water" data-v="${b.bed}">💧 Грядка ${b.bed}<small>полив ×${b.count}${costTxt(b.cost)}</small></button>`).join('');
  return plant + water;
}

function renderDock(): string {
  const o = options;
  const p = me();
  if (!o || !p || state!.phase === 'over' || ['wait', 'over', 'rain', 'pick'].includes(o.kind)) {
    if (o?.kind === 'pick') return '<div class="dock"><div class="dockhead"><b>👆 Выберите кубик на вкладке «Поле»</b></div></div>';
    return '';
  }
  let body = '';
  if (selection) {
    const left = selection.max - selection.crops.length;
    return `<div class="dock"><div class="dockhead"><b>🌱 Посадка · грядка ${selection.bed}</b><small>выберите культуры (${selection.crops.length}/${selection.max})</small></div>
      <div class="chips"><button class="chip auto" data-a="confirmplant" ${selection.crops.length ? '' : 'disabled'}>✔ Посадить (${selection.crops.length})<small>${left > 0 ? `можно ещё ${left}` : 'максимум'}</small></button>
      <button class="chip" data-a="cancelplant">✖ Отмена</button></div></div>`;
  }
  if (o.kind === 'turn') {
    const shift = [o.compost ? `компост: ${o.compost}` : '', o.irisShift ? `ирис ±${o.irisShift}` : ''].filter(Boolean).join(' · ');
    body += `<div class="dockhead">${die(o.die!, true)}<div><b>${esc(o.cellName ?? '')}</b><br><small>${shift || 'без сдвига кубика'}</small></div></div>`;
    const garden = bedChips(o);
    body += `<h4>Огород (грядка по значению кубика)</h4><div class="chips">${garden || '<small>нет доступных действий в огороде</small>'}</div>`;
    if (o.cellLeft) {
      if (o.cellKind === 'auto') body += `<h4>Клетка поля</h4><div class="chips"><button class="chip auto" data-a="cell">${esc(o.autoLabel ?? '')}</button></div>`;
      else if (o.cellKind === 'act' && o.cellTargets?.length) body += `<h4>Клетка поля: ${esc(o.cellName ?? '')}</h4><div class="chips">${targetChips(p, o.cellTargets)}</div>`;
      else if (o.cellKind === 'plantWater') body += `<h4>Клетка «Посадка или полив»</h4><small>Это второе действие в огороде — выберите его выше.</small>`;
      if (o.mulchTargets?.length) body += `<h4>Мульча: вместо действия клетки — действие с многолетниками</h4><div class="chips">${targetChips(p, o.mulchTargets)}</div>`;
    }
  } else if (o.kind === 'act') {
    (o.slots ?? []).forEach((sl, idx) => {
      body += `<h4>${esc(sl.label)}</h4><div class="chips">${targetChips(p, sl.targets, idx)}</div>`;
    });
  } else if (o.kind === 'field') {
    body += `<h4>${esc(o.hint)}</h4><div class="chips">${bedChips(o)}</div>`;
  }
  if (dockCollapsed) return '<div class="dock"><div class="chips"><button class="chip auto" data-a="dock">▲ Показать действия</button></div></div>';
  const extras = [
    '<button class="chip link" data-a="dock">▼ Свернуть панель</button>',
    o.canShovel ? '<button class="chip" data-a="shovel">🪏 Лопата: 3 компоста → ★</button>' : '',
    '<button class="chip link" data-a="skip">Пропустить</button>',
  ].join('');
  return `<div class="dock">${body}<div class="chips">${extras}</div></div>`;
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
    case 'nav':
      ev.preventDefault();
      document.getElementById(v)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
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
    case 'dock':
      dockCollapsed = !dockCollapsed;
      return render();
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
