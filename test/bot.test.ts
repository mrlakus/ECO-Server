import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame } from '../src/shared/engine';
import { chooseAction } from '../src/shared/bot';
import { randomMove, seeded } from './helpers';
import type { GameState } from '../src/shared/types';

/** Играет партию: игроки из botIds ходят ботом, остальные — случайно. */
function play(seed: number, n: number, botIds: Set<string>): GameState {
  const rng = seeded(seed);
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const g = createGame(players, rng);
  for (let steps = 0; g.phase !== 'over'; steps++) {
    assert.ok(steps < 20000, `слишком много ходов, seed=${seed}`);
    let moved = false;
    for (const p of g.players) {
      if (!botIds.has(p.id)) continue;
      const a = chooseAction(g, p.id, rng);
      if (!a) continue;
      const r = applyAction(g, p.id, a, rng);
      assert.ok(r.ok, `бот выбрал недопустимый ход ${JSON.stringify(a)}: ${(r as any).error}`);
      moved = true;
      break;
    }
    if (!moved && !randomMove(g, rng)) assert.fail(`зависание seed=${seed} раунд=${g.round} фаза=${g.phase}`);
  }
  return g;
}

test('бот доигрывает партии на 2–4 игрока без недопустимых ходов', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const n = 2 + (seed % 3);
    const g = play(seed, n, new Set(Array.from({ length: n }, (_, i) => `p${i}`)));
    assert.equal(g.phase, 'over');
    assert.equal(g.scores!.length, n);
  }
});

test('бот заметно сильнее случайных ходов', () => {
  let bot = 0;
  let rnd = 0;
  const games = 8;
  for (let seed = 100; seed < 100 + games; seed++) {
    const g = play(seed, 2, new Set(['p0']));
    bot += g.scores![0].total;
    rnd += g.scores![1].total;
  }
  console.log(`средний счёт: бот ${(bot / games).toFixed(1)} против случайного ${(rnd / games).toFixed(1)}`);
  assert.ok(bot > rnd * 1.5, 'бот должен набирать существенно больше случайного игрока');
});
