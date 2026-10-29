import os
import pytest
from app.insights import (

    get_all_companies,
    get_sorted_companies_list,
    find_matching_company,
    compute_waterfall,
    compute_next_best_skills
)
from app.talent_check import candidate_levels
from app import extract as X

RESUME_PATH = "seed/resumes/rohan_verma.pdf" if os.path.exists("seed/resumes/rohan_verma.pdf") else "data/resumes/rohan_verma.pdf"


@pytest.fixture(scope="module")
def rohan_levels():
    res_data = X.extract(RESUME_PATH, "resume", "rohan_verma.pdf", use_cache=True)
    return candidate_levels(res_data.get("skills", []))


def test_company_loader_113():
    companies = get_all_companies()
    assert len(companies) == 113, f"Expected 113 companies, got {len(companies)}"
    for cid, data in companies.items():
        assert "name" in data and data["name"], f"Company {cid} missing name"
        assert len(data["required"]) == 12, f"Company {cid} does not have 12 skills"
        assert "bar" in data, f"Company {cid} missing mean bar"


def test_sorted_companies_list_113():
    sorted_comps = get_sorted_companies_list()
    assert len(sorted_comps) == 113
    names = [c["name"].lower() for c in sorted_comps]
    assert names == sorted(names), "Companies must be sorted alphabetically"


def test_fuzzy_matching_rapidfuzz_88():
    # Google match
    cid, name, matched = find_matching_company("Google", threshold=88)
    assert matched is True
    assert cid == 4
    assert "Google" in name

    # Google SWE extracted string
    cid, name, matched = find_matching_company("Google LLC", threshold=88)
    assert matched is True
    assert cid == 4
    assert cid == 4

    # Microsoft
    cid, name, matched = find_matching_company("Microsoft Corporation", threshold=88)
    assert matched is True
    assert cid == 78

    # Unknown company
    cid, name, matched = find_matching_company("Completely Unknown XYZ Nonexistent 999", threshold=88)
    assert matched is False
    assert cid is None


def test_insights_waterfall_sum_equals_100_minus_score(rohan_levels):
    for cid in [4, 24, 78]:  # Google, Oracle FSS, Microsoft
        wf = compute_waterfall(rohan_levels, cid)
        final_score = wf["final_score"]
        items = wf["items"]
        assert len(items) == 12

        sum_lost = sum(item["points_lost"] for item in items)
        expected_lost = 100 - final_score
        assert abs(sum_lost - expected_lost) < 1.0, f"Sum of loss {sum_lost} != 100 - score {expected_lost} for company {cid}"


def test_next_best_skills_top_5(rohan_levels):
    for cid in [4, 24, 78]:
        next_best = compute_next_best_skills(rohan_levels, cid, top_n=5)
        assert len(next_best) <= 5
        assert len(next_best) > 0
        for item in next_best:
            assert "category_code" in item
            assert "points_gain_per_level" in item
            assert "hours_needed" in item
            assert "recommendation" in item
            assert item["gap"] > 0
