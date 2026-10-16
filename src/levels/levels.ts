// Handcrafted nights. Each introduces exactly one new idea.
// See README "Adding a level" for the format.

import type { LevelDef } from '../sim/types';

export const LEVELS: LevelDef[] = [
  {
    id: 'first-light',
    name: 'First Light',
    map: [
      'MMMMMMMM',
      '........',
      'T##...##',
      'H.......',
      '........',
      '........',
      '........',
      '....K...',
    ],
    fog: 'creeper',
    oil: 5,
    lanterns: ['basic'],
    villagers: [{ route: [[7, 3], [0, 3]], name: 'Pip' }],
    stars: [1, 1, 1],
  },
  {
    id: 'two-gaps',
    name: 'Two Gaps',
    hint: "Walking costs oil too. Plan the Keeper's route.",
    map: [
      'MMMMMMMM',
      '........',
      '#..##..#',
      'H......H',
      '........',
      '........',
      '........',
      '...K....',
    ],
    fog: 'creeper',
    oil: 9,
    lanterns: ['basic'],
    villagers: [
      { route: [[3, 4], [3, 3], [0, 3]] },
      { route: [[4, 4], [4, 3], [7, 3]] },
    ],
    stars: [1, 2, 2],
  },
  {
    id: 'the-beacon',
    name: 'The Beacon',
    hint: 'A Beacon lights a wide circle.',
    map: [
      'MMMMMMMM',
      '........',
      '#.....##',
      'H......H',
      '........',
      '........',
      '...K....',
      '........',
    ],
    fog: 'creeper',
    oil: 6,
    lanterns: ['basic', 'beacon'],
    villagers: [
      { route: [[1, 4], [1, 3], [7, 3]] },
      { route: [[6, 4], [6, 3], [0, 3]] },
    ],
    stars: [1, 2, 2],
  },
];
