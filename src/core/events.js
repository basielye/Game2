export class Events {
  constructor() { this.map = new Map(); }
  on(n, fn) { if (!this.map.has(n)) this.map.set(n, new Set()); this.map.get(n).add(fn); return () => this.map.get(n).delete(fn); }
  emit(n, d) { const s = this.map.get(n); if (s) for (const fn of [...s]) fn(d); }
}
