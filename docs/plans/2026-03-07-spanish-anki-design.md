# Spanish Anki App Design

## Goal
Build a Spanish spaced-repetition flashcard web app identical in architecture to bahasa_anki.py and viet_anki.py, with a 3000-word vocab file generated via Claude API.

## Vocab Data
- **Script:** `spanish/build_vocab.py`
- **Source:** `wordfreq` top 3000 Spanish words by frequency
- **Generation:** Claude API (Haiku) in batches to fill all columns
- **Output:** `spanish/spanish_vocab_3000words.xlsx`
- **Columns:** `num, cat, english, spanish, gender (m/f/-), notes, example_es, example_en`
- Run once locally; xlsx committed to git

## App Architecture
- **File:** `spanish/spanish_anki.py`
- Single-file Flask app serving embedded SPA
- `GET /api/vocab` — returns all cards as JSON
- `GET /` — serves HTML SPA
- SM-2 algorithm in browser JS
- Progress stored in `localStorage` key: `spanish_progress`
- TTS: Web Speech API — `es-ES` for Spanish, `en-US` for English
- Two card modes: ES→EN and EN→ES
- Category filter dropdown
- Stats modal (overview + per-category breakdown)
- Keyboard shortcuts: Space, 1-4, P, Enter, Escape

## UI Theme
- Spanish flag inspired: red `#C60B1E` + gold `#FFC400`
- Distinct from Bahasa (navy/blue) and Vietnamese (dark red/gold)

## Deployment
- `spanish/requirements.txt`: flask, openpyxl, gunicorn, wordfreq, anthropic
- `spanish/render.yaml`: Render free-tier web service, root `spanish`, start `gunicorn spanish_anki:app`
