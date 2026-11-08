// Иллюстрации для клеток общего поля (рондели). Нарисованы для этого проекта (SVG).

const sc = (body: string) => `<svg class="scene" viewBox="0 0 160 110" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${body}</svg>`;

const grass = (y = 82) =>
  `<rect x="0" y="${y}" width="160" height="${110 - y}" fill="#8ccb63"/><path d="M0 ${y}q40-8 80 0t80 0V${y + 4}H0z" fill="#a4d97a"/>` +
  Array.from({ length: 16 }, (_, i) => `<path d="M${i * 10 + 4} ${y + 12 + (i % 3) * 5}l-2-6M${i * 10 + 4} ${y + 12 + (i % 3) * 5}l2-6" stroke="#5f9b3b" stroke-width="1.4" stroke-linecap="round"/>`).join('');

const sun = (x = 140, y = 18) =>
  `<circle cx="${x}" cy="${y}" r="9" fill="#ffe27a"/>` +
  Array.from({ length: 8 }, (_, i) => `<path d="M${x} ${y}l${(17 * Math.cos(i * 0.785)).toFixed(1)} ${(17 * Math.sin(i * 0.785)).toFixed(1)}" stroke="#ffe27a" stroke-width="2" stroke-linecap="round" opacity=".6"/>`).join('');

const sprout = (x: number, y: number, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0v-9" stroke="#4f9a2e" stroke-width="2" stroke-linecap="round"/><path d="M0 -8q-8 0-9-7q8 0 9 7zM0 -6q8 0 9-7q-8 0-9 7z" fill="#6fc04a" stroke="#3d7a22" stroke-width=".8"/></g>`;

/** Посадка или полив: фермерша с лейкой над грядкой с ростками. */
const plantWater = sc(
  '<rect width="160" height="110" fill="#d8eefb"/>' +
    sun() +
    '<path d="M0 62q40-14 80-4t80-6v60H0z" fill="#bcdf9c"/>' +
    grass(80) +
    '<rect x="0" y="82" width="160" height="28" fill="#8a5a30" opacity=".9"/>' +
    Array.from({ length: 4 }, (_, i) => `<rect x="0" y="${86 + i * 6}" width="160" height="2.4" fill="#6e4824" opacity=".55"/>`).join('') +
    [78, 94, 110, 126, 142].map((x, i) => sprout(x, 96 + (i % 2) * 5, 1.1)).join('') +
    // фермерша
    '<g transform="translate(34 24)"><ellipse cx="22" cy="14" rx="22" ry="6" fill="#e8b23c" stroke="#7a560e" stroke-width="1.6"/><path d="M8 13c0-12 6-18 14-18s14 6 14 18z" fill="#f2c24c" stroke="#7a560e" stroke-width="1.6"/><path d="M8 11h28" stroke="#c9503a" stroke-width="3"/>' +
    '<circle cx="22" cy="24" r="9.5" fill="#f6c9a0" stroke="#8a5a30" stroke-width="1.4"/><circle cx="18.5" cy="23" r="1.2" fill="#3a2a1a"/><circle cx="25.5" cy="23" r="1.2" fill="#3a2a1a"/><path d="M18.5 28q3.5 3 7 0" stroke="#a5421f" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
    '<path d="M8 28q-6 8-3 20M36 28q6 8 3 20" stroke="#c9742a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    '<path d="M6 54c0-14 7-20 16-20s16 6 16 20v22H6z" fill="#4a86c4" stroke="#24508a" stroke-width="1.6"/><path d="M16 34l6 12 6-12" fill="#7fc15a" stroke="#3d7a22" stroke-width="1.2"/><path d="M8 76h12v8H8zM24 76h12v8H24z" fill="#6e4824"/></g>' +
    // лейка и струи воды
    '<g transform="translate(66 52) rotate(18)"><path d="M0 4h20l2 16H-2z" fill="#5b9fd4" stroke="#2c5f8a" stroke-width="1.5"/><path d="M20 8q14-2 20-12" stroke="#2c5f8a" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="42" cy="-6" rx="4.4" ry="2.4" fill="#2c5f8a"/><path d="M0 4q10-8 20 0" stroke="#2c5f8a" stroke-width="2" fill="none"/></g>' +
    '<g fill="#5aa8d8"><path d="M100 50q-2.4 4 0 6q2.4-2 0-6zM108 58q-2.4 4 0 6q2.4-2 0-6zM96 62q-2.4 4 0 6q2.4-2 0-6zM112 70q-2.4 4 0 6q2.4-2 0-6zM102 74q-2.4 4 0 6q2.4-2 0-6z"/></g>',
);

/** Сарай (ножницы): красный амбар, садовые ножницы, ведро, сено. */
const barnA = sc(
  '<rect width="160" height="110" fill="#d8eefb"/>' +
    '<path d="M0 66q40-14 80-4t80-6v54H0z" fill="#bcdf9c"/>' +
    grass(84) +
    '<rect x="30" y="30" width="100" height="58" fill="#c9503a" stroke="#8a2f1f" stroke-width="2.4"/><path d="M22 34L80 4l58 30z" fill="#a73d2a" stroke="#6e2416" stroke-width="2.4"/>' +
    '<rect x="62" y="48" width="36" height="40" fill="#f3e3c3" stroke="#8a2f1f" stroke-width="2.4"/><path d="M62 48l36 40M98 48L62 88" stroke="#8a2f1f" stroke-width="2.4"/><circle cx="80" cy="22" r="5" fill="#f3e3c3" stroke="#8a2f1f" stroke-width="1.6"/>' +
    '<g transform="translate(112 56) rotate(24)"><path d="M0 0l4 30M10 0L6 30" stroke="#8f9ba3" stroke-width="5" stroke-linecap="round"/><path d="M0 0l4 30M10 0L6 30" stroke="#d5dde2" stroke-width="1.8" stroke-linecap="round"/><circle cx="3" cy="36" r="6" fill="none" stroke="#c9503a" stroke-width="3.4"/><circle cx="12" cy="36" r="6" fill="none" stroke="#c9503a" stroke-width="3.4"/></g>' +
    '<g transform="translate(14 74)"><path d="M0 0h20l-3 20H3z" fill="#9eaab2" stroke="#59646b" stroke-width="1.5"/><path d="M0 0q10-10 20 0" fill="none" stroke="#59646b" stroke-width="2"/></g>' +
    '<rect x="128" y="76" width="26" height="14" rx="4" fill="#e8c963" stroke="#a88a24" stroke-width="1.6"/><path d="M132 78l1 10M138 78l1 10M144 78l1 10" stroke="#b8982e" stroke-width="1.2"/>',
);

/** Сарай (косилка): газонокосилка на траве у амбара. */
const barnB = sc(
  '<rect width="160" height="110" fill="#d8eefb"/>' +
    sun(24, 20) +
    '<path d="M0 62q40-14 80-4t80-6v54H0z" fill="#bcdf9c"/>' +
    '<rect x="96" y="26" width="52" height="40" fill="#c9503a" stroke="#8a2f1f" stroke-width="2"/><path d="M90 29L122 8l32 21z" fill="#a73d2a" stroke="#6e2416" stroke-width="2"/><rect x="112" y="40" width="20" height="26" fill="#f3e3c3" stroke="#8a2f1f" stroke-width="2"/>' +
    grass(70) +
    Array.from({ length: 5 }, (_, i) => `<rect x="0" y="${72 + i * 8}" width="160" height="4" fill="#7fbf56" opacity=".55"/>`).join('') +
    '<g transform="translate(34 50)"><path d="M0 16h44q4 0 4 6v10H0z" fill="#d9503a" stroke="#8a2f1f" stroke-width="2"/><rect x="6" y="8" width="26" height="10" rx="3" fill="#b83a26" stroke="#8a2f1f" stroke-width="1.6"/><path d="M40 12l22-26M56 -16h14" stroke="#4a4f55" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="10" cy="36" r="8" fill="#3a3f45" stroke="#1c1f23" stroke-width="1.6"/><circle cx="10" cy="36" r="3" fill="#f2c24c"/><circle cx="38" cy="36" r="8" fill="#3a3f45" stroke="#1c1f23" stroke-width="1.6"/><circle cx="38" cy="36" r="3" fill="#f2c24c"/></g>' +
    '<g fill="#a4d97a" opacity=".9"><path d="M6 96l4-8 4 8zM22 100l4-8 4 8zM140 98l4-8 4 8z"/></g>' +
    '<g transform="translate(120 88)"><circle cx="0" cy="0" r="3.4" fill="#fff"/><circle cx="12" cy="6" r="3.4" fill="#ffd1e0"/><circle cx="-10" cy="8" r="3.4" fill="#fff1a0"/></g>',
);

/** 1 компост и 4 товара: компостная куча и ящики с овощами. */
const compostGoods = sc(
  '<rect width="160" height="110" fill="#e9f3dc"/>' +
    grass(80) +
    // компостный ящик
    '<g transform="translate(10 34)"><path d="M0 0h54v50H0z" fill="#a8713f" stroke="#5a381a" stroke-width="2.2"/><path d="M0 12h54M0 25h54M0 38h54" stroke="#5a381a" stroke-width="1.8"/><path d="M-3 0h60" stroke="#6e4824" stroke-width="4"/>' +
    '<path d="M6 0q8-14 21-12t21 12z" fill="#7b5230" stroke="#47301a" stroke-width="1.6"/><circle cx="16" cy="-3" r="2.6" fill="#e0402f"/><path d="M30 -6q6-2 8 3" stroke="#6fae3f" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M40 -2q4-6 9-4" stroke="#8fc84a" stroke-width="3" fill="none" stroke-linecap="round"/></g>' +
    '<path d="M22 100q6-10 12 0" stroke="#d98a8a" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
    // ящики с товарами
    '<g transform="translate(78 42)"><rect x="0" y="22" width="34" height="24" rx="2" fill="#f08a2c" stroke="#a5510c" stroke-width="2"/><path d="M0 30h34M0 38h34M11 22v24M23 22v24" stroke="#c4661a" stroke-width="1.2"/>' +
    '<ellipse cx="10" cy="20" rx="8" ry="6.4" fill="#f28c28" stroke="#a5510c" stroke-width="1.4"/><ellipse cx="25" cy="19" rx="8" ry="6.4" fill="#f28c28" stroke="#a5510c" stroke-width="1.4"/></g>' +
    '<g transform="translate(116 52)"><rect x="0" y="16" width="34" height="22" rx="2" fill="#f08a2c" stroke="#a5510c" stroke-width="2"/><path d="M0 24h34M0 31h34M11 16v22M23 16v22" stroke="#c4661a" stroke-width="1.2"/>' +
    '<path d="M6 16q2-14 6-14t4 14M16 16q2-16 7-16t4 16M26 16q2-12 5-12" fill="#f5c53a" stroke="#a87810" stroke-width="1.4"/></g>' +
    '<g transform="translate(96 22)"><rect x="0" y="22" width="34" height="22" rx="2" fill="#f08a2c" stroke="#a5510c" stroke-width="2"/><circle cx="9" cy="20" r="6.4" fill="#e0402f" stroke="#8d1d12" stroke-width="1.3"/><circle cx="21" cy="19" r="6.4" fill="#e0402f" stroke="#8d1d12" stroke-width="1.3"/><circle cx="15" cy="13" r="6.4" fill="#d8322a" stroke="#8d1d12" stroke-width="1.3"/></g>',
);

/** Пасека или сад: улей, пчёлы, яблоня. */
const apiaryGarden = sc(
  '<rect width="160" height="110" fill="#d8eefb"/>' +
    sun(140, 16) +
    '<path d="M0 66q40-14 80-4t80-6v54H0z" fill="#bcdf9c"/>' +
    grass(80) +
    // яблоня
    '<g transform="translate(112 18)"><rect x="-5" y="40" width="10" height="38" rx="3" fill="#7a4e2a" stroke="#4d2f16" stroke-width="1.6"/>' +
    '<circle cx="-16" cy="26" r="20" fill="#6aa83d" stroke="#3f7a22" stroke-width="1.6"/><circle cx="16" cy="26" r="20" fill="#6aa83d" stroke="#3f7a22" stroke-width="1.6"/><circle cx="0" cy="10" r="22" fill="#6aa83d" stroke="#3f7a22" stroke-width="1.6"/>' +
    [[-20, 24], [10, 30], [20, 20], [-4, 10], [-12, 38], [6, 4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6" fill="#e0402f" stroke="#8d1d12" stroke-width="1"/>`).join('') +
    '</g>' +
    // улей
    '<g transform="translate(22 46)"><rect x="-4" y="38" width="62" height="7" fill="#8a5a30"/><rect x="0" y="0" width="54" height="13" rx="2" fill="#f3d36e" stroke="#a8821f" stroke-width="1.6"/><rect x="0" y="13" width="54" height="13" rx="2" fill="#efc958" stroke="#a8821f" stroke-width="1.6"/><rect x="0" y="26" width="54" height="13" rx="2" fill="#f3d36e" stroke="#a8821f" stroke-width="1.6"/>' +
    '<path d="M-5 0h64l-9-13H4z" fill="#c9503a" stroke="#8a2f1f" stroke-width="1.6"/><rect x="18" y="30" width="18" height="5" rx="2.5" fill="#4a3320"/></g>' +
    [[84, 42], [92, 58], [76, 66], [58, 34]].map(([x, y]) => `<g transform="translate(${x} ${y})"><ellipse cx="-3" cy="-4" rx="4" ry="2.6" fill="#e6f4ff" stroke="#8fb2c8" stroke-width=".6"/><ellipse cx="3" cy="-4" rx="4" ry="2.6" fill="#e6f4ff" stroke="#8fb2c8" stroke-width=".6"/><ellipse cx="0" cy="0" rx="5.4" ry="3.6" fill="#f6c935" stroke="#4a3300" stroke-width=".8"/><path d="M-1.6 -3v6M1.6 -3v6" stroke="#2a1d00" stroke-width="1.2"/></g>`).join('') +
    '<g fill="#fff"><circle cx="10" cy="98" r="3"/><circle cx="20" cy="102" r="3"/></g><g fill="#ffd1e0"><circle cx="64" cy="100" r="3"/><circle cx="74" cy="96" r="3"/></g><g fill="#d8325c"><circle cx="40" cy="98" r="3.4"/><circle cx="48" cy="102" r="3.4"/><circle cx="32" cy="102" r="3.4"/></g>',
);

/** Фермерский рынок: прилавок с тентом и ящиками. */
const market = sc(
  '<rect width="160" height="110" fill="#e6f1f8"/>' +
    grass(90) +
    // тент
    '<g><path d="M18 14h124l8 22H10z" fill="#fff" stroke="#8a97a0" stroke-width="1.6"/>' +
    [0, 1, 2, 3, 4, 5].map((i) => `<path d="M${18 + i * 21 - (i * 1.3)} 14h${21}l${1.6} 22h-${21}z" fill="#d9503a" opacity="${i % 2 ? 0 : 1}"/>`).join('') +
    '<path d="M10 36q10 8 20 0t20 0 20 0 20 0 20 0 20 0 20 0" fill="#fff" stroke="#8a97a0" stroke-width="1.4"/></g>' +
    '<path d="M24 36v58M136 36v58" stroke="#8a5a30" stroke-width="4"/>' +
    // прилавок
    '<rect x="14" y="62" width="132" height="32" fill="#c98a45" stroke="#7a4a1e" stroke-width="2"/><path d="M14 74h132M14 84h132" stroke="#7a4a1e" stroke-width="1.2"/>' +
    '<ellipse cx="38" cy="60" rx="11" ry="8.4" fill="#f28c28" stroke="#a5510c" stroke-width="1.5"/><ellipse cx="56" cy="61" rx="11" ry="8.4" fill="#f28c28" stroke="#a5510c" stroke-width="1.5"/>' +
    '<circle cx="86" cy="58" r="7" fill="#e0402f" stroke="#8d1d12" stroke-width="1.3"/><circle cx="99" cy="59" r="7" fill="#e0402f" stroke="#8d1d12" stroke-width="1.3"/><circle cx="92" cy="52" r="7" fill="#d8322a" stroke="#8d1d12" stroke-width="1.3"/>' +
    '<path d="M116 62q3-18 8-18t4 18M126 62q3-20 9-20t4 20" fill="#f5c53a" stroke="#a87810" stroke-width="1.4"/>' +
    '<g transform="translate(70 44)"><path d="M-8 0h16" stroke="#59646b" stroke-width="2"/></g>',
);

export const SCENES: Record<string, string> = {
  plantWater,
  barn: barnA,
  barn2: barnB,
  compostGoods,
  apiaryGarden,
  apiaryGardenGold: apiaryGarden,
  market,
};
