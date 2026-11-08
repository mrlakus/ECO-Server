// Собственные векторные иконки (нарисованы для этого проекта, не взяты из оригинальной игры).

const s = (body: string, vb = '0 0 24 24', cls = 'ic') => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">${body}</svg>`;

export const FLOWER_COLORS: Record<string, string> = {
  tulip: '#e8475a',
  hydrangea: '#6f9be6',
  iris: '#6a4fc9',
  hyacinth: '#b56fd9',
  crocus: '#f2a81d',
  narcissus: '#f7dd4a',
};

export const flower = (color: string, center = '#fff3b0', cls = 'ic') =>
  s(
    `<g fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width=".6">${[0, 60, 120, 180, 240, 300]
      .map((a) => `<ellipse cx="12" cy="6.2" rx="3.4" ry="4.6" transform="rotate(${a} 12 12)"/>`)
      .join('')}</g><circle cx="12" cy="12" r="3" fill="${center}" stroke="rgba(0,0,0,.3)" stroke-width=".6"/>`,
    '0 0 24 24',
    cls,
  );

export const ic = {
  corn: s(
    '<path d="M12 2.5c3.2 2 4.6 7.5 3.4 12.6-.7 3-2 5.2-3.4 6.4-1.4-1.2-2.7-3.4-3.4-6.4C7.4 10 8.8 4.5 12 2.5z" fill="#f4c430" stroke="#9b6f0d" stroke-width="1"/><path d="M12 4.5v15M9.2 8h5.6M8.8 11.2h6.4M9 14.4h6" stroke="#b8860b" stroke-width=".8" fill="none"/><path d="M12 21.5C8 20.5 5.5 17 5.5 11.5c2.4 1 4.8 3.2 6.5 6.5zM12 21.5c4-1 6.5-4.5 6.5-10-2.4 1-4.8 3.2-6.5 6.5z" fill="#6fae3f" stroke="#3d7a22" stroke-width=".9"/>',
  ),
  bean: s(
    '<path d="M4.5 19C3.6 10.5 9.5 3.5 19.5 4.5c1.1 9.2-5.2 16.4-15 14.5z" fill="#7cb94a" stroke="#3d7a22" stroke-width="1.1"/><circle cx="8.8" cy="14.2" r="1.7" fill="#cfeaa4"/><circle cx="12" cy="10.8" r="1.7" fill="#cfeaa4"/><circle cx="15.4" cy="7.8" r="1.5" fill="#cfeaa4"/>',
  ),
  pumpkin: s(
    '<ellipse cx="12" cy="14.2" rx="9.2" ry="7.3" fill="#f28c28" stroke="#a5510c" stroke-width="1"/><path d="M12 7.2c-3.4 2.2-3.4 12.4 0 14.6M12 7.2c3.4 2.2 3.4 12.4 0 14.6M6.8 9c-2.2 3.2-2.2 8.4 1 10.4M17.2 9c2.2 3.2 2.2 8.4-1 10.4" stroke="#c76c14" stroke-width=".9" fill="none"/><path d="M12 7.4c.1-2 1-3.4 2.4-4.2" stroke="#4f8a2b" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
  ),
  crate: s(
    '<rect x="2.5" y="6.5" width="19" height="14" rx="2" fill="#f08a2c" stroke="#a5510c" stroke-width="1.2"/><path d="M2.5 11.5h19M2.5 16h19M8 6.5v14M16 6.5v14" stroke="#c4661a" stroke-width=".9"/><path d="M6 6.5c1-3 3.5-4 6-4s5 1 6 4" fill="none" stroke="#a5510c" stroke-width="1.2"/>',
  ),
  bee: s(
    '<ellipse cx="12" cy="13" rx="6.5" ry="5" fill="#f6c935" stroke="#6a4a00" stroke-width="1"/><path d="M9 8.3v9.4M13 8.1v9.8M16.6 9.6v6.8" stroke="#3a2a00" stroke-width="1.8"/><ellipse cx="9" cy="7" rx="3.2" ry="4.4" transform="rotate(-25 9 7)" fill="#dff1ff" stroke="#6a8ca8" stroke-width=".8"/><ellipse cx="15" cy="7" rx="3.2" ry="4.4" transform="rotate(25 15 7)" fill="#dff1ff" stroke="#6a8ca8" stroke-width=".8"/>',
  ),
  apple: s(
    '<path d="M12 7.2c-2.4-1.8-7-.8-7 4.8 0 4.5 3 9 7 9s7-4.5 7-9c0-5.6-4.6-6.6-7-4.8z" fill="#e0402f" stroke="#8d1d12" stroke-width="1"/><path d="M12 7.2c0-2 .8-3.4 2-4.2" stroke="#5a3a1a" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M13.5 5.2c2-1.4 4-.8 4.6.6-2 1-3.8.8-4.6-.6z" fill="#6fae3f"/>',
  ),
  peach: s(
    '<circle cx="12" cy="13.5" r="7.6" fill="#f7a76a" stroke="#b5622a" stroke-width="1"/><path d="M12 6.4c-1.6 3.2-1.6 10.8 0 14.4" stroke="#d57b3e" stroke-width=".9" fill="none"/><path d="M12 6.4c.4-1.8 1.8-3 3.4-3.4-.2 2-1.4 3.2-3.4 3.4z" fill="#6fae3f" stroke="#3d7a22" stroke-width=".6"/>',
  ),
  blackberry: s(
    '<g fill="#4a2a6a" stroke="#2a1440" stroke-width=".7"><circle cx="9" cy="12" r="3"/><circle cx="15" cy="12" r="3"/><circle cx="12" cy="8.6" r="3"/><circle cx="9" cy="17" r="3"/><circle cx="15" cy="17" r="3"/><circle cx="12" cy="14.4" r="3"/></g><path d="M12 6c0-1.8.6-2.8 2-3.6" stroke="#4f8a2b" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  ),
  raspberry: s(
    '<g fill="#d8325c" stroke="#7d1030" stroke-width=".7"><circle cx="9" cy="11" r="2.8"/><circle cx="15" cy="11" r="2.8"/><circle cx="12" cy="8.2" r="2.8"/><circle cx="9.8" cy="15.6" r="2.8"/><circle cx="14.2" cy="15.6" r="2.8"/><circle cx="12" cy="12.6" r="2.8"/><circle cx="12" cy="18.6" r="2.4"/></g><path d="M12 6c0-1.6.8-2.8 2.4-3.4" stroke="#4f8a2b" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  ),
  barn: s(
    '<path d="M3 21V10.5L12 3.5l9 7V21z" fill="#c9503a" stroke="#6e2416" stroke-width="1.1"/><path d="M3 10.5L12 3.5l9 7" fill="none" stroke="#6e2416" stroke-width="1.6"/><rect x="8" y="12.5" width="8" height="8.5" fill="#f3e3c3" stroke="#6e2416" stroke-width="1"/><path d="M8 12.5l8 8.5M16 12.5L8 21" stroke="#6e2416" stroke-width=".9"/>',
  ),
  compost: s(
    '<path d="M2.5 20c1-7 5-11 9.5-11s8.5 4 9.5 11z" fill="#7b5230" stroke="#47301a" stroke-width="1.1"/><circle cx="9" cy="16" r="1.1" fill="#a97a4a"/><circle cx="14" cy="14.2" r="1.1" fill="#a97a4a"/><circle cx="16.5" cy="17.4" r="1" fill="#a97a4a"/><path d="M12 9c-.2-2.4 1-4.4 3.4-5.4.4 2.6-.8 4.8-3.4 5.4z" fill="#6fae3f" stroke="#3d7a22" stroke-width=".7"/>',
  ),
  can: s(
    '<path d="M5 9h10l1 10H4z" fill="#5b9fd4" stroke="#2c5f8a" stroke-width="1.1"/><path d="M15 12c3 0 5-2.5 6-5" stroke="#2c5f8a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M5 9c0-3 2-5 5-5s5 2 5 5" fill="none" stroke="#2c5f8a" stroke-width="1.4"/><circle cx="21.2" cy="5.8" r="1.4" fill="#cfe8fa"/>',
  ),
  seedling: s(
    '<path d="M12 21v-8" stroke="#3d7a22" stroke-width="2" stroke-linecap="round"/><path d="M12 13c-5 .4-7.5-2.6-7.5-7 4.6-.2 7.5 2.2 7.5 7zM12 15c4.6.2 7.5-2 7.5-6.2-4.4-.2-7.5 1.8-7.5 6.2z" fill="#7cc24a" stroke="#3d7a22" stroke-width="1"/><path d="M6 21.5h12" stroke="#7b5230" stroke-width="2.4" stroke-linecap="round"/>',
  ),
  shears: s(
    '<path d="M6 3l7 11M18 3l-7 11" stroke="#8aa0ad" stroke-width="2.4" stroke-linecap="round"/><circle cx="8" cy="18.5" r="3.2" fill="none" stroke="#c9503a" stroke-width="2"/><circle cx="16" cy="18.5" r="3.2" fill="none" stroke="#c9503a" stroke-width="2"/><path d="M10 16l1.5-3M14 16l-1.5-3" stroke="#8aa0ad" stroke-width="2"/>',
  ),
  edith: s(
    '<ellipse cx="12" cy="9.5" rx="9" ry="2.6" fill="#e8b23c" stroke="#7a560e" stroke-width="1"/><path d="M7.5 9c0-4 2-6.2 4.5-6.2S16.5 5 16.5 9z" fill="#f2c24c" stroke="#7a560e" stroke-width="1"/><circle cx="12" cy="12.4" r="3.6" fill="#f6c9a0" stroke="#8a5a30" stroke-width=".9"/><path d="M5 22c0-5 3-7.4 7-7.4s7 2.4 7 7.4z" fill="#4a86c4" stroke="#24508a" stroke-width="1"/><path d="M10.5 15.4l1.5 3 1.5-3" fill="#7fc15a" stroke="#3d7a22" stroke-width=".8"/>',
  ),
  die: s(
    '<rect x="2.5" y="2.5" width="19" height="19" rx="4.5" fill="#fff" stroke="#3d3d3d" stroke-width="1.7"/><g fill="#222"><circle cx="8" cy="8" r="1.7"/><circle cx="16" cy="8" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="8" cy="16" r="1.7"/><circle cx="16" cy="16" r="1.7"/></g>',
  ),
  star: s('<path d="M12 2.8l2.7 6 6.5.6-4.9 4.4 1.5 6.4L12 16.8 6.2 20.2l1.5-6.4L2.8 9.4l6.5-.6z" fill="#f6c935" stroke="#a8800a" stroke-width="1"/>'),
};

/** Синяя розетка с очками (как значок ПО на листе). */
export const rosette = (n: number | string) =>
  `<span class="ros">${s(
    '<path d="M7 17l-3 9 5-2.6 3 3.6 1.8-8.2zM17 17l3 9-5-2.6-3 3.6-1.8-8.2z" fill="#2a78b5"/><circle cx="12" cy="11" r="9.5" fill="#3d9be0" stroke="#1f5f95" stroke-width="1.4"/><circle cx="12" cy="11" r="7" fill="none" stroke="#c4e5fb" stroke-width=".9" stroke-dasharray="2.2 1.6"/>',
    '0 0 24 28',
    'ros-bg',
  )}<b>${n}</b></span>`;

/** Оранжевый значок товаров с числом. */
export const goodsBadge = (n: number | string) => `<span class="gbadge">${ic.crate}<b>${n}</b></span>`;
