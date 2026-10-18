// World layout — every named place on the island. Coordinates are metres, island centred at origin.
// +Z is south (towards the docks), -Z is north (towards the volcano).
export const WORLD_SIZE = 2200;
export const WATER_LEVEL = 0;

export const LOCATIONS = [
  { id: 'bunker', name: 'Ranger Bunker 4', x: 140, z: 470, r: 22, flat: 26, h: null, kind: 'camp', desc: 'Where Ava rode out the end of the world.' },
  { id: 'haven', name: 'Haven (Visitor Center)', x: 0, z: 120, r: 75, flat: 95, h: null, kind: 'town', desc: 'The last settlement. Law is thin and coffee is thinner.' },
  { id: 'gate', name: 'The Great Gate', x: 0, z: 330, r: 18, flat: 30, h: null, kind: 'landmark', desc: 'The old park entrance. The torches still get lit at night.' },
  { id: 'docks', name: 'East Dock', x: 40, z: 820, r: 40, flat: 50, h: 2.2, kind: 'landmark', desc: 'Where the supply boats used to land. None come now.' },
  { id: 'raptorpen', name: 'Raptor Pen (Black Fang Outpost)', x: -480, z: 120, r: 45, flat: 60, h: null, kind: 'outpost', desc: 'The Black Fang gang took the old raptor paddock.' },
  { id: 'geothermal', name: 'Geothermal Plant', x: 460, z: -140, r: 50, flat: 65, h: null, kind: 'outpost', desc: 'Power for the fences — if anyone can bring it back.' },
  { id: 'rexpaddock', name: 'Tyrannosaur Paddock', x: 380, z: 260, r: 90, flat: 0, h: null, kind: 'danger', desc: 'The fence is down. She hunts at dusk.' },
  { id: 'lake', name: 'Brachiosaur Lake', x: -340, z: -215, r: 110, flat: 0, h: null, kind: 'landmark', desc: 'The gentle giants drink here every morning.' },
  { id: 'tower', name: 'Mount Sibo Radio Tower', x: -90, z: -640, r: 18, flat: 22, h: null, kind: 'landmark', desc: 'The highest point on the island. The antenna still hums.' },
  { id: 'aviary', name: 'The Aviary', x: 560, z: -520, r: 45, flat: 55, h: null, kind: 'danger', desc: 'A collapsed dome. Pteranodons nest in the wreckage.' },
  { id: 'cranecamp', name: "Crane's Hollow", x: -590, z: -470, r: 55, flat: 70, h: null, kind: 'outpost', desc: "Silas Crane's fortified camp. Nobody walks in uninvited." },
  { id: 'lodge', name: 'Safari Lodge', x: 620, z: 330, r: 30, flat: 40, h: null, kind: 'camp', desc: 'An abandoned lodge. Good place to sleep — if you lock the door.' },
  { id: 'hatchery', name: 'Hammond Creation Lab', x: 230, z: -10, r: 28, flat: 38, h: null, kind: 'landmark', desc: 'The lab where it all started. Incubators still warm.' },
  { id: 'airstrip', name: 'Nublar Airstrip', x: -200, z: 480, r: 70, flat: 0, h: 9, kind: 'landmark', desc: 'The park\'s supply runway. A bush plane still sits in the hangar.' },
  { id: 'motorpool', name: 'Haven Motor Pool', x: 42, z: 212, r: 18, flat: 22, h: null, kind: 'landmark', desc: 'Where the tour fleet used to sleep.' },
  { id: 'westbeach', name: 'Shipwreck Beach', x: -625, z: 300, r: 40, flat: 0, h: null, kind: 'landmark', desc: 'A rusted freighter, run aground the week the mainland fell.' },
];

// Airstrip runway: centre, heading (radians, along +x rotated), length and width. Terrain is flattened to `h`.
export const RUNWAY = { x: -200, z: 480, yaw: 0.3, len: 420, w: 30, h: 9 };

export const locById = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));

// Roads as polylines (dirt + old tarmac). Flattened and painted onto terrain.
export const ROADS = [
  [[40, 800], [60, 700], [120, 560], [140, 480], [80, 400], [0, 330], [0, 200], [0, 150]],
  [[0, 150], [-120, 130], [-260, 140], [-400, 120], [-480, 120]],
  [[0, 120], [120, 60], [230, -10], [340, -80], [460, -140]],
  [[0, 330], [180, 330], [300, 360], [470, 360], [620, 330]],
  [[-60, 60], [-150, -60], [-220, -150], [-260, -340], [-180, -480], [-110, -600], [-90, -640]],
  [[-260, -340], [-420, -420], [-590, -470]],
  [[460, -140], [520, -300], [560, -520]],
  [[-400, 120], [-540, 220], [-615, 295]],
  [[120, 560], [60, 552], [6, 540]],
];
// Roads that were paved for park tours (asphalt ribbons with markings); the rest stay dirt.
export const PAVED = [0, 2, 3];
