import os
import unittest.mock as mock
import pytest
from fastapi.testclient import TestClient

from app.api import app

client = TestClient(app)

RESUME_PATH = "seed/resumes/rohan_verma.pdf" if os.path.exists("seed/resumes/rohan_verma.pdf") else "data/resumes/rohan_verma.pdf"
JD_PATH = "seed/jds/google_swe.pdf" if os.path.exists("seed/jds/google_swe.pdf") else "data/jds/google_swe.pdf"



def test_get_companies_113_sorted():
    res = client.get("/companies")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 113
    names = [c["name"].lower() for c in data]
    assert names == sorted(names), "Companies must be sorted alphabetically"


def test_get_samples_single_pair():
    res = client.get("/samples")
    assert res.status_code == 200
    data = res.json()
    assert "sample" in data
    assert data["sample"]["resume"] == "rohan_verma"
    assert data["sample"]["jd"] == "google_swe"


def test_analyze_rohan_and_google_swe_end_to_end():
    with open(RESUME_PATH, "rb") as rf, open(JD_PATH, "rb") as jf:
        files = {
            "resume": ("rohan_verma.pdf", rf, "application/pdf"),
            "jd_file": ("google_swe.pdf", jf, "application/pdf")
        }
        res = client.post("/analyze", files=files)

    assert res.status_code == 200, f"Analysis failed: {res.text}"
    body = res.json()

    # 1. Extraction
    assert "extract" in body
    assert body["extract"]["resume"]["skills_count"] >= 5
    assert body["extract"]["jd"]["skills_count"] >= 5

    # 2. Match
    assert "match" in body
    assert body["match"]["match_score"] > 0
    assert len(body["match"]["matched_skills"]) > 0

    # 3. Company Auto-Detection
    assert "company" in body
    assert body["company"]["company_id"] == 4  # Google ID is 4
    assert body["company"]["auto_detected"] is True
    assert "Google" in body["company"]["company"]

    # 4. Readiness
    assert "readiness" in body and body["readiness"] is not None
    assert body["readiness"]["readiness_score"] > 0
    assert len(body["readiness"]["waterfall"]) == 12
    assert len(body["readiness"]["next_best_skills"]) <= 5
    assert len(body["readiness"]["next_best_skills"]) > 0

    # 5. ATS
    assert "ats" in body
    assert body["ats"]["level"] in ("Low", "Medium")
    assert body["ats"]["level"] != "High"  # Sample resumes must not be High

    # 6. Socials
    assert "socials" in body
    assert isinstance(body["socials"], list)
    assert "github_username_detected" in body

    # 7. Timings
    assert "timings" in body
    t = body["timings"]
    for key in ("extract", "match", "company", "readiness", "ats", "socials", "total"):
        assert key in t, f"Missing timing key {key}"
        assert isinstance(t[key], (int, float))


def test_analyze_detects_github_username():
    with open(RESUME_PATH, "rb") as rf, open(JD_PATH, "rb") as jf:
        files = {
            "resume": ("rohan_verma.pdf", rf, "application/pdf"),
            "jd_file": ("google_swe.pdf", jf, "application/pdf")
        }
        data = {
            "github_username": "rohan_verma_gh"
        }
        res = client.post("/analyze", files=files, data=data)
    assert res.status_code == 200
    body = res.json()
    assert body["github_username_detected"] == "rohan_verma_gh"

    with open(RESUME_PATH, "rb") as rf:
        files = {
            "resume": ("rohan_verma.pdf", rf, "application/pdf")
        }
        data = {
            "jd_text": "Google — Software Engineer\nRequirements: Python, C++, Distributed Systems, Algorithms, Docker, SQL",
            "company_id": 4
        }
        res = client.post("/analyze", files=files, data=data)

    assert res.status_code == 200
    body = res.json()
    assert body["company"]["company_id"] == 4
    assert body["readiness"] is not None
    assert body["readiness"]["readiness_score"] > 0


def test_analyze_file_size_limit_4mb():
    oversized = b"x" * (4 * 1024 * 1024 + 1024)
    files = {
        "resume": ("oversized.pdf", oversized, "application/pdf")
    }
    data = {"jd_text": "Sample JD"}
    res = client.post("/analyze", files=files, data=data)
    assert res.status_code == 413
    assert "4 MB limit" in res.json()["detail"]


def test_analyze_unsupported_resume_type():
    with open(RESUME_PATH, "rb") as rf:
        files = {
            "resume": ("resume.png", rf.read()[:500], "image/png")
        }
        data = {"jd_text": "Sample JD"}
        res = client.post("/analyze", files=files, data=data)
    assert res.status_code == 415
    assert "Unsupported file format for resume" in res.json()["detail"]


def test_analyze_missing_jd():
    with open(RESUME_PATH, "rb") as rf:
        files = {
            "resume": ("rohan_verma.pdf", rf, "application/pdf")
        }
        res = client.post("/analyze", files=files)
    assert res.status_code == 422
    assert "Please provide a job description" in res.json()["detail"]


def test_analyze_fault_tolerance_section_isolation():
    """Verify that an exception in one section (e.g. ATS) isolates the error and never returns 500."""
    with open(RESUME_PATH, "rb") as rf, open(JD_PATH, "rb") as jf:
        files = {
            "resume": ("rohan_verma.pdf", rf, "application/pdf"),
            "jd_file": ("google_swe.pdf", jf, "application/pdf")
        }
        with mock.patch("app.api.ats_check", side_effect=RuntimeError("Simulated ATS crash")):
            res = client.post("/analyze", files=files)

    assert res.status_code == 200
    body = res.json()
    assert "error" in body["ats"]
    assert "Simulated ATS crash" in body["ats"]["error"]
    # Other sections should succeed normally
    assert "match_score" in body["match"]
    assert body["readiness"] is not None
    assert "total" in body["timings"]

