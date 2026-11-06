# Protocol — morse-key-demo

Two parts: the **serial format** (line-JSON over USB) that the page reads,
and the **5-byte edge packet** the wireless key sends to the bridge over
ESP-NOW. The board reports **edges** (key down / key up), not samples; all
timing is done on the page.

## Link

- USB serial (native USB Serial/JTAG on the XIAO C3), **115200 baud, 8N1**.
- The board is **print-only**: it emits lines, it doesn't require commands.
  The page may send text lines (the serial-log box); the firmware ignores them.
- In wireless mode both boards pin **Wi-Fi channel 6**.

## Bridge → page: line-JSON

One compact JSON object per line, newline-terminated. The page parses each line
and **ignores unknown `t` values and extra keys**. Partial lines are buffered
until the newline arrives; lines that aren't valid JSON are skipped.

### `hello`
```json
{"t":"hello","role":"bridge","proto":1,"mode":"wireless"}
{"t":"hello","role":"key","proto":1,"mode":"wired"}
```
`role` says which firmware file the board is running; the page's mode badge
follows it. A key board plugged into the laptop is the wired setup; the same
board on a USB bank sends the same edges over the air to a bridge.

### `edge` — a key transition
```json
{"t":"edge","down":true,"ms":12345}
```
- `down` — true on key press, false on release. The board's onboard LED mirrors it.
- `ms` — board milliseconds at the edge.

All timing (dit vs dah, letter and word gaps) is computed **on the page**, not
the firmware. See `js/decoder.js`.

### `idle` — heartbeat when nothing happens
```json
{"t":"idle","ms":12345}
```
Sent after ~750 ms of silence so the page can tell a quiet key from a dead link.

## Over-the-air payload (wireless key → bridge)

Little-endian, msg_type 0x50, 5 bytes:

| Off | Len | Field      | Notes               |
|-----|-----|------------|---------------------|
| 0   | 1   | `magic`    | 0xA5                |
| 1   | 1   | `version`  | 0x01                |
| 2   | 1   | `node_id`  | 0x01                |
| 3   | 1   | `msg_type` | 0x50                |
| 4   | 1   | `down`     | 1 = press, 0 = release |

No CRC — ESP-NOW frames are hardware CRC-checked, and a dropped edge just
misses one symbol.

## Decoding (on the page)

Relative to the tunable **dit** length:
- press < 2 dits → dot (`.`), ≥ 2 dits → dash (`-`)
- release gap ≥ 3 dits → end of letter; ≥ 5–7 dits → word space

Keyboard mode feeds the same decoder from the spacebar, so no board is needed.

## Installing (the Firmware tab)

Not part of the demo protocol — this is how the page gets `code.py` onto a
board. Same port, 115200 8N1 (the C3's USB-JTAG/serial ignores the rate).
It is CircuitPython's raw REPL, the exchange Thonny and mpremote use:

| step | page sends | expects |
|---|---|---|
| interrupt | `\r\x03\x03` (up to 4×, with `\r` and `\x02` fallbacks) | `>>> ` |
| enter raw | `\r\x01` | `raw REPL; CTRL-B to exit\r\n>` |
| exec | code in 128-byte chunks, 8 ms apart, then `\x04` | `OK` · stdout · `\x04` · stderr · `\x04` · `>` |
| exit raw | `\r\x02` | `>>> ` |
| soft reboot | `\x04` at the friendly prompt | boot output until a `{"t":"hello"` line (15 s max) |

The page sends `firmware/key/code.py` or `firmware/bridge/code.py`, whichever
role was clicked. The write is `f=open('code.py','wb')`, then one `f.write(b'…')` per 384-byte
chunk, `f.close()`, then the board prints `os.stat` size and `binascii.crc32`
of the file read back in 512-byte pieces. Both must match what was sent.

A bare board (no REPL answers) gets CircuitPython first through
`flasher/` — the ROM bootloader protocol, handled by esptool-js.
