#!/usr/bin/env python3
"""
viet_anki.py  —  Vietnamese Spaced-Repetition Web App
======================================================
Run:  python3 viet_anki.py
Then open:  http://localhost:5002
"""

from pathlib import Path
from flask import Flask, jsonify
import openpyxl

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE = Path(__file__).parent
SRC  = BASE / "viet_vocab_COMPLETE_1962words.xlsx"

TEMPLATE      = BASE.parent / "templates" / "viet.html"
PRON_TEMPLATE = BASE.parent / "templates" / "viet_pronunciation.html"

app = Flask(__name__, static_folder=str(BASE.parent / "static"), static_url_path="/static")

# ── Load vocab ────────────────────────────────────────────────────────────────
def load_vocab():
    print(f"Loading vocab from {SRC}…")
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb["📚 All Words (Combined)"]
    cards = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        num, part, viet, english, hanzi, cantonese, cat, notes = (list(row) + [""] * 8)[:8]
        if not viet:
            continue
        cards.append({
            "num":       int(num),
            "part":      str(part or ""),
            "viet":      str(viet or ""),
            "english":   str(english or ""),
            "hanzi":     str(hanzi or ""),
            "cantonese": str(cantonese or ""),
            "cat":       str(cat or "General"),
            "notes":     str(notes or ""),
        })
    wb.close()
    print(f"  Loaded {len(cards)} cards")
    return cards

# ── Cache at startup ──────────────────────────────────────────────────────────
ALL_CARDS = load_vocab()

# ── API ───────────────────────────────────────────────────────────────────────
@app.route("/api/vocab/viet")
def api_vocab():
    return jsonify(ALL_CARDS)

# ── SPA ───────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return TEMPLATE.read_text()

@app.route("/pronunciation")
def pronunciation():
    return PRON_TEMPLATE.read_text()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
