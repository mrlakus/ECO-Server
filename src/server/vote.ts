// Голосование «закончить игру досрочно».
// Боты всегда согласны. Предложивший игрок считается согласным. Отключившиеся люди не блокируют решение.

export interface Voter {
  id: string;
  online: boolean;
}

/** Кто из живых людей ещё не ответил. Пустой список — все согласны, можно заканчивать. */
export function waitingFor(votes: ReadonlySet<string>, proposer: string, humans: Voter[]): string[] {
  return humans.filter((h) => h.online && h.id !== proposer && !votes.has(h.id)).map((h) => h.id);
}

export const VOTE_TIMEOUT_MS = 60_000;
export const DECLINE_COOLDOWN_MS = 20_000;
