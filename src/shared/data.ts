// Статические данные планшета игрока «Три сестры» (обычная версия, без дополнения «Погода»).
// Все числа сняты с листа игрока и правил; менять их нужно только здесь.

export const BEDS = 6;
export const ROUNDS = 8;
export const GOODS_MAX = 120;
export const COMPOST_MAX = 40;

// ---------- Огород ----------

/** Сколько пар «кукуруза + фасоль» на каждой грядке (индекс 0 = грядка 1). */
export const UNITS_PER_BED = [3, 5, 4, 3, 5, 4];
export const CORN_CELLS = 4;
export const BEAN_CELLS = 2;

export const UNIT_BED: number[] = UNITS_PER_BED.flatMap((n, bed) => Array<number>(n).fill(bed + 1));
export const UNIT_COUNT = UNIT_BED.length; // 24

// Многолетники: порядок столбцов на планшете
export const PERENNIALS = ['tulip', 'hydrangea', 'iris', 'hyacinth', 'crocus', 'narcissus'] as const;
export type Perennial = (typeof PERENNIALS)[number];
export const PERENNIAL_NAMES: Record<Perennial, string> = {
  tulip: 'Тюльпан',
  hydrangea: 'Гортензия',
  iris: 'Ирис',
  hyacinth: 'Гиацинт',
  crocus: 'Крокус',
  narcissus: 'Нарцисс',
};
export const PERENNIAL_CELLS = 6;
/** ПО за заполненный столбец (у тюльпана — особое правило, 0 здесь). */
export const PERENNIAL_END_VP: Record<Perennial, number> = {
  tulip: 0,
  hydrangea: 7,
  iris: 12,
  hyacinth: 10,
  crocus: 6,
  narcissus: 4,
};
export const TULIP_VP_CAP = 15;

/** Тыквы по кругу: грядка, число клеток, товары за сбор. Порядок — по кругу огорода. */
export interface PumpkinDef {
  bed: number;
  cells: number;
  goods: number;
}
export const PUMPKINS: PumpkinDef[] = [
  { bed: 1, cells: 1, goods: 1 },
  { bed: 1, cells: 3, goods: 2 },
  { bed: 1, cells: 4, goods: 3 },
  { bed: 6, cells: 3, goods: 2 },
  { bed: 6, cells: 4, goods: 3 },
  { bed: 5, cells: 2, goods: 1 },
  { bed: 4, cells: 1, goods: 1 },
  { bed: 4, cells: 3, goods: 3 },
  { bed: 4, cells: 4, goods: 3 },
  { bed: 3, cells: 3, goods: 2 },
  { bed: 3, cells: 2, goods: 1 },
  { bed: 2, cells: 4, goods: 3 },
];
/**
 * Символ многолетника между тыквой i и тыквой (i+1) % 12.
 * Каждый многолетник встречается по два раза.
 */
export const PUMPKIN_SYMBOLS: Perennial[] = [
  'hydrangea',
  'crocus',
  'narcissus',
  'hyacinth',
  'tulip',
  'hydrangea',
  'crocus',
  'narcissus',
  'iris',
  'hyacinth',
  'tulip',
  'iris',
];

// ---------- Пасека ----------

export type CellKind = 's' | 'c'; // s = квадрат (без эффекта), c = круг (сбор / эффект)

export const APIARY_MAIN: { kind: CellKind; bonusGarden: number }[] = [
  { kind: 's', bonusGarden: 0 },
  { kind: 'c', bonusGarden: 1 },
  { kind: 's', bonusGarden: 0 },
  { kind: 'c', bonusGarden: 2 },
  { kind: 's', bonusGarden: 0 },
];
/** Воск: снизу вверх. */
export const APIARY_WAX: { kind: CellKind; goods: number; vp: number }[] = [
  { kind: 'c', goods: 2, vp: 2 },
  { kind: 'c', goods: 4, vp: 2 },
  { kind: 's', goods: 0, vp: 0 },
  { kind: 'c', goods: 4, vp: 5 },
];
/** Мёд: снизу вверх. */
export const APIARY_HONEY: { kind: CellKind; vp: number }[] = [
  { kind: 'c', vp: 5 },
  { kind: 'c', vp: 5 },
  { kind: 's', vp: 0 },
  { kind: 'c', vp: 8 },
];
/** Деление семьи: снизу вверх. */
export type HiveEffect = 'vp3' | 'plant' | 'garden3' | 'two-actions';
export const APIARY_HIVE2: HiveEffect[] = ['vp3', 'plant', 'garden3', 'two-actions'];
export const HIVE2_VP = 3;

// ---------- Сад ----------

export const GARDEN_ROWS = ['apple', 'peach', 'blackberry', 'raspberry'] as const;
export type GardenRow = (typeof GARDEN_ROWS)[number];
export const GARDEN_NAMES: Record<GardenRow, string> = {
  apple: 'Яблоки',
  peach: 'Персики',
  blackberry: 'Ежевика',
  raspberry: 'Малина',
};
/** Клетки рядов слева направо. */
export const GARDEN_CELLS: Record<GardenRow, CellKind[]> = {
  apple: ['s', 'c', 's', 'c', 'c', 'c', 'c', 'c'],
  peach: ['s', 'c', 's', 'c', 's', 'c', 's', 'c'],
  blackberry: ['c', 'c', 'c', 'c', 'c', 'c', 'c'],
  raspberry: ['c', 'c', 'c', 'c', 'c', 'c', 'c', 'c', 'c'],
};
export const APPLE_VP = 3;
export const BLACKBERRY_VP = 2;
export const RASPBERRY_GOODS = 3;
/** ПО за 3-й, 6-й, 9-й сбор малины. */
export const RASPBERRY_VP_AT: Record<number, number> = { 3: 1, 6: 2, 9: 3 };

// ---------- Сарай ----------

export const BARN_ITEMS = [
  'preserves',
  'buffet',
  'shovel',
  'fruitbowl',
  'barrel',
  'casserole',
  'labels',
  'chisel',
  'pitchfork',
  'trimmer',
  'wheelbarrow',
  'mulch',
  'tractor',
  'carving',
  'seeder',
] as const;
export type BarnItem = (typeof BARN_ITEMS)[number];

export interface BarnDef {
  name: string;
  /** Клетки слева направо; последняя — круг (подготовка предмета). */
  cells: CellKind[];
  /** Фиксированные ПО. 0 — особый подсчёт или нет ПО. */
  vp: number;
  desc: string;
}
const sq = (n: number): CellKind[] => Array<CellKind>(n).fill('s');
export const BARN: Record<BarnItem, BarnDef> = {
  preserves: { name: 'Банки под закатку', cells: ['c'], vp: 1, desc: 'Сбор ежевики: +1 товар' },
  buffet: { name: 'Буфет', cells: [...sq(1), 'c'], vp: 3, desc: 'Сбор яблока/персика: +1 товар' },
  shovel: { name: 'Лопата', cells: [...sq(1), 'c'], vp: 1, desc: '3 компоста → 1 бонусное действие (много раз)' },
  fruitbowl: { name: 'Чаша с фруктами', cells: [...sq(2), 'c'], vp: 0, desc: '1/2/3/4 разных вида: 1/4/7/10 ПО' },
  barrel: { name: 'Дождевая бочка', cells: [...sq(1), 'c'], vp: 2, desc: 'После «Дождя»: +1 полив на любой грядке' },
  casserole: { name: 'Форма для запеканки', cells: [...sq(1), 'c'], vp: 0, desc: '1 ПО за каждые 2 фасоли' },
  labels: { name: 'Красивые этикетки', cells: [...sq(3), 'c'], vp: 2, desc: 'Фермерский рынок: +1 действие с многолетниками' },
  chisel: { name: 'Пасечная стамеска', cells: [...sq(2), 'c'], vp: 2, desc: 'Ячейка крокуса: +бонус на пасеке' },
  pitchfork: { name: 'Вилы', cells: ['c'], vp: 1, desc: 'Ячейка гортензии: +1 компост' },
  trimmer: { name: 'Мотокоса', cells: [...sq(2), 'c'], vp: 6, desc: 'Только ПО в конце игры' },
  wheelbarrow: { name: 'Тачка', cells: [...sq(1), 'c'], vp: 3, desc: 'После действия в сарае: +1 товар' },
  mulch: { name: 'Мульча', cells: ['c'], vp: 1, desc: 'Вместо действия клетки — действие с многолетниками' },
  tractor: { name: 'Новый трактор', cells: [...sq(5), 'c'], vp: 18, desc: 'Только ПО в конце игры' },
  carving: { name: 'Овощные резцы', cells: [...sq(2), 'c'], vp: 0, desc: '1 ПО за тыкву в самой длинной цепочке собранных тыкв' },
  seeder: { name: 'Сеялка', cells: [...sq(3), 'c'], vp: 2, desc: 'Посадка: до 3 культур вместо 2' },
};
export const FRUITBOWL_VP = [0, 1, 4, 7, 10];

// ---------- Игровое поле ----------

export type FieldCell = 'apiaryGardenGold' | 'plantWater' | 'barn' | 'compostGoods' | 'apiaryGarden' | 'barn2' | 'market';
/** Клетки поля по часовой стрелке; клетка 0 — со «золотой кнопкой» (стартовая для Эдит). */
export const FIELD: { id: FieldCell; name: string }[] = [
  { id: 'apiaryGardenGold', name: 'Пасека или сад' },
  { id: 'plantWater', name: 'Посадка или полив' },
  { id: 'barn', name: 'Сарай' },
  { id: 'compostGoods', name: '1 компост и 4 товара' },
  { id: 'apiaryGarden', name: 'Пасека или сад' },
  { id: 'barn2', name: 'Сарай' },
  { id: 'market', name: 'Фермерский рынок' },
];

export type EventType = 'barn' | 'rain' | 'market';
export const ROUND_EVENTS: EventType[] = ['barn', 'rain', 'market', 'rain', 'market', 'barn', 'market', 'rain'];
export const EVENT_NAMES: Record<EventType, string> = { barn: 'Сарай', rain: 'Дождь', market: 'Фермерский рынок' };

export const DICE_BY_PLAYERS: Record<number, number> = { 2: 4, 3: 5, 4: 6 };
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

// ---------- Фермерский рынок ----------

export interface MarketRow {
  min: number;
  compost: number;
  perennial: number;
  gardenBonus: number;
  anyBonus: number;
}
export const MARKET: MarketRow[] = [
  { min: 0, compost: 1, perennial: 0, gardenBonus: 0, anyBonus: 0 },
  { min: 4, compost: 1, perennial: 1, gardenBonus: 0, anyBonus: 0 },
  { min: 20, compost: 0, perennial: 1, gardenBonus: 1, anyBonus: 0 },
  { min: 35, compost: 1, perennial: 2, gardenBonus: 0, anyBonus: 0 },
  { min: 50, compost: 0, perennial: 2, gardenBonus: 1, anyBonus: 0 },
  { min: 70, compost: 0, perennial: 2, gardenBonus: 0, anyBonus: 1 },
];
