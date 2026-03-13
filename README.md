# languages

Small Flask app + scripts for practicing vocabulary (Vietnamese, Spanish, Indonesian) and generating Anki-friendly data from spreadsheets.

## What’s Here

- `app.py`: single Flask server that serves all language pages and JSON vocab APIs.
- `templates/`: HTML pages for each language (and pronunciation pages).
- `static/`: shared JS/CSS used by the pages.
- `indonesian/`, `spanish/`, `vietnamese/`: source spreadsheets and helper scripts.
- `docs/`: design notes and plans.

## Run Locally

Prereqs: Python 3.11+

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 app.py
```

Open `http://localhost:5000`.

## Routes

Pages:

- `/` (home)
- `/bahasa`, `/bahasa/pronunciation`
- `/viet`, `/viet/pronunciation`
- `/spanish`, `/spanish/pronunciation`

APIs (JSON):

- `/api/vocab/bahasa`
- `/api/vocab/viet`
- `/api/vocab/spanish`

Note: vocab is loaded and cached at process startup; restart the server after changing spreadsheet files.

## Deployment (Render)

This repo includes `render.yaml` configured to:

- build: `pip install -r requirements.txt`
- start: `gunicorn app:app`

You can run the same command locally:

```bash
gunicorn app:app
```

## Data / Scripts

Each language folder contains its own scripts and (sometimes) its own `requirements.txt` for one-off generation tasks.
See:

- `indonesian/`
- `spanish/`
- `vietnamese/`

