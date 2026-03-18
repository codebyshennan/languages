import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import app as flask_app
import pytest

@pytest.fixture
def client():
    flask_app.app.config['TESTING'] = True
    with flask_app.app.test_client() as c:
        yield c

def test_viet_typing_route_exists(client):
    resp = client.get('/viet/typing')
    assert resp.status_code == 200

def test_viet_typing_returns_html(client):
    resp = client.get('/viet/typing')
    assert b'<!DOCTYPE html>' in resp.data or b'<html' in resp.data

def test_viet_numbers_route_exists(client):
    resp = client.get('/viet/numbers')
    assert resp.status_code == 200

def test_bahasa_numbers_route_exists(client):
    resp = client.get('/bahasa/numbers')
    assert resp.status_code == 200

def test_spanish_numbers_route_exists(client):
    resp = client.get('/spanish/numbers')
    assert resp.status_code == 200
