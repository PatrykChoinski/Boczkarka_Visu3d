# -*- coding: utf-8 -*-
# Skrypt CODESYS (DIADesigner-AX, --runscript): figury automatu w PLC w trybie symulacji.
# Otwiera projekt PLC (bez zapisu), wlacza symulacje urzadzenia (w pamieci), login + start, potem dla kazdego
# przypadku z pliku VIZU_CASES: wpisuje zmienne, uruchamia FiguresGeometricSt (iFigureType + bFigureAddToCurrent),
# czeka na bFigureCalculated i czyta aFigure* / iFigureNumber. Wynik -> VIZU_RESULTS (JSON).
# Zmienne srodowiskowe: VIZU_PROJECT (sciezka .project), PROJECT_PASSWORD, VIZU_CASES, VIZU_RESULTS.
# Uruchamia scripts/compare-figures-plc.mjs --sim.
import os, io, json, time
import scriptengine as script_engine
from scriptengine import OnlineChangeOption

GVLS = ["HMI2", "HMI", "Global", "GVL", "Visualization", "VisuNew", "VisuVars", "Communication", "IOVars"]
OUT_COLS = ["aFigureXPosition", "aFigureYPosition", "aFigureIndex", "aFigureRadius", "aFigureAngle",
            "aFigureDepthStart", "aFigureDepthEnd", "aFigureLength"]
CLEAR_TO = 130          # zerowanie aFigure* [0..CLEAR_TO] przed kazda figura

cases = json.load(io.open(os.environ["VIZU_CASES"], encoding="utf-8"))
proj = script_engine.projects.open(os.environ["VIZU_PROJECT"], password=os.environ.get("PROJECT_PASSWORD", ""))
results = []
gvl_of = {}


def parse(v):
    s = ("%s" % v).strip()
    if "#" in s:
        s = s.split("#", 1)[1]
    if s in ("TRUE", "FALSE"):
        return s == "TRUE"
    try:
        x = float(s)
    except ValueError:
        return s
    return "NaN" if x != x else x      # NaN -> tekst (JSON)


try:
    proj.find("Device", True)[0].set_simulation_mode(True)
    oa = script_engine.online.create_online_application(proj.active_application)
    oa.login(OnlineChangeOption.Never, True)
    oa.start()
    time.sleep(2)

    def expr(name):
        base = name.split("[")[0]
        if base not in gvl_of:
            for g in GVLS:
                try:
                    oa.read_value("%s.%s" % (g, base) + ("[0]" if "[" in name else ""))
                    gvl_of[base] = g
                    break
                except Exception:
                    pass
            else:
                raise Exception("brak zmiennej %s" % base)
        return "%s.%s" % (gvl_of[base], name)

    def read(name):
        return parse(oa.read_value(expr(name)))

    def lit(kind, value):
        if kind == "bool":
            return "TRUE" if value else "FALSE"
        if kind == "int":
            return "%d" % int(round(value))
        return repr(float(value))

    def write(items):
        # items: [[nazwa, rodzaj, wartosc]] - jeden zapis na partie
        for name, kind, value in items:
            oa.set_prepared_value(expr(name), lit(kind, value))
        oa.write_prepared_values()

    def wait(name, pred, timeout=5.0):
        end = time.time() + timeout
        while time.time() < end:
            if pred(read(name)):
                return True
            time.sleep(0.02)
        return False

    # rozgrzewka: pierwsze przeliczenie figury po starcie aplikacji (wynik pomijany)
    write([["bFigureCalculated", "bool", False], ["iFigureType", "int", 10], ["bFigureAddToCurrent", "bool", True]])
    wait("bFigureCalculated", lambda v: v is True)
    write([["bFigureCalculated", "bool", False]])
    wait("iFigureType", lambda v: v == 0 or v == "FigureType.NONE", 2.0)

    for c in cases:
        r = {"id": c["id"], "case": c["case"]}
        try:
            write([["bFigureCalculated", "bool", False]])
            if not wait("iFigureType", lambda v: v == 0 or v == "FigureType.NONE", 2.0):
                write([["iFigureType", "int", 0]])
            write(c["writes"])
            clear = []
            for col in OUT_COLS:
                for i in range(CLEAR_TO + 1):
                    clear.append(["%s[%d]" % (col, i), "int" if col == "aFigureIndex" else "real", 0])
            clear.append(["iFigureNumber", "int", 0])
            write(clear)
            write([["iFigureType", "int", c["v"]], ["bFigureAddToCurrent", "bool", True]])
            if not wait("bFigureCalculated", lambda v: v is True):
                r["error"] = "timeout bFigureCalculated"
            # odczyt przez API skryptowe bywa buforowany - chwila na odswiezenie i drugi odczyt licznika
            time.sleep(0.3)
            read("iFigureNumber")
            time.sleep(0.1)
            n = int(read("iFigureNumber"))
            r["count"] = n
            r["rows"] = []
            for i in range(min(max(n, c.get("expectCount", 0)), 249) + 1):
                r["rows"].append([read("%s[%d]" % (col, i)) for col in OUT_COLS])
            r["modeMill"] = read("bModeMill")
            write([["bFigureCalculated", "bool", False]])
        except Exception as ex:
            r["error"] = "%s" % ex
        results.append(r)
    oa.logout()
finally:
    proj.close()      # bez zapisu
f = io.open(os.environ["VIZU_RESULTS"], "w", encoding="utf-8")
f.write(u"" + json.dumps(results))
f.close()
print("SIM DONE %d" % len(results))
