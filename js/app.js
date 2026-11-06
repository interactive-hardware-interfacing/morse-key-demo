'use strict';

/*
 * app.js — morse-key-demo UI.
 * Three input paths, one decoder:
 *   - Connect bridge: edges arrive over serial (wired or wireless firmware)
 *   - Try without hardware: the simulator keys "SOS HI"
 *   - Keyboard mode: hold the SPACEBAR as a straight key, zero hardware
 * Shows a timing strip, live dit/dah symbols, decoded letters, and an
 * alphabet chart that highlights the current pattern.
 */

import { Bridge } from './bridge.js';
import { SimBridge } from './sim.js';
import { MorseDecoder, MORSE } from './decoder.js';

const $ = s => document.querySelector(s);
const logEl = $('#log');
function log(t) { logEl.textContent += t; if (logEl.textContent.length > 20000) logEl.textContent = logEl.textContent.slice(-15000); logEl.scrollTop = logEl.scrollHeight; }
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

let bridge = null, simulated = false, keyboardMode = false;
let decoder = new MorseDecoder(Number($('#dit').value));
let decoded = '';
let currentSymbols = '';

// ---- timing strip: a scrolling trace of key up/down over time ----
const strip = $('#strip'), sctx = strip.getContext('2d');
const trace = []; // {ms, down}
let keyState = false, baseMs = null;
// Size the canvas bitmap to its on-screen size × devicePixelRatio so text and
// lines stay crisp. CSS controls the layout size; this just follows it.
function fitStrip() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(strip.clientWidth * dpr));
  const h = Math.max(1, Math.round(strip.clientHeight * dpr));
  if (strip.width !== w || strip.height !== h) { strip.width = w; strip.height = h; }
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // draw in CSS pixels from here on
  return { W: strip.clientWidth, H: strip.clientHeight };
}
new ResizeObserver(() => drawStrip()).observe(strip);
function pushEdge(down, ms) {
  if (baseMs == null) baseMs = ms;
  trace.push({ t: ms - baseMs, down });
  while (trace.length > 4000) trace.shift();
  keyState = down;
}
function drawStrip() {
  const { W, H } = fitStrip();
  sctx.clearRect(0, 0, W, H);
  const windowMs = 6000; // show last 6 s
  const nowT = trace.length ? trace[trace.length - 1].t : 0;
  const t0 = nowT - windowMs;
  sctx.strokeStyle = cssVar('--accent'); sctx.lineWidth = 2;
  sctx.beginPath();
  const hi = H * 0.3, lo = H * 0.75;
  let started = false, prevState = false;
  // start from current-ish
  for (let i = 0; i < trace.length; i++) {
    const e = trace[i];
    if (e.t < t0) { prevState = e.down; continue; }
    const x = (e.t - t0) / windowMs * W;
    const yPrev = prevState ? hi : lo;
    const yNew = e.down ? hi : lo;
    if (!started) { sctx.moveTo(0, yPrev); started = true; }
    sctx.lineTo(x, yPrev);  // horizontal to the edge
    sctx.lineTo(x, yNew);   // vertical at the edge
    prevState = e.down;
  }
  // extend to right edge at the last state
  const yEnd = (keyState) ? hi : lo;
  if (started) sctx.lineTo(W, yEnd); else { sctx.moveTo(0, lo); sctx.lineTo(W, lo); }
  sctx.stroke();
  sctx.fillStyle = cssVar('--muted'); sctx.font = '11px system-ui, sans-serif';
  sctx.fillText('key down', 4, hi - 4);
  sctx.fillText('key up', 4, lo + 12);
}

// ---- alphabet chart ----
function buildAlphabet() {
  const el = $('#alphabet');
  const letters = Object.entries(MORSE).filter(([, c]) => /[A-Z]/.test(c));
  el.innerHTML = letters.map(([pat, c]) =>
    `<span class="al" data-pat="${pat}"><b>${c}</b> ${pat.replace(/\./g, '·').replace(/-/g, '–')}</span>`).join('');
}
function highlightPattern(pat) {
  document.querySelectorAll('.al').forEach(s => s.classList.toggle('hot', s.dataset.pat === pat && pat));
}

// ---- handle a decoder event list ----
function applyEvents(evs) {
  for (const ev of evs) {
    if (ev.symbol) { currentSymbols += ev.symbol; $('#symbols').textContent = currentSymbols.replace(/\./g, '·').replace(/-/g, '–'); highlightPattern(currentSymbols); }
    if (ev.letter) { decoded += ev.letter; currentSymbols = ''; $('#symbols').textContent = ''; highlightPattern(''); $('#decoded').textContent = decoded; }
    if (ev.space) { decoded += ' '; $('#decoded').textContent = decoded; }
  }
}

// ---- sidetone audio (Web Audio): beep while the key is down ----
let audioCtx = null, osc = null, gain = null;
function ensureAudio() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
  osc = audioCtx.createOscillator();
  gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 600;          // classic CW sidetone
  gain.gain.value = 0;                // silent until keyed
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
}
let toneOnSince = null;             // performance.now() when the tone started, or null
function tone(on) {
  if (!on) { silence(); return; }
  if (!$('#audio').checked) return;
  ensureAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setTargetAtTime(0.15, t, 0.005);   // short ramp avoids clicks
  toneOnSince = performance.now();
}
// Cut the sidetone no matter what state the key logic thinks it's in. Called
// on key-up, Clear, Disconnect, bridge close, and by the watchdog below.
function silence() {
  toneOnSince = null;
  if (!audioCtx || !gain) return;
  const t = audioCtx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setTargetAtTime(0, t, 0.005);
}
const TONE_WATCHDOG_MS = 3000;      // longest plausible key-down; a dah at the slowest dit is ~1.2 s

// ---- edge entry point (from serial, sim, or keyboard) ----
function onEdge(down, ms) {
  pushEdge(down, ms);
  tone(down);
  applyEvents(decoder.feedEdge(down, ms));
}

// periodic flush so a trailing letter resolves, plus redraw
setInterval(() => {
  const nowMs = (baseMs == null) ? 0 : (performance.now() - perfBase + baseMs);
  applyEvents(decoder.flush(nowMs));
  // If a key-up edge was lost (unplugged mid-press, sim stopped, etc.), don't
  // leave the beep running forever.
  if (toneOnSince != null && performance.now() - toneOnSince > TONE_WATCHDOG_MS) { silence(); keyState = false; }
  drawStrip();
}, 60);
let perfBase = performance.now();

// ---- line handler ----
function setMode(text) { $('#mode').textContent = text; }
function onLine(obj) {
  if (obj.t === 'hello') { setMode(obj.mode === 'wireless' ? 'Wireless' : 'Wired'); log(`[bridge] ${obj.role} / ${obj.mode}${obj.simulated ? ' (sim)' : ''}\n`); return; }
  if (obj.t === 'idle') return;
  if (obj.t === 'edge') onEdge(!!obj.down, typeof obj.ms === 'number' ? obj.ms : Date.now());
}

// ---- keyboard mode: spacebar as a straight key ----
let spaceDown = false;
function kbDown(e) {
  if (!keyboardMode || e.code !== 'Space' || e.repeat) return;
  e.preventDefault(); if (spaceDown) return; spaceDown = true;
  onEdge(true, performance.now() - perfBase);
}
function kbUp(e) {
  if (!keyboardMode || e.code !== 'Space') return;
  e.preventDefault(); spaceDown = false;
  onEdge(false, performance.now() - perfBase);
}
window.addEventListener('keydown', kbDown);
window.addEventListener('keyup', kbUp);

// ---- controls ----
function setStatus(t, c) { $('#status').textContent = t; $('#status').className = c ? 'ok' : ''; $('#connect').disabled = c || keyboardMode; $('#sim').disabled = c || keyboardMode; $('#disconnect').disabled = !c; }

async function start(useSim) {
  simulated = useSim;
  bridge = useSim ? new SimBridge() : new Bridge();
  bridge.onLine = onLine;
  bridge.onRaw = t => { if (!useSim) log(t); };
  bridge.onClose = e => { silence(); keyState = false; log(`\n[closed] ${e?.message || ''}\n`); setStatus('Disconnected', false); bridge = null; };
  try { log(useSim ? '[sim] starting\n' : '[serial] requesting port\n'); await bridge.connect(); setStatus(useSim ? 'Simulator running' : 'Bridge connected', true); }
  catch (e) { log(`[error] ${e.message}\n`); setStatus(e.message, false); bridge = null; }
}
async function stop() { silence(); keyState = false; if (bridge) { try { await bridge.disconnect(); } catch {} } bridge = null; setStatus('Not connected', false); log('[disconnected]\n'); }

$('#connect').addEventListener('click', () => start(false));
$('#sim').addEventListener('click', () => start(true));
$('#disconnect').addEventListener('click', stop);
$('#clear').addEventListener('click', () => {
  decoded = ''; currentSymbols = '';
  $('#decoded').textContent = ''; $('#symbols').textContent = '';
  decoder = new MorseDecoder(Number($('#dit').value));
  highlightPattern('');
  // also clear the timing waveform and stop any tone that was sounding
  trace.length = 0; keyState = false; baseMs = null;
  silence();
  drawStrip();
});

$('#dit').addEventListener('input', () => { $('#ditval').textContent = $('#dit').value; decoder.setDit(Number($('#dit').value)); });

$('#audio').addEventListener('change', () => {
  if ($('#audio').checked) { ensureAudio(); if (audioCtx?.state === 'suspended') audioCtx.resume(); }
  else silence();
});

$('#kbmode').addEventListener('change', () => {
  keyboardMode = $('#kbmode').checked;
  setMode(keyboardMode ? 'Keyboard' : 'Hardware');
  $('#kbhint').hidden = !keyboardMode;
  if (keyboardMode && bridge) stop();
  setStatus(keyboardMode ? 'Keyboard mode' : 'Not connected', false);
});

if (!navigator.serial) $('#nowebserial').hidden = false;
buildAlphabet();
setStatus('Not connected', false);
setMode('—');
log('Ready. Tick Keyboard mode and hold SPACE, or connect a key board, or try the simulator.\n');
