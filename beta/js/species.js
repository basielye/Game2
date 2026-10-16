/* The plant catalogue. Every entry drives both the procedural artwork and the Herbarium text.
   Leaf spec reference:
     shape   outline family (see PlantArt SHAPES)      w      width / length ratio
     L       mature leaf length (scene units)           base/light/dark/edge  leaf colours
     under   underside colour (shown on flipped leaves) asym   left/right asymmetry
     veins   { n per side, color, w, op, mid(rib width), k(vein angle), glow, collective, net }
     var     variegation { type, color, amount, color2 }
     fen     fenestration { splits, splitDepth, splitW, holes:[u..], holeProb, holeLen, aspect, maxFill }
     tex     gloss | velvet | waxy | matte | quilt-gloss | quilt-velvet
     margin  { type: wavy|scallop, amp, freq }
*/
const RARITY = ['', 'Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];

const SPECIES = [
  /* ───────────────────────────── MONSTERA ───────────────────────────── */
  {
    id: 'm_deliciosa', zone: 'palm', genus: 'Monstera', name: 'Monstera deliciosa', common: 'Swiss Cheese Plant',
    latin: 'Monstera deliciosa Liebm.', origin: 'Southern Mexico to Panama', rarity: 1,
    care: { light: 3, water: 3, humid: 3 },
    blurb: 'The plant that started a thousand collections. Glossy, deeply split leaves with a row of oval windows running beside the midrib.',
    facts: [
      'Young plants grow solid, heart-shaped leaves. The famous splits only appear once the plant climbs and matures, which botanists call heteroblasty.',
      'One theory says the holes let wind and dappled light through, so the plant can grow huge leaves for little cost.',
      'The ripe fruit tastes like pineapple and banana. Unripe fruit is full of needle-like calcium oxalate crystals.'
    ],
    form: 'monstera', petiole: '#4f7d34',
    leaf: { shape: 'monstera', w: 1.0, L: 118, base: '#2d6a2a', light: '#4f9c3f', dark: '#1b461b', edge: '#163914',
      veins: { n: 8, color: '#86bd67', w: 1.5, op: .55, mid: 3.4, k: .65 },
      fen: { splits: .95, splitDepth: .82, splitW: .03, holes: [.22], holeProb: .75, holeLen: .075, aspect: .42 },
      tex: 'gloss', asym: .14 }
  },
  {
    id: 'm_thai', zone: 'palm', genus: 'Monstera', name: "Monstera 'Thai Constellation'", common: 'Thai Con',
    latin: "Monstera deliciosa 'Thai Constellation'", origin: 'Tissue-culture lab, Thailand', rarity: 3,
    care: { light: 4, water: 3, humid: 3 },
    blurb: 'Every leaf looks like a night sky: thousands of creamy specks and streaks scattered over deep green.',
    facts: [
      'The variegation comes from a stable mutation, so unlike the Albo it almost never reverts to plain green.',
      'It was developed and mass-produced in Thai tissue-culture labs, and for years it was one of the most sought-after houseplants in the world.',
      'The cream areas have less chlorophyll, so it grows a little slower than a green deliciosa and likes bright light.'
    ],
    form: 'monstera', petiole: '#5d8a3d', petioleVar: '#e9e2c4',
    leaf: { shape: 'monstera', w: 1.0, L: 116, base: '#2f6d2c', light: '#53a044', dark: '#1d4a1d', edge: '#173914',
      veins: { n: 8, color: '#93c776', w: 1.5, op: .5, mid: 3.4, k: .65 },
      var: { type: 'speckle', color: '#efe8cc', amount: 1 },
      fen: { splits: .95, splitDepth: .8, splitW: .03, holes: [.22], holeProb: .7, holeLen: .07, aspect: .42 },
      tex: 'gloss', asym: .14 }
  },
  {
    id: 'm_albo', zone: 'palm', genus: 'Monstera', name: "Monstera 'Albo Borsigiana'", common: 'Albo',
    latin: "Monstera deliciosa var. borsigiana 'Albo Variegata'", origin: 'Cultivated sport', rarity: 4,
    care: { light: 4, water: 3, humid: 4 },
    blurb: 'Bold half-moons and sectors of pure white, painted at random across each leaf. No two leaves are ever the same.',
    facts: [
      'The white comes from a chimera, a mix of green and chlorophyll-free cells. The pattern can drift to all green or all white.',
      'A completely white "ghost" leaf is beautiful but cannot photosynthesise, and it browns quickly.',
      '"Borsigiana" is a trade name for a smaller form with longer gaps between leaves. Botanists now treat it as plain deliciosa.'
    ],
    form: 'monstera', petiole: '#5a8a3a', petioleVar: '#f3f1e6',
    leaf: { shape: 'monstera', w: .98, L: 112, base: '#2c6a2b', light: '#4e9b3f', dark: '#1b451b', edge: '#163914',
      veins: { n: 8, color: '#8cc06c', w: 1.5, op: .5, mid: 3.4, k: .65 },
      var: { type: 'sectoral', color: '#f6f4ea', amount: .75 },
      fen: { splits: .9, splitDepth: .78, splitW: .03, holes: [.22], holeProb: .65, holeLen: .07, aspect: .42 },
      tex: 'gloss', asym: .15 }
  },
  {
    id: 'm_aurea', zone: 'palm', genus: 'Monstera', name: "Monstera 'Aurea'", common: 'Yellow Monster',
    latin: "Monstera deliciosa 'Aurea Variegata'", origin: 'Cultivated sport', rarity: 5,
    care: { light: 4, water: 3, humid: 4 },
    blurb: 'Sectors of butter-yellow to chartreuse flood the leaves, glowing as if lit from inside.',
    facts: [
      'Yellow variegation keeps some carotenoid pigments, so the yellow parts of the leaf are not completely inactive.',
      'Like the Albo it is an unstable chimera, so each cutting is a gamble.',
      'Its slow growth and scarcity have made it one of the most valuable Monsteras.'
    ],
    form: 'monstera', petiole: '#6b9a3a', petioleVar: '#e8d36a',
    leaf: { shape: 'monstera', w: .98, L: 112, base: '#2e6b2a', light: '#54a03f', dark: '#1d491b', edge: '#163914',
      veins: { n: 8, color: '#a8cf72', w: 1.5, op: .5, mid: 3.4, k: .65 },
      var: { type: 'sectoral', color: '#e7cf52', amount: .8 },
      fen: { splits: .9, splitDepth: .78, splitW: .03, holes: [.22], holeProb: .65, holeLen: .07, aspect: .42 },
      tex: 'gloss', asym: .15 }
  },
  {
    id: 'm_mint', zone: 'palm', genus: 'Monstera', name: "Monstera 'Mint'", common: 'Mint Monstera',
    latin: "Monstera deliciosa 'Mint'", origin: 'Cultivated sport', rarity: 5,
    care: { light: 4, water: 3, humid: 4 },
    blurb: 'Soft sage and mint-green variegation in broad marbled sectors. Cool and quietly luxurious.',
    facts: [
      'The mint colour comes from a lighter green cell layer, not pure white tissue.',
      'Mint sectors can drift towards white in very bright light.',
      'It is among the rarest Monstera sports in the hobby.'
    ],
    form: 'monstera', petiole: '#5f9150', petioleVar: '#c6e3b5',
    leaf: { shape: 'monstera', w: 1.0, L: 114, base: '#2d6a2c', light: '#4f9a43', dark: '#1b461c', edge: '#163914',
      veins: { n: 8, color: '#9fd18a', w: 1.5, op: .5, mid: 3.4, k: .65 },
      var: { type: 'sectoral', color: '#b9dfb0', amount: .9, color2: '#d7eed0' },
      fen: { splits: .9, splitDepth: .8, splitW: .03, holes: [.22], holeProb: .65, holeLen: .07, aspect: .42 },
      tex: 'gloss', asym: .14 }
  },
  {
    id: 'm_adansonii', zone: 'palm', genus: 'Monstera', name: 'Monstera adansonii', common: 'Swiss Cheese Vine',
    latin: 'Monstera adansonii Schott', origin: 'Central & South America', rarity: 1,
    care: { light: 3, water: 3, humid: 3 },
    blurb: 'A fast, forgiving vine with soft leaves full of oval holes that never break the margin.',
    facts: [
      'These holes are true perforations: they stay closed at the edge, unlike the open splits of a deliciosa.',
      'Wild populations vary hugely, from narrow-leaf forms to round-leaf forms such as "Laniata".',
      'It is often mistaken for the far rarer Monstera obliqua, which has much thinner leaves.'
    ],
    form: 'climber', petiole: '#4e8a36',
    leaf: { shape: 'ovate', w: .9, L: 82, base: '#3b8434', light: '#5fae4a', dark: '#245a22', edge: '#1d4a1b',
      veins: { n: 7, color: '#7fbf63', w: 1.2, op: .45, mid: 2.4, k: .8 },
      fen: { holes: [.4, .72], holeProb: .9, holeLen: .1, aspect: .5, maxFill: .4 },
      tex: 'gloss', asym: .22 }
  },
  {
    id: 'm_obliqua', zone: 'palm', genus: 'Monstera', name: "Monstera obliqua 'Peru'", common: 'The Unicorn',
    latin: 'Monstera obliqua Miq.', origin: 'Peruvian Amazon', rarity: 5,
    care: { light: 3, water: 4, humid: 5 },
    blurb: 'Paper-thin, almost translucent leaves that can be more hole than leaf, like green lace.',
    facts: [
      'The Peru form can be up to 90% open space, leaving only a fine skeleton of veins and margin.',
      'Its leaves are so thin they tear easily and need very high humidity.',
      'It grows painfully slowly and is still among the most coveted aroids in the world.'
    ],
    form: 'climber', petiole: '#64a046',
    leaf: { shape: 'ovate', w: .86, L: 74, base: '#58a043', light: '#7cc45d', dark: '#3c7a2f', edge: '#2e6626',
      veins: { n: 7, color: '#9bd681', w: 1.0, op: .4, mid: 1.8, k: .8 },
      fen: { holes: [.3, .66], holeProb: 1, holeLen: .2, aspect: .8, maxFill: .44, rowSpan: .16 },
      tex: 'matte', asym: .25 }
  },
  {
    id: 'm_peru', zone: 'palm', genus: 'Monstera', name: "Monstera 'Peru'", common: 'Karstenianum',
    latin: 'Monstera karstenianum', origin: 'Peru', rarity: 2,
    care: { light: 3, water: 2, humid: 2 },
    blurb: 'Thick, rubbery, deeply puckered leaves with a lacquered shine. No holes, all texture.',
    facts: [
      'The puckered surface comes from deeply sunken veins, which give it a quilted look.',
      'Its thick leaves hold water well, so it copes with dry rooms better than most Monsteras.',
      'Its trade name "Peru" stuck long before botanists identified it as M. karstenianum.'
    ],
    form: 'climber', petiole: '#3f7a35',
    leaf: { shape: 'elliptic', w: .78, L: 60, base: '#246a2c', light: '#3f9443', dark: '#14421a', edge: '#0f3313',
      veins: { n: 6, color: '#14431b', w: 2.2, op: .65, mid: 2.6, k: .6 },
      tex: 'quilt-gloss', asym: .06 }
  },
  {
    id: 'm_esqueleto', zone: 'palm', genus: 'Monstera', name: "Monstera 'Esqueleto'", common: 'Skeleton Monstera',
    latin: "Monstera epipremnoides 'Esqueleto'", origin: 'Costa Rica', rarity: 4,
    care: { light: 3, water: 3, humid: 5 },
    blurb: 'Large leaves riddled with big windows that run right out to the edge, like a leaf skeleton.',
    facts: [
      '"Esqueleto" means skeleton in Spanish and Portuguese.',
      'The outer row of windows often breaks through the margin, which makes the leaf edge look scalloped.',
      'Mature leaves can reach almost a metre long in a humid greenhouse.'
    ],
    form: 'monstera', petiole: '#4c8a3a',
    leaf: { shape: 'elliptic', w: .9, L: 120, base: '#3a8436', light: '#5daa48', dark: '#235622', edge: '#1b4619',
      veins: { n: 9, color: '#80bf66', w: 1.3, op: .5, mid: 3.0, k: .75 },
      fen: { splits: .35, splitDepth: .25, splitW: .05, holes: [.35, .72], holeProb: .95, holeLen: .15, aspect: .62, maxFill: .42, rowSpan: .17 },
      tex: 'gloss', asym: .12 }
  },
  {
    id: 'm_siltepecana', zone: 'palm', genus: 'Monstera', name: 'Monstera siltepecana', common: 'Silver Monstera',
    latin: 'Monstera siltepecana Matuda', origin: 'Chiapas, Mexico to Panama', rarity: 2,
    care: { light: 3, water: 3, humid: 3 },
    blurb: 'Lance-shaped juvenile leaves washed in metallic silver, cut through with dark green veins.',
    facts: [
      'Named after Siltepec in Chiapas, where it was first collected.',
      'The silver comes from an air gap under the leaf surface that scatters light.',
      'Mature leaves lose the silver, turn green and grow fenestrations, so it barely looks like the same plant.'
    ],
    form: 'climber', petiole: '#5b7d5e',
    leaf: { shape: 'lanceolate', w: 1.15, L: 74, base: '#4c7457', light: '#7da48a', dark: '#2f5038', edge: '#2a4632',
      veins: { n: 7, color: '#244a30', w: 1.8, op: .75, mid: 2.4, k: .9 },
      var: { type: 'silver', color: '#b9cdbf', amount: .85 },
      tex: 'gloss', asym: .08 }
  },
  {
    id: 'm_dubia', zone: 'palm', genus: 'Monstera', name: 'Monstera dubia', common: 'Shingle Plant',
    latin: 'Monstera dubia (Kunth) Engl. & K.Krause', origin: 'Central & South America', rarity: 3,
    care: { light: 3, water: 3, humid: 4 },
    blurb: 'Tiny silver-marbled hearts pressed flat against bark, overlapping like roof shingles.',
    facts: [
      'Juvenile leaves lie flat against the tree bark. This growth habit is called shingling.',
      'The adult form looks completely different, with large, split leaves held away from the trunk.',
      'Growers train it up wooden planks or cork boards to show off the shingling.'
    ],
    form: 'shingle', petiole: '#4d6b4f',
    leaf: { shape: 'cordate', w: .88, L: 44, base: '#3a6646', light: '#5b8a66', dark: '#24452d', edge: '#1f3a27',
      veins: { n: 5, color: '#29503a', w: 1.2, op: .6, mid: 1.6 },
      var: { type: 'marble', color: '#a7c2ad', amount: .55 },
      tex: 'gloss', asym: .05 }
  },
  {
    id: 'm_standleyana', zone: 'palm', genus: 'Monstera', name: "Monstera standleyana 'Albo'", common: 'Five Holes Plant',
    latin: "Monstera standleyana 'Albo Variegata'", origin: 'Costa Rica & Panama', rarity: 3,
    care: { light: 4, water: 3, humid: 3 },
    blurb: 'Long elliptic leaves streaked and splashed with brilliant white, as if brushed with paint.',
    facts: [
      'It is often sold as "Philodendron Cobra", which is a mix-up because it is a true Monstera.',
      'The streaky variegation follows the lateral veins, so leaves look pinstriped.',
      'Its juvenile leaves never fenestrate, which makes it an easy, tidy climber.'
    ],
    form: 'climber', petiole: '#5a8d4a', petioleVar: '#eef0e2',
    leaf: { shape: 'elliptic', w: .7, L: 78, base: '#2c6a33', light: '#4c9750', dark: '#1a4520', edge: '#163a1a',
      veins: { n: 9, color: '#6aa86a', w: 1.0, op: .5, mid: 2.2, k: 1.1 },
      var: { type: 'streaks', color: '#f4f6ec', amount: .9 },
      tex: 'gloss', asym: .1 }
  },

  /* ───────────────────────────── VELVET AROIDS ───────────────────────────── */
  {
    id: 'p_pink_princess', zone: 'velvet', genus: 'Philodendron', name: "Philodendron 'Pink Princess'", common: 'PPP',
    latin: "Philodendron erubescens 'Pink Princess'", origin: 'Cultivated hybrid', rarity: 3,
    care: { light: 4, water: 3, humid: 3 },
    blurb: 'Near-black burgundy leaves splashed with bubblegum pink, on blushing red stems.',
    facts: [
      'The pink areas lack chlorophyll and show red anthocyanin pigments instead.',
      'Without enough light the pink fades and the plant slowly reverts to dark green.',
      'A leaf that is completely pink is called a "half-moon" or "full-moon" and is treasured, though short-lived.'
    ],
    form: 'rosette', petiole: '#7b2a45', petLen: 120, spread: 52,
    leaf: { shape: 'elongCordate', w: .95, L: 86, base: '#2e3524', light: '#4a4b33', dark: '#1b2014', edge: '#14180f',
      veins: { n: 6, color: '#4f2b33', w: 1.1, op: .55, mid: 2.6 },
      var: { type: 'sectoral', color: '#f08db3', amount: .85, color2: '#f7b9d0' },
      tex: 'gloss', asym: .08 }
  },
  {
    id: 'p_birkin', zone: 'velvet', genus: 'Philodendron', name: "Philodendron 'Birkin'", common: 'Pinstripe Philo',
    latin: "Philodendron 'Birkin'", origin: "Sport of P. 'Rojo Congo'", rarity: 2,
    care: { light: 3, water: 3, humid: 3 },
    blurb: 'Glossy deep-green leaves drawn with fine cream pinstripes, like a tailored suit.',
    facts: [
      'Birkin appeared as a spontaneous mutation of the red-leaved "Rojo Congo".',
      'New leaves often unfurl almost white and darken as they age.',
      'Stress or low light can make it revert to its Congo parent.'
    ],
    form: 'rosette', petiole: '#3d6b3a', petLen: 90, spread: 45,
    leaf: { shape: 'ovate', w: .82, L: 84, base: '#1f4f2a', light: '#33703c', dark: '#123419', edge: '#0f2c14',
      veins: { n: 8, color: '#f0eedc', w: 1.0, op: .85, mid: 2.6, k: 1.0 },
      var: { type: 'pinstripe', color: '#efedd8', amount: .9 },
      tex: 'gloss', asym: .05 }
  },
  {
    id: 'p_gloriosum', zone: 'velvet', genus: 'Philodendron', name: 'Philodendron gloriosum', common: 'Velvet Crawler',
    latin: 'Philodendron gloriosum André', origin: 'Colombia', rarity: 3,
    care: { light: 3, water: 3, humid: 4 },
    blurb: 'Huge velvet hearts with ivory veins and a fine pink rim, rising from a rhizome that crawls across the soil.',
    facts: [
      'It is a crawler, not a climber. The thick rhizome creeps along the forest floor, so it needs a long, shallow pot.',
      'Burying the rhizome causes rot, so it has to sit on the soil surface.',
      'Look closely and you will see a thin pink line tracing the leaf margin.'
    ],
    form: 'crawler', petiole: '#5f7b48',
    leaf: { shape: 'cordate', w: 1.05, L: 94, base: '#22452a', light: '#356640', dark: '#142d19', edge: '#d9a4ad',
      veins: { n: 6, color: '#ece5d2', w: 2.0, op: .9, mid: 3.4, glow: true },
      var: { type: 'margin', color: '#d79aa4', amount: .035 },
      tex: 'velvet', asym: .06 }
  },
  {
    id: 'p_melanochrysum', zone: 'velvet', genus: 'Philodendron', name: 'Philodendron melanochrysum', common: 'Black Gold',
    latin: 'Philodendron melanochrysum Linden & André', origin: 'Colombia & Ecuador', rarity: 3,
    care: { light: 3, water: 3, humid: 5 },
    blurb: 'Dark velvet leaves dusted with gold glitter, getting longer and more dramatic as they climb.',
    facts: [
      '"Melanochrysum" means black-gold, after the glittering specks on the dark velvet.',
      'On a tall support, leaves can lengthen from palm-sized to almost a metre.',
      'Each new leaf emerges a coppery-pink colour before turning dark.'
    ],
    form: 'climber', petiole: '#4e5c37',
    leaf: { shape: 'elongCordate', w: .62, L: 96, base: '#1e301f', light: '#2d4a2c', dark: '#111c12', edge: '#0d150d',
      veins: { n: 6, color: '#b8c896', w: 1.4, op: .85, mid: 2.6 },
      var: { type: 'glitter', color: '#e3c86c', amount: 1 },
      tex: 'velvet', asym: .04 }
  },
  {
    id: 'p_verrucosum', zone: 'velvet', genus: 'Philodendron', name: 'Philodendron verrucosum', common: 'Ecuador Philodendron',
    latin: 'Philodendron verrucosum L.Mathieu ex Schott', origin: 'Costa Rica to Peru', rarity: 4,
    care: { light: 3, water: 3, humid: 5 },
    blurb: 'Iridescent velvet hearts banded in lime and emerald, held on stems covered in red bristles.',
    facts: [
      '"Verrucosum" means warty, after the fringe of hair-like scales on the petioles.',
      'The undersides of the leaves are often flushed with burgundy.',
      'It is a cloud-forest plant that sulks in dry air.'
    ],
    form: 'rosette', petiole: '#6b3a3a', hairy: '#c04848', petLen: 120, spread: 50,
    leaf: { shape: 'cordate', w: .9, L: 94, base: '#244a2c', light: '#3e6f3b', dark: '#132c18', edge: '#102512',
      veins: { n: 6, color: '#b4dc84', w: 2.0, op: .8, mid: 3.0, glow: true },
      var: { type: 'veinband', color: '#86b55a', amount: .55 },
      tex: 'velvet', asym: .06 }
  },
  {
    id: 'r_tetrasperma', zone: 'velvet', genus: 'Rhaphidophora', name: 'Rhaphidophora tetrasperma', common: 'Mini Monstera',
    latin: 'Rhaphidophora tetrasperma Hook.f.', origin: 'Southern Thailand & Malaysia', rarity: 2,
    care: { light: 3, water: 3, humid: 3 },
    blurb: 'Compact, deeply split leaves on a vigorous climber. Looks like a Monstera, but is not one.',
    facts: [
      'Despite the nickname, it is not a Monstera at all, just a distant aroid cousin.',
      'Splits appear even on fairly young leaves, so it fenestrates far sooner than a deliciosa.',
      'It can climb over a metre in a single growing season.'
    ],
    form: 'climber', petiole: '#4c8a3c',
    leaf: { shape: 'ovate', w: .95, L: 72, base: '#2f7a30', light: '#4c9b44', dark: '#1d4f1e', edge: '#173f18',
      veins: { n: 7, color: '#7cbc62', w: 1.2, op: .5, mid: 2.4, k: .7 },
      fen: { splits: 1, splitDepth: 1.15, splitW: .035 },
      tex: 'gloss', asym: .12 }
  },
  {
    id: 'an_clarinervium', zone: 'velvet', genus: 'Anthurium', name: 'Anthurium clarinervium', common: 'Velvet Cardboard',
    latin: 'Anthurium clarinervium Matuda', origin: 'Chiapas, Mexico', rarity: 2,
    care: { light: 3, water: 2, humid: 4 },
    blurb: 'Thick, cardboard-stiff velvet hearts with veins so white they almost glow.',
    facts: [
      'In the wild it grows on limestone outcrops, rooting into pockets of leaf litter.',
      'The leaves are surprisingly thick and crisp. Tap one and it sounds like card.',
      'A fine collective vein runs parallel to the leaf edge. That is a classic Anthurium feature.'
    ],
    form: 'rosette', pendant: true, petiole: '#4a6a3e', petLen: 110, spread: 55,
    leaf: { shape: 'cordate', w: 1.15, L: 80, base: '#1b3524', light: '#2c5136', dark: '#0f2015', edge: '#0d1c12',
      veins: { n: 5, color: '#e3ecdc', w: 2.4, op: .95, mid: 3.4, glow: true, collective: true },
      tex: 'velvet', asym: .03 }
  },
  {
    id: 'an_warocqueanum', zone: 'velvet', genus: 'Anthurium', name: 'Anthurium warocqueanum', common: 'Queen Anthurium',
    latin: 'Anthurium warocqueanum T.Moore', origin: 'Colombia', rarity: 4,
    care: { light: 3, water: 3, humid: 5 },
    blurb: 'Long, narrow velvet ribbons with silvery veins. A mature leaf can hang over a metre long.',
    facts: [
      'It is known as "The Queen", and the bold-veined A. veitchii is "The King".',
      'Each new leaf is longer than the one before. Growers measure progress by leaf length.',
      'It is an epiphyte that hates soggy roots and grows best in chunky bark mixes.'
    ],
    form: 'rosette', pendant: true, petiole: '#556b40', petLen: 150, spread: 58,
    leaf: { shape: 'strap', w: 1.1, L: 150, base: '#173322', light: '#29513a', dark: '#0d1f14', edge: '#0b1a10',
      veins: { n: 9, color: '#a9c7a6', w: 1.3, op: .85, mid: 2.6, k: 1.6, collective: true },
      tex: 'velvet', asym: .03 }
  },
  {
    id: 'an_crystallinum', zone: 'velvet', genus: 'Anthurium', name: 'Anthurium crystallinum', common: 'Crystal Anthurium',
    latin: 'Anthurium crystallinum Linden & André', origin: 'Panama to Peru', rarity: 3,
    care: { light: 3, water: 3, humid: 4 },
    blurb: 'Elongated velvet hearts with crystalline silver veins. New leaves unfurl a coppery purple.',
    facts: [
      'The veins sparkle because of tiny light-reflecting cells, hence "crystallinum".',
      'New leaves emerge bronze or purple and darken to forest green over a few weeks.',
      'It is often confused with A. clarinervium, but its leaves are thinner and longer.'
    ],
    form: 'rosette', pendant: true, petiole: '#55603f', petLen: 115, spread: 50,
    leaf: { shape: 'elongCordate', w: .9, L: 100, base: '#1d3a27', light: '#2f5a3c', dark: '#10241a', edge: '#0e1f15',
      veins: { n: 6, color: '#d8e6dc', w: 1.9, op: .9, mid: 3.0, glow: true, collective: true },
      var: { type: 'glitter', color: '#e9f3f0', amount: .35 },
      tex: 'velvet', asym: .04 }
  },
  {
    id: 'p_micans', zone: 'velvet', genus: 'Philodendron', name: 'Philodendron micans', common: 'Velvet Leaf Philodendron',
    latin: 'Philodendron hederaceum var. hederaceum', origin: 'Mexico to Brazil', rarity: 1,
    care: { light: 2, water: 3, humid: 3 },
    blurb: 'Trailing hearts of bronze velvet that shimmer purple and copper as they move.',
    facts: [
      '"Micans" means glittering, after the iridescent sheen of the velvet.',
      'New leaves often emerge pinkish-orange before turning bronze-green.',
      'It is the velvet-leaved form of the common heartleaf philodendron.'
    ],
    form: 'trailing', petiole: '#7a5a3a', vine: '#6b5434',
    leaf: { shape: 'cordate', w: .85, L: 40, base: '#3a3a22', light: '#5c4b2e', dark: '#22220f', edge: '#1a190b',
      veins: { n: 4, color: '#6d5a39', w: 1.0, op: .5, mid: 1.6 },
      var: { type: 'sheen', color: '#a06a8a', amount: .5 },
      tex: 'velvet', asym: .05 }
  },
  {
    id: 'p_brasil', zone: 'velvet', genus: 'Philodendron', name: "Philodendron 'Brasil'", common: 'Brasil Philodendron',
    latin: "Philodendron hederaceum 'Brasil'", origin: 'Cultivated sport', rarity: 1,
    care: { light: 2, water: 3, humid: 2 },
    blurb: 'Dark green hearts with a bright lime flash down the middle, named for the Brazilian flag.',
    facts: [
      'The lime-and-green colouring echoes the flag of Brazil.',
      'It is one of the easiest trailing plants and roots in a glass of water within weeks.',
      'Each leaf has its own pattern, from a thin stripe to a broad yellow flame.'
    ],
    form: 'trailing', petiole: '#5a8a3a', vine: '#4f7a33',
    leaf: { shape: 'cordate', w: .78, L: 42, base: '#22592a', light: '#3a7c3a', dark: '#14391a', edge: '#103014',
      veins: { n: 4, color: '#9fcf6a', w: 1.0, op: .4, mid: 1.6 },
      var: { type: 'center', color: '#c8dd58', amount: .8, color2: '#9ccb4c' },
      tex: 'gloss', asym: .06 }
  },
  {
    id: 's_pictus', zone: 'velvet', genus: 'Scindapsus', name: "Scindapsus pictus 'Argyraeus'", common: 'Satin Pothos',
    latin: "Scindapsus pictus 'Argyraeus'", origin: 'Southeast Asia', rarity: 1,
    care: { light: 2, water: 2, humid: 2 },
    blurb: 'Matte, satin-textured hearts sprinkled with silver spots and edged in a fine silver line.',
    facts: [
      'The silver spots are tiny air pockets under the leaf surface that reflect light.',
      'The leaves curl slightly when thirsty, a handy watering signal.',
      'It is not a true pothos but a close cousin, Scindapsus.'
    ],
    form: 'trailing', petiole: '#3f6a4a', vine: '#3d5f45',
    leaf: { shape: 'ovate', w: .78, L: 44, base: '#2d573d', light: '#3f7150', dark: '#1a3826', edge: '#b9cfc2',
      veins: { n: 4, color: '#1d3d29', w: .9, op: .4, mid: 1.6 },
      var: { type: 'spots', color: '#c3d6cb', amount: .8 },
      tex: 'matte', asym: .28 }
  },

  /* ───────────────────────────── ALOCASIA GROVE ───────────────────────────── */
  {
    id: 'a_frydek', zone: 'grove', genus: 'Alocasia', name: "Alocasia 'Frydek'", common: 'Green Velvet Alocasia',
    latin: "Alocasia micholitziana 'Frydek'", origin: 'Philippines', rarity: 2,
    care: { light: 3, water: 3, humid: 4 },
    blurb: 'Arrowhead leaves of moss-green velvet, cut by thick, chalk-white veins.',
    facts: [
      'Alocasias have special pores called hydathodes that let them "weep" water from leaf tips in humid air.',
      'It may drop leaves and go dormant in winter, then re-sprout from its corm.',
      'The velvet comes from microscopic cone-shaped cells that scatter light.'
    ],
    form: 'rosette', petiole: '#5d7b49', petLen: 150, spread: 42, tilt: 12,
    leaf: { shape: 'sagittate', w: .82, L: 92, base: '#173a22', light: '#285a32', dark: '#0d2414', edge: '#0b1d10',
      veins: { n: 6, color: '#eaf3e4', w: 2.4, op: .95, mid: 4.6, glow: true, collective: true, k: .55 },
      tex: 'velvet', asym: .04 }
  },
  {
    id: 'a_polly', zone: 'grove', genus: 'Alocasia', name: "Alocasia 'Polly'", common: 'African Mask',
    latin: "Alocasia × amazonica 'Polly'", origin: 'Hybrid, Florida', rarity: 1,
    care: { light: 3, water: 3, humid: 3 },
    blurb: 'Glossy, almost black arrowheads with scalloped edges and bold ivory veins: a living tribal mask.',
    facts: [
      'Despite the name it has nothing to do with the Amazon or Africa. It was bred at a Florida nursery.',
      'The wavy, scalloped margin is traced with a thin pale line.',
      'It is a compact form of A. × amazonica, ideal for windowsills.'
    ],
    form: 'rosette', petiole: '#5a7d55', petLen: 120, spread: 46, tilt: 14,
    leaf: { shape: 'sagittate', w: .7, L: 86, base: '#123b2a', light: '#225a3c', dark: '#0a2418', edge: '#cfe8d6',
      veins: { n: 6, color: '#dcefe3', w: 2.2, op: .95, mid: 4.0, collective: true, k: .55 },
      var: { type: 'margin', color: '#cce6d3', amount: .035 },
      margin: { type: 'scallop', amp: .035, freq: 7 },
      tex: 'gloss', asym: .03 }
  },
  {
    id: 'a_zebrina', zone: 'grove', genus: 'Alocasia', name: 'Alocasia zebrina', common: 'Tiger Elephant Ear',
    latin: 'Alocasia zebrina Schott ex Van Houtte', origin: 'Philippines', rarity: 2,
    care: { light: 4, water: 3, humid: 4 },
    blurb: 'Simple glossy arrow leaves held aloft on spectacular zebra-striped stems.',
    facts: [
      'The striped petioles are the main attraction. No two plants have exactly the same banding.',
      'Leaves track the light, so rotate the pot to keep it symmetrical.',
      'It grows from an underground corm that stores energy for dormancy.'
    ],
    form: 'rosette', zebra: true, petiole: '#d9d4a4', petLen: 180, spread: 40, tilt: 10,
    leaf: { shape: 'sagittate', w: .66, L: 92, base: '#3a6e36', light: '#57944b', dark: '#244a22', edge: '#1b3a1a',
      veins: { n: 6, color: '#8fbf74', w: 1.4, op: .55, mid: 3.2, k: .55 },
      tex: 'gloss', asym: .04 }
  },
  {
    id: 'a_dragon_scale', zone: 'grove', genus: 'Alocasia', name: "Alocasia 'Dragon Scale'", common: 'Dragon Scale',
    latin: "Alocasia baginda 'Dragon Scale'", origin: 'Borneo', rarity: 3,
    care: { light: 3, water: 3, humid: 4 },
    blurb: 'Thick, embossed leaves in jade and silver, with dark sunken veins like the scales of a dragon.',
    facts: [
      'The leaf is so heavily textured that each panel between the veins bulges like a scale.',
      'In the wild it grows on limestone karst in Borneo.',
      'A mature leaf feels thick, almost leathery, to the touch.'
    ],
    form: 'rosette', petiole: '#6c8b6f', petLen: 100, spread: 46, tilt: 10,
    leaf: { shape: 'ovate', w: .85, L: 78, base: '#4e7a62', light: '#86ab92', dark: '#2a4d3a', edge: '#21402f',
      veins: { n: 6, color: '#1e3d2c', w: 2.4, op: .8, mid: 3.6, k: .5 },
      var: { type: 'silver', color: '#a9c5b1', amount: .6 },
      tex: 'quilt-gloss', asym: .04 }
  },
  {
    id: 'a_silver_dragon', zone: 'grove', genus: 'Alocasia', name: "Alocasia 'Silver Dragon'", common: 'Silver Dragon',
    latin: "Alocasia baginda 'Silver Dragon'", origin: 'Borneo', rarity: 3,
    care: { light: 3, water: 2, humid: 4 },
    blurb: 'Leaves of brushed silver over a ghostly green, traced with dark emerald veins.',
    facts: [
      'It is a silver form of the Dragon Scale with the same thick, quilted leaves.',
      'Its silver sheen comes from a reflective layer just below the leaf surface.',
      'It grows slowly and likes its roots tightly packed.'
    ],
    form: 'rosette', petiole: '#7a8f7e', petLen: 95, spread: 46, tilt: 10,
    leaf: { shape: 'ovate', w: .86, L: 74, base: '#6f8f7c', light: '#c2d3c6', dark: '#3d5b49', edge: '#2e4a3a',
      veins: { n: 6, color: '#25503a', w: 2.4, op: .85, mid: 3.6, k: .5 },
      var: { type: 'silver', color: '#d4e1d6', amount: .85 },
      tex: 'quilt-gloss', asym: .04 }
  },
  {
    id: 'a_black_velvet', zone: 'grove', genus: 'Alocasia', name: "Alocasia 'Black Velvet'", common: 'Little Queen',
    latin: 'Alocasia reginula', origin: 'Borneo', rarity: 2,
    care: { light: 2, water: 2, humid: 4 },
    blurb: 'Small, thick leaves of near-black velvet with silver veins, like a jewel on black cloth.',
    facts: [
      '"Reginula" means little queen.',
      'It stays compact, rarely growing more than 30 cm tall.',
      'The undersides are a dusty purple-pink.'
    ],
    form: 'rosette', petiole: '#5c5050', petLen: 70, spread: 48, tilt: 10,
    leaf: { shape: 'cordate', w: 1.0, L: 62, base: '#1a1f1b', light: '#2c3530', dark: '#0d100e', edge: '#0a0c0b',
      veins: { n: 5, color: '#c9d4cc', w: 1.8, op: .85, mid: 3.0, glow: true, collective: true },
      tex: 'velvet', asym: .03 }
  },
  {
    id: 'a_stingray', zone: 'grove', genus: 'Alocasia', name: "Alocasia 'Stingray'", common: 'Stingray Elephant Ear',
    latin: "Alocasia macrorrhizos 'Stingray'", origin: 'Cultivated form', rarity: 3,
    care: { light: 4, water: 3, humid: 3 },
    blurb: 'Rounded leaves with curled wings and a long whip of a tail, like a stingray gliding past.',
    facts: [
      'The tip of each leaf extends into a long, thin tail.',
      'The leaf blade curls upward at the sides like a stingray’s wings.',
      'It is a cultivar of the giant taro, which can tower over two metres.'
    ],
    form: 'rosette', petiole: '#6f9154', petLen: 170, spread: 40, tilt: 8,
    leaf: { shape: 'stingray', w: .95, L: 96, base: '#3e7a35', light: '#62a14d', dark: '#264d21', edge: '#1d3d19',
      veins: { n: 6, color: '#8ec26f', w: 1.4, op: .55, mid: 3.0, k: .45 },
      tex: 'gloss', asym: .05 }
  },
  {
    id: 'c_black_magic', zone: 'grove', genus: 'Colocasia', name: "Colocasia 'Black Magic'", common: 'Black Elephant Ear',
    latin: "Colocasia esculenta 'Black Magic'", origin: 'Cultivar of taro (SE Asia)', rarity: 2,
    care: { light: 4, water: 5, humid: 4 },
    blurb: 'Enormous dusky leaves of purple-black, with a matte, powdery bloom that beads water like mercury.',
    facts: [
      'Its leaves are superhydrophobic: water rolls off in shining beads, like the lotus effect.',
      'It is a selection of taro, one of humanity’s oldest cultivated crops.',
      'Unlike most Alocasias it loves wet feet and even grows in ponds.'
    ],
    form: 'rosette', petiole: '#3a2a35', petLen: 170, spread: 50, tilt: 30,
    leaf: { shape: 'sagittate', w: .85, L: 110, base: '#2a1d28', light: '#43303f', dark: '#160f15', edge: '#100a0f',
      veins: { n: 6, color: '#4c3a48', w: 1.6, op: .6, mid: 3.6, k: .5 },
      var: { type: 'dew', color: '#ffffff', amount: .5 },
      tex: 'matte', asym: .03 }
  },
  {
    id: 'f_lyrata', zone: 'grove', genus: 'Ficus', name: 'Ficus lyrata', common: 'Fiddle-Leaf Fig',
    latin: 'Ficus lyrata Warb.', origin: 'West & Central Africa', rarity: 1,
    care: { light: 4, water: 3, humid: 2 },
    blurb: 'Huge violin-shaped leaves, glossy and leathery, with pale lime veins and wavy edges.',
    facts: [
      'In the wild it often starts life as an epiphyte high in another tree, like a strangler fig.',
      'It famously drops leaves when moved, because it hates any change in light.',
      'Each new leaf unfurls from a pointed, papery stipule at the tip of the branch.'
    ],
    form: 'tree', petiole: '#6b7a3d', bark: '#8a7a64',
    leaf: { shape: 'fiddle', w: .95, L: 66, base: '#2a5d28', light: '#46883b', dark: '#173c18', edge: '#123012',
      veins: { n: 7, color: '#c6d48a', w: 1.6, op: .8, mid: 3.0, k: .9 },
      margin: { type: 'wavy', amp: .012, freq: 9 },
      tex: 'quilt-gloss', asym: .05 }
  },
  {
    id: 'f_tineke', zone: 'grove', genus: 'Ficus', name: "Ficus elastica 'Tineke'", common: 'Variegated Rubber Plant',
    latin: "Ficus elastica 'Tineke'", origin: 'Cultivar (species from NE India)', rarity: 2,
    care: { light: 4, water: 2, humid: 2 },
    blurb: 'Thick, rubbery ovals marbled in green, sage and cream, with a blushing pink midrib.',
    facts: [
      'Its milky latex sap was once a source of natural rubber.',
      'New leaves emerge from a rosy-pink sheath that later falls away.',
      'Brighter light brings out more cream and pink in the variegation.'
    ],
    form: 'tree', petiole: '#c78a8a', bark: '#7c7466', stipule: '#e7a0a6',
    leaf: { shape: 'elliptic', w: .7, L: 64, base: '#3a6b3c', light: '#86a77e', dark: '#244a28', edge: '#1d3b20',
      veins: { n: 10, color: '#a7c094', w: .7, op: .4, mid: 2.6, k: 1.8, midColor: '#d98a92' },
      var: { type: 'margin', color: '#efe7c8', amount: .085, color2: '#a9c39b' },
      tex: 'waxy', asym: .03 }
  },
  {
    id: 'f_audrey', zone: 'grove', genus: 'Ficus', name: "Ficus 'Audrey'", common: 'Banyan Fig',
    latin: "Ficus benghalensis 'Audrey'", origin: 'Indian subcontinent', rarity: 2,
    care: { light: 4, water: 3, humid: 2 },
    blurb: 'Soft, velvety ovals with creamy-green veins on a pale trunk: a gentler cousin of the fiddle-leaf.',
    facts: [
      'In the wild, banyan figs drop aerial roots that become new trunks, so one tree can look like a forest.',
      'Ficus benghalensis is the national tree of India.',
      'Its leaves have a faint downy fuzz that the fiddle-leaf lacks.'
    ],
    form: 'tree', petiole: '#8a9a5a', bark: '#c4b9a2',
    leaf: { shape: 'ovate', w: .8, L: 60, base: '#3b6e34', light: '#5b8e4a', dark: '#24481f', edge: '#1d3c19',
      veins: { n: 7, color: '#e2e6b6', w: 1.5, op: .85, mid: 2.8, k: .8 },
      tex: 'velvet', asym: .05 }
  },

  /* ───────────────────────────── PRAYER PLANT SHADE HOUSE ───────────────────────────── */
  {
    id: 'c_orbifolia', zone: 'shade', genus: 'Goeppertia', name: 'Calathea orbifolia', common: 'Round-Leaf Calathea',
    latin: 'Goeppertia orbifolia (Linden) Borchs. & S.Suárez', origin: 'Bolivia', rarity: 2,
    care: { light: 2, water: 4, humid: 5 },
    blurb: 'Huge round leaves banded in silver and sage, like brushed metal.',
    facts: [
      'Calatheas fold their leaves up at night, a movement called nyctinasty, using a hinge-like joint called a pulvinus.',
      'It is sensitive to the minerals in tap water. Crispy brown edges are the tell-tale sign.',
      'Botanists moved most Calatheas into the genus Goeppertia in 2012.'
    ],
    form: 'upright', petiole: '#7c9a6c', petLen: 120, spread: 34,
    leaf: { shape: 'orbicular', w: 1.0, L: 82, base: '#4a7a4c', light: '#6c9a68', dark: '#2f5531', edge: '#28472a', under: '#b9c9b1',
      veins: { n: 11, color: '#3f6d42', w: .8, op: .4, mid: 2.6, k: 1.3 },
      var: { type: 'stripes', color: '#d0dcc8', amount: .75 },
      tex: 'gloss', asym: .04 }
  },
  {
    id: 'c_medallion', zone: 'shade', genus: 'Goeppertia', name: "Calathea 'Medallion'", common: 'Rose-painted Calathea',
    latin: "Goeppertia roseopicta 'Medallion'", origin: 'Northwest Brazil', rarity: 2,
    care: { light: 2, water: 4, humid: 5 },
    blurb: 'Dark green rounds painted with a feathered medallion of silver-rose. Turn one over and the back is burgundy.',
    facts: [
      '"Roseopicta" means rose-painted.',
      'The deep purple underside helps catch the dim light that reaches the rainforest floor.',
      'You can hear the leaves rustle as they rise for the evening.'
    ],
    form: 'upright', petiole: '#5d2440', petLen: 110, spread: 38,
    leaf: { shape: 'orbicular', w: .92, L: 76, base: '#1d3f27', light: '#2c5a37', dark: '#102519', edge: '#0d1f14', under: '#6d1f42',
      veins: { n: 9, color: '#c9b9c2', w: .7, op: .4, mid: 2.6, k: 1.1, midColor: '#d6c4cb' },
      var: { type: 'feather', color: '#bcc9c0', amount: .9, color2: '#d7b6c4' },
      tex: 'gloss', asym: .04 }
  },
  {
    id: 'c_white_fusion', zone: 'shade', genus: 'Goeppertia', name: "Calathea 'White Fusion'", common: 'White Fusion',
    latin: "Goeppertia lietzei 'White Fusion'", origin: 'Cultivated sport', rarity: 3,
    care: { light: 3, water: 4, humid: 5 },
    blurb: 'Brushstrokes of white and pale lilac swept across green, with violet undersides.',
    facts: [
      'Each leaf has a unique pattern of white streaks, like watercolour on silk.',
      'The undersides are a soft lavender-purple.',
      'It needs more light than most Calatheas to hold its variegation.'
    ],
    form: 'upright', petiole: '#8a7a8c', petLen: 115, spread: 36,
    leaf: { shape: 'elliptic', w: .78, L: 80, base: '#4d7c48', light: '#72a066', dark: '#305330', edge: '#284628', under: '#8a5a8a',
      veins: { n: 10, color: '#d9d6e2', w: .7, op: .45, mid: 2.2, k: 1.3 },
      var: { type: 'marble', color: '#f3eff4', amount: 1.1, color2: '#dcc8e6' },
      tex: 'gloss', asym: .05 }
  },
  {
    id: 'c_makoyana', zone: 'shade', genus: 'Goeppertia', name: 'Calathea makoyana', common: 'Peacock Plant',
    latin: 'Goeppertia makoyana (E.Morren) Borchs. & S.Suárez', origin: 'Eastern Brazil', rarity: 2,
    care: { light: 2, water: 4, humid: 5 },
    blurb: 'Translucent pale-green leaves inked with dark ovals like a peacock’s tail feathers.',
    facts: [
      'Each dark mark is repeated in pinkish-purple on the underside, like a mirror image.',
      'The leaves are thin enough to glow when backlit.',
      'It is also called "cathedral windows" because of how light passes through the leaves.'
    ],
    form: 'upright', petiole: '#7a5068', petLen: 120, spread: 36,
    leaf: { shape: 'elliptic', w: .7, L: 78, base: '#a8c99a', light: '#c7dfb9', dark: '#7aa36c', edge: '#4a7a42', under: '#b8829e',
      veins: { n: 10, color: '#5e8a52', w: .7, op: .45, mid: 2.0, k: 1.2 },
      var: { type: 'peacock', color: '#2f5a2a', amount: 1 },
      tex: 'gloss', asym: .04 }
  },
  {
    id: 'c_lancifolia', zone: 'shade', genus: 'Goeppertia', name: 'Calathea lancifolia', common: 'Rattlesnake Plant',
    latin: 'Goeppertia insignis (W.Bull ex W.Petersen) Borchs. & S.Suárez', origin: 'Brazil', rarity: 1,
    care: { light: 2, water: 3, humid: 4 },
    blurb: 'Long, wavy-edged blades with alternating dark ovals along the midrib, and purple undersides.',
    facts: [
      'The rippling margin and spotted pattern recall a rattlesnake’s skin.',
      'It is one of the hardiest Calatheas for normal home humidity.',
      'Leaves stand upright at dusk like hands in prayer.'
    ],
    form: 'upright', petiole: '#6b7a4a', petLen: 90, spread: 30,
    leaf: { shape: 'lanceolate', w: .9, L: 96, base: '#8fb862', light: '#a9cc79', dark: '#5f8a3e', edge: '#4f7a33', under: '#6a2a52',
      veins: { n: 12, color: '#6f9a4c', w: .6, op: .4, mid: 1.8, k: 1.7 },
      var: { type: 'rattle', color: '#2d4f22', amount: 1 },
      margin: { type: 'wavy', amp: .02, freq: 14 },
      tex: 'gloss', asym: .02 }
  },
  {
    id: 'c_musaica', zone: 'shade', genus: 'Goeppertia', name: "Calathea 'Network'", common: 'Mosaic Calathea',
    latin: "Goeppertia kegeljanii 'Network'", origin: 'Brazil', rarity: 3,
    care: { light: 2, water: 4, humid: 4 },
    blurb: 'Pale green leaves covered in an intricate lattice of tiny lime tiles, like a mosaic floor.',
    facts: [
      'The fine grid pattern is made by tiny veins crossing each other at right angles.',
      'It is one of the tougher Calatheas, tolerating lower humidity.',
      'In the trade it is often still labelled Calathea musaica.'
    ],
    form: 'upright', petiole: '#8aa56a', petLen: 110, spread: 36,
    leaf: { shape: 'elliptic', w: .75, L: 76, base: '#7ea85a', light: '#a6c97d', dark: '#527a37', edge: '#466a2e', under: '#a7bf8d',
      veins: { n: 12, color: '#456b2f', w: .6, op: .5, mid: 2.0, k: 1.2 },
      var: { type: 'mosaic', color: '#c9e39f', amount: 1 },
      tex: 'gloss', asym: .04 }
  },
  {
    id: 'm_leuconeura', zone: 'shade', genus: 'Maranta', name: "Maranta 'Red Prayer Plant'", common: 'Herringbone Plant',
    latin: 'Maranta leuconeura var. erythroneura', origin: 'Brazil', rarity: 1,
    care: { light: 2, water: 4, humid: 4 },
    blurb: 'Velvety olive leaves etched with scarlet herringbone veins, a lime feather along the midrib and dark brush marks.',
    facts: [
      'Its leaves lie flat by day and fold upright at night, which is where the name prayer plant comes from.',
      'The joint that makes the movement, the pulvinus, swells and shrinks with water pressure.',
      '"Erythroneura" means red-veined.'
    ],
    form: 'upright', petiole: '#6b7a4a', petLen: 70, spread: 60,
    leaf: { shape: 'elliptic', w: .68, L: 62, base: '#3e5c2c', light: '#5f7f3e', dark: '#24391a', edge: '#1d3015', under: '#7a3448',
      veins: { n: 9, color: '#d8324a', w: 1.3, op: .95, mid: 2.6, k: 1.1, midColor: '#e2384e' },
      var: { type: 'herringbone', color: '#a8c66a', amount: 1, color2: '#1a2b12' },
      tex: 'velvet', asym: .06 }
  },
  {
    id: 'ct_fishbone', zone: 'shade', genus: 'Ctenanthe', name: "Ctenanthe 'Fishbone'", common: 'Fishbone Prayer Plant',
    latin: 'Ctenanthe burle-marxii', origin: 'Eastern Brazil', rarity: 2,
    care: { light: 2, water: 3, humid: 4 },
    blurb: 'Pale silvery-green ovals with dark green bars along the veins, like a fish skeleton.',
    facts: [
      'Named after Roberto Burle Marx, the landscape architect who made tropical plants famous in modernist gardens.',
      'Its bold herringbone gives it the nickname fishbone.',
      'The undersides are a soft plum-purple.'
    ],
    form: 'upright', petiole: '#7c8a5a', petLen: 80, spread: 44,
    leaf: { shape: 'elliptic', w: .62, L: 66, base: '#c0d3b2', light: '#d8e6cb', dark: '#9fb790', edge: '#6e8a5e', under: '#7a4a6a',
      veins: { n: 9, color: '#9fb58e', w: .6, op: .4, mid: 1.6, k: 1.0 },
      var: { type: 'fishbone', color: '#2f5a32', amount: 1 },
      tex: 'gloss', asym: .04 }
  },
  {
    id: 'st_triostar', zone: 'shade', genus: 'Stromanthe', name: "Stromanthe 'Triostar'", common: 'Tricolour Stromanthe',
    latin: "Stromanthe sanguinea 'Triostar'", origin: 'Cultivar (species from Brazil)', rarity: 2,
    care: { light: 3, water: 3, humid: 4 },
    blurb: 'Lance leaves streaked with cream, blush pink and green over magenta-red undersides.',
    facts: [
      '"Sanguinea" means blood-red, after the vivid undersides.',
      'When the leaves rise at night, the magenta undersides light up the whole plant.',
      'The pink tones deepen in brighter light.'
    ],
    form: 'upright', petiole: '#b24a6a', petLen: 110, spread: 40,
    leaf: { shape: 'lanceolate', w: .9, L: 90, base: '#2d5a2c', light: '#467a3e', dark: '#1a3a1a', edge: '#163016', under: '#c0285a',
      veins: { n: 12, color: '#8ab07a', w: .5, op: .35, mid: 1.6, k: 1.8 },
      var: { type: 'marble', color: '#f3ead6', amount: 1.2, color2: '#f1b3c3' },
      tex: 'gloss', asym: .05 }
  },
  {
    id: 'pi_peperomioides', zone: 'shade', genus: 'Pilea', name: 'Pilea peperomioides', common: 'Chinese Money Plant',
    latin: 'Pilea peperomioides Diels', origin: 'Yunnan & Sichuan, China', rarity: 1,
    care: { light: 3, water: 2, humid: 2 },
    blurb: 'Perfectly round, coin-like leaves on long thin stalks. The petiole joins the middle of the leaf, like a parasol.',
    facts: [
      'The leaf is peltate: the stalk attaches near the centre, not at the edge.',
      'It spread across Europe as a pass-along plant after a Norwegian missionary brought cuttings home from China in 1946.',
      'It produces endless "pups" around the base, perfect for gifting.'
    ],
    form: 'pilea', petiole: '#6b9a4a',
    leaf: { shape: 'orbicular', w: 1.0, L: 34, base: '#3f8a3a', light: '#6db455', dark: '#26591f', edge: '#1f4b1a',
      veins: { n: 5, color: '#8ac46e', w: .8, op: .4, mid: 1.2 },
      tex: 'gloss', asym: 0 }
  },
  {
    id: 'pe_argyreia', zone: 'shade', genus: 'Peperomia', name: 'Peperomia argyreia', common: 'Watermelon Peperomia',
    latin: 'Peperomia argyreia (Miq.) E.Morren', origin: 'Northern South America', rarity: 1,
    care: { light: 3, water: 2, humid: 3 },
    blurb: 'Plump, peltate leaves striped in silver and green exactly like a watermelon rind, on red stems.',
    facts: [
      'Like the Pilea, its leaf stalk joins the middle of the leaf blade.',
      'The thick leaves store water, so it is happy to dry out between drinks.',
      'A single leaf with a bit of stalk can grow a whole new plant.'
    ],
    form: 'upright', petiole: '#8a3a3a', petLen: 60, spread: 55,
    leaf: { shape: 'ovate', w: .9, L: 44, base: '#2e5a33', light: '#3e7243', dark: '#1c3a20', edge: '#163019',
      veins: { n: 5, color: '#24482a', w: 1.0, op: .5, mid: 1.4, k: 1.6 },
      var: { type: 'arcs', color: '#c9d9c4', amount: 1 },
      tex: 'waxy', asym: 0 }
  },
  {
    id: 'fi_albivenis', zone: 'shade', genus: 'Fittonia', name: 'Fittonia albivenis', common: 'Nerve Plant',
    latin: 'Fittonia albivenis (Lindl. ex Veitch) Brummitt', origin: 'Peru & Colombia', rarity: 1,
    care: { light: 2, water: 5, humid: 5 },
    blurb: 'A tight mound of small leaves netted with brilliant pink-white veins.',
    facts: [
      'Famous for "fainting" dramatically when dry, then perking up within an hour of watering.',
      'It is a favourite for terrariums, where the humidity keeps it lush.',
      'Its vein colour ranges from white to hot pink to red, depending on the cultivar.'
    ],
    form: 'upright', petiole: '#6b8a5a', petLen: 34, spread: 70, dense: true,
    leaf: { shape: 'ovate', w: .78, L: 34, base: '#2a5a30', light: '#3c7a40', dark: '#173a1c', edge: '#13301a',
      veins: { n: 5, color: '#f2a7c0', w: 1.4, op: .95, mid: 2.0, net: true },
      tex: 'matte', asym: .04 }
  },

  /* ───────────────────────────── HANGING GALLERY ───────────────────────────── */
  {
    id: 'e_marble_queen', zone: 'gallery', genus: 'Epipremnum', name: "Pothos 'Marble Queen'", common: 'Marble Queen',
    latin: "Epipremnum aureum 'Marble Queen'", origin: 'Cultivar (species from Mo‘orea)', rarity: 1,
    care: { light: 2, water: 2, humid: 2 },
    blurb: 'Heart leaves so heavily streaked with cream and white that green becomes the accent.',
    facts: [
      'Pothos almost never flowers. It lacks a working gene for gibberellin, the hormone that triggers blooming.',
      'The wild species comes from the single island of Mo‘orea in French Polynesia.',
      'It is called devil’s ivy because it is so hard to kill and stays green even in near-darkness.'
    ],
    form: 'trailing', petiole: '#7a9a5a', vine: '#8aa86a',
    leaf: { shape: 'cordate', w: .75, L: 46, base: '#3d7a3a', light: '#5c9a4f', dark: '#245124', edge: '#1d431d',
      veins: { n: 4, color: '#e8e6cf', w: .9, op: .5, mid: 1.6 },
      var: { type: 'marble', color: '#f1eedb', amount: 1.3 },
      tex: 'gloss', asym: .12 }
  },
  {
    id: 'e_neon', zone: 'gallery', genus: 'Epipremnum', name: "Pothos 'Neon'", common: 'Neon Pothos',
    latin: "Epipremnum aureum 'Neon'", origin: 'Cultivar', rarity: 1,
    care: { light: 3, water: 2, humid: 2 },
    blurb: 'Electric chartreuse hearts that seem to glow even in the shade.',
    facts: [
      'The colour is a uniform golden-lime with no variegation at all.',
      'New leaves are the brightest, almost highlighter-yellow.',
      'In deep shade the colour dulls towards green.'
    ],
    form: 'trailing', petiole: '#a8c94a', vine: '#9cbf44',
    leaf: { shape: 'cordate', w: .76, L: 46, base: '#9fd04a', light: '#c8ea6a', dark: '#78a834', edge: '#6a962c',
      veins: { n: 4, color: '#c7e86e', w: .9, op: .5, mid: 1.6 },
      tex: 'gloss', asym: .12 }
  },
  {
    id: 'e_manjula', zone: 'gallery', genus: 'Epipremnum', name: "Pothos 'Manjula'", common: 'Manjula Pothos',
    latin: "Epipremnum aureum 'Manjula'", origin: 'Patented cultivar', rarity: 2,
    care: { light: 3, water: 2, humid: 2 },
    blurb: 'Wide, wavy hearts splashed in cream, silver-green and white in broad painterly patches.',
    facts: [
      'Manjula leaves are broader and wavier than other pothos, and rarely lie flat.',
      'It is a patented cultivar, so it is mostly propagated under licence.',
      'Each leaf can show creamy margins, silver flecks and deep green patches all at once.'
    ],
    form: 'trailing', petiole: '#a2b48a', vine: '#9fb58a',
    leaf: { shape: 'cordate', w: .9, L: 46, base: '#3e7a42', light: '#7ba876', dark: '#25512a', edge: '#1d431f',
      veins: { n: 4, color: '#e9ecd8', w: .9, op: .5, mid: 1.8 },
      var: { type: 'sectoral', color: '#eeeedb', amount: .7, color2: '#b9cfb6' },
      margin: { type: 'wavy', amp: .025, freq: 5 },
      tex: 'gloss', asym: .1 }
  },
  {
    id: 'h_krimson', zone: 'gallery', genus: 'Hoya', name: "Hoya 'Krimson Queen'", common: 'Tricolour Wax Plant',
    latin: "Hoya carnosa 'Tricolor'", origin: 'Cultivar (species from E. Asia & Australia)', rarity: 2,
    care: { light: 4, water: 2, humid: 2 },
    blurb: 'Waxy leaves edged in cream and flushed pink, with balls of porcelain star flowers.',
    facts: [
      'Hoya flowers look like they are carved from wax and smell sweetest at night.',
      'Never cut off old flower spurs (peduncles). They flower again from the same spot.',
      'The flowers drip sticky nectar, so hang them away from the sofa.'
    ],
    form: 'hoya', petiole: '#8a6a5a', vine: '#7a5a4a', flower: '#f6e3e8', corona: '#b4223a',
    leaf: { shape: 'elliptic', w: .52, L: 38, base: '#2f5e35', light: '#4a7d47', dark: '#1b3d20', edge: '#163319',
      veins: { n: 3, color: '#3f6d40', w: .5, op: .25, mid: 1.2 },
      var: { type: 'margin', color: '#f2e7d4', amount: .11, color2: '#eaa2b3' },
      tex: 'waxy', asym: .02 }
  },
  {
    id: 'h_kerrii', zone: 'gallery', genus: 'Hoya', name: 'Hoya kerrii', common: 'Sweetheart Plant',
    latin: 'Hoya kerrii Craib', origin: 'Thailand to Laos', rarity: 1,
    care: { light: 4, water: 1, humid: 2 },
    blurb: 'Thick, succulent leaves shaped exactly like Valentine’s hearts.',
    facts: [
      'Single-leaf cuttings sold on Valentine’s Day often never grow. Without a node they are "zombie leaves".',
      'The leaves are succulent and store water, so it prefers to dry out fully.',
      'Mature vines produce clusters of fuzzy cream flowers with red centres.'
    ],
    form: 'hoya', petiole: '#6a8a4a', vine: '#5f7d42', flower: '#efe6d2', corona: '#9a2a2a',
    leaf: { shape: 'obcordate', w: 1.0, L: 34, base: '#2f6b2f', light: '#4e8e43', dark: '#1d481e', edge: '#173b18',
      veins: { n: 2, color: '#3a7a3a', w: .5, op: .2, mid: 1.4 },
      tex: 'waxy', asym: 0 }
  },
  {
    id: 'h_pubicalyx', zone: 'gallery', genus: 'Hoya', name: "Hoya pubicalyx 'Splash'", common: 'Splash Hoya',
    latin: 'Hoya pubicalyx Merr.', origin: 'Philippines', rarity: 2,
    care: { light: 4, water: 2, humid: 2 },
    blurb: 'Long, dark leaves freckled with silver splash, and deep plum star flowers.',
    facts: [
      'The silver splash is caused by air pockets under the leaf surface.',
      'Flowers range from pink to almost black-purple, depending on the clone.',
      'It is one of the fastest-growing and most generous-flowering Hoyas.'
    ],
    form: 'hoya', petiole: '#6a5a4a', vine: '#5e4d3f', flower: '#7a2a52', corona: '#e8b8cc',
    leaf: { shape: 'elliptic', w: .42, L: 46, base: '#25472c', light: '#35603a', dark: '#152b19', edge: '#122414',
      veins: { n: 3, color: '#2e5233', w: .5, op: .25, mid: 1.3 },
      var: { type: 'spots', color: '#c9d4cb', amount: 1 },
      tex: 'waxy', asym: .02 }
  },
  {
    id: 'cu_pearls', zone: 'gallery', genus: 'Curio', name: 'String of Pearls', common: 'String of Beads',
    latin: 'Curio rowleyanus (H.Jacobsen) P.V.Heath', origin: 'South Africa', rarity: 1,
    care: { light: 4, water: 1, humid: 1 },
    blurb: 'Cascades of pea-sized green spheres. Each "pearl" is a leaf with a tiny translucent window.',
    facts: [
      'The spherical leaves have the smallest possible surface area for their volume, which cuts water loss.',
      'A thin, clear "window" stripe on each pearl lets light into the leaf’s interior.',
      'It produces small white pom-pom flowers that smell of cinnamon.'
    ],
    form: 'pearls', petiole: '#6a8a4a', vine: '#6f8a52',
    leaf: { shape: 'ovate', w: .8, L: 10, base: '#5a9a4a', light: '#9ccf7a', dark: '#3a6f30', edge: '#2e5a26',
      veins: { n: 0, color: '#000', w: 0, op: 0, mid: 0 }, tex: 'gloss' }
  },
  {
    id: 'ce_hearts', zone: 'gallery', genus: 'Ceropegia', name: 'String of Hearts', common: 'Rosary Vine',
    latin: 'Ceropegia woodii Schltr.', origin: 'Southern Africa', rarity: 1,
    care: { light: 4, water: 1, humid: 1 },
    blurb: 'Wiry purple threads strung with tiny silver-marbled hearts that are plum underneath.',
    facts: [
      'It forms small round tubers along the vines that can root into a new plant.',
      'Its flowers are tiny lanterns that trap flies to pollinate them.',
      'The silver marbling is strongest in bright light.'
    ],
    form: 'hearts', petiole: '#7a4a6a', vine: '#6e3b5f',
    leaf: { shape: 'cordate', w: .95, L: 14, base: '#3d5a48', light: '#5b7a64', dark: '#243829', edge: '#5a2a4a', under: '#7a3a62',
      veins: { n: 2, color: '#2f4a38', w: .5, op: .3, mid: .8 },
      var: { type: 'marble', color: '#b9cdbf', amount: .9 },
      tex: 'gloss', asym: 0 }
  },
  {
    id: 'pe_turtles', zone: 'gallery', genus: 'Peperomia', name: 'String of Turtles', common: 'Turtle Vine',
    latin: 'Peperomia prostrata B.S.Williams', origin: 'South American rainforests', rarity: 2,
    care: { light: 3, water: 2, humid: 3 },
    blurb: 'Button-sized round leaves patterned like little turtle shells, on fine trailing stems.',
    facts: [
      'The pale vein network on each tiny leaf looks remarkably like a tortoise shell.',
      'Its leaves are succulent, so it hates staying wet.',
      'Despite the shell pattern, each leaf is smaller than a fingernail.'
    ],
    form: 'trailing', petiole: '#7a6a5a', vine: '#8a6a5a', small: true,
    leaf: { shape: 'orbicular', w: .95, L: 14, base: '#3a5a3a', light: '#4e7a4a', dark: '#223a22', edge: '#1d321d',
      veins: { n: 3, color: '#b9d4a8', w: .9, op: .9, mid: 1.0, net: true },
      tex: 'waxy', asym: 0 }
  },
  {
    id: 'd_laurentii', zone: 'gallery', genus: 'Dracaena', name: "Snake Plant 'Laurentii'", common: 'Mother-in-Law’s Tongue',
    latin: "Dracaena trifasciata 'Laurentii'", origin: 'Cultivar (species from W. Africa)', rarity: 1,
    care: { light: 2, water: 1, humid: 1 },
    blurb: 'Stiff, sword-like leaves banded in grey-green zigzags and edged with butter-yellow.',
    facts: [
      'It uses CAM photosynthesis, opening its pores at night to save water.',
      'Leaf cuttings of Laurentii lose the yellow edge. It only survives by division.',
      'Formerly Sansevieria, it was moved into Dracaena in 2017.'
    ],
    form: 'sword', bandColor: '#9fb894', edgeColor: '#e3cf5a',
    leaf: { base: '#2d5a34', light: '#3d7244', dark: '#1a3a20' }
  },
  {
    id: 'd_moonshine', zone: 'gallery', genus: 'Dracaena', name: "Snake Plant 'Moonshine'", common: 'Silver Snake Plant',
    latin: "Dracaena trifasciata 'Moonshine'", origin: 'Cultivar', rarity: 2,
    care: { light: 2, water: 1, humid: 1 },
    blurb: 'Broad, moonlit blades of pale silver-mint with the faintest ghost of banding and a dark rim.',
    facts: [
      'New leaves emerge almost white-silver and darken slowly as they age.',
      'Its broad, short leaves give it a softer look than other snake plants.',
      'Nearly indestructible, it tolerates low light, drought and neglect.'
    ],
    form: 'sword', broad: true, bandColor: '#d6e3d6', edgeColor: '#2d4a33',
    leaf: { base: '#b4c9b8', light: '#d2e0d4', dark: '#8aa392' }
  },
  {
    id: 'z_zamiifolia', zone: 'gallery', genus: 'Zamioculcas', name: 'ZZ Plant', common: 'Zanzibar Gem',
    latin: 'Zamioculcas zamiifolia (Lodd.) Engl.', origin: 'Eastern Africa', rarity: 1,
    care: { light: 2, water: 1, humid: 1 },
    blurb: 'Arching stems lined with glossy, leathery leaflets that shine as if polished.',
    facts: [
      'Each "stem" is actually one compound leaf, and the "leaves" along it are leaflets.',
      'Fat, potato-like rhizomes under the soil store water for months of drought.',
      'A single fallen leaflet can grow a whole new rhizome and plant.'
    ],
    form: 'zz', petiole: '#3f6a34',
    leaf: { shape: 'elliptic', w: .55, L: 30, base: '#1f5226', light: '#357a38', dark: '#103416', edge: '#0d2b12',
      veins: { n: 4, color: '#2d6a33', w: .5, op: .3, mid: 1.0 },
      tex: 'waxy', asym: .05 }
  }
];

const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
