// Движок правил «Трёх сестёр» (обычная версия, 2–4 игрока).
// Состояние — обычный JSON; все функции мутируют его на месте и возвращают результат проверки.

import {
  APIARY_HIVE2,
  APIARY_HONEY,
  APIARY_MAIN,
  APIARY_WAX,
  APPLE_VP,
  BARN,
  BARN_ITEMS,
  BEAN_CELLS,
  BEDS,
  BLACKBERRY_VP,
  COMPOST_MAX,
  CORN_CELLS,
  DICE_BY_PLAYERS,
  EVENT_NAMES,
  FIELD,
  FRUITBOWL_VP,
  GARDEN_CELLS,
  GARDEN_NAMES,
  GARDEN_ROWS,
  GOODS_MAX,
  HIVE2_VP,
  MARKET,
  PERENNIALS,
  PERENNIAL_CELLS,
  PERENNIAL_END_VP,
  PERENNIAL_NAMES,
  PUMPKINS,
  PUMPKIN_SYMBOLS,
  RASPBERRY_GOODS,
  RASPBERRY_VP_AT,
  ROUNDS,
  ROUND_EVENTS,
  TULIP_VP_CAP,
  UNIT_BED,
  UNIT_COUNT,
  type BarnItem,
  type FieldCell,
  type GardenRow,
} from './data';
import {
  ALL_AREAS,
  type Action,
  type ApiaryCol,
  type Area,
  type BedOption,
  type GameState,
  type Options,
  type PlayerState,
  type Score,
  type Slot,
  type Target,
  type Task,
} from './types';

export type Rng = () => number;
export type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Создание игры
// ---------------------------------------------------------------------------

export function createPlayer(id: string, name: string): PlayerState {
  return {
    id,
    name,
    corn: Array(UNIT_COUNT).fill(0),
    beans: Array(UNIT_COUNT).fill(0),
    pumpkins: Array(PUMPKINS.length).fill(0),
    symbols: Array(PUMPKINS.length).fill(false),
    perennial: Array(PERENNIALS.length).fill(0),
    main: 0,
    wax: 0,
    honey: 0,
    hive2: 0,
    garden: { apple: 0, peach: 0, blackberry: 0, raspberry: 0 },
    barn: Object.fromEntries(BARN_ITEMS.map((i) => [i, 0])) as Record<BarnItem, number>,
    goods: 0,
    compostGained: 1, // в начале игры 1 компост
    compostSpent: 0,
    tasks: [],
  };
}

export function createGame(players: { id: string; name: string }[], rng: Rng, firstStart = 0): GameState {
  if (players.length < 2 || players.length > 4) throw new Error('Нужно от 2 до 4 игроков');
  const state: GameState = {
    round: 1,
    phase: 'pick',
    players: players.map((p) => createPlayer(p.id, p.name)),
    firstStart,
    first: firstStart,
    pickPos: 0,
    pickTaken: false,
    field: FIELD.map(() => []),
    fieldStart: FIELD.map(() => []),
    edith: 0,
    finalDie: null,
    log: [],
    scores: null,
    winners: [],
  };
  startRound(state, rng);
  return state;
}

function logMsg(state: GameState, msg: string) {
  state.log.push(msg);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

function startRound(state: GameState, rng: Rng) {
  const n = state.players.length;
  state.first = (state.firstStart + state.round - 1) % n;
  state.phase = 'pick';
  state.pickPos = 0;
  state.pickTaken = false;
  state.finalDie = null;
  state.field = FIELD.map(() => []);

  const dice: number[] = [];
  for (let i = 0; i < DICE_BY_PLAYERS[n]; i++) dice.push(1 + Math.floor(rng() * 6));
  dice.sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const d of dice) {
    const g = groups[groups.length - 1];
    if (g && g[0] === d) g.push(d);
    else groups.push([d]);
  }
  groups.forEach((g, i) => {
    state.field[(state.edith + i) % FIELD.length] = g;
  });
  state.edith = (state.edith + groups.length) % FIELD.length;
  state.fieldStart = state.field.map((g) => [...g]);
  logMsg(state, `— Раунд ${state.round}. Бросок: ${dice.join(' ')} —`);
}

// ---------------------------------------------------------------------------
// Вспомогательные функции состояния
// ---------------------------------------------------------------------------

const pidx = (c: Perennial) => PERENNIALS.indexOf(c);
type Perennial = (typeof PERENNIALS)[number];

export const isPrepared = (p: PlayerState, item: BarnItem) => p.barn[item] >= BARN[item].cells.length;
export const compostAvail = (p: PlayerState) => p.compostGained - p.compostSpent;
export const irisShift = (p: PlayerState) => {
  const n = p.perennial[pidx('iris')];
  return n >= 4 ? 2 : n >= 2 ? 1 : 0;
};
const tulipPeachGoods = (p: PlayerState) => {
  const n = p.perennial[pidx('tulip')];
  return n >= 4 ? 3 : n >= 2 ? 2 : 0;
};

export function harvests(p: PlayerState, row: GardenRow): number {
  return GARDEN_CELLS[row].slice(0, p.garden[row]).filter((c) => c === 'c').length;
}
const fruitHarvests = (p: PlayerState) => GARDEN_ROWS.reduce((s, r) => s + harvests(p, r), 0);
export const cornDone = (p: PlayerState) => p.corn.filter((v) => v >= CORN_CELLS).length;
export const beansDone = (p: PlayerState) => p.beans.filter((v) => v >= BEAN_CELLS).length;
const pumpkinDone = (p: PlayerState, i: number) => p.pumpkins[i] >= PUMPKINS[i].cells;

/** Самая длинная цепочка соседних собранных тыкв (круг из 12). */
export function longestPumpkinChain(p: PlayerState): number {
  const n = PUMPKINS.length;
  const done = PUMPKINS.map((_, i) => pumpkinDone(p, i));
  if (done.every(Boolean)) return n;
  const start = done.findIndex((d) => !d);
  let best = 0;
  let run = 0;
  for (let k = 1; k <= n; k++) {
    if (done[(start + k) % n]) {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Эффекты (накапливают «бонусы» в ctx, которые игрок потом тратит)
// ---------------------------------------------------------------------------

interface Ctx {
  state: GameState;
  p: PlayerState;
  slots: Slot[];
  tasks: Task[];
}
const newCtx = (state: GameState, p: PlayerState): Ctx => ({ state, p, slots: [], tasks: [] });
const anySlot = (label: string): Slot => ({ areas: [...ALL_AREAS], label });

function addGoods(ctx: Ctx, n: number) {
  const p = ctx.p;
  for (let i = 0; i < n && p.goods < GOODS_MAX; i++) {
    p.goods++;
    if (p.goods % 5 === 0) ctx.slots.push(anySlot('★ за шкалу товаров'));
  }
}
function addCompost(p: PlayerState, n: number) {
  p.compostGained = Math.min(COMPOST_MAX, p.compostGained + n);
}

function fillPerennial(ctx: Ctx, col: number): boolean {
  const p = ctx.p;
  const idx = p.perennial[col];
  if (idx >= PERENNIAL_CELLS) return false;
  p.perennial[col]++;
  const cell = idx + 1;
  switch (PERENNIALS[col]) {
    case 'tulip':
      if (cell === 1) ctx.slots.push({ areas: ['garden'], label: 'Тюльпан: бонус в саду' });
      break;
    case 'hydrangea': {
      const rows: Record<number, GardenRow> = { 1: 'apple', 3: 'blackberry', 4: 'raspberry', 5: 'peach' };
      if (rows[cell]) ctx.slots.push({ areas: ['garden'], row: rows[cell], label: `Гортензия: ${GARDEN_NAMES[rows[cell]]}` });
      if (isPrepared(p, 'pitchfork')) addCompost(p, 1);
      break;
    }
    case 'iris':
      if (cell === 1) addCompost(p, 1);
      break;
    case 'hyacinth':
      if (cell === 1 || cell === 2 || cell === 4) addGoods(ctx, 2);
      break;
    case 'crocus': {
      const c = { 1: 2, 2: 1, 3: 1, 4: 2 }[cell as 1 | 2 | 3 | 4];
      if (c) addCompost(p, c);
      if (isPrepared(p, 'chisel')) ctx.slots.push({ areas: ['apiary'], label: 'Стамеска: бонус на пасеке' });
      break;
    }
    case 'narcissus':
      if (cell !== 2 && cell !== 6) ctx.slots.push({ areas: ['barn'], label: 'Нарцисс: бонус в сарае' });
      break;
  }
  return true;
}

function fillApiary(ctx: Ctx, col: ApiaryCol): boolean {
  const p = ctx.p;
  if (col === 'main') {
    if (p.main >= APIARY_MAIN.length) return false;
    const def = APIARY_MAIN[p.main++];
    for (let i = 0; i < def.bonusGarden; i++) ctx.slots.push({ areas: ['garden'], label: 'Улей: бонус в саду' });
    return true;
  }
  if (p.main < APIARY_MAIN.length) return false;
  if (col === 'wax') {
    if (p.wax >= APIARY_WAX.length) return false;
    const def = APIARY_WAX[p.wax++];
    if (def.kind === 'c') addGoods(ctx, def.goods);
    return true;
  }
  if (col === 'honey') {
    if (p.honey >= APIARY_HONEY.length) return false;
    p.honey++;
    return true;
  }
  if (p.hive2 >= APIARY_HIVE2.length) return false;
  const eff = APIARY_HIVE2[p.hive2++];
  if (eff === 'plant') ctx.tasks.push({ k: 'field', mode: 'plant', label: 'Деление семьи: посадка' });
  if (eff === 'garden3') for (let i = 0; i < 3; i++) ctx.slots.push({ areas: ['garden'], label: 'Деление семьи: бонус в саду' });
  if (eff === 'two-actions') for (let i = 0; i < 2; i++) ctx.tasks.push({ k: 'field', mode: 'either', label: 'Деление семьи: посадка или полив' });
  return true;
}

function fillGarden(ctx: Ctx, row: GardenRow): boolean {
  const p = ctx.p;
  const cells = GARDEN_CELLS[row];
  if (p.garden[row] >= cells.length) return false;
  const kind = cells[p.garden[row]++];
  if (kind !== 'c') return true;
  switch (row) {
    case 'apple':
      if (isPrepared(p, 'buffet')) addGoods(ctx, 1);
      break;
    case 'peach':
      addGoods(ctx, tulipPeachGoods(p) + (isPrepared(p, 'buffet') ? 1 : 0));
      ctx.tasks.push({ k: 'field', mode: 'water', label: 'Персики: полив на любой грядке' });
      break;
    case 'blackberry':
      if (isPrepared(p, 'preserves')) addGoods(ctx, 1);
      break;
    case 'raspberry':
      addGoods(ctx, RASPBERRY_GOODS);
      break;
  }
  return true;
}

function fillBarn(ctx: Ctx, item: BarnItem): boolean {
  const p = ctx.p;
  const def = BARN[item];
  if (p.barn[item] >= def.cells.length) return false;
  p.barn[item]++;
  if (isPrepared(p, 'wheelbarrow')) addGoods(ctx, 1);
  return true;
}

// ---------------------------------------------------------------------------
// Огород: посадка и полив
// ---------------------------------------------------------------------------

export function cropsInBed(bed: number): string[] {
  const ids: string[] = [];
  UNIT_BED.forEach((b, i) => {
    if (b === bed) ids.push(`c${i}`, `b${i}`);
  });
  PUMPKINS.forEach((pk, i) => {
    if (pk.bed === bed) ids.push(`p${i}`);
  });
  return ids;
}
function cropFilled(p: PlayerState, id: string): number {
  const i = Number(id.slice(1));
  return id[0] === 'c' ? p.corn[i] : id[0] === 'b' ? p.beans[i] : p.pumpkins[i];
}
function cropCells(id: string): number {
  const i = Number(id.slice(1));
  return id[0] === 'c' ? CORN_CELLS : id[0] === 'b' ? BEAN_CELLS : PUMPKINS[i].cells;
}
function cropBed(id: string): number {
  const i = Number(id.slice(1));
  return id[0] === 'p' ? PUMPKINS[i].bed : UNIT_BED[i];
}
function validCrop(id: string): boolean {
  if (!/^[cbp]\d+$/.test(id)) return false;
  const i = Number(id.slice(1));
  return id[0] === 'p' ? i < PUMPKINS.length : i < UNIT_COUNT;
}
function canPlant(p: PlayerState, id: string): boolean {
  if (cropFilled(p, id) !== 0) return false;
  if (id[0] === 'b') return p.corn[Number(id.slice(1))] >= 2; // фасоль — только рядом с кукурузой (≥2 ячейки)
  return true;
}
export const plantMax = (p: PlayerState) => (isPrepared(p, 'seeder') ? 3 : 2);

export function plantableIn(p: PlayerState, bed: number): string[] {
  return cropsInBed(bed).filter((id) => canPlant(p, id));
}
export function waterableIn(p: PlayerState, bed: number): string[] {
  return cropsInBed(bed).filter((id) => {
    const f = cropFilled(p, id);
    return f > 0 && f < cropCells(id);
  });
}

function setFilled(p: PlayerState, id: string, v: number) {
  const i = Number(id.slice(1));
  if (id[0] === 'c') p.corn[i] = v;
  else if (id[0] === 'b') p.beans[i] = v;
  else p.pumpkins[i] = v;
}

function harvestPumpkin(ctx: Ctx, i: number) {
  const p = ctx.p;
  addGoods(ctx, PUMPKINS[i].goods);
  const n = PUMPKINS.length;
  const next = (i + 1) % n;
  const prev = (i + n - 1) % n;
  if (pumpkinDone(p, next) && !p.symbols[i]) {
    p.symbols[i] = true;
    fillPerennial(ctx, pidx(PUMPKIN_SYMBOLS[i]));
  }
  if (pumpkinDone(p, prev) && !p.symbols[prev]) {
    p.symbols[prev] = true;
    fillPerennial(ctx, pidx(PUMPKIN_SYMBOLS[prev]));
  }
}

function doPlant(ctx: Ctx, ids: string[]) {
  for (const id of ids) setFilled(ctx.p, id, 1);
  // Если культура состоит из одной клетки (тыква из 1 клетки) — сбор происходит сразу.
  for (const id of ids) {
    if (cropFilled(ctx.p, id) >= cropCells(id)) harvestCrop(ctx, id);
  }
}
function harvestCrop(ctx: Ctx, id: string) {
  if (id[0] === 'p') harvestPumpkin(ctx, Number(id.slice(1)));
}
function doWater(ctx: Ctx, bed: number) {
  const p = ctx.p;
  for (const id of waterableIn(p, bed)) {
    const v = cropFilled(p, id) + 1;
    setFilled(p, id, v);
    if (v >= cropCells(id)) harvestCrop(ctx, id);
  }
}

/** Минимальная стоимость в компосте, чтобы кубик со значением `die` считался значением `bed`. */
export function shiftCost(p: PlayerState, die: number, bed: number): { cost: number; dir: 1 | -1 } {
  const up = (bed - die + BEDS) % BEDS;
  const down = (die - bed + BEDS) % BEDS;
  const [dist, dir] = up <= down ? [up, 1 as const] : [down, -1 as const];
  return { cost: Math.max(0, dist - irisShift(p)), dir };
}
function shiftDie(die: number, dir: 1 | -1, steps: number): number {
  return ((die - 1 + dir * steps + BEDS * 4) % BEDS) + 1;
}

function bedOptions(p: PlayerState, kind: 'plant' | 'water', die: number | null): BedOption[] {
  const out: BedOption[] = [];
  for (let bed = 1; bed <= BEDS; bed++) {
    const cost = die === null ? 0 : shiftCost(p, die, bed).cost;
    if (cost > compostAvail(p)) continue;
    if (kind === 'plant') {
      const crops = plantableIn(p, bed);
      if (crops.length) out.push({ bed, cost, crops, max: plantMax(p) });
    } else {
      const count = waterableIn(p, bed).length;
      if (count) out.push({ bed, cost, count });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Цели «действий» (бонусные действия, пасека/сад, сарай, многолетники)
// ---------------------------------------------------------------------------

export function apiaryCols(p: PlayerState): ApiaryCol[] {
  const cols: ApiaryCol[] = [];
  if (p.main < APIARY_MAIN.length) cols.push('main');
  else {
    if (p.wax < APIARY_WAX.length) cols.push('wax');
    if (p.honey < APIARY_HONEY.length) cols.push('honey');
    if (p.hive2 < APIARY_HIVE2.length) cols.push('hive2');
  }
  return cols;
}
const APIARY_NAMES: Record<ApiaryCol, string> = { main: 'Основной улей', wax: 'Воск', honey: 'Мёд', hive2: 'Деление семьи' };

export function targetsFor(p: PlayerState, areas: Area[], row?: GardenRow): Target[] {
  const out: Target[] = [];
  if (areas.includes('perennial'))
    PERENNIALS.forEach((c, i) => {
      if (p.perennial[i] < PERENNIAL_CELLS) out.push({ area: 'perennial', target: c, label: PERENNIAL_NAMES[c] });
    });
  if (areas.includes('apiary'))
    for (const c of apiaryCols(p)) out.push({ area: 'apiary', target: c, label: APIARY_NAMES[c] });
  if (areas.includes('garden'))
    for (const r of GARDEN_ROWS) {
      if (row && r !== row) continue;
      if (p.garden[r] < GARDEN_CELLS[r].length) out.push({ area: 'garden', target: r, label: GARDEN_NAMES[r] });
    }
  if (areas.includes('barn'))
    for (const it of BARN_ITEMS) if (p.barn[it] < BARN[it].cells.length) out.push({ area: 'barn', target: it, label: BARN[it].name });
  return out;
}

function performTarget(ctx: Ctx, area: Area, target: string): boolean {
  switch (area) {
    case 'perennial': {
      const col = PERENNIALS.indexOf(target as Perennial);
      return col >= 0 && fillPerennial(ctx, col);
    }
    case 'apiary':
      return ['main', 'wax', 'honey', 'hive2'].includes(target) && fillApiary(ctx, target as ApiaryCol);
    case 'garden':
      return (GARDEN_ROWS as readonly string[]).includes(target) && fillGarden(ctx, target as GardenRow);
    case 'barn':
      return (BARN_ITEMS as readonly string[]).includes(target) && fillBarn(ctx, target as BarnItem);
  }
}

// ---------------------------------------------------------------------------
// Ячейки поля и задачи
// ---------------------------------------------------------------------------

type CellType = 'barn' | 'apiaryGarden' | 'plantWater' | 'compostGoods' | 'market';
const cellType = (c: FieldCell): CellType =>
  c === 'barn' || c === 'barn2' ? 'barn' : c === 'apiaryGardenGold' || c === 'apiaryGarden' ? 'apiaryGarden' : c;

function cellTargets(p: PlayerState, cell: FieldCell): Target[] {
  const t = cellType(cell);
  if (t === 'barn') return targetsFor(p, ['barn']);
  if (t === 'apiaryGarden') return targetsFor(p, ['apiary', 'garden']);
  return [];
}

function visitMarket(ctx: Ctx) {
  const p = ctx.p;
  const labelsActive = isPrepared(p, 'labels'); // действует только со следующего визита, если подготовлены сейчас
  let row = MARKET[0];
  for (const r of MARKET) if (p.goods >= r.min) row = r;
  addCompost(p, row.compost);
  const per = row.perennial + (labelsActive ? 1 : 0);
  for (let i = 0; i < per; i++) ctx.slots.push({ areas: ['perennial'], label: 'Рынок: действие с многолетниками' });
  for (let i = 0; i < row.gardenBonus; i++) ctx.slots.push({ areas: ['garden'], label: 'Рынок: бонус в саду' });
  for (let i = 0; i < row.anyBonus; i++) ctx.slots.push(anySlot('Рынок: любое бонусное действие'));
}

function flush(p: PlayerState, ctx: Ctx) {
  const add: Task[] = [];
  if (ctx.slots.length) add.push({ k: 'act', slots: ctx.slots });
  add.push(...ctx.tasks);
  p.tasks.unshift(...add);
}

// ---------------------------------------------------------------------------
// «Settle»: убираем задачи без вариантов, выполняем автоматические (дождь)
// ---------------------------------------------------------------------------

function turnLegal(p: PlayerState, t: Extract<Task, { k: 'turn' }>) {
  const wantGarden = t.gardenLeft > 0 || (cellType(t.cell) === 'plantWater' && t.cellLeft);
  const garden = wantGarden && (bedOptions(p, 'plant', t.die).length > 0 || bedOptions(p, 'water', t.die).length > 0);
  let cell = false;
  if (t.cellLeft) {
    const ct = cellType(t.cell);
    if (ct === 'compostGoods' || ct === 'market') cell = true;
    else if (ct !== 'plantWater') cell = cellTargets(p, t.cell).length > 0;
    if (isPrepared(p, 'mulch') && targetsFor(p, ['perennial']).length) cell = true;
  }
  return { garden, cell };
}

function settle(state: GameState, p: PlayerState) {
  for (let guard = 0; guard < 500 && p.tasks.length; guard++) {
    const t = p.tasks[0];
    if (t.k === 'act') {
      t.slots = t.slots.filter((s) => targetsFor(p, s.areas, s.row).length > 0);
      if (!t.slots.length) p.tasks.shift();
      else break;
    } else if (t.k === 'field') {
      const has = (t.mode !== 'water' && bedOptions(p, 'plant', null).length) || (t.mode !== 'plant' && bedOptions(p, 'water', null).length);
      if (!has) p.tasks.shift();
      else break;
    } else if (t.k === 'turn') {
      const l = turnLegal(p, t);
      if (!l.garden && !l.cell) p.tasks.shift();
      else break;
    } else if (t.k === 'rain') {
      const ctx = newCtx(state, p);
      doWater(ctx, t.next);
      t.next++;
      if (t.next > BEDS) {
        p.tasks.shift();
        if (isPrepared(p, 'barrel')) p.tasks.unshift({ k: 'field', mode: 'water', label: 'Дождевая бочка: полив на любой грядке' });
      }
      flush(p, ctx);
    }
  }
}

// ---------------------------------------------------------------------------
// Применение действий игрока
// ---------------------------------------------------------------------------

export function activeIndex(state: GameState): number {
  return (state.first + state.pickPos) % state.players.length;
}

export function applyAction(state: GameState, playerId: string, action: Action, rng: Rng): Result {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Игрок не найден');
  if (state.phase === 'over') return fail('Партия окончена');

  const res = dispatch(state, p, action);
  if (!res.ok) return res;
  advance(state, rng);
  return ok;
}

/**
 * Предпросмотр хода: выполняет действие на копии состояния, но не переходит к следующей фазе/игроку/раунду.
 * Результат для листа игрока совпадает с настоящим выполнением (движок детерминирован).
 */
export function previewAction(state: GameState, playerId: string, action: Action): Result {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return fail('Игрок не найден');
  if (state.phase === 'over') return fail('Партия окончена');
  const res = dispatch(state, p, action);
  if (!res.ok) return res;
  settle(state, p);
  return ok;
}

/** Ход игрока полностью выполнен (в предпросмотре): больше нет задач, и кубик взят, если это фаза садоводства. */
export function turnDone(state: GameState, playerId: string): boolean {
  const p = state.players.find((x) => x.id === playerId);
  if (!p || state.phase === 'over') return false;
  return p.tasks.length === 0 && (state.phase !== 'pick' || state.pickTaken);
}

function dispatch(state: GameState, p: PlayerState, a: Action): Result {
  if (a.t === 'pick') return doPick(state, p, a.cell);
  if (state.phase === 'pick' && state.players[activeIndex(state)] !== p) return fail('Сейчас ход другого игрока');
  if (!p.tasks.length) return fail('Сейчас вам нечего делать');
  const top = p.tasks[0];

  if (a.t === 'shovel') {
    if (!isPrepared(p, 'shovel')) return fail('Лопата не подготовлена');
    if (compostAvail(p) < 3) return fail('Нужно 3 компоста');
    if (!targetsFor(p, ALL_AREAS).length) return fail('Нет доступных бонусных действий');
    p.compostSpent += 3;
    p.tasks.unshift({ k: 'act', slots: [anySlot('Лопата: любое бонусное действие')] });
    logMsg(state, `${p.name}: лопата (−3 компоста)`);
    return ok;
  }

  if (a.t === 'skip') {
    p.tasks.shift();
    logMsg(state, `${p.name} пропускает действие`);
    return ok;
  }

  if (a.t === 'plant' || a.t === 'water') return doGarden(state, p, top, a);

  if (a.t === 'cell') {
    if (top.k !== 'turn' || !top.cellLeft) return fail('Действие клетки недоступно');
    const ct = cellType(top.cell);
    const ctx = newCtx(state, p);
    if (ct === 'compostGoods') {
      addCompost(p, 1);
      addGoods(ctx, 4);
      logMsg(state, `${p.name}: +1 компост, +4 товара`);
    } else if (ct === 'market') {
      logMsg(state, `${p.name} посещает фермерский рынок (товаров: ${p.goods})`);
      visitMarket(ctx);
    } else return fail('Для этой клетки выберите цель');
    top.cellLeft = false;
    flush(p, ctx);
    return ok;
  }

  // a.t === 'act'
  if (top.k === 'turn') {
    if (!top.cellLeft) return fail('Действие клетки уже выполнено');
    const ct = cellType(top.cell);
    const ctx = newCtx(state, p);
    const mulch = a.area === 'perennial' && isPrepared(p, 'mulch');
    const allowed =
      (ct === 'barn' && a.area === 'barn') || (ct === 'apiaryGarden' && (a.area === 'apiary' || a.area === 'garden')) || mulch;
    if (!allowed) return fail('Эта цель недоступна для данной клетки');
    if (!performTarget(ctx, a.area, a.target)) return fail('Нельзя закрасить эту ячейку');
    top.cellLeft = false;
    logAct(state, p, a.area, a.target, mulch ? ' (мульча)' : '');
    flush(p, ctx);
    return ok;
  }
  if (top.k === 'act') {
    const idx = a.slot ?? top.slots.findIndex((s) => s.areas.includes(a.area) && (!s.row || s.row === a.target));
    const slot = top.slots[idx];
    if (!slot) return fail('Нет подходящего бонуса');
    if (!slot.areas.includes(a.area)) return fail('Этот бонус нельзя потратить здесь');
    if (slot.row && a.target !== slot.row) return fail(`Нужен ряд «${GARDEN_NAMES[slot.row]}»`);
    const ctx = newCtx(state, p);
    if (!performTarget(ctx, a.area, a.target)) return fail('Нельзя закрасить эту ячейку');
    top.slots.splice(idx, 1);
    logAct(state, p, a.area, a.target, '');
    flush(p, ctx);
    return ok;
  }
  return fail('Сейчас нужно другое действие');
}

function logAct(state: GameState, p: PlayerState, area: Area, target: string, suffix: string) {
  const name =
    area === 'perennial'
      ? PERENNIAL_NAMES[target as Perennial]
      : area === 'apiary'
        ? APIARY_NAMES[target as ApiaryCol]
        : area === 'garden'
          ? GARDEN_NAMES[target as GardenRow]
          : BARN[target as BarnItem].name;
  const where = { perennial: 'клумба', apiary: 'пасека', garden: 'сад', barn: 'сарай' }[area];
  logMsg(state, `${p.name}: ${where} — ${name}${suffix}`);
}

function doGarden(state: GameState, p: PlayerState, top: Task, a: Extract<Action, { t: 'plant' | 'water' }>): Result {
  const isTurn = top.k === 'turn';
  if (!isTurn && top.k !== 'field') return fail('Сейчас нельзя сажать или поливать');
  if (top.k === 'field') {
    if (top.mode === 'plant' && a.t !== 'plant') return fail('Сейчас нужна посадка');
    if (top.mode === 'water' && a.t !== 'water') return fail('Сейчас нужен полив');
  }
  let cost = 0;
  let dir: 1 | -1 = 1;
  if (top.k === 'turn') {
    const hasSlot = top.gardenLeft > 0 || (cellType(top.cell) === 'plantWater' && top.cellLeft);
    if (!hasSlot) return fail('Действие в огороде уже выполнено');
    ({ cost, dir } = shiftCost(p, top.die, a.bed));
    if (cost > compostAvail(p)) return fail('Не хватает компоста');
  }
  if (!Number.isInteger(a.bed) || a.bed < 1 || a.bed > BEDS) return fail('Неверная грядка');

  const ctx = newCtx(state, p);
  if (a.t === 'plant') {
    const ids = [...new Set(a.crops)];
    if (!ids.length) return fail('Выберите культуры');
    if (ids.length > plantMax(p)) return fail(`Можно посадить не более ${plantMax(p)} культур`);
    for (const id of ids) {
      if (!validCrop(id) || cropBed(id) !== a.bed) return fail('Культура не с этой грядки');
      if (!canPlant(p, id)) return fail(id[0] === 'b' ? 'Фасоль нужно сажать рядом с кукурузой (≥2 ячейки)' : 'Культура уже посажена');
    }
    doPlant(ctx, ids);
    logMsg(state, `${p.name}: посадка на грядке ${a.bed} (${ids.length})`);
  } else {
    if (!waterableIn(p, a.bed).length) return fail('На этой грядке нечего поливать');
    doWater(ctx, a.bed);
    logMsg(state, `${p.name}: полив грядки ${a.bed}`);
  }

  if (top.k === 'turn') {
    if (cost > 0) {
      p.compostSpent += cost;
      top.die = shiftDie(top.die, dir, cost);
      logMsg(state, `${p.name}: −${cost} компоста (кубик → ${top.die})`);
    }
    if (top.gardenLeft > 0) top.gardenLeft--;
    else top.cellLeft = false;
  } else p.tasks.shift();
  flush(p, ctx);
  return ok;
}

function doPick(state: GameState, p: PlayerState, cell: number): Result {
  if (state.phase !== 'pick') return fail('Сейчас нельзя брать кубик');
  if (state.players[activeIndex(state)] !== p) return fail('Сейчас ход другого игрока');
  if (state.pickTaken) return fail('Вы уже взяли кубик');
  const group = state.field[cell];
  if (!group || !group.length) return fail('На этой клетке нет кубиков');
  const die = group.pop()!;
  state.pickTaken = true;
  p.tasks = [{ k: 'turn', die, cell: FIELD[cell].id, gardenLeft: 1, cellLeft: true }];
  logMsg(state, `${p.name} берёт кубик ${die} с клетки «${FIELD[cell].name}»`);
  return ok;
}

// ---------------------------------------------------------------------------
// Фазы
// ---------------------------------------------------------------------------

function assignFinal(state: GameState) {
  let best: { cell: number; value: number } | null = null;
  state.field.forEach((g, cell) => {
    if (g.length && (!best || g[0] < best.value)) best = { cell, value: g[0] };
  });
  state.finalDie = best;
  if (!best) return;
  const b = best as { cell: number; value: number };
  for (const p of state.players) p.tasks = [{ k: 'turn', die: b.value, cell: FIELD[b.cell].id, gardenLeft: 1, cellLeft: true }];
  logMsg(state, `Оставшийся кубик ${b.value} (клетка «${FIELD[b.cell].name}») используют все`);
}

function assignEvent(state: GameState) {
  const ev = ROUND_EVENTS[state.round - 1];
  logMsg(state, `Событие: ${EVENT_NAMES[ev]}`);
  for (const p of state.players) {
    if (ev === 'barn') p.tasks = [{ k: 'act', slots: [{ areas: ['barn'], label: 'Событие: действие в сарае' }] }];
    else if (ev === 'rain') p.tasks = [{ k: 'rain', next: 1 }];
    else {
      const ctx = newCtx(state, p);
      logMsg(state, `${p.name} посещает фермерский рынок (товаров: ${p.goods})`);
      visitMarket(ctx);
      p.tasks = [];
      flush(p, ctx);
    }
  }
}

export function advance(state: GameState, rng: Rng) {
  for (let guard = 0; guard < 100; guard++) {
    for (const p of state.players) settle(state, p);
    if (state.phase === 'pick') {
      const p = state.players[activeIndex(state)];
      if (state.pickTaken && p.tasks.length === 0) {
        state.pickTaken = false;
        state.pickPos++;
        if (state.pickPos >= state.players.length) {
          state.phase = 'final';
          assignFinal(state);
        }
        continue;
      }
      return;
    }
    if (state.phase === 'final') {
      if (state.players.every((p) => p.tasks.length === 0)) {
        state.phase = 'event';
        assignEvent(state);
        continue;
      }
      return;
    }
    if (state.phase === 'event') {
      if (state.players.every((p) => p.tasks.length === 0)) {
        endRound(state, rng);
        continue;
      }
      return;
    }
    return;
  }
}

function endRound(state: GameState, rng: Rng) {
  if (state.round >= ROUNDS) {
    state.phase = 'over';
    state.scores = state.players.map(scorePlayer);
    const best = Math.max(...state.scores.map((s) => s.total));
    let cands = state.players.filter((_, i) => state.scores![i].total === best);
    if (cands.length > 1) {
      const bg = Math.max(...cands.map((c) => state.scores![state.players.indexOf(c)].garden));
      cands = cands.filter((c) => state.scores![state.players.indexOf(c)].garden === bg);
    }
    state.winners = cands.map((c) => c.id);
    logMsg(state, 'Партия окончена');
    return;
  }
  state.round++;
  startRound(state, rng);
}

// ---------------------------------------------------------------------------
// Подсчёт очков
// ---------------------------------------------------------------------------

export interface ScorePart {
  label: string;
  note?: string; // пояснение (например «5/6 ячеек — не заполнен»)
  vp: number;
}
export type ScoreCat = 'garden' | 'perennials' | 'apiary' | 'orchard' | 'barn';
export type ScoreParts = Record<ScoreCat, ScorePart[]>;
export const SCORE_CAT_NAMES: Record<ScoreCat, string> = { garden: 'Огород', perennials: 'Клумба', apiary: 'Пасека', orchard: 'Сад', barn: 'Сарай' };

/** Подробный разбор очков: каждая статья отдельной строкой. Итог scorePlayer считается из этих же строк. */
export function scoreParts(p: PlayerState): ScoreParts {
  const parts: ScoreParts = { garden: [], perennials: [], apiary: [], orchard: [], barn: [] };

  const corn = cornDone(p);
  const beans = beansDone(p);
  parts.garden.push({ label: 'Кукуруза', note: `${corn} × 3`, vp: corn * 3 }, { label: 'Фасоль', note: `${beans} × 1`, vp: beans });

  PERENNIALS.forEach((c, i) => {
    const filled = p.perennial[i];
    const full = filled >= PERENNIAL_CELLS;
    const vp = !full ? 0 : c === 'tulip' ? Math.min(TULIP_VP_CAP, fruitHarvests(p)) : PERENNIAL_END_VP[c];
    const note = full ? (c === 'tulip' ? `сборов фруктов: ${fruitHarvests(p)} (максимум ${TULIP_VP_CAP})` : 'столбец заполнен') : `${filled}/${PERENNIAL_CELLS} — не заполнен`;
    parts.perennials.push({ label: PERENNIAL_NAMES[c], note, vp });
  });

  const wax = APIARY_WAX.reduce((sum, c, i) => sum + (i < p.wax && c.kind === 'c' ? c.vp : 0), 0);
  const honey = APIARY_HONEY.reduce((sum, c, i) => sum + (i < p.honey && c.kind === 'c' ? c.vp : 0), 0);
  parts.apiary.push(
    { label: 'Воск', note: `${p.wax}/${APIARY_WAX.length} ячеек`, vp: wax },
    { label: 'Мёд', note: `${p.honey}/${APIARY_HONEY.length} ячеек`, vp: honey },
    { label: 'Деление семьи', note: p.hive2 >= 1 ? 'начато' : 'не начато', vp: p.hive2 >= 1 ? HIVE2_VP : 0 },
  );

  const apple = harvests(p, 'apple');
  const black = harvests(p, 'blackberry');
  const rb = harvests(p, 'raspberry');
  let rbVp = 0;
  for (const [at, vp] of Object.entries(RASPBERRY_VP_AT)) if (rb >= Number(at)) rbVp += vp;
  parts.orchard.push(
    { label: 'Яблоки', note: `${apple} × ${APPLE_VP}`, vp: apple * APPLE_VP },
    { label: 'Ежевика', note: `${black} × ${BLACKBERRY_VP}`, vp: black * BLACKBERRY_VP },
    { label: 'Малина', note: `сборов: ${rb} (бонус за 3, 6 и 9-й)`, vp: rbVp },
  );

  for (const it of BARN_ITEMS) {
    if (!isPrepared(p, it)) continue;
    const d = BARN[it];
    if (d.vp) parts.barn.push({ label: d.name, vp: d.vp });
  }
  if (isPrepared(p, 'fruitbowl')) {
    const kinds = GARDEN_ROWS.filter((r) => harvests(p, r) > 0).length;
    parts.barn.push({ label: BARN.fruitbowl.name, note: `разных видов: ${kinds}`, vp: FRUITBOWL_VP[kinds] });
  }
  if (isPrepared(p, 'casserole')) parts.barn.push({ label: BARN.casserole.name, note: `${beans} фасоли → за каждые 2`, vp: Math.floor(beans / 2) });
  if (isPrepared(p, 'carving')) parts.barn.push({ label: BARN.carving.name, note: 'тыкв в самой длинной цепочке', vp: longestPumpkinChain(p) });
  return parts;
}

export function scorePlayer(p: PlayerState): Score {
  const parts = scoreParts(p);
  const sum = (c: ScoreCat) => parts[c].reduce((x, y) => x + y.vp, 0);
  const garden = sum('garden');
  const perennials = sum('perennials');
  const apiary = sum('apiary');
  const orchard = sum('orchard');
  const barn = sum('barn');
  return { garden, perennials, apiary, orchard, barn, total: garden + perennials + apiary + orchard + barn };
}

// ---------------------------------------------------------------------------
// Что может делать игрок сейчас (для интерфейса)
// ---------------------------------------------------------------------------

export function optionsFor(state: GameState, playerId: string): Options {
  const p = state.players.find((x) => x.id === playerId)!;
  const base = {
    canShovel: false,
    irisShift: irisShift(p),
    compost: compostAvail(p),
  };
  if (state.phase === 'over') return { ...base, kind: 'over', hint: 'Партия окончена' };

  const shovelOk = isPrepared(p, 'shovel') && compostAvail(p) >= 3 && p.tasks.length > 0 && targetsFor(p, ALL_AREAS).length > 0;
  const common = { ...base, canShovel: shovelOk };

  if (state.phase === 'pick' && !p.tasks.length) {
    const active = state.players[activeIndex(state)];
    if (active === p && !state.pickTaken) {
      const cells = state.field.map((g, i) => (g.length ? i : -1)).filter((i) => i >= 0);
      return { ...common, kind: 'pick', hint: 'Ваш ход: возьмите кубик с поля', pickCells: cells };
    }
    return { ...common, kind: 'wait', hint: active === p ? 'Подождите…' : `Ходит ${active.name}` };
  }
  if (!p.tasks.length) return { ...common, kind: 'wait', hint: 'Ждём остальных игроков…' };

  const t = p.tasks[0];
  if (t.k === 'turn') {
    const ct = cellType(t.cell);
    const wantGarden = t.gardenLeft > 0 || (ct === 'plantWater' && t.cellLeft);
    const o: Options = {
      ...common,
      kind: 'turn',
      hint: `Кубик ${t.die}: действие в огороде и действие клетки (в любом порядке)`,
      die: t.die,
      cellName: FIELD.find((f) => f.id === t.cell)!.name,
      cellLeft: t.cellLeft,
      plant: wantGarden ? bedOptions(p, 'plant', t.die) : [],
      water: wantGarden ? bedOptions(p, 'water', t.die) : [],
    };
    if (ct === 'compostGoods') o.cellKind = 'auto';
    else if (ct === 'market') o.cellKind = 'auto';
    else if (ct === 'plantWater') o.cellKind = 'plantWater';
    else o.cellKind = 'act';
    o.autoLabel = ct === 'market' ? 'Посетить фермерский рынок' : '+1 компост и +4 товара';
    o.cellTargets = t.cellLeft ? cellTargets(p, t.cell) : [];
    o.mulchTargets = t.cellLeft && isPrepared(p, 'mulch') ? targetsFor(p, ['perennial']) : [];
    return o;
  }
  if (t.k === 'act') {
    return {
      ...common,
      kind: 'act',
      hint: 'Потратьте бонусное действие',
      slots: t.slots.map((s) => ({ label: s.label, areas: s.areas, row: s.row, targets: targetsFor(p, s.areas, s.row) })),
    };
  }
  if (t.k === 'field') {
    return {
      ...common,
      kind: 'field',
      hint: t.label,
      plant: t.mode !== 'water' ? bedOptions(p, 'plant', null) : [],
      water: t.mode !== 'plant' ? bedOptions(p, 'water', null) : [],
    };
  }
  return { ...common, kind: 'rain', hint: 'Идёт дождь…' };
}
