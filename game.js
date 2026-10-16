/* NEON SURGE — endless roguelite arcade shooter.
 * Single-file engine: canvas rendering, WebAudio synth, persistent progression. */
'use strict';
(() => {
// ============================================================ utils
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (a) => a[(Math.random() * a.length) | 0];
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const $ = (id) => document.getElementById(id);
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function compact(arr, keep) { let j = 0; for (let i = 0; i < arr.length; i++) { const o = arr[i]; if (keep(o)) arr[j++] = o; } arr.length = j; }

// ============================================================ data
const SHIPS = [
  { id: 'vector', name: 'VECTOR', color: '#00f0ff', cost: 0, desc: 'Balanced interceptor. Reliable in every sector.', hp: 3, dmg: 1, rate: 1, speed: 1,
    shape: [[0, -20], [14, 12], [5, 7], [0, 12], [-5, 7], [-14, 12]] },
  { id: 'phantom', name: 'PHANTOM', color: '#ff2bd6', cost: 600, desc: 'Glass cannon. +20% crit chance, very agile.', hp: 2, dmg: 1.05, rate: 1.15, speed: 1.25,
    perk: (p) => { p.crit += 0.2; }, shape: [[0, -24], [5, -4], [18, 14], [4, 8], [0, 14], [-4, 8], [-18, 14], [-5, -4]] },
  { id: 'titan', name: 'TITAN', color: '#ff8a1f', cost: 1400, desc: 'Armored gunship. Launches with an orbit drone.', hp: 5, dmg: 1.25, rate: 0.85, speed: 0.85,
    perk: (p) => { p.drones += 1; }, shape: [[0, -18], [8, -10], [18, 2], [18, 14], [6, 10], [0, 14], [-6, 10], [-18, 14], [-18, 2], [-8, -10]] },
  { id: 'nova', name: 'NOVA', color: '#ffe53b', cost: 2800, desc: 'Triple-barrel spread from the first second.', hp: 3, dmg: 0.8, rate: 1, speed: 1,
    perk: (p) => { p.bullets += 2; }, shape: [[0, -22], [4, -8], [10, -16], [12, 0], [16, 14], [0, 8], [-16, 14], [-12, 0], [-10, -16], [-4, -8]] },
  { id: 'wraith', name: 'WRAITH', color: '#3bff8a', cost: 5000, desc: 'Seeker missiles and arc lightning built in.', hp: 3, dmg: 0.9, rate: 1, speed: 1.1,
    perk: (p) => { p.missiles += 1; p.chain += 1; }, shape: [[0, -22], [10, -6], [20, -10], [14, 8], [4, 6], [0, 14], [-4, 6], [-14, 8], [-20, -10], [-10, -6]] },
];

const PERMS = [
  { id: 'hull', icon: '♥', name: 'Reinforced Hull', desc: '+1 max HP', max: 4, base: 90, growth: 2.1 },
  { id: 'power', icon: '✦', name: 'Plasma Core', desc: '+8% damage', max: 10, base: 40, growth: 1.42 },
  { id: 'rate', icon: '≫', name: 'Overclock', desc: '+6% fire rate', max: 10, base: 40, growth: 1.42 },
  { id: 'magnet', icon: '◎', name: 'Tractor Beam', desc: '+25% pickup range', max: 5, base: 30, growth: 1.5 },
  { id: 'shield', icon: '⬡', name: 'Aegis Start', desc: 'Begin each run with +1 shield', max: 3, base: 160, growth: 2.2 },
  { id: 'greed', icon: '◆', name: 'Prospector', desc: '+10% crystals earned', max: 10, base: 50, growth: 1.45 },
  { id: 'od', icon: 'ϟ', name: 'Surge Capacitor', desc: 'Surge charges 12% faster', max: 5, base: 70, growth: 1.6 },
  { id: 'reroll', icon: '↻', name: 'Fate Dice', desc: '+1 mod reroll per run', max: 3, base: 120, growth: 2.0 },
];

const RARITY = [
  { name: 'COMMON', color: '#7fdcff', w: 62 },
  { name: 'RARE', color: '#3bff8a', w: 27 },
  { name: 'EPIC', color: '#c35cff', w: 9 },
  { name: 'LEGENDARY', color: '#ffb52b', w: 2.5 },
];

const MODS = [
  { id: 'dmg', icon: '✦', name: 'Plasma Rounds', r: 0, max: 99, desc: '+20% damage', apply: (p) => { p.dmg *= 1.2; } },
  { id: 'rate', icon: '≫', name: 'Rapid Fire', r: 0, max: 99, desc: '+15% fire rate', apply: (p) => { p.rate *= 1.15; } },
  { id: 'speed', icon: '➹', name: 'Railgun Coils', r: 0, max: 5, desc: '+25% shot speed, +10% damage', apply: (p) => { p.bspeed *= 1.25; p.dmg *= 1.1; } },
  { id: 'crit', icon: '✸', name: 'Precision Optics', r: 0, max: 5, desc: '+10% critical hit chance', apply: (p) => { p.crit += 0.1; } },
  { id: 'magnet', icon: '◎', name: 'Magnetizer', r: 0, max: 3, desc: '+60% pickup range', apply: (p) => { p.magnet *= 1.6; } },
  { id: 'od', icon: 'ϟ', name: 'Surge Amplifier', r: 0, max: 3, desc: 'Surge charges 30% faster, lasts +1s', apply: (p) => { p.odRate *= 1.3; p.odDur += 1; } },
  { id: 'luck', icon: '◆', name: 'Fortune Matrix', r: 0, max: 3, desc: '+35% crystal drops', apply: (p) => { p.luck *= 1.35; } },
  { id: 'heal', icon: '✚', name: 'Repair Kit', r: 0, max: 99, desc: 'Restore 2 HP', apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + 2); }, cond: (p) => p.hp < p.maxHp },
  { id: 'multi', icon: '⁂', name: 'Multishot', r: 1, max: 4, desc: '+1 projectile per volley', apply: (p) => { p.bullets++; } },
  { id: 'pierce', icon: '➤', name: 'Piercer', r: 1, max: 3, desc: 'Shots pierce +1 enemy', apply: (p) => { p.pierce++; } },
  { id: 'hp', icon: '♥', name: 'Nanoweave Hull', r: 1, max: 4, desc: '+1 max HP and heal 1', apply: (p) => { p.maxHp++; p.hp = Math.min(p.maxHp, p.hp + 1); } },
  { id: 'shield', icon: '⬡', name: 'Regen Shield', r: 1, max: 3, desc: 'Shield recharges every 15s (−3s per stack)', apply: (p) => { p.shieldRegen++; p.shield = Math.max(p.shield, 1); } },
  { id: 'side', icon: '⋎', name: 'Wing Cannons', r: 1, max: 2, desc: '+2 angled side cannons', apply: (p) => { p.side++; } },
  { id: 'drone', icon: '◈', name: 'Orbit Drone', r: 2, max: 3, desc: '+1 drone that hunts targets', apply: (p) => { p.drones++; } },
  { id: 'missile', icon: '☄', name: 'Seeker Missiles', r: 2, max: 4, desc: '+1 homing missile per salvo', apply: (p) => { p.missiles++; } },
  { id: 'chain', icon: 'ϟ', name: 'Arc Lightning', r: 2, max: 3, desc: 'Hits may arc to nearby foes', apply: (p) => { p.chain++; } },
  { id: 'boom', icon: '✺', name: 'Volatile Payload', r: 2, max: 3, desc: '+20% chance kills explode', apply: (p) => { p.explode += 0.2; } },
  { id: 'warp', icon: '⧗', name: 'Time Dilation', r: 3, max: 1, desc: 'Enemy bullets move 30% slower', apply: (p) => { p.bulletSlow = 0.7; } },
  { id: 'sing', icon: '◉', name: 'Singularity', r: 3, max: 1, desc: 'Every 7s launch a black hole that devours foes', apply: (p) => { p.singularity = 1; } },
  { id: 'phoenix', icon: '♨', name: 'Phoenix Core', r: 3, max: 1, desc: 'Cheat death once: revive with full HP', apply: (p) => { p.revive = 1; } },
  { id: 'hyper', icon: '⨳', name: 'Hyper Barrels', r: 3, max: 1, desc: 'Double projectiles, +25% fire rate', apply: (p) => { p.bullets *= 2; p.rate *= 1.25; } },
];

const ETYPES = {
  drone:    { hp: 3,  r: 14, speed: 95,  score: 50,  color: '#ff2bd6', sides: 3, cost: 1, minWave: 1, w: 5,   drop: 0.35 },
  dart:     { hp: 2,  r: 11, speed: 270, score: 70,  color: '#ffe53b', sides: 4, cost: 1, minWave: 2, w: 3,   drop: 0.3 },
  shooter:  { hp: 7,  r: 16, speed: 70,  score: 120, color: '#ff8a1f', sides: 4, cost: 3, minWave: 3, w: 2.6, drop: 0.5 },
  splitter: { hp: 9,  r: 18, speed: 62,  score: 100, color: '#3bff8a', sides: 5, cost: 3, minWave: 4, w: 2,   drop: 0.4 },
  kamikaze: { hp: 5,  r: 14, speed: 80,  score: 110, color: '#ff3b5c', sides: 0, cost: 2, minWave: 5, w: 2,   drop: 0.4 },
  tank:     { hp: 32, r: 27, speed: 38,  score: 300, color: '#b05cff', sides: 6, cost: 6, minWave: 6, w: 1,   drop: 1 },
  weaver:   { hp: 13, r: 17, speed: 55,  score: 200, color: '#3b8cff', sides: 8, cost: 4, minWave: 8, w: 1.2, drop: 0.6 },
  mini:     { hp: 2,  r: 9,  speed: 130, score: 25,  color: '#3bff8a', sides: 3, cost: 0, minWave: 999, w: 0, drop: 0.12 },
  boss:     { hp: 1,  r: 54, speed: 0,   score: 0,   color: '#ff2bd6', sides: 6, cost: 0, minWave: 999, w: 0, drop: 0 },
};

const SECTORS = [
  { name: 'NEON CITY', color: '#00f0ff', bg: ['#04010f', '#0a0530'], boss: 'HEXACORE' },
  { name: 'PINK NEBULA', color: '#ff2bd6', bg: ['#0a0110', '#2a0632'], boss: 'MAGENTA MAW' },
  { name: 'SOLAR RIFT', color: '#ffb52b', bg: ['#0c0402', '#30140a'], boss: 'SOLAR TYRANT' },
  { name: 'TOXIC VOID', color: '#3bff8a', bg: ['#010a06', '#04281a'], boss: 'VENOM HIVE' },
  { name: 'ULTRA DEEP', color: '#9b5cff', bg: ['#05010f', '#1a0838'], boss: 'VOID EMPRESS' },
  { name: 'INFERNO', color: '#ff3b5c', bg: ['#0e0104', '#360614'], boss: 'INFERNO PRIME' },
];

const RANKS = ['CADET', 'PILOT', 'ACE', 'VETERAN', 'COMMANDER', 'CAPTAIN', 'ADMIRAL', 'LEGEND', 'MYTHIC', 'GOD OF NEON'];

const MISSION_POOL = [
  { id: 'kills', text: (n) => `Destroy ${n} enemies in one run`, stat: 'kills', lo: 120, hi: 380, step: 10, reward: 60 },
  { id: 'wave', text: (n) => `Reach wave ${n}`, stat: 'wave', lo: 6, hi: 14, step: 1, reward: 80 },
  { id: 'boss', text: (n) => `Defeat ${n} boss${n > 1 ? 'es' : ''} in one run`, stat: 'bosses', lo: 1, hi: 2, step: 1, reward: 100 },
  { id: 'graze', text: (n) => `Graze ${n} bullets in one run`, stat: 'grazes', lo: 40, hi: 160, step: 10, reward: 70 },
  { id: 'score', text: (n) => `Score ${fmt(n)} in one run`, stat: 'score', lo: 30000, hi: 150000, step: 5000, reward: 80 },
  { id: 'combo', text: (n) => `Reach a ${n} combo`, stat: 'maxCombo', lo: 40, hi: 160, step: 10, reward: 70 },
  { id: 'gems', text: (n) => `Collect ${n} crystals in one run`, stat: 'crystals', lo: 60, hi: 220, step: 10, reward: 60 },
  { id: 'surge', text: (n) => `Trigger Surge ${n} times in one run`, stat: 'surges', lo: 2, hi: 6, step: 1, reward: 70 },
];

const ACHIEVEMENTS = [
  { id: 'first', name: 'First Flight', desc: 'Complete your first run', reward: 25, check: (r, s) => s.runs >= 1 },
  { id: 'w10', name: 'Deep Diver', desc: 'Reach wave 10', reward: 100, check: (r) => r.wave >= 10 },
  { id: 'w20', name: 'Void Walker', desc: 'Reach wave 20', reward: 300, check: (r) => r.wave >= 20 },
  { id: 'w30', name: 'Legend of the Grid', desc: 'Reach wave 30', reward: 800, check: (r) => r.wave >= 30 },
  { id: 'boss1', name: 'Giant Slayer', desc: 'Defeat a boss', reward: 75, check: (r) => r.bosses >= 1 },
  { id: 'boss5', name: 'Titan Breaker', desc: 'Defeat 3 bosses in one run', reward: 400, check: (r) => r.bosses >= 3 },
  { id: 'c100', name: 'Combo Artist', desc: 'Reach a 100 combo', reward: 100, check: (r) => r.maxCombo >= 100 },
  { id: 'c300', name: 'Unstoppable', desc: 'Reach a 300 combo', reward: 300, check: (r) => r.maxCombo >= 300 },
  { id: 'g100', name: 'Bullet Whisperer', desc: 'Graze 100 bullets in one run', reward: 120, check: (r) => r.grazes >= 100 },
  { id: 's100k', name: 'Six Figures', desc: 'Score 100,000 in one run', reward: 150, check: (r) => r.score >= 100000 },
  { id: 's1m', name: 'Millionaire', desc: 'Score 1,000,000 in one run', reward: 1000, check: (r) => r.score >= 1000000 },
  { id: 'flaw', name: 'Untouchable', desc: 'Clear 5 waves flawlessly in one run', reward: 150, check: (r) => r.flawless >= 5 },
  { id: 'legend', name: 'Mythic Find', desc: 'Install a legendary mod', reward: 100, check: (r) => r.legendary >= 1 },
  { id: 'k1k', name: 'Exterminator', desc: '1,000 lifetime kills', reward: 150, check: (r, s) => s.totalKills >= 1000 },
  { id: 'k10k', name: 'Annihilator', desc: '10,000 lifetime kills', reward: 600, check: (r, s) => s.totalKills >= 10000 },
  { id: 'fleet', name: 'Fleet Admiral', desc: 'Unlock every ship', reward: 500, check: (r, s) => SHIPS.every((sh) => s.ships[sh.id]) },
];

// ============================================================ save
const SAVE_KEY = 'neon-surge-save-v1';
function defaultSave() {
  return { crystals: 0, best: 0, bestWave: 0, totalKills: 0, runs: 0, bossKills: 0, xp: 0, level: 1,
    perm: {}, ships: { vector: true }, ship: 'vector', missions: { date: '', list: [] }, ach: {},
    settings: { sound: true, music: true, haptics: true }, tutorial: false, seenShop: 0 };
}
let save = defaultSave();
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const d = JSON.parse(raw);
    const def = defaultSave();
    save = Object.assign(def, d);
    save.settings = Object.assign(defaultSave().settings, d.settings || {});
    save.ships = Object.assign({ vector: true }, d.ships || {});
    save.perm = d.perm || {};
    save.ach = d.ach || {};
  }
} catch (e) { /* corrupted save: start fresh */ }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ } }
const permLvl = (id) => save.perm[id] | 0;
const permCost = (pm, lvl) => Math.round(pm.base * Math.pow(pm.growth, lvl) / 5) * 5;
const xpNeeded = (lvl) => Math.round(400 * Math.pow(lvl, 1.35));

function ensureDaily() {
  const key = todayKey();
  if (save.missions.date === key && save.missions.list.length) return;
  const rng = mulberry(hashStr('ns' + key));
  const pool = MISSION_POOL.slice();
  const list = [];
  for (let i = 0; i < 3; i++) {
    const m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const steps = Math.floor((m.hi - m.lo) / m.step);
    const target = m.lo + Math.floor(rng() * (steps + 1)) * m.step;
    list.push({ id: m.id, target, best: 0, done: false });
  }
  save.missions = { date: key, list };
  persist();
}

// ============================================================ audio
const Sound = (() => {
  let ac = null, master, sfx, music, noiseBuf, timer = null;
  let step = 0, nextT = 0, intensity = 0, lastShot = 0, pickupPitch = 0, lastPickup = 0;
  const BPM = 126, SD = 60 / BPM / 4;
  const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ac.createGain(); master.gain.value = 0.85;
    master.connect(comp); comp.connect(ac.destination);
    sfx = ac.createGain(); sfx.connect(master);
    music = ac.createGain(); music.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    apply();
    nextT = ac.currentTime + 0.1;
    timer = setInterval(schedule, 30);
  }
  function apply() {
    if (!ac) return;
    sfx.gain.value = save.settings.sound ? 0.6 : 0;
    music.gain.value = save.settings.music ? 0.3 : 0;
  }
  function osc(at, f, dur, type, vol, slide, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(dest || sfx); o.start(at); o.stop(at + dur + 0.03);
  }
  function nz(at, dur, vol, freq, ftype, slide, dest) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = ftype || 'lowpass';
    f.frequency.setValueAtTime(freq, at);
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, at + dur);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfx);
    s.start(at, Math.random() * 0.5); s.stop(at + dur + 0.03);
  }
  const ok = () => ac && ac.state === 'running';
  const now = () => ac.currentTime;

  // --- music sequencer (look-ahead scheduling)
  function schedule() {
    if (!ok()) return;
    if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.12) { playStep(step, nextT); nextT += SD; step++; }
  }
  function playStep(s, t) {
    if (!save.settings.music) return;
    const st = s % 16, bar = Math.floor(s / 16) % 4, chord = PROG[bar];
    const I = intensity;
    if (st === 0) { // pad
      for (const n of chord) {
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = rand(-8, 8);
        f.type = 'lowpass'; f.frequency.value = I >= 2 ? 1400 : 800;
        const dur = SD * 16;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022, t + 0.4);
        g.gain.setValueAtTime(0.022, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(music); o.start(t); o.stop(t + dur + 0.05);
      }
    }
    if (I >= 1) {
      if (st % 4 === 0) { osc(t, 150, 0.28, 'sine', 0.55, 40, music); }
      if (st % 2 === 1) nz(t, 0.04, I >= 2 ? 0.07 : 0.04, 7000, 'highpass', null, music);
      if (st % 2 === 0) {
        const n = chord[0] - 24 + (st % 8 === 6 ? 12 : 0);
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(n);
        f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + SD * 1.8); f.Q.value = 6;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + SD * 1.9);
        o.connect(f); f.connect(g); g.connect(music); o.start(t); o.stop(t + SD * 2);
      }
    }
    if (I >= 2 && (st === 4 || st === 12)) { nz(t, 0.16, 0.22, 2500, 'bandpass', 800, music); osc(t, 220, 0.08, 'triangle', 0.12, 120, music); }
    const every = I >= 2 ? 1 : 2;
    if (st % every === 0) {
      const idx = (st / every) % 4;
      const n = (idx === 3 ? chord[1] + 12 : chord[idx % 3]) + 12;
      osc(t, mtof(n), SD * 0.9, I >= 1 ? 'square' : 'triangle', I >= 1 ? 0.035 : 0.05, null, music);
    }
  }

  return {
    init, apply,
    setIntensity(i) { intensity = i; },
    get ctx() { return ac; },
    shoot() { if (!ok() || now() - lastShot < 0.065) return; lastShot = now(); osc(now(), rand(820, 980), 0.06, 'square', 0.025, 380); },
    hit() { if (!ok()) return; osc(now(), rand(260, 320), 0.04, 'square', 0.03, 140); },
    pop(size) {
      if (!ok()) return; const t = now();
      nz(t, 0.18 + size * 0.25, 0.22 + size * 0.15, 2400, 'lowpass', 90);
      osc(t, 140 + rand(-20, 20), 0.18 + size * 0.2, 'sine', 0.28 + size * 0.1, 35);
    },
    pickup() {
      if (!ok()) return; const t = now();
      if (t - lastPickup > 0.6) pickupPitch = 0;
      lastPickup = t; pickupPitch = Math.min(pickupPitch + 1, 18);
      osc(t, 900 * Math.pow(2, pickupPitch / 24), 0.07, 'triangle', 0.07, null);
    },
    graze() { if (!ok()) return; osc(now(), 2600, 0.03, 'sine', 0.035); },
    hurt() { if (!ok()) return; const t = now(); nz(t, 0.4, 0.5, 1200, 'lowpass', 100); osc(t, 220, 0.35, 'sawtooth', 0.2, 50); },
    shield() { if (!ok()) return; const t = now(); osc(t, 600, 0.25, 'sine', 0.2, 1500); nz(t, 0.2, 0.2, 3000, 'highpass'); },
    surge() {
      if (!ok()) return; const t = now();
      osc(t, 120, 0.8, 'sawtooth', 0.25, 1600); osc(t, 180, 0.8, 'square', 0.12, 2400); nz(t, 0.9, 0.35, 400, 'bandpass', 6000);
    },
    select() { if (!ok()) return; osc(now(), 660, 0.06, 'square', 0.06, 990); },
    click() { if (!ok()) return; osc(now(), 440, 0.04, 'triangle', 0.08); },
    buy() { if (!ok()) return; const t = now(); [0, 4, 7, 12].forEach((s, i) => osc(t + i * 0.05, mtof(72 + s), 0.12, 'triangle', 0.12)); },
    levelup() { if (!ok()) return; const t = now(); [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => osc(t + i * 0.06, mtof(67 + s), 0.18, 'square', 0.07)); },
    clear() { if (!ok()) return; const t = now(); [0, 7, 12, 19].forEach((s, i) => osc(t + i * 0.07, mtof(64 + s), 0.25, 'triangle', 0.14)); },
    warn() { if (!ok()) return; const t = now(); for (let i = 0; i < 3; i++) { osc(t + i * 0.5, 440, 0.24, 'sawtooth', 0.12, 330); osc(t + i * 0.5 + 0.25, 330, 0.24, 'sawtooth', 0.12, 440); } },
    dash() { if (!ok()) return; nz(now(), 0.25, 0.15, 800, 'bandpass', 4000); },
    boom() { if (!ok()) return; const t = now(); nz(t, 1.6, 0.8, 1800, 'lowpass', 40); osc(t, 90, 1.4, 'sine', 0.6, 25); },
    combo(level) { if (!ok()) return; const t = now(); osc(t, mtof(76 + level), 0.15, 'square', 0.06); osc(t + 0.07, mtof(83 + level), 0.2, 'square', 0.06); },
    zap() { if (!ok()) return; nz(now(), 0.08, 0.12, 5000, 'highpass'); },
    legendary() { if (!ok()) return; const t = now(); [0, 5, 7, 12, 17, 19, 24].forEach((s, i) => osc(t + i * 0.045, mtof(69 + s), 0.3, 'sawtooth', 0.05)); },
  };
})();
function buzz(p) { if (save.settings.haptics && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* unsupported */ } } }

// ============================================================ canvas + sprites
const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false });
const app = $('app');
let W = 400, H = 700, DPR = 1;
const glowCache = new Map(), boltCache = new Map();
function glowSprite(color) {
  let c = glowCache.get(color); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, color);
  gr.addColorStop(0.45, hexA(color, 0.3)); gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowCache.set(color, c); return c;
}
function boltSprite(color) {
  let c = boltCache.get(color); if (c) return c;
  c = document.createElement('canvas'); c.width = 24; c.height = 64;
  const g = c.getContext('2d'); g.translate(12, 32); g.scale(1, 2.6);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 12);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, color); gr.addColorStop(0.6, hexA(color, 0.35)); gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill(); boltCache.set(color, c); return c;
}

// ============================================================ state
const G = {
  state: 'title', time: 0, wave: 0, score: 0, shake: 0, sx: 0, sy: 0, flash: 0, flashColor: '#fff',
  slowT: 0, combo: 0, comboT: 0, od: 0, odT: 0, queue: [], spawnT: 0, waveActive: false, bossPending: 0,
  clearT: 0, waveHit: false, boss: null, eid: 0, deathT: 0, rerolls: 0, bspd: 1, scroll: 0, starMul: 1,
  sector: 0, missionCheckT: 0, nextComboMark: 25, tutorialT: 0,
};
let player = null, run = null;
const bullets = [], ebullets = [], enemies = [], particles = [], pickups = [], texts = [], rings = [], bolts = [], missiles = [], holes = [];
let stars = [], nebulae = [], bgGrad = null;
const MAXP = 700;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const r = app.getBoundingClientRect();
  W = Math.max(280, Math.round(r.width)); H = Math.max(400, Math.round(r.height));
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  initBackground();
  if (player) { player.x = clamp(player.x, 16, W - 16); player.tx = clamp(player.tx, 16, W - 16); player.y = clamp(player.y, 60, H - 30); player.ty = clamp(player.ty, 60, H - 30); }
}
function initBackground() {
  stars = [];
  const count = Math.round((W * H) / 3200);
  for (let i = 0; i < count; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: 1 + Math.floor(Math.random() * 3) });
  nebulae = [];
  for (let i = 0; i < 4; i++) nebulae.push({ x: Math.random() * W, y: Math.random() * H, s: rand(160, 300), sp: rand(6, 16), alt: i % 2 });
  setSectorBg();
}
function setSectorBg() {
  const s = SECTORS[G.sector % SECTORS.length];
  bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, s.bg[0]); bgGrad.addColorStop(1, s.bg[1]);
}
const sectorColor = () => SECTORS[G.sector % SECTORS.length].color;

// ============================================================ player
function makePlayer() {
  const sh = SHIPS.find((s) => s.id === save.ship) || SHIPS[0];
  const p = {
    x: W / 2, y: H * 0.8, tx: W / 2, ty: H * 0.8, vx: 0, r: 5, ship: sh, color: sh.color,
    maxHp: sh.hp + permLvl('hull'), hp: 1, shield: permLvl('shield'), shieldRegen: 0, shieldT: 0, invuln: 0,
    dmg: sh.dmg * (1 + 0.08 * permLvl('power')), rate: 6 * sh.rate * (1 + 0.06 * permLvl('rate')), speed: sh.speed,
    bullets: 1, pierce: 0, bspeed: 820, crit: 0.05, critMult: 2.5, drones: 0, missiles: 0, chain: 0,
    magnet: 85 * (1 + 0.25 * permLvl('magnet')), odRate: 1 + 0.12 * permLvl('od'), odDur: 6, explode: 0, side: 0, luck: 1,
    bulletSlow: 1, singularity: 0, revive: 0, fireT: 0, sideTog: false, droneT: 0, missileT: 1, singT: 4, dead: false, mods: {},
  };
  if (sh.perk) sh.perk(p);
  p.hp = p.maxHp;
  return p;
}

function startRun() {
  Sound.init();
  bullets.length = ebullets.length = enemies.length = particles.length = pickups.length = 0;
  texts.length = rings.length = bolts.length = missiles.length = holes.length = 0;
  Object.assign(G, { time: 0, wave: 0, score: 0, shake: 0, flash: 0, slowT: 0, combo: 0, comboT: 0, od: 0, odT: 0, queue: [],
    spawnT: 0, waveActive: false, bossPending: 0, clearT: 0, boss: null, deathT: 0, rerolls: permLvl('reroll'), sector: 0, nextComboMark: 25 });
  player = makePlayer();
  run = { kills: 0, wave: 0, bosses: 0, grazes: 0, score: 0, maxCombo: 0, crystals: 0, surges: 0, flawless: 0, legendary: 0, hits: 0 };
  ensureDaily();
  setSectorBg();
  showScreen(null);
  $('hud').classList.remove('hidden');
  G.state = 'play';
  Sound.setIntensity(1);
  if (!save.tutorial) { G.tutorialT = 5; $('tutorial').classList.remove('hidden'); }
  hudCache = {};
  startWave(1);
}

// ============================================================ waves
const hpScale = (w) => 1 + (w - 1) * 0.25 + Math.pow(w - 1, 2) * 0.016;
function startWave(w) {
  G.wave = w; run.wave = w; G.waveHit = false; G.waveActive = true;
  const sec = Math.floor((w - 1) / 5);
  if (sec !== G.sector || w === 1) { G.sector = sec; setSectorBg(); }
  G.bspd = (player ? player.bulletSlow : 1) * (1 + Math.min(0.55, w * 0.018));
  if (w % 5 === 0) {
    G.bossPending = 2.6; G.queue = [];
    banner('WARNING', `${SECTORS[G.sector % SECTORS.length].boss} APPROACHING`, '#ff3b5c', 2.6, true);
    Sound.warn(); buzz([80, 60, 80]);
  } else {
    buildWave(w);
    const sub = (w - 1) % 5 === 0 ? `SECTOR ${sec + 1} · ${SECTORS[G.sector % SECTORS.length].name}` : `${G.queue.length} CONTACTS`;
    banner(`WAVE ${w}`, sub, sectorColor(), 1.8);
    G.spawnT = 1.2;
  }
}
function buildWave(w) {
  let budget = 7 + w * 3.2 + Math.pow(w, 1.35);
  const types = Object.keys(ETYPES).filter((k) => ETYPES[k].minWave <= w && ETYPES[k].cost > 0);
  const total = types.reduce((s, k) => s + ETYPES[k].w, 0);
  G.queue = [];
  while (budget > 0) {
    let r = Math.random() * total, k = types[0];
    for (const t of types) { r -= ETYPES[t].w; if (r <= 0) { k = t; break; } }
    let form = null;
    if (k === 'drone' && Math.random() < 0.3) form = Math.random() < 0.5 ? 'line' : 'vee';
    if (k === 'dart' && Math.random() < 0.4) form = 'burst';
    G.queue.push({ type: k, form });
    budget -= ETYPES[k].cost * (form ? 3.5 : 1);
  }
}
function spawnFromQueue() {
  const it = G.queue.shift(); if (!it) return;
  const elite = G.wave >= 6 && Math.random() < Math.min(0.25, (G.wave - 5) * 0.03);
  if (it.form === 'line' || it.form === 'vee') {
    for (let i = 0; i < 5; i++) {
      const e = makeEnemy('drone', W * (0.15 + i * 0.175), -30 - (it.form === 'vee' ? Math.abs(i - 2) * 30 : 0));
      e.ph = 0; enemies.push(e);
    }
    return;
  }
  if (it.form === 'burst') {
    const x = rand(60, W - 60);
    for (let i = 0; i < 3; i++) { const e = makeEnemy('dart', x + (i - 1) * 34, -30 - Math.abs(i - 1) * 26); aimDart(e); enemies.push(e); }
    return;
  }
  const e = makeEnemy(it.type, rand(30, W - 30), -30);
  if (it.type === 'dart') aimDart(e);
  if (elite) makeElite(e);
  enemies.push(e);
}
function aimDart(e) { e.vx = clamp((player.x - e.x) * 0.35, -90, 90); e.rot = 0; e.spinSpd = 0; }
function makeEnemy(type, x, y) {
  const d = ETYPES[type], m = hpScale(G.wave);
  return {
    id: ++G.eid, type, x, y, vx: 0, vy: 0, r: d.r, hp: d.hp * m, maxHp: d.hp * m,
    speed: d.speed * (1 + Math.min(0.5, G.wave * 0.015)), score: d.score, color: d.color, sides: d.sides, drop: d.drop,
    t: 0, ph: rand(0, TAU), rot: rand(0, TAU), spinSpd: rand(-1.6, 1.6), flash: 0, dead: false, gone: false, elite: false, boss: false,
    ty: rand(H * 0.1, H * 0.36), leaveT: rand(10, 14), shootT: rand(0.8, 2.2), fireInt: Math.max(0.9, 2.0 - G.wave * 0.04), state: 0, lockA: 0,
  };
}
function makeElite(e) { e.elite = true; e.hp *= 3.5; e.maxHp = e.hp; e.r *= 1.3; e.score *= 3; e.drop = 1; }

function spawnBoss() {
  const L = G.wave / 5;
  const e = makeEnemy('boss', W / 2, -110);
  e.hp = e.maxHp = Math.round(260 * Math.pow(L, 1.6));
  e.boss = true; e.level = L; e.color = sectorColor(); e.name = SECTORS[G.sector % SECTORS.length].boss;
  e.state = 'enter'; e.patT = 1.2; e.pat = null; e.spin = 0; e.enraged = false; e.score = 5000 * L; e.lastPat = '';
  e.r = 54 * Math.min(1.2, W / 420 + 0.2);
  enemies.push(e); G.boss = e;
  $('bossName').textContent = e.name;
  $('bossBar').classList.remove('hidden');
  Sound.setIntensity(2);
}

// ============================================================ effects helpers
function burst(x, y, color, n, speed, size, life, type) {
  for (let i = 0; i < n && particles.length < MAXP; i++) {
    const a = Math.random() * TAU, s = speed * (0.25 + Math.random() * 0.75), l = life * (0.5 + Math.random() * 0.5);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, size: size * (0.6 + Math.random() * 0.6), color, type: type || 0, rot: rand(0, TAU), vr: rand(-10, 10) });
  }
}
function floatText(x, y, text, color, size, life) { if (texts.length < 60) texts.push({ x, y, text, color, size: size || 14, life: life || 0.9, max: life || 0.9 }); }
function ring(x, y, maxR, color, opts) { rings.push(Object.assign({ x, y, r: 4, maxR, color, life: 0.45, max: 0.45, width: 4, clear: false, dmg: 0, hit: null }, opts || {})); }
function lightning(x1, y1, x2, y2, color) {
  const pts = [[x1, y1]], segs = 6;
  for (let i = 1; i < segs; i++) { const t = i / segs; pts.push([x1 + (x2 - x1) * t + rand(-10, 10), y1 + (y2 - y1) * t + rand(-10, 10)]); }
  pts.push([x2, y2]); bolts.push({ pts, color, life: 0.14, max: 0.14 });
}
function banner(main, sub, color, dur, warn) {
  const b = $('banner');
  b.querySelector('.b-main').textContent = main; b.querySelector('.b-sub').textContent = sub || '';
  b.style.setProperty('--bc', color || '#00f0ff'); b.style.setProperty('--dur', (dur || 1.8) + 's');
  b.classList.toggle('warn', !!warn);
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function toast(html, color) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html;
  if (color) t.style.setProperty('--tc', color);
  $('toasts').appendChild(t); setTimeout(() => t.remove(), 3300);
}
const mult = () => Math.min(10, 1 + Math.floor(G.combo / 5) * 0.2);
function addScore(n) { G.score += n; run.score = G.score; }

// ============================================================ combat
function nearestEnemy(x, y, maxD, exclude) {
  let best = null, bd = maxD ? maxD * maxD : Infinity;
  for (const e of enemies) {
    if (e.dead || e.y < -10 || e === exclude || (exclude && exclude.has && exclude.has(e))) continue;
    const dd = d2(x, y, e.x, e.y); if (dd < bd) { bd = dd; best = e; }
  }
  return best;
}
function spawnBullet(x, y, a, spd, dmg, pierce, color, w) {
  bullets.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, a, dmg, pierce, color, r: 6, hits: null, w: w || 1 });
}
function eShoot(x, y, a, spd, color, r) {
  if (ebullets.length > 420) return;
  const s = spd * G.bspd;
  ebullets.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: r || 5, color: color || '#ff2bd6', grazed: false });
}
function playerFire(p) {
  const od = G.odT > 0, n = p.bullets;
  const step = n > 1 ? Math.min(0.1, 0.55 / (n - 1)) : 0;
  const dmg = p.dmg * (od ? 1.4 : 1), pierce = p.pierce + (od ? 2 : 0), col = od ? '#ffffff' : p.color;
  for (let i = 0; i < n; i++) {
    const k = i - (n - 1) / 2;
    spawnBullet(p.x + k * 7, p.y - 16, -Math.PI / 2 + k * step, p.bspeed, dmg, pierce, col);
  }
  if (p.side) {
    p.sideTog = !p.sideTog;
    if (p.sideTog) for (let s = 1; s <= p.side; s++) {
      const ang = 0.18 + s * 0.22;
      spawnBullet(p.x - 12, p.y, -Math.PI / 2 - ang, p.bspeed * 0.9, dmg * 0.8, pierce, col);
      spawnBullet(p.x + 12, p.y, -Math.PI / 2 + ang, p.bspeed * 0.9, dmg * 0.8, pierce, col);
    }
  }
  Sound.shoot();
}
function hitEnemy(e, dmg, crit, depth) {
  if (e.dead) return;
  if (e.boss && e.state === 'enter') dmg *= 0.25;
  e.hp -= dmg; e.flash = 0.07;
  if (crit) floatText(e.x + rand(-10, 10), e.y - e.r, Math.round(dmg * 10) + '!', '#ffe53b', 15, 0.6);
  if (e.hp <= 0) killEnemy(e, depth || 0);
}
function damageFromBullet(e, b) {
  const p = player;
  const crit = Math.random() < p.crit;
  const dmg = b.dmg * (crit ? p.critMult : 1);
  hitEnemy(e, dmg, crit, 0);
  burst(b.x, b.y, e.color, 3, 160, 2, 0.25, 1);
  if (p.chain && Math.random() < 0.18 + 0.08 * p.chain) {
    const hitSet = new Set([e]); let src = e;
    for (let i = 0; i < 1 + p.chain; i++) {
      const t = nearestEnemy(src.x, src.y, 150, hitSet); if (!t) break;
      hitSet.add(t); lightning(src.x, src.y, t.x, t.y, '#9fd8ff'); hitEnemy(t, p.dmg * 0.7, false, 0); src = t;
    }
    Sound.zap();
  }
}
function blast(x, y, radius, dmg, depth) {
  ring(x, y, radius, '#ffb52b', { width: 6, life: 0.35, max: 0.35 });
  burst(x, y, '#ffb52b', 14, 260, 3, 0.45, 1);
  for (const e of enemies) if (!e.dead && d2(x, y, e.x, e.y) < (radius + e.r) * (radius + e.r)) hitEnemy(e, dmg, false, depth);
  G.shake = Math.max(G.shake, 5);
}
function killEnemy(e, depth) {
  if (e.dead) return;
  e.dead = true;
  const p = player;
  G.combo++; G.comboT = 2.4; if (G.combo > run.maxCombo) run.maxCombo = G.combo;
  const pts = Math.round(e.score * mult());
  addScore(pts); run.kills++;
  if (!e.boss) G.od = Math.min(100, G.od + 2.3 * p.odRate * (e.elite ? 3 : 1));
  const big = e.boss ? 3 : e.r > 24 || e.elite ? 1 : 0;
  burst(e.x, e.y, e.color, 10 + big * 12, 280 + big * 120, 3, 0.6, 1);
  burst(e.x, e.y, '#ffffff', 4 + big * 4, 160, 4, 0.35, 0);
  burst(e.x, e.y, e.color, 4 + big * 3, 180, 7, 0.8, 2);
  ring(e.x, e.y, e.r * 2.6, e.color, { width: 3, life: 0.3, max: 0.3 });
  G.shake = Math.max(G.shake, 2.5 + big * 4);
  Sound.pop(big ? 1 : 0.2);
  if (pts >= 100 || e.elite) floatText(e.x, e.y, '+' + fmt(pts), e.elite ? '#ffe53b' : '#ffffff', e.elite ? 18 : 13);
  // drops
  if (e.elite) dropGems(e.x, e.y, 2, true);
  else if (Math.random() < e.drop * p.luck) dropGems(e.x, e.y, Math.random() < 0.25 ? 2 : 1, false);
  if (p.hp < p.maxHp && Math.random() < 0.012) pickups.push({ x: e.x, y: e.y, vx: 0, vy: -60, type: 'heart', val: 1, t: 0, life: 12, mag: false });
  if (e.type === 'splitter') {
    for (let i = 0; i < 3; i++) {
      const m = makeEnemy('mini', e.x + (i - 1) * 12, e.y);
      const a = Math.PI / 2 + (i - 1) * 0.7;
      m.vx = Math.cos(a) * 140; m.vy = Math.sin(a) * 140; m.hp = m.maxHp = 2 * hpScale(G.wave) * 0.7;
      enemies.push(m);
    }
  }
  if (p.explode && depth < 3 && Math.random() < p.explode) blast(e.x, e.y, 80, p.dmg * 4, depth + 1);
  if (G.combo >= G.nextComboMark) {
    const lvl = Math.min(12, Math.floor(G.nextComboMark / 25));
    floatText(W / 2, H * 0.3, `${G.nextComboMark} COMBO!`, '#ff2bd6', 26, 1.2);
    Sound.combo(lvl); buzz(15);
    G.nextComboMark += G.nextComboMark < 100 ? 25 : 50;
  }
  if (e.boss) bossDeath(e);
}
function dropGems(x, y, n, big) {
  for (let i = 0; i < n; i++) pickups.push({ x, y, vx: rand(-110, 110), vy: rand(-170, -40), type: big ? 'big' : 'gem', val: big ? 5 : 1, t: 0, life: 12, mag: false });
}
function bossDeath(e) {
  G.boss = null; $('bossBar').classList.add('hidden');
  run.bosses++; save.bossKills++;
  G.slowT = 1.1; G.shake = 28; G.flash = 0.8; G.flashColor = '#ffffff';
  Sound.boom(); buzz([100, 50, 200]);
  for (let i = 0; i < 6; i++) {
    const ox = rand(-50, 50), oy = rand(-50, 50);
    burst(e.x + ox, e.y + oy, i % 2 ? '#ffffff' : e.color, 26, 520, 4, 1.1, 1);
    ring(e.x + ox, e.y + oy, rand(90, 200), e.color, { width: 8, life: 0.7, max: 0.7 });
  }
  ring(e.x, e.y, Math.max(W, H) * 1.2, '#ffffff', { width: 10, life: 1, max: 1, clear: true });
  for (const b of ebullets) { burst(b.x, b.y, '#ffe53b', 1, 60, 3, 0.4, 0); addScore(10); }
  ebullets.length = 0;
  dropGems(e.x, e.y, 6 + Math.round(e.level * 2), true);
  dropGems(e.x, e.y, 10, false);
  player.hp = Math.min(player.maxHp, player.hp + 1);
  floatText(W / 2, H * 0.4, `BOSS DOWN +${fmt(e.score * mult())}`, '#ffe53b', 24, 1.8);
  Sound.setIntensity(1);
}

function hurtPlayer() {
  const p = player;
  if (p.dead || p.invuln > 0 || G.odT > 0) return;
  G.waveHit = true; run.hits++;
  if (G.combo >= 10) floatText(p.x, p.y - 40, 'COMBO LOST', '#ff3b5c', 14, 0.9);
  G.combo = 0; G.nextComboMark = 25;
  if (p.shield > 0) {
    p.shield--; p.invuln = 1.0;
    ring(p.x, p.y, 150, '#7fdcff', { clear: true, width: 6, life: 0.4, max: 0.4 });
    Sound.shield(); buzz(30);
    return;
  }
  p.hp--; p.invuln = 1.8;
  G.shake = 16; G.slowT = 0.3; G.flash = 0.45; G.flashColor = '#ff3b5c';
  ring(p.x, p.y, 160, '#ff3b5c', { clear: true, width: 6 });
  burst(p.x, p.y, '#ff3b5c', 22, 300, 3, 0.6, 1);
  Sound.hurt(); buzz([70, 40, 70]);
  $('hpRow').classList.remove('hurt'); void $('hpRow').offsetWidth; $('hpRow').classList.add('hurt');
  if (p.hp <= 0) {
    if (p.revive) {
      p.revive = 0; p.hp = p.maxHp; p.invuln = 3;
      banner('PHOENIX', 'CORE REIGNITED', '#ffb52b', 1.8);
      ring(p.x, p.y, Math.max(W, H), '#ffb52b', { clear: true, width: 12, life: 0.9, max: 0.9, dmg: p.dmg * 30 });
      burst(p.x, p.y, '#ffb52b', 60, 500, 4, 1.2, 1); Sound.surge();
    } else playerDie();
  }
}
function playerDie() {
  const p = player; p.dead = true; G.deathT = 2.2; G.slowT = 1.2;
  G.shake = 30; G.flash = 0.9; G.flashColor = '#ffffff';
  burst(p.x, p.y, p.color, 70, 600, 4, 1.4, 1); burst(p.x, p.y, '#ffffff', 30, 300, 5, 1, 0);
  for (let i = 0; i < 4; i++) ring(p.x, p.y, 120 + i * 80, p.color, { width: 6, life: 0.6 + i * 0.15, max: 0.6 + i * 0.15 });
  Sound.boom(); buzz([200, 80, 300]);
  Sound.setIntensity(0);
}
function activateSurge() {
  if (G.state !== 'play' || !player || player.dead || G.od < 100 || G.odT > 0) return;
  G.od = 0; G.odT = player.odDur; run.surges++;
  ring(player.x, player.y, Math.max(W, H), '#ffe53b', { clear: true, width: 14, life: 0.8, max: 0.8, dmg: player.dmg * 6 });
  G.flash = 0.5; G.flashColor = '#ffe53b'; G.shake = 12;
  banner('SURGE', 'OVERDRIVE ENGAGED', '#ffe53b', 1.2);
  Sound.surge(); Sound.setIntensity(2); buzz([40, 30, 40]);
}

// ============================================================ update
function update(dt) {
  const p = player;
  G.time += dt;
  G.scroll += dt * 40 * G.starMul;
  G.starMul += ((G.odT > 0 ? 5 : 1) - G.starMul) * Math.min(1, dt * 3);

  // ---- player
  if (!p.dead) {
    const kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (kx || ky) { p.tx += kx * 430 * p.speed * dt; p.ty += ky * 430 * p.speed * dt; }
    p.tx = clamp(p.tx, 16, W - 16); p.ty = clamp(p.ty, 70, H - 30);
    const k = Math.min(1, dt * 20 * p.speed), px = p.x;
    p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
    p.vx = (p.x - px) / Math.max(dt, 1e-4);
    p.invuln = Math.max(0, p.invuln - dt);
    // engine trail
    if (particles.length < MAXP) particles.push({ x: p.x + rand(-3, 3), y: p.y + 14, vx: rand(-20, 20), vy: rand(120, 200), life: 0.3, max: 0.3, size: 3, color: G.odT > 0 ? '#ffe53b' : p.color, type: 0 });
    // fire
    const rate = p.rate * (G.odT > 0 ? 2.2 : 1);
    p.fireT -= dt;
    if (p.fireT <= 0 && G.state === 'play' && G.clearT <= 0) { p.fireT += 1 / rate; if (p.fireT < 0) p.fireT = 0; playerFire(p); }
    // drones
    if (p.drones) {
      p.droneT -= dt;
      if (p.droneT <= 0) {
        p.droneT = 2.4 / p.rate;
        for (let i = 0; i < p.drones; i++) {
          const a = G.time * 2.4 + (i * TAU) / p.drones, dx = p.x + Math.cos(a) * 38, dy = p.y + Math.sin(a) * 24;
          const t = nearestEnemy(dx, dy, 600);
          const ang = t ? Math.atan2(t.y - dy, t.x - dx) : -Math.PI / 2;
          spawnBullet(dx, dy, ang, 720, p.dmg * 0.6, 0, '#b8fbff', 0.7);
        }
      }
    }
    // missiles
    if (p.missiles) {
      p.missileT -= dt;
      if (p.missileT <= 0) {
        p.missileT = 1.6;
        for (let i = 0; i < p.missiles; i++) {
          const side = i % 2 ? 1 : -1, a = -Math.PI / 2 + side * (0.6 + i * 0.15);
          missiles.push({ x: p.x + side * 10, y: p.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 3, target: null, dmg: p.dmg * 4 });
        }
      }
    }
    // singularity
    if (p.singularity) {
      p.singT -= dt;
      if (p.singT <= 0) { p.singT = 7; holes.push({ x: p.x, y: p.y - 40, vy: -70, life: 3.2, max: 3.2, r: 46 }); Sound.dash(); }
    }
    // shield regen
    if (p.shieldRegen && p.shield < 1) {
      p.shieldT += dt;
      if (p.shieldT >= 15 - 3 * (p.shieldRegen - 1)) { p.shield = 1; p.shieldT = 0; ring(p.x, p.y, 40, '#7fdcff'); Sound.shield(); }
    }
  }
  if (G.odT > 0) { G.odT -= dt; if (G.odT <= 0) { G.odT = 0; Sound.setIntensity(G.boss ? 2 : 1); } }
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) { G.combo = 0; G.nextComboMark = 25; } }
  if (G.tutorialT > 0) { G.tutorialT -= dt; if (G.tutorialT <= 0) { $('tutorial').classList.add('hidden'); save.tutorial = true; persist(); } }

  // ---- spawning
  if (G.waveActive && !p.dead) {
    if (G.bossPending > 0) { G.bossPending -= dt; if (G.bossPending <= 0) { G.bossPending = 0; spawnBoss(); } }
    else if (G.queue.length) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) { spawnFromQueue(); G.spawnT = Math.max(0.28, 1.0 - G.wave * 0.035) * rand(0.6, 1.4); }
    }
  }

  // ---- enemies
  for (let i = 0; i < enemies.length; i++) { const e = enemies[i]; if (!e.dead) (e.boss ? updateBoss : updateEnemy)(e, dt); }

  // ---- player bullets
  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30) { b.dead = true; continue; }
    for (const e of enemies) {
      if (e.dead || e.y < -e.r) continue;
      const rr = e.r + b.r;
      if (d2(b.x, b.y, e.x, e.y) < rr * rr) {
        if (b.hits && b.hits.includes(e.id)) continue;
        damageFromBullet(e, b);
        if (b.pierce > 0) { b.pierce--; (b.hits || (b.hits = [])).push(e.id); }
        else { b.dead = true; break; }
      }
    }
  }
  compact(bullets, (b) => !b.dead);

  // ---- missiles
  for (const m of missiles) {
    m.life -= dt;
    if (!m.target || m.target.dead) m.target = nearestEnemy(m.x, m.y, 900);
    const spd = Math.hypot(m.vx, m.vy);
    let a = Math.atan2(m.vy, m.vx);
    if (m.target) {
      const ta = Math.atan2(m.target.y - m.y, m.target.x - m.x);
      let da = ta - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      a += clamp(da, -6 * dt, 6 * dt);
    }
    const ns = Math.min(620, spd + 500 * dt);
    m.vx = Math.cos(a) * ns; m.vy = Math.sin(a) * ns;
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (particles.length < MAXP) particles.push({ x: m.x, y: m.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.35, max: 0.35, size: 2.5, color: '#ff8a1f', type: 0 });
    for (const e of enemies) {
      if (e.dead) continue;
      if (d2(m.x, m.y, e.x, e.y) < (e.r + 6) * (e.r + 6)) {
        hitEnemy(e, m.dmg, false, 0); m.life = 0;
        burst(m.x, m.y, '#ff8a1f', 10, 220, 3, 0.35, 1); ring(m.x, m.y, 40, '#ff8a1f', { width: 3, life: 0.25, max: 0.25 });
        break;
      }
    }
    if (m.y < -60 || m.y > H + 60 || m.x < -60 || m.x > W + 60) m.life = 0;
  }
  compact(missiles, (m) => m.life > 0);

  // ---- black holes
  for (const h of holes) {
    h.life -= dt; h.y += h.vy * dt;
    for (const e of enemies) {
      if (e.dead) continue;
      const dd = d2(h.x, h.y, e.x, e.y);
      if (!e.boss && dd < 200 * 200) { const d = Math.sqrt(dd) || 1; e.x += ((h.x - e.x) / d) * 170 * dt; e.y += ((h.y - e.y) / d) * 170 * dt; }
      if (dd < (h.r + e.r) * (h.r + e.r)) hitEnemy(e, p.dmg * 14 * dt, false, 0);
    }
    for (const b of ebullets) if (d2(h.x, h.y, b.x, b.y) < (h.r + 10) * (h.r + 10)) b.dead = true;
    if (particles.length < MAXP) { const a = rand(0, TAU); particles.push({ x: h.x + Math.cos(a) * 90, y: h.y + Math.sin(a) * 90, vx: -Math.cos(a) * 220, vy: -Math.sin(a) * 220, life: 0.4, max: 0.4, size: 2.5, color: '#c35cff', type: 1 }); }
  }
  compact(holes, (h) => h.life > 0);

  // ---- enemy bullets
  const grazeR = 26;
  for (const b of ebullets) {
    if (b.dead) continue;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) { b.dead = true; continue; }
    if (p.dead) continue;
    const dd = d2(b.x, b.y, p.x, p.y), hr = p.r + b.r * 0.7;
    if (dd < hr * hr) {
      if (G.odT > 0 || p.invuln > 0) { if (G.odT > 0) { b.dead = true; burst(b.x, b.y, '#ffe53b', 3, 100, 2, 0.3, 0); } }
      else { b.dead = true; hurtPlayer(); }
    } else if (!b.grazed && dd < (grazeR + b.r) * (grazeR + b.r)) {
      b.grazed = true; run.grazes++;
      addScore(Math.round(15 * mult()));
      G.od = Math.min(100, G.od + 1.6 * p.odRate);
      burst((b.x + p.x) / 2, (b.y + p.y) / 2, '#ffffff', 3, 120, 2, 0.25, 1);
      Sound.graze();
      if (run.grazes % 10 === 0) floatText(p.x + 24, p.y - 20, 'GRAZE', '#b8fbff', 11, 0.6);
    }
  }
  compact(ebullets, (b) => !b.dead);

  // ---- enemy contact
  if (!p.dead) for (const e of enemies) {
    if (e.dead) continue;
    const rr = e.r * 0.8 + p.r;
    if (d2(e.x, e.y, p.x, p.y) < rr * rr) {
      if (G.odT > 0) { if (!e.boss) killEnemy(e, 0); }
      else if (p.invuln <= 0) { hurtPlayer(); if (!e.boss) killEnemy(e, 0); }
    }
  }
  compact(enemies, (e) => !e.dead && !e.gone);

  // ---- pickups
  const magAll = G.clearT > 0 || !G.waveActive;
  for (const k of pickups) {
    k.t += dt; k.life -= dt;
    if (!p.dead && (k.mag || magAll || d2(k.x, k.y, p.x, p.y) < p.magnet * p.magnet)) {
      k.mag = true;
      const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1, s = 380 + k.t * 500;
      k.vx = (dx / d) * s; k.vy = (dy / d) * s;
      if (d < 22) {
        k.life = 0;
        if (k.type === 'heart') { p.hp = Math.min(p.maxHp, p.hp + 1); floatText(p.x, p.y - 30, '+1 HP', '#ff3b5c', 15); Sound.shield(); }
        else { run.crystals += k.val; Sound.pickup(); }
        burst(p.x, p.y, k.type === 'heart' ? '#ff3b5c' : '#7ff8ff', 4, 120, 2, 0.3, 0);
      }
    } else { k.vx *= 1 - 2 * dt; k.vy = Math.min(k.vy + 140 * dt, 70); }
    k.x += k.vx * dt; k.y += k.vy * dt;
    if (k.y > H + 30) k.life = 0;
  }
  compact(pickups, (k) => k.life > 0);

  updateFx(dt);

  // ---- wave clear
  if (G.waveActive && !G.bossPending && !G.queue.length && !enemies.length && !p.dead) {
    G.waveActive = false; G.clearT = 1.4;
    const bonus = 250 * G.wave;
    addScore(bonus);
    for (const b of ebullets) burst(b.x, b.y, '#ffe53b', 1, 40, 3, 0.4, 0);
    ebullets.length = 0;
    if (!G.waveHit) {
      run.flawless++; addScore(bonus); dropGems(p.x, p.y - 80, 3, false);
      floatText(W / 2, H * 0.42, 'FLAWLESS!', '#3bff8a', 26, 1.4);
    }
    floatText(W / 2, H * 0.36, `WAVE CLEAR +${fmt(bonus)}`, '#ffffff', 18, 1.4);
    Sound.clear();
  }
  if (G.clearT > 0) { G.clearT -= dt; if (G.clearT <= 0 && !p.dead) showUpgrade(G.wave % 5 === 0); }

  // ---- death
  if (p.dead) { G.deathT -= dt; if (G.deathT <= 0 && G.state === 'play') endRun(); }

  G.missionCheckT -= dt;
  if (G.missionCheckT <= 0) { G.missionCheckT = 0.5; checkProgress(false); }
}

function updateFx(dt) {
  for (const q of particles) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
    const f = 1 - 3 * dt; q.vx *= f; q.vy *= f;
    if (q.type === 2) q.rot += q.vr * dt;
  }
  compact(particles, (q) => q.life > 0);
  for (const t of texts) { t.life -= dt; t.y -= 40 * dt; }
  compact(texts, (t) => t.life > 0);
  for (const r of rings) {
    r.life -= dt;
    const k = 1 - r.life / r.max;
    r.r = 4 + (r.maxR - 4) * (1 - Math.pow(1 - k, 3));
    if (r.clear) for (const b of ebullets) if (!b.dead && d2(r.x, r.y, b.x, b.y) < r.r * r.r) { b.dead = true; burst(b.x, b.y, r.color, 1, 60, 2, 0.3, 0); }
    if (r.dmg) {
      r.hit = r.hit || new Set();
      for (const e of enemies) if (!e.dead && !r.hit.has(e) && d2(r.x, r.y, e.x, e.y) < r.r * r.r) { r.hit.add(e); hitEnemy(e, r.dmg, false, 0); }
    }
  }
  compact(ebullets, (b) => !b.dead);
  compact(rings, (r) => r.life > 0);
  for (const b of bolts) b.life -= dt;
  compact(bolts, (b) => b.life > 0);
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt * 2);
}

function updateEnemy(e, dt) {
  const p = player;
  e.t += dt; e.flash = Math.max(0, e.flash - dt); e.rot += e.spinSpd * dt;
  switch (e.type) {
    case 'drone':
      e.y += e.speed * dt; e.x += Math.cos(e.t * 2.2 + e.ph) * 70 * dt; break;
    case 'mini':
      e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 1 - dt * 1.5; e.vy += (e.speed - e.vy) * dt * 2; break;
    case 'dart':
      e.x += e.vx * dt; e.y += e.speed * dt;
      if (particles.length < MAXP && Math.random() < 0.5) particles.push({ x: e.x, y: e.y - 10, vx: 0, vy: -30, life: 0.25, max: 0.25, size: 2, color: e.color, type: 0 });
      break;
    case 'shooter':
      if (e.t < e.leaveT) {
        e.y += (e.ty - e.y) * Math.min(1, dt * 2); e.x += Math.cos(e.t * 1.1 + e.ph) * 80 * dt;
        e.shootT -= dt;
        if (e.shootT <= 0 && e.y > 10 && !p.dead) {
          e.shootT = e.fireInt;
          const a = Math.atan2(p.y - e.y, p.x - e.x), n = G.wave >= 10 ? 3 : 1;
          for (let i = 0; i < n; i++) eShoot(e.x, e.y, a + (i - (n - 1) / 2) * 0.22, 170, '#ff8a1f');
          if (e.elite) for (let i = 0; i < 6; i++) eShoot(e.x, e.y, (i * TAU) / 6 + e.t, 120, '#ffe53b');
        }
      } else e.y += e.speed * 1.6 * dt;
      e.x = clamp(e.x, 20, W - 20);
      break;
    case 'splitter':
      e.y += e.speed * dt; e.x += Math.sin(e.t * 1.5 + e.ph) * 45 * dt; break;
    case 'kamikaze':
      if (e.state === 0) {
        e.y += (e.ty - e.y) * Math.min(1, dt * 2.5); e.x += (p.x - e.x) * dt * 0.8;
        if (e.t > 1.4) { e.state = 1; e.lockT = 0.6; }
      } else if (e.state === 1) {
        e.lockA = Math.atan2(p.y - e.y, p.x - e.x); e.lockT -= dt;
        e.spinSpd = 14;
        if (e.lockT <= 0) { e.state = 2; e.vx = Math.cos(e.lockA) * 560; e.vy = Math.sin(e.lockA) * 560; Sound.dash(); }
      } else {
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (particles.length < MAXP) particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 4, color: e.color, type: 0 });
      }
      break;
    case 'tank':
      if (e.t < e.leaveT + 6) {
        e.y += (e.ty - e.y) * Math.min(1, dt * 1.2); e.x += Math.sin(e.t * 0.7 + e.ph) * 30 * dt;
        e.shootT -= dt;
        if (e.shootT <= 0 && e.y > 10) {
          e.shootT = Math.max(1.6, 2.8 - G.wave * 0.04);
          const n = 10 + Math.min(10, Math.floor(G.wave / 3)), off = rand(0, TAU);
          for (let i = 0; i < n; i++) eShoot(e.x, e.y, off + (i * TAU) / n, 115, '#c35cff', 6);
        }
      } else e.y += e.speed * 2 * dt;
      break;
    case 'weaver': {
      if (e.t < e.leaveT + 4) {
        e.y += (e.ty - e.y) * Math.min(1, dt * 1.5);
        const tx = W / 2 + Math.sin(e.t * 0.8 + e.ph) * W * 0.32; e.x += (tx - e.x) * dt * 1.5;
        const cyc = e.t % 3.4;
        if (cyc < 1.4 && e.y > 10) {
          e.shootT -= dt;
          if (e.shootT <= 0) { e.shootT = 0.11; e.spin = (e.spin || 0) + 0.45; for (let k = 0; k < 2; k++) eShoot(e.x, e.y, e.spin + k * Math.PI, 135, '#3b8cff'); }
        }
      } else e.y += e.speed * 2 * dt;
      break;
    }
  }
  if (e.y > H + 60 || e.x < -90 || e.x > W + 90 || e.y < -400) e.gone = true;
}

function updateBoss(e, dt) {
  const p = player, L = e.level;
  e.t += dt; e.flash = Math.max(0, e.flash - dt); e.rot += dt * (e.enraged ? 1.2 : 0.5);
  if (e.state === 'enter') {
    e.y += (H * 0.2 - e.y) * dt * 1.4;
    if (Math.abs(e.y - H * 0.2) < 3) { e.state = 'fight'; e.t = 0; }
    return;
  }
  e.x = W / 2 + Math.sin(e.t * 0.55) * W * 0.28;
  e.y = H * 0.2 + Math.sin(e.t * 1.3) * 14;
  if (!e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true; banner('ENRAGED', e.name, '#ff3b5c', 1.4, true);
    G.shake = 12; ring(e.x, e.y, 260, '#ff3b5c', { width: 10, life: 0.6, max: 0.6 }); Sound.warn();
    e.color = '#ff3b5c';
  }
  if (p.dead) return;
  if (!e.pat) {
    e.patT -= dt;
    if (e.patT <= 0) {
      const pool = ['ring', 'spiral', 'fan', 'rain'];
      if (L >= 2 || e.enraged) pool.push('minions');
      if (L >= 2) pool.push('flower');
      let name; do { name = pick(pool); } while (name === e.lastPat);
      e.lastPat = name; e.pat = { name, t: 0, acc: 0, n: 0, dir: Math.random() < 0.5 ? 1 : -1 };
    }
    return;
  }
  const P = e.pat; P.t += dt; P.acc += dt;
  const end = () => { e.pat = null; e.patT = e.enraged ? 0.45 : 0.95; };
  const c2 = '#ffe53b';
  switch (P.name) {
    case 'ring':
      if (P.acc >= 0.45) {
        P.acc = 0; P.n++;
        const k = Math.round(14 + L * 3), off = P.n * 0.17;
        for (let i = 0; i < k; i++) eShoot(e.x, e.y, off + (i * TAU) / k, 150, i % 2 ? e.color : c2);
      }
      if (P.n >= (e.enraged ? 5 : 3)) end();
      break;
    case 'spiral':
      if (P.acc >= 0.075) {
        P.acc = 0; e.spin += 0.31 * P.dir;
        const arms = e.enraged ? 4 : 3;
        for (let a = 0; a < arms; a++) eShoot(e.x, e.y, e.spin + (a * TAU) / arms, 155, e.color);
      }
      if (P.t > 3) end();
      break;
    case 'fan':
      if (P.acc >= 0.5) {
        P.acc = 0; P.n++;
        const ang = Math.atan2(p.y - e.y, p.x - e.x), k = e.enraged ? 7 : 5;
        for (let i = 0; i < k; i++) eShoot(e.x, e.y, ang + (i - (k - 1) / 2) * 0.17, 230, c2);
      }
      if (P.n >= 4) end();
      break;
    case 'rain':
      if (P.acc >= (e.enraged ? 0.045 : 0.065)) { P.acc = 0; eShoot(e.x + rand(-e.r, e.r), e.y + 30, Math.PI / 2 + rand(-0.4, 0.4), rand(140, 230), e.color, 4); }
      if (P.t > 2.6) end();
      break;
    case 'flower':
      if (P.acc >= 0.12) {
        P.acc = 0; P.n++;
        const k = 8;
        for (let i = 0; i < k; i++) {
          eShoot(e.x, e.y, P.n * 0.2 + (i * TAU) / k, 140, e.color);
          eShoot(e.x, e.y, -P.n * 0.2 + (i * TAU) / k, 110, c2, 4);
        }
      }
      if (P.t > 2.2) end();
      break;
    case 'minions':
      for (let i = 0; i < 4; i++) {
        const m = makeEnemy(L >= 3 && i % 2 ? 'kamikaze' : 'drone', e.x + (i - 1.5) * 40, e.y + 20);
        m.ty = rand(H * 0.25, H * 0.4); m.drop = 0.2; enemies.push(m);
      }
      ring(e.x, e.y, 120, e.color, { width: 5 });
      end();
      break;
  }
}

// ============================================================ render
const fontCache = {};
const font = (s) => fontCache[s] || (fontCache[s] = `900 ${s}px Orbitron, sans-serif`);
function baseTransform() { ctx.setTransform(DPR, 0, 0, DPR, G.sx * DPR, G.sy * DPR); }

function render(dt) {
  G.sx = G.shake > 0 ? rand(-1, 1) * G.shake * 0.6 : 0;
  G.sy = G.shake > 0 ? rand(-1, 1) * G.shake * 0.6 : 0;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);
  baseTransform();
  drawBackground(dt);
  ctx.globalCompositeOperation = 'lighter';
  drawPickups();
  drawHoles();
  for (const b of bullets) drawRot(boltSprite(b.color), b.x, b.y, b.a + Math.PI / 2, 12 * b.w, 34 * b.w);
  baseTransform();
  for (const m of missiles) drawRot(boltSprite('#ff8a1f'), m.x, m.y, Math.atan2(m.vy, m.vx) + Math.PI / 2, 12, 26);
  baseTransform();
  ctx.globalCompositeOperation = 'source-over';
  for (const e of enemies) (e.boss ? drawBoss : drawEnemy)(e);
  if (player && !player.dead && G.state !== 'title') drawPlayer(player);
  ctx.globalCompositeOperation = 'lighter';
  drawParticles();
  for (const b of ebullets) {
    const s = b.r * 3.2;
    ctx.drawImage(glowSprite(b.color), b.x - s, b.y - s, s * 2, s * 2);
  }
  drawBolts();
  drawRings();
  ctx.globalCompositeOperation = 'source-over';
  drawTexts();
  if (G.flash > 0) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = Math.min(0.7, G.flash); ctx.fillStyle = G.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  if (G.odT > 0) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 0.1 + Math.sin(G.time * 12) * 0.04; ctx.fillStyle = '#ffe53b'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
}
function drawRot(img, x, y, a, w, h) {
  const c = Math.cos(a), s = Math.sin(a);
  ctx.setTransform(c * DPR, s * DPR, -s * DPR, c * DPR, (x + G.sx) * DPR, (y + G.sy) * DPR);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
}
function drawBackground(dt) {
  const col = sectorColor();
  // nebulae
  ctx.globalCompositeOperation = 'lighter';
  for (const n of nebulae) {
    n.y += n.sp * dt * G.starMul; if (n.y - n.s > H) { n.y = -n.s; n.x = Math.random() * W; }
    ctx.globalAlpha = 0.09;
    ctx.drawImage(glowSprite(n.alt ? '#ff2bd6' : col), n.x - n.s, n.y - n.s, n.s * 2, n.s * 2);
  }
  ctx.globalAlpha = 1;
  // grid
  const gs = 56, off = G.scroll % gs;
  ctx.strokeStyle = hexA(col, 0.07); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = off - gs; y < H; y += gs) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  for (let x = (W / 2) % gs; x < W; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  ctx.stroke();
  // stars
  const warp = G.starMul > 1.5;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  if (warp) ctx.beginPath();
  for (const s of stars) {
    const sp = 18 * s.z * s.z * G.starMul;
    s.y += sp * dt; if (s.y > H) { s.y -= H; s.x = Math.random() * W; }
    if (warp) { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y - sp * 0.06); }
    else { ctx.globalAlpha = 0.25 + s.z * 0.22; ctx.fillRect(s.x, s.y, s.z * 0.8, s.z * 0.8); }
  }
  if (warp) { ctx.lineWidth = 1.2; ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function shipPath(c, shape, sc) {
  c.beginPath();
  for (let i = 0; i < shape.length; i++) { const [x, y] = shape[i]; i ? c.lineTo(x * sc, y * sc) : c.moveTo(x * sc, y * sc); }
  c.closePath();
}
function drawShipOn(c, ship, x, y, sc, tilt, alpha, color) {
  c.save(); c.translate(x, y); c.rotate(tilt || 0); c.globalAlpha = alpha == null ? 1 : alpha;
  const col = color || ship.color;
  shipPath(c, ship.shape, sc);
  c.fillStyle = 'rgba(10,6,30,0.9)'; c.fill();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = hexA(col, 0.3); c.lineWidth = 7 * sc; c.lineJoin = 'round'; c.stroke();
  c.strokeStyle = col; c.lineWidth = 2.2 * sc; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.8 * sc; c.stroke();
  c.restore();
}
function drawPlayer(p) {
  const blink = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0;
  const tilt = clamp(p.vx / 1600, -0.35, 0.35);
  ctx.globalCompositeOperation = 'lighter';
  const fl = 18 + Math.sin(G.time * 40) * 4 + (G.odT > 0 ? 10 : 0);
  ctx.drawImage(glowSprite(G.odT > 0 ? '#ffe53b' : p.color), p.x - fl / 2, p.y + 6, fl, fl * 1.4);
  ctx.globalCompositeOperation = 'source-over';
  drawShipOn(ctx, p.ship, p.x, p.y, 1, tilt, blink ? 0.3 : 1, G.odT > 0 ? '#ffe53b' : p.color);
  ctx.globalCompositeOperation = 'lighter';
  // hitbox core
  ctx.drawImage(glowSprite('#ffffff'), p.x - 7, p.y - 7, 14, 14);
  // drones
  for (let i = 0; i < p.drones; i++) {
    const a = G.time * 2.4 + (i * TAU) / p.drones, dx = p.x + Math.cos(a) * 38, dy = p.y + Math.sin(a) * 24;
    ctx.drawImage(glowSprite('#b8fbff'), dx - 9, dy - 9, 18, 18);
    ctx.save(); ctx.translate(dx, dy); ctx.rotate(G.time * 4);
    ctx.strokeStyle = '#b8fbff'; ctx.lineWidth = 1.5; ctx.strokeRect(-4, -4, 8, 8); ctx.restore();
  }
  // shield
  if (p.shield > 0) {
    ctx.strokeStyle = hexA('#7fdcff', 0.35 + Math.sin(G.time * 5) * 0.15); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, TAU); ctx.stroke();
  }
  if (G.odT > 0) {
    ctx.strokeStyle = hexA('#ffe53b', 0.5); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 34 + Math.sin(G.time * 20) * 3, 0, TAU); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function enemyPath(e, r) {
  ctx.beginPath();
  if (e.sides === 0) { // star
    for (let i = 0; i < 10; i++) { const a = (i * TAU) / 10 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  } else if (e.type === 'dart') {
    ctx.moveTo(0, r * 1.3); ctx.lineTo(r * 0.6, -r * 0.6); ctx.lineTo(0, -r * 0.2); ctx.lineTo(-r * 0.6, -r * 0.6);
  } else {
    for (let i = 0; i < e.sides; i++) { const a = (i * TAU) / e.sides - Math.PI / 2; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  }
  ctx.closePath();
}
function drawEnemy(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.type === 'kamikaze' && e.state === 1) {
    ctx.strokeStyle = hexA('#ff3b5c', 0.25 + Math.random() * 0.3); ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(e.lockA) * 900, Math.sin(e.lockA) * 900); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.rotate(e.type === 'dart' ? Math.atan2(e.speed, e.vx) - Math.PI / 2 : e.rot);
  enemyPath(e, e.r);
  ctx.fillStyle = hexA(e.color, 0.14); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = hexA(e.color, 0.28); ctx.lineWidth = 7; ctx.stroke();
  ctx.strokeStyle = e.color; ctx.lineWidth = 2.2; ctx.stroke();
  enemyPath(e, e.r * 0.42); ctx.strokeStyle = hexA(e.color, 0.8); ctx.lineWidth = 1.5; ctx.stroke();
  if (e.flash > 0) { enemyPath(e, e.r); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill(); }
  if (e.elite) {
    ctx.rotate(-e.rot * 2);
    ctx.strokeStyle = hexA('#ffe53b', 0.7); ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(0, 0, e.r + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  if ((e.elite || e.type === 'tank') && e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2, 3);
    ctx.fillStyle = e.color; ctx.fillRect(e.x - e.r, e.y - e.r - 10, (e.r * 2 * Math.max(0, e.hp)) / e.maxHp, 3);
  }
}
function drawBoss(e) {
  const r = e.r, col = e.color;
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 1 + Math.sin(G.time * 6) * 0.08;
  ctx.drawImage(glowSprite(col), -r * 1.6 * pulse, -r * 1.6 * pulse, r * 3.2 * pulse, r * 3.2 * pulse);
  ctx.globalCompositeOperation = 'source-over';
  const layer = (sides, rr, rot, w, alpha) => {
    ctx.save(); ctx.rotate(rot); ctx.beginPath();
    for (let i = 0; i < sides; i++) { const a = (i * TAU) / sides; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    ctx.fillStyle = 'rgba(8,4,24,0.85)'; if (alpha) ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(col, 0.3); ctx.lineWidth = w * 3.5; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  };
  layer(6, r, e.rot, 3, true);
  layer(3, r * 0.68, -e.rot * 1.7, 2.5, false);
  layer(6, r * 0.4, e.rot * 2.5, 2, false);
  // orbit nodes
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const a = e.rot * 1.4 + (i * TAU) / 6, rr = r * 1.25;
    ctx.drawImage(glowSprite(i % 2 ? '#ffe53b' : col), Math.cos(a) * rr - 8, Math.sin(a) * rr - 8, 16, 16);
  }
  ctx.drawImage(glowSprite('#ffffff'), -r * 0.3 * pulse, -r * 0.3 * pulse, r * 0.6 * pulse, r * 0.6 * pulse);
  if (e.flash > 0) { ctx.globalAlpha = 0.5; ctx.drawImage(glowSprite('#ffffff'), -r, -r, r * 2, r * 2); ctx.globalAlpha = 1; }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
function drawParticles() {
  for (const q of particles) {
    const k = q.life / q.max;
    if (q.type === 1) {
      ctx.globalAlpha = k; ctx.strokeStyle = q.color; ctx.lineWidth = q.size * 0.8;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); ctx.stroke();
    } else if (q.type === 2) {
      ctx.globalAlpha = k; ctx.strokeStyle = q.color; ctx.lineWidth = 2;
      const c = Math.cos(q.rot) * q.size, s = Math.sin(q.rot) * q.size;
      ctx.beginPath(); ctx.moveTo(q.x - c, q.y - s); ctx.lineTo(q.x + c, q.y + s); ctx.stroke();
    } else {
      const s = q.size * (0.5 + k) * 2;
      ctx.globalAlpha = k; ctx.drawImage(glowSprite(q.color), q.x - s, q.y - s, s * 2, s * 2);
    }
  }
  ctx.globalAlpha = 1;
}
function drawPickups() {
  for (const k of pickups) {
    if (k.life < 2 && Math.floor(k.life * 8) % 2 === 0) continue;
    if (k.type === 'heart') {
      ctx.drawImage(glowSprite('#ff3b5c'), k.x - 18, k.y - 18, 36, 36);
      ctx.fillStyle = '#ff3b5c'; ctx.font = font(16); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♥', k.x, k.y + 1);
      continue;
    }
    const s = k.type === 'big' ? 9 : 5.5, col = k.type === 'big' ? '#c35cff' : '#00f0ff';
    ctx.drawImage(glowSprite(col), k.x - s * 2.6, k.y - s * 2.6, s * 5.2, s * 5.2);
    ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.t * 3);
    ctx.fillStyle = '#e8ffff'; ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
    ctx.restore();
  }
}
function drawHoles() {
  for (const h of holes) {
    const k = Math.min(1, h.life / 0.4, (h.max - h.life) / 0.3);
    ctx.globalAlpha = k;
    ctx.drawImage(glowSprite('#c35cff'), h.x - h.r * 2.4, h.y - h.r * 2.4, h.r * 4.8, h.r * 4.8);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 0.75 * k, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#e0b0ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 0.78 * k, G.time * 6, G.time * 6 + 4.5); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawBolts() {
  for (const b of bolts) {
    ctx.globalAlpha = b.life / b.max;
    ctx.strokeStyle = b.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawRings() {
  for (const r of rings) {
    const k = r.life / r.max;
    ctx.globalAlpha = k; ctx.strokeStyle = r.color; ctx.lineWidth = r.width * k + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawTexts() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of texts) {
    const k = t.life / t.max, pop = k > 0.8 ? 1 + (k - 0.8) * 2.5 : 1;
    ctx.globalAlpha = Math.min(1, k * 2.5);
    ctx.font = font(Math.round(t.size * pop));
    ctx.shadowColor = t.color; ctx.shadowBlur = 10;
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}

// ============================================================ HUD
let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHud() {
  const p = player; if (!p) return;
  setText('hudScore', fmt(G.score));
  const m = mult().toFixed(1);
  if (hudCache.mult !== m) { const el = $('hudMult'); el.textContent = 'x' + m; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); hudCache.mult = m; }
  setText('hudWave', String(G.wave));
  setText('hudCrystals', fmt(run.crystals));
  const hpKey = `${p.hp}/${p.maxHp}/${p.shield}`;
  if (hudCache.hp !== hpKey) {
    hudCache.hp = hpKey;
    let h = '';
    for (let i = 0; i < p.maxHp; i++) h += `<i class="${i < p.hp ? '' : 'empty'}"></i>`;
    for (let i = 0; i < p.shield; i++) h += '<i class="shield"></i>';
    $('hpRow').innerHTML = h;
    $('vignette').classList.toggle('danger', p.hp === 1 && !p.dead);
  }
  const comboOn = G.combo >= 5;
  if (hudCache.comboOn !== comboOn) { hudCache.comboOn = comboOn; $('combo').classList.toggle('hidden', !comboOn); }
  if (comboOn) {
    if (hudCache.combo !== G.combo) { hudCache.combo = G.combo; $('comboNum').textContent = G.combo; const c = $('combo'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    $('comboFill').style.width = (G.comboT / 2.4) * 100 + '%';
  }
  const odPct = G.odT > 0 ? G.odT / p.odDur : G.od / 100;
  const odKey = Math.round(odPct * 100) + (G.odT > 0 ? 'a' : G.od >= 100 ? 'r' : '');
  if (hudCache.od !== odKey) {
    hudCache.od = odKey;
    $('odRing').style.strokeDashoffset = 276.5 * (1 - odPct);
    const b = $('odBtn'); b.classList.toggle('ready', G.od >= 100 && G.odT <= 0); b.classList.toggle('active', G.odT > 0);
  }
  if (G.boss) $('bossFill').style.width = Math.max(0, (G.boss.hp / G.boss.maxHp) * 100) + '%';
}

// ============================================================ upgrade cards
function rollMods(bossReward) {
  const p = player;
  const avail = MODS.filter((m) => (p.mods[m.id] || 0) < m.max && (!m.cond || m.cond(p)));
  const chosen = [];
  for (let n = 0; n < 3 && avail.length; n++) {
    const weights = avail.map((m) => { let w = RARITY[m.r].w; if (bossReward && m.r === 0) w *= 0.15; if (bossReward && m.r >= 2) w *= 2.5; return w; });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0), idx = 0;
    for (; idx < avail.length - 1; idx++) { r -= weights[idx]; if (r <= 0) break; }
    chosen.push(avail.splice(idx, 1)[0]);
  }
  return chosen;
}
let currentBossReward = false;
function showUpgrade(bossReward) {
  G.state = 'upgrade'; currentBossReward = bossReward;
  $('upTitle').textContent = bossReward ? 'BOSS DEFEATED' : `WAVE ${G.wave} CLEARED`;
  $('upSub').textContent = bossReward ? 'Choose a rare mod' : 'Choose a mod';
  renderCards(rollMods(bossReward));
  showScreen('upgrade');
  Sound.setIntensity(0);
}
function renderCards(mods) {
  const p = player, wrap = $('cards'); wrap.innerHTML = '';
  let hasLegend = false;
  for (const m of mods) {
    const rar = RARITY[m.r], stack = p.mods[m.id] || 0;
    if (m.r === 3) hasLegend = true;
    const el = document.createElement('button');
    el.className = 'card r' + m.r; el.style.setProperty('--rc', rar.color);
    el.innerHTML = `<div class="c-ic">${m.icon}</div><div class="c-body"><div class="c-rar">${rar.name}</div><div class="c-name">${m.name}</div><div class="c-desc">${m.desc}</div></div>${m.max < 99 ? `<div class="c-stack">${stack}/${m.max}</div>` : ''}`;
    el.addEventListener('click', () => chooseMod(m));
    wrap.appendChild(el);
  }
  if (hasLegend) Sound.legendary();
  $('rerollN').textContent = G.rerolls;
  $('rerollBtn').disabled = G.rerolls <= 0;
  $('modList').innerHTML = modSummary();
}
function modSummary() {
  return Object.entries(player.mods).map(([id, n]) => { const m = MODS.find((x) => x.id === id); return `<span>${m.icon} ${m.name}${n > 1 ? `<b>×${n}</b>` : ''}</span>`; }).join('');
}
function chooseMod(m) {
  if (G.state !== 'upgrade') return;
  const p = player;
  m.apply(p); p.mods[m.id] = (p.mods[m.id] || 0) + 1;
  if (m.r === 3) run.legendary++;
  Sound.select(); buzz(15);
  showScreen(null);
  G.state = 'play'; Sound.setIntensity(1);
  hudCache = {};
  floatText(p.x, p.y - 50, m.name.toUpperCase(), RARITY[m.r].color, 16, 1.3);
  ring(p.x, p.y, 90, RARITY[m.r].color, { width: 5 });
  startWave(G.wave + 1);
}

// ============================================================ progression
function checkProgress(final) {
  if (!run) return;
  const stats = Object.assign({}, run, { score: G.score });
  for (const m of save.missions.list) {
    const def = MISSION_POOL.find((x) => x.id === m.id); if (!def) continue;
    m.best = Math.max(m.best, stats[def.stat] || 0);
    if (!m.done && m.best >= m.target) {
      m.done = true; save.crystals += def.reward; persist();
      toast(`MISSION COMPLETE <b>+${def.reward}</b>`, '#3bff8a'); Sound.buy();
    }
  }
  for (const a of ACHIEVEMENTS) {
    if (save.ach[a.id]) continue;
    const needsSave = a.check.length > 1;
    if (needsSave && !final) continue;
    if (a.check(stats, save)) {
      save.ach[a.id] = true; save.crystals += a.reward; persist();
      toast(`🏆 ${a.name} <b>+${a.reward}</b>`, '#ffe53b'); Sound.buy();
    }
  }
}
function endRun() {
  G.state = 'over';
  $('hud').classList.add('hidden'); $('bossBar').classList.add('hidden'); $('tutorial').classList.add('hidden');
  $('vignette').classList.remove('danger');
  const greed = 1 + 0.1 * permLvl('greed');
  const gems = Math.round(run.crystals * greed) + run.wave * 2;
  const prevBest = save.best;
  save.crystals += gems;
  save.runs++; save.totalKills += run.kills;
  const newBest = G.score > save.best;
  if (newBest) save.best = G.score;
  save.bestWave = Math.max(save.bestWave, run.wave);
  // xp
  const xp = Math.round(G.score / 40 + run.wave * 25 + run.bosses * 150);
  save.xp += xp;
  const levelRewards = [];
  while (save.xp >= xpNeeded(save.level)) {
    save.xp -= xpNeeded(save.level); save.level++;
    const rw = 40 + save.level * 15; save.crystals += rw; levelRewards.push([save.level, rw]);
  }
  checkProgress(true);
  persist();
  // screen
  $('oScore').textContent = fmt(G.score);
  $('newBest').classList.toggle('hidden', !(newBest && prevBest > 0));
  $('oStats').innerHTML = [
    ['WAVE', run.wave], ['KILLS', fmt(run.kills)], ['MAX COMBO', run.maxCombo],
    ['GRAZES', run.grazes], ['BOSSES', run.bosses], ['BEST', fmt(save.best)],
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
  let rw = `<div class="rw" style="animation-delay:.1s"><span>Crystals collected${greed > 1 ? ` (+${Math.round((greed - 1) * 100)}%)` : ''}</span><b><i class="gem"></i>+${gems}</b></div>`;
  rw += `<div class="rw lv" style="animation-delay:.2s"><span>Pilot XP</span><b>+${fmt(xp)} XP</b></div>`;
  levelRewards.forEach(([lv, c], i) => { rw += `<div class="rw lv" style="animation-delay:${0.3 + i * 0.1}s"><span>LEVEL UP → ${lv}</span><b><i class="gem"></i>+${c}</b></div>`; });
  $('oRewards').innerHTML = rw;
  showScreen('over');
  if (levelRewards.length) setTimeout(() => Sound.levelup(), 400);
  Sound.setIntensity(0);
}

// ============================================================ screens / menus
const SCREENS = ['title', 'hangar', 'missions', 'upgrade', 'pause', 'over'];
function showScreen(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  if (id === 'title') refreshTitle();
  if (id === 'hangar') renderHangar();
  if (id === 'missions') renderMissions();
  document.querySelectorAll('.cc').forEach((el) => { el.textContent = fmt(save.crystals); });
  syncToggles();
}
function refreshTitle() {
  ensureDaily();
  $('tLevel').textContent = save.level;
  $('tRank').textContent = RANKS[Math.min(RANKS.length - 1, Math.floor((save.level - 1) / 4))];
  $('tXp').style.width = (save.xp / xpNeeded(save.level)) * 100 + '%';
  $('tCrystals').textContent = fmt(save.crystals);
  $('tBest').textContent = fmt(save.best);
  $('tBestWave').textContent = save.bestWave;
  $('missionDot').classList.toggle('hidden', save.missions.list.every((m) => m.done));
  const affordable = PERMS.some((pm) => permLvl(pm.id) < pm.max && save.crystals >= permCost(pm, permLvl(pm.id))) ||
    SHIPS.some((s) => !save.ships[s.id] && save.crystals >= s.cost);
  $('hangarDot').classList.toggle('hidden', !affordable);
}
let hangarTab = 'ships';
function renderHangar() {
  document.querySelectorAll('#hangar .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === hangarTab));
  const list = $('hangarList'); list.innerHTML = '';
  if (hangarTab === 'upgrades') {
    for (const pm of PERMS) {
      const lvl = permLvl(pm.id), maxed = lvl >= pm.max, cost = permCost(pm, lvl);
      const el = document.createElement('div'); el.className = 'item';
      el.innerHTML = `<div class="ic">${pm.icon}</div><div class="body"><div class="name">${pm.name}<small>LV ${lvl}/${pm.max}</small></div><div class="desc">${pm.desc}</div><div class="pips">${Array.from({ length: pm.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>`;
      const b = document.createElement('button');
      b.className = 'buy' + (maxed ? ' max' : '');
      b.innerHTML = maxed ? 'MAX' : `<i class="gem"></i>${fmt(cost)}`;
      b.disabled = !maxed && save.crystals < cost;
      if (!maxed) b.addEventListener('click', () => {
        if (save.crystals < cost) return;
        save.crystals -= cost; save.perm[pm.id] = lvl + 1; persist(); Sound.buy(); buzz(20); showScreen('hangar');
      });
      el.appendChild(b); list.appendChild(el);
    }
  } else {
    for (const sh of SHIPS) {
      const owned = !!save.ships[sh.id], sel = save.ship === sh.id;
      const el = document.createElement('div'); el.className = 'item' + (sel ? ' sel' : '');
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
      const c = cv.getContext('2d'); c.scale(2, 2);
      c.globalCompositeOperation = 'lighter'; c.drawImage(glowSprite(sh.color), 12, 12, 40, 40); c.globalCompositeOperation = 'source-over';
      drawShipOn(c, sh, 32, 32, 1.15, 0, owned ? 1 : 0.45);
      el.appendChild(cv);
      const body = document.createElement('div'); body.className = 'body';
      const bar = (lbl, v, max) => `<span>${lbl}</span><div class="sb"><div style="width:${Math.min(100, (v / max) * 100)}%"></div></div>`;
      body.innerHTML = `<div class="name" style="color:${sh.color}">${sh.name}</div><div class="desc">${sh.desc}</div><div class="statbars" style="--c:${sh.color}">${bar('HULL', sh.hp, 5)}${bar('POWER', sh.dmg, 1.3)}${bar('RATE', sh.rate, 1.2)}${bar('AGILITY', sh.speed, 1.3)}</div>`;
      el.appendChild(body);
      const b = document.createElement('button');
      if (sel) { b.className = 'buy sel'; b.textContent = 'ACTIVE'; }
      else if (owned) { b.className = 'buy'; b.textContent = 'SELECT'; b.addEventListener('click', () => { save.ship = sh.id; persist(); Sound.select(); showScreen('hangar'); }); }
      else {
        b.className = 'buy'; b.innerHTML = `<i class="gem"></i>${fmt(sh.cost)}`; b.disabled = save.crystals < sh.cost;
        b.addEventListener('click', () => {
          if (save.crystals < sh.cost) return;
          save.crystals -= sh.cost; save.ships[sh.id] = true; save.ship = sh.id; persist(); Sound.legendary(); buzz([30, 30, 30]);
          toast(`${sh.name} UNLOCKED`, sh.color); showScreen('hangar');
        });
      }
      el.appendChild(b); list.appendChild(el);
    }
  }
}
function renderMissions() {
  ensureDaily();
  const msLeft = (() => { const n = new Date(), t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return t - n; })();
  $('dailyReset').textContent = `RESETS IN ${Math.floor(msLeft / 3600000)}H ${Math.floor((msLeft % 3600000) / 60000)}M`;
  $('dailyList').innerHTML = save.missions.list.map((m) => {
    const def = MISSION_POOL.find((x) => x.id === m.id); if (!def) return '';
    const pct = Math.min(100, (m.best / m.target) * 100);
    return `<div class="item ${m.done ? 'done' : ''}" style="margin-bottom:10px"><div class="ic">${m.done ? '✓' : '◇'}</div><div class="body"><div class="name">${def.text(m.target)}</div><div class="desc">${m.done ? 'Completed' : `Best: ${fmt(Math.min(m.best, m.target))} / ${fmt(m.target)}`}</div><div class="progress"><div style="width:${pct}%"></div></div></div><div class="reward ${m.done ? 'claimed' : ''}"><i class="gem"></i>${def.reward}</div></div>`;
  }).join('');
  const got = ACHIEVEMENTS.filter((a) => save.ach[a.id]).length;
  $('achCount').textContent = `${got}/${ACHIEVEMENTS.length}`;
  $('achList').innerHTML = ACHIEVEMENTS.map((a) => `<div class="item ${save.ach[a.id] ? 'done' : ''}" style="margin-bottom:10px"><div class="ic">${save.ach[a.id] ? '🏆' : '🔒'}</div><div class="body"><div class="name">${a.name}</div><div class="desc">${a.desc}</div></div><div class="reward ${save.ach[a.id] ? 'claimed' : ''}"><i class="gem"></i>${a.reward}</div></div>`).join('');
}
function syncToggles() {
  document.querySelectorAll('.toggle').forEach((t) => t.classList.toggle('on', !!save.settings[t.dataset.set]));
}
function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'paused'; $('pauseMods').innerHTML = modSummary(); showScreen('pause');
  if (Sound.ctx) Sound.ctx.suspend();
}
function resumeGame() {
  if (G.state !== 'paused') return;
  showScreen(null); G.state = 'play'; Sound.init();
  last = performance.now();
}
function goTitle() {
  G.state = 'title'; player = null;
  $('hud').classList.add('hidden');
  enemies.length = ebullets.length = bullets.length = pickups.length = missiles.length = holes.length = 0;
  G.sector = 0; setSectorBg(); Sound.setIntensity(0);
  showScreen('title');
}

// ============================================================ input
const keys = { left: false, right: false, up: false, down: false };
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  Sound.init();
  if (G.state !== 'play' || !player) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId || !player) return;
  const sens = 1.25;
  player.tx += (e.clientX - drag.x) * sens; player.ty += (e.clientY - drag.y) * sens;
  player.tx = clamp(player.tx, 16, W - 16); player.ty = clamp(player.ty, 70, H - 30);
  drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === 'Space' || e.code === 'KeyE') { activateSurge(); e.preventDefault(); }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') pauseGame(); else if (G.state === 'paused') resumeGame(); }
  if (e.code === 'Enter' && (G.state === 'title' || G.state === 'over') && !e.repeat) startRun();
});
window.addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
document.addEventListener('pointerdown', () => Sound.init(), { once: false, passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseGame(); if (Sound.ctx) Sound.ctx.suspend(); }
  else if (G.state !== 'paused' && Sound.ctx) Sound.ctx.resume();
});
window.addEventListener('blur', pauseGame);
window.addEventListener('resize', resize);
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

const on = (id, fn) => $(id).addEventListener('click', (e) => { Sound.init(); fn(e); });
on('playBtn', () => { Sound.select(); startRun(); });
on('retryBtn', () => { Sound.select(); startRun(); });
on('hangarBtn', () => { Sound.click(); showScreen('hangar'); });
on('overHangarBtn', () => { Sound.click(); G.state = 'title'; $('hud').classList.add('hidden'); showScreen('hangar'); });
on('missionsBtn', () => { Sound.click(); showScreen('missions'); });
on('homeBtn', () => { Sound.click(); goTitle(); });
on('pauseBtn', () => { Sound.click(); pauseGame(); });
on('resumeBtn', () => { resumeGame(); Sound.click(); });
on('quitBtn', () => { G.state = 'play'; Sound.init(); player.dead = true; endRun(); });
on('odBtn', () => activateSurge());
on('rerollBtn', () => { if (G.rerolls <= 0 || G.state !== 'upgrade') return; G.rerolls--; Sound.click(); renderCards(rollMods(currentBossReward)); });
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { Sound.click(); goTitle(); }));
document.querySelectorAll('#hangar .tab').forEach((t) => t.addEventListener('click', () => { hangarTab = t.dataset.tab; Sound.click(); renderHangar(); }));
document.querySelectorAll('.toggle').forEach((t) => t.addEventListener('click', () => {
  const k = t.dataset.set; save.settings[k] = !save.settings[k]; persist(); Sound.init(); Sound.apply(); syncToggles();
  if (k === 'haptics' && save.settings.haptics) buzz(30); else Sound.click();
}));

// ============================================================ main loop
let last = performance.now();
function frame(now) {
  const real = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (G.state === 'play') {
    if (G.slowT > 0) G.slowT -= real;
    const ts = G.slowT > 0 ? 0.3 : 1;
    update(real * ts);
    updateHud();
    render(real * ts);
  } else if (G.state === 'title' || G.state === 'over') {
    G.scroll += real * 40; G.time += real;
    updateFx(real);
    if (G.state === 'title' && Math.random() < real * 1.5) {
      const c = pick(['#00f0ff', '#ff2bd6', '#ffe53b', '#3bff8a']);
      burst(rand(40, W - 40), rand(H * 0.15, H * 0.85), c, 16, 220, 3, 0.9, 1);
    }
    render(real);
  } else {
    render(0);
  }
  requestAnimationFrame(frame);
}

// ============================================================ boot
resize();
ensureDaily();
showScreen('title');
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !/claude|artifact/.test(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// test / debug hook
window.__NS = { G, get player() { return player; }, enemies, startRun, save };
})();
