// Keyboard + mouse input with pointer lock and per-frame edge detection.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: 0, pressed: 0, released: 0, wheel: 0 };
    this.locked = false;
    this.sensitivity = 1;
    this.invertY = false;
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && this.locked) e.preventDefault();
      if (e.code === 'Tab') e.preventDefault();
      this.down.add(e.code); this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => { this.down.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => { this.down.clear(); this.mouse.buttons = 0; });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX; this.mouse.dy += e.movementY;
    });
    addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.mouse.buttons |= 1 << e.button; this.mouse.pressed |= 1 << e.button;
    });
    addEventListener('mouseup', (e) => { this.mouse.buttons &= ~(1 << e.button); this.mouse.released |= 1 << e.button; });
    addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.mouse.buttons = 0; this.onUnlock?.(); }
    });
  }
  lock() { if (!this.locked) this.canvas.requestPointerLock?.()?.catch?.(() => {}); }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  key(c) { return this.enabled && this.down.has(c); }
  hit(c) { return this.enabled && this.pressed.has(c); }
  btn(b) { return this.enabled && (this.mouse.buttons & (1 << b)) !== 0; }
  click(b) { return this.enabled && (this.mouse.pressed & (1 << b)) !== 0; }
  endFrame() {
    this.pressed.clear(); this.released.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.pressed = 0; this.mouse.released = 0; this.mouse.wheel = 0;
  }
}
