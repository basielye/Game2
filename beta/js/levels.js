/* Level generator. Shapes are hand-drawn masks; obstacles and goals scale with level number.
   Layout legend:  '.' tile   '_' hole   'm' moss   'M' thick moss   'p' clay pot   'P' double pot   'v' vine-bound tile */
const Levels = (() => {
  const MASKS = [
    ['########', '########', '########', '########', '########', '########', '########', '########'],
    ['_#######_', '#########', '#########', '#########', '#########', '#########', '#########', '#########', '_#######_'],
    ['___###___', '__#####__', '_#######_', '#########', '#########', '#########', '_#######_', '__#####__', '___###___'],
    ['##_____##', '###___###', '#########', '#########', '#########', '#########', '#########', '###___###', '##_____##'],
    ['_##___##_', '####_####', '#########', '#########', '#########', '_#######_', '__#####__', '___###___', '____#____'], // heart
    ['____#____', '___###___', '__#####__', '_#######_', '#########', '#########', '_#######_', '__#####__', '____#____'], // leaf
    ['#########', '_#######_', '__#####__', '__#####__', '__#####__', '__#####__', '_#######_', '#########'], // hourglass
    ['#########', '#########', '##_____##', '##_____##', '##_____##', '#########', '#########'],
    ['###___###', '###___###', '#########', '#########', '#########', '#########', '###___###', '###___###'],
    ['_#######_', '#########', '##_###_##', '#########', '#########', '##_###_##', '#########', '_#######_'],
    ['#######', '#######', '#######', '#######', '#######', '#######', '#######', '#######', '#######'],
    ['##___##', '#######', '#######', '#######', '#######', '#######', '#######', '#######', '##___##']
  ];
  const TUTORIAL = {
    1: { mask: 0, colors: 4, moves: 22, goals: [{ type: 'color', color: 0, count: 18 }], tip: 'Match 3 or more of the same kind. Collect the leaves!' },
    2: { mask: 1, colors: 4, moves: 22, goals: [{ type: 'color', color: 1, count: 16 }, { type: 'color', color: 2, count: 16 }], tip: 'Match 4 in a row to grow a Dragonfly: it zips across a whole line.' },
    3: { mask: 10, colors: 5, moves: 27, feature: 'moss', amount: .35, tip: 'Moss grows under tiles. Make matches on top of it to clear it.' },
    4: { mask: 2, colors: 5, moves: 24, feature: 'pot', amount: .32, tip: 'Old clay pots block the board. Match next to them to crack them open.' },
    5: { mask: 4, colors: 5, moves: 27, feature: 'moss', amount: .3, extra: { type: 'color', color: 3, count: 20 }, tip: 'Make an L or T shape for a Seed Bomb, or a 2×2 square for a Butterfly.' },
    6: { mask: 3, colors: 5, moves: 27, feature: 'vine', amount: .18, tip: 'Vines bind tiles in place. Match the bound tile to free it.' },
    7: { mask: 5, colors: 5, moves: 26, feature: 'pot', amount: .16, extra: { type: 'color', color: 4, count: 18 }, tip: 'Line up 5 in a row for a Prism Dahlia, the most powerful bloom of all!' }
  };

  function build(n) {
    const R = U.rng(n * 7919 + 13);
    const t = TUTORIAL[n];
    const hard = n % 10 === 0 ? 2 : (n % 5 === 0 ? 1 : 0);
    const maskIdx = t ? t.mask : (n * 7 + Math.floor(R() * 5)) % MASKS.length;
    const mask = MASKS[maskIdx];
    const rows = mask.length, cols = mask[0].length;
    const grid = mask.map(r => r.split('').map(ch => ch === '#' ? '.' : '_'));
    const colors = t ? t.colors : (n < 25 ? 5 : (R() < .35 + (hard ? .3 : 0) ? 6 : 5));
    let features;
    if (t) features = t.feature ? [{ f: t.feature, a: t.amount }] : [];
    else {
      const all = ['moss', 'pot', 'vine', 'moss2', 'pot2'];
      const avail = all.filter(x => !(n < 14 && (x === 'moss2' || x === 'pot2')));
      const k = 1 + (R() < .5 + Math.min(.4, n / 80) ? 1 : 0);
      features = U.shuffle(avail.slice(), R).slice(0, k).map(f => ({ f, a: (.14 + R() * .22 + Math.min(.15, n / 300)) * (f.startsWith('pot') ? .7 : f.startsWith('moss') ? .72 : f === 'vine' ? .8 : 1) }));
    }
    // symmetric placement
    const half = Math.ceil(cols / 2);
    for (const { f, a } of features) {
      const pattern = Math.floor(R() * 4);
      for (let r = 0; r < rows; r++) for (let c = 0; c < half; c++) {
        if (grid[r][c] !== '.') continue;
        let want = R() < a;
        if (f.startsWith('moss')) {
          if (pattern === 0) want = r >= rows - Math.ceil(rows * a * 1.6);
          else if (pattern === 1) want = Math.abs(r - rows / 2 + .5) + Math.abs(c - cols / 2 + .5) < rows * a * 1.4;
          else if (pattern === 2) want = (r + c) % 2 === 0 && R() < a * 1.8;
        }
        if (f.startsWith('pot')) {
          if (r < 2) want = false; // keep the top open so tiles can fall
          if (pattern === 0) want = want && (c === 0 || c === 1 || r === Math.floor(rows / 2));
        }
        if (f === 'vine' && pattern === 0) want = r === Math.floor(rows / 2) || r === Math.floor(rows / 2) - 1 ? R() < .7 : false;
        if (!want) continue;
        const ch = { moss: 'm', moss2: 'M', pot: 'p', pot2: 'P', vine: 'v' }[f];
        grid[r][c] = ch; grid[r][cols - 1 - c] = ch;
      }
    }
    const L = grid.map(r => r.join(''));
    const count = chs => L.join('').split('').filter(x => chs.includes(x)).length;
    const goals = [];
    if (count('mM')) goals.push({ type: 'moss', count: count('mM') });
    if (count('pP')) goals.push({ type: 'pot', count: count('pP') });
    if (count('v')) goals.push({ type: 'vine', count: count('v') });
    if (t && t.goals) goals.push(...t.goals);
    if (t && t.extra) goals.push(t.extra);
    if (!t && (goals.length < 2 || R() < .35) && goals.length < 3) {
      const c = Math.floor(R() * colors);
      goals.push({ type: 'color', color: c, count: 14 + Math.floor(R() * 10) + Math.floor(n / 6) });
    }
    if (!goals.length) goals.push({ type: 'color', color: 0, count: 20 });
    // move budget from workload
    let work = 0;
    for (const g of goals) work += g.type === 'color' ? g.count / 2.2 : g.type === 'moss' ? g.count / 1.9 * (count('M') ? 1.35 : 1) : g.type === 'pot' ? g.count / 1.5 * (count('P') ? 1.5 : 1) : g.count / 1.8;
    const moves = t ? t.moves : Math.round(U.clamp(15 + work * .6 - hard * 2 - Math.min(4, n / 18), 20, 38));
    const reward = 1 + hard;
    return { n, rows: L, colors, moves, goals, hard, reward, tip: t && t.tip };
  }
  const cache = {};
  return { get: n => cache[n] || (cache[n] = build(n)) };
})();
