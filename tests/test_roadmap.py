import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.roadmap import create_roadmap, load_roadmap_kb
from app.config import SKILLSET_MAP

client = TestClient(app)


def test_kb_loaded_accurately():
    """Verify all 12 areas exist in knowledge base with 3 level bands each."""
    kb = load_roadmap_kb()
    expected_areas = set(SKILLSET_MAP.values())
    assert set(kb.keys()) == expected_areas

    for area, bands in kb.items():
        assert "name" in bands
        for band_key in ("1-3", "4-6", "7-10"):
            assert band_key in bands, f"Missing band {band_key} in {area}"
            band = bands[band_key]
            assert "topics" in band and len(band["topics"]) >= 3
            assert "practice_tasks" in band and len(band["practice_tasks"]) == 3
            assert "proof_project" in band
            assert "resume_bullet" in band["proof_project"]
            # Verify no invented URLs in practice tasks or proof project
            assert "http://" not in str(band)
            assert "https://" not in str(band)


def test_projected_score_never_decreases():
    """Assert that projected_score is monotonically non-decreasing across all weeks."""
    # Candidate with multiple gaps
    cand_levels = {c: 2 for c in SKILLSET_MAP.values()}
    req_levels = {c: 8 for c in SKILLSET_MAP.values()}

    roadmap = create_roadmap(
        candidate_levels=cand_levels,
        required_levels=req_levels,
        hours_per_week=10,
        weeks=12
    )

    weeks = roadmap["weeks"]
    assert len(weeks) == 12

    prev_score = -1
    for w in weeks:
        curr_score = w["projected_score"]
        assert curr_score >= prev_score, f"Week {w['week']} score decreased: {curr_score} < {prev_score}"
        prev_score = curr_score


def test_total_hours_within_budget():
    """Assert that total scheduled hours never exceeds hours_per_week * weeks."""
    for hpw in (4, 8, 12, 20):
        for w_count in (6, 12, 16):
            roadmap = create_roadmap(
                candidate_levels={"COD": 2, "DSA": 3},
                required_levels={"COD": 8, "DSA": 8},
                hours_per_week=hpw,
                weeks=w_count
            )
            total_scheduled = sum(w["hours"] for w in roadmap["weeks"])
            assert total_scheduled <= hpw * w_count, f"Scheduled {total_scheduled} > {hpw * w_count}"


def test_every_task_has_an_area():
    """Assert that every task in every week has an explicit 'area' tag."""
    ats_findings = [
        {"title": "Hidden White Text", "fix": "Remove camouflage white text from resume."}
    ]
    warnings = ["Single-day bulk upload signal in repo 'mini-app'."]
    missing_jd = [
        {"skill": "Docker", "category_code": "CLOUD"},
        {"skill": "GraphQL", "category_code": "OTHER", "why_needed": "API queries"}
    ]

    roadmap = create_roadmap(
        candidate_levels={"COD": 3, "DSA": 4},
        required_levels={"COD": 8, "DSA": 8},
        ats_findings=ats_findings,
        provenance_warnings=warnings,
        missing_jd_skills=missing_jd,
        hours_per_week=8,
        weeks=12
    )

    for w in roadmap["weeks"]:
        assert len(w["tasks"]) > 0, f"Week {w['week']} has no tasks"
        for t in w["tasks"]:
            assert isinstance(t, dict), f"Task must be dict: {t}"
            assert "area" in t, f"Missing area in task: {t}"
            assert t["area"] in set(SKILLSET_MAP.values()), f"Invalid area {t['area']} in task: {t}"
            assert "task" in t and len(t["task"]) > 0

    # Verify Week 1 contains the resume fix
    w1_tasks = roadmap["weeks"][0]["tasks"]
    assert any(t.get("type") == "resume_fix" for t in w1_tasks)
    assert len(roadmap["resume_fixes"]) == 1

    # Verify GitHub hygiene task in Week 2
    w2_tasks = roadmap["weeks"][1]["tasks"]
    assert any(t.get("type") == "github_fix" for t in w2_tasks)
    assert len(roadmap["github_fixes"]) == 1

    # Verify also_learn contains unmapped skills
    assert len(roadmap["also_learn"]) == 1
    assert roadmap["also_learn"][0]["skill"] == "GraphQL"

    # Verify assumptions state hours are planning estimates
    assert any("planning estimates" in a.lower() for a in roadmap["assumptions"])


def test_no_gap_input_returns_maintenance_plan():
    """A candidate who meets or exceeds all required levels receives a maintenance plan."""
    # Candidate meets or exceeds all requirements
    cand_levels = {c: 9 for c in SKILLSET_MAP.values()}
    req_levels = {c: 8 for c in SKILLSET_MAP.values()}

    roadmap = create_roadmap(
        candidate_levels=cand_levels,
        required_levels=req_levels,
        hours_per_week=8,
        weeks=12
    )

    assert "maintenance" in roadmap["summary"].lower()
    assert len(roadmap["weeks"]) == 12

    # In maintenance, score remains steady and non-decreasing
    for w in roadmap["weeks"]:
        assert w["projected_score"] == 100
        assert len(w["tasks"]) > 0
        for t in w["tasks"]:
            assert "area" in t


def test_post_roadmap_endpoint():
    """Test POST /roadmap HTTP endpoint."""
    payload = {
        "readiness_gaps": [
            {"category_code": "COD", "candidate_level": 3, "required_level": 8, "gap": 5},
            {"category_code": "DSA", "candidate_level": 4, "required_level": 8, "gap": 4}
        ],
        "company_id": 4,
        "hours_per_week": 8,
        "weeks": 12,
        "ats_findings": [
            {"title": "Missing Projects", "fix": "Add detailed Projects section."}
        ],
        "provenance_warnings": [
            "Repository lacks README and tests."
        ],
        "missing_jd_skills": [
            {"skill": "Terraform", "category_code": "CLOUD"},
            {"skill": "Salesforce", "category_code": "OTHER"}
        ]
    }

    res = client.post("/roadmap", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "summary" in data
    assert "weeks" in data
    assert len(data["weeks"]) == 12
    assert "resume_fixes" in data
    assert "github_fixes" in data
    assert "also_learn" in data
    assert len(data["also_learn"]) == 1
    assert data["also_learn"][0]["skill"] == "Salesforce"
    assert "assumptions" in data

