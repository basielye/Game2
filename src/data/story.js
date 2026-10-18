// The story of Ava Reyes. Names live here so the IP can be re-skinned in one place.
export const TITLE = 'JURASSIC FRONTIER';
export const SUBTITLE = 'The Last Ranger of Isla Nublar';
export const PARK = 'Jurassic Park';

export const INTRO = [
  { t: 'Isla Nublar. 120 miles west of Costa Rica.', d: 4.5 },
  { t: 'For three summers the park worked. Families came. The animals thrived. We kept them fed, and they kept the lights on.', d: 6.5 },
  { t: 'Then the mainland went quiet.', d: 4 },
  { t: 'A virus. The dead got back up. The last broadcast out of San José was a man reading names until his voice gave out.', d: 7 },
  { t: 'No more supply boats. No more helicopters. No one coming.', d: 5 },
  { t: 'Sixty-two of us were left on the island. And the fences started to fail.', d: 5.5 },
  { t: "Three years later, it's every man for himself out here. Gangs. Bounties. Dinosaurs walking the roads like they own them.", d: 7 },
  { t: 'Maybe they do.', d: 3.5 },
  { t: 'My name is Ava Reyes. I was a ranger.', d: 4.5 },
  { t: "Now I'm just trying to stay alive.", d: 5 },
];

export const NPCS = {
  marshal: { name: 'Marshal Rourke', preset: 'marshal', building: 'marshal' },
  store: { name: 'Ma Delgado', preset: 'settlerF', building: 'store', colors: { top: 0x7a3a5a } },
  gunsmith: { name: 'Old Tobias', preset: 'settlerM', building: 'gunsmith', colors: { top: 0x3a3a3a, hat: 0x5a3a1a } },
  doctor: { name: 'Dr. Lena Okafor', preset: 'doctor', building: 'doctor' },
  barkeep: { name: 'Pike the Barkeep', preset: 'settlerM', building: 'saloon', colors: { top: 0xd8d0c0 } },
};

export const IDLE_LINES = {
  marshal: ['Keep your iron holstered inside the walls, Reyes.', 'Black Fang gets bolder every week.', 'Coffee? It\'s mostly chicory now. Still hot.'],
  store: ['Hides fetch good money. Bring me what you skin.', 'Bandages don\'t grow on trees, dear. Well, the fiber does.', 'Stay away from the paddock after dark.'],
  gunsmith: ['A rifle cleans up a lot of problems, if you can afford one.', 'Raptor claws make fine trade. Don\'t ask what for.', 'Knew Muldoon\'s old crew. Tough as rawhide, all of them.'],
  doctor: ['If a dilophosaur spits at you — close your eyes and run.', 'I still keep the incubator readings. Habit.', 'Come back alive. I\'m running out of stitches.'],
  barkeep: ['Room\'s five dollars. The roof only leaks a little.', 'Heard the big girl roaring out by the old Tyrannosaur paddock.', 'Drink? It\'s banana moonshine. Builds character.'],
  settler: ['Morning, ranger.', 'Saw a herd of gallimimus by the south road.', 'They say Crane keeps raptors in cages.', 'I miss ice cream.', 'You hear the brachiosaurs at dawn? Like whales singing.', 'Lock your door tonight.'],
};

// Main story quests. Step types: collect, craft, goto, talk, interact, killTag, killId, tame, mount, loot, wait
export const QUESTS = [
  {
    id: 'm1', title: 'Wake Up, Ranger', giver: null,
    desc: 'Three years alone in Ranger Bunker 4. Supplies are gone. Time to go back out there.',
    steps: [
      { text: 'Gather 3 Wood and 3 Plant Fiber', type: 'collect', items: { wood: 3, fiber: 3 }, hint: 'Look for fallen branches and leafy plants near the bunker. Press E to gather.' },
      { text: 'Craft a Hunting Bow', type: 'craft', id: 'bow', hint: 'Open the satchel with TAB and craft the bow.' },
      { text: 'Craft Arrows', type: 'craft', id: 'arrows', hint: 'Arrows need Wood and Flint. Flint lies on rocky ground.' },
      { text: 'Hunt an animal and harvest it', type: 'loot', hint: 'Hold RIGHT MOUSE to aim, LEFT MOUSE to draw and release. Crouch (C) to sneak up on prey.' },
      { text: 'Follow the road north to Haven', type: 'goto', loc: 'haven', r: 55, hint: 'The old park road leads through the Great Gate.' },
    ],
    reward: { money: 10 },
  },
  {
    id: 'm2', title: 'Haven', giver: 'marshal',
    desc: 'The Visitor Center is a town now. Rourke runs what passes for law.',
    steps: [
      { text: 'Talk to Marshal Rourke', type: 'talk', npc: 'marshal', dialog: 'marshal_intro' },
      { text: 'Visit the General Store', type: 'interact', action: 'shop', id: 'store', hint: 'Sell hides, buy bandages and ammunition.' },
    ],
    reward: { money: 20, items: { pistolAmmo: 12 } },
  },
  {
    id: 'm3', title: 'The Black Fang', giver: 'marshal',
    desc: 'Crane\'s men took the plant fuse and holed up in the old Raptor Pen.',
    steps: [
      { text: 'Travel to the Raptor Pen', type: 'goto', loc: 'raptorpen', r: 110 },
      { text: 'Clear the Black Fang outpost', type: 'killTag', tag: 'camp:raptorpen', hint: 'Crouch to stay hidden. Silent bow kills won\'t alert the others. Q in aim = Dead Eye.' },
      { text: 'Recover the plant fuse from their stash', type: 'interact', action: 'loot', id: 'fusecrate', hint: 'Search the supply crate inside the pen.' },
      { text: 'Return to Marshal Rourke', type: 'talk', npc: 'marshal', dialog: 'marshal_fuse' },
    ],
    reward: { money: 40 },
  },
  {
    id: 'm4', title: 'Saddle Up', giver: 'marshal',
    desc: 'The island is big and a ranger needs a mount. Gallimimus are fast — if you can calm one.',
    steps: [
      { text: 'Craft Meat Bait', type: 'craft', id: 'bait', hint: 'Bait needs 1 Meat and 1 Fiber.' },
      { text: 'Tame a Gallimimus or Parasaurolophus', type: 'tame', hint: 'Find a herd in open meadows. Crouch, approach slowly and hold E.' },
      { text: 'Ride your new mount', type: 'mount', hint: 'Press F near your tamed animal. H whistles it to you.' },
    ],
    reward: { money: 15, items: { bait: 2 } },
  },
  {
    id: 'm4b', title: 'Wheels', giver: 'gunsmith',
    desc: 'The park\'s tour fleet has been rusting in Haven\'s motor pool for three years. Tobias thinks one of them can still run.',
    steps: [
      { text: 'Talk to Old Tobias at the Gunsmith', type: 'talk', npc: 'gunsmith', dialog: 'tobias_jeep' },
      { text: 'Find a working battery at the Safari Lodge', type: 'interact', action: 'loot', id: 'batterycrate', hint: 'The lodge is east along the paved park road. The tour office kept spares.' },
      { text: 'Return to the Haven Motor Pool', type: 'goto', loc: 'motorpool', r: 14 },
      { text: 'Install the battery in the Jeep', type: 'interact', action: 'repairJeep', id: 'jeep' },
      { text: 'Take the Jeep out for a drive', type: 'drive', dist: 400, hint: 'Press F at the Jeep. W/S drive, A/D steer, Space handbrake. The paved park roads are smoothest.' },
    ],
    reward: { money: 30 },
  },
  {
    id: 'm5', title: 'Power to the Fences', giver: 'marshal',
    desc: 'With the fuse, the geothermal plant can power Haven\'s electric fence again.',
    steps: [
      { text: 'Drive or ride to the Geothermal Plant', type: 'goto', loc: 'geothermal', r: 120 },
      { text: 'Drive the raiders out of the plant', type: 'killTag', tag: 'camp:geothermal' },
      { text: 'Install the fuse and restore power', type: 'interact', action: 'power', id: 'power' },
      { text: 'Report to Old Tobias at the Gunsmith', type: 'talk', npc: 'gunsmith', dialog: 'tobias_rifle' },
    ],
    reward: { money: 50, weapon: 'rifle', items: { rifleAmmo: 16 } },
  },
  {
    id: 'm6', title: 'Signal in the Static', giver: 'doctor',
    desc: 'Dr. Okafor has been picking up fragments of a broadcast. Someone is out there.',
    steps: [
      { text: 'Talk to Dr. Okafor', type: 'talk', npc: 'doctor', dialog: 'okafor_signal' },
      { text: 'Search the Creation Lab for a radio crystal', type: 'interact', action: 'loot', id: 'labcrate', hint: 'The lab is east of Haven. Dilophosaurs nest there.' },
      { text: 'Climb Mount Sibo to the radio tower', type: 'goto', loc: 'tower', r: 30, hint: 'Follow the switchback road north past the lake.' },
      { text: 'Use the radio transmitter', type: 'interact', action: 'radio', id: 'radio' },
    ],
    reward: { money: 60 },
  },
  {
    id: 'm7', title: "Crane's Hollow", giver: 'marshal',
    desc: 'Crane heard the broadcast too. He means to take the boat and leave Haven to rot.',
    steps: [
      { text: 'Tell Marshal Rourke about the broadcast', type: 'talk', npc: 'marshal', dialog: 'marshal_crane' },
      { text: "Assault Crane's Hollow", type: 'goto', loc: 'cranecamp', r: 120 },
      { text: 'Kill Silas Crane', type: 'killId', id: 'crane', hint: 'Gunfire carries a long way. Something big may come to see what the noise is.' },
      { text: 'Search Crane\'s cabin', type: 'interact', action: 'loot', id: 'cranecrate' },
    ],
    reward: { money: 150, items: { rexTooth: 0 } },
  },
  {
    id: 'm7b', title: 'Wings over Nublar', giver: 'marshal',
    desc: 'Crane\'s logbook mentions the park\'s supply plane — still in its hangar at the old airstrip. A plane could reach Kestrel in two hours, not three days.',
    steps: [
      { text: 'Talk to Marshal Rourke', type: 'talk', npc: 'marshal', dialog: 'marshal_plane' },
      { text: 'Collect the avgas from the East Dock fuel store', type: 'interact', action: 'loot', id: 'avgascrate', hint: 'The fuel store is beside the dock office.' },
      { text: 'Get to the Nublar Airstrip', type: 'goto', loc: 'airstrip', r: 240, hint: 'South-west of the bunker. Take a car.' },
      { text: 'Refuel the Caravan', type: 'interact', action: 'refuel', id: 'plane' },
      { text: 'Fly over the radio tower on Mount Sibo', type: 'flyTo', loc: 'tower', r: 220, hint: 'W for throttle. Past 120 km/h, pull the mouse back. Bank with the mouse to turn.' },
      { text: 'Land back on the airstrip', type: 'land', hint: 'Line up with the runway, ease off the throttle, keep the nose up and the descent gentle.' },
    ],
    reward: { money: 100 },
  },
  {
    id: 'm8', title: 'The Last Frontier', giver: null,
    desc: 'The boat at East Dock is fuelled. The Caravan is ready on the airstrip. Kestrel Island is waiting.',
    steps: [
      { text: 'Go to the East Dock', type: 'goto', loc: 'docks', r: 40 },
      { text: 'Make your choice at the boat', type: 'interact', action: 'boat', id: 'boat' },
    ],
    reward: { money: 0 },
  },
];

export const DIALOGS = {
  tobias_jeep: [
    ['Old Tobias', 'Fences humming, lights on... you know what this town still hasn\'t got? Wheels.'],
    ['Old Tobias', 'There\'s a whole tour fleet in the motor pool past the south gate. Jeeps, the big green Explorers. Three years of rain on them.'],
    ['Ava', 'Engines?'],
    ['Old Tobias', 'Engines are fine, I\'ve been turning them over by hand every month. It\'s the batteries — dead as a doornail.'],
    ['Old Tobias', 'The Safari Lodge out east kept spares for the tour office. Bring me one and I\'ll show you something beautiful.'],
  ],
  jeep_done: [
    ['Old Tobias', 'Listen to that. Like 1993 never ended.'],
    ['Old Tobias', 'Keep her on the paved roads if you can. And if the big girl comes for you — floor it.'],
  ],
  marshal_plane: [
    ['Marshal Rourke', 'Found this in Crane\'s cabin. His logbook. Look at the last page.'],
    ['Ava', '"Caravan — hangar two, airstrip. Tanks dry. Avgas at the dock store." He was going to fly out.'],
    ['Marshal Rourke', 'A plane could make Kestrel in two hours. The boat takes three days, and that\'s if the weather plays nice.'],
    ['Ava', 'I flew supply runs for the park, back when there was a park. I can get her up.'],
    ['Marshal Rourke', 'Then take her up. Make sure she flies before anybody bets their life on her.'],
  ],
  plane_done: [
    ['Ava', 'Wheels down. She flies like a dream.'],
    ['Radio', 'Nublar, this is Kestrel. We heard an engine on the wind. Was that you?'],
    ['Ava', 'That was me. Keep that fire lit, Kestrel. One way or another, we\'re coming.'],
  ],
  marshal_intro: [
    ['Marshal Rourke', 'Well I\'ll be damned. Ava Reyes. We had you down as raptor food.'],
    ['Ava', 'Bunker held. Food didn\'t. What happened to the fences, Marshal?'],
    ['Marshal Rourke', 'Silas Crane happened. Him and his Black Fang boys raided the geothermal plant, pulled the main fuse. Fence has been dead for a month.'],
    ['Marshal Rourke', 'Without power, every carnivore on this island is one bad night away from Main Street.'],
    ['Ava', 'So get the fuse back.'],
    ['Marshal Rourke', 'With what army? Half my deputies are dead and the other half are farmers. But you... you know this island.'],
    ['Marshal Rourke', 'Get yourself stocked at Ma Delgado\'s. Then we talk business.'],
  ],
  marshal_fuse: [
    ['Ava', 'Black Fang won\'t be using the Raptor Pen anymore. And I found this.'],
    ['Marshal Rourke', 'The fuse! Reyes, you beautiful lunatic.'],
    ['Marshal Rourke', 'Plant\'s still crawling with Crane\'s men, though. And it\'s a long walk. You\'ll want something faster than your boots.'],
    ['Marshal Rourke', 'The old-timers used to calm gallimimus with bait. Feed one, keep low, be patient. Then ride like hell.'],
  ],
  tobias_rifle: [
    ['Old Tobias', 'Lights came on in Haven an hour ago. Folks were crying in the street.'],
    ['Old Tobias', 'Here. Lever-action. Belonged to a game warden named Muldoon — or so the story goes.'],
    ['Old Tobias', 'Treat it right and it\'ll put down anything short of the big girl.'],
  ],
  okafor_signal: [
    ['Dr. Lena Okafor', 'Ava. Listen to this.'],
    ['Radio', '...—strel Island... survivors... repeat... clean water and... —ninety souls...'],
    ['Dr. Lena Okafor', 'It\'s weak. Our receiver is junk. But the transmitter on Mount Sibo could reach them — if it had a working crystal oscillator.'],
    ['Dr. Lena Okafor', 'The Creation Lab had spares. If the dilophosaurs haven\'t eaten them.'],
  ],
  radio_call: [
    ['Ava', 'This is Ava Reyes, Isla Nublar. Kestrel Island, do you copy?'],
    ['Radio', '...Nublar? My God. We copy, Nublar. We thought the whole coast was gone.'],
    ['Radio', 'We have a settlement here. Fields. A doctor. No infected — the sea keeps them off.'],
    ['Radio', 'If you have a boat, head two-seven-zero. We\'ll keep a fire lit on the north point every night.'],
    ['Ava', 'Understood. Keep that fire burning.'],
  ],
  marshal_crane: [
    ['Ava', 'There are people on Kestrel Island, Marshal. Ninety of them. There\'s a way off this rock.'],
    ['Marshal Rourke', 'Then we\'re not the only ones who heard it. Crane\'s been moving men toward the dock all night.'],
    ['Marshal Rourke', 'He takes that boat, he leaves the rest of us here to die. It ends with him, Reyes.'],
    ['Marshal Rourke', 'His camp\'s in the north-west hollow. Go loud or go quiet — but go.'],
  ],
  crane_taunt: [
    ['Silas Crane', 'Reyes! The ranger who wouldn\'t die. You know what this island taught me?'],
    ['Silas Crane', 'Fences are a lie. Law is a lie. There\'s only teeth.'],
  ],
  boat: [
    ['Ava', 'Fuel\'s in. The engine turns over. Three days to Kestrel, if the weather holds.'],
    ['Ava', 'Haven has its lights back. Rourke has his town. And the island... the island has its animals.'],
  ],
};

export const ENDINGS = {
  fly: ['Ava flew west at first light, the Caravan heavy with families and seed corn.', 'Below, Isla Nublar shrank to a green jewel ringed with surf — the paddocks, the lake, the herds moving through the morning mist.', 'Two hours later, a fire on the north point of Kestrel Island guided her down.', 'She went back for the others the next day. And the day after that.'],
  sail: ['Ava sailed west at dawn, with nine settlers aboard.', 'On the third night, she saw the fire on the north point of Kestrel Island.', 'Behind her, Isla Nublar faded into the mist — still wild, still beautiful.', 'Some nights, she swears she can still hear them roaring.'],
  stay: ['The boat left with the families. Ava stayed.', 'Someone had to ride the roads. Someone had to keep the fences humming.', 'Haven grew. The herds returned to the southern meadows.', 'And the last ranger of Isla Nublar kept watch over a world that belonged to the dinosaurs.'],
};

export const FIELD_GUIDE = {
  compy: ['Compsognathus', 'Chicken-sized scavengers. Alone they are a nuisance; in a swarm they are a problem.'],
  gallimimus: ['Gallimimus', 'Flighty, fast, and the best mount on the island once calmed with bait.'],
  para: ['Parasaurolophus', 'Its horn call carries for miles. Strong enough to carry a rider at speed.'],
  trike: ['Triceratops', 'Will warn you once. The second time, it charges.'],
  stego: ['Stegosaurus', 'Slow-witted and slow to anger. That tail can split a jeep.'],
  brachio: ['Brachiosaurus', 'The gentle giants of the lake. Thirty tons of indifference.'],
  raptor: ['Velociraptor', 'Pack hunters. They test fences, flank from cover and pounce. Never turn your back.'],
  dilo: ['Dilophosaurus', 'The frill means it is about to spit. The venom blinds.'],
  trex: ['Tyrannosaurus Rex', 'The Queen of the island. Her territory is wherever she is standing.'],
  ptera: ['Pteranodon', 'Nests in the old Aviary. Dives at anything that wanders too close.'],
  infected: ['The Infected', 'They came ashore with the freighter. The mainland plague, here at last. Headshots only.'],
};
