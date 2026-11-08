import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/shared/version';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const doc = readFileSync(new URL('../ВЕРСИИ.md', import.meta.url), 'utf8');

test('номер версии в формате 1.0 … 1.9, 2.0 … (одна цифра после точки)', () => {
  assert.match(VERSION, /^\d+\.\d$/);
});

test('версия совпадает в коде, package.json и таблице ВЕРСИИ.md', () => {
  assert.equal(pkg.version, `${VERSION}.0`);
  assert.ok(doc.includes(`| ${VERSION} |`), `в ВЕРСИИ.md нет строки версии ${VERSION}`);
});

test('таблица версий идёт подряд без пропусков (+0.1, после x.9 — следующая целая)', () => {
  const rows = [...doc.matchAll(/^\| (\d+)\.(\d) \|/gm)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(rows.length >= 2);
  for (let i = 1; i < rows.length; i++) {
    const [ma, mi] = rows[i - 1];
    const next = mi === 9 ? [ma + 1, 0] : [ma, mi + 1];
    assert.deepEqual(rows[i], next, `после ${ma}.${mi} должна идти ${next.join('.')}`);
  }
  const last = rows[rows.length - 1];
  assert.equal(`${last[0]}.${last[1]}`, VERSION);
});
