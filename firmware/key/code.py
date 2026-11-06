# code.py — morse-key-demo, KEY role
#
# Runs on a XIAO ESP32-C3 in CircuitPython with a pushbutton between D1 and
# GND (internal pull-up, no resistor). Every press and release is reported two
# ways at once:
#
#   over USB serial, as a line of JSON — so this board plugged straight into
#   the laptop IS the wired setup;
#   over ESP-NOW, as a 5-byte broadcast — so the same board on a USB bank
#   across the room reaches a bridge (firmware/bridge/code.py).
#
# The onboard LED mirrors the key. Sound comes from the page, not the board.
#
# Lines to the laptop (see PROTOCOL.md):
#   {"t":"hello","role":"key","proto":1,"mode":"wired"}
#   {"t":"edge","down":true,"ms":12345}      # key pressed (down=true) / released
#
# Timing lives on the PAGE: it turns edges into dits/dahs and letters. The
# firmware just reports clean, debounced edges with millisecond timestamps.

import time
import struct
import sys
import board
import digitalio
import keypad
import wifi
import espnow

CHANNEL = 6
MAGIC = 0xA5
MSG_TYPE = 0x50
NODE_ID = 0x01
BROADCAST = b"\xff\xff\xff\xff\xff\xff"

def now_ms():
    return time.monotonic_ns() // 1_000_000 & 0xFFFFFFFF

def emit(obj):
    import json
    sys.stdout.write(json.dumps(obj, separators=(",", ":")))
    sys.stdout.write("\n")

# ---- onboard LED mirrors the key ----
try:
    led = digitalio.DigitalInOut(board.LED)
    led.direction = digitalio.Direction.OUTPUT
except Exception:
    led = None

def show(on):
    if led:
        led.value = on

# ---- key button: keypad gives debounced press/release events with good timing ----
keys = keypad.Keys((board.D1,), value_when_pressed=False, pull=True)

# ---- radio: pin the channel, broadcast edges ----
wifi.radio.enabled = True
try:
    wifi.radio.start_ap(ssid="morse-key", channel=CHANNEL)
except Exception:
    pass
e = espnow.ESPNow()
peer = espnow.Peer(mac=BROADCAST, channel=CHANNEL)
e.peers.append(peer)

emit({"t": "hello", "role": "key", "proto": 1, "mode": "wired"})

while True:
    ev = keys.events.get()
    if ev is not None:
        show(ev.pressed)
        # Wired path: straight to the laptop.
        emit({"t": "edge", "down": ev.pressed, "ms": now_ms()})
        # Wireless path: harmless if no bridge is listening.
        pkt = struct.pack("<BBBBB", MAGIC, 0x01, NODE_ID, MSG_TYPE, 1 if ev.pressed else 0)
        try:
            e.send(pkt, peer)
        except Exception:
            pass
    time.sleep(0.001)
