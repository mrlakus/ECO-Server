import { applyAction, optionsFor, type Rng } from '../src/shared/engine';
import type { Action, GameState } from '../src/shared/types';

/** Детерминированный генератор (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Случайный, но допустимый ход любого игрока, у которого он есть. Возвращает false, если ходить некому. */
export function randomMove(state: GameState, rng: Rng): boolean {
  const order = state.players.map((_, i) => i).sort(() => rng() - 0.5);
  for (const i of order) {
    const p = state.players[i];
    const o = optionsFor(state, p.id);
    const cands: Action[] = [];
    if (o.kind === 'pick') for (const c of o.pickCells ?? []) cands.push({ t: 'pick', cell: c });
    if (o.kind === 'turn' || o.kind === 'field') {
      for (const b of o.plant ?? []) cands.push({ t: 'plant', bed: b.bed, crops: (b.crops ?? []).slice(0, 1 + Math.floor(rng() * (b.max ?? 2))) });
      for (const b of o.water ?? []) cands.push({ t: 'water', bed: b.bed });
      if (o.kind === 'turn') {
        if (o.cellLeft && o.cellKind === 'auto') cands.push({ t: 'cell' });
        for (const t of o.cellTargets ?? []) cands.push({ t: 'act', area: t.area, target: t.target });
        for (const t of o.mulchTargets ?? []) cands.push({ t: 'act', area: t.area, target: t.target });
      }
    }
    if (o.kind === 'act') {
      (o.slots ?? []).forEach((s, idx) => s.targets.forEach((t) => cands.push({ t: 'act', area: t.area, target: t.target, slot: idx })));
    }
    if (o.canShovel && rng() < 0.3) cands.push({ t: 'shovel' });
    if (!cands.length) continue;
    const a = cands[Math.floor(rng() * cands.length)];
    const r = applyAction(state, p.id, a, rng);
    if (!r.ok) throw new Error(`Бот выбрал недопустимый ход ${JSON.stringify(a)}: ${r.error}`);
    return true;
  }
  return false;
}
