// Game controller: wires the pure simulation to the renderer, input and DOM UI.

import { sfx, setMuted, unlockAudio } from './game/audio';
import { makeEffect, stepEffects, type Effect } from './game/effects';
import { Renderer, smooth, type Ghost, type Scene, type VillagerSprite } from './game/render';
import { loadSave, writeSave } from './game/storage';
import { THEME } from './game/theme';
import { LEVELS } from './levels/levels';
import {
  FOG_RULES,
  LANTERNS,
  bestOrder,
  isPlaceable,
  keeperLeg,
  lightOf,
  parseLevel,
  planCost,
  simulate,
  type Dir,
  type Frame,
  type LanternType,
  type Level,
  type LevelDef,
  type Placement,
  type PlanCost,
  type SimResult,
} from './sim';

// ------------------------------------------------------------------ DOM

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  canvas: $<HTMLCanvasElement>('board'),
  wrap: $('board-wrap'),
  toast: $('toast'),
  result: $('result'),
  nightLabel: $('night-label'),
  levelName: $('level-name'),
  ruleIcon: $('rule-icon'),
  ruleName: $('rule-name'),
  ruleText: $('rule-text'),
  goal: $('goal'),
  oilNum: $('oil-num'),
  oilBar: $('oil-bar'),
  palette: $('palette'),
  undo: $<HTMLButtonElement>('btn-undo'),
  clear: $<HTMLButtonElement>('btn-clear'),
  play: $<HTMLButtonElement>('btn-play'),
  skip: $<HTMLButtonElement>('btn-skip'),
  retry: $<HTMLButtonElement>('btn-retry'),
  menuBtn: $('btn-menu'),
  sound: $('btn-sound'),
  menu: $('menu'),
  levelGrid: $('level-grid'),
  modes: $('menu-modes'),
  patterns: $<HTMLInputElement>('opt-patterns'),
  tips: $('tips'),
};

const renderer = new Renderer(el.canvas);
const save = loadSave();
setMuted(save.muted);
el.patterns.checked = save.patterns;

// ------------------------------------------------------------------ state

type Mode = 'planning' | 'playing' | 'result';
export type Context = { kind: 'story'; index: number };

const MAX_LANTERNS = 7;
const SWALLOW_FLIGHT = 0.7;

let ctxInfo: Context = { kind: 'story', index: 0 };
let level: Level;
let placements: Placement[] = [];
let undoStack: Placement[][] = [];
let cost: PlanCost;
let selected: LanternType = 'basic';
let reflectorDir: Dir = 1;
let mode: Mode = 'planning';
let hover: { x: number; y: number } | null = null;
let hoverIsMouse = false;
let frame0: Frame;
let preview: Uint8Array | null = null;
let result: SimResult | null = null;
let play = { idx: 0, t: 0, turnDur: 0.5, fired: 0, endTimer: 0 };
let effects: Effect[] = [];
let shake = 0;
let time = 0;
const swallowAnim = new Map<number, { t0: number; fx: number; fy: number; roof: number; spin: boolean }>();
const housesLit = new Set<number>();
let toastTimer = 0;

// ------------------------------------------------------------------ level lifecycle

function loadLevel(def: LevelDef, info: Context) {
  ctxInfo = info;
  level = parseLevel(def);
  placements = [];
  undoStack = [];
  selected = def.lanterns[0];
  mode = 'planning';
  result = null;
  effects = [];
  el.result.hidden = true;

  el.nightLabel.textContent = `Night ${info.index + 1} of ${LEVELS.length}`;
  el.levelName.textContent = def.name;
  const fog = FOG_RULES[def.fog];
  el.ruleIcon.textContent = fog.icon;
  el.ruleName.textContent = fog.name + ':';
  el.ruleText.textContent = fog.rule;
  buildPalette();
  buildGoal();
  layout();
  refreshPlan();
  if (def.hint) toast(def.hint, 4000);
}

function buildGoal() {
  const [a, b, c] = level.def.stars;
  const dots = level.villagers
    .map((v, n) => `<span class="dot" title="${v.name}" style="background:${THEME.villagers[n % THEME.villagers.length]}"></span>`)
    .join('');
  const tiers = a === c ? `Get ${c} home` : `★ ${a} · ★★ ${b} · ★★★ ${c} home`;
  el.goal.innerHTML = `${dots}<span>${tiers}</span>`;
}

function buildPalette() {
  el.palette.innerHTML = '';
  const prev = ctxInfo.kind === 'story' && ctxInfo.index > 0 ? LEVELS[ctxInfo.index - 1].lanterns : null;
  level.def.lanterns.forEach((type, k) => {
    const spec = LANTERNS[type];
    const b = document.createElement('button');
    b.dataset.type = type;
    b.title = `${spec.name} (${k + 1}): ${spec.rule}`;
    const c = document.createElement('canvas');
    c.width = 80;
    c.height = 80;
    b.appendChild(c);
    b.insertAdjacentHTML(
      'beforeend',
      `<span class="pname">${spec.name}</span><span class="pcost">${spec.cost} oil${type === 'reflector' ? ' · tap to turn' : ''}</span>` +
        (prev && !prev.includes(type) ? '<span class="pnew">NEW</span>' : ''),
    );
    b.addEventListener('click', () => selectType(type));
    el.palette.appendChild(b);
  });
  paintPalette();
}

function paintPalette() {
  el.palette.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    const type = b.dataset.type as LanternType;
    b.classList.toggle('sel', type === selected);
    const c = b.querySelector('canvas')!;
    const cx = c.getContext('2d')!;
    cx.clearRect(0, 0, 80, 80);
    renderer.drawLantern(type, 40, 44, 72, reflectorDir, 1, 0, cx);
  });
}

function selectType(type: LanternType) {
  unlockAudio();
  if (type === 'reflector' && selected === 'reflector') reflectorDir = ((reflectorDir + 1) % 4) as Dir;
  selected = type;
  sfx.select();
  paintPalette();
}

function layout() {
  if (!level) return;
  const wide = window.innerWidth >= 860;
  const boxW = el.wrap.clientWidth;
  const boxH = wide ? window.innerHeight - 150 : Math.min(window.innerHeight * 0.6, 640);
  renderer.resize(level, boxW, boxH);
}

// ------------------------------------------------------------------ planning

function refreshPlan() {
  cost = planCost(level, { placements });
  const r = simulate(level, { placements }, { turns: 1, ignoreBudget: true });
  frame0 = r.frames[0];
  const next = r.frames[1];
  preview = next ? next.fog.map((v, i) => (v && !frame0.fog[i] ? 1 : 0)) : null;
  updateOil();
  el.undo.disabled = undoStack.length === 0 || mode !== 'planning';
  el.clear.disabled = placements.length === 0 || mode !== 'planning';
}

function setPlacements(list: Placement[], pushUndo = true) {
  if (pushUndo) undoStack.push(placements);
  placements = bestOrder(level, { placements: list }).placements;
  refreshPlan();
}

function candidateAt(x: number, y: number): Placement {
  return { x, y, type: selected, ...(selected === 'reflector' ? { dir: reflectorDir } : {}) };
}

function tapTile(x: number, y: number) {
  unlockAudio();
  if (mode !== 'planning') return;
  const existing = placements.findIndex((p) => p.x === x && p.y === y);
  if (existing >= 0) {
    setPlacements(placements.filter((_, k) => k !== existing));
    sfx.remove();
    effects.push(makeEffect('puff', x + 0.5, y + 0.5, { life: 0.4, size: 0.6 }));
    return;
  }
  const i = y * level.w + x;
  if (!isPlaceable(level.tiles[i])) {
    toast('Lanterns go on grass or bridges.', 1600, true);
    sfx.nope();
    return;
  }
  if (!keeperLeg(level, level.keeper, i)) {
    toast("The Keeper can't get there.", 1600, true);
    sfx.nope();
    return;
  }
  if (placements.length >= MAX_LANTERNS) {
    toast(`That's plenty of lanterns (max ${MAX_LANTERNS}).`, 1600, true);
    sfx.nope();
    return;
  }
  const next = bestOrder(level, { placements: [...placements, candidateAt(x, y)] });
  const c = planCost(level, next);
  if (c.oil > level.def.oil) {
    toast(`Not enough oil: that needs ${c.oil}, you have ${level.def.oil}.`, 1800, true);
    sfx.nope();
    el.oilBar.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], 200);
    return;
  }
  setPlacements(next.placements);
  sfx.place();
  for (let k = 0; k < 6; k++)
    effects.push(makeEffect('spark', x + 0.5, y + 0.5, { vx: Math.cos(k) * 1.5, vy: Math.sin(k) * 1.5 - 1, life: 0.5 }));
}

function undo() {
  if (mode !== 'planning' || !undoStack.length) return;
  placements = undoStack.pop()!;
  refreshPlan();
  sfx.remove();
}

function clearPlan() {
  if (mode !== 'planning' || !placements.length) return;
  setPlacements([]);
  sfx.remove();
}

function ghost(): Ghost | null {
  if (mode !== 'planning' || !hover || !hoverIsMouse) return null;
  const { x, y } = hover;
  if (placements.some((p) => p.x === x && p.y === y)) return null;
  if (!isPlaceable(level.tiles[y * level.w + x])) return null;
  const p = candidateAt(x, y);
  const next = planCost(level, bestOrder(level, { placements: [...placements, p] }));
  const delta = next.oil - cost.oil;
  const ok = next.oil <= level.def.oil && keeperLeg(level, level.keeper, y * level.w + x) !== null;
  return { placement: p, lit: lightOf(level, p), ok, label: `${ok ? '+' : '✕ +'}${delta} oil` };
}

function updateOil() {
  const budget = level.def.oil;
  const g = ghost();
  const ghostExtra = g ? planCost(level, bestOrder(level, { placements: [...placements, g.placement] })).oil - cost.oil : 0;
  const n = Math.max(budget, cost.oil);
  let html = '';
  for (let k = 0; k < n; k++) {
    let cls = '';
    if (k >= budget) cls = 'over';
    else if (k < cost.walkOil) cls = 'walk';
    else if (k < cost.oil) cls = 'lamp';
    else if (k < cost.oil + ghostExtra) cls = 'ghost';
    html += `<i class="${cls}"></i>`;
  }
  el.oilBar.innerHTML = html;
  el.oilNum.textContent = `${cost.oil} / ${budget}`;
  el.oilNum.parentElement!.classList.toggle('over', cost.oil > budget);
}

// ------------------------------------------------------------------ playback

function startPlay() {
  unlockAudio();
  if (mode !== 'planning') return;
  if (!cost.valid) {
    toast(cost.error ?? 'That plan does not work.', 1800, true);
    sfx.nope();
    return;
  }
  result = simulate(level, { placements });
  mode = 'playing';
  const turns = result.frames.length - 1;
  // Whole night fits in ~18 s (well under the 20 s cap), and short nights don't drag.
  play = { idx: 0, t: 0, turnDur: Math.min(0.62, Math.max(0.3, 18 / Math.max(1, turns))), fired: 0, endTimer: 0 };
  swallowAnim.clear();
  housesLit.clear();
  effects = [];
  el.result.hidden = true;
  hideToast();
  sfx.play();
  syncButtons();
}

function fireEvents(frame: Frame, quiet: boolean) {
  let swallows = 0;
  for (const e of frame.events) {
    const ex = (e.type === 'step' ? e.to : e.at) % level.w + 0.5;
    const ey = Math.floor((e.type === 'step' ? e.to : e.at) / level.w) + 0.5;
    switch (e.type) {
      case 'home':
        housesLit.add(e.at);
        if (quiet) break;
        sfx.home();
        effects.push(makeEffect('text', ex, ey - 0.4, { text: 'Home!', life: 1, color: '#ffe9a8' }));
        for (let k = 0; k < 5; k++)
          effects.push(makeEffect('spark', ex, ey, { vx: (k - 2) * 0.6, vy: -2, g: 3, life: 0.7 }));
        break;
      case 'swallow': {
        swallows++;
        swallowAnim.set(e.villager, { t0: quiet ? -99 : time, fx: ex - 0.5, fy: ey - 0.5, roof: e.roof, spin: e.reaction === 'cartwheel' });
        if (quiet) break;
        sfx.swallow();
        const r = REACTION_FX[e.reaction];
        effects.push(makeEffect('puff', ex, ey, { life: 0.7, size: 1.2 }));
        effects.push(makeEffect('text', ex, ey - 0.5, { text: r.say, life: 1.4, color: '#ffffff' }));
        r.items.forEach((item, k) =>
          effects.push(makeEffect('item', ex, ey, { text: item, vx: (k - 1) * 1.4, vy: -3, g: 9, life: 1.1 })),
        );
        break;
      }
      case 'gulp':
        if (quiet) break;
        sfx.gulp();
        effects.push(makeEffect('ring', ex, ey, { life: 0.6, color: '#e8b06a', size: 1 }));
        effects.push(makeEffect('text', ex, ey - 0.5, { text: 'GULP!', life: 1, color: '#e8b06a' }));
        for (const c of e.cleared)
          effects.push(makeEffect('puff', (c % level.w) + 0.5, Math.floor(c / level.w) + 0.5, { life: 0.5, size: 0.7 }));
        break;
      case 'burnout':
        if (quiet) break;
        sfx.burnout();
        effects.push(makeEffect('puff', ex, ey - 0.2, { life: 0.6, size: 0.5 }));
        effects.push(makeEffect('text', ex, ey - 0.5, { text: 'fizzle…', life: 0.9, color: '#ffb38a' }));
        break;
      case 'step':
        break;
    }
  }
  // Screen shake only for a big swallow.
  if (!quiet && swallows >= 2) shake = 1;
}

const REACTION_FX: Record<string, { say: string; items: string[] }> = {
  groceries: { say: 'My turnips!', items: ['🥕', '🍞', '🥚'] },
  roof: { say: 'Eep! Up we go!', items: [] },
  hat: { say: 'My hat!', items: ['🎩'] },
  cartwheel: { say: 'Wheee—!', items: [] },
  teapot: { say: 'Not the teapot!', items: ['🫖'] },
};

function updatePlay(dt: number) {
  if (!result) return;
  const last = result.frames.length - 1;
  if (play.idx < last) {
    play.t += dt / play.turnDur;
    // Events land halfway through the step into their frame.
    if (play.t >= 0.5 && play.fired === play.idx) {
      fireEvents(result.frames[play.idx + 1], false);
      play.fired = play.idx + 1;
    }
    if (play.t >= 1) {
      play.idx++;
      play.t = play.idx < last ? play.t - 1 : 1;
    }
  } else {
    play.endTimer += dt;
    if (play.endTimer > 0.9) showResult();
  }
}

function skip() {
  if (mode !== 'playing' || !result) return;
  const last = result.frames.length - 1;
  for (let k = play.fired + 1; k <= last; k++) fireEvents(result.frames[k], true);
  play = { ...play, idx: last, t: 1, fired: last };
  showResult();
}

function showResult() {
  if (!result || mode === 'result') return;
  mode = 'result';
  const r = result;
  const won = r.won;
  if (won) sfx.win();
  else sfx.lose();
  if (ctxInfo.kind === 'story') {
    const id = level.def.id;
    save.stars[id] = Math.max(save.stars[id] ?? 0, r.stars);
    writeSave(save);
  }
  const starsHtml = [1, 2, 3].map((k) => `<span class="${k <= r.stars ? '' : 'off'}">★</span>`).join('');
  const title = won ? (r.stars === 3 ? 'Everyone’s home!' : 'Safe enough!') : 'The fog won this one';
  const line = `${r.survivors} of ${r.total} villager${r.total > 1 ? 's' : ''} home · ${r.cost.oil}/${level.def.oil} oil`;
  const hasNext = ctxInfo.kind === 'story' && ctxInfo.index < LEVELS.length - 1;
  el.result.innerHTML = `
    <h2>${title}</h2>
    <div class="stars">${starsHtml}</div>
    <p>${line}${!won ? '<br>Your lanterns are still where you left them.' : ''}</p>
    <div class="row">
      <button id="r-retry">↺ Retry</button>
      ${won && hasNext ? '<button id="r-next" class="primary">Next night →</button>' : ''}
      ${won && !hasNext ? '<button id="r-menu" class="primary">Back to map</button>' : ''}
    </div>`;
  el.result.hidden = false;
  $('r-retry').addEventListener('click', retry);
  document.getElementById('r-next')?.addEventListener('click', nextLevel);
  document.getElementById('r-menu')?.addEventListener('click', openMenu);
  syncButtons();
}

function retry() {
  if (mode === 'planning') return;
  mode = 'planning';
  result = null;
  effects = [];
  shake = 0;
  el.result.hidden = true;
  refreshPlan();
  syncButtons();
}

function nextLevel() {
  if (ctxInfo.kind !== 'story') return;
  const n = ctxInfo.index + 1;
  if (n < LEVELS.length) loadLevel(LEVELS[n], { kind: 'story', index: n });
  syncButtons();
}

function syncButtons() {
  el.play.hidden = mode !== 'planning';
  el.undo.hidden = el.clear.hidden = mode !== 'planning';
  el.skip.hidden = mode !== 'playing';
  el.retry.hidden = mode !== 'result';
  el.palette.classList.toggle('locked', mode !== 'planning');
  el.undo.disabled = undoStack.length === 0;
  el.clear.disabled = placements.length === 0;
}

// ------------------------------------------------------------------ scene

function villagerSprites(): VillagerSprite[] {
  const roofCount = new Map<number, number>();
  return level.villagers.map((v, n) => {
    const color = THEME.villagers[n % THEME.villagers.length];
    if (mode === 'planning') {
      const i = v.route[0];
      return { x: i % level.w, y: Math.floor(i / level.w), color, hop: 0, mood: 'calm' as const };
    }
    const frames = result!.frames;
    const a = frames[play.idx].villagers[n];
    const b = frames[Math.min(play.idx + 1, frames.length - 1)].villagers[n];
    const sw = swallowAnim.get(n);
    if (sw) {
      const k = (time - sw.t0) / SWALLOW_FLIGHT;
      const slot = roofCount.get(sw.roof) ?? 0;
      roofCount.set(sw.roof, slot + 1);
      const rx = (sw.roof % level.w) + (slot - 0.5) * 0.3;
      const ry = Math.floor(sw.roof / level.w);
      if (k < 1) {
        const e = smooth(k);
        return {
          x: sw.fx + (rx - sw.fx) * e,
          y: sw.fy + (ry - sw.fy) * e - Math.sin(Math.PI * k) * 1.4,
          color,
          hop: 0.4,
          mood: 'panic' as const,
          spin: sw.spin ? k * Math.PI * 4 : 0,
        };
      }
      return { x: rx, y: ry, color, hop: 0, mood: 'roof' as const };
    }
    const ax = a.at % level.w;
    const ay = Math.floor(a.at / level.w);
    const bx = b.at % level.w;
    const by = Math.floor(b.at / level.w);
    const moving = a.at !== b.at && play.idx < frames.length - 1;
    const t = moving ? smooth(play.t) : 0;
    const home = a.status === 'home' || (b.status === 'home' && play.t > 0.85);
    return {
      x: ax + (bx - ax) * t,
      y: ay + (by - ay) * t,
      color,
      hop: moving ? play.t : 0,
      mood: b.status === 'home' ? ('happy' as const) : ('calm' as const),
      hidden: home,
    };
  });
}

function buildScene(): Scene {
  let fogFrom: Uint8Array, fogTo: Uint8Array, litFrom: Uint8Array, litTo: Uint8Array, t: number, active: boolean[];
  let keeper = { x: level.keeper % level.w, y: Math.floor(level.keeper / level.w) };
  if (mode === 'planning' || !result) {
    fogFrom = fogTo = frame0.fog;
    litFrom = litTo = frame0.lit;
    t = 1;
    active = placements.map(() => true);
  } else {
    const frames = result.frames;
    const a = frames[play.idx];
    const b = frames[Math.min(play.idx + 1, frames.length - 1)];
    fogFrom = a.fog;
    fogTo = b.fog;
    litFrom = a.lit;
    litTo = b.lit;
    t = play.t;
    active = play.t > 0.5 ? b.active : a.active;
    // The Keeper waits beside the last lantern they lit.
    const end = result.cost.path[result.cost.path.length - 1];
    keeper = { x: (end % level.w) - (placements.length ? 0.32 : 0), y: Math.floor(end / level.w) + (placements.length ? 0.15 : 0) };
  }
  return {
    level,
    placements,
    active,
    fogFrom,
    fogTo,
    litFrom,
    litTo,
    t,
    villagers: villagerSprites(),
    keeper,
    keeperPath: mode === 'planning' ? cost.path : null,
    showRoutes: true,
    routeAlpha: mode === 'planning' ? 0.9 : 0.3,
    preview: mode === 'planning' ? preview : null,
    ghost: ghost(),
    housesLit,
    effects,
    time,
    shake,
    patterns: save.patterns,
  };
}

// ------------------------------------------------------------------ loop

let lastT = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  time += dt;
  if (mode === 'playing') updatePlay(dt);
  effects = stepEffects(effects, dt);
  shake = Math.max(0, shake - dt * 2);
  if (level) renderer.draw(buildScene());
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ UI helpers

function toast(msg: string, ms = 2000, bad = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle('bad', bad);
  el.toast.hidden = false;
  // Restart the pop animation.
  el.toast.style.animation = 'none';
  void el.toast.offsetWidth;
  el.toast.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, ms);
}
function hideToast() {
  el.toast.hidden = true;
}

function openMenu() {
  el.levelGrid.innerHTML = '';
  LEVELS.forEach((def, k) => {
    const stars = save.stars[def.id] ?? 0;
    const unlocked = k === 0 || (save.stars[LEVELS[k - 1].id] ?? 0) > 0 || stars > 0;
    const b = document.createElement('button');
    b.disabled = !unlocked;
    b.title = def.name;
    b.innerHTML = `<span class="n">${unlocked ? k + 1 : '🔒'}</span><span class="s">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
    b.addEventListener('click', () => {
      closeMenu();
      loadLevel(def, { kind: 'story', index: k });
      syncButtons();
    });
    el.levelGrid.appendChild(b);
  });
  el.menu.hidden = false;
}
function closeMenu() {
  el.menu.hidden = true;
}

// ------------------------------------------------------------------ input

function pointerTile(ev: PointerEvent) {
  const r = el.canvas.getBoundingClientRect();
  return renderer.pick(level, ev.clientX - r.left, ev.clientY - r.top);
}

el.canvas.addEventListener('pointermove', (ev) => {
  hoverIsMouse = ev.pointerType === 'mouse';
  hover = pointerTile(ev);
  if (mode === 'planning') updateOil();
});
el.canvas.addEventListener('pointerleave', () => {
  hover = null;
  if (mode === 'planning') updateOil();
});
el.canvas.addEventListener('pointerdown', (ev) => {
  hoverIsMouse = ev.pointerType === 'mouse';
  const t = pointerTile(ev);
  if (t) tapTile(t.x, t.y);
  if (mode === 'planning') updateOil();
});

el.play.addEventListener('click', startPlay);
el.skip.addEventListener('click', skip);
el.retry.addEventListener('click', retry);
el.undo.addEventListener('click', undo);
el.clear.addEventListener('click', clearPlan);
el.menuBtn.addEventListener('click', openMenu);
el.menu.addEventListener('click', (ev) => {
  if (ev.target === el.menu) closeMenu();
});
el.sound.addEventListener('click', () => {
  save.muted = !save.muted;
  setMuted(save.muted);
  el.sound.textContent = save.muted ? '🔈' : '🔊';
  writeSave(save);
  unlockAudio();
});
el.sound.textContent = save.muted ? '🔈' : '🔊';
el.patterns.addEventListener('change', () => {
  save.patterns = el.patterns.checked;
  writeSave(save);
});

window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement) return;
  const n = Number(ev.key);
  if (n >= 1 && n <= level.def.lanterns.length) selectType(level.def.lanterns[n - 1]);
  else if (ev.key === 'r' || ev.key === 'R') {
    if (mode === 'planning') {
      reflectorDir = ((reflectorDir + 1) % 4) as Dir;
      paintPalette();
    } else retry();
  } else if (ev.key === ' ' || ev.key === 'Enter') {
    ev.preventDefault();
    if (mode === 'planning') startPlay();
    else if (mode === 'playing') skip();
    else retry();
  } else if (ev.key === 'Escape') {
    if (!el.menu.hidden) closeMenu();
    else if (mode === 'playing') skip();
  } else if ((ev.key === 'z' && (ev.ctrlKey || ev.metaKey)) || ev.key === 'Backspace' || ev.key === 'u') undo();
});

window.addEventListener('resize', layout);

// ------------------------------------------------------------------ boot

function firstUnfinished(): number {
  const k = LEVELS.findIndex((d) => !(save.stars[d.id] > 0));
  return k < 0 ? 0 : k;
}

const start = firstUnfinished();
loadLevel(LEVELS[start], { kind: 'story', index: start });
syncButtons();
requestAnimationFrame(frame);
