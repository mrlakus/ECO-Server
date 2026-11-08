import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomInt } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { applyAction, createGame, optionsFor } from '../shared/engine';
import { chooseAction } from '../shared/bot';
import type { Action, GameState } from '../shared/types';
import { MAX_PLAYERS, MIN_PLAYERS } from '../shared/data';
import { DECLINE_COOLDOWN_MS, VOTE_TIMEOUT_MS, waitingFor } from './vote';

// Папка public: рядом с исходниками (src/server → ../../public) или рядом с собранным файлом (dist → ../public)
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = [path.resolve(HERE, '../../public'), path.resolve(HERE, '../public')].find((d) => existsSync(path.join(d, 'index.html'))) ?? path.resolve(HERE, '../../public');
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
  vote?: { by: string; yes: Set<string>; timer: NodeJS.Timeout };
  lastDecline: Record<string, number>;
  closed?: boolean;
  overLogged?: boolean;
}
const rooms = new Map<string, Room>();

// ---------- Журнал сервера (виден в Render → Logs) ----------
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
export const slog = (msg: string) => console.log(`[${stamp()}] ${msg}`);
function deleteRoom(room: Room, why: string) {
  if (!rooms.delete(room.code)) return;
  slog(`комната ${room.code} закрыта: ${why}`);
}

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
    vote: room.vote ? { by: room.vote.by, byName: nameOf(room, room.vote.by), waiting: waitingIds(room) } : null,
    members: room.members.map((m) => ({ id: m.id, name: m.name, connected: !!m.bot || !!m.socket, bot: !!m.bot })),
  };
}

function broadcast(room: Room) {
  room.touched = Date.now();
  if (room.game?.phase === 'over' && !room.overLogged) {
    room.overLogged = true;
    const g = room.game;
    const table = g.players.map((p, i) => `${p.name} ${g.scores?.[i]?.total ?? '?'}`).join(', ');
    slog(`комната ${room.code}: партия окончена — победитель: ${g.winners.map((id) => g.players.find((p) => p.id === id)?.name).join(' и ')}; счёт: ${table}`);
  }
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
const nameOf = (room: Room, id: string) => room.members.find((m) => m.id === id)?.name ?? '';

function gameLog(room: Room, msg: string) {
  if (!room.game) return;
  room.game.log.push(msg);
  if (room.game.log.length > 80) room.game.log.splice(0, room.game.log.length - 80);
}

// ----- Голосование «закончить игру» -----
function waitingIds(room: Room): string[] {
  if (!room.vote) return [];
  return waitingFor(room.vote.yes, room.vote.by, humans(room).map((m) => ({ id: m.id, online: !!m.socket })));
}
function clearVote(room: Room) {
  if (room.vote) clearTimeout(room.vote.timer);
  room.vote = undefined;
}
/** Все ли согласны? Если да — закрываем стол и отправляем всех в меню. */
function checkVote(room: Room) {
  if (!room.vote || waitingIds(room).length > 0) return;
  gameLog(room, '🏁 Игра закончена досрочно: все согласны');
  clearVote(room);
  if (room.botTimer) clearTimeout(room.botTimer);
  room.botTimer = undefined;
  room.closed = true;
  broadcast(room); // последняя запись журнала успевает уйти клиентам
  for (const m of room.members) {
    send(m.socket, { type: 'ended', message: 'Игра закончена досрочно: все игроки согласились' });
  }
  slog(`комната ${room.code}: партия закончена досрочно по согласию всех`);
  deleteRoom(room, 'партия закончена досрочно');
}
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
  if (conn.room?.closed && msg.type !== 'ping' && msg.type !== 'create' && msg.type !== 'join') return err('Стол закрыт');

  switch (msg.type) {
    case 'create': {
      const name = cleanName(msg.name);
      if (!name) return err('Введите имя');
      const member: Member = { id: newId(), token: randomBytes(16).toString('hex'), name, socket: null };
      const room: Room = { code: newCode(), hostId: member.id, members: [member], game: null, touched: Date.now(), lastDecline: {} };
      rooms.set(room.code, room);
      slog(`комната ${room.code} создана: хозяин «${name}»`);
      attach(ws, conn, room, member);
      return;
    }
    case 'join': {
      const room = rooms.get(String(msg.code ?? '').toUpperCase().trim());
      if (!room) return err('Комната не найдена');
      // Переподключение по токену
      const existing = room.members.find((m) => m.token === msg.token);
      if (existing) {
        slog(`комната ${room.code}: «${existing.name}» вернулся (переподключение)`);
        return attach(ws, conn, room, existing);
      }
      if (room.game) return err('Игра уже началась');
      if (room.members.length >= MAX_PLAYERS) return err('Комната заполнена');
      const name = cleanName(msg.name);
      if (!name) return err('Введите имя');
      if (room.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return err('Такое имя уже занято в комнате');
      const member: Member = { id: newId(), token: randomBytes(16).toString('hex'), name, socket: null };
      room.members.push(member);
      slog(`комната ${room.code}: «${name}» вошёл (игроков: ${room.members.length})`);
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
      slog(`комната ${room.code}: партия началась — люди: ${humans(room).map((m) => `«${m.name}»`).join(', ')}; ботов: ${room.members.filter((m) => m.bot).length}`);
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
    case 'batch': {
      // Весь ход, спланированный на клиенте: применяем действия по порядку (так же, как если бы они приходили по одному).
      const { room, member } = conn;
      if (!room || !member || !room.game) return err('Игра не идёт');
      const list: unknown[] = Array.isArray(msg.actions) ? msg.actions.slice(0, 60) : [];
      let failed: string | null = null;
      for (const a of list) {
        const res = applyAction(room.game, member.id, a as Action, rng);
        if (!res.ok) {
          failed = res.error;
          break;
        }
      }
      if (failed) err(`Не удалось применить ход целиком: ${failed}`);
      broadcast(room);
      return;
    }
    case 'proposeend': {
      const { room, member } = conn;
      if (!room || !member || !room.game) return err('Игра не идёт');
      if (room.game.phase === 'over') return err('Партия уже окончена');
      if (room.vote) return err('Голосование уже идёт');
      const wait = (room.lastDecline[member.id] ?? 0) + DECLINE_COOLDOWN_MS - Date.now();
      if (wait > 0) return err(`Подождите ${Math.ceil(wait / 1000)} с перед новым предложением`);
      room.vote = {
        by: member.id,
        yes: new Set(),
        timer: setTimeout(() => {
          if (!room.vote || room.closed) return;
          gameLog(room, '⏱ Время на голосование вышло — игра продолжается');
          clearVote(room);
          broadcast(room);
        }, VOTE_TIMEOUT_MS),
      };
      room.vote.timer.unref();
      gameLog(room, `🏳 ${member.name} предлагает закончить игру`);
      for (const b of room.members.filter((m) => m.bot)) gameLog(room, `✔ ${b.name}: согласие закончить игру`);
      if (waitingIds(room).length) broadcast(room);
      else checkVote(room);
      return;
    }
    case 'voteend': {
      const { room, member } = conn;
      if (!room || !member || !room.game || !room.vote) return err('Сейчас нет голосования');
      if (member.id === room.vote.by) return;
      if (msg.yes === true) {
        room.vote.yes.add(member.id);
        gameLog(room, `✔ ${member.name}: согласие закончить игру`);
        if (waitingIds(room).length) broadcast(room);
        else checkVote(room);
      } else {
        gameLog(room, `✖ ${member.name}: отказ — игра продолжается`);
        room.lastDecline[room.vote.by] = Date.now();
        clearVote(room);
        broadcast(room);
      }
      return;
    }
    case 'cancelend': {
      const { room, member } = conn;
      if (!room || !member || !room.vote || room.vote.by !== member.id) return;
      gameLog(room, `↩ Предложение закончить игру отозвано (${member.name}) — игра продолжается`);
      clearVote(room);
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
      slog(`комната ${room.code}: «${member.name}» вышел`);
      if (!room.game) {
        room.members = room.members.filter((m) => m !== member);
        if (room.hostId === member.id && humans(room).length) room.hostId = humans(room)[0].id;
        if (!humans(room).length) deleteRoom(room, 'все вышли');
        else broadcast(room);
      } else {
        member.socket = null;
        broadcast(room);
        checkVote(room);
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
      slog(`комната ${room.code}: «${member.name}» отключился`);
      // В лобби отключившийся игрок остаётся 2 минуты на переподключение
      if (!room.game) {
        setTimeout(() => {
          if (member.socket || !rooms.has(room.code) || room.game) return;
          room.members = room.members.filter((m) => m !== member);
          if (room.hostId === member.id && humans(room).length) room.hostId = humans(room)[0].id;
          if (!humans(room).length) deleteRoom(room, 'игроки не вернулись');
          else broadcast(room);
        }, 120000).unref();
      }
      broadcast(room);
      checkVote(room);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of [...rooms.values()]) if (now - room.touched > ROOM_TTL_MS && room.members.every((m) => !m.socket)) deleteRoom(room, 'долго без активности');
}, 10 * 60 * 1000).unref();

// Раз в 5 минут — сводка: сколько комнат и игроков сейчас
setInterval(() => {
  if (!rooms.size) return;
  let online = 0;
  let playing = 0;
  for (const r of rooms.values()) {
    online += r.members.filter((m) => !m.bot && m.socket).length;
    if (r.game && r.game.phase !== 'over') playing++;
  }
  slog(`сводка: комнат ${rooms.size} (в игре ${playing}), людей онлайн ${online}`);
}, 5 * 60 * 1000).unref();

server.listen(PORT, '0.0.0.0', () => slog(`Три сестры: сервер запущен, порт ${PORT}`));
