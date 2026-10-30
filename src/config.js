export const SCALE = 50;
export const STEP = 1 / 60;
export const STORAGE_KEY = 'gravel-trial-save-v1';

/* ---------- Геометрия и подвеска мотоцикла ----------
   Все размеры в игровых единицах. Локальные координаты: начало в центре рамы,
   x — вперёд, y — вверх. Физика (physics.js) и графика (world.js) читают ОДНИ И ТЕ ЖЕ
   числа, поэтому модель и физическое тело не расходятся.
   Пропорции взяты с триального мотоцикла (референс): база ≈ 1.9 диаметра колеса,
   передняя вилка с наклоном ≈ 22°, маятник сзади. */
const unit = (x, y) => { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; };
export const BIKE = {
  chassis: { w: 1.3, h: .2, density: .0044 },
  head: { x: -.04, y: 1.03 },            // точка проверки «гонщик коснулся земли»
  surface: .02,                           // высота физической поверхности над линией рельефа
  rear: {
    r: .42, rest: { x: -.82, y: -.66 },   // rest — ось колеса при полностью разгруженной подвеске
    axis: unit(-.10, 1),                  // направление сжатия подвески (вверх относительно рамы)
    travel: .26, freq: 1.7, zComp: .55, zReb: 1.05, guide: 2.2
  },
  front: {
    r: .45, rest: { x: .84, y: -.63 },
    axis: unit(-.379, .925),              // наклон вилки ≈ 22° от вертикали
    travel: .30, freq: 1.5, zComp: .50, zReb: 1.00, guide: 2.2
  },
  /* точки крепления для графики */
  swingPivot: { x: -.32, y: -.30 },
  shockTop: { x: -.40, y: .30 },
  forkTop: { x: .36, y: .62 },
  leanScale: 2.6                          // компенсация большего момента инерции длинного мотоцикла
};

export const PALETTES = {
  quarry: {
    skyTop: '#91b8c1', skyBottom: '#e8c999', haze: '#b7b7a0',
    mountainFar: '#7c8f89', mountainNear: '#596d64',
    dirt: '#7b5438', dirtDark: '#3d3028', top: '#a88956',
    accent: '#f2b544', foliage: '#334f43', rock: '#7d766a'
  },
  ridge: {
    skyTop: '#6f94ad', skyBottom: '#d3b27e', haze: '#9da795',
    mountainFar: '#647b80', mountainNear: '#3d5b55',
    dirt: '#66503b', dirtDark: '#2f2d28', top: '#7e8351',
    accent: '#ef6a3a', foliage: '#203f35', rock: '#68716c'
  },
  foundry: {
    skyTop: '#554f59', skyBottom: '#d0875c', haze: '#8d7167',
    mountainFar: '#625a60', mountainNear: '#413d43',
    dirt: '#57443b', dirtDark: '#26272a', top: '#8a684b',
    accent: '#ef533f', foliage: '#333d38', rock: '#666269'
  }
};

const level = (data) => ({ ...data, palette: PALETTES[data.palette] });

export const LEVELS = [
  level({
    id: 'quarry', number: '01', name: 'Карьер', subtitle: 'Первый контакт', palette: 'quarry',
    description: 'Мягкие склоны, брёвна и короткий разгон перед финишем.',
    length: 94, spawn: { x: 3, y: 0 }, checkpoint: { x: 41, y: 0.4 }, finish: 89,
    gold: 18, silver: 28,
    points: [
      [0,0],[8,0],[12,.55],[16,.2],[20,.2],[23,1.25],[26,1.25],[28,.3],
      [32,.3],[35,1.65],[38,.4],[43,.4],[46,2.05],[50,.2],[54,.2],[58,1.05],
      [62,1.05],[66,0],[72,0],[76,1.35],[80,1.35],[84,.2],[96,.2]
    ],
    logs: [{x:18.1,y:.53,r:.32},{x:55.7,y:.53,r:.32},{x:69.7,y:.32,r:.31}],
    rocks: [{x:30.1,y:.55,r:.36},{x:73.1,y:.34,r:.3}],
    crates: [], seesaw: null
  }),
  level({
    id: 'ridge', number: '02', name: 'Хребет', subtitle: 'Держи баланс', palette: 'ridge',
    description: 'Крутые подъёмы, каменные ступени и качающийся мост.',
    length: 110, spawn: { x: 3, y: 0 }, checkpoint: { x: 52, y: .35 }, finish: 105,
    gold: 25, silver: 40,
    points: [
      [0,0],[7,0],[11,1.25],[14,.25],[18,.25],[21,2.1],[24,.35],[28,.35],
      [31,1.5],[34,3.0],[37,.45],[42,.45],[45,1.2],[48,.35],[55,.35],
      [58,2.3],[61,.3],[64,.3],[67,1.5],[70,3.2],[73,.3],[78,.3],
      [82,1.7],[85,.3],[89,.3],[92,2.4],[96,.4],[100,.4],[103,1.25],[112,1.25]
    ],
    logs: [{x:15.6,y:.58,r:.34},{x:86.7,y:.63,r:.34}],
    rocks: [{x:26.3,y:.62,r:.42},{x:39.6,y:.78,r:.4},{x:75.6,y:.65,r:.42}],
    crates: [{x:9.1,y:.45,s:.65}],
    seesaw: { x: 51.5, y: 1.05, w: 4.3 }
  }),
  level({
    id: 'foundry', number: '03', name: 'Литейная', subtitle: 'Без права на ошибку', palette: 'foundry',
    description: 'Техничные контруклоны, ящики и длинный финальный пролёт.',
    length: 122, spawn: { x: 3, y: 0 }, checkpoint: { x: 59, y: .3 }, finish: 117,
    gold: 36, silver: 55,
    points: [
      [0,0],[7,0],[10,1.7],[13,.2],[17,.2],[20,2.4],[23,.25],[27,.25],
      [30,1.2],[33,2.8],[36,.2],[40,.2],[43,2.6],[46,.25],[50,.25],
      [53,1.4],[56,.3],[63,.3],[66,2.5],[69,.25],[72,.25],[75,3.3],
      [78,.3],[82,.3],[85,1.7],[88,3.5],[91,.25],[95,.25],[98,2.2],
      [101,.3],[105,.3],[108,1.8],[111,.25],[124,.25]
    ],
    logs: [{x:14.8,y:.55,r:.34},{x:80,y:.65,r:.38},{x:103,y:.64,r:.36}],
    rocks: [{x:25,y:.65,r:.42},{x:38.1,y:.62,r:.38},{x:64.6,y:.64,r:.4}],
    crates: [{x:8.5,y:.4,s:.6},{x:93.2,y:.65,s:.72}],
    seesaw: { x: 59.5, y: 1.1, w: 4.8 }
  })
];

export const DEFAULT_SAVE = { version: 1, unlocked: 1, muted: false, bests: {} };

export function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || raw.version !== 1 || typeof raw.unlocked !== 'number' || !raw.bests) return { ...DEFAULT_SAVE, bests: {} };
    return {
      version: 1,
      unlocked: Math.max(1, Math.min(LEVELS.length, Math.floor(raw.unlocked))),
      muted: Boolean(raw.muted),
      bests: typeof raw.bests === 'object' ? raw.bests : {}
    };
  } catch {
    return { ...DEFAULT_SAVE, bests: {} };
  }
}

export function storeSave(save) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch { /* storage may be unavailable */ }
}

export function formatTime(seconds) {
  const safe = Math.max(0, seconds || 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const hundredths = Math.floor((safe % 1) * 100);
  return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`;
}
