#!/usr/bin/env python3
"""
bahasa_anki.py  —  Bahasa Indonesia / Melayu Spaced-Repetition Web App
=======================================================================
Run:  python3 bahasa_anki.py
Then open:  http://localhost:5000
"""

from pathlib import Path
from flask import Flask, jsonify
import openpyxl

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE          = Path(__file__).parent
XLSM          = BASE / "Bahasa_Vocab.xlsm"
XLSX          = BASE / "Bahasa_Indonesia_Melayu_2000_Words_FINAL.xlsx"
SRC           = XLSM if XLSM.exists() else XLSX

TEMPLATE = BASE.parent / "templates" / "bahasa.html"

app = Flask(__name__)

# ── Load vocab ────────────────────────────────────────────────────────────────
def load_vocab():
    print(f"Loading vocab from {SRC}…")
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)

    if "SRS_Data" in wb.sheetnames:
        ws = wb["SRS_Data"]
        cards = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row[0]:
                continue
            cards.append({
                "num":     int(row[0]),
                "indo":    str(row[1] or ""),
                "malay":   str(row[2] or ""),
                "english": str(row[3] or ""),
                "cat":     str(row[4] or "General"),
                "contoh":  str(row[5] or ""),
                "eng_ex":  str(row[6] or ""),
            })
    else:
        sheet_name = "Vocab" if "Vocab" in wb.sheetnames else "Top 2000 Words"
        if sheet_name not in wb.sheetnames:
            sheet_name = wb.sheetnames[-1]
        ws = wb[sheet_name]
        cards = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            row = list(row)[:8]
            if len(row) < 4 or not row[0]:
                continue
            num, cat, eng, indo, malay, contoh_id, contoh_ml, eng_ex = (row + [""] * 8)[:8]
            if not eng:
                continue
            cards.append({
                "num":     int(num) if num else 0,
                "indo":    str(indo or ""),
                "malay":   str(malay or ""),
                "english": str(eng or ""),
                "cat":     str(cat or "General"),
                "contoh":  str(contoh_id or ""),
                "eng_ex":  str(eng_ex or ""),
            })

    wb.close()
    print(f"  Loaded {len(cards)} cards")
    return cards


# ── Cache vocab at startup ────────────────────────────────────────────────────
ALL_CARDS = load_vocab()

# ── API Routes ────────────────────────────────────────────────────────────────
@app.route("/api/vocab/bahasa")
def api_vocab():
    return jsonify(ALL_CARDS)

# ── Serve the SPA ─────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return TEMPLATE.read_text()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
