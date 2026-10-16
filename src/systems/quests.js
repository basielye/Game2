// Mission flow: steps, objectives, markers, rewards and story beats.
import * as THREE from 'three';
import { QUESTS, DIALOGS } from '../data/story.js';
import { locById } from '../data/world.js';
import { ITEMS } from '../data/items.js';

export class Quests {
  constructor(game) {
    this.game = game;
    this.qi = 0;
    this.si = 0;
    this.finished = false;
    this.completed = [];
    this.flags = {};
    this.stepStart = 0;
    const ev = game.events;
    ev.on('item', () => this.check());
    ev.on('craft', (d) => this.notify('craft', d));
    ev.on('interact', (d) => this.notify('interact', d));
    ev.on('death', (d) => this.notify('death', d));
    ev.on('tame', (d) => this.notify('tame', d));
    ev.on('mount', (d) => this.notify('mount', d));
    ev.on('loot', (d) => this.notify('loot', d));
  }
  get quest() { return this.finished ? null : QUESTS[this.qi]; }
  get step() { const q = this.quest; return q ? q.steps[this.si] : null; }

  serialize() { return { qi: this.qi, si: this.si, finished: this.finished, completed: this.completed, flags: this.flags }; }
  load(s) { Object.assign(this, s); this.onStepStart(true); }

  begin() { this.qi = 0; this.si = 0; this.onStepStart(); }

  onStepStart(silent = false) {
    const s = this.step;
    if (!s) return;
    this.stepStart = performance.now();
    const G = this.game;
    if (!silent) G.hud.objective(this.quest.title, s.text, s.hint);
    else G.hud.objective(this.quest.title, s.text, null);
    // story hooks
    if (s.type === 'killTag') G.population.ensureCamp(s.tag.split(':')[1]);
    if (s.type === 'killId' && s.id === 'crane') G.population.ensureCamp('cranecamp');
    if (this.quest.id === 'm7' && s.type === 'killId') G.population.spawnRexNear(locById.cranecamp, 260);
  }

  // Can the player talk to this npc for the story right now?
  wantsTalk(npcId) { const s = this.step; return s && s.type === 'talk' && s.npc === npcId; }

  talk(npcId) {
    const s = this.step;
    if (!this.wantsTalk(npcId)) return false;
    this.game.ui.dialog(DIALOGS[s.dialog], () => this.advance());
    return true;
  }

  notify(type, d) {
    const s = this.step;
    if (!s) return;
    if (type === 'craft' && s.type === 'craft' && s.id === d.id) this.advance();
    else if (type === 'interact' && s.type === 'interact' && s.action === d.action && (!s.id || s.id === d.id)) this.advance();
    else if (type === 'loot' && s.type === 'loot' && d.kind === 'dino') this.advance();
    else if (type === 'tame' && s.type === 'tame') this.advance();
    else if (type === 'mount' && s.type === 'mount') this.advance();
    else if (type === 'death') {
      const e = d.entity;
      if (s.type === 'killId' && e.id2 === s.id) this.advance();
      if (s.type === 'killTag' && e.tags.has(s.tag)) setTimeout(() => this.check(), 50);
    }
  }

  check() {
    const s = this.step;
    if (!s) return;
    const G = this.game;
    if (s.type === 'collect' && G.inventory.has(s.items)) this.advance();
    if (s.type === 'killTag') {
      const camp = s.tag.split(':')[1];
      if (G.population.campCleared(camp)) this.advance();
    }
  }

  update(dt) {
    const s = this.step;
    if (!s) return;
    const G = this.game;
    if (s.type === 'goto') {
      const L = locById[s.loc];
      if (Math.hypot(G.player.pos.x - L.x, G.player.pos.z - L.z) < s.r) this.advance();
    }
    if (s.type === 'collect' || s.type === 'killTag') { this._t = (this._t || 0) + dt; if (this._t > 0.5) { this._t = 0; this.check(); } }
    if (s.type === 'killId' && s.id === 'crane') {
      const c = G.entities.find((e) => e.id2 === 'crane');
      if (c && !c.alive) this.advance();
      if (c && c.alive && !this.flags.taunt && c.pos.distanceTo(G.player.pos) < 45 && c.canSee?.(G.player, 60)) { this.flags.taunt = true; G.ui.dialog(DIALOGS.crane_taunt, null, true); }
    }
  }

  advance() {
    const G = this.game;
    const q = this.quest;
    if (!q) return;
    G.audio.ui('pickup');
    this.si++;
    if (this.si >= q.steps.length) {
      this.completed.push(q.id);
      const r = q.reward || {};
      const parts = [];
      if (r.money) { G.inventory.add('money', r.money, true); parts.push(`$${r.money}`); }
      if (r.items) for (const [k, n] of Object.entries(r.items)) if (n > 0) { G.inventory.add(k, n, true); parts.push(`${n} ${ITEMS[k].name}`); }
      if (r.weapon) { G.player.giveWeapon(r.weapon); parts.push('Lever-Action Rifle'); }
      G.hud.banner('MISSION COMPLETE', q.title, parts.join('  ·  '));
      G.audio.ui('quest');
      this.onQuestComplete(q.id);
      this.qi++; this.si = 0;
      if (this.qi >= QUESTS.length) { this.finished = true; G.hud.objective('Free Roam', 'Explore the island, hunt, and collect bounties.', null); }
      else {
        const next = QUESTS[this.qi];
        this.onStepStart(true);
        setTimeout(() => { if (QUESTS[this.qi] === next && this.si === 0) { G.hud.banner('NEW MISSION', next.title, next.desc); this.onStepStart(); } }, 4200);
      }
      G.save();
      return;
    }
    G.hud.toast('Objective complete');
    this.onStepStart();
    G.save();
  }

  onQuestComplete(id) {
    const G = this.game;
    if (id === 'm5') { this.flags.power = true; G.onPowerRestored(); }
  }

  markerPos() {
    const s = this.step;
    if (!s) return null;
    const G = this.game;
    const v = new THREE.Vector3();
    switch (s.type) {
      case 'goto': { const L = locById[s.loc]; return v.set(L.x, G.terrain.getHeight(L.x, L.z), L.z); }
      case 'talk': { const n = G.population.npcs[s.npc]; return n ? v.copy(n.pos) : null; }
      case 'interact': {
        const it = G.structures.interactables.find((i) => (s.id ? i.id === s.id : i.action === s.action));
        return it ? v.copy(it.pos) : null;
      }
      case 'killTag': { const L = locById[s.tag.split(':')[1]]; return v.set(L.x, G.terrain.getHeight(L.x, L.z), L.z); }
      case 'killId': { const c = G.entities.find((e) => e.id2 === s.id && e.alive); return c ? v.copy(c.pos) : null; }
      case 'tame': case 'mount': {
        if (s.type === 'mount' && G.population.mount) return v.copy(G.population.mount.pos);
        let best = null, bd = Infinity;
        for (const e of G.entities) if (e.kind === 'dino' && e.alive && e.def.mountable) { const d = e.pos.distanceTo(G.player.pos); if (d < bd) { bd = d; best = e; } }
        return best ? v.copy(best.pos) : null;
      }
    }
    return null;
  }
}
