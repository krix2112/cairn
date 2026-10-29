import json
import os
import sys
import pytest

# Ensure root directory is on sys.path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import data_source


@pytest.fixture(autouse=True)
def ensure_data_source_ready(monkeypatch):
    """
    Ensures tests have access to reference data even if network is restricted.
    Allows snapshot fallback during test runs.
    """
    monkeypatch.setenv("ALLOW_SNAPSHOT_FALLBACK", "1")

