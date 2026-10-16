export const ITEMS = {
  money: { name: 'Dollars', icon: '$' },
  wood: { name: 'Wood', icon: '🪵', stack: 30, sell: 0.5 },
  flint: { name: 'Flint', icon: '🪨', stack: 30, sell: 0.5 },
  fiber: { name: 'Plant Fiber', icon: '🌿', stack: 30, sell: 0.3 },
  herb: { name: 'Healing Herb', icon: '🌱', stack: 20, sell: 1 },
  berries: { name: 'Wild Berries', icon: '🫐', stack: 20, sell: 0.5, eat: 8 },
  meat: { name: 'Raw Meat', icon: '🥩', stack: 20, sell: 2, eat: 15 },
  cookedMeat: { name: 'Cooked Meat', icon: '🍖', stack: 20, sell: 3, eat: 40 },
  hide: { name: 'Small Hide', icon: '🟫', stack: 20, sell: 4 },
  bigHide: { name: 'Thick Hide', icon: '🟤', stack: 20, sell: 12 },
  feather: { name: 'Feather', icon: '🪶', stack: 30, sell: 1 },
  claw: { name: 'Raptor Claw', icon: '🦴', stack: 20, sell: 10 },
  venom: { name: 'Dilo Venom Sac', icon: '🧪', stack: 10, sell: 8 },
  rexTooth: { name: 'Tyrannosaur Tooth', icon: '🦷', stack: 5, sell: 150 },
  amber: { name: 'Amber Fossil', icon: '🟠', stack: 50, sell: 25 },
  bandage: { name: 'Bandage', icon: '🩹', stack: 10, heal: 45 },
  tonic: { name: 'Focus Tonic', icon: '🧉', stack: 5 },
  bait: { name: 'Meat Bait', icon: '🍗', stack: 10 },
  arrow: { name: 'Arrows', icon: '➶', stack: 40 },
  poisonArrow: { name: 'Venom Arrows', icon: '➶', stack: 20 },
  pistolAmmo: { name: 'Revolver Rounds', icon: '•', stack: 60 },
  rifleAmmo: { name: 'Rifle Cartridges', icon: '▪', stack: 40 },
  fuse: { name: 'Plant Fuse', icon: '⚡', stack: 1, key: true },
  radioPart: { name: 'Radio Crystal', icon: '📻', stack: 1, key: true },
};

export const WEAPONS = {
  machete: { name: 'Machete', slot: 1, type: 'melee', dmg: 38, rate: 0.55, range: 2.6 },
  bow: { name: 'Hunting Bow', slot: 2, type: 'bow', dmg: 70, ammo: 'arrow', speed: 75, silent: true, rate: 0.5 },
  pistol: { name: 'Cattleman Revolver', slot: 3, type: 'gun', hold: 'pistol', dmg: 38, rate: 0.32, clip: 6, ammo: 'pistolAmmo', spread: 0.014, reload: 1.8, range: 140, noise: 95 },
  rifle: { name: 'Lever-Action Rifle', slot: 4, type: 'gun', hold: 'rifle', dmg: 85, rate: 0.85, clip: 8, ammo: 'rifleAmmo', spread: 0.004, reload: 2.6, range: 320, noise: 160, zoom: true },
};

export const RECIPES = [
  { id: 'bow', name: 'Hunting Bow', needs: { wood: 3, fiber: 3 }, gives: { weapon: 'bow' }, once: true, desc: 'Silent. Arrows can be crafted from wood and flint.' },
  { id: 'arrows', name: 'Arrows ×6', needs: { wood: 2, flint: 1 }, gives: { arrow: 6 } },
  { id: 'poison', name: 'Venom Arrows ×4', needs: { arrow: 4, venom: 1 }, gives: { poisonArrow: 4 }, desc: 'Poisoned targets turn on their own kind.' },
  { id: 'bandage', name: 'Bandage', needs: { fiber: 2, herb: 1 }, gives: { bandage: 1 } },
  { id: 'bait', name: 'Meat Bait', needs: { meat: 1, fiber: 1 }, gives: { bait: 1 }, desc: 'Lure and tame herbivores to ride.' },
  { id: 'tonic', name: 'Focus Tonic', needs: { berries: 2, herb: 2 }, gives: { tonic: 1 }, desc: 'Refills your Dead Eye focus.' },
  { id: 'quiver', name: 'Hide Quiver', needs: { hide: 3, fiber: 2 }, gives: { upgrade: 'quiver' }, once: true, desc: 'Carry 40 arrows.' },
  { id: 'satchel', name: 'Thick Hide Satchel', needs: { bigHide: 2, hide: 2 }, gives: { upgrade: 'satchel' }, once: true, desc: 'Carry more of every crafting resource and ammo.' },
  { id: 'armor', name: 'Raptor-Claw Vest', needs: { claw: 3, bigHide: 2 }, gives: { upgrade: 'armor' }, once: true, desc: '+50 max health.' },
];

export const SHOP = {
  store: {
    title: 'General Store', owner: 'Ma Delgado',
    buy: [['bandage', 1, 8], ['bait', 1, 6], ['arrow', 6, 5], ['pistolAmmo', 12, 6], ['cookedMeat', 1, 5], ['tonic', 1, 15]],
    sells: ['meat', 'hide', 'bigHide', 'feather', 'claw', 'venom', 'rexTooth', 'amber', 'berries', 'herb', 'cookedMeat'],
  },
  gunsmith: {
    title: 'Gunsmith', owner: 'Old Tobias',
    buy: [['pistolAmmo', 12, 6], ['rifleAmmo', 8, 10], ['weapon:rifle', 1, 120], ['arrow', 6, 5], ['poisonArrow', 4, 18]],
    sells: ['claw', 'rexTooth', 'amber'],
  },
};
