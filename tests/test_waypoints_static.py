import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api import app

client = TestClient(app)

WAYPOINT_CODES = [
    "OS", "NETW", "COD", "DSA", "OOD", "SQL",
    "SWE", "CLOUD", "SYSD", "AI", "APTI", "COMM"
]

STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "static"))
WAYPOINTS_DIR = os.path.join(STATIC_DIR, "waypoints")


def test_waypoint_files_exist_and_export_mount():
    """Assert all 12 waypoint scene files exist on disk, are under 60 KB, and export mount."""
    assert os.path.isdir(WAYPOINTS_DIR), f"Waypoints directory not found at {WAYPOINTS_DIR}"

    for code in WAYPOINT_CODES:
        filename = f"{code.lower()}.js"
        filepath = os.path.join(WAYPOINTS_DIR, filename)

        assert os.path.isfile(filepath), f"Missing waypoint file: {filename}"

        file_size_kb = os.path.getsize(filepath) / 1024.0
        assert file_size_kb < 60.0, f"Waypoint {filename} exceeds 60 KB limit ({file_size_kb:.1f} KB)"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "mount" in content, f"Waypoint {filename} does not reference mount function"
        assert (
            "export function mount" in content
            or "export default mount" in content
            or "export { mount }" in content
        ), f"Waypoint {filename} does not export mount"
        assert f"window.WAYPOINT_SCENES.{code}" in content, (
            f"Waypoint {filename} does not register to window.WAYPOINT_SCENES.{code}"
        )


def test_waypoint_files_served_http_200():
    """Assert all 12 waypoint scene files are served over HTTP with status 200 and javascript content type."""
    for code in WAYPOINT_CODES:
        url = f"/waypoints/{code.lower()}.js"
        response = client.get(url)

        assert response.status_code == 200, f"GET {url} failed with status {response.status_code}"
        assert "javascript" in response.headers.get("content-type", "").lower(), (
            f"GET {url} has non-javascript content type: {response.headers.get('content-type')}"
        )
        assert len(response.content) > 1000, f"GET {url} returned unexpectedly small content"
