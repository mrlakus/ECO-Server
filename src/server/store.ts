// Хранилище партий: комнаты переживают перезапуск сервера.
// Режимы: Upstash Redis (переменные UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN — работает на бесплатном Render),
// файл (папка DATA_DIR, по умолчанию ./data — для запуска на своём компьютере) или выключено (SAVE=off).

import { mkdir, readFile, rename, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { GameState } from '../shared/types';

export interface SavedMember {
  id: string;
  token: string;
  name: string;
  bot?: boolean;
  avatar?: string;
  color?: string;
}
export interface SavedRoom {
  v: 1;
  code: string;
  hostId: string;
  members: SavedMember[];
  game: GameState | null;
  pw?: { salt: string; hash: string };
  chat: unknown[];
  chatSeq: number;
  savedAt: number;
}

export interface Store {
  readonly kind: 'redis' | 'file' | 'off';
  save(room: SavedRoom): Promise<void>;
  remove(code: string): Promise<void>;
  loadAll(): Promise<SavedRoom[]>;
}

const TTL_SEC = 3 * 24 * 3600; // партия хранится 3 дня после последнего хода
const KEY = (code: string) => `ts:room:${code}`;

class OffStore implements Store {
  readonly kind = 'off' as const;
  async save() {}
  async remove() {}
  async loadAll() {
    return [];
  }
}

class FileStore implements Store {
  readonly kind = 'file' as const;
  constructor(private dir: string) {}
  private file(code: string) {
    return path.join(this.dir, `${code}.json`);
  }
  async save(room: SavedRoom) {
    await mkdir(this.dir, { recursive: true });
    const tmp = this.file(room.code) + '.tmp';
    await writeFile(tmp, JSON.stringify(room));
    await rename(tmp, this.file(room.code)); // атомарно: файл не бывает наполовину записанным
  }
  async remove(code: string) {
    await unlink(this.file(code)).catch(() => {});
  }
  async loadAll() {
    const out: SavedRoom[] = [];
    let names: string[] = [];
    try {
      names = await readdir(this.dir);
    } catch {
      return out;
    }
    for (const n of names.filter((x) => x.endsWith('.json'))) {
      try {
        const r = JSON.parse(await readFile(path.join(this.dir, n), 'utf8')) as SavedRoom;
        if (r.v === 1 && Date.now() - r.savedAt < TTL_SEC * 1000) out.push(r);
        else await unlink(path.join(this.dir, n)).catch(() => {});
      } catch {
        /* повреждённый файл пропускаем */
      }
    }
    return out;
  }
}

/** Upstash Redis через REST (обычный HTTPS, без дополнительных пакетов). */
class RedisStore implements Store {
  readonly kind = 'redis' as const;
  constructor(
    private url: string,
    private token: string,
  ) {}
  private async cmd(args: (string | number)[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
    const j = (await res.json()) as { result?: unknown; error?: string };
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  async save(room: SavedRoom) {
    await this.cmd(['SET', KEY(room.code), JSON.stringify(room), 'EX', TTL_SEC]);
  }
  async remove(code: string) {
    await this.cmd(['DEL', KEY(code)]);
  }
  async loadAll() {
    const out: SavedRoom[] = [];
    let cursor = '0';
    do {
      const r = (await this.cmd(['SCAN', cursor, 'MATCH', 'ts:room:*', 'COUNT', 100])) as [string, string[]];
      cursor = r[0];
      for (const key of r[1]) {
        const raw = (await this.cmd(['GET', key])) as string | null;
        if (!raw) continue;
        try {
          const room = JSON.parse(raw) as SavedRoom;
          if (room.v === 1) out.push(room);
        } catch {
          /* пропускаем повреждённую запись */
        }
      }
    } while (cursor !== '0');
    return out;
  }
}

export function createStore(env: NodeJS.ProcessEnv = process.env): Store {
  if (env.SAVE === 'off') return new OffStore();
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) return new RedisStore(env.UPSTASH_REDIS_REST_URL.replace(/\/$/, ''), env.UPSTASH_REDIS_REST_TOKEN);
  if (env.RENDER && !env.DATA_DIR) return new OffStore(); // на Render без базы файлы всё равно пропадают при перезапуске
  return new FileStore(env.DATA_DIR ?? path.resolve(process.cwd(), 'data'));
}
export { FileStore, RedisStore, OffStore };
