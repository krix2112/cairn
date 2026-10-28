import pytest
from app.insights import (
    get_all_companies,
    get_insights_fit,
    get_insights_roles,
    get_insights_waterfall,
    get_insights_band,
    post_insights_plan
)
from app import extract as X, profile as P

TEST_EMAIL = "rohan_verma@demo.local"

@pytest.fixture(scope="module", autouse=True)
def setup_test_candidate():
    # Ensure rohan_verma sample profile is parsed and saved
    res_data = X.extract("data/resumes/rohan_verma.pdf", "resume", "rohan_verma.pdf")
    prefill = P.from_resume(res_data)
    prefill["email"] = TEST_EMAIL
    P.save(prefill)

def test_company_loader_113():
    companies = get_all_companies()
    assert len(companies) == 113, f"Expected 113 companies, got {len(companies)}"
    for cid, data in companies.items():
        assert "name" in data and data["name"], f"Company {cid} missing name"
        assert len(data["required"]) == 12, f"Company {cid} does not have 12 skills"
        assert "bar" in data, f"Company {cid} missing mean bar"

def test_insights_fit_sorted_and_113():
    fit = get_insights_fit(TEST_EMAIL)
    assert fit["total_companies"] == 113
    entries = fit["entries"]
    assert len(entries) == 113
    
    # Assert sorted descending by score
    scores = [e["score"] for e in entries]
    assert scores == sorted(scores, reverse=True), "Fit entries must be sorted descending by score"

    # Assert categories
    for e in entries:
        assert e["category"] in ("Safe", "Target", "Reach")
        if e["score"] >= 75:
            assert e["category"] == "Safe"
        elif e["score"] >= 50:
            assert e["category"] == "Target"
        else:
            assert e["category"] == "Reach"
            
    assert 0 <= fit["percentile"] <= 100

def test_insights_waterfall_sum_equals_100_minus_score():
    for cid in [4, 24, 78]: # Google, Oracle FSS, Microsoft
        wf = get_insights_waterfall(TEST_EMAIL, cid)
        final_score = wf["final_score"]
        items = wf["items"]
        assert len(items) == 12
        
        sum_lost = sum(item["points_lost"] for item in items)
        expected_lost = 100 - final_score
        # Assert sum(loss) == 100 - score within rounding (0.5 pts)
        assert abs(sum_lost - expected_lost) < 1.0, f"Sum of loss {sum_lost} != 100 - score {expected_lost} for company {cid}"

def test_insights_band():
    for cid in [4, 24, 78]:
        band = get_insights_band(TEST_EMAIL, cid)
        assert band["pessimistic"] <= band["base"] <= band["optimistic"], f"Band not monotonic: {band}"

def test_insights_plan_monotonic_and_milestones():
    plan = post_insights_plan(TEST_EMAIL, company_id=4, hours_per_week=10, target_score=75)
    curve = plan["curve"]
    assert len(curve) > 1
    scores = [pt["score"] for pt in curve]
    # Assert monotonic non-decreasing
    for i in range(1, len(scores)):
        assert scores[i] >= scores[i - 1], f"Curve decreased from week {i-1} ({scores[i-1]}) to week {i} ({scores[i]})"
        
    milestones = plan["milestones"]
    assert len(milestones) > 0
    assert "headline" in plan
    assert "weeks_needed" in plan

def test_insights_roles_ranked():
    roles = get_insights_roles(TEST_EMAIL)
    assert len(roles) == 6
    scores = [r["match_score"] for r in roles]
    assert scores == sorted(scores, reverse=True), "Roles must be ranked descending by match score"
    for r in roles:
        assert "top_missing_skill" in r

def test_insights_fit_fresh_clone_113_entries():
    """Verify GET /insights/fit returns 113 companies from a fresh clone using data files directly."""
    import os
    import app.insights as ins
    from fastapi.testclient import TestClient
    from app.api import app

    # Ensure data files required for fresh clone exist
    csv_companies = "data/company_json_rows__1_.csv"
    csv_skills = "data/company_skill_levels_rows.csv"
    assert os.path.isfile(csv_companies), f"Missing {csv_companies} required for fresh clone"
    assert os.path.isfile(csv_skills), f"Missing {csv_skills} required for fresh clone"

    # Reset cache to simulate a cold start / fresh clone
    ins._COMPANY_CACHE = None

    client = TestClient(app)
    res = client.get(f"/insights/fit?email={TEST_EMAIL}")
    assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}: {res.text}"
    
    payload = res.json()
    assert payload.get("total_companies") == 113
    entries = payload.get("entries", [])
    assert len(entries) == 113, f"Expected exactly 113 companies, got {len(entries)}"
    
    # Ensure all entries have valid non-empty names and 12-skill derived bars
    for e in entries:
        assert e["company_id"] > 0
        assert e["name"] and not e["name"].startswith("Company "), f"Invalid company name {e['name']}"
        assert e["bar"] > 0
        assert 0 <= e["score"] <= 100

