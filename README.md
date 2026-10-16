# NEON SURGE

An endless, neon-drenched roguelite arcade shooter built for phones. You get one finger, an auto-firing ship, and a lot of bullets.

## How to play

- **Drag anywhere** to fly. The ship moves *relative* to your finger, so your thumb never covers it. Firing is automatic.
- **Graze**: skim enemy bullets without getting hit to earn points and charge **SURGE**.
- **SURGE** (button in the bottom-right, or `Space` on desktop): a few seconds of invulnerability, double fire rate, piercing white-hot shots, and a shockwave that clears every bullet on screen.
- **Combo**: kills chain into a combo that raises your score multiplier, up to **x10**. Getting hit breaks it.
- **Mods**: after every wave, pick 1 of 3 mods (Common, Rare, Epic or Legendary). Stack them into builds like drones + seekers, crit + pierce, or Singularity + Time Dilation.
- **Bosses**: every 5th wave. Each sector has its own boss, its own colors and new bullet patterns. Bosses become *enraged* below 50% HP.

Desktop controls: WASD or arrow keys to move, `Space` for Surge, `P`/`Esc` to pause, `Enter` to start.

## Long-term progression

- **Crystals** drop from enemies and pay for everything in the **Hangar**.
- **5 ships** with different hulls and perks: Vector, Phantom, Titan, Nova, Wraith.
- **8 permanent upgrades**: hull, damage, fire rate, magnet, starting shields, crystal bonus, Surge charge and rerolls.
- **Pilot levels**: every run earns XP, and each level-up pays out crystals.
- **3 daily missions** that rotate every day.
- **16 achievements**, each with a crystal reward.
- Progress is saved locally in the browser.

## Tech

- Plain HTML, CSS and JavaScript. No build step and no dependencies.
- Canvas 2D renderer with additive "neon" blending, pre-rendered glow sprites, particles, screen shake, hit-stop and slow-motion.
- All audio is synthesized live with WebAudio. That includes the SFX and an adaptive synthwave soundtrack that gets more intense during bosses and Surge.
- Haptics on supported devices.
- An installable PWA with a manifest and a service worker, so it works offline and can be added to the home screen.

## Running it

Serve the folder with any static server and open it on your phone:

```sh
npx http-server . -p 8080
```

Or enable **GitHub Pages** for this repo (Settings → Pages → deploy from branch). Then open the page on your phone and choose **Add to Home Screen** to get a fullscreen app.
