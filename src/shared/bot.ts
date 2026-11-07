// Бот: жадный выбор по оценочной функции с просчётом хода вперёд при выборе кубика.

import { BARN, BARN_ITEMS, PERENNIALS, PERENNIAL_CELLS, PERENNIAL_END_VP, PUMPKINS } from './data';
import { applyAction, compostAvail, harvests, optionsFor, scorePlayer, type Rng } from './engine';
import type { Action, GameState, PlayerState } from './types';

const GOOD_V = 0.3; // ценность одного товара в очках
const COMPOST_V = 0.5;
const SPECIAL_BARN_V: Record<string, number> = { fruitbowl: 5, casserole: 3, carving: 4 };
const USEFUL_BARN = new Set(['buffet', 'preserves', 'wheelbarrow', 'pitchfork', 'chisel', 'seeder', 'mulch', 'barrel', 'labels', 'shovel']);

/** Оценка позиции игрока: набранные очки + «потенциал» недоделанного. */
export function evaluate(p: PlayerState): number {
  let v = scorePlayer(p).total;

  for (const f of p.corn) if (f > 0 && f < 4) v += 3 * (f / 4) * 0.85;
  for (const f of p.beans) if (f > 0 && f < 2) v += 1 * (f / 2) * 0.85;
  PUMPKINS.forEach((pk, i) => {
    const f = p.pumpkins[i];
    if (f > 0 && f < pk.cells) v += pk.goods * GOOD_V * (f / pk.cells) * 0.8;
  });

  v += p.goods * GOOD_V + compostAvail(p) * COMPOST_V;

  PERENNIALS.forEach((c, i) => {
    const n = p.perennial[i];
    if (n >= PERENNIAL_CELLS) return;
    const end = c === 'tulip' ? 8 : PERENNIAL_END_VP[c];
    v += (n / PERENNIAL_CELLS) * end * 0.75 + n * 0.4;
  });

  v += p.main * 0.8;
  v += Math.max(0, p.hive2 - 1) * 1.5;
  v += (harvests(p, 'raspberry') % 3) * 0.3;

  for (const it of BARN_ITEMS) {
    const d = BARN[it];
    const n = p.barn[it];
    if (n >= d.cells.length) {
      if (USEFUL_BARN.has(it)) v += 1.5;
    } else if (n > 0) {
      v += (n / d.cells.length) * (d.vp || SPECIAL_BARN_V[it] || 1) * 0.6;
    }
  }
  return v;
}

function cropSets(crops: string[], max: number): string[][] {
  const out: string[][] = crops.map((c) => [c]);
  if (max >= 2)
    for (let i = 0; i < crops.length; i++) for (let j = i + 1; j < crops.length; j++) out.push([crops[i], crops[j]]);
  if (max >= 3 && crops.length <= 8)
    for (let i = 0; i < crops.length; i++)
      for (let j = i + 1; j < crops.length; j++) for (let k = j + 1; k < crops.length; k++) out.push([crops[i], crops[j], crops[k]]);
  return out.slice(0, 80);
}

export function candidateActions(state: GameState, playerId: string): Action[] {
  const o = optionsFor(state, playerId);
  const out: Action[] = [];
  if (o.kind === 'pick') for (const c of o.pickCells ?? []) out.push({ t: 'pick', cell: c });
  if (o.kind === 'turn' || o.kind === 'field') {
    for (const b of o.plant ?? []) for (const crops of cropSets(b.crops ?? [], b.max ?? 2)) out.push({ t: 'plant', bed: b.bed, crops });
    for (const b of o.water ?? []) out.push({ t: 'water', bed: b.bed });
    if (o.kind === 'turn') {
      if (o.cellLeft && o.cellKind === 'auto') out.push({ t: 'cell' });
      for (const t of [...(o.cellTargets ?? []), ...(o.mulchTargets ?? [])]) out.push({ t: 'act', area: t.area, target: t.target });
    }
  }
  if (o.kind === 'act') (o.slots ?? []).forEach((s, slot) => s.targets.forEach((t) => out.push({ t: 'act', area: t.area, target: t.target, slot })));
  return out;
}

const dummyRng: Rng = () => 0.5;
const clone = <T>(x: T): T => structuredClone(x);
const player = (s: GameState, id: string) => s.players.find((p) => p.id === id)!;

/** Лучшее одношаговое действие по оценке; null, если вариантов нет. */
function best1ply(state: GameState, pid: string, rng: Rng, allowShovel = true): { action: Action; value: number } | null {
  let best: { action: Action; value: number } | null = null;
  let ties = 0;
  for (const action of candidateActions(state, pid)) {
    if (action.t === 'pick') continue;
    const s = clone(state);
    if (!applyAction(s, pid, action, dummyRng).ok) continue;
    const value = evaluate(player(s, pid));
    if (!best || value > best.value + 1e-9) {
      best = { action, value };
      ties = 1;
    } else if (Math.abs(value - best.value) <= 1e-9 && rng() < 1 / ++ties) best = { action, value };
  }
  // Лопата: 3 компоста → бонусное действие (двухшаговая проверка)
  const o = optionsFor(state, pid);
  if (allowShovel && o.canShovel) {
    const s = clone(state);
    if (applyAction(s, pid, { t: 'shovel' }, dummyRng).ok) {
      const follow = best1ply(s, pid, rng, false);
      if (follow) {
        const s2 = clone(s);
        applyAction(s2, pid, follow.action, dummyRng);
        const value = evaluate(player(s2, pid));
        if (!best || value > best.value + 1e-9) best = { action: { t: 'shovel' }, value };
      }
    }
  }
  return best;
}

/** Доиграть ход игрока жадно и вернуть оценку позиции. */
function playOut(state: GameState, pid: string): number {
  for (let i = 0; i < 40; i++) {
    if (!player(state, pid).tasks.length) break;
    const b = best1ply(state, pid, dummyRng);
    if (!b || !applyAction(state, pid, b.action, dummyRng).ok) break;
  }
  return evaluate(player(state, pid));
}

/** Выбор действия бота. null — ходить нечем. */
export function chooseAction(state: GameState, pid: string, rng: Rng): Action | null {
  const o = optionsFor(state, pid);
  if (o.kind === 'wait' || o.kind === 'over' || o.kind === 'rain') return null;
  if (o.kind === 'pick') {
    let best: { action: Action; value: number } | null = null;
    for (const cell of o.pickCells ?? []) {
      const s = clone(state);
      const action: Action = { t: 'pick', cell };
      if (!applyAction(s, pid, action, dummyRng).ok) continue;
      const value = playOut(s, pid) + rng() * 0.01;
      if (!best || value > best.value) best = { action, value };
    }
    return best?.action ?? null;
  }
  const b = best1ply(state, pid, rng);
  if (b) return b.action;
  return { t: 'skip' }; // страховка от зависания
}
