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
    this.lastMouseT = 0;
    this._lockT = 0;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && this.locked) e.preventDefault();
      if (e.code === 'Tab' || e.code === 'AltLeft' || e.code === 'AltRight' || (this.locked && (e.code === 'KeyS' || e.code === 'KeyF') && e.ctrlKey)) e.preventDefault();
      this.down.add(e.code); this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => { this.down.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => { this.down.clear(); this.mouse.buttons = 0; });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // some browsers emit a bogus huge delta right after locking/alt-tab; drop isolated spikes
      const mx = e.movementX || 0, my = e.movementY || 0;
      if ((Math.abs(mx) > 400 || Math.abs(my) > 400) && performance.now() - this._lockT < 300) return;
      this.mouse.dx += mx; this.mouse.dy += my;
      if (mx || my) this.lastMouseT = performance.now();
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
      this._lockT = performance.now();
      if (!this.locked) { this.mouse.buttons = 0; this.onUnlock?.(); }
    });
  }
  // ---- Gamepad (standard mapping) ----
  pollGamepad(dt, inMenu) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) { this.padActive = false; return; }
    const prev = this._padPrev || (this._padPrev = []);
    const b = gp.buttons.map((x) => x.pressed || x.value > 0.5);
    const edge = (i) => b[i] && !prev[i];
    if (b.some((x) => x) || gp.axes.some((a) => Math.abs(a) > 0.3)) this.padActive = true;
    if (inMenu) {
      if (edge(12)) this.onMenuNav?.(0, -1); if (edge(13)) this.onMenuNav?.(0, 1);
      if (edge(14)) this.onMenuNav?.(-1, 0); if (edge(15)) this.onMenuNav?.(1, 0);
      const ay = gp.axes[1] || 0;
      this._navT = (this._navT || 0) - dt;
      if (Math.abs(ay) > 0.6 && this._navT <= 0) { this.onMenuNav?.(0, Math.sign(ay)); this._navT = 0.22; }
      if (edge(0)) this.onMenuSelect?.();
      if (edge(1)) this.onMenuBack?.();
      if (edge(9)) this.onVirtualKey?.('Escape');
      this._padPrev = b;
      return;
    }
    const map = { 0: 'Space', 1: 'KeyC', 2: 'KeyE', 3: 'KeyF', 8: 'Tab', 9: 'Escape', 10: 'ShiftLeft', 11: 'KeyQ', 12: 'KeyH', 13: 'KeyB', 14: 'KeyG', 15: 'KeyL' };
    for (const [i, code] of Object.entries(map)) {
      if (b[i] && !prev[i]) { this.down.add(code); this.pressed.add(code); if (['Tab', 'Escape', 'KeyE', 'Space'].includes(code)) this.onVirtualKey?.(code); }
      if (!b[i] && prev[i]) { this.down.delete(code); this.released.add(code); }
    }
    if (edge(2)) this.pressed.add('KeyR'); // X doubles as reload
    if (edge(4)) this.mouse.wheel -= 1;
    if (edge(5)) this.mouse.wheel += 1;
    // triggers → mouse buttons
    const lt = gp.buttons[6]?.value > 0.35, rt = gp.buttons[7]?.value > 0.35;
    if (lt) this.mouse.buttons |= 4; else if (this._padLT) this.mouse.buttons &= ~4;
    if (rt && !this._padRT) this.mouse.pressed |= 1;
    if (rt) this.mouse.buttons |= 1; else if (this._padRT) this.mouse.buttons &= ~1;
    this._padLT = lt; this._padRT = rt;
    // left stick → movement keys
    const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0;
    const setKey = (code, on) => { if (on) this.down.add(code); else if (this._padKeys?.has(code)) this.down.delete(code); };
    this._padKeys ||= new Set();
    const keys = { KeyW: ly < -0.35, KeyS: ly > 0.35, KeyA: lx < -0.35, KeyD: lx > 0.35 };
    for (const [k, on] of Object.entries(keys)) { setKey(k, on); if (on) this._padKeys.add(k); else this._padKeys.delete(k); }
    // right stick → look
    const dz = (v) => (Math.abs(v) < 0.14 ? 0 : Math.sign(v) * Math.pow((Math.abs(v) - 0.14) / 0.86, 1.6));
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    this.mouse.dx += rx * 900 * dt;
    this.mouse.dy += ry * 600 * dt;
    if (rx || ry) this.lastMouseT = performance.now();
    this._padPrev = b;
  }

  lock() {
    if (this.locked || !this.canvas.requestPointerLock) return;
    // raw (unaccelerated) mouse where supported; fall back to a plain lock
    let p;
    try { p = this.canvas.requestPointerLock({ unadjustedMovement: true }); } catch (e) { p = null; }
    if (p && p.catch) p.catch(() => { this.canvas.requestPointerLock()?.catch?.(() => {}); });
    else if (!p && !document.pointerLockElement) { try { this.canvas.requestPointerLock(); } catch (e) { /* ignore */ } }
  }
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
