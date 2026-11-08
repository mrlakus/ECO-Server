// Собственные иллюстрации растений (с этапами роста) и предметов сарая (SVG, нарисованы для этого проекта).

const svg = (vb: string, body: string, cls = 'pic') => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">${body}</svg>`;
const SOIL = '<ellipse cx="20" cy="44" rx="17.5" ry="4.5" fill="#7c5230"/><ellipse cx="20" cy="43" rx="14" ry="3" fill="#9a6a3c"/>';
const SEEDS = '<circle cx="15" cy="42.5" r="1.4" fill="#e3cd94"/><circle cx="21" cy="43.6" r="1.4" fill="#e3cd94"/><circle cx="26" cy="42.4" r="1.4" fill="#e3cd94"/>';

/** Лист: из точки (x,y) в сторону dir (−1 влево, 1 вправо), длина len. */
const leaf = (x: number, y: number, dir: number, len: number, c = '#62ad3a') =>
  `<path d="M${x} ${y}Q${x + dir * len * 0.55} ${y - len * 0.55} ${x + dir * len} ${y + len * 0.1}Q${x + dir * len * 0.4} ${y + len * 0.2} ${x} ${y}z" fill="${c}" stroke="#3d7a22" stroke-width=".8"/>`;

/** Кукуруза: этап 0–4 (число закрашенных клеток; 4 — урожай собран). */
export function cornPlant(stage: number): string {
  // пока ничего не посажено — бледный силуэт взрослого растения, чтобы было видно, что тут растёт
  if (stage <= 0) return svg('0 0 40 48', `${SOIL}<g opacity=".3">${cornBody(4)}</g>${SEEDS}`);
  return svg('0 0 40 48', SOIL + cornBody(stage));
}
function cornBody(stage: number): string {
  let b = '';
  const top = [0, 35, 26, 15, 6][Math.min(stage, 4)];
  b += `<path d="M20 43V${top}" stroke="#4f9a2e" stroke-width="3" stroke-linecap="round"/>`;
  const pairs = [0, 1, 2, 3, 4][Math.min(stage, 4)];
  for (let i = 0; i < pairs; i++) {
    const y = 40 - i * 7.2;
    b += leaf(20, y, -1, 9 + i * 0.8) + leaf(20, y - 3, 1, 9 + i * 0.8);
  }
  if (stage === 3) b += '<ellipse cx="26.5" cy="24" rx="3" ry="6" transform="rotate(14 26.5 24)" fill="#a9d57a" stroke="#4f8a2b" stroke-width=".9"/>';
  if (stage >= 4) {
    const ear = (x: number, y: number, r: number) =>
      `<g transform="rotate(${r} ${x} ${y})"><path d="M${x} ${y - 9}q5 4 4 11q-1 5-4 7q-3-2-4-7q-1-7 4-11z" fill="#f5c53a" stroke="#a87810" stroke-width="1"/><path d="M${x} ${y - 7}v14M${x - 2.4} ${y - 4}h4.8M${x - 2.6} ${y}h5.2M${x - 2.4} ${y + 4}h4.8" stroke="#c18f12" stroke-width=".7"/><path d="M${x - 5} ${y + 9}q5-7 10 0q-5 3-10 0z" fill="#6fae3f" stroke="#3d7a22" stroke-width=".8"/></g>`;
    b += ear(12.5, 23, -18) + ear(28, 18, 16);
    b += '<path d="M20 6l-5-5M20 6l0-6M20 6l5-5" stroke="#9a6a2a" stroke-width="1.4" stroke-linecap="round"/>';
  }
  return b;
}

/** Фасоль на опорах: этап 0–2 (2 — урожай собран). */
export function beanPlant(stage: number): string {
  if (stage <= 0) return svg('0 0 40 48', `${SOIL}<g opacity=".3">${beanBody(2)}</g>${SEEDS}`);
  return svg('0 0 40 48', SOIL + beanBody(stage));
}
function beanBody(stage: number): string {
  let b = '';
  const poles = '<path d="M9 44L13 6M31 44L27 6M10 14H30M9.5 28H30.5" stroke="#8a5a30" stroke-width="2.2" stroke-linecap="round"/>';
  b += poles;
  if (stage === 1) {
    b += '<path d="M11 43Q14 34 11 28" stroke="#4f9a2e" stroke-width="2.2" fill="none"/><path d="M29 43Q26 36 29 30" stroke="#4f9a2e" stroke-width="2.2" fill="none"/>';
    b += leaf(11, 36, -1, 6) + leaf(11, 31, 1, 6) + leaf(29, 38, 1, 6) + leaf(29, 33, -1, 6);
  } else {
    b += '<path d="M11 43Q16 30 12 6" stroke="#4f9a2e" stroke-width="2.4" fill="none"/><path d="M29 43Q24 30 28 6" stroke="#4f9a2e" stroke-width="2.4" fill="none"/>';
    for (let i = 0; i < 5; i++) {
      const y = 38 - i * 7;
      b += leaf(12 + i * 0.1, y, -1, 6.5) + leaf(12, y - 3, 1, 6.5) + leaf(28, y, 1, 6.5) + leaf(28, y - 3, -1, 6.5);
    }
    const pod = (x: number, y: number) => `<path d="M${x} ${y}q3 5 1 12q-2 2-3-1q-1-7 2-11z" fill="#86c94a" stroke="#3d7a22" stroke-width=".9"/>`;
    b += pod(15.5, 15) + pod(19, 22) + pod(24, 14) + pod(21.5, 30) + pod(16, 31);
  }
  return b;
}

/** Тыква: уровень 0–4 (4 — собрана: большая оранжевая тыква). */
const PSOIL = '<ellipse cx="24" cy="36" rx="21" ry="4.8" fill="#7c5230"/><ellipse cx="24" cy="35" rx="17" ry="3.2" fill="#9a6a3c"/>';
export function pumpkinPlant(level: number): string {
  if (level <= 0)
    return svg('0 0 48 44', `${PSOIL}<g opacity=".3">${pumpkinBody(4)}</g><circle cx="19" cy="34.5" r="1.4" fill="#e3cd94"/><circle cx="26" cy="35.5" r="1.4" fill="#e3cd94"/><circle cx="31" cy="34.4" r="1.4" fill="#e3cd94"/>`);
  return svg('0 0 48 44', PSOIL + pumpkinBody(level));
}
function pumpkinBody(level: number): string {
  let b = '';
  const vine = (len: number) => `<path d="M8 34Q16 ${28 - len * 0.3} 24 31T${24 + len} 29" stroke="#4f9a2e" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  if (level === 1) {
    b += '<path d="M24 35V28" stroke="#4f9a2e" stroke-width="2.4" stroke-linecap="round"/>' + leaf(24, 29, -1, 7) + leaf(24, 29, 1, 7);
  } else {
    b += vine(level === 2 ? 14 : 18) + leaf(14, 30, -1, 8) + leaf(36, 29, 1, 9) + leaf(22, 30, 1, 7);
    if (level === 2) b += '<g><path d="M30 24l-3-5 6-1z" fill="#ffd23a" stroke="#b8860b" stroke-width=".8"/><circle cx="30" cy="22" r="1.8" fill="#ffb300"/></g>';
  }
  if (level === 3) b += '<ellipse cx="24" cy="29" rx="7.5" ry="6" fill="#b9c85a" stroke="#6f8a24" stroke-width="1.1"/><path d="M24 23.5v-3" stroke="#4f8a2b" stroke-width="2"/>';
  if (level >= 4) {
    b += '<ellipse cx="24" cy="26" rx="14.5" ry="11" fill="#f28c28" stroke="#a5510c" stroke-width="1.3"/>';
    b += '<path d="M24 15.2c-5.5 3-5.5 19 0 21.6M24 15.2c5.5 3 5.5 19 0 21.6M15.5 17.5c-4 4-4 13 1.5 17.2M32.5 17.5c4 4 4 13-1.5 17.2" stroke="#c76c14" stroke-width="1.1" fill="none"/>';
    b += '<path d="M24 15.5c0-3 1.4-5 3.4-6.2" stroke="#4f8a2b" stroke-width="3" stroke-linecap="round" fill="none"/>' + leaf(29, 14, 1, 7);
  }
  return b;
}

// ---------------------------------------------------------------- Предметы сарая

const A = (s: string) => svg('0 0 48 48', s);
const stroke = '#4a3320';

export const BARN_PICS: Record<string, string> = {
  // Банки под закатку: две банки с вареньем
  preserves: A(
    `<g stroke="${stroke}" stroke-width="1.4"><rect x="5" y="16" width="17" height="26" rx="4" fill="#d6ecf7"/><rect x="5" y="25" width="17" height="17" rx="3" fill="#8a1f3d"/><rect x="4" y="11" width="19" height="6" rx="2" fill="#e8d7a0"/><rect x="8" y="30" width="11" height="8" rx="1" fill="#fff3d0"/>` +
      `<rect x="26" y="20" width="17" height="22" rx="4" fill="#d6ecf7"/><rect x="26" y="28" width="17" height="14" rx="3" fill="#6a2f8a"/><rect x="25" y="15" width="19" height="6" rx="2" fill="#e8d7a0"/><rect x="29" y="32" width="11" height="7" rx="1" fill="#fff3d0"/></g>` +
      '<path d="M7 17l9-3M28 22l9-3" stroke="#fff" stroke-width="1.4" opacity=".7"/>',
  ),
  // Буфет: голубой шкаф
  buffet: A(
    `<g stroke="${stroke}" stroke-width="1.4"><rect x="7" y="14" width="34" height="28" rx="2" fill="#4f92cf"/><rect x="5" y="10" width="38" height="6" rx="1.5" fill="#6aa9e0"/><rect x="10" y="19" width="12" height="19" rx="1" fill="#3e7bb5"/><rect x="26" y="19" width="12" height="19" rx="1" fill="#3e7bb5"/><circle cx="20" cy="29" r="1.4" fill="#f6d36a"/><circle cx="28" cy="29" r="1.4" fill="#f6d36a"/><rect x="9" y="42" width="5" height="4" fill="#3e5a7a"/><rect x="34" y="42" width="5" height="4" fill="#3e5a7a"/></g>` +
      '<ellipse cx="16" cy="8" rx="6" ry="1.8" fill="#f4f1ea" stroke="#8a97a0"/><rect x="27" y="3" width="7" height="7" rx="2" fill="#f2c24c" stroke="#a87810"/>',
  ),
  // Лопата
  shovel: A(
    `<path d="M24 4v26" stroke="#8a5a30" stroke-width="4" stroke-linecap="round"/><path d="M19 4h10" stroke="#6e4824" stroke-width="3.4" stroke-linecap="round"/><path d="M15 28h18l-2 14q-7 5-14 0z" fill="#9eaab2" stroke="#59646b" stroke-width="1.6"/><path d="M24 30v11" stroke="#d8e0e5" stroke-width="1.4"/>`,
  ),
  // Чаша с фруктами
  fruitbowl: A(
    `<path d="M5 24h38q-2 14-19 14T5 24z" fill="#c98a45" stroke="${stroke}" stroke-width="1.6"/><path d="M11 38h26v4H11z" fill="#a8713f" stroke="${stroke}" stroke-width="1.4"/>` +
      '<circle cx="15" cy="20" r="7" fill="#e0402f" stroke="#8d1d12" stroke-width="1.3"/><circle cx="28" cy="18" r="7" fill="#f2a43a" stroke="#a5610c" stroke-width="1.3"/><circle cx="35" cy="22" r="5.5" fill="#a64ac8" stroke="#5d2478" stroke-width="1.2"/><circle cx="22" cy="23" r="5" fill="#8fc84a" stroke="#4f7f1c" stroke-width="1.2"/>' +
      '<path d="M15 13c0-2 1-3 2.4-4M28 11c0-2 1-3 2.4-4" stroke="#4a6a1c" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  ),
  // Дождевая бочка
  barrel: A(
    `<g stroke="${stroke}" stroke-width="1.5"><path d="M10 14h28v28q-14 4-28 0z" fill="#9b6836"/><ellipse cx="24" cy="14" rx="14" ry="4.5" fill="#5aa8d8"/><path d="M10 22q14 4 28 0M10 33q14 4 28 0" fill="none" stroke="#5a381a" stroke-width="2.4"/></g>` +
      '<path d="M5 6h16l4 4" stroke="#6b7a85" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M35 4q-3 4 0 6q3-2 0-6zM42 8q-2.4 3.4 0 5q2.4-1.6 0-5z" fill="#5aa8d8"/>',
  ),
  // Форма для запеканки
  casserole: A(
    `<rect x="4" y="22" width="40" height="18" rx="5" fill="#d9503a" stroke="${stroke}" stroke-width="1.6"/><rect x="2" y="24" width="5" height="5" rx="2" fill="#b83a26" stroke="${stroke}"/><rect x="41" y="24" width="5" height="5" rx="2" fill="#b83a26" stroke="${stroke}"/>` +
      '<ellipse cx="24" cy="23" rx="19" ry="5" fill="#f3d9a0" stroke="#7a4a1e" stroke-width="1.2"/>' +
      '<g fill="#a63a28" stroke="#5a1f12" stroke-width=".7"><ellipse cx="14" cy="22" rx="3" ry="1.8"/><ellipse cx="22" cy="24" rx="3" ry="1.8"/><ellipse cx="30" cy="22" rx="3" ry="1.8"/><ellipse cx="36" cy="24.4" rx="2.6" ry="1.6"/></g>' +
      '<path d="M16 16q-3-4 0-8M24 15q-3-4 0-8M32 16q-3-4 0-8" stroke="#b9c2c8" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  ),
  // Красивые этикетки: баночка с биркой и бирки на верёвке
  labels: A(
    `<rect x="6" y="18" width="18" height="24" rx="4" fill="#d6ecf7" stroke="${stroke}" stroke-width="1.4"/><rect x="5" y="13" width="20" height="6" rx="2" fill="#e8d7a0" stroke="${stroke}" stroke-width="1.2"/><rect x="9" y="25" width="12" height="10" rx="1" fill="#fff3d0" stroke="#a8844f"/><path d="M11 29h8M11 32h6" stroke="#a8844f" stroke-width="1"/>` +
      `<path d="M28 6l16 6" stroke="#b83a26" stroke-width="1.6"/><g stroke="${stroke}" stroke-width="1.2"><path d="M31 9l8 3-1 14-9-1z" fill="#ffe08a"/><path d="M37 13l7 4-3 12-8-2z" fill="#ffb3c1"/></g><circle cx="32" cy="12" r="1" fill="${stroke}"/><circle cx="38.5" cy="16" r="1" fill="${stroke}"/>`,
  ),
  // Пасечная стамеска
  chisel: A(
    `<path d="M10 40L34 12" stroke="#59646b" stroke-width="5" stroke-linecap="round"/><path d="M10 40L34 12" stroke="#b9c4cb" stroke-width="2.6" stroke-linecap="round"/><path d="M34 12q6-6 10-2l-4 6z" fill="#9eaab2" stroke="#59646b" stroke-width="1.4"/><path d="M6 44l6-6" stroke="#c9503a" stroke-width="5" stroke-linecap="round"/>` +
      '<g transform="translate(30 34)"><ellipse cx="-3" cy="-4" rx="4" ry="2.6" fill="#e6f4ff" stroke="#8fb2c8" stroke-width=".6"/><ellipse cx="3" cy="-4" rx="4" ry="2.6" fill="#e6f4ff" stroke="#8fb2c8" stroke-width=".6"/><ellipse cx="0" cy="0" rx="6" ry="4" fill="#f6c935" stroke="#4a3300" stroke-width=".9"/><path d="M-1.8 -3.4v6.8M1.8 -3.4v6.8" stroke="#2a1d00" stroke-width="1.3"/></g>',
  ),
  // Вилы
  pitchfork: A(
    `<path d="M24 22v24" stroke="#8a5a30" stroke-width="4.4" stroke-linecap="round"/><path d="M11 6v12q0 7 13 7t13-7V6" stroke="#8a97a0" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 6v18" stroke="#8a97a0" stroke-width="3.6" stroke-linecap="round"/><path d="M11 6v12q0 7 13 7t13-7V6M24 6v18" stroke="#d3dce1" stroke-width="1.2" fill="none"/>`,
  ),
  // Мотокоса
  trimmer: A(
    `<path d="M40 8L12 36" stroke="#4a4f55" stroke-width="3.2" stroke-linecap="round"/><path d="M36 12l6 3" stroke="#4a4f55" stroke-width="3" stroke-linecap="round"/><rect x="5" y="30" width="14" height="12" rx="3" fill="#f08a2c" stroke="${stroke}" stroke-width="1.4"/><circle cx="12" cy="36" r="2" fill="#4a4f55"/>` +
      '<path d="M3 44q6-8 14-1" stroke="#9eaab2" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M3 44l3-4M8 42l1-5" stroke="#cdd6db" stroke-width="2" stroke-linecap="round"/>',
  ),
  // Тачка
  wheelbarrow: A(
    `<path d="M6 16h28l-5 18H12z" fill="#4faa4a" stroke="${stroke}" stroke-width="1.6"/><path d="M6 16h28" stroke="#2f7a2c" stroke-width="2.4"/><path d="M12 34l-6 8M30 34l6 8" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"/><path d="M34 18l10 6M30 26l14 4" stroke="#8a5a30" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="38" cy="38" r="6" fill="#4a4f55" stroke="${stroke}" stroke-width="1.4"/><circle cx="38" cy="38" r="2.2" fill="#b9c4cb"/>` +
      '<circle cx="16" cy="13" r="4.4" fill="#f28c28" stroke="#a5510c" stroke-width="1"/><circle cx="24" cy="12" r="4" fill="#e0402f" stroke="#8d1d12" stroke-width="1"/>',
  ),
  // Мульча: мешок соломы
  mulch: A(
    `<path d="M10 18q-2 12 0 24h28q2-12 0-24q-14-5-28 0z" fill="#c9a062" stroke="${stroke}" stroke-width="1.6"/><path d="M12 14q12-6 24 0l-2 6q-10-4-20 0z" fill="#b08a4c" stroke="${stroke}" stroke-width="1.4"/><rect x="16" y="26" width="16" height="10" rx="1.5" fill="#fff3d0" stroke="#7a5528" stroke-width="1"/><path d="M19 30h10M19 33h7" stroke="#7a5528"/>` +
      '<g stroke="#e8c963" stroke-width="1.6" stroke-linecap="round"><path d="M14 12l-5-6M20 10l-2-7M27 10l2-7M33 12l5-6M24 9v-6"/></g>',
  ),
  // Новый трактор
  tractor: A(
    `<rect x="14" y="14" width="20" height="14" rx="3" fill="#6fc04a" stroke="${stroke}" stroke-width="1.5"/><rect x="5" y="22" width="26" height="12" rx="3" fill="#7cd256" stroke="${stroke}" stroke-width="1.5"/><rect x="17" y="8" width="14" height="8" rx="2" fill="#d6ecf7" stroke="${stroke}" stroke-width="1.3"/><rect x="7" y="16" width="3" height="8" fill="#4a4f55"/>` +
      `<circle cx="13" cy="37" r="9" fill="#3a3f45" stroke="${stroke}" stroke-width="1.5"/><circle cx="13" cy="37" r="3.6" fill="#f2c24c"/><circle cx="37" cy="40" r="6" fill="#3a3f45" stroke="${stroke}" stroke-width="1.4"/><circle cx="37" cy="40" r="2.4" fill="#f2c24c"/>`,
  ),
  // Овощные резцы: резная тыква и нож
  carving: A(
    `<ellipse cx="22" cy="28" rx="16" ry="13" fill="#f28c28" stroke="#a5510c" stroke-width="1.6"/><path d="M22 15.5c-6 3-6 22 0 25M22 15.5c6 3 6 22 0 25" stroke="#c76c14" stroke-width="1.2" fill="none"/><path d="M22 15c0-3 1.4-5 3.4-6.2" stroke="#4f8a2b" stroke-width="3.2" stroke-linecap="round" fill="none"/>` +
      '<path d="M13 25l4 4-5 1zM31 25l-4 4 5 1z" fill="#4a2a0a"/><path d="M14 35q8 5 16 0l-3-3-3 2-2-2-2 2-3-2z" fill="#4a2a0a"/>' +
      '<path d="M38 42l8-18" stroke="#8a5a30" stroke-width="4" stroke-linecap="round"/><path d="M42 26l-9-8q-3 8 3 14z" fill="#b9c4cb" stroke="#59646b" stroke-width="1.2"/>',
  ),
  // Сеялка
  seeder: A(
    `<path d="M10 8h24l-5 18H15z" fill="#d9503a" stroke="${stroke}" stroke-width="1.6"/><path d="M10 8h24" stroke="#a83420" stroke-width="3"/><g fill="#f2d27a" stroke="#a88a24" stroke-width=".6"><ellipse cx="18" cy="12" rx="2" ry="1.2"/><ellipse cx="24" cy="14" rx="2" ry="1.2"/><ellipse cx="29" cy="11.6" rx="2" ry="1.2"/><ellipse cx="22" cy="9.8" rx="2" ry="1.2"/></g>` +
      `<path d="M22 26v10" stroke="#8a97a0" stroke-width="3"/><circle cx="22" cy="38" r="8" fill="none" stroke="${stroke}" stroke-width="3"/><path d="M22 30v16M14 38h16M16.5 32.5l11 11M27.5 32.5l-11 11" stroke="${stroke}" stroke-width="1.2"/>` +
      '<path d="M34 12l10 6M40 16l2 8" stroke="#8a5a30" stroke-width="3" stroke-linecap="round" fill="none"/><circle cx="14" cy="45" r="1.1" fill="#6b4a2a"/><circle cx="22" cy="46" r="1.1" fill="#6b4a2a"/><circle cx="30" cy="45" r="1.1" fill="#6b4a2a"/>',
  ),
};
