/* The glasshouse: zones, restoration tasks and the illustrated scene. */
const T = (id, cost, kind, target, title, say, opts = {}) => Object.assign({ id, cost, kind, target, title, say }, opts);

const ZONES = [
  {
    id: 'palm', name: 'Monstera Corner', sub: 'The Old Palm House', decor: 'mister',
    theme: { frame: '#f2f0e8', floorA: '#c26a42', floorB: '#efe2c4', floorC: '#2c3a32', brick: '#9a5a3e', sky: ['#a9d8e6', '#f5ecd2'], far: '#6f9f6a', glass: '#e2f5f0' },
    slots: {
      center: { x: 800, y: 860, s: 1.3, label: 'Showpiece', options: ['m_deliciosa', 'm_thai', 'm_albo'], pot: 'terracotta', pots: ['terracotta', 'ceramic', 'glazed', 'gilded'] },
      pole: { x: 300, y: 852, s: 1.05, label: 'Climbing pole', options: ['m_dubia', 'm_siltepecana', 'm_standleyana'], pot: 'concrete', pots: ['concrete', 'terracotta', 'nursery'] },
      bench: { x: 1235, y: 604, s: .62, label: 'Bench', options: ['m_adansonii', 'm_peru', 'm_obliqua'], pot: 'ceramic', pots: ['ceramic', 'blush', 'terracotta'] },
      spot: { x: 1475, y: 878, s: .95, label: 'Rare spotlight', options: ['m_aurea', 'm_mint', 'm_esqueleto'], pot: 'gilded', pots: ['gilded', 'glazed', 'basket'] }
    },
    tasks: [
      T('p1', 1, 'fixture', 'floor', 'Sweep up the shattered glass', 'Mind your step! The old Palm House hasn’t seen a broom in forty years. Let’s clear it out.'),
      T('p2', 1, 'plant', 'center', 'Plant a showpiece Monstera', 'Every great collection starts with a Monstera. Which one shall be our centrepiece?'),
      T('p3', 2, 'fixture', 'glass', 'Re-glaze the broken panes', 'Fresh glass! Now the light can really pour in. Aroids adore bright, indirect sun.'),
      T('p4', 1, 'pot', 'center', 'Choose a pot for the showpiece', 'A good pot is a frame for the painting. Mind it has drainage holes, mind you.'),
      T('p5', 2, 'fixture', 'bench', 'Rebuild the potting bench', 'My grandmother’s potting bench! Every Monstera in this house was repotted right here.'),
      T('p6', 1, 'plant', 'bench', 'Pot up a small Monstera for the bench', 'Not every Monstera is a giant. Some of the rarest are the smallest.'),
      T('p7', 2, 'grow', null, 'Feed & water the collection', 'A drink of rainwater and a little feed… look how they’ve perked up!'),
      T('p8', 2, 'plant', 'pole', 'Raise a moss-pole climber', 'In the wild these scramble up rainforest trees. Give them something to climb and their leaves grow bigger with every node.'),
      T('p9', 1, 'fixture', 'lamp', 'Hang a full-spectrum grow light', 'For the grey winter months. Variegated plants need every photon they can get.'),
      T('p10', 2, 'plant', 'spot', 'Place a legendary variegate', 'Now for something truly special. Collectors would cross oceans for one of these.'),
      T('p11', 2, 'fixture', 'decor', 'Install the brass humidity mister', 'Humidity, dear! The thinner the leaf, the more it craves moist air.'),
      T('p12', 3, 'grow', null, 'Let the Monstera Corner mature', 'Splits! Fenestrations! Aerial roots! The Monstera Corner is complete. On to the Velvet Wall!')
    ]
  },
  {
    id: 'velvet', name: 'The Velvet Wall', sub: 'Philodendrons & Anthuriums', decor: 'fountain',
    theme: { frame: '#2f4a3a', floorA: '#3b4a42', floorB: '#d8cfbd', floorC: '#8a3a3a', brick: '#6e4a3a', sky: ['#9ccbd8', '#efe0c8'], far: '#5a8a5e', glass: '#d6efe9' },
    slots: {
      center: { x: 820, y: 860, s: 1.25, label: 'Centre stage', options: ['p_pink_princess', 'p_birkin', 'p_gloriosum'], pot: 'blush', pots: ['blush', 'ceramic', 'gilded', 'terracotta'] },
      pole: { x: 330, y: 852, s: 1.0, label: 'Velvet climber', options: ['p_melanochrysum', 'p_verrucosum', 'r_tetrasperma'], pot: 'terracotta', pots: ['terracotta', 'concrete', 'nursery'] },
      bench: { x: 1235, y: 604, s: .74, label: 'Anthurium table', options: ['an_clarinervium', 'an_warocqueanum', 'an_crystallinum'], pot: 'concrete', pots: ['concrete', 'glazed', 'ceramic'] },
      hang: { x: 590, y: 300, s: .78, hang: true, label: 'Hanging basket', options: ['p_micans', 'p_brasil', 's_pictus'], pot: 'basket', pots: ['basket', 'ceramic', 'glazed'] }
    },
    tasks: [
      T('v1', 1, 'fixture', 'floor', 'Lift the moss off the old tiles', 'Under all that moss is the original Minton tile floor. Victorian, you know.'),
      T('v2', 1, 'plant', 'center', 'Plant the Velvet Wall’s star', 'Philodendrons! The name means "tree-loving" in Greek.'),
      T('v3', 2, 'fixture', 'glass', 'Repaint the ironwork & glass', 'Dark green ironwork. Very handsome, and it hides the rust.'),
      T('v4', 1, 'plant', 'hang', 'Hang a trailing basket', 'A curtain of leaves to soften the glass. Velvet or variegated?'),
      T('v5', 2, 'fixture', 'bench', 'Build a slatted Anthurium table', 'Anthuriums are epiphytes: they want airy roots and chunky bark. A slatted table drains perfectly.'),
      T('v6', 2, 'plant', 'bench', 'Choose a velvet Anthurium', 'The velvet ones are the crown jewels. Look at those veins!'),
      T('v7', 2, 'grow', null, 'Mist and feed the velvets', 'Velvet leaves hate wet surfaces. Mist the air, not the leaves!'),
      T('v8', 2, 'plant', 'pole', 'Train a velvet climber', 'Climbers grow bigger and bolder the higher they go.'),
      T('v9', 1, 'fixture', 'lamp', 'Install warm grow lights', 'A soft glow for the dark evenings.'),
      T('v10', 1, 'pot', 'center', 'Pick a pot for the centrepiece', 'Something elegant, I think.'),
      T('v11', 2, 'fixture', 'decor', 'Restore the stone fountain', 'Running water raises the humidity and the spirits!'),
      T('v12', 3, 'grow', null, 'Let the Velvet Wall flourish', 'Velvet everywhere. Glorious! Next: the Alocasia Grove.')
    ]
  },
  {
    id: 'grove', name: 'Alocasia Grove', sub: 'Elephant Ears & Figs', decor: 'pond',
    theme: { frame: '#e9e4d6', floorA: '#7a6a52', floorB: '#cdbb98', floorC: '#3e5a3a', brick: '#8a6a4e', sky: ['#b3dbe0', '#f7e7c4'], far: '#7aa86a', glass: '#e6f4ea' },
    slots: {
      center: { x: 780, y: 862, s: 1.3, label: 'Grove centre', options: ['a_zebrina', 'a_stingray', 'c_black_magic'], pot: 'glazed', pots: ['glazed', 'terracotta', 'concrete', 'gilded'] },
      left: { x: 310, y: 858, s: 1.15, label: 'Velvet arrowheads', options: ['a_frydek', 'a_polly', 'a_black_velvet'], pot: 'terracotta', pots: ['terracotta', 'ceramic', 'nursery'] },
      tree: { x: 1470, y: 878, s: 1.12, label: 'Indoor tree', options: ['f_lyrata', 'f_tineke', 'f_audrey'], pot: 'basket', pots: ['basket', 'concrete', 'ceramic'] },
      bench: { x: 1235, y: 604, s: .75, label: 'Jewel Alocasia', options: ['a_dragon_scale', 'a_silver_dragon', 'a_black_velvet'], pot: 'ceramic', pots: ['ceramic', 'blush', 'gilded'] }
    },
    tasks: [
      T('g1', 1, 'fixture', 'floor', 'Clear the fallen leaf litter', 'Alocasias drop an old leaf for every new one. That’s a lot of leaves over forty years!'),
      T('g2', 1, 'plant', 'center', 'Plant a statement Elephant Ear', 'Elephant ears! Some grow leaves the size of an umbrella.'),
      T('g3', 2, 'fixture', 'glass', 'Fix the grove’s roof glass', 'They’ll get that bright light they need, without the scorching.'),
      T('g4', 2, 'plant', 'left', 'Add a velvet arrowhead', 'Arrowhead leaves with white veins like lightning.'),
      T('g5', 2, 'fixture', 'bench', 'Rebuild the jewel bench', 'The "jewel Alocasias" are small, but every leaf is a work of art.'),
      T('g6', 1, 'plant', 'bench', 'Pick a jewel Alocasia', 'Look at the texture on those! Like dragon scales.'),
      T('g7', 2, 'grow', null, 'Water the grove', 'Alocasias like evenly moist soil, never soggy. They sulk if overwatered.'),
      T('g8', 2, 'plant', 'tree', 'Plant an indoor tree', 'Every glasshouse needs a tree. A fig, perhaps?'),
      T('g9', 1, 'fixture', 'lamp', 'Hang a canopy light', 'Like sun through the canopy.'),
      T('g10', 1, 'pot', 'tree', 'Choose the tree’s planter', 'Something sturdy. Figs get top-heavy.'),
      T('g11', 2, 'fixture', 'decor', 'Dig a little lily pond', 'A pond! Colocasias even like to stand in water.'),
      T('g12', 3, 'grow', null, 'Let the grove grow wild', 'A proper jungle! On to the Shade House of prayer plants.')
    ]
  },
  {
    id: 'shade', name: 'The Shade House', sub: 'Prayer Plants & Friends', decor: 'mistline',
    theme: { frame: '#5a4a3a', floorA: '#4a5a4a', floorB: '#bfc8b0', floorC: '#7a4a5a', brick: '#5e5048', sky: ['#9fc4c8', '#e4dcc6'], far: '#4f7a56', glass: '#d2e8e2' },
    slots: {
      left: { x: 320, y: 860, s: 1.15, label: 'Round-leaf corner', options: ['c_orbifolia', 'c_medallion', 'c_white_fusion'], pot: 'ceramic', pots: ['ceramic', 'blush', 'glazed'] },
      center: { x: 800, y: 862, s: 1.2, label: 'Painted leaves', options: ['c_makoyana', 'c_lancifolia', 'c_musaica'], pot: 'terracotta', pots: ['terracotta', 'basket', 'concrete'] },
      right: { x: 1475, y: 878, s: 1.12, label: 'Herringbone bed', options: ['m_leuconeura', 'ct_fishbone', 'st_triostar'], pot: 'glazed', pots: ['glazed', 'gilded', 'ceramic'] },
      bench: { x: 1235, y: 604, s: .8, label: 'Windowsill pick', options: ['pi_peperomioides', 'pe_argyreia', 'fi_albivenis'], pot: 'blush', pots: ['blush', 'terracotta', 'ceramic'] }
    },
    tasks: [
      T('s1', 1, 'fixture', 'floor', 'Scrub the slate floor', 'The Shade House: cool, dim and humid. Calatheas’ favourite kind of place.'),
      T('s2', 1, 'plant', 'left', 'Plant a round-leaf Calathea', 'Watch them at dusk: the leaves rise and fold like hands in prayer.'),
      T('s3', 2, 'fixture', 'glass', 'Fit the shade-cloth glass', 'Dappled light only. Direct sun bleaches these beauties.'),
      T('s4', 2, 'plant', 'center', 'Add a painted Calathea', 'Each one looks hand-painted. Nature, showing off.'),
      T('s5', 2, 'fixture', 'bench', 'Build a windowsill bench', 'For the little ones: perfect for pups and cuttings.'),
      T('s6', 1, 'plant', 'bench', 'Choose a windowsill favourite', 'A pass-along plant, perhaps? The best plants are gifts.'),
      T('s7', 2, 'grow', null, 'Water with rainwater', 'Only rainwater for Calatheas. Tap water gives them crispy edges.'),
      T('s8', 2, 'plant', 'right', 'Plant a herringbone beauty', 'Red veins, fishbones, or flaming pink?'),
      T('s9', 1, 'fixture', 'lamp', 'Hang a soft lantern', 'Low light, but not no light.'),
      T('s10', 1, 'pot', 'left', 'Repot the round-leaf corner', 'A little more room for those roots.'),
      T('s11', 2, 'fixture', 'decor', 'Install the overhead mist line', 'Fssssh! Ninety percent humidity. Heaven.'),
      T('s12', 3, 'grow', null, 'Let the Shade House flourish', 'Glorious! One last room: the Hanging Gallery.')
    ]
  },
  {
    id: 'gallery', name: 'Hanging Gallery', sub: 'Trailers & Succulent Vines', decor: 'bistro',
    theme: { frame: '#f4f1ea', floorA: '#b98a5a', floorB: '#f0e6d2', floorC: '#3a6a6a', brick: '#a86a4e', sky: ['#b8e0ef', '#fbefd6'], far: '#88b47e', glass: '#e8f7f4' },
    slots: {
      hangL: { x: 420, y: 250, s: .85, hang: true, label: 'Left basket', options: ['e_marble_queen', 'e_neon', 'e_manjula'], pot: 'ceramic', pots: ['ceramic', 'basket', 'glazed'] },
      hangC: { x: 800, y: 215, s: .85, hang: true, label: 'Centre basket', options: ['h_krimson', 'h_kerrii', 'h_pubicalyx'], pot: 'basket', pots: ['basket', 'blush', 'terracotta'] },
      hangR: { x: 1180, y: 250, s: .85, hang: true, label: 'Right basket', options: ['cu_pearls', 'ce_hearts', 'pe_turtles'], pot: 'terracotta', pots: ['terracotta', 'ceramic', 'gilded'] },
      floor: { x: 1470, y: 878, s: 1.12, label: 'Gallery floor', options: ['d_laurentii', 'd_moonshine', 'z_zamiifolia'], pot: 'concrete', pots: ['concrete', 'gilded', 'basket'] }
    },
    tasks: [
      T('h1', 1, 'fixture', 'floor', 'Sweep the gallery floor', 'The Hanging Gallery: my favourite room. Plants above, sunshine everywhere.'),
      T('h2', 1, 'plant', 'hangL', 'Hang a pothos basket', 'The friendliest plant in the world. Impossible to kill.'),
      T('h3', 2, 'fixture', 'glass', 'Polish the skylight', 'Trailing plants want light from above to stay compact.'),
      T('h4', 2, 'plant', 'hangC', 'Hang a flowering Hoya', 'Wax flowers! Wait until you smell them at night.'),
      T('h5', 2, 'fixture', 'bench', 'Rebuild the gallery bench', 'A place to sit and admire it all.'),
      T('h6', 2, 'plant', 'hangR', 'Hang a string of something', 'Pearls, hearts or turtles: the cutest trailing succulents.'),
      T('h7', 2, 'grow', null, 'Let the trailers grow long', 'Look at them cascading!'),
      T('h8', 1, 'plant', 'floor', 'Place an unkillable floor plant', 'Something architectural. And forgiving.'),
      T('h9', 1, 'fixture', 'lamp', 'Hang the gallery lights', 'For evening tea among the vines.'),
      T('h10', 1, 'pot', 'hangC', 'Change the Hoya’s basket', 'Hoyas like to be snug. Don’t over-pot them.'),
      T('h11', 2, 'fixture', 'decor', 'Set out the bistro table', 'Tea is served, among the plants.'),
      T('h12', 3, 'grow', null, 'Bring the glasshouse to full bloom', 'You’ve done it. The whole glasshouse is alive again. Thank you, truly.')
    ]
  }
];
const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));

const Scene = (() => {
  const f = n => Math.round(n * 10) / 10;
  const W = 1600, H = 900;

  function sky(z) {
    const t = z.theme, R = U.rng(U.hashStr(z.id));
    let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.sky[0]}"/><stop offset="1" stop-color="${t.sky[1]}"/></linearGradient>
      <linearGradient id="glassG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.glass}" stop-opacity=".35"/><stop offset=".5" stop-color="${t.glass}" stop-opacity=".12"/><stop offset="1" stop-color="#ffffff" stop-opacity=".3"/></linearGradient>
      <radialGradient id="sun" cx=".78" cy=".12" r=".5"><stop offset="0" stop-color="#fff8dc" stop-opacity=".9"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient>
      <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c8" stop-opacity=".55"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></linearGradient></defs>`;
    s += `<rect width="${W}" height="${H}" fill="url(#sky)"/><rect width="${W}" height="${H}" fill="url(#sun)"/>`;
    // garden beyond the glass
    for (let i = 0; i < 14; i++) {
      const x = R() * W, r = 60 + R() * 110;
      s += `<ellipse cx="${f(x)}" cy="${f(560 - R() * 60)}" rx="${f(r)}" ry="${f(r * .8)}" fill="${U.mix(t.far, t.sky[0], .35 + R() * .3)}"/>`;
    }
    for (let i = 0; i < 3; i++) {
      const x = 150 + R() * 1300;
      s += `<path d="M${f(x)} 610Q${f(x + 6)} 420 ${f(x + 2)} 330" stroke="${U.mix(t.far, '#4a3a2a', .5)}" stroke-width="7" fill="none" opacity=".55"/>`;
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; s += `<path d="M${f(x + 2)} 330Q${f(x + Math.cos(a) * 60)} ${f(310 + Math.sin(a) * 20 - 30)} ${f(x + Math.cos(a) * 110)} ${f(340 + Math.abs(Math.sin(a)) * 40)}" stroke="${U.mix(t.far, t.sky[0], .2)}" stroke-width="10" fill="none" stroke-linecap="round" opacity=".6"/>`; }
    }
    return s;
  }
  function glass(z, fixed) {
    const t = z.theme, R = U.rng(U.hashStr(z.id) + 3);
    let s = `<g class="fx-glass">`;
    s += `<rect x="0" y="30" width="${W}" height="582" fill="url(#glassG)"/>`;
    // reflections
    for (let i = 0; i < 6; i++) { const x = 80 + i * 280; s += `<path d="M${x} 612L${x + 120} 40L${x + 170} 40L${x + 50} 612Z" fill="#fff" opacity="${fixed ? .1 : .04}"/>`; }
    if (!fixed) {
      s += `<rect x="0" y="30" width="${W}" height="582" fill="#7a6a40" opacity=".28"/>`;
      for (let i = 0; i < 9; i++) {
        const bx = Math.floor(R() * 8) * 200, by = 60 + R() * 450, cx = bx + 30 + R() * 140;
        if (R() < .45) s += `<path d="M${f(cx)} ${f(by)}l${f(-40 + R() * 20)} ${f(30 + R() * 30)}l${f(30 + R() * 30)} ${f(20)}l${f(10)} ${f(-50)}Z" fill="#2a3a2a" opacity=".35"/>`;
        let d = `M${f(cx)} ${f(by)}`; for (let k = 0; k < 4; k++) { const a = R() * Math.PI * 2; d += `M${f(cx)} ${f(by)}l${f(Math.cos(a) * 40)} ${f(Math.sin(a) * 40)}l${f(Math.cos(a + .4) * 25)} ${f(Math.sin(a + .4) * 25)}`; }
        s += `<path d="${d}" stroke="#fff" stroke-width="1.5" fill="none" opacity=".75"/>`;
      }
      // creeping ivy
      let d = 'M0 610'; const pts = [];
      for (let i = 1; i < 14; i++) { const x = i * 28 + R() * 20, y = 610 - i * 30 + R() * 30; d += `Q${f(x - 20)} ${f(y + 20)} ${f(x)} ${f(y)}`; pts.push([x, y]); }
      s += `<path d="${d}" stroke="#4a5a2a" stroke-width="3" fill="none"/>`;
      for (const [x, y] of pts) s += `<path d="M${f(x)} ${f(y)}c-8 -10 -2 -18 6 -14c8 -4 12 6 4 14Z" fill="#5a6e2e" opacity=".9"/>`;
    }
    // ironwork
    s += `<g fill="${t.frame}">`;
    for (let i = 0; i <= 8; i++) s += `<rect x="${i * 200 - 7}" y="30" width="14" height="582"/>`;
    s += `<rect x="0" y="22" width="${W}" height="18"/><rect x="0" y="300" width="${W}" height="8"/><rect x="0" y="470" width="${W}" height="7"/>`;
    s += `</g>`;
    for (let i = 0; i < 8; i++) {
      const x = i * 200;
      s += `<path d="M${x + 7} 300Q${x + 7} 120 ${x + 100} 90Q${x + 193} 120 ${x + 193} 300" stroke="${t.frame}" stroke-width="7" fill="none"/>`;
      s += `<circle cx="${x + 100}" cy="135" r="20" stroke="${t.frame}" stroke-width="5" fill="none"/><circle cx="${x + 100}" cy="135" r="7" fill="${t.frame}"/>`;
      for (const sx of [1, -1]) s += `<path d="M${x + 100 + sx * 20} 140q${sx * 30} 10 ${sx * 40} 50q${sx * 4} 20 ${sx * -10} 20" stroke="${t.frame}" stroke-width="3.5" fill="none"/>`;
    }
    s += `<rect x="0" y="22" width="${W}" height="18" fill="#000" opacity=".1"/>`;
    return s + `</g>`;
  }
  function kneeWall(z) {
    const t = z.theme;
    let s = `<rect x="0" y="606" width="${W}" height="96" fill="${t.brick}"/>`;
    for (let r = 0; r < 6; r++) {
      const y = 616 + r * 14;
      s += `<path d="M0 ${y}H${W}" stroke="#d8c8b0" stroke-width="2" opacity=".55"/>`;
      for (let x = (r % 2) * 22; x < W; x += 44) s += `<path d="M${x} ${y}v14" stroke="#d8c8b0" stroke-width="2" opacity=".5"/>`;
    }
    s += `<rect x="0" y="598" width="${W}" height="14" fill="#e8dfcc"/><rect x="0" y="610" width="${W}" height="4" fill="#000" opacity=".15"/>`;
    return s;
  }
  function floor(z, fixed) {
    const t = z.theme, R = U.rng(U.hashStr(z.id) + 9), vy = 250, top = 700, rows = 6;
    let s = `<g class="fx-floor"><rect x="0" y="${top}" width="${W}" height="${H - top}" fill="${t.floorB}"/>`;
    const sAt = y => (y - vy) / (top - vy);
    const ys = []; for (let i = 0; i <= rows; i++) ys.push(top + (H - top) * Math.pow(i / rows, 1.25));
    for (let i = 0; i < rows; i++) {
      const y0 = ys[i], y1 = ys[i + 1], s0 = sAt(y0), s1 = sAt(y1);
      for (let k = -14; k < 14; k++) {
        const xa0 = 800 + (k * 100 - 0) * s0, xb0 = 800 + ((k + 1) * 100) * s0, xa1 = 800 + (k * 100) * s1, xb1 = 800 + ((k + 1) * 100) * s1;
        if (xb1 < -100 || xa1 > W + 100) continue;
        const c = (i + k) % 2 ? t.floorA : t.floorB;
        s += `<path d="M${f(xa0)} ${f(y0)}L${f(xb0)} ${f(y0)}L${f(xb1)} ${f(y1)}L${f(xa1)} ${f(y1)}Z" fill="${c}" stroke="#00000022" stroke-width="1.5"/>`;
        if ((i + k) % 2 === 0) {
          const mx0 = (xa0 + xb0) / 2, mx1 = (xa1 + xb1) / 2, my = (y0 + y1) / 2;
          s += `<path d="M${f(mx0)} ${f(y0 + (y1 - y0) * .15)}L${f((xb0 + xb1) / 2 - (xb1 - xa1) * .12)} ${f(my)}L${f(mx1)} ${f(y1 - (y1 - y0) * .15)}L${f((xa0 + xa1) / 2 + (xb1 - xa1) * .12)} ${f(my)}Z" fill="${t.floorC}" opacity=".85"/>`;
        }
      }
    }
    s += `<rect x="0" y="${top}" width="${W}" height="40" fill="#000" opacity=".12"/>`;
    if (!fixed) {
      s += `<rect x="0" y="${top}" width="${W}" height="${H - top}" fill="#5a4a2a" opacity=".42"/>`;
      for (let i = 0; i < 40; i++) {
        const x = R() * W, y = top + 20 + R() * (H - top - 30);
        if (i % 3 === 0) s += `<path d="M${f(x)} ${f(y)}l${f(10 + R() * 14)} ${f(-6 - R() * 8)}l${f(4 + R() * 6)} ${f(10)}Z" fill="#dff1f2" opacity=".75"/>`;
        else if (i % 3 === 1) s += `<path d="M${f(x)} ${f(y)}c6 -8 18 -8 22 0c-6 6 -16 6 -22 0Z" fill="${['#8a5a2a', '#a8742e', '#6a4a22'][i % 3]}" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})"/>`;
        else s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(10 + R() * 30)}" ry="${f(4 + R() * 6)}" fill="#3a2a1a" opacity=".35"/>`;
      }
      for (let i = 0; i < 6; i++) { const x = R() * W; s += `<path d="M${f(x)} ${top + 10}l${f(20)} 40l-10 30l25 50" stroke="#2a2014" stroke-width="2" fill="none" opacity=".5"/>`; }
    }
    return s + `</g>`;
  }
  function bench(z, fixed) {
    const x0 = 1080, x1 = 1420, top = 604;
    const wood = '#9a6a3e', dark = '#6a4422', light = '#c08a54';
    if (!fixed) {
      return `<g class="fx-bench"><path d="M${x0} ${top + 120}L${x1 - 40} ${top + 40}L${x1 - 30} ${top + 56}L${x0 + 10} ${top + 134}Z" fill="${dark}"/>
        <rect x="${x0 + 20}" y="${top + 40}" width="14" height="128" fill="${dark}" transform="rotate(-8 ${x0 + 20} ${top + 40})"/>
        <rect x="${x1 - 50}" y="${top + 60}" width="14" height="108" fill="${dark}"/>
        <path d="M${x0 + 120} ${top + 150}l40 -10l20 14l-30 12Z" fill="#a8582e"/><path d="M${x0 + 180} ${top + 156}l26 -6l8 12Z" fill="#c26a3a"/>
        <path d="M${x1 - 60} ${top + 30}q20 10 40 0q-20 30 -40 0" stroke="#ddd" stroke-width="1" fill="none" opacity=".6"/></g>`;
    }
    let s = `<g class="fx-bench">`;
    s += `<rect x="${x0 + 14}" y="${top}" width="16" height="170" fill="${dark}"/><rect x="${x1 - 30}" y="${top}" width="16" height="170" fill="${dark}"/>`;
    s += `<rect x="${x0 + 4}" y="${top + 112}" width="${x1 - x0 - 8}" height="12" fill="${wood}"/>`;
    s += `<rect x="${x0 - 6}" y="${top - 2}" width="${x1 - x0 + 12}" height="18" rx="3" fill="${wood}"/><rect x="${x0 - 6}" y="${top - 2}" width="${x1 - x0 + 12}" height="5" fill="${light}"/>`;
    for (let x = x0 + 30; x < x1; x += 60) s += `<path d="M${x} ${top + 2}v14" stroke="${dark}" stroke-width="1.5" opacity=".6"/>`;
    // stacked pots, watering can & trowel on the lower shelf
    for (let i = 0; i < 3; i++) s += `<path d="M${x0 + 40 + i * 8} ${top + 112 - i * 12}l40 0l-6 -22l-28 0Z" fill="${['#b8603a', '#c8703f', '#d27a48'][i]}" stroke="#7a3a1e" stroke-width="1"/>`;
    s += `<g transform="translate(${x1 - 140} ${top + 72})"><rect x="0" y="0" width="56" height="40" rx="6" fill="#5f8a7a"/><path d="M56 10l40 -26l4 4l-38 30Z" fill="#5f8a7a"/><ellipse cx="98" cy="-14" rx="7" ry="4" fill="#4a6e60"/><path d="M8 0q20 -30 40 0" stroke="#4a6e60" stroke-width="5" fill="none"/><rect x="0" y="16" width="56" height="5" fill="#fff" opacity=".2"/></g>`;
    s += `<g transform="translate(${x0 + 160} ${top - 6}) rotate(-8)"><rect x="0" y="0" width="34" height="5" rx="2" fill="#7a5a3a"/><path d="M34 -3l26 5l-26 6Z" fill="#aab2b4"/></g>`;
    return s + `</g>`;
  }
  function lamp(z, fixed) {
    if (!fixed) return `<path d="M800 40v40q6 10 -4 22" stroke="#333" stroke-width="2" fill="none"/>`;
    return `<g class="fx-lamp"><path d="M700 40V128M900 40V128" stroke="#3a3a3a" stroke-width="2.5" stroke-dasharray="5 3"/>
      <path class="cone" d="M650 140L950 140L1250 900L350 900Z" fill="url(#cone)" opacity=".5"/>
      <rect x="640" y="124" width="320" height="18" rx="8" fill="#2c2c2e"/><rect x="652" y="138" width="296" height="6" rx="3" fill="#fff8e0" class="glow"/>
      <rect x="640" y="124" width="320" height="5" rx="3" fill="#fff" opacity=".15"/></g>`;
  }
  function decor(z, fixed) {
    if (!fixed) return '';
    switch (z.decor) {
      case 'mister': return `<g class="fx-decor" transform="translate(560 880)"><ellipse cx="0" cy="0" rx="40" ry="8" fill="#000" opacity=".2"/>
        <path d="M-30 0Q-46 -60 -18 -80L-14 -100L14 -100L18 -80Q46 -60 30 0Z" fill="url(#brass)"/>
        <defs><linearGradient id="brass" x1="0" x2="1"><stop offset="0" stop-color="#7a5a1a"/><stop offset=".4" stop-color="#e8c45a"/><stop offset="1" stop-color="#8a6a20"/></linearGradient></defs>
        <rect x="-20" y="-108" width="40" height="10" rx="4" fill="#c9a03a"/><path d="M0 -108v-30q0 -10 14 -12" stroke="#b8902a" stroke-width="5" fill="none"/>
        ${[0, 1, 2, 3, 4].map(i => `<circle class="mist" style="animation-delay:${i * .8}s" cx="18" cy="-152" r="${10 + i * 3}" fill="#fff"/>`).join('')}</g>`;
      case 'fountain': return `<g class="fx-decor" transform="translate(1480 880)"><ellipse cx="0" cy="0" rx="90" ry="16" fill="#000" opacity=".2"/>
        <path d="M-90 -6Q-90 -40 -80 -44H80Q90 -40 90 -6Q0 12 -90 -6Z" fill="#b9b4a6"/><ellipse cx="0" cy="-44" rx="80" ry="14" fill="#7fb7c4"/><ellipse cx="0" cy="-44" rx="80" ry="14" fill="none" stroke="#d8d2c2" stroke-width="6"/>
        <rect x="-10" y="-130" width="20" height="86" fill="#c9c4b6"/><ellipse cx="0" cy="-130" rx="40" ry="9" fill="#d8d2c2"/><ellipse cx="0" cy="-132" rx="32" ry="6" fill="#7fb7c4"/>
        <path class="water" d="M-30 -128Q-46 -100 -50 -48M30 -128Q46 -100 50 -48M0 -150Q0 -140 0 -134" stroke="#c8ecf4" stroke-width="3" fill="none" stroke-dasharray="6 6"/>
        <circle cx="0" cy="-152" r="5" fill="#d8d2c2"/></g>`;
      case 'pond': return `<g class="fx-decor" transform="translate(1060 868)"><ellipse rx="150" ry="26" fill="#6a6252"/><ellipse rx="140" ry="21" fill="#3f7a86"/><ellipse rx="140" ry="21" fill="url(#cone)" opacity=".3"/>
        ${[[-60, -2], [30, 6], [80, -6]].map(([x, y]) => `<path d="M${x} ${y}m-16 0a16 6 0 1 0 32 0a16 6 0 1 0 -32 0" fill="#5aa04a"/><path d="M${x} ${y}l14 -4" stroke="#3f7a86" stroke-width="3"/>`).join('')}
        <circle cx="34" cy="2" r="5" fill="#f2a7c0"/><circle cx="34" cy="2" r="2" fill="#f7e27a"/>
        <path class="ripple" d="M-20 4m-20 0a20 4 0 1 0 40 0a20 4 0 1 0 -40 0" fill="none" stroke="#bfe6ec" stroke-width="1.5"/>
        ${[-130, -110, 115, 135].map(x => `<path d="M${x} -10q4 -50 ${x > 0 ? 10 : -10} -70" stroke="#5a7a3a" stroke-width="3" fill="none"/><ellipse cx="${x + (x > 0 ? 10 : -10)}" cy="-74" rx="3" ry="10" fill="#6a4a2a"/>`).join('')}</g>`;
      case 'mistline': return `<g class="fx-decor"><rect x="0" y="44" width="${W}" height="6" fill="#8a8a8a"/>${[200, 500, 800, 1100, 1400].map((x, i) => `<rect x="${x - 4}" y="48" width="8" height="12" fill="#666"/>${[0, 1, 2].map(k => `<circle class="mist" style="animation-delay:${(i * .5 + k * 1.1) % 3}s" cx="${x}" cy="80" r="${16 + k * 6}" fill="#fff"/>`).join('')}`).join('')}</g>`;
      case 'bistro': return `<g class="fx-decor" transform="translate(800 885)"><ellipse rx="160" ry="18" fill="#000" opacity=".18"/>
        <path d="M-4 0V-80M4 0V-80M-40 0Q0 -30 40 0" stroke="#2a2a2a" stroke-width="4" fill="none"/><ellipse cx="0" cy="-84" rx="70" ry="14" fill="#f2efe6" stroke="#2a2a2a" stroke-width="3"/>
        <path d="M-10 -96h20l-3 10h-14Z" fill="#fff" stroke="#3a6a6a" stroke-width="2"/><path d="M10 -94q8 2 0 7" stroke="#3a6a6a" stroke-width="2" fill="none"/><ellipse cx="0" cy="-86" rx="16" ry="3" fill="#fff" stroke="#3a6a6a"/>
        ${[-1, 1].map(sx => `<g transform="translate(${sx * 120} 0) scale(${sx} 1)"><path d="M-20 0V-50H20V0M-20 -50Q-26 -110 0 -116Q26 -110 20 -50" stroke="#2a2a2a" stroke-width="4" fill="none"/><path d="M-12 -60Q0 -100 12 -60" stroke="#2a2a2a" stroke-width="2.5" fill="none"/><ellipse cx="0" cy="-50" rx="26" ry="6" fill="#3a6a6a"/></g>`).join('')}</g>`;
    }
    return '';
  }
  function hanger(x, y, s, potted) {
    const top = 34, ry = y - 95 * s * .9;
    let r = '';
    for (const dx of [-55, -20, 20, 55]) r += `<path d="M${x} ${top + 30}L${f(x + dx * s)} ${f(ry)}" stroke="#d8c8a8" stroke-width="2.4"/>`;
    r += `<path d="M${x} ${top}v30" stroke="#666" stroke-width="2"/><circle cx="${x}" cy="${top + 30}" r="5" fill="none" stroke="#666" stroke-width="2"/>`;
    if (potted) r += `<path d="M${f(x - 40 * s)} ${f(y - 60 * s)}l${f(10 * s)} ${f(20 * s)}l${f(10 * s)} ${f(-20 * s)}l${f(10 * s)} ${f(20 * s)}l${f(10 * s)} ${f(-20 * s)}l${f(10 * s)} ${f(20 * s)}l${f(10 * s)} ${f(-20 * s)}l${f(10 * s)} ${f(20 * s)}" stroke="#d8c8a8" stroke-width="2" fill="none" opacity=".9"/>`;
    return r;
  }
  function ruin(sl) {
    const s = sl.s * .8;
    if (sl.hang) return hanger(sl.x, sl.y, s, false) + `<g transform="translate(${sl.x} ${sl.y}) scale(${s})"><path d="M-55 -95Q0 -70 55 -95L40 0H-40Z" fill="#8a6a3a" opacity=".85"/><path d="M-10 -95l-20 -40M8 -95l10 -50l14 10" stroke="#7a5a32" stroke-width="3" fill="none"/></g>`;
    return `<g transform="translate(${sl.x} ${sl.y}) scale(${s})" class="ruin"><ellipse cx="0" cy="2" rx="50" ry="7" fill="#000" opacity=".2"/>
      <path d="M-55 -85L-42 0H42L55 -85Z" fill="#a8582e"/><path d="M-58 -95H58V-82H-58Z" fill="#b8683a"/><path d="M10 -95L28 -50L18 -30L40 -10" stroke="#3a1a0a" stroke-width="3" fill="none"/>
      <path d="M30 -95L58 -95L52 -70Z" fill="${'#5a4030'}"/><ellipse cx="0" cy="-92" rx="52" ry="7" fill="#4a3424"/>
      <path d="M-4 -92q-6 -60 10 -110M-4 -140q-30 -10 -40 10M6 -170q24 -4 32 14" stroke="#8a6a3a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M-44 -130c-10 6 -16 20 -6 22c8 -2 10 -14 6 -22Z" fill="#8a5a2a"/><path d="M38 -156c10 4 14 18 4 22c-8 -4 -8 -16 -4 -22Z" fill="#a8742e"/></g>`;
  }
  function plantSlot(z, id, sl, st, highlight) {
    const plant = st.choices[id], pot = (st.pots && st.pots[id]) || sl.pot;
    if (!plant) return `<g class="slot ruin-slot" data-slot="${id}">${ruin(sl)}</g>`;
    const stage = Math.min(3, 1 + (st.grows || 0));
    let s = sl.hang ? hanger(sl.x, sl.y, sl.s, true) : '';
    s += `<g transform="translate(${sl.x} ${sl.y}) scale(${sl.s})">${PlantArt.plantGroup(plant, stage, pot, U.hashStr(z.id + id))}</g>`;
    return `<g class="slot planted${highlight === id ? ' pop-in' : ''}" data-slot="${id}">${s}</g>`;
  }
  function butterflies() {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const c = ['#f28a1e', '#5ab0e0', '#f2c230', '#e86aa0'][i];
      s += `<g class="bfly" style="animation-delay:${-i * 3.3}s;animation-duration:${12 + i * 2}s"><g class="wings"><path d="M0 0c-14 -16 -24 -4 -14 6c-8 8 2 14 14 0Z" fill="${c}"/><path d="M0 0c14 -16 24 -4 14 6c8 8 -2 14 -14 0Z" fill="${c}"/></g><rect x="-1.2" y="-6" width="2.4" height="12" rx="1" fill="#222"/></g>`;
    }
    return s;
  }

  /* Shop decorations, shared by every room. */
  const DECOR = {
    lights() {
      let s = `<path d="M0 48Q200 92 400 52Q600 92 800 52Q1000 92 1200 52Q1400 92 1600 48" stroke="#3a3a2a" stroke-width="1.6" fill="none"/>`;
      for (let x = 30; x < W; x += 50) {
        const seg = Math.floor(x / 200), t = (x - seg * 200) / 200, y = 50 + 4 * 38 * t * (1 - t);
        s += `<circle class="twinkle" style="animation-delay:${((x * 7) % 23) / 10}s" cx="${x}" cy="${f(y + 7)}" r="13" fill="#ffe7a0" opacity=".35"/><circle cx="${x}" cy="${f(y + 7)}" r="4.5" fill="#fff4c8"/>`;
      }
      return `<g class="decor-lights">${s}</g>`;
    },
    rug() {
      return `<g class="decor-rug"><path d="M520 818L1080 818L1180 896L420 896Z" fill="#7a2a2a"/><path d="M548 826L1052 826L1140 888L460 888Z" fill="none" stroke="#e2c27a" stroke-width="5"/>
        <path d="M590 834L1010 834L1080 880L520 880Z" fill="#23365a"/><path d="M800 838L900 857L800 876L700 857Z" fill="#c9862e"/><path d="M800 846L860 857L800 868L740 857Z" fill="#7a2a2a"/>
        ${[620, 980].map(x => `<path d="M${x} 845l30 12l-30 12l-30 -12Z" fill="#e2c27a" opacity=".8"/>`).join('')}
        ${Array.from({ length: 40 }, (_, i) => `<path d="M${422 + i * 19.5} 896v8" stroke="#e8dcc0" stroke-width="2"/>`).join('')}</g>`;
    },
    cat() {
      return `<g class="decor-cat" transform="translate(1010 884)"><ellipse rx="66" ry="10" cy="6" fill="#000" opacity=".2"/>
        <g class="breathe"><path d="M-58 2Q-62 -40 -10 -44Q48 -46 56 -8Q58 6 40 6H-50Z" fill="#e0892e"/>
        ${[-30, -12, 6, 24].map(x => `<path d="M${x} -42q4 16 -2 30" stroke="#b25e14" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('')}
        <path d="M40 4Q76 6 70 -14Q66 -26 52 -20" stroke="#e0892e" stroke-width="11" fill="none" stroke-linecap="round"/>
        <path d="M-74 4Q-80 -26 -52 -30Q-28 -30 -26 -6Q-26 6 -40 6Z" fill="#ec9a3e"/><path d="M-70 -18L-74 -40L-58 -28ZM-44 -30L-36 -48L-30 -26Z" fill="#e0892e"/>
        <path d="M-68 -14q5 3 9 0M-48 -16q5 3 9 0" stroke="#5a2e08" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M-56 -8l2 2l2 -2Z" fill="#c2566a"/>
        <path d="M-50 -4l-26 -2M-50 -2l-24 4" stroke="#fff" stroke-width=".8" opacity=".8"/></g></g>`;
    },
    birdcage() {
      const x = 1390, y = 250;
      let bars = '';
      for (let i = -4; i <= 4; i++) bars += `<path d="M${x + i * 9} ${y}V${y - 70}Q${x + i * 9} ${y - 104} ${x} ${y - 112}" stroke="#c9a54a" stroke-width="2" fill="none"/>`;
      return `<g class="decor-cage"><path d="M${x} 34V${y - 122}" stroke="#777" stroke-width="2"/><circle cx="${x}" cy="${y - 118}" r="6" fill="none" stroke="#c9a54a" stroke-width="3"/>
        <ellipse cx="${x}" cy="${y}" rx="42" ry="8" fill="#a8822a"/>
        <g class="hop"><path d="M${x - 20} ${y - 38}h40" stroke="#8a6a3a" stroke-width="3"/>
        <ellipse cx="${x - 2}" cy="${y - 50}" rx="12" ry="9" fill="#f6d33a"/><circle cx="${x + 8}" cy="${y - 59}" r="6.5" fill="#f6d33a"/><path d="M${x + 14} ${y - 60}l6 2l-6 2Z" fill="#e88a2a"/><circle cx="${x + 10}" cy="${y - 61}" r="1.3" fill="#222"/><path d="M${x - 13} ${y - 50}l-10 6l4 -9Z" fill="#e8c02a"/></g>
        ${bars}<path d="M${x - 40} ${y - 70}H${x + 40}" stroke="#c9a54a" stroke-width="2"/></g>`;
    }
  };
  function decorPreview(k) {
    const vb = { lights: '0 20 420 110', rug: '400 800 800 110', cat: '920 820 180 80', birdcage: '1330 100 120 170' }[k];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="decor-prev">${DECOR[k]()}</svg>`;
  }

  /* st: { fixtures:{}, choices:{}, pots:{}, grows:n, complete } */
  function render(z, st, opts = {}) {
    const fx = st.fixtures || {}, hl = opts.highlight;
    const dc = opts.decor || [];
    let s = sky(z) + glass(z, fx.glass) + kneeWall(z) + floor(z, fx.floor) + lamp(z, fx.lamp);
    if (dc.includes('rug')) s += DECOR.rug();
    if (dc.includes('lights')) s += DECOR.lights();
    const ents = [];
    if (dc.includes('cat')) ents.push({ y: 884, svg: DECOR.cat() });
    if (dc.includes('birdcage')) ents.push({ y: 0, svg: DECOR.birdcage() });
    ents.push({ y: 770, svg: bench(z, fx.bench) });
    const dec = decor(z, fx.decor);
    if (dec) ents.push({ y: z.decor === 'mistline' ? -1 : 860, svg: dec });
    for (const [id, sl] of Object.entries(z.slots)) ents.push({ y: sl.hang ? 0 : sl.y, svg: plantSlot(z, id, sl, st, hl) });
    ents.sort((a, b) => a.y - b.y);
    s += ents.map(e => e.svg).join('');
    if (st.complete) s += butterflies();
    s += `<rect width="${W}" height="${H}" fill="url(#sun)" opacity=".25" pointer-events="none"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" class="scene-svg">${s}</svg>`;
  }
  function anchor(z, task) {
    if (task.kind === 'plant' || task.kind === 'pot') { const sl = z.slots[task.target]; return [sl.x, sl.hang ? sl.y : sl.y - 120 * sl.s]; }
    return { floor: [800, 800], glass: [800, 300], bench: [1250, 600], lamp: [800, 135], decor: [z.decor === 'mistline' ? 800 : z.decor === 'fountain' ? 1480 : z.decor === 'pond' ? 1060 : z.decor === 'bistro' ? 800 : 560, z.decor === 'mistline' ? 80 : 800] }[task.target] || [800, 500];
  }
  return { render, anchor, decorPreview, W, H };
})();

const Portrait = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#e9dfc6"/>
<path d="M18 100Q20 72 50 70Q80 72 82 100Z" fill="#3f6a4a"/><path d="M44 70l6 10l6 -10" fill="#f4efe2"/>
<ellipse cx="50" cy="52" rx="19" ry="22" fill="#f1c9a5"/><path d="M31 48Q30 30 50 29Q70 30 69 48Q66 38 50 37Q34 38 31 48Z" fill="#cfcac2"/>
<circle cx="42" cy="52" r="6" fill="none" stroke="#6a4a2a" stroke-width="1.8"/><circle cx="58" cy="52" r="6" fill="none" stroke="#6a4a2a" stroke-width="1.8"/><path d="M48 52h4" stroke="#6a4a2a" stroke-width="1.8"/>
<circle cx="42" cy="52" r="1.6" fill="#3a2a1a"/><circle cx="58" cy="52" r="1.6" fill="#3a2a1a"/><path d="M43 63q7 5 14 0" stroke="#a0524a" stroke-width="2" fill="none" stroke-linecap="round"/>
<circle cx="37" cy="59" r="3" fill="#e8a090" opacity=".5"/><circle cx="63" cy="59" r="3" fill="#e8a090" opacity=".5"/>
<ellipse cx="50" cy="31" rx="38" ry="9" fill="#d8b878"/><path d="M30 31Q32 12 50 12Q68 12 70 31Z" fill="#e2c48a"/><path d="M30 28Q50 33 70 28L70 24Q50 29 30 24Z" fill="#3f6a4a"/>
<path d="M66 24q12 -10 18 -4q-6 10 -18 4Z" fill="#4f9a3f"/><path d="M66 24l14 -5" stroke="#2a5a22" stroke-width="1"/></svg>`;
