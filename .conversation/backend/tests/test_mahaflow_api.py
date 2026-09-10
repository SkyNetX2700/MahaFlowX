"""Regression coverage for MahaFlow integration status and retired preview APIs."""
import os

import pytest
import requests
from dotenv import load_dotenv


load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


@pytest.fixture
def api():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def test_setup_status(api):
    response = api.get(f"{BASE_URL}/api/setup-status", timeout=15)
    assert response.status_code == 200
    data = response.json()
    assert data["supabase_configured"] is True
    assert data["turnstile_configured"] is True
    assert data["maps_configured"] is True
    assert "message" in data


def test_legacy_access_code_api_is_retired(api):
    response = api.get(f"{BASE_URL}/api/access-codes", timeout=15)
    assert response.status_code == 410


def test_legacy_camera_api_is_retired(api):
    response = api.get(f"{BASE_URL}/api/cameras", timeout=15)
    assert response.status_code == 410


def test_legacy_crowd_api_is_retired(api):
    response = api.get(f"{BASE_URL}/api/crowd-readings", timeout=15)
    assert response.status_code == 410