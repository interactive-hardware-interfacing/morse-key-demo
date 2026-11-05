'use strict';

/*
 * decoder.js — turn key down/up edges into Morse and then letters.
 *
 * Standard Morse timing is all relative to one unit, the "dit":
 *   dit  = 1 unit (press)        dah = 3 units (press)
 *   intra-letter gap = 1 unit    letter gap = 3 units    word gap = 7 units
 *
 * We take a tunable dit length (ms). A press shorter than ~2 dits is a dit,
 * longer is a dah. A release gap past ~2 dits ends the letter; past ~5 dits
 * ends the word (space). Thresholds are deliberately loose so a human key
 * works without perfect rhythm.
 *
 * Feed edges with feedEdge(down, ms). It returns an array of events:
 *   {symbol:'.'|'-'}            a dit or dah just completed
 *   {letter:'A'} | {letter:'?'} a letter resolved (on the letter gap)
 *   {space:true}                a word gap
 * Call flush(nowMs) periodically so a trailing letter/word resolves without
 * another keypress.
 */

export const MORSE = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
  '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
  '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
  '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
  '-.--': 'Y', '--..': 'Z',
  '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
  '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
  '.-.-.-': '.', '--..--': ',', '..--..': '?', '-..-.': '/', '-...-': '=',
};

export class MorseDecoder {
  constructor(ditMs = 150) {
    this.ditMs = ditMs;
    this.current = '';      // symbols collecting into the current letter
    this.downAt = null;     // ms of last key-down
    this.lastUpAt = null;   // ms of last key-up (start of a gap)
    this.letterPending = false;
  }
  setDit(ms) { this.ditMs = Math.max(30, ms); }

  // internal: resolve the current letter buffer to a character
  _resolveLetter() {
    if (!this.current) return null;
    const ch = MORSE[this.current] || '?';
    this.current = '';
    this.letterPending = false;
    return ch;
  }

  feedEdge(down, ms) {
    const out = [];
    if (down) {
      // A gap since the last release may have ended a letter/word.
      if (this.lastUpAt != null) {
        const gap = ms - this.lastUpAt;
        if (gap >= this.ditMs * 5) {
          const ch = this._resolveLetter(); if (ch) out.push({ letter: ch });
          out.push({ space: true });
        } else if (gap >= this.ditMs * 2) {
          const ch = this._resolveLetter(); if (ch) out.push({ letter: ch });
        }
      }
      this.downAt = ms;
    } else {
      // key released: classify the press just ended
      if (this.downAt != null) {
        const dur = ms - this.downAt;
        const sym = dur < this.ditMs * 2 ? '.' : '-';
        this.current += sym;
        this.letterPending = true;
        out.push({ symbol: sym });
      }
      this.lastUpAt = ms;
      this.downAt = null;
    }
    return out;
  }

  // Resolve a trailing letter/word when the key has been idle a while.
  flush(nowMs) {
    const out = [];
    if (this.letterPending && this.lastUpAt != null && this.downAt == null) {
      const gap = nowMs - this.lastUpAt;
      if (gap >= this.ditMs * 2) {
        const ch = this._resolveLetter(); if (ch) out.push({ letter: ch });
      }
    }
    return out;
  }
}
