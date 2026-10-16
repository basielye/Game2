# Leafscapes Beta: The Keeper's Cottage

A copy of Leafscapes (the plant match-3 glasshouse game, unchanged) with a new life-simulation dimension.
Open `beta/index.html`; the cottage is the green **Cottage** button on the home screen.

- **Create-a-Sim**: household of up to 4 Sims. Pick name, age, body, skin, hairstyle and colour, outfit and colours,
  3 of 12 traits and an aspiration.
- **Live mode**:
  - Sims have 8 needs and moodlets, and free will (they decide for themselves using utility scoring).
  - Pathfinding through doors; radial action menus and action queues.
  - Social interactions build friendships.
  - Six skills, five careers with carpool, pay and promotions, aspirations and bills.
  - Failure states: accidents and passing out.
  - Day/night cycle and speeds (pause, normal, fast, ultra).
- **Buy mode**: about 35 rotatable, recolourable furniture pieces, plus every Herbarium plant as decor.
- **Build mode**: walls, rooms, doors, windows, arches, 8 floors, 9 wall coverings, sledgehammer, cutaway views.
- **Link to the glasshouse**: Sims can tend the glasshouse or launch a puzzle, and winning a level pays §150+ into
  household funds.

Code: `js/sims/` (`iso.js` rendering, `catalog.js` furniture & materials, `world.js` lot/rooms/pathfinding,
`simfolk.js` Sims & drawing, `brain.js` autonomy & actions, `cottage.js` UI & modes).
