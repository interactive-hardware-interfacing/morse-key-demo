# Wiring — morse-key-demo

Source of truth for the page’s hardware/wiring tables. `wiring.svg` is the
diagram; the page embeds an inline, theme-aware copy.

Two firmware files, `../firmware/key/code.py` and `../firmware/bridge/code.py`.
A board is whichever it was last given (the page's Firmware tab installs
either). There is no buzzer and no jumper: the page makes the sound, and each
board's onboard LED mirrors the key.

## Pin names

The XIAO ESP32-C3's top silkscreen prints function names on the right-hand
header. The one pin this demo uses is on the left:

| This doc says | Printed on the board | ESP32-C3 GPIO |
|---------------|----------------------|---------------|
| D1            | D1 / A1              | GPIO3         |
| GND           | GND                  | —             |

If you add wiring of your own, keep anything tied to ground at power-up off
D0 (GPIO2), D8 (SCK, GPIO8) and D9 (MISO, GPIO9): they are strapping pins the
chip samples to choose its boot mode.

## Key board (firmware/key/code.py)

| Signal     | XIAO C3 pin    | Note                                     |
|------------|----------------|------------------------------------------|
| Key button | D1 → GND       | Momentary; internal pull-up, no resistor |
| Antenna    | u.FL           | Wireless only; clip on firmly            |
| USB        | USB-C          | To the laptop = wired setup; to a USB bank = wireless key |

Plugged into the laptop, this board alone **is** the wired setup. On a USB
bank it broadcasts the same edges to a bridge.

## Bridge board (firmware/bridge/code.py)

| Signal  | XIAO C3 pin    | Note                 |
|---------|----------------|----------------------|
| Antenna | u.FL           | Clip on firmly       |
| USB     | USB-C → laptop | Data + power         |

Nothing else. No breadboard.

## Keyboard setup

No hardware. Tick “Keyboard mode” on the page and hold the spacebar.

## Notes

- Both wireless boards pin Wi-Fi channel 6.
- Tick **Audio** on the page for the sidetone; browsers only start sound
  after a click.
