# JURASSIC FRONTIER
### *The Last Ranger of Isla Nublar*

An open-world survival western set on a fallen dinosaur park — *Red Dead Redemption* meets *Far Cry Primal*, running entirely in the browser on an ordinary laptop.

> The mainland fell to a virus. The dead got back up. The boats stopped coming.
> Three years later, Isla Nublar is a lawless frontier: gangs, bounties, and dinosaurs walking the roads like they own them.
> You are **Ava Reyes**, the park's last ranger. Stay alive.

---

## Play

```bash
npm install
npm run dev        # http://localhost:5173
# or a production build:
npm run build && npm run preview
```

Requires a WebGL2 browser (Chrome, Edge, Firefox, Safari 15+). Headphones recommended.
Click the game to capture the mouse; **Esc** pauses. Xbox/PlayStation controllers work out of the box (menus included).

**Deploy:** `npm run build` produces a static `dist/` folder with relative paths — upload it to itch.io, any static host, or enable GitHub Pages (a ready workflow lives in `.github/workflows/deploy.yml`; it builds on pushes to `main`).

## Controls

| Key | Action |
|---|---|
| **W A S D** | Move |
| **Shift** | Sprint / gallop |
| **C** | Crouch (stealth) |
| **Space** | Jump (mount: leap) |
| **Right mouse** | Aim (over-the-shoulder) |
| **Left mouse** | Fire / draw & release bow / machete swing |
| **Q** *(while aiming a gun)* | **Dead Eye** — time slows, sweep across targets to mark them, click to unleash |
| **R** | Reload |
| **1–4 / wheel** | Machete · Bow · Revolver · Rifle |
| **T** | Toggle venom arrows |
| **E** | Interact · gather · talk · loot · harvest · *hold* to tame |
| **F** | Mount / dismount |
| **H** | Whistle for your mount |
| **L** | Lantern |
| **G / B** | Eat food / use bandage |
| **X** *(hold)* | Walk slowly |
| **Tab · M · J** | Satchel & crafting · Map · Journal |

**Gamepad:** sticks move/look · LT aim · RT fire · A jump · B crouch · X interact/reload · Y mount · LB/RB weapons · L3 sprint · R3 Dead Eye · D-pad whistle/bandage/eat/lantern · View satchel · Menu pause.

## What's in the game

**A living island** — a 2.2 km procedurally sculpted island (volcanic Mount Sibo, a brachiosaur lake, jungle, meadows, beaches) with a full day/night cycle, dynamic storms, god rays, moonlit nights, fireflies, wind-swept grass and ocean swell.

**Ten dinosaur species with real behaviour**
- *Gallimimus* and *Parasaurolophus* herds that graze, stampede from noise and predators — and can be **tamed and ridden** with bait.
- *Velociraptor* packs that flank and pounce. *Dilophosaurus* that flare their frills and spit blinding venom.
- Territorial *Triceratops* and *Stegosaurus* that warn, then charge.
- Gentle *Brachiosaurus* wading in the lake. *Pteranodons* circling the Aviary and diving at intruders.
- *Compsognathus* swarms — and **the Tyrannosaur**, who roars, shakes the ground and hunts everything.
- Predators hunt herbivores (and people) on their own — the ecosystem runs whether you're watching or not.

**The Infected** — the freighter wrecked on Shipwreck Beach brought the mainland plague ashore. They roam the coasts at night; only headshots stop them, and raptors hunt them too.

**Frontier gunplay & stealth** — revolver, lever-action rifle, hunting bow (silent, physical arrows), machete with silent takedowns from behind. Raiders have line-of-sight detection meters (white → yellow → red), raise the alarm, strafe and take cover. Gunfire carries — herbivores flee, predators come to investigate.

**Haven** — the old Visitor Center turned frontier town: general store, gunsmith, doctor, saloon, a marshal's bounty board, townsfolk with daily routines and guards on the palisade towers who shoot at anything with too many teeth.

**Story campaign** (8 missions, ~2–3 hours) — from waking up in Ranger Bunker 4, through liberating Black Fang outposts, restoring power to the fences and climbing Mount Sibo to make radio contact with another colony, to a showdown at Crane's Hollow and a final choice at the dock. Free roam continues after the ending.

**Field Guide & onboarding** — every species is documented the first time you get a good look at it; one-time contextual hints teach gathering, crafting, stealth, Dead Eye and riding exactly when they first matter.

**Survival systems** — gathering (wood, fiber, flint, herbs, berries, amber), crafting (bow, arrows, venom arrows, bandages, bait, tonics, hide upgrades), hunting and harvesting, cooking at campfires, sleeping, trading, bounties, collectibles, fast travel, autosave.

## Graphics & performance

- Custom PBR terrain splatting (triplanar cliffs, wet sand, roads), Gerstner-wave ocean with depth absorption and shoreline foam, analytic sky with clouds, sun, moon and stars.
- Instanced vegetation with LOD and view culling; a pooled light system; static batching for buildings; one skinned draw call per creature.
- Post: MSAA, bloom, ACES tone mapping, god rays, split-tone grading, vignette, film grain, Dead Eye sepia.
- Four quality presets (Low → Ultra) plus **adaptive resolution** that automatically trades pixels for framerate on weaker laptops.
- Game logic costs ~1 ms per frame; vegetation streaming ~2 ms per rebuild; typical scenes are 150–300 draw calls.

## Zero assets

Every texture, tree, building, dinosaur, human, animation, sound effect and the generative fingerpicked western score are synthesized at runtime. The repository contains only code.

## Project layout

```
src/
  main.js            game bootstrap, loop, interactions, save/load
  core/              input, noise, math, procedural textures, post-processing
  world/             terrain, sky/atmosphere, water, vegetation, structures, colliders, pickups
  entities/          skinned rig builder, humans, dinosaurs (models + AI), player & camera
  systems/           combat, audio, inventory, quests, population/ecosystem, FX
  ui/                HUD, menus, map rendering
  data/              world layout, story & dialogue, items, dinosaur tuning
```

## Publishing note

"Jurassic Park" is a trademark of Universal City Studios LLC and Amblin Entertainment. This project uses the name because the concept calls for it; **for a commercial release, rename the park** in `src/data/story.js` (`TITLE`, `PARK`, intro text and dialogue) and the gate sign in `src/world/structures.js`, or obtain a license.
