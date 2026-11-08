import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { FileStore, RedisStore, createStore, type SavedRoom } from '../src/server/store';
import { applyAction, createGame, optionsFor, scorePlayer } from '../src/shared/engine';
import { chooseAction } from '../src/shared/bot';
import { seeded } from './helpers';

function sampleRoom(code = 'ABCDE'): SavedRoom {
  const rng = seeded(5);
  const game = createGame([{ id: 'a', name: 'Анна' }, { id: 'b', name: 'Борис' }], rng);
  for (let i = 0; i < 40; i++) {
    for (const p of game.players) {
      const act = chooseAction(game, p.id, rng);
      if (act) applyAction(game, p.id, act, rng);
    }
  }
  return {
    v: 1,
    code,
    hostId: 'a',
    members: [{ id: 'a', token: 't1', name: 'Анна' }, { id: 'b', token: 't2', name: 'Борис' }],
    game,
    pw: { salt: 's', hash: 'h' },
    chat: [{ id: 1, text: 'привет' }],
    chatSeq: 1,
    savedAt: Date.now(),
  };
}

test('партия после сохранения и загрузки идентична и игра продолжается', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ts-store-'));
  const store = new FileStore(dir);
  const room = sampleRoom();
  await store.save(room);
  const [back] = await store.loadAll();
  assert.deepEqual(back, JSON.parse(JSON.stringify(room)));
  // игра из загруженного состояния ходит и считает очки так же, как исходная
  const rng1 = seeded(77), rng2 = seeded(77);
  const g1 = structuredClone(room.game!), g2 = back.game!;
  for (let i = 0; i < 400 && g1.phase !== 'over'; i++) {
    for (const p of g1.players) {
      const a1 = chooseAction(g1, p.id, rng1), a2 = chooseAction(g2, p.id, rng2);
      assert.deepEqual(a2, a1);
      if (a1) { applyAction(g1, p.id, a1, rng1); applyAction(g2, p.id, a2!, rng2); }
    }
  }
  assert.deepEqual(g2.players.map(scorePlayer), g1.players.map(scorePlayer));
  assert.ok(optionsFor(g2, 'a'));
});

test('файловое хранилище: удаление, повреждённые и устаревшие файлы', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ts-store-'));
  const store = new FileStore(dir);
  await store.save(sampleRoom('AAAAA'));
  await store.save(sampleRoom('BBBBB'));
  await writeFile(path.join(dir, 'BROKEN.json'), '{не json');
  await store.save({ ...sampleRoom('OLDOO'), savedAt: Date.now() - 4 * 24 * 3600 * 1000 });
  assert.deepEqual((await store.loadAll()).map((r) => r.code).sort(), ['AAAAA', 'BBBBB']);
  await store.remove('AAAAA');
  assert.deepEqual((await store.loadAll()).map((r) => r.code), ['BBBBB']);
  assert.ok(!(await readdir(dir)).some((n) => n.endsWith('.tmp')), 'временных файлов не остаётся');
});

test('Redis-хранилище работает через REST (проверка на фиктивном сервере)', async () => {
  const data = new Map<string, string>();
  const calls: string[][] = [];
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      assert.equal(req.headers.authorization, 'Bearer secret-token');
      const cmd = JSON.parse(body) as string[];
      calls.push(cmd);
      let result: unknown = 'OK';
      if (cmd[0] === 'GET') result = data.get(cmd[1]) ?? null;
      if (cmd[0] === 'SET') data.set(cmd[1], cmd[2]);
      if (cmd[0] === 'DEL') data.delete(cmd[1]);
      if (cmd[0] === 'SCAN') result = ['0', [...data.keys()]];
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ result }));
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  const store = new RedisStore(url, 'secret-token');
  const room = sampleRoom('RRRRR');
  await store.save(room);
  assert.ok(calls.some((c) => c[0] === 'SET' && c[1] === 'ts:room:RRRRR' && c.includes('EX')), 'ключ сохраняется со сроком хранения');
  assert.deepEqual((await store.loadAll())[0], JSON.parse(JSON.stringify(room)));
  await store.remove('RRRRR');
  assert.equal((await store.loadAll()).length, 0);
  srv.close();
});

test('выбор хранилища по настройкам окружения', () => {
  assert.equal(createStore({ SAVE: 'off' } as NodeJS.ProcessEnv).kind, 'off');
  assert.equal(createStore({ UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' } as NodeJS.ProcessEnv).kind, 'redis');
  assert.equal(createStore({ RENDER: 'true' } as NodeJS.ProcessEnv).kind, 'off', 'на Render без базы — не притворяемся, что сохраняем');
  assert.equal(createStore({} as NodeJS.ProcessEnv).kind, 'file');
});
