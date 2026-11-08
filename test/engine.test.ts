import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction, optionsFor, scorePlayer, scoreParts, longestPumpkinChain, shiftCost, createPlayer, compostAvail } from '../src/shared/engine';
import { PUMPKINS, PUMPKIN_SYMBOLS, PERENNIALS, UNIT_BED, UNIT_COUNT, FIELD } from '../src/shared/data';
import { randomMove, seeded } from './helpers';

test('данные листа согласованы', () => {
  assert.equal(UNIT_COUNT, 24);
  assert.equal(PUMPKINS.length, 12);
  for (const per of PERENNIALS) assert.equal(PUMPKIN_SYMBOLS.filter((s) => s === per).length, 2, per);
  for (let b = 1; b <= 6; b++) assert.ok(PUMPKINS.some((p) => p.bed === b) || UNIT_BED.includes(b));
});

test('подготовка: кубики группируются и кладутся по часовой от Эдит', () => {
  const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seeded(1));
  const placed = g.field.flat().length;
  assert.equal(placed, 4);
  const groups = g.field.filter((x) => x.length);
  const vals = groups.map((x) => x[0]);
  assert.deepEqual(vals, [...vals].sort((a, b) => a - b));
  assert.equal(new Set(vals).size, vals.length);
  assert.equal(g.edith, groups.length % FIELD.length);
  assert.equal(g.field[0].length > 0, true); // первая группа лежит на клетке Эдит (0)
});

test('shiftCost: ирис и круговой сдвиг 1↔6', () => {
  const p = createPlayer('x', 'X');
  assert.equal(shiftCost(p, 6, 1).cost, 1);
  assert.equal(shiftCost(p, 1, 6).cost, 1);
  assert.equal(shiftCost(p, 3, 3).cost, 0);
  assert.equal(shiftCost(p, 2, 5).cost, 3);
  p.perennial[PERENNIALS.indexOf('iris')] = 4;
  assert.equal(shiftCost(p, 2, 5).cost, 1);
});

test('посадка → полив → сбор кукурузы даёт 3 ПО', () => {
  const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seeded(7));
  const rng = seeded(1);
  // Дадим игроку A готовую ситуацию вручную: берём кубик 'a' и сажаем кукурузу на нужной грядке.
  const cell = g.field.findIndex((x) => x.length);
  const active = g.players[(g.first) % 2];
  assert.ok(applyAction(g, active.id, { t: 'pick', cell }, rng).ok);
  const o = optionsFor(g, active.id);
  assert.equal(o.kind, 'turn');
  const bed = o.plant![0];
  const corn = bed.crops!.find((c) => c.startsWith('c'))!;
  assert.ok(applyAction(g, active.id, { t: 'plant', bed: bed.bed, crops: [corn] }, rng).ok);
  const idx = Number(corn.slice(1));
  assert.equal(active.corn[idx], 1);
  active.corn[idx] = 3; // как будто политую трижды
  const sc0 = scorePlayer(active).garden;
  active.corn[idx] = 4;
  assert.equal(scorePlayer(active).garden - sc0, 3);
});

test('фасоль нельзя сажать без 2 ячеек кукурузы', () => {
  const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seeded(3));
  const active = g.players[g.first];
  active.corn[0] = 1;
  const bed = UNIT_BED[0];
  const rng = seeded(2);
  const cell = g.field.findIndex((x) => x.length);
  applyAction(g, active.id, { t: 'pick', cell }, rng);
  const r = applyAction(g, active.id, { t: 'plant', bed, crops: ['b0'] }, rng);
  assert.equal(r.ok, false);
});

test('соседние тыквы: сбор второй закрашивает символ и открывает ячейку многолетника', () => {
  const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seeded(5));
  const rng = seeded(9);
  const p = g.players[g.first];
  p.pumpkins[1] = PUMPKINS[1].cells; // уже собрана
  p.pumpkins[2] = PUMPKINS[2].cells - 1;
  g.phase = 'event';
  p.tasks = [{ k: 'field', mode: 'water', label: 't' }];
  // грядка 1: поливаем -> тыква 2 собрана
  const r = applyAction(g, p.id, { t: 'water', bed: 1 }, rng);
  assert.ok(r.ok);
  assert.equal(p.pumpkins[2], PUMPKINS[2].cells);
  assert.equal(p.symbols[1], true);
  const col = PERENNIALS.indexOf(PUMPKIN_SYMBOLS[1]);
  assert.equal(p.perennial[col] >= 1, true);
  assert.equal(p.goods >= 3, true);
});

test('самая длинная цепочка тыкв по кругу', () => {
  const p = createPlayer('x', 'X');
  const done = (i: number) => (p.pumpkins[i] = PUMPKINS[i].cells);
  [10, 11, 0, 1].forEach(done);
  done(5);
  assert.equal(longestPumpkinChain(p), 4);
});

test('фермерский рынок: пороги', () => {
  const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seeded(11));
  const rng = seeded(4);
  const p = g.players[g.first];
  p.goods = 20;
  const before = compostAvail(p);
  g.phase = 'pick';
  const cell = FIELD.findIndex((f) => f.id === 'market');
  g.field = FIELD.map(() => []);
  g.field[cell] = [3];
  assert.ok(applyAction(g, p.id, { t: 'pick', cell }, rng).ok);
  assert.ok(applyAction(g, p.id, { t: 'cell' }, rng).ok);
  // 20–34: действие с многолетниками + бонус в саду, компоста нет
  assert.equal(compostAvail(p), before);
  const o = optionsFor(g, p.id);
  assert.equal(o.kind === 'act' || o.kind === 'turn', true);
});

test('полные партии случайными ходами завершаются без зависаний (2–4 игрока)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const n = 2 + (seed % 3);
    const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    const rng = seeded(seed);
    const g = createGame(players, rng);
    let steps = 0;
    while (g.phase !== 'over') {
      if (!randomMove(g, rng)) assert.fail(`Зависание: seed=${seed} раунд=${g.round} фаза=${g.phase}`);
      if (++steps > 20000) assert.fail(`Слишком много ходов seed=${seed}`);
    }
    assert.equal(g.scores!.length, n);
    assert.ok(g.winners.length >= 1);
    for (const s of g.scores!) assert.equal(s.total, s.garden + s.perennials + s.apiary + s.orchard + s.barn);
  }
});

test('первый раунд всегда начинается с клетки «Посадка или полив»', () => {
  assert.equal(FIELD[0].id, 'plantWater');
  for (let seed = 1; seed <= 30; seed++) {
    const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], seeded(seed));
    const groups = g.field.map((d, i) => ({ d, i })).filter((x) => x.d.length);
    const lowest = Math.min(...groups.map((x) => x.d[0]));
    assert.deepEqual(g.field[0].length > 0 && g.field[0][0] === lowest, true, `seed=${seed}`);
  }
});

test('fieldStart помнит исходную раскладку, даже когда кубики забрали', () => {
  const rng = seeded(4);
  const g = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], rng);
  assert.deepEqual(g.fieldStart, g.field);
  const cell = g.field.findIndex((x) => x.length);
  const before = g.field[cell].length;
  assert.ok(applyAction(g, g.players[g.first].id, { t: 'pick', cell }, rng).ok);
  assert.equal(g.field[cell].length, before - 1);
  assert.equal(g.fieldStart[cell].length, before);
});

test('подробный разбор очков: сумма строк равна итогу; итог не изменился относительно прежних правил', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = seeded(seed);
    const n = 2 + (seed % 3);
    const g = createGame(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), rng);
    let steps = 0;
    while (g.phase !== 'over' && steps++ < 20000) if (!randomMove(g, rng)) break;
    for (const p of g.players) {
      const parts = scoreParts(p);
      const sc = scorePlayer(p);
      const sum = (c: keyof typeof parts) => parts[c].reduce((x, y) => x + y.vp, 0);
      assert.equal(sum('garden') + sum('perennials') + sum('apiary') + sum('orchard') + sum('barn'), sc.total, `seed=${seed}`);
      assert.equal(sum('garden'), sc.garden);
      assert.ok(Object.values(parts).every((arr) => arr.every((x) => Number.isInteger(x.vp) && x.vp >= 0)));
    }
  }
});
