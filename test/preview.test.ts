import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, previewAction, turnDone, optionsFor } from '../src/shared/engine';
import { chooseAction } from '../src/shared/bot';
import { seeded } from './helpers';

test('предпросмотр хода даёт тот же лист, что и настоящее выполнение; фаза не меняется', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rng = seeded(seed);
    const real = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], rng);
    const prev = structuredClone(real);
    const pid = real.players[real.first].id;
    const roundBefore = prev.round;
    let steps = 0;
    for (; steps < 60; steps++) {
      const act = chooseAction(prev, pid, rng);
      if (!act) break;
      const rp = previewAction(prev, pid, act);
      const rr = applyAction(real, pid, act, rng);
      assert.ok(rp.ok && rr.ok, `seed=${seed} шаг=${steps}: ${JSON.stringify(act)}`);
      const a = real.players.find((p) => p.id === pid)!;
      const b = prev.players.find((p) => p.id === pid)!;
      assert.deepEqual({ ...b, tasks: [] }, { ...a, tasks: [] }, `лист игрока расходится, seed=${seed} шаг=${steps}`);
      if (turnDone(prev, pid)) break;
    }
    assert.ok(turnDone(prev, pid), `ход не завершён, seed=${seed}`);
    assert.equal(prev.round, roundBefore, 'предпросмотр не должен менять раунд');
    assert.equal(prev.phase, 'pick', 'предпросмотр не должен менять фазу');
  }
});

test('предпросмотр не трогает исходное состояние, если работать с копией', () => {
  const rng = seeded(3);
  const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], rng);
  const snapshot = JSON.stringify(g);
  const copy = structuredClone(g);
  const cell = copy.field.findIndex((x) => x.length);
  assert.ok(previewAction(copy, copy.players[copy.first].id, { t: 'pick', cell }).ok);
  assert.equal(JSON.stringify(g), snapshot);
  assert.equal(optionsFor(copy, copy.players[copy.first].id).kind, 'turn');
});
