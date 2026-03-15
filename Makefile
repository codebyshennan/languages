.PHONY: start gunicorn

start:
	python3 app.py

gunicorn:
	gunicorn app:app
