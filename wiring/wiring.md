# Wiring — morse-key-demo

Source of truth for the page’s hardware/wiring tables. `wiring.svg` is the
diagram; the page embeds an inline, theme-aware copy.

One firmware file (`../firmware/code.py`) on every board. Role is chosen by the
D8 jumper at boot.

## Wired setup (simplest — one board)

| Signal     | XIAO C3 pin      | Note                                     |
|------------|------------------|------------------------------------------|
| Key button | D1 → GND         | Momentary; internal pull-up, no resistor |
| Buzzer     | D3 → piezo → GND | Passive piezo, GPIO on/off tone          |
| USB        | USB-C → laptop   | Data + power                             |

No jumper on D8 → the board is a “key,” and when it’s the one tethered to the
laptop that **is** the wired demo.

## Wireless setup (two boards)

**Key board** (remote):

| Signal     | XIAO C3 pin | Note                 |
|------------|-------------|----------------------|
| Key button | D1 → GND    | Momentary            |
| Antenna    | u.FL        | Clip on firmly       |
| USB power  | USB-C       | USB bank             |

**Bridge board** (tethered):

| Signal      | XIAO C3 pin      | Note                              |
|-------------|------------------|-----------------------------------|
| Role jumper | **D8 → GND**     | Present = bridge; read once at boot|
| Buzzer      | D3 → piezo → GND | Beeps on received key-down        |
| Antenna     | u.FL             | Clip on firmly                    |
| USB         | USB-C → laptop   | Data + power                      |

## Keyboard setup

No hardware. Tick “Keyboard mode” on the page and hold the spacebar.

## Notes

- Set the D8 jumper **before power-up** — role is read once at boot.
- Both wireless boards pin Wi-Fi channel 6.
- Buzzer is optional for decoding (the page shows it visually) but it’s what
  makes the demo fun.
