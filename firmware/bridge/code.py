# code.py — morse-key-demo, BRIDGE role (receive only)
#
# Runs on a XIAO ESP32-C3 in CircuitPython, plugged into the laptop. Nothing
# is wired to it: it listens for edge packets from the key board over ESP-NOW
# and forwards each one to the laptop as a line of JSON. The onboard LED
# mirrors the remote key. Sound comes from the page, not the board.
#
# The other board runs firmware/key/code.py. Install either from the page's
# Firmware tab; the role is fixed by which file is on the board.
#
# Lines to the laptop (see PROTOCOL.md):
#   {"t":"hello","role":"bridge","proto":1,"mode":"wireless"}
#   {"t":"edge","down":true,"ms":12345}      # key pressed (down=true) / released
#   {"t":"idle","ms":12345}                  # after 3 s without an edge
#
# Timing lives on the PAGE: it turns edges into dits/dahs and letters. The
# bridge just relays clean edges with millisecond timestamps.

import time
import sys
import board
import digitalio
import wifi
import espnow

CHANNEL = 6
MAGIC = 0xA5
BROADCAST = b"\xff\xff\xff\xff\xff\xff"
IDLE_MS = 3000

def now_ms():
    return time.monotonic_ns() // 1_000_000 & 0xFFFFFFFF

def emit(obj):
    import json
    sys.stdout.write(json.dumps(obj, separators=(",", ":")))
    sys.stdout.write("\n")

# ---- onboard LED mirrors the remote key ----
try:
    led = digitalio.DigitalInOut(board.LED)
    led.direction = digitalio.Direction.OUTPUT
except Exception:
    led = None

def show(on):
    if led:
        led.value = on

# ---- radio: pin the channel, listen for broadcasts ----
wifi.radio.enabled = True
try:
    wifi.radio.start_ap(ssid="morse-br", channel=CHANNEL)
except Exception:
    pass
e = espnow.ESPNow()
e.peers.append(espnow.Peer(mac=BROADCAST, channel=CHANNEL))

emit({"t": "hello", "role": "bridge", "proto": 1, "mode": "wireless"})

last_rx = now_ms()
idle_sent = False
while True:
    p = e.read()
    if p is not None:
        msg = bytes(p.msg)
        if len(msg) >= 5 and msg[0] == MAGIC:
            down = msg[4] != 0
            show(down)
            emit({"t": "edge", "down": down, "ms": now_ms()})
            last_rx = now_ms()
            idle_sent = False
    else:
        # Heartbeat after a quiet spell so the page can tell quiet from dead.
        if (now_ms() - last_rx) > IDLE_MS and not idle_sent:
            emit({"t": "idle", "ms": now_ms()})
            idle_sent = True
        time.sleep(0.002)
