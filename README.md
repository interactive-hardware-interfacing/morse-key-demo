# morse-key-demo

A browser demo of Morse code: tap a key, hear the sidetone, and watch it decode
into letters in real time. Works three ways — **wired** (one board), **wireless**
(two XIAO ESP32-C3 boards), or **keyboard** (hold the spacebar, no hardware at
all). Over Web Serial, no install, no server.

**Live page:** <https://interactive-hardware-interfacing.github.io/morse-key-demo/>
· **Keyboard mode** and **Try without hardware** work on any laptop.

Part of [Interactive Hardware Interfacing](https://interactive-hardware-interfacing.github.io/).
Self-contained — copies nothing from the other demos at runtime.

## What you see

- A **timing strip** (a logic-analyzer trace of key up/down).
- **Now sending** (live dots/dashes) and **Decoded** (the letters).
- A **Morse alphabet** chart that highlights the pattern as you key it.
- A **dit-length** slider to match anyone’s speed.

## Three ways to drive it

- **Wired** — one XIAO C3 with a button between D1 and GND, into the laptop.
- **Wireless** — a remote key board + a bridge board with nothing wired to it, over ESP-NOW.
- **Keyboard** — tick *Keyboard mode* and hold SPACE. Zero hardware; the backup
  if a board dies mid-tour.

Two firmware files, [`firmware/key/code.py`](firmware/key/code.py) and
[`firmware/bridge/code.py`](firmware/bridge/code.py); a board is whichever it
was last given. No buzzer: the page makes the sound, the board's LED mirrors
the key. Only the key board needs a breadboard. Wiring in [`wiring/`](wiring/); the edge
protocol in [`PROTOCOL.md`](PROTOCOL.md).

## Putting the firmware on a board

The page does it. Open the **Firmware** tab, plug in a XIAO ESP32-C3, click
**Install key** or **Install bridge**, pick the port. The page writes `code.py` through
CircuitPython's raw REPL over Web Serial (the C3 has no `CIRCUITPY` drive, so
this is the only USB path), verifies size and CRC32 on the board, reboots it,
and waits for the firmware's first `{"t":"hello"}` line.

A board that has never run CircuitPython needs it installed once: download
the `.bin` for the XIAO ESP32-C3 from
[circuitpython.org](https://circuitpython.org/board/seeed_xiao_esp32c3/),
pick it on the Firmware tab, click **Flash CircuitPython**. That path uses
[esptool-js](https://github.com/espressif/esptool-js), kept in
[`flasher/`](flasher/) under its own licence.

## What's in the repo

| Path | What it is |
|---|---|
| `index.html`, `css/`, `js/app.js` | The page: instrument, plus Hardware / Firmware / About views (`js/views.js`). |
| `js/decoder.js` | Edges → dits/dahs → letters. |
| `js/bridge.js`, `js/sim.js` | Web Serial reader for the board's line-JSON, and a simulator that keys SOS HI. |
| `js/install.js`, `js/device/` | The Firmware tab: CircuitPython raw REPL over Web Serial (write, verify, reboot). |
| `flasher/` | CircuitPython flashing for a bare board (esptool-js). Apache-2.0, see `LICENSES.md`. |
| `firmware/key/code.py`, `firmware/bridge/code.py` | One CircuitPython file per role. |
| `PROTOCOL.md`, `wiring/` | The serial contract and the hookup. |

## Run locally

```
python -m http.server 8000
```

then open <http://localhost:8000/>. Web Serial needs HTTPS or localhost (but
keyboard mode works from `file://` too).

## Browser support

Chrome or Edge for the hardware modes; keyboard mode works in any modern browser.

## License

GPL-2.0 (see [`LICENSE`](LICENSE)), except `flasher/`, which is Apache-2.0
because it bundles esptool-js — see [`LICENSES.md`](LICENSES.md).
Maintained by [LC Linkous](https://github.com/LC-Linkous).
