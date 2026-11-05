# morse-key-demo

A browser demo of Morse code: tap a key, hear the beep, and watch it decode
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

- **Wired** — one XIAO C3 with a button on D1 and a buzzer on D3, into the laptop.
- **Wireless** — a remote key board + a bridge board (jumper D8→GND), over ESP-NOW.
- **Keyboard** — tick *Keyboard mode* and hold SPACE. Zero hardware; the backup
  if a board dies mid-tour.

One firmware file ([`firmware/code.py`](firmware/code.py)) for every board; the
D8 jumper picks the role at boot. Wiring in [`wiring/`](wiring/); the edge
protocol in [`PROTOCOL.md`](PROTOCOL.md).

## Run locally

```
python -m http.server 8000
```

then open <http://localhost:8000/>. Web Serial needs HTTPS or localhost (but
keyboard mode works from `file://` too).

## Browser support

Chrome or Edge for the hardware modes; keyboard mode works in any modern browser.

## License

GPL-2.0 (see [`LICENSE`](LICENSE)). Maintained by [LC Linkous](https://github.com/LC-Linkous).
