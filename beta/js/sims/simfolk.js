/* Sims: appearance, needs, traits, skills, careers, moodlets, free will and animation. */
const Simfolk = (() => {
  const NEEDS = [
    { k: 'hunger', label: 'Hunger', icon: '🍽', decay: .11 },
    { k: 'energy', label: 'Energy', icon: '⚡', decay: .062 },
    { k: 'bladder', label: 'Bladder', icon: '🚽', decay: .14 },
    { k: 'hygiene', label: 'Hygiene', icon: '🫧', decay: .055 },
    { k: 'fun', label: 'Fun', icon: '🎉', decay: .1 },
    { k: 'social', label: 'Social', icon: '💬', decay: .07 },
    { k: 'comfort', label: 'Comfort', icon: '🛋', decay: .07 },
    { k: 'room', label: 'Environment', icon: '🏡', decay: 0 }
  ];
  const SKILLS = [
    { k: 'gardening', label: 'Gardening', icon: '🌿' }, { k: 'cooking', label: 'Cooking', icon: '🍳' }, { k: 'logic', label: 'Logic', icon: '♟' },
    { k: 'creativity', label: 'Creativity', icon: '🎨' }, { k: 'fitness', label: 'Fitness', icon: '💪' }, { k: 'charisma', label: 'Charisma', icon: '✨' }
  ];
  const TRAITS = [
    { id: 'greenthumb', name: 'Green Thumb', icon: '🌱', desc: 'Learns Gardening twice as fast and loves tending plants.', skill: { gardening: 2 }, likes: ['water', 'tend', 'study'] },
    { id: 'foodie', name: 'Foodie', icon: '🥐', desc: 'Gets hungry faster but cooks like a dream.', decay: { hunger: 1.2 }, skill: { cooking: 1.7 }, likes: ['cook', 'quick'] },
    { id: 'neat', name: 'Neat', icon: '🧼', desc: 'Stays clean longer and enjoys a good wash.', decay: { hygiene: .7 }, likes: ['shower', 'bath'] },
    { id: 'lazy', name: 'Lazy', icon: '😴', desc: 'Tires quickly. Television and naps are life.', decay: { energy: 1.25 }, likes: ['watch', 'nap', 'sit'] },
    { id: 'social', name: 'Social Butterfly', icon: '🦋', desc: 'Needs company more often and gets more out of it.', decay: { social: 1.4 }, gain: { social: 1.5 }, likes: ['chat', 'joke', 'hug'] },
    { id: 'loner', name: 'Loner', icon: '🌙', desc: 'Happy alone; social need drains slowly.', decay: { social: .55 }, likes: ['read', 'play'] },
    { id: 'bookworm', name: 'Bookworm', icon: '📚', desc: 'Reading is twice the fun and Logic comes easily.', skill: { logic: 1.5 }, gain: { fun: 1.2 }, likes: ['read', 'study', 'chess'] },
    { id: 'active', name: 'Active', icon: '🏃', desc: 'Builds Fitness fast and loves to move.', skill: { fitness: 1.8 }, likes: ['run', 'dance'] },
    { id: 'creative', name: 'Creative', icon: '🖌', desc: 'Painting and writing come naturally.', skill: { creativity: 1.8 }, likes: ['paint', 'blog'] },
    { id: 'cheerful', name: 'Cheerful', icon: '☀️', desc: 'Always a little happier than everyone else.', mood: 8 },
    { id: 'nightowl', name: 'Night Owl', icon: '🦉', desc: 'Needs less sleep and stays sharp late.', decay: { energy: .8 } },
    { id: 'charmer', name: 'Charmer', icon: '💐', desc: 'Picks up Charisma quickly; people warm to them.', skill: { charisma: 1.8 }, likes: ['speech', 'compliment'] }
  ];
  const TRAIT_BY = Object.fromEntries(TRAITS.map(t => [t.id, t]));
  const ASPIRATIONS = [
    { id: 'botanist', name: 'Master Botanist', icon: '🌿', desc: 'Reach level 6 Gardening.', prog: s => Math.min(1, level(s.skills.gardening) / 6) },
    { id: 'chef', name: 'Kitchen Legend', icon: '👩‍🍳', desc: 'Reach level 6 Cooking.', prog: s => Math.min(1, level(s.skills.cooking) / 6) },
    { id: 'renaissance', name: 'Renaissance Sim', icon: '🎭', desc: 'Reach level 3 in four different skills.', prog: s => Math.min(1, SKILLS.filter(k => level(s.skills[k.k]) >= 3).length / 4) },
    { id: 'friend', name: 'Heart of the Home', icon: '💞', desc: 'Become good friends (60+) with everyone in the household.', prog: (s, all) => { const o = all.filter(x => x.id !== s.id); return o.length ? o.filter(x => (s.rel[x.id] || 0) >= 60).length / o.length : 0; } },
    { id: 'career', name: 'Top of the Ladder', icon: '🏆', desc: 'Reach the top level of a career.', prog: s => s.job ? (s.job.level + 1) / 5 : 0 }
  ];
  const CAREERS = {
    botanist: { name: 'Botany', skill: 'gardening', titles: ['Plant Waterer', 'Nursery Assistant', 'Greenhouse Technician', 'Field Botanist', 'Head Curator'], pay: [14, 22, 35, 54, 82], icon: '🌿' },
    chef: { name: 'Culinary', skill: 'cooking', titles: ['Dishwasher', 'Line Cook', 'Sous Chef', 'Head Chef', 'Celebrity Chef'], pay: [13, 21, 33, 52, 85], icon: '🍳' },
    science: { name: 'Science', skill: 'logic', titles: ['Lab Assistant', 'Researcher', 'Chemist', 'Professor', 'Nobel Laureate'], pay: [15, 24, 37, 58, 90], icon: '🔬' },
    art: { name: 'Painter', skill: 'creativity', titles: ['Street Sketcher', 'Illustrator', 'Gallery Artist', 'Celebrated Muse', 'Living Legend'], pay: [12, 20, 32, 55, 88], icon: '🎨' },
    fitness: { name: 'Athletic', skill: 'fitness', titles: ['Gym Attendant', 'Coach', 'Personal Trainer', 'Pro Athlete', 'Olympian'], pay: [13, 21, 34, 53, 84], icon: '🏅' }
  };
  const PROMO_SKILL = [0, 1, 3, 5, 7];
  const MOODLETS = {
    tasty: { label: 'Delicious Meal', icon: '😋', val: 12, dur: 240 },
    rested: { label: 'Well Rested', icon: '😌', val: 10, dur: 300 },
    embarrassed: { label: 'Embarrassed', icon: '😳', val: -20, dur: 180 },
    beautiful: { label: 'Beautiful Room', icon: '🌸', val: 10, dur: 30 },
    ugly: { label: 'Dreary Surroundings', icon: '🥀', val: -8, dur: 30 },
    goodchat: { label: 'Good Conversation', icon: '💬', val: 8, dur: 120 },
    hugged: { label: 'Warm Hug', icon: '🤗', val: 12, dur: 120 },
    pride: { label: 'Plant Parent Pride', icon: '🪴', val: 10, dur: 180 },
    pumped: { label: 'Pumped', icon: '💪', val: 8, dur: 120 },
    inspired: { label: 'Creative High', icon: '🎨', val: 10, dur: 120 },
    promoted: { label: 'Promoted!', icon: '🎉', val: 25, dur: 720 },
    starving: { label: 'Starving', icon: '😫', val: -30, dur: 30 },
    stinky: { label: 'Stinky', icon: '🤢', val: -15, dur: 30 },
    exhausted: { label: 'Exhausted', icon: '🥱', val: -15, dur: 30 },
    fainted: { label: 'Passed Out', icon: '😵', val: -15, dur: 180 },
    skill: { label: 'Learned Something', icon: '💡', val: 8, dur: 180 }
  };
  const SOCIAL = [
    { id: 'chat', label: 'Chat', dur: 12, gains: { social: 2.6, fun: .3 }, rel: .35, icon: '💬' },
    { id: 'joke', label: 'Tell a Joke', dur: 8, gains: { social: 2, fun: 1.6 }, rel: .5, icon: '😂', risky: true },
    { id: 'compliment', label: 'Compliment', dur: 6, gains: { social: 2.2 }, rel: 1, icon: '💐', skill: { charisma: .8 } },
    { id: 'plants', label: 'Talk About Plants', dur: 15, gains: { social: 2, fun: .8 }, rel: .4, icon: '🌿', skill: { gardening: .5 } },
    { id: 'hug', label: 'Hug', dur: 4, gains: { social: 3, comfort: 3 }, rel: 1.5, icon: '🤗', min: 35, moodlet: 'hugged' },
    { id: 'deep', label: 'Deep Conversation', dur: 20, gains: { social: 3, fun: .4 }, rel: .6, icon: '💭', min: 50, moodlet: 'goodchat' },
    { id: 'argue', label: 'Argue', dur: 8, gains: { social: 1, fun: -1 }, rel: -2, icon: '💢', auto: false }
  ];
  const level = p => { let l = 0; while (l < 10 && (p || 0) >= 90 * (l + 1) * (l + 2)) l++; return l; };
  const nextAt = l => 90 * (l + 1) * (l + 2);

  /* ───────────── appearance ───────────── */
  const SKIN = ['#f6d7c3', '#eebf9f', '#d9a37c', '#b57b52', '#8a5636', '#5e3a24'];
  const HAIR = ['short', 'pixie', 'long', 'bun', 'curly', 'ponytail', 'buzz', 'bald'];
  const HAIRC = ['#2b1d14', '#5a3a22', '#8a5a2a', '#c98f4a', '#e8c46a', '#b04a2a', '#8a8a8a', '#e6e2da', '#3f6a8a', '#c96a9a'];
  const TOPS = ['tee', 'tank', 'longsleeve', 'sweater', 'hoodie', 'jacket', 'blazer', 'dress', 'overalls', 'apron'];
  const DEFAULT_SLEEVES = { tee: 'short', tank: 'none', longsleeve: 'long', sweater: 'long', hoodie: 'long', jacket: 'long', blazer: 'long', dress: 'short', overalls: 'short', apron: 'short' };
  const PATTERNS = ['solid', 'stripes', 'vstripes', 'check', 'dots', 'graphic'];
  const CLOTH = ['#3f6a4a', '#8a3a4a', '#2e3a52', '#d9a85a', '#efe6d4', '#c9909a', '#5a8ab0', '#2e2e30', '#b8622e', '#7a5a9a', '#9ab06a', '#f2c230'];
  const BODIES = ['slim', 'average', 'broad'];
  const AGES = ['young', 'adult', 'elder'];
  const FIRST = ['Rowan', 'Juniper', 'Basil', 'Clover', 'Sage', 'Willow', 'Hazel', 'Ash', 'Linden', 'Iris', 'Fern', 'Reed', 'Olive', 'Bramble', 'Marigold', 'Alder'];

  let SID = 1;
  function create(o = {}) {
    const R = Math.random, pick = a => a[Math.floor(R() * a.length)];
    const traits = o.traits || U.shuffle(TRAITS.map(t => t.id)).slice(0, 3);
    return Object.assign({
      id: 'sim' + (SID++) + '_' + Math.floor(R() * 1e4), name: pick(FIRST) + ' ' + (o.last || 'Thorne'), age: 'adult', body: pick(BODIES),
      skin: pick(SKIN), hair: pick(HAIR), hairColor: pick(HAIRC), top: pick(TOPS), topColor: pick(CLOTH), bottomColor: pick(CLOTH), traits,
      aspiration: pick(ASPIRATIONS).id,
      needs: Object.fromEntries(NEEDS.map(n => [n.k, 60 + R() * 35])), skills: Object.fromEntries(SKILLS.map(s => [s.k, 0])), rel: {},
      job: null, moodlets: [], x: 6.5, y: 11.5, queue: [], cur: null, anim: 'stand', face: [0, 1], walkT: 0, idle: 0, atWork: false, aspDone: false
    }, o);
  }
  const trait = (s, id) => s.traits.includes(id);
  function mult(s, kind, k) { let m = 1; for (const t of s.traits) { const d = TRAIT_BY[t] && TRAIT_BY[t][kind]; if (d && d[k]) m *= d[k]; } return m; }
  function likes(s, actId) { return s.traits.some(t => TRAIT_BY[t] && TRAIT_BY[t].likes && TRAIT_BY[t].likes.includes(actId)); }
  function mood(s) {
    let v = 0, w = 0;
    for (const n of NEEDS) { const wt = n.k === 'room' ? .5 : 1; v += s.needs[n.k] * wt; w += wt; }
    v = v / w * .92;
    for (const m of s.moodlets) v += MOODLETS[m.id].val * .4;
    for (const t of s.traits) if (TRAIT_BY[t] && TRAIT_BY[t].mood) v += TRAIT_BY[t].mood;
    return U.clamp(v, 0, 100);
  }
  const moodLabel = m => m > 80 ? 'Very Happy' : m > 62 ? 'Happy' : m > 45 ? 'Fine' : m > 28 ? 'Uncomfortable' : 'Miserable';
  const moodColor = m => m > 62 ? '#3fd25a' : m > 45 ? '#b9d83a' : m > 28 ? '#f2a33a' : '#e2483a';
  function addMoodlet(s, id, now) {
    const M = MOODLETS[id]; if (!M) return;
    const ex = s.moodlets.find(m => m.id === id);
    if (ex) ex.until = now + M.dur; else s.moodlets.push({ id, until: now + M.dur });
  }

  /* ───────────── drawing ───────────── */
  function drawSim(ctx, s, sx, sy, sc, t, opt = {}) {
    const anim = opt.anim || s.anim || 'stand', front = opt.front != null ? opt.front : true, flip = !!opt.flip;
    const walking = anim === 'walk' || anim === 'run', ph = s.walkT * (anim === 'run' ? 16 : 10);
    const bw = { slim: 8.5, average: 10, broad: 12.5 }[s.body] || 10, elder = s.age === 'elder', young = s.age === 'young';
    const hc = elder ? (s.hairColor === '#e6e2da' ? '#e6e2da' : '#b8b4ac') : s.hairColor;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(sc * (flip ? -1 : 1), sc);
    if (young) ctx.scale(.94, .94);
    if (anim === 'sleep' || anim === 'faint') { drawLying(ctx, s, t, hc, anim); ctx.restore(); return; }
    if (anim === 'bath') { drawBath(ctx, s, t, hc); ctx.restore(); return; }
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 4.5, 0, 0, 7); ctx.fill();
    const sit = ['sit', 'type'].includes(anim), kneel = anim === 'garden';
    let bob = walking ? Math.abs(Math.sin(ph)) * -1.5 : 0;
    if (anim === 'dance') bob = Math.sin(t * 9) * 2.5 - 1.5;
    const PZ = opt.pose && typeof Choreo !== 'undefined' ? Choreo.POSES[opt.pose] : null, pp = opt.p || 0;
    if (PZ && PZ.bob) bob += PZ.bob(t);
    const drop = sit ? 7 : kneel ? 12 : 0, hunch = elder ? 2 : 0;
    ctx.translate(0, bob + drop);
    const pants = s.top === 'overalls' ? s.bottomColor : s.bottomColor, skin = s.skin;
    const rr = (x, y, w, h, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); };
    // legs: trousers, shorts or skirt
    const legLen = sit ? 19 : kneel ? 14 : 26, bottom = s.top === 'dress' ? 'dress' : (s.bottom || 'pants');
    for (const side of [-1, 1]) {
      const lift = walking ? Math.max(0, Math.sin(ph + (side > 0 ? Math.PI : 0))) * 4 : 0;
      const lx = side * 4.5 - 3.5, top = -26 + (sit ? 7 : kneel ? 12 : 0) - drop;
      if (bottom === 'dress' || bottom === 'skirt') rr(lx + 1, top + 8, 5, legLen - 8 - lift, 2, skin);
      else if (bottom === 'shorts') { rr(lx + 1, top + 10, 5, legLen - 10 - lift, 2, skin); rr(lx, top, 7, Math.min(12, legLen - lift), 3, pants); }
      else { rr(lx, top, 7, legLen - lift, 3, pants); if (s.pattern === 'denim' || s.bottomStyle === 'jeans') { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(lx + 1, top + 3, 1, legLen - lift - 6); } }
      ctx.fillStyle = s.shoes || '#2a2420'; ctx.beginPath(); ctx.ellipse(lx + 3.5 + side * .8, top + legLen - lift, 4.5, 2.6, 0, 0, 7); ctx.fill();
      if (sit) { ctx.fillStyle = bottom === 'dress' ? s.topColor : bottom === 'skirt' ? pants : pants; ctx.beginPath(); ctx.ellipse(lx + 3.5, top + 1, 4.6, 4, 0, 0, 7); ctx.fill(); }
    }
    if (bottom === 'skirt' && !sit) { ctx.fillStyle = pants; ctx.beginPath(); ctx.moveTo(-bw + 1, -27 - drop); ctx.lineTo(bw - 1, -27 - drop); ctx.lineTo(bw + 4, -12 - drop); ctx.lineTo(-bw - 4, -12 - drop); ctx.closePath(); ctx.fill(); }
    ctx.translate(0, -drop);
    // torso
    const ty = -51 + hunch, th = 27, shower = anim === 'shower';
    const sleeves = shower ? 'none' : (s.sleeves || DEFAULT_SLEEVES[s.top] || 'short');
    const neck = s.neck || (s.top === 'tank' ? 'scoop' : 'crew'), c2 = s.topColor2 || U.shade(s.topColor, .35);
    const torsoPath = () => {
      ctx.beginPath(); ctx.moveTo(-bw, ty + 4); ctx.quadraticCurveTo(-bw, ty, -bw + 4, ty); ctx.lineTo(bw - 4, ty); ctx.quadraticCurveTo(bw, ty, bw, ty + 4);
      if (s.top === 'dress' && !shower) { ctx.lineTo(bw + 5, ty + th + 9); ctx.lineTo(-bw - 5, ty + th + 9); } else { ctx.lineTo(bw, ty + th); ctx.lineTo(-bw, ty + th); }
      ctx.closePath();
    };
    ctx.fillStyle = shower ? '#f4f4f2' : s.topColor; torsoPath(); ctx.fill();
    if (!shower) {
      ctx.save(); torsoPath(); ctx.clip();
      const pat = s.pattern || 'solid', bot = ty + th + (s.top === 'dress' ? 9 : 0);
      if (pat === 'stripes') { ctx.fillStyle = c2; for (let y = ty + 3; y < bot; y += 5) ctx.fillRect(-bw - 6, y, bw * 2 + 12, 2.2); }
      else if (pat === 'vstripes') { ctx.fillStyle = c2; for (let x = -bw - 2; x < bw + 6; x += 4.5) ctx.fillRect(x, ty, 1.8, bot - ty); }
      else if (pat === 'check') { ctx.globalAlpha = .45; ctx.fillStyle = c2; for (let y = ty + 1; y < bot; y += 6) ctx.fillRect(-bw - 6, y, bw * 2 + 12, 3); for (let x = -bw; x < bw + 6; x += 6) ctx.fillRect(x, ty, 3, bot - ty); ctx.globalAlpha = .9; ctx.fillStyle = U.shade(c2, -.2); for (let y = ty + 1; y < bot; y += 6) for (let x = -bw; x < bw + 6; x += 6) ctx.fillRect(x, y, 3, 3); ctx.globalAlpha = 1; }
      else if (pat === 'dots') { ctx.fillStyle = c2; for (let y = ty + 4, r = 0; y < bot; y += 5, r++) for (let x = -bw + (r % 2) * 2.5; x < bw + 3; x += 5) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 7); ctx.fill(); } }
      else if (pat === 'graphic') {
        ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(0, ty + 13, bw * .55, 6.5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = s.topColor; ctx.beginPath(); ctx.moveTo(0, ty + 8); ctx.quadraticCurveTo(4.5, ty + 12, 0, ty + 18); ctx.quadraticCurveTo(-4.5, ty + 12, 0, ty + 8); ctx.fill();
        ctx.strokeStyle = c2; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0, ty + 9); ctx.lineTo(0, ty + 17.5); ctx.stroke();
      }
      ctx.restore();
      if (s.top === 'overalls') { rr(-bw + 2, ty + 9, bw * 2 - 4, th - 8, 2, s.bottomColor); ctx.fillStyle = s.bottomColor; ctx.fillRect(-bw + 2, ty, 3, 10); ctx.fillRect(bw - 5, ty, 3, 10); }
      if (s.top === 'sweater') { ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(-bw, ty + th - 3, bw * 2, 3); if ((s.pattern || 'solid') === 'solid') for (let i = -bw + 3; i < bw; i += 4) ctx.fillRect(i, ty + 6, 1, th - 10); }
      if (s.top === 'blazer' || s.top === 'jacket') {
        const inner = s.top === 'jacket' ? c2 : '#f4f1ea';
        ctx.fillStyle = inner; ctx.beginPath(); ctx.moveTo(-3.5, ty); ctx.lineTo(3.5, ty); ctx.lineTo(2.5, ty + th); ctx.lineTo(-2.5, ty + th); ctx.closePath(); ctx.fill();
        ctx.fillStyle = U.shade(s.topColor, -.22); ctx.beginPath(); ctx.moveTo(-3.5, ty); ctx.lineTo(-6, ty + 10); ctx.lineTo(-2.5, ty + 13); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(3.5, ty); ctx.lineTo(6, ty + 10); ctx.lineTo(2.5, ty + 13); ctx.closePath(); ctx.fill();
        if (s.top === 'jacket') { ctx.fillStyle = '#d8d0c0'; for (const y of [ty + 15, ty + 21]) { ctx.beginPath(); ctx.arc(-4, y, .9, 0, 7); ctx.fill(); } }
      }
      if (s.top === 'apron') rr(-bw + 3, ty + 6, bw * 2 - 6, th + 3, 3, '#f4f1ea');
      if (s.top === 'hoodie') { ctx.fillStyle = U.shade(s.topColor, -.15); ctx.beginPath(); ctx.ellipse(0, ty + 1, bw - 2, 4, 0, 0, Math.PI); ctx.fill(); rr(-bw + 4, ty + 15, bw * 2 - 8, 8, 3, U.shade(s.topColor, -.1)); ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-2, ty + 2); ctx.lineTo(-2.5, ty + 9); ctx.moveTo(2, ty + 2); ctx.lineTo(2.5, ty + 9); ctx.stroke(); }
      // neckline & bare shoulders
      ctx.fillStyle = skin;
      if (sleeves === 'none') { for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * bw, ty + 6); ctx.lineTo(sx * bw, ty); ctx.lineTo(sx * (bw - 4.2), ty); ctx.quadraticCurveTo(sx * (bw - 3), ty + 4, sx * bw, ty + 7); ctx.closePath(); ctx.fill(); } }
      if (neck === 'scoop') { ctx.beginPath(); ctx.moveTo(-5, ty - .5); ctx.quadraticCurveTo(0, ty + 9, 5, ty - .5); ctx.closePath(); ctx.fill(); }
      else if (neck === 'v') { ctx.beginPath(); ctx.moveTo(-4, ty - .5); ctx.lineTo(0, ty + 8); ctx.lineTo(4, ty - .5); ctx.closePath(); ctx.fill(); }
      else if (!['blazer', 'jacket', 'hoodie'].includes(s.top)) { ctx.beginPath(); ctx.arc(0, ty - .3, 3.6, 0, Math.PI); ctx.fill(); ctx.strokeStyle = U.shade(s.topColor, -.2); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, ty - .3, 3.8, .1, Math.PI - .1); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-bw + 1, ty + 2, 3, th - 4);
    } else { ctx.fillStyle = 'rgba(160,200,230,.5)'; for (let i = 0; i < 9; i++) ctx.fillRect(-14 + ((i * 7 + Math.floor(t * 20)) % 28), -90 + ((i * 13 + t * 120) % 70), 1, 6); }
    // arms with sleeves
    const sleeveCol = s.pattern === 'stripes' || s.pattern === 'check' ? s.topColor : s.topColor;
    const arm = (side, ang, len = 22, hold) => {
      ctx.save(); ctx.translate(side * (bw - 1), ty + 3); ctx.rotate(ang);
      rr(-2.6, 0, 5.2, len, 2.6, sleeves === 'long' ? sleeveCol : skin);
      if (sleeves === 'short') { rr(-2.9, -1, 5.8, 8.5, 2.6, sleeveCol); if (s.pattern === 'stripes') { ctx.fillStyle = c2; ctx.fillRect(-2.9, 2, 5.8, 1.6); ctx.fillRect(-2.9, 6, 5.8, 1.4); } }
      if (sleeves === 'long') { if (s.pattern === 'stripes') { ctx.fillStyle = c2; for (let y = 2; y < len - 2; y += 5) ctx.fillRect(-2.6, y, 5.2, 1.8); } ctx.fillStyle = U.shade(sleeveCol, -.15); ctx.fillRect(-2.6, len - 3.5, 5.2, 1.5); }
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, len, 2.9, 0, 7); ctx.fill();
      if (hold) hold(len, ang);
      ctx.restore();
    };
    const sw = walking ? Math.sin(ph) * .5 : 0;
    const holdItem = {
      cook: l => { ctx.fillStyle = '#2e2e30'; ctx.beginPath(); ctx.ellipse(0, l + 3, 7, 2.5, 0, 0, 7); ctx.fill(); ctx.fillRect(-1, l - 2, 2, 5); },
      eat: l => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, l + 2, 6, 2.2, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#d98a3a'; ctx.beginPath(); ctx.arc(0, l, 2.5, 0, 7); ctx.fill(); },
      read: l => { ctx.fillStyle = '#8a3a3a'; ctx.fillRect(-6, l - 2, 12, 8); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(-5, l - 1, 10, 6); },
      water: l => { ctx.fillStyle = '#5f8a7a'; ctx.fillRect(-5, l - 1, 10, 7); ctx.fillRect(4, l, 7, 2); ctx.fillStyle = '#9fd6ff'; for (let i = 0; i < 3; i++) ctx.fillRect(11 + i, l + 3 + ((t * 30 + i * 4) % 9), 1, 2); },
      paint: l => { ctx.fillStyle = '#c9a54a'; ctx.fillRect(-.7, l - 10, 1.4, 12); ctx.fillStyle = '#c94a4a'; ctx.fillRect(-1, l - 12, 2, 3); },
      garden: l => { ctx.fillStyle = '#8a8a8a'; ctx.fillRect(-1, l, 2, 7); }
    };
    if (PZ) {
      const a = PZ.arms(t, pp);
      // props are in front of the body, so they are hidden when the Sim faces away
      arm(-1, a[0], a[2] || 21, front && PZ.holdL && ((l, g) => PZ.holdL(ctx, l, g, t, pp, s)));
      arm(1, a[1], a[3] || 21, front && PZ.holdR && ((l, g) => PZ.holdR(ctx, l, g, t, pp, s)));
    }
    else if (anim === 'dance') { arm(-1, Math.PI + .5 + Math.sin(t * 8) * .4, 21); arm(1, -Math.PI - .5 - Math.sin(t * 8 + 1) * .4, 21); }
    else if (anim === 'talk') { arm(-1, .1, 22); arm(1, -.5 - Math.abs(Math.sin(t * 5)) * .9, 20); }
    else if (['cook', 'type', 'read', 'water'].includes(anim)) { arm(-1, -.5, 18, anim === 'type' ? null : holdItem[anim]); arm(1, .5, 18); }
    else if (anim === 'eat') { arm(-1, .15, 22); arm(1, -.9 - Math.max(0, Math.sin(t * 3)) * 1.4, 17, holdItem.eat); }
    else if (anim === 'paint') { arm(-1, .25, 21); arm(1, -1.2 + Math.sin(t * 6) * .3, 20, holdItem.paint); }
    else if (anim === 'garden') { arm(-1, -.6, 19, holdItem.garden); arm(1, .6 + Math.sin(t * 6) * .2, 19); }
    else if (anim === 'watch' || anim === 'sit') { arm(-1, .25, 20); arm(1, -.25, 20); }
    else { arm(-1, .12 + sw, 22); arm(1, -.12 - sw, 22); }
    // head
    const hy = -62 + hunch + (walking ? 0 : Math.sin(t * 1.6) * .4);
    ctx.fillStyle = skin; ctx.fillRect(-2.5, ty - 4, 5, 5);
    const back = !front;
    if (['long', 'ponytail', 'curly'].includes(s.hair) && !back) drawHairBack(ctx, s.hair, hc, hy);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0, hy, 9.5, 10.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(-9.3, hy + 1, 2.4, 0, 7); ctx.arc(9.3, hy + 1, 2.4, 0, 7); ctx.fill();
    if (!back) drawFace(ctx, s, hy, t, opt.mood == null ? 60 : opt.mood, anim, PZ && PZ.face ? (typeof PZ.face === 'function' ? PZ.face(t) : PZ.face) : null);
    drawHair(ctx, s.hair, hc, hy, back);
    ctx.restore();
  }
  function drawFace(ctx, s, hy, t, m, anim, ex) {
    const blink = (Math.floor(t * 10 + s.id.length * 7) % 47) === 0 || anim === 'sleep';
    ctx.fillStyle = '#2a1d14';
    if (ex) { drawExpression(ctx, s, hy, t, ex); return; }
    if (blink) { ctx.fillRect(-5, hy - 1, 3, 1.2); ctx.fillRect(2, hy - 1, 3, 1.2); }
    else { ctx.beginPath(); ctx.ellipse(-3.6, hy - .8, 1.4, 1.8, 0, 0, 7); ctx.ellipse(3.6, hy - .8, 1.4, 1.8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-3.4, hy - 1.8, .8, .8); ctx.fillRect(3.8, hy - 1.8, .8, .8); }
    ctx.strokeStyle = U.shade(s.hairColor, .1); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-5.5, hy - 4.4 - (m < 30 ? -.8 : 0)); ctx.lineTo(-2, hy - 4.8); ctx.moveTo(5.5, hy - 4.4 - (m < 30 ? -.8 : 0)); ctx.lineTo(2, hy - 4.8); ctx.stroke();
    drawBeard(ctx, s, hy);
    ctx.strokeStyle = '#8a3a2a'; ctx.lineWidth = 1.2; ctx.beginPath();
    if (anim === 'talk' || anim === 'eat') { ctx.fillStyle = '#7a2a22'; ctx.ellipse(0, hy + 5, 2, 1 + Math.abs(Math.sin(t * 9)) * 1.6, 0, 0, 7); ctx.fill(); }
    else if (m > 55) { ctx.arc(0, hy + 3, 3.2, .3, Math.PI - .3); ctx.stroke(); }
    else if (m > 32) { ctx.moveTo(-2.5, hy + 5); ctx.lineTo(2.5, hy + 5); ctx.stroke(); }
    else { ctx.arc(0, hy + 7.5, 3, Math.PI + .5, -.5); ctx.stroke(); }
    ctx.fillStyle = 'rgba(230,110,110,.25)'; ctx.beginPath(); ctx.arc(-5.5, hy + 2.5, 2, 0, 7); ctx.arc(5.5, hy + 2.5, 2, 0, 7); ctx.fill();
    if (s.age === 'elder') { ctx.strokeStyle = 'rgba(90,60,40,.4)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(-7, hy + 1); ctx.lineTo(-6, hy + 2.5); ctx.moveTo(7, hy + 1); ctx.lineTo(6, hy + 2.5); ctx.stroke(); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = .9; ctx.beginPath(); ctx.arc(-3.6, hy - .8, 2.6, 0, 7); ctx.moveTo(6.2, hy - .8); ctx.arc(3.6, hy - .8, 2.6, 0, 7); ctx.stroke(); }
  }
  function drawBeard(ctx, s, hy) {
    if (!s.beard) return;
    {
      const bc = U.shade(s.hairColor, -.15);
      ctx.save(); ctx.globalAlpha = s.beard === 'stubble' ? .38 : .95; ctx.fillStyle = bc;
      ctx.beginPath(); ctx.moveTo(-9.6, hy); ctx.quadraticCurveTo(-9.4, hy + 11, 0, hy + 12.8); ctx.quadraticCurveTo(9.4, hy + 11, 9.6, hy);
      ctx.lineTo(7.5, hy + 2); ctx.quadraticCurveTo(6, hy + 8.5, 0, hy + 8.2); ctx.quadraticCurveTo(-6, hy + 8.5, -7.5, hy + 2); ctx.closePath(); ctx.fill();
      if (s.beard === 'beard') { ctx.beginPath(); ctx.ellipse(0, hy + 3.6, 4.6, 1.5, 0, 0, 7); ctx.fill(); }
      else for (let i = 0; i < 14; i++) { ctx.fillRect(-6 + (i * 37 % 12), hy + 3 + (i * 13 % 5), .9, .9); }
      ctx.restore();
    }
  }
  /* Expressive faces for choreographed beats. */
  function drawExpression(ctx, s, hy, t, ex) {
    const ink = '#2a1d14', lip = '#8a3a2a', mouthIn = '#7a2a22';
    drawBeard(ctx, s, hy);
    const happyEyes = () => { ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(-3.6, hy, 1.8, Math.PI + .3, -.3); ctx.moveTo(5.4, hy - .5); ctx.arc(3.6, hy, 1.8, Math.PI + .3, -.3); ctx.stroke(); };
    const dotEyes = (dy = 0, dx = 0, h = 1.8) => { ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(-3.6 + dx, hy - .8 + dy, 1.4, h, 0, 0, 7); ctx.ellipse(3.6 + dx, hy - .8 + dy, 1.4, h, 0, 0, 7); ctx.fill(); if (h > 1) { ctx.fillStyle = '#fff'; ctx.fillRect(-3.4 + dx, hy - 1.8 + dy, .8, .8); ctx.fillRect(3.8 + dx, hy - 1.8 + dy, .8, .8); } };
    const brows = (l, r, tilt = 0) => { ctx.strokeStyle = U.shade(s.hairColor, .1); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-5.5, hy - 4.4 + l + tilt); ctx.lineTo(-2, hy - 4.8 + l - tilt); ctx.moveTo(5.5, hy - 4.4 + r + tilt); ctx.lineTo(2, hy - 4.8 + r - tilt); ctx.stroke(); };
    const openMouth = (w, h, y = 5) => { ctx.fillStyle = mouthIn; ctx.beginPath(); ctx.ellipse(0, hy + y, w, h, 0, 0, 7); ctx.fill(); if (h > 1.6) { ctx.fillStyle = '#e86a6a'; ctx.beginPath(); ctx.ellipse(0, hy + y + h * .5, w * .6, h * .35, 0, 0, 7); ctx.fill(); } };
    const smile = (r = 3.2, y = 3) => { ctx.strokeStyle = lip; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, hy + y, r, .3, Math.PI - .3); ctx.stroke(); };
    switch (ex) {
      case 'laugh': happyEyes(); brows(-1, -1); ctx.fillStyle = mouthIn; ctx.beginPath(); ctx.arc(0, hy + 3.5, 3.6 + Math.abs(Math.sin(t * 14)) * .6, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-2.6, hy + 3.5, 5.2, 1); break;
      case 'yum': happyEyes(); brows(-.6, -.6); smile(3.4, 2.6); ctx.fillStyle = '#e86a6a'; ctx.beginPath(); ctx.ellipse(1.6, hy + 6.2, 1.4, 1.1, 0, 0, 7); ctx.fill(); break;
      case 'chew': { dotEyes(0, 0, 1.2 + Math.abs(Math.sin(t * 3)) * .6); brows(0, 0); const k = Math.abs(Math.sin(t * 12)); ctx.fillStyle = s.skin; ctx.beginPath(); ctx.ellipse(-6, hy + 3.5, 2.6 + k * .8, 2.2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = lip; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-2.2, hy + 5 + k * .6); ctx.quadraticCurveTo(0, hy + 6 - k, 2.2, hy + 5 + k * .6); ctx.stroke(); break; }
      case 'sing': happyEyes(); brows(-1.2, -1.2); openMouth(1.8, 1.8 + Math.abs(Math.sin(t * 5)) * 1.2); break;
      case 'talk': dotEyes(); brows(-.5, -.5); openMouth(2, .8 + Math.abs(Math.sin(t * 9)) * 1.6); break;
      case 'focus': dotEyes(1, 0, 1.3); brows(1.4, 1.4, -.8); ctx.strokeStyle = lip; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-2, hy + 5); ctx.lineTo(2, hy + 5); ctx.stroke(); ctx.fillStyle = '#e86a6a'; ctx.beginPath(); ctx.ellipse(2.4, hy + 5.6, 1, .8, 0, 0, 7); ctx.fill(); break;
      case 'yawn': ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-5, hy - .5); ctx.lineTo(-2.2, hy); ctx.moveTo(5, hy - .5); ctx.lineTo(2.2, hy); ctx.stroke(); brows(-1.5, -1.5); openMouth(2.6, 3.2, 5.5); break;
      case 'angry': dotEyes(.6); ctx.strokeStyle = U.shade(s.hairColor, .1); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-5.5, hy - 5.4); ctx.lineTo(-1.5, hy - 3.2); ctx.moveTo(5.5, hy - 5.4); ctx.lineTo(1.5, hy - 3.2); ctx.stroke(); openMouth(2.4, 1 + Math.abs(Math.sin(t * 10)) * 1.2, 6); ctx.fillStyle = 'rgba(230,80,80,.3)'; ctx.beginPath(); ctx.arc(-5.5, hy + 2.5, 2.4, 0, 7); ctx.arc(5.5, hy + 2.5, 2.4, 0, 7); ctx.fill(); return;
      case 'curious': dotEyes(-.3, Math.sin(t * .7) * .8, 2); brows(-1.6, -.4); ctx.strokeStyle = lip; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(.5, hy + 4.2, 2.2, .4, Math.PI - .6); ctx.stroke(); break;
      case 'proud': happyEyes(); brows(-1, -1); smile(3.8, 2.4); ctx.fillStyle = '#fff'; ctx.fillRect(-2.6, hy + 4.6, 5.2, .9); break;
      case 'idea': dotEyes(-.6, 0, 2.2); brows(-2, -2); openMouth(1.4, 1.4); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(9, hy - 16, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#b9b9b9'; ctx.fillRect(7.8, hy - 13.4, 2.4, 1.8); break;
      case 'bored': ctx.fillStyle = ink; ctx.fillRect(-5, hy - 1.2, 3, 1.4); ctx.fillRect(2, hy - 1.2, 3, 1.4); ctx.beginPath(); ctx.ellipse(-3.6, hy - .2, 1.3, .9, 0, 0, Math.PI); ctx.ellipse(3.6, hy - .2, 1.3, .9, 0, 0, Math.PI); ctx.fill(); brows(.6, .6); ctx.strokeStyle = lip; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-2.4, hy + 5.4); ctx.lineTo(2.4, hy + 4.8); ctx.stroke(); break;
      default: dotEyes(); brows(0, 0); smile();
    }
    ctx.fillStyle = 'rgba(230,110,110,.3)'; ctx.beginPath(); ctx.arc(-5.5, hy + 2.5, 2, 0, 7); ctx.arc(5.5, hy + 2.5, 2, 0, 7); ctx.fill();
  }
  function drawHairBack(ctx, style, c, hy) {
    ctx.fillStyle = U.shade(c, -.12);
    if (style === 'long') { ctx.beginPath(); ctx.moveTo(-11, hy - 4); ctx.lineTo(-12, hy + 20); ctx.quadraticCurveTo(0, hy + 24, 12, hy + 20); ctx.lineTo(11, hy - 4); ctx.fill(); }
    if (style === 'curly') { for (const [x, y] of [[-10, hy + 6], [10, hy + 6], [-11, hy - 2], [11, hy - 2]]) { ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); } }
  }
  function drawHair(ctx, style, c, hy, back) {
    ctx.fillStyle = c;
    const cap = (ext = 0) => { ctx.beginPath(); ctx.ellipse(0, hy - 3, 10.4 + ext, 9 + ext, 0, Math.PI, 0); ctx.lineTo(10.4 + ext, hy - 1); ctx.quadraticCurveTo(4, hy - 7, -10.4 - ext, hy - 1); ctx.closePath(); ctx.fill(); };
    if (back && style !== 'bald') { ctx.beginPath(); ctx.ellipse(0, hy - 1, 10.6, 11.4, 0, 0, 7); ctx.fill(); }
    switch (style) {
      case 'short': cap(); ctx.beginPath(); ctx.moveTo(-10, hy - 4); ctx.quadraticCurveTo(-4, hy - 10, 4, hy - 7); ctx.lineTo(-10, hy); ctx.fill(); break;
      case 'pixie': cap(.5); ctx.beginPath(); ctx.moveTo(-10, hy - 2); ctx.lineTo(-4, hy - 6); ctx.lineTo(-1, hy - 3); ctx.lineTo(3, hy - 7); ctx.lineTo(10, hy - 2); ctx.lineTo(10, hy - 8); ctx.lineTo(-10, hy - 8); ctx.fill(); break;
      case 'long': cap(.8); if (!back) { ctx.fillRect(-11.5, hy - 4, 3.5, 20); ctx.fillRect(8, hy - 4, 3.5, 20); } break;
      case 'bun': cap(); ctx.beginPath(); ctx.arc(0, hy - 13, 5.5, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(-1.5, hy - 14.5, 2, 0, 7); ctx.fill(); break;
      case 'curly': for (let i = 0; i < 9; i++) { const a = Math.PI + i * Math.PI / 8; ctx.beginPath(); ctx.arc(Math.cos(a) * 9.5, hy - 2 + Math.sin(a) * 9, 4.4, 0, 7); ctx.fill(); } break;
      case 'ponytail': cap(); ctx.beginPath(); ctx.ellipse(back ? 0 : 10, hy - 2, 3.5, 9, back ? 0 : .5, 0, 7); ctx.fill(); break;
      case 'buzz': ctx.globalAlpha = .75; cap(-.3); ctx.globalAlpha = 1; break;
      case 'bald': ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(-3, hy - 7, 3, 1.5, -.4, 0, 7); ctx.fill(); break;
    }
    if (style !== 'bald' && style !== 'buzz') { ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.ellipse(-3.5, hy - 9, 3.5, 1.4, -.3, 0, 7); ctx.fill(); }
  }
  function drawLying(ctx, s, t, hc, anim) {
    // drawn in screen space around the bed/lie point; head at (-14,-12), body under blanket
    if (anim === 'faint') {
      ctx.fillStyle = s.topColor; ctx.beginPath(); ctx.ellipse(2, -4, 16, 6, -.2, 0, 7); ctx.fill();
      ctx.fillStyle = s.bottomColor; ctx.beginPath(); ctx.ellipse(18, 0, 10, 4, -.2, 0, 7); ctx.fill();
    } else { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.ellipse(4, -2, 18, 7, -.45, 0, 7); ctx.fill(); }
    ctx.fillStyle = s.skin; ctx.beginPath(); ctx.ellipse(-14, -14, 8.5, 7.5, -.3, 0, 7); ctx.fill();
    ctx.fillStyle = hc; ctx.beginPath(); ctx.ellipse(-18, -18, 8, 6, -.3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2a1d14'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-15, -13); ctx.lineTo(-12, -12); ctx.moveTo(-10, -15); ctx.lineTo(-7.5, -14); ctx.stroke();
    ctx.font = 'bold 11px Nunito, sans-serif'; ctx.fillStyle = '#5a6ab0';
    const k = (t * .7) % 1; ctx.globalAlpha = 1 - k; ctx.fillText('z', -6 + k * 8, -26 - k * 18); ctx.font = 'bold 8px Nunito, sans-serif'; ctx.fillText('z', -2 + k * 10, -34 - k * 14); ctx.globalAlpha = 1;
  }
  function drawBath(ctx, s, t, hc) {
    ctx.fillStyle = s.skin; ctx.beginPath(); ctx.ellipse(0, -30, 8.5, 9.5, 0, 0, 7); ctx.fill(); ctx.fillRect(-6, -22, 12, 5);
    drawHair(ctx, s.hair, hc, -30, false);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 + t; ctx.beginPath(); ctx.arc(Math.cos(a) * 12, -16 + Math.sin(a) * 3, 3.5 + (i % 3), 0, 7); ctx.fill(); }
  }
  function plumbob(ctx, x, y, sc, t, col) {
    const w = 6 * sc * Math.abs(Math.cos(t * 1.8)) + 1.2 * sc, h = 11 * sc;
    const g = ctx.createLinearGradient(x - w, y, x + w, y); g.addColorStop(0, U.shade(col, .45)); g.addColorStop(.5, col); g.addColorStop(1, U.shade(col, -.35));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); ctx.lineTo(x - w, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .8; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x - w * .5, y - h * .25); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
  }
  function bubble(ctx, x, y, sc, icon, kind = 'thought') {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.fillStyle = kind === 'speech' ? '#fffdf4' : '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, -14, 15, 12, 0, 0, 7); ctx.fill(); ctx.stroke();
    if (kind === 'thought') { ctx.beginPath(); ctx.arc(-6, 2, 3, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(-9, 7, 1.8, 0, 7); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(-8, 5); ctx.lineTo(2, -2); ctx.fill(); }
    ctx.font = '13px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, 0, -13);
    ctx.restore();
  }

  return { NEEDS, SKILLS, TRAITS, TRAIT_BY, ASPIRATIONS, CAREERS, PROMO_SKILL, MOODLETS, SOCIAL, SKIN, HAIR, HAIRC, TOPS, PATTERNS, DEFAULT_SLEEVES, CLOTH, BODIES, AGES, level, nextAt, create, trait, mult, likes, mood, moodLabel, moodColor, addMoodlet, drawSim, plumbob, bubble };
})();
