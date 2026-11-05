'use strict';

/*
 * sim.js — fake bridge for morse-key-demo. "Keys" a canned message (SOS HI)
 * as down/up edge lines at a steady dit length, so the page's timing strip,
 * decoder and alphabet highlight all run with no hardware.
 */

const DIT = 140; // ms
const PATTERNS = { S: '...', O: '---', H: '....', I: '..' };
const MESSAGE = ['S', 'O', 'S', ' ', 'H', 'I'];

export class SimBridge {
  constructor() { this.onLine = () => {}; this.onRaw = () => {}; this.onClose = () => {}; this.connected = false; this._t = null; }

  async connect() {
    this.connected = true;
    this._emit({ t: 'hello', role: 'bridge', proto: 1, mode: 'wireless', simulated: true });
    this._schedule();
    return true;
  }
  _emit(o) { this.onRaw(JSON.stringify(o) + '\n'); this.onLine(o); }

  _schedule() {
    // Build an edge timeline (ms offsets) for the message, then replay it on a
    // wall clock, looping with a long word gap.
    const edges = []; let t = 500;
    for (const ch of MESSAGE) {
      if (ch === ' ') { t += DIT * 7; continue; }
      const pat = PATTERNS[ch];
      for (let i = 0; i < pat.length; i++) {
        const dur = pat[i] === '.' ? DIT : DIT * 3;
        edges.push([t, true]); t += dur;
        edges.push([t, false]); t += DIT;        // intra-letter gap
      }
      t += DIT * 2;                                // make the letter gap ~3 units
    }
    const loop = t + DIT * 7;        // total cycle length incl. trailing word gap
    const start = performance.now();
    let idx = 0;                      // next edge to fire within the current cycle
    let cycleBase = start;            // wall-clock time this cycle started
    this._t = setInterval(() => {
      if (!this.connected) return;
      const nowP = performance.now();
      let elapsed = nowP - cycleBase;
      // advance to a new cycle when we pass the loop length
      if (elapsed >= loop) { cycleBase += loop * Math.floor(elapsed / loop); idx = 0; elapsed = nowP - cycleBase; }
      // fire every edge whose scheduled time we've reached
      while (idx < edges.length && edges[idx][0] <= elapsed) {
        const [, down] = edges[idx]; idx++;
        this._emit({ t: 'edge', down, ms: Math.round(nowP - start) });
      }
    }, 15);
  }

  async send() {}
  async disconnect() { this.connected = false; clearInterval(this._t); this._t = null; }
}
