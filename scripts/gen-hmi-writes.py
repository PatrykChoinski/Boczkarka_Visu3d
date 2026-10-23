# -*- coding: utf-8 -*-
"""Zmienne PLC zapisywane przez ekrany HMI (biala lista sterowania z Visu3D w trybie PLC): z projektu DIAScreen
(HMI/PilaJednosuportowaINNER.dpa) przez HMI/scripts/dpa.py.

    python scripts/gen-hmi-writes.py [--dpa ../HMI/PilaJednosuportowaINNER.dpa] [--out src/server/hmiwrites.json]

Wynik (JSON): {source, write: {"GVL.zmienna": {level, kinds, screens}}, read: [...]}. level - najnizszy poziom ekranu,
ktory zapisuje zmienna (ekrany pracy - Operator 1, serwisowe - Serwis 2); kinds - rodzaje elementow (entry - pole
liczbowe, combo - lista, przyciski wg SubType: seton, setoff, mom - chwilowy, maint - przelacznik, mstate, setc, inc,
dec); read - zmienne czytane przez elementy HMI (wartosci, widocznosc, blokady). Zmienne pamieci panelu ($...) pomijane.
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "HMI", "scripts"))
import dpa  # noqa: E402

# Ekrany pomijane: menu panelu (Visu3D ma wlasne), tla, demo, smietnik, inne rozdzielczosci
SKIP = {2, 209, 210, 211, 502, 503, 999, 1100}
# Ekrany serwisowe (poziom Serwis) - tak jak przycisk "serwis" w HMI (poziom 5) i ekrany z niego otwierane
SERVICE = {46, 66, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 90, 91, 126, 127}

KIND = {
    "10.6": "text", "10.2": "rect", "5.1": "disp", "5.2": "disp", "6.1": "entry", "2.1": "multi", "3.1": "bar", "19.1": "combo",
    "1.10": "goto",
}
# Przyciski (Type 1): rodzaj wg SubType (nazwy elementow bywaja zmienione - "Set_000" moze byc przelacznikiem)
BUTTON = {"1": "seton", "2": "setoff", "3": "mom", "4": "maint", "5": "mstate", "7": "setc", "8": "inc", "9": "dec",
          "10": "goto", "11": "back"}


def var(v):
    v = (v or "").strip()
    m = re.match(r"^\{[^}]*\}\d+@Application\.(.+)$", v)
    return m.group(1) if m else None


def color(c):
    try:
        c = int(c)
    except (TypeError, ValueError):
        return None
    return "#%02x%02x%02x" % (c & 255, (c >> 8) & 255, (c >> 16) & 255)


def num(v, default=None):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def kind_of(el, typ):
    if typ in KIND:
        return KIND[typ]
    t, sub = typ.split(".")
    if t == "1":
        return BUTTON.get(sub, "btn")
    return None


def state_of(el, s, e):
    blk = el.blk[s:e]
    g = lambda k: dpa.get_key(blk, k)
    fill = color(g("FgColor")) if g("FillStyle") == "1" else None
    return {"v": num(g("Value"), 0), "tx": dpa.wide_texts(blk, rb"wTextLen").get("0", "").replace("\r\n", "\n").strip(),
            "fill": fill, "fc": color(g("FontColor")), "fs": int(num(g("FontSize0"), 14))}


def element(el):
    h = el.head
    g = lambda k: dpa.get_key(h, k)
    typ = "%s.%s" % (g("Type"), g("SubType"))
    k = kind_of(el, typ)
    if not k:
        return None
    out = {"t": k, "x": int(num(g("X"), 0)), "y": int(num(g("Y"), 0)), "w": int(num(g("Width"), 0)), "h": int(num(g("Height"), 0))}
    states = [state_of(el, s, e) for s, e in el.states()]
    # teksty / kolory: dla wiekszosci elementow wystarcza 2 stany (wylaczony / wlaczony); multi i combo - wszystkie
    out["s"] = states if k in ("multi", "combo", "mstate") else states[:2]
    r, w = var(g("ReadVar")), var(g("WriteVar"))
    if r:
        out["r"] = r
    if w:
        out["wv"] = w
    elif g("WriteVar") and k not in ("goto",):
        return None if k in ("mom", "maint", "seton", "setoff", "setc", "mstate", "inc", "dec", "entry", "combo") else out
    vis = var(g("VisibleVar"))
    if vis:
        out["vis"] = [vis, int(num(g("VisibleCondition"), 1))]
    lock = var(g("InterLockVar"))
    if lock:
        # przycisk aktywny, gdy zmienna blokady == InterLockLevel (np. obrot glowicy tylko gdy NIE bStatusWork)
        out["lock"] = [lock, int(num(g("InterLockLevel"), 1))]
    if k == "entry" or k == "disp":
        out["dec"] = int(num(g("DotNum"), 0))
        gain = num(g("GainValue"), 1.0)
        if gain != 1.0:
            out["gain"] = gain
        if k == "entry":
            out["min"] = num(g("MinValue"))
            out["max"] = num(g("MaxValue"))
    if k == "bar":
        out["min"] = num(g("MinValue"), 0)
        out["max"] = num(g("MaxValue"), 100)
    if k == "goto":
        out["go"] = int(num(g("GoToScreenID"), -1))
    if k == "setc":
        out["val"] = num(g("SetValue"), 0)
    if k in ("inc", "dec"):
        out["step"] = num(g("StepValue"), 1)
        out["min"] = num(g("MinValue"))
        out["max"] = num(g("MaxValue"))
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dpa", default=os.path.join(ROOT, "HMI", "PilaJednosuportowaINNER.dpa"))
    p.add_argument("--out", default=os.path.join(HERE, "..", "src", "server", "hmiwrites.json"))
    a = p.parse_args()
    d = dpa.Dpa(a.dpa)
    write, read = {}, set()
    for s in d.screens():
        if s.id in SKIP:
            continue
        level = 2 if s.id in SERVICE else 1
        for e in (element(el) for el in s.elements()):
            if not e:
                continue
            for v in (e.get("r"), e.get("vis", [None])[0], e.get("lock", [None])[0]):
                if v:
                    read.add(v)
            v = e.get("wv")
            if not v:
                continue
            w = write.setdefault(v, {"level": level, "kinds": [], "screens": []})
            w["level"] = min(w["level"], level)
            if e["t"] not in w["kinds"]:
                w["kinds"].append(e["t"])
            if s.id not in w["screens"]:
                w["screens"].append(s.id)
    out = {"source": os.path.basename(a.dpa), "write": dict(sorted(write.items())), "read": sorted(read)}
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    print("%d zmiennych zapisu, %d odczytu -> %s" % (len(write), len(read), a.out))


if __name__ == "__main__":
    main()
