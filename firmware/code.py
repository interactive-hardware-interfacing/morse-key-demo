# code.py — morse-key-demo, ONE sketch for both roles
#
# Runs on a XIAO ESP32-C3 in CircuitPython. The same file works as either:
#
#   WIRED  (default): a key button + buzzer on one board, plugged into the
#           laptop. Key edges go straight out the USB serial. No radio. Use
#           this when there's no room for the two-board wireless setup.
#
#   WIRELESS: a jumper on D8 -> GND at boot selects "bridge" mode. A second
#           board (also running this file, with no jumper) is the remote KEY:
#           it reads its button and sends edge packets over ESP-NOW. The bridge
#           drives the buzzer and forwards edges to the laptop.
#
# Role selection at boot:
#   D8 tied to GND  -> BRIDGE (wireless receiver, tethered to laptop)
#   D8 floating     -> KEY: if USB is the data port, acts WIRED; the same board
#                      moved to the remote position just keeps sending edges,
#                      which a bridge will relay. (Simplest: one board wired,
#                      or two boards = one bridge + one key.)
#
# Bridge line-JSON (see PROTOCOL.md):
#   {"t":"hello","role":"bridge"|"wired","proto":1,"mode":"wired"|"wireless"}
#   {"t":"edge","down":true,"ms":12345}      # key pressed  (down=true) / released
#   {"t":"idle","ms":12345}
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
BROADCAST = b"\xff\xff\xff\xff\xff\xff"

def now_ms():
    return time.monotonic_ns() // 1_000_000 & 0xFFFFFFFF

def emit(obj):
    import json
    sys.stdout.write(json.dumps(obj, separators=(",", ":")))
    sys.stdout.write("\n")

# ---- role select ----
role_pin = digitalio.DigitalInOut(board.D8)
role_pin.direction = digitalio.Direction.INPUT
role_pin.pull = digitalio.Pull.UP
is_bridge = (role_pin.value == False)   # jumper to GND -> bridge
role_pin.deinit()

# ---- buzzer + LED (both roles that make sound: wired key and bridge) ----
def make_out(pin):
    io = digitalio.DigitalInOut(pin)
    io.direction = digitalio.Direction.OUTPUT
    return io
buzzer = make_out(board.D3)
try:
    led = make_out(board.LED)
except Exception:
    led = None

def tone(on):
    buzzer.value = on
    if led:
        led.value = on

# ---- key button via keypad (hardware-debounced event queue) ----
# keypad.Keys gives press/release events with good timing, better than polling.
keys = keypad.Keys((board.D1,), value_when_pressed=False, pull=True)

if is_bridge:
    # ----- BRIDGE: receive edge packets, drive buzzer, forward to laptop -----
    wifi.radio.enabled = True
    try:
        wifi.radio.start_ap(ssid="morse-br", channel=CHANNEL)
    except Exception:
        pass
    e = espnow.ESPNow()
    peer = espnow.Peer(mac=BROADCAST, channel=CHANNEL)
    e.peers.append(peer)
    emit({"t": "hello", "role": "bridge", "proto": 1, "mode": "wireless"})

    last_rx = now_ms()
    idle_sent = False
    while True:
        # Local key also works on the bridge (handy for testing).
        ev = keys.events.get()
        if ev is not None:
            tone(ev.pressed)
            emit({"t": "edge", "down": ev.pressed, "ms": now_ms()})
            last_rx = now_ms(); idle_sent = False

        if e:
            p = e.read()
            if p is not None:
                msg = bytes(p.msg)
                if len(msg) >= 5 and msg[0] == MAGIC:
                    down = msg[4] != 0
                    tone(down)
                    emit({"t": "edge", "down": down, "ms": now_ms()})
                    last_rx = now_ms(); idle_sent = False
        else:
            if (now_ms() - last_rx) > 3000 and not idle_sent:
                emit({"t": "idle", "ms": now_ms()})
                idle_sent = True
            time.sleep(0.002)
else:
    # ----- KEY: report local button. If tethered, this IS the wired demo;
    #       if placed remote, the same edges also go out over ESP-NOW so a
    #       bridge can relay them. -----
    wifi.radio.enabled = True
    try:
        wifi.radio.start_ap(ssid="morse-key", channel=CHANNEL)
    except Exception:
        pass
    e = espnow.ESPNow()
    peer = espnow.Peer(mac=BROADCAST, channel=CHANNEL)
    e.peers.append(peer)
    emit({"t": "hello", "role": "wired", "proto": 1, "mode": "wired"})

    while True:
        ev = keys.events.get()
        if ev is not None:
            tone(ev.pressed)
            # Wired path: straight to the laptop.
            emit({"t": "edge", "down": ev.pressed, "ms": now_ms()})
            # Wireless path: also radio it, harmless if no bridge is listening.
            pkt = struct.pack("<BBBBB", MAGIC, 0x01, 0x01, MSG_TYPE, 1 if ev.pressed else 0)
            try:
                e.send(pkt, peer)
            except Exception:
                pass
        time.sleep(0.001)
