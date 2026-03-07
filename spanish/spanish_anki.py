#!/usr/bin/env python3
"""
spanish_anki.py  —  Spanish Spaced-Repetition Web App
======================================================
Run:  python3 spanish_anki.py
Then open:  http://localhost:5000
"""

from pathlib import Path
from flask import Flask, jsonify
import openpyxl

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE = Path(__file__).parent
SRC  = BASE / "spanish_vocab_3000words.xlsx"

TEMPLATE = BASE.parent / "templates" / "spanish.html"

app = Flask(__name__)

# ── Load vocab ─────────────────────────────────────────────────────────────────
def load_vocab():
    print(f"Loading vocab from {SRC}…")
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb.active
    cards = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        num, cat, english, spanish, gender, notes, example_es, example_en, spanish_mx = (list(row) + [""] * 9)[:9]
        if not spanish:
            continue
        cards.append({
            "num":        int(num) if num else 0,
            "cat":        str(cat     or "General"),
            "english":    str(english or ""),
            "spanish":    str(spanish or ""),
            "gender":     str(gender  or "-"),
            "notes":      str(notes   or ""),
            "example_es": str(example_es or ""),
            "example_en": str(example_en or ""),
            "spanish_mx": str(spanish_mx or ""),
        })
    wb.close()
    print(f"  Loaded {len(cards)} cards")
    return cards

ALL_CARDS = load_vocab()

# ── API ────────────────────────────────────────────────────────────────────────
@app.route("/api/vocab/spanish")
def api_vocab():
    return jsonify(ALL_CARDS)

@app.route("/")
def index():
    return TEMPLATE.read_text()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
