import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomInt } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { applyAction, createGame, optionsFor } from '../shared/engine';
import { chooseAction } from '../shared/bot';
import type { Action, GameState } from '../shared/types';
import { MAX_PLAYERS, MIN_PLAYERS } from '../shared/data';

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const PORT = Number(process.env.PORT ?? 3000);
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

interface Member {
  id: string; // публичный id (виден всем)
  token: string; // секрет для переподключения
  name: string;
  socket: WebSocket | null;
  bot?: boolean;
}
interface Room {
  code: string;
  hostId: string;
  members: Member[];
  game: GameState | null;
  touched: number;
  botTimer?: NodeJS.Timeout;
}
const rooms = new Map<string, Room>();

const rng = () => randomInt(0, 2 ** 30) / 2 ** 30;
const newId = () => randomBytes(4).toString('hex');
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(): string {
  for (;;) {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[randomInt(CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}

// ---------------------------------------------------------------------------
// Рассылка
// ---------------------------------------------------------------------------

function send(ws: WebSocket | null, msg: unknown) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function publicRoom(room: Room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: !!room.game,
    members: room.members.map((m) => ({ id: m.id, name: m.name, connected: !!m.bot || !!m.socket, bot: !!m.bot })),
  };
}

function broadcast(room: Room) {
  room.touched = Date.now();
  const pub = publicRoom(room);
  for (const m of room.members) {
    if (!m.socket) continue;
    const msg: Record<string, unknown> = { type: 'update', room: pub, you: m.id };
    if (room.game) {
      msg.state = room.game;
      msg.options = optionsFor(room.game, m.id);
    }
    send(m.socket, msg);
  }
  scheduleBots(room);
}

const humans = (room: Room) => room.members.filter((m) => !m.bot);
const BOT_DELAY_MS = 1100;

/** Боты ходят по одному действию с небольшой паузой, чтобы человек успевал следить за игрой. */
function scheduleBots(room: Room) {
  const game = room.game;
  if (!game || game.phase === 'over' || room.botTimer) return;
  if (!room.members.some((m) => !m.bot && m.socket)) return; // нет людей онлайн — боты ждут
  const bots = room.members.filter((m) => m.bot);
  const busy = (id: string) => !['wait', 'over', 'rain'].includes(optionsFor(game, id).kind);
  if (!bots.some((b) => busy(b.id))) return;
  room.botTimer = setTimeout(() => {
    room.botTimer = undefined;
    const g = room.game;
    if (!g || g.phase === 'over') return;
    for (const b of bots) {
      if (!busy(b.id)) continue;
      const action = chooseAction(g, b.id, rng);
      if (!action) continue;
      if (!applyAction(g, b.id, action, rng).ok) applyAction(g, b.id, { t: 'skip' }, rng);
      break;
    }
    broadcast(room);
  }, BOT_DELAY_MS);
  room.botTimer.unref();
}

// ---------------------------------------------------------------------------
// Обработка сообщений
// ---------------------------------------------------------------------------

interface Conn {
  room: Room | null;
  member: Member | null;
}

const cleanName = (v: unknown) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, 20);

function attach(ws: WebSocket, conn: Conn, room: Room, member: Member) {
  if (member.socket && member.socket !== ws) {
    send(member.socket, { type: 'error', message: 'Вы подключились с другого устройства' });
    member.socket.close();
  }
  member.socket = ws;
  conn.room = room;
  conn.member = member;
  send(ws, { type: 'joined', code: room.code, you: member.id, token: member.token });
  broadcast(room);
}

function handle(ws: WebSocket, conn: Conn, raw: string) {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (!msg || typeof msg.type !== 'string') return;
  const err = (message: string) => send(ws, { type: 'error', message });

  switch (msg.type) {
    case 'create': {
      const name = cleanName(msg.name);
      if (!name) return err('Введите имя');
      const member: Member = { id: newId(), token: randomBytes(16).toString('hex'), name, socket: null };
      const room: Room = { code: newCode(), hostId: member.id, members: [member], game: null, touched: Date.now() };
      rooms.set(room.code, room);
      attach(ws, conn, room, member);
      return;
    }
    case 'join': {
      const room = rooms.get(String(msg.code ?? '').toUpperCase().trim());
      if (!room) return err('Комната не найдена');
      // Переподключение по токену
      const existing = room.members.find((m) => m.token === msg.token);
      if (existing) return attach(ws, conn, room, existing);
      if (room.game) return err('Игра уже началась');
      if (room.members.length >= MAX_PLAYERS) return err('Комната заполнена');
      const name = cleanName(msg.name);
      if (!name) return err('Введите имя');
      if (room.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return err('Такое имя уже занято в комнате');
      const member: Member = { id: newId(), token: randomBytes(16).toString('hex'), name, socket: null };
      room.members.push(member);
      attach(ws, conn, room, member);
      return;
    }
    case 'start': {
      const { room, member } = conn;
      if (!room || !member) return err('Вы не в комнате');
      if (room.hostId !== member.id) return err('Начать игру может только создатель комнаты');
      if (room.game) return err('Игра уже идёт');
      if (room.members.length < MIN_PLAYERS) return err(`Нужно минимум ${MIN_PLAYERS} игрока`);
      const first = randomInt(room.members.length);
      room.game = createGame(
        room.members.map((m) => ({ id: m.id, name: m.name })),
        rng,
        first,
      );
      broadcast(room);
      return;
    }
    case 'action': {
      const { room, member } = conn;
      if (!room || !member || !room.game) return err('Игра не идёт');
      const res = applyAction(room.game, member.id, msg.action as Action, rng);
      if (!res.ok) return err(res.error);
      broadcast(room);
      return;
    }
    case 'addbot': {
      const { room, member } = conn;
      if (!room || !member) return err('Вы не в комнате');
      if (room.hostId !== member.id) return err('Только создатель комнаты');
      if (room.game) return err('Игра уже идёт');
      if (room.members.length >= MAX_PLAYERS) return err('Комната заполнена');
      const nBots = room.members.filter((m) => m.bot).length;
      room.members.push({ id: newId(), token: randomBytes(16).toString('hex'), name: nBots ? `🤖 Бот ${nBots + 1}` : '🤖 Бот', socket: null, bot: true });
      broadcast(room);
      return;
    }
    case 'removebot': {
      const { room, member } = conn;
      if (!room || !member) return;
      if (room.hostId !== member.id) return err('Только создатель комнаты');
      if (room.game) return err('Игра уже идёт');
      room.members = room.members.filter((m) => !(m.bot && m.id === msg.id));
      broadcast(room);
      return;
    }
    case 'restart': {
      const { room, member } = conn;
      if (!room || !member) return;
      if (room.hostId !== member.id) return err('Только создатель комнаты');
      if (!room.game || room.game.phase !== 'over') return err('Партия ещё не окончена');
      room.game = null;
      if (room.botTimer) clearTimeout(room.botTimer);
      room.botTimer = undefined;
      broadcast(room);
      return;
    }
    case 'leave': {
      const { room, member } = conn;
      if (!room || !member) return;
      if (!room.game) {
        room.members = room.members.filter((m) => m !== member);
        if (room.hostId === member.id && humans(room).length) room.hostId = humans(room)[0].id;
        if (!humans(room).length) rooms.delete(room.code);
        else broadcast(room);
      } else {
        member.socket = null;
        broadcast(room);
      }
      conn.room = null;
      conn.member = null;
      send(ws, { type: 'left' });
      return;
    }
    case 'ping':
      send(ws, { type: 'pong' });
      return;
  }
}

// ---------------------------------------------------------------------------
// HTTP (статика) и WebSocket
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.join(PUBLIC_DIR, path.normalize(rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Не найдено');
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', (ws) => {
  const conn: Conn = { room: null, member: null };
  let alive = true;
  ws.on('pong', () => (alive = true));
  const beat = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, 25000);
  ws.on('message', (data) => {
    try {
      handle(ws, conn, data.toString());
    } catch (e) {
      console.error('Ошибка обработки сообщения', e);
      send(ws, { type: 'error', message: 'Внутренняя ошибка сервера' });
    }
  });
  ws.on('close', () => {
    clearInterval(beat);
    const { room, member } = conn;
    if (room && member && member.socket === ws) {
      member.socket = null;
      // В лобби отключившийся игрок остаётся 2 минуты на переподключение
      if (!room.game) {
        setTimeout(() => {
          if (member.socket || !rooms.has(room.code) || room.game) return;
          room.members = room.members.filter((m) => m !== member);
          if (room.hostId === member.id && humans(room).length) room.hostId = humans(room)[0].id;
          if (!humans(room).length) rooms.delete(room.code);
          else broadcast(room);
        }, 120000).unref();
      }
      broadcast(room);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.touched > ROOM_TTL_MS && room.members.every((m) => !m.socket)) rooms.delete(code);
}, 10 * 60 * 1000).unref();

server.listen(PORT, '0.0.0.0', () => console.log(`Три сестры: http://localhost:${PORT}`));
