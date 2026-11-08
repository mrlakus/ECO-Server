import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitingFor } from '../src/server/vote';

const h = (id: string, online = true) => ({ id, online });

test('голосование: предложивший считается согласным, боты в расчёте не участвуют', () => {
  assert.deepEqual(waitingFor(new Set(), 'a', [h('a')]), []); // человек + боты — заканчиваем сразу
  assert.deepEqual(waitingFor(new Set(), 'a', [h('a'), h('b')]), ['b']);
});

test('голосование: ответившие и отключившиеся не блокируют', () => {
  assert.deepEqual(waitingFor(new Set(['b']), 'a', [h('a'), h('b'), h('c')]), ['c']);
  assert.deepEqual(waitingFor(new Set(), 'a', [h('a'), h('b', false)]), []);
  assert.deepEqual(waitingFor(new Set(['b', 'c']), 'a', [h('a'), h('b'), h('c')]), []);
});
