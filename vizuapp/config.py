"""Konfiguracja: config.json obok VizuApp.exe (albo --config)."""
import json
import os
import sys

# Zmienne PLC (symbol config, jak w HMI): klucz w aplikacji -> "GVL.zmienna".
# Pozycje osi i parametry sa wymagane, reszta opcjonalna (brak = nie pokazywane).
VARIABLES = {
    "x": "HMI2.fXActualPosition",
    "y": "HMI2.fYActualPosition",
    "z": "HMI2.fZActualPosition",
    "a": "HMI2.fAActualPosition",
    "b": "HMI2.fBActualPosition",
    "disc_diameter": "HMI.fParameterDiscDiameter",
    "blade_width": "HMI.fParameterBladeWidth",
    "cut_tilt_diameter": "HMI.fParameterCutTiltDiameter",
    "head_rotation_diameter": "HMI.fParameterHeadRotationDiameter",
    "material_height": "HMI.fCutMaterialHeight",
    "material_thickness": "HMI.fParameterMaterialThickness",
    "cut_step": "HMI2.CutStep",
    "cut_start": "HMI2.bCutStart",
    "saw_running": "Communication.bMainDriveRunning",
    "water_cut": "IOVars.yWaterCut",
}
REQUIRED = ("x", "y", "z", "a", "b", "disc_diameter", "material_height")

# CutStepType (PLC) - do paska stanu
CUT_STEPS = {
    0: "WaitForStart", 1: "ResetInputs", 2: "CheckPopup", 3: "PrepareToStart",
    10: "MoveToStartPosition", 11: "DoneMoveToStartPosition", 12: "MoveToBasePosition",
    13: "DoneMoveToBasePosition", 20: "StartCutDepth", 21: "DoneCutDepth", 22: "CutDepthPrepare",
    30: "StartManualPass", 31: "DoneManualPass", 50: "StartSingleCut", 51: "WaitForSetVelocity",
    52: "DoneSetVelocity", 56: "StartCutOvertaking", 59: "SingleCutDone", 60: "StartLastCut",
    61: "DoneLastCut", 70: "StartMoveAboveMaterial", 71: "DoneMoveAboveMaterial", 80: "CutStop",
    81: "CutStopReset", 90: "CutPause", 91: "CutResume", 100: "CutFinish",
}

DEFAULTS = {
    # serwer OPC UA sterownika (CODESYS) - na maszynie localhost
    "endpoint": "opc.tcp://localhost:4840",
    "username": "",
    "password": "",
    # np. "ns=4;s=|var|AX-8.Application." - puste = szukanie wezlow w drzewie OPC UA
    "node_prefix": "",
    "poll_ms": 50,
    "variables": {},              # nadpisanie VARIABLES, np. {"material_height": "HMI.fParameterZMaterialHeight"}
    "auto_clear_on_start": True,  # nowe ciecie (bCutStart) czysci poprzednie
    "material_margin": 300.0,     # mm materialu wokol ciec
    "material_min_size": [1200.0, 800.0],
    "fullscreen": False,
}


def app_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path=None):
    cfg = dict(DEFAULTS)
    path = path or os.path.join(app_dir(), "config.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            cfg.update(json.load(f))
    variables = dict(VARIABLES)
    variables.update(cfg.get("variables") or {})
    cfg["variables"] = variables
    return cfg
