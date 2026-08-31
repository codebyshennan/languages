#!/usr/bin/env python3
"""
app.py  —  Language Anki monorepo
==================================
Serves all 3 language apps from one Flask instance.
Run:  python3 app.py
"""

import io
from collections import OrderedDict
from pathlib import Path

import openpyxl
from flask import Flask, abort, jsonify, render_template, request, send_file
from gtts import gTTS
from gtts.tts import gTTSError

BASE = Path(__file__).parent
app = Flask(__name__)
MAX_TTS_CHARS = 120
MAX_TTS_CACHE_ITEMS = 128

# ── Vocab loaders ─────────────────────────────────────────────────────────────


def _safe_card_num(raw_num):
    try:
        if raw_num is not None and str(raw_num).strip() != "":
            return int(raw_num)
    except (TypeError, ValueError):
        pass
    return None


def _ensure_unique_card_nums(cards, language):
    seen = set()
    existing_nums = [card["num"] for card in cards if isinstance(card["num"], int)]
    next_num = max(existing_nums, default=0) + 1
    repairs = 0
    for card in cards:
        if not isinstance(card["num"], int) or card["num"] in seen:
            while next_num in seen:
                next_num += 1
            card["num"] = next_num
            next_num += 1
            repairs += 1
        seen.add(card["num"])
    if repairs:
        print(f"WARNING: repaired {repairs} missing/duplicate {language} card numbers")
    return cards


def _load_bahasa():
    src = BASE / "indonesian" / "Bahasa_Indonesia_Melayu_2000_Words_FINAL.xlsx"
    xlsm = BASE / "indonesian" / "Bahasa_Vocab.xlsm"
    src = xlsm if xlsm.exists() else src
    print(f"Loading Bahasa vocab from {src}…")

    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    if "SRS_Data" in wb.sheetnames:
        ws = wb["SRS_Data"]
        cards = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row[0]:
                continue
            cards.append(
                {
                    "num": _safe_card_num(row[0]),
                    "indo": str(row[1] or ""),
                    "malay": str(row[2] or ""),
                    "english": str(row[3] or ""),
                    "cat": str(row[4] or "General"),
                    "contoh": str(row[5] or ""),
                    "eng_ex": str(row[6] or ""),
                }
            )
    else:
        sheet_name = "Vocab" if "Vocab" in wb.sheetnames else wb.sheetnames[-1]
        ws = wb[sheet_name]
        cards = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            row = (list(row) + [""] * 8)[:8]
            num, cat, eng, indo, malay, contoh_id, _, eng_ex = row
            if not eng:
                continue
            cards.append(
                {
                    "num": _safe_card_num(num),
                    "indo": str(indo or ""),
                    "malay": str(malay or ""),
                    "english": str(eng or ""),
                    "cat": str(cat or "General"),
                    "contoh": str(contoh_id or ""),
                    "eng_ex": str(eng_ex or ""),
                }
            )
    wb.close()
    cards = _ensure_unique_card_nums(cards, "Bahasa")
    print(f"  Loaded {len(cards)} Bahasa cards")
    return cards


def _load_viet():
    src = BASE / "vietnamese" / "viet_vocab_COMPLETE_3000words.xlsx"
    if not src.exists():
        src = BASE / "vietnamese" / "viet_vocab_COMPLETE_1962words.xlsx"
        print("WARNING: 3000-word file not found, falling back to 1962-word file")
    print(f"Loading Viet vocab from {src}…")
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb["📚 All Words (Combined)"]
    cards = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        num, part, viet, english, hanzi, cantonese, cat, notes = (list(row) + [""] * 8)[
            :8
        ]
        if not viet:
            continue
        cards.append(
            {
                "num": _safe_card_num(num),
                "part": str(part or ""),
                "viet": str(viet or ""),
                "english": str(english or ""),
                "hanzi": str(hanzi or ""),
                "cantonese": str(cantonese or ""),
                "cat": str(cat or "General"),
                "notes": str(notes or ""),
            }
        )
    wb.close()
    cards = _ensure_unique_card_nums(cards, "Viet")
    print(f"  Loaded {len(cards)} Viet cards")
    return cards


def _load_spanish():
    src = BASE / "spanish" / "spanish_vocab_3000words.xlsx"
    if not src.exists():
        print(f"WARNING: {src} not found — Spanish will return empty vocab")
        return []
    print(f"Loading Spanish vocab from {src}…")
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb.active
    cards = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        row = (list(row) + [""] * 8)[:8]
        num, cat, english, spanish, gender, notes, example_es, example_en = row
        if not spanish:
            continue
        cards.append(
            {
                "num": _safe_card_num(num),
                "cat": str(cat or "General"),
                "english": str(english or ""),
                "spanish": str(spanish or ""),
                "gender": str(gender or "-"),
                "notes": str(notes or ""),
                "example_es": str(example_es or ""),
                "example_en": str(example_en or ""),
            }
        )
    wb.close()
    cards = _ensure_unique_card_nums(cards, "Spanish")
    print(f"  Loaded {len(cards)} Spanish cards")
    return cards


# ── Cache vocab at startup ────────────────────────────────────────────────────
BAHASA_CARDS = _load_bahasa()
VIET_CARDS = _load_viet()
SPANISH_CARDS = _load_spanish()

# Bounded in-memory TTS cache: (word, lang) → MP3 bytes
_tts_cache: OrderedDict = OrderedDict()

# Allowed gTTS language codes
_ALLOWED_LANGS = {"vi", "id", "es"}


# ── Vocab API routes ──────────────────────────────────────────────────────────
@app.route("/api/vocab/bahasa")
def api_bahasa():
    return jsonify(BAHASA_CARDS)


@app.route("/api/vocab/viet")
def api_viet():
    return jsonify(VIET_CARDS)


@app.route("/api/vocab/spanish")
def api_spanish():
    return jsonify(SPANISH_CARDS)


# ── TTS API route ─────────────────────────────────────────────────────────────
@app.route("/api/tts")
def api_tts():
    word = request.args.get("word", "").strip()
    lang = request.args.get("lang", "vi").strip()

    if not word:
        abort(400, "Missing ?word= parameter")
    if len(word) > MAX_TTS_CHARS:
        abort(413, f"?word= must be {MAX_TTS_CHARS} characters or fewer")
    if lang not in _ALLOWED_LANGS:
        abort(400, f"?lang= must be one of: {', '.join(sorted(_ALLOWED_LANGS))}")

    cache_key = (word, lang)
    if cache_key not in _tts_cache:
        buf = io.BytesIO()
        try:
            gTTS(text=word, lang=lang, timeout=5).write_to_fp(buf)
        except (gTTSError, TimeoutError, OSError):
            abort(502, "Could not generate speech audio")
        buf.seek(0)
        _tts_cache[cache_key] = buf.read()
        while len(_tts_cache) > MAX_TTS_CACHE_ITEMS:
            _tts_cache.popitem(last=False)
    else:
        _tts_cache.move_to_end(cache_key)

    return send_file(
        io.BytesIO(_tts_cache[cache_key]),
        mimetype="audio/mpeg",
        as_attachment=False,
    )


# ── Page routes ───────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/bahasa")
def bahasa():
    return render_template("bahasa.html")


@app.route("/viet")
def viet():
    return render_template("viet.html")


@app.route("/spanish")
def spanish():
    return render_template("spanish.html")


@app.route("/viet/pronunciation")
def viet_pronunciation():
    return render_template("viet_pronunciation.html")


@app.route("/viet/typing")
def viet_typing():
    return render_template("viet_typing.html")


@app.route("/viet/tones")
def viet_tones():
    return render_template("viet_tones.html")


@app.route("/spanish/pronunciation")
def spanish_pronunciation():
    return render_template("spanish_pronunciation.html")


@app.route("/bahasa/pronunciation")
def bahasa_pronunciation():
    return render_template("bahasa_pronunciation.html")


@app.route("/viet/numbers")
def viet_numbers():
    return render_template("viet_numbers.html")


@app.route("/bahasa/numbers")
def bahasa_numbers():
    return render_template("bahasa_numbers.html")


@app.route("/spanish/numbers")
def spanish_numbers():
    return render_template("spanish_numbers.html")


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
