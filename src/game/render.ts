// Canvas 2D renderer. Draws whatever Scene it is given; owns no game state.

import { Deco, Tile, type Level } from '../sim/grid';
import { LANTERNS } from '../sim/lanterns';
import type { Dir, LanternType, Placement } from '../sim/types';
import type { Effect } from './effects';
import { FOG_ALPHA, LIT_ALPHA, THEME } from './theme';

export interface VillagerSprite {
  /** Tile coordinates (fractional while walking). */
  x: number;
  y: number;
  color: string;
  /** 0..1 progress through the current hop, for squash and stretch. */
  hop: number;
  mood: 'calm' | 'panic' | 'happy' | 'roof';
  /** Hidden inside a house. */
  hidden?: boolean;
  spin?: number;
}

export interface Ghost {
  placement: Placement;
  lit: number[];
  ok: boolean;
  label: string;
}

export interface Scene {
  level: Level;
  placements: Placement[];
  active: boolean[];
  litFrom: Uint8Array;
  litTo: Uint8Array;
  fogFrom: Uint8Array;
  fogTo: Uint8Array;
  /** Interpolation 0..1 between from/to. */
  t: number;
  villagers: VillagerSprite[];
  keeper: { x: number; y: number };
  keeperPath: number[] | null;
  showRoutes: boolean;
  routeAlpha: number;
  preview: Uint8Array | null;
  ghost: Ghost | null;
  housesLit: Set<number>;
  effects: Effect[];
  time: number;
  shake: number;
  patterns: boolean;
}

const DIR_V: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  tile = 48;
  ox = 0;
  oy = 0;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  /** Fit the board into the given CSS box. */
  resize(level: Level, boxW: number, boxH: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const t = Math.max(24, Math.floor(Math.min(boxW / level.w, boxH / level.h)));
    this.tile = t;
    this.cssW = t * level.w;
    this.cssH = t * level.h;
    this.ox = 0;
    this.oy = 0;
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
  }

  /** CSS pixel -> tile coordinate. */
  pick(level: Level, px: number, py: number): { x: number; y: number } | null {
    const x = Math.floor((px - this.ox) / this.tile);
    const y = Math.floor((py - this.oy) / this.tile);
    return x >= 0 && y >= 0 && x < level.w && y < level.h ? { x, y } : null;
  }

  draw(s: Scene) {
    const { ctx } = this;
    const T = this.tile;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    if (s.shake > 0) {
      const a = s.shake * T * 0.18;
      ctx.translate(Math.sin(s.time * 70) * a, Math.cos(s.time * 53) * a);
    }

    const { level } = s;
    const ease = smooth(s.t);

    // Floor.
    for (let y = 0; y < level.h; y++)
      for (let x = 0; x < level.w; x++) this.drawFloor(level, x, y, s.time);

    // Lit tiles: tile-exact warm pools, so the rule is readable at a glance.
    for (let i = 0; i < level.tiles.length; i++) {
      const a = lerp(s.litFrom[i], s.litTo[i], ease);
      if (a <= 0) continue;
      ctx.globalAlpha = a * LIT_ALPHA;
      ctx.fillStyle = THEME.lit;
      ctx.fillRect((i % level.w) * T, ((i / level.w) | 0) * T, T, T);
    }
    ctx.globalAlpha = 1;

    // Ghost light while hovering a spot.
    if (s.ghost) {
      ctx.fillStyle = s.ghost.ok ? 'rgba(255, 226, 150, 0.28)' : 'rgba(255, 122, 107, 0.22)';
      for (const i of s.ghost.lit) ctx.fillRect((i % level.w) * T, ((i / level.w) | 0) * T, T, T);
    }

    // Soft glow on top of the pools.
    ctx.globalCompositeOperation = 'lighter';
    s.placements.forEach((p, k) => {
      if (!s.active[k] || p.type === 'bait') return;
      const spec = LANTERNS[p.type];
      const r = ((spec.radius ?? 1.2) + 1) * T;
      const flicker = 0.85 + 0.15 * Math.sin(s.time * 7 + k * 2.1) * Math.sin(s.time * 3.3 + k);
      const cx = (p.x + 0.5) * T;
      const cy = (p.y + 0.5) * T;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255, 200, 110, ${0.35 * flicker})`);
      g.addColorStop(1, 'rgba(255, 170, 80, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    });
    ctx.globalCompositeOperation = 'source-over';

    if (s.showRoutes) this.drawRoutes(level, s.routeAlpha, s.time);
    if (s.keeperPath && s.keeperPath.length > 1) this.drawKeeperPath(level, s.keeperPath, s.time);

    // Things standing on tiles.
    for (let y = 0; y < level.h; y++)
      for (let x = 0; x < level.w; x++) this.drawObject(level, x, y, s);

    s.placements.forEach((p, k) => {
      const fading = !s.active[k];
      this.drawLantern(p.type, (p.x + 0.5) * T, (p.y + 0.5) * T, T, p.dir ?? 1, fading ? 0.35 : 1, s.time + k);
    });
    if (s.ghost) {
      const p = s.ghost.placement;
      ctx.globalAlpha = 0.6;
      this.drawLantern(p.type, (p.x + 0.5) * T, (p.y + 0.5) * T, T, p.dir ?? 1, 1, s.time);
      ctx.globalAlpha = 1;
    }

    this.drawKeeper(s.keeper.x, s.keeper.y, s.time);
    s.villagers.forEach((v) => this.drawVillager(v, s.time));

    this.drawFog(s, ease);
    if (s.preview) this.drawPreview(level, s.preview, s.time);

    for (const e of s.effects) this.drawEffect(e);

    if (s.ghost) {
      const p = s.ghost.placement;
      this.label(s.ghost.label, (p.x + 0.5) * T, p.y * T - 4, s.ghost.ok ? THEME.text : THEME.danger);
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // ---------------------------------------------------------------- tiles

  private drawFloor(level: Level, x: number, y: number, time: number) {
    const { ctx } = this;
    const T = this.tile;
    const t = level.tiles[y * level.w + x];
    const px = x * T;
    const py = y * T;
    if (t === Tile.water) {
      ctx.fillStyle = THEME.water;
      ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = THEME.waterHi;
      ctx.lineWidth = Math.max(1, T / 24);
      for (let k = 0; k < 2; k++) {
        const wy = py + T * (0.3 + 0.4 * k);
        const off = Math.sin(time * 1.5 + x + k * 2) * T * 0.08;
        ctx.beginPath();
        ctx.moveTo(px + T * 0.15 + off, wy);
        ctx.quadraticCurveTo(px + T * 0.35 + off, wy - T * 0.06, px + T * 0.55 + off, wy);
        ctx.stroke();
      }
      return;
    }
    if (t === Tile.marsh) {
      ctx.fillStyle = THEME.marsh;
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = 'rgba(160, 140, 200, 0.35)';
      const b = (time * 0.6 + x * 0.37 + y * 0.71) % 1;
      ctx.beginPath();
      ctx.arc(px + T * (0.3 + 0.4 * ((x * 7 + y) % 3) / 2), py + T * (0.75 - b * 0.4), T * 0.05 * (1 - b), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = (x + y) % 2 ? THEME.groundAlt : THEME.ground;
    ctx.fillRect(px, py, T, T);
    if (t === Tile.ground && (x * 13 + y * 7) % 5 === 0) {
      // A few grass tufts for texture.
      ctx.strokeStyle = 'rgba(120, 160, 100, 0.25)';
      ctx.lineWidth = 1;
      const gx = px + T * 0.3;
      const gy = py + T * 0.7;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 2, gy - 5);
      ctx.moveTo(gx + 3, gy);
      ctx.lineTo(gx + 3, gy - 6);
      ctx.moveTo(gx + 6, gy);
      ctx.lineTo(gx + 8, gy - 4);
      ctx.stroke();
    }
    if (t === Tile.bridge) {
      ctx.fillStyle = THEME.water;
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = THEME.bridge;
      ctx.fillRect(px + T * 0.1, py, T * 0.8, T);
      ctx.strokeStyle = THEME.bridgeDark;
      ctx.lineWidth = Math.max(1, T / 30);
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(px + T * 0.1, py + (T * k) / 4);
        ctx.lineTo(px + T * 0.9, py + (T * k) / 4);
        ctx.stroke();
      }
    }
  }

  private drawObject(level: Level, x: number, y: number, s: Scene) {
    const { ctx } = this;
    const T = this.tile;
    const i = y * level.w + x;
    const t = level.tiles[i];
    const px = x * T;
    const py = y * T;
    if (t === Tile.wall) {
      if (level.deco[i] === Deco.tree) {
        ctx.fillStyle = THEME.trunk;
        ctx.fillRect(px + T * 0.44, py + T * 0.55, T * 0.12, T * 0.35);
        ctx.fillStyle = THEME.treeDark;
        circle(ctx, px + T * 0.5, py + T * 0.45, T * 0.38);
        ctx.fillStyle = THEME.treeCanopy;
        circle(ctx, px + T * 0.44, py + T * 0.38, T * 0.27);
      } else {
        ctx.fillStyle = THEME.stoneDark;
        roundRect(ctx, px + T * 0.04, py + T * 0.08, T * 0.92, T * 0.86, T * 0.12);
        ctx.fill();
        ctx.fillStyle = THEME.stone;
        roundRect(ctx, px + T * 0.04, py + T * 0.04, T * 0.92, T * 0.8, T * 0.12);
        ctx.fill();
        ctx.strokeStyle = THEME.stoneDark;
        ctx.lineWidth = Math.max(1, T / 28);
        ctx.beginPath();
        ctx.moveTo(px + T * 0.06, py + T * 0.44);
        ctx.lineTo(px + T * 0.94, py + T * 0.44);
        ctx.moveTo(px + T * 0.5, py + T * 0.06);
        ctx.lineTo(px + T * 0.5, py + T * 0.44);
        ctx.moveTo(px + T * 0.3, py + T * 0.44);
        ctx.lineTo(px + T * 0.3, py + T * 0.82);
        ctx.moveTo(px + T * 0.72, py + T * 0.44);
        ctx.lineTo(px + T * 0.72, py + T * 0.82);
        ctx.stroke();
      }
    } else if (t === Tile.house) {
      const lit = s.housesLit.has(i);
      ctx.fillStyle = THEME.houseWall;
      ctx.fillRect(px + T * 0.14, py + T * 0.42, T * 0.72, T * 0.5);
      ctx.fillStyle = THEME.houseRoof;
      ctx.beginPath();
      ctx.moveTo(px + T * 0.04, py + T * 0.46);
      ctx.lineTo(px + T * 0.5, py + T * 0.08);
      ctx.lineTo(px + T * 0.96, py + T * 0.46);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = THEME.houseDoor;
      ctx.fillRect(px + T * 0.42, py + T * 0.64, T * 0.16, T * 0.28);
      ctx.fillStyle = lit ? '#fff1b8' : THEME.window;
      ctx.fillRect(px + T * 0.2, py + T * 0.55, T * 0.15, T * 0.13);
      ctx.fillRect(px + T * 0.65, py + T * 0.55, T * 0.15, T * 0.13);
      if (lit) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(px + T / 2, py + T * 0.6, 0, px + T / 2, py + T * 0.6, T * 0.7);
        g.addColorStop(0, 'rgba(255, 210, 120, 0.35)');
        g.addColorStop(1, 'rgba(255, 210, 120, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - T * 0.2, py - T * 0.1, T * 1.4, T * 1.4);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  // ---------------------------------------------------------------- fog

  private drawFog(s: Scene, ease: number) {
    const { ctx } = this;
    const T = this.tile;
    const { level } = s;
    for (let i = 0; i < level.tiles.length; i++) {
      const a = lerp(s.fogFrom[i], s.fogTo[i], ease);
      if (a <= 0) continue;
      const x = i % level.w;
      const y = (i / level.w) | 0;
      const px = x * T;
      const py = y * T;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, T, T);
      ctx.clip();
      ctx.globalAlpha = a * FOG_ALPHA;
      ctx.fillStyle = THEME.fog;
      ctx.fillRect(px, py, T, T);
      // Drifting soft puffs.
      ctx.globalAlpha = a * 0.5;
      for (let k = 0; k < 2; k++) {
        const ph = s.time * (0.35 + k * 0.17) + x * 1.7 + y * 2.3 + k * 3;
        const cx = px + T * (0.5 + 0.35 * Math.sin(ph));
        const cy = py + T * (0.5 + 0.3 * Math.cos(ph * 0.8));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, T * 0.6);
        g.addColorStop(0, 'rgba(205, 200, 235, 0.55)');
        g.addColorStop(1, 'rgba(205, 200, 235, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(px, py, T, T);
      }
      // Swirl texture: fog never relies on colour alone.
      ctx.globalAlpha = a * (s.patterns ? 0.75 : 0.35);
      ctx.strokeStyle = THEME.fogLine;
      ctx.lineWidth = Math.max(1, T / (s.patterns ? 18 : 26));
      const drift = ((s.time * 0.25 + (x + y) * 0.13) % 1) * T;
      for (let k = -1; k < 2; k++) {
        const wy = py + T * 0.3 + k * T * 0.5 + (drift % (T * 0.5));
        ctx.beginPath();
        ctx.moveTo(px - 2, wy);
        ctx.bezierCurveTo(px + T * 0.3, wy - T * 0.12, px + T * 0.6, wy + T * 0.12, px + T + 2, wy);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawPreview(level: Level, preview: Uint8Array, time: number) {
    const { ctx } = this;
    const T = this.tile;
    const pulse = 0.65 + 0.35 * Math.sin(time * 4);
    for (let i = 0; i < preview.length; i++) {
      if (!preview[i]) continue;
      const px = (i % level.w) * T;
      const py = ((i / level.w) | 0) * T;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, T, T);
      ctx.clip();
      ctx.globalAlpha = 0.55 * pulse;
      ctx.strokeStyle = THEME.preview;
      ctx.lineWidth = Math.max(1.5, T / 16);
      for (let k = -T; k < T * 2; k += T / 4) {
        ctx.beginPath();
        ctx.moveTo(px + k, py);
        ctx.lineTo(px + k - T, py + T);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 0.9 * pulse;
      ctx.setLineDash([T / 8, T / 10]);
      ctx.strokeStyle = THEME.preview;
      ctx.lineWidth = Math.max(1, T / 24);
      ctx.strokeRect(px + 2, py + 2, T - 4, T - 4);
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- routes

  private drawRoutes(level: Level, alpha: number, time: number) {
    const { ctx } = this;
    const T = this.tile;
    level.villagers.forEach((v, n) => {
      const color = THEME.villagers[n % THEME.villagers.length];
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, T / 14);
      ctx.lineCap = 'round';
      ctx.setLineDash([T / 10, T / 6]);
      ctx.lineDashOffset = -time * T * 0.4;
      const off = ((n % 3) - 1) * T * 0.08;
      ctx.beginPath();
      v.route.forEach((i, k) => {
        const cx = (i % level.w + 0.5) * T + off;
        const cy = (((i / level.w) | 0) + 0.5) * T + off;
        if (k === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrowhead into the house.
      const a = v.route[v.route.length - 2];
      const b = v.route[v.route.length - 1];
      const ax = (a % level.w + 0.5) * T;
      const ay = (((a / level.w) | 0) + 0.5) * T;
      const bx = (b % level.w + 0.5) * T;
      const by = (((b / level.w) | 0) + 0.5) * T;
      const ang = Math.atan2(by - ay, bx - ax);
      const tipx = (ax + bx) / 2 + Math.cos(ang) * T * 0.15 + off;
      const tipy = (ay + by) / 2 + Math.sin(ang) * T * 0.15 + off;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(tipx, tipy);
      ctx.lineTo(tipx - Math.cos(ang - 0.5) * T * 0.22, tipy - Math.sin(ang - 0.5) * T * 0.22);
      ctx.lineTo(tipx - Math.cos(ang + 0.5) * T * 0.22, tipy - Math.sin(ang + 0.5) * T * 0.22);
      ctx.fill();
      if (v.delay > 0) {
        const s0 = v.route[0];
        this.label(`wait ${v.delay}`, (s0 % level.w + 0.5) * T, ((s0 / level.w) | 0) * T + T * 0.05, color, T * 0.22);
      }
    });
    ctx.globalAlpha = 1;
  }

  private drawKeeperPath(level: Level, path: number[], time: number) {
    const { ctx } = this;
    const T = this.tile;
    ctx.strokeStyle = THEME.keeperPath;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = Math.max(2, T / 16);
    ctx.setLineDash([T / 16, T / 8]);
    ctx.lineDashOffset = -time * T * 0.3;
    ctx.beginPath();
    path.forEach((i, k) => {
      const cx = (i % level.w + 0.5) * T;
      const cy = (((i / level.w) | 0) + 0.5) * T;
      if (k === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    // Footprint dots on each walked tile (1 oil each).
    ctx.fillStyle = THEME.keeperPath;
    for (let k = 1; k < path.length; k++) {
      const i = path[k];
      circle(ctx, (i % level.w + 0.5) * T, (((i / level.w) | 0) + 0.5) * T, T * 0.05);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- characters

  drawLantern(type: LanternType, cx: number, cy: number, T: number, dir: Dir, alpha: number, time: number, ctx = this.ctx) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    const s = T / 48;
    const glow = 0.8 + 0.2 * Math.sin(time * 6);
    switch (type) {
      case 'basic':
      case 'reflector': {
        ctx.strokeStyle = '#2b2018';
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.arc(cx, cy - 12 * s, 5 * s, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#3b2c20';
        roundRect(ctx, cx - 9 * s, cy - 12 * s, 18 * s, 24 * s, 4 * s);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 214, 120, ${glow})`;
        roundRect(ctx, cx - 6 * s, cy - 8 * s, 12 * s, 16 * s, 3 * s);
        ctx.fill();
        ctx.fillStyle = '#fff6d6';
        circle(ctx, cx, cy, 3 * s);
        if (type === 'reflector') {
          const [dx, dy] = DIR_V[dir];
          ctx.fillStyle = '#d6e4f0';
          ctx.strokeStyle = '#2b2018';
          ctx.lineWidth = 1.5 * s;
          // Mirror behind, arrow in front.
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(Math.atan2(dy, dx));
          ctx.fillRect(-15 * s, -11 * s, 4 * s, 22 * s);
          ctx.strokeRect(-15 * s, -11 * s, 4 * s, 22 * s);
          ctx.fillStyle = '#ffe9a8';
          ctx.beginPath();
          ctx.moveTo(20 * s, 0);
          ctx.lineTo(11 * s, -7 * s);
          ctx.lineTo(11 * s, 7 * s);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'beacon': {
        ctx.fillStyle = '#4a3a2c';
        ctx.beginPath();
        ctx.moveTo(cx - 8 * s, cy + 16 * s);
        ctx.lineTo(cx - 4 * s, cy - 6 * s);
        ctx.lineTo(cx + 4 * s, cy - 6 * s);
        ctx.lineTo(cx + 8 * s, cy + 16 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255, 220, 130, ${glow})`;
        circle(ctx, cx, cy - 11 * s, 9 * s);
        ctx.fillStyle = '#fffbe8';
        circle(ctx, cx, cy - 11 * s, 4.5 * s);
        ctx.fillStyle = '#4a3a2c';
        ctx.fillRect(cx - 10 * s, cy - 22 * s, 20 * s, 3 * s);
        break;
      }
      case 'flare': {
        ctx.strokeStyle = '#7a4a2a';
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(cx - 4 * s, cy + 15 * s);
        ctx.lineTo(cx + 2 * s, cy - 6 * s);
        ctx.stroke();
        const r = (8 + 2 * Math.sin(time * 20)) * s;
        ctx.fillStyle = `rgba(255, 120, 60, ${glow})`;
        star(ctx, cx + 3 * s, cy - 10 * s, r, r * 0.45, 6);
        ctx.fillStyle = '#fff2c0';
        circle(ctx, cx + 3 * s, cy - 10 * s, 3 * s);
        break;
      }
      case 'bait': {
        // A fog pie, cooling on the ground. Fog loves pie.
        ctx.fillStyle = '#b8743a';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 4 * s, 15 * s, 8 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8b06a';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 1 * s, 13 * s, 6 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#a8602a';
        ctx.lineWidth = 1.5 * s;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(cx + k * 5 * s - 2 * s, cy - 1 * s);
          ctx.lineTo(cx + k * 5 * s + 2 * s, cy + 3 * s);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(230, 225, 255, 0.7)';
        for (let k = -1; k <= 1; k += 2) {
          const w = Math.sin(time * 3 + k) * 2 * s;
          ctx.beginPath();
          ctx.moveTo(cx + k * 5 * s, cy - 6 * s);
          ctx.quadraticCurveTo(cx + k * 5 * s + 4 * s + w, cy - 12 * s, cx + k * 5 * s + w, cy - 18 * s);
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }

  private drawKeeper(x: number, y: number, time: number) {
    const { ctx } = this;
    const T = this.tile;
    const cx = (x + 0.5) * T;
    const cy = (y + 0.5) * T + Math.sin(time * 2) * T * 0.02;
    const s = T / 48;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 15 * s, 11 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = THEME.keeperCloak;
    ctx.beginPath();
    ctx.moveTo(cx - 12 * s, cy + 15 * s);
    ctx.quadraticCurveTo(cx, cy - 26 * s, cx + 12 * s, cy + 15 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = THEME.skin;
    circle(ctx, cx, cy - 4 * s, 5 * s);
    ctx.fillStyle = '#2b2018';
    circle(ctx, cx - 2 * s, cy - 4 * s, 1 * s);
    circle(ctx, cx + 2 * s, cy - 4 * s, 1 * s);
    // Little hand lamp.
    ctx.fillStyle = `rgba(255, 214, 120, ${0.8 + 0.2 * Math.sin(time * 5)})`;
    circle(ctx, cx + 12 * s, cy + 4 * s, 4 * s);
  }

  private drawVillager(v: VillagerSprite, time: number) {
    if (v.hidden) return;
    const { ctx } = this;
    const T = this.tile;
    const s = T / 48;
    // Squash and stretch: stretch mid-hop, squash on landing.
    const h = v.hop;
    const air = Math.sin(Math.PI * Math.min(1, h / 0.85));
    const land = h > 0.85 ? Math.sin(Math.PI * (h - 0.85) / 0.15) : 0;
    let sy = 1 + 0.18 * air - 0.22 * land;
    let sx = 1 - 0.1 * air + 0.2 * land;
    let lift = air * 7 * s;
    if (v.mood === 'roof') {
      // Trembling on a rooftop.
      sx = 1 + 0.04 * Math.sin(time * 40);
      sy = 1;
      lift = 0;
    }
    if (v.mood === 'calm' && h === 0) sy += 0.03 * Math.sin(time * 3 + v.x * 3);
    const cx = (v.x + 0.5) * T;
    const cy = (v.y + 0.5) * T + (v.mood === 'roof' ? -T * 0.32 : 0);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 14 * s, 9 * s * (1 - air * 0.3), 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy + 14 * s - lift);
    if (v.spin) ctx.rotate(v.spin);
    ctx.scale(sx, sy);
    ctx.fillStyle = v.color;
    roundRect(ctx, -8 * s, -20 * s, 16 * s, 20 * s, 7 * s);
    ctx.fill();
    ctx.fillStyle = THEME.skin;
    circle(ctx, 0, -24 * s, 6.5 * s);
    ctx.fillStyle = '#2b2018';
    if (v.mood === 'panic' || v.mood === 'roof') {
      // Wide eyes, little "o" mouth.
      circle(ctx, -2.5 * s, -25 * s, 1.6 * s);
      circle(ctx, 2.5 * s, -25 * s, 1.6 * s);
      circle(ctx, 0, -21 * s, 1.4 * s);
      // Arms up!
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(-7 * s, -16 * s);
      ctx.lineTo(-12 * s, -27 * s);
      ctx.moveTo(7 * s, -16 * s);
      ctx.lineTo(12 * s, -27 * s);
      ctx.stroke();
    } else {
      circle(ctx, -2.5 * s, -25 * s, 1 * s);
      circle(ctx, 2.5 * s, -25 * s, 1 * s);
      if (v.mood === 'happy') {
        ctx.strokeStyle = '#2b2018';
        ctx.lineWidth = 1 * s;
        ctx.beginPath();
        ctx.arc(0, -23 * s, 2.5 * s, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- effects

  private drawEffect(e: Effect) {
    const { ctx } = this;
    const T = this.tile;
    const k = e.age / e.life;
    const x = e.x * T;
    const y = e.y * T;
    ctx.globalAlpha = Math.max(0, 1 - k);
    switch (e.kind) {
      case 'puff': {
        const r = T * (0.2 + 0.5 * k) * (e.size ?? 1);
        ctx.fillStyle = THEME.fogLine;
        for (let n = 0; n < 5; n++) {
          const a = (n / 5) * Math.PI * 2 + e.seed;
          circle(ctx, x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.45);
        }
        break;
      }
      case 'item': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(e.age * 8 + e.seed);
        ctx.font = `${Math.round(T * 0.32)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.text ?? '•', 0, 0);
        ctx.restore();
        break;
      }
      case 'text':
        this.label(e.text ?? '', x, y - k * T * 0.4, e.color ?? THEME.text);
        break;
      case 'spark': {
        ctx.fillStyle = e.color ?? '#ffe9a8';
        star(ctx, x, y, T * 0.12 * (1 - k * 0.5), T * 0.05, 4);
        break;
      }
      case 'ring': {
        ctx.strokeStyle = e.color ?? '#ffe9a8';
        ctx.lineWidth = Math.max(2, T / 12) * (1 - k);
        ctx.beginPath();
        ctx.arc(x, y, T * (0.3 + 2 * k) * (e.size ?? 1), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  private label(text: string, x: number, y: number, color: string, size = this.tile * 0.28) {
    const { ctx } = this;
    ctx.font = `700 ${Math.max(11, Math.round(size))}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20, 18, 34, 0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}

// ---------------------------------------------------------------- helpers

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
export function smooth(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, n: number) {
  ctx.beginPath();
  for (let k = 0; k < n * 2; k++) {
    const r = k % 2 ? r2 : r1;
    const a = (k / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}
