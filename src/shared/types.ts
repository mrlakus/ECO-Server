import type { BarnItem, FieldCell, GardenRow, Perennial } from './data';

export type Area = 'perennial' | 'apiary' | 'garden' | 'barn';
export const ALL_AREAS: Area[] = ['perennial', 'apiary', 'garden', 'barn'];

export type ApiaryCol = 'main' | 'wax' | 'honey' | 'hive2';

/** Один «бонус», который игрок может потратить в любом порядке с остальными из той же пачки. */
export interface Slot {
  areas: Area[];
  row?: GardenRow; // ограничение ряда сада
  label: string;
}

export type Task =
  | { k: 'turn'; die: number; cell: FieldCell; gardenLeft: number; cellLeft: boolean }
  | { k: 'act'; slots: Slot[] }
  | { k: 'field'; mode: 'plant' | 'water' | 'either'; label: string }
  | { k: 'rain'; next: number };

export interface PlayerState {
  id: string;
  name: string;
  corn: number[];
  beans: number[];
  pumpkins: number[];
  symbols: boolean[];
  perennial: number[]; // по PERENNIALS
  main: number;
  wax: number;
  honey: number;
  hive2: number;
  garden: Record<GardenRow, number>;
  barn: Record<BarnItem, number>;
  goods: number;
  compostGained: number;
  compostSpent: number;
  tasks: Task[];
}

export type Phase = 'pick' | 'final' | 'event' | 'over';

export interface Score {
  garden: number;
  perennials: number;
  apiary: number;
  orchard: number;
  barn: number;
  total: number;
}

export interface GameState {
  round: number;
  phase: Phase;
  players: PlayerState[];
  firstStart: number;
  first: number; // индекс первого игрока в этом раунде
  pickPos: number; // сколько игроков уже сходили в фазе садоводства
  pickTaken: boolean; // активный игрок уже взял кубик
  field: number[][]; // кубики на клетках поля (значения)
  edith: number; // клетка, где стоит Эдит
  finalDie: { cell: number; value: number } | null;
  log: string[];
  scores: Score[] | null;
  winners: string[];
}

export type Action =
  | { t: 'pick'; cell: number }
  | { t: 'plant'; bed: number; crops: string[] }
  | { t: 'water'; bed: number }
  | { t: 'cell' } // «1 компост и 4 товара» / «Фермерский рынок»
  | { t: 'act'; area: Area; target: string; slot?: number }
  | { t: 'shovel' }
  | { t: 'skip' };

export interface Target {
  area: Area;
  target: string;
  label: string;
}
export interface BedOption {
  bed: number;
  cost: number; // компост на сдвиг значения кубика
  crops?: string[]; // доступные для посадки
  max?: number;
  count?: number; // сколько культур польётся
}
export interface SlotView {
  label: string;
  areas: Area[];
  row?: GardenRow;
  targets: Target[];
}

/** Что игрок может сделать прямо сейчас (для подсветки в интерфейсе). */
export interface Options {
  kind: 'wait' | 'pick' | 'turn' | 'act' | 'field' | 'rain' | 'over';
  hint: string;
  pickCells?: number[];
  plant?: BedOption[];
  water?: BedOption[];
  die?: number;
  cellName?: string;
  cellKind?: 'auto' | 'act' | 'plantWater' | 'none';
  cellLeft?: boolean;
  cellTargets?: Target[];
  mulchTargets?: Target[];
  autoLabel?: string;
  slots?: SlotView[];
  canShovel: boolean;
  irisShift: number;
  compost: number;
}

export type { Perennial };
