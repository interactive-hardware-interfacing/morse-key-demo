# Protocol — morse-key-demo

Uses the **shared bridge line-JSON** (115200 8N1) from
`packet-inspector-demo/PROTOCOL.md`, with one demo-specific line type. Unlike
the periodic-sample demos, this one reports **edges**, not samples.

## Bridge → page

### `hello`
```json
{"t":"hello","role":"bridge","proto":1,"mode":"wireless"}
{"t":"hello","role":"wired","proto":1,"mode":"wired"}
```
`mode` drives the page’s mode badge.

### `edge` — a key transition
```json
{"t":"edge","down":true,"ms":12345}
```
- `down` — true on key press, false on release.
- `ms` — board milliseconds at the edge.

All timing (dit vs dah, letter and word gaps) is computed **on the page**, not
the firmware. See `js/decoder.js`.

### `idle`
```json
{"t":"idle","ms":12345}
```

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
