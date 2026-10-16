import { ITEMS, RECIPES } from '../data/items.js';

export class Inventory {
  constructor(game) {
    this.game = game;
    this.items = { money: 12, pistolAmmo: 12, bandage: 1, meat: 1 };
    this.crafted = new Set();
  }
  count(k) { return this.items[k] || 0; }
  add(k, n = 1, silent = false) {
    if (n <= 0) return 0;
    const cap = k === 'money' ? Infinity : this.game.player.maxAmmo(k);
    const have = this.count(k);
    const take = Math.max(0, Math.min(n, cap - have));
    this.items[k] = have + take;
    if (!silent && take > 0) this.game.hud?.pickup(k, take);
    if (!silent && take < n) this.game.hud?.toast(`Can't carry more ${ITEMS[k]?.name || k}`);
    this.game.events.emit('item', { k, n: take });
    return take;
  }
  remove(k, n = 1) { const have = this.count(k); const r = Math.min(have, n); this.items[k] = have - r; return r; }
  has(needs) { return Object.entries(needs).every(([k, n]) => this.count(k) >= n); }
  canCraft(r) { return this.has(r.needs) && !(r.once && this.crafted.has(r.id)); }
  craft(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r || !this.canCraft(r)) return false;
    for (const [k, n] of Object.entries(r.needs)) this.remove(k, n);
    const P = this.game.player;
    for (const [k, v] of Object.entries(r.gives)) {
      if (k === 'weapon') { P.giveWeapon(v); this.game.hud.toast(`Crafted ${r.name}`); }
      else if (k === 'upgrade') { P.upgrades.add(v); if (v === 'armor') { P.maxHp += 50; P.hp += 50; } this.game.hud.toast(`Crafted ${r.name}`); }
      else this.add(k, v);
    }
    if (r.once) this.crafted.add(r.id);
    this.game.audio.ui('pickup');
    this.game.events.emit('craft', { id });
    return true;
  }
  use(k) {
    const P = this.game.player, def = ITEMS[k];
    if (!def || this.count(k) <= 0) return false;
    if (def.heal) { if (P.hp >= P.maxHp) return false; P.hp = Math.min(P.maxHp, P.hp + def.heal); }
    else if (def.eat) { if (P.hp >= P.maxHp && P.stamina >= P.maxStamina) return false; P.hp = Math.min(P.maxHp, P.hp + def.eat); P.stamina = P.maxStamina; }
    else if (k === 'tonic') P.focus = 100;
    else return false;
    this.remove(k, 1);
    this.game.audio.ui('pickup');
    this.game.hud.toast(`Used ${def.name}`);
    return true;
  }
}
