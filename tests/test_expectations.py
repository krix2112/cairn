import glob
import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import extract as X, profile as P
from app.talent_check import talent_check
from app.skill_match import match

@pytest.fixture(scope="module")
def env_setup():
    profs = {}
    resume_glob = sorted(glob.glob("seed/resumes/*.pdf")) or sorted(glob.glob("data/resumes/*.pdf"))
    for f in resume_glob:
        r = X.extract(f, "resume", os.path.basename(f), use_cache=True)
        p = P.from_resume(r, email=os.path.basename(f)[:-4] + "@demo.com")
        profs[p["name"]] = p

    jd_glob = sorted(glob.glob("seed/jds/*.pdf")) or sorted(glob.glob("data/jds/*.pdf"))
    jds = {
        os.path.basename(f)[:-4]: X.extract(f, "jd", os.path.basename(f), use_cache=True)
        for f in jd_glob
    }

    return profs, jds


def test_karthik_vs_ananya_match(env_setup):
    profs, jds = env_setup
    k_skills = profs["Karthik Subramaniam"]["skills"]
    a_skills = profs["Ananya Rao"]["skills"]

    # Karthik's Skill Match on google_ds and microsoft_da is higher than Ananya's
    assert match(k_skills, jds["google_ds"])["match_score"] > match(a_skills, jds["google_ds"])["match_score"]
    assert match(k_skills, jds["microsoft_da"])["match_score"] > match(a_skills, jds["microsoft_da"])["match_score"]

    # and Ananya's on google_swe and microsoft_swe is higher than Karthik's
    assert match(a_skills, jds["google_swe"])["match_score"] > match(k_skills, jds["google_swe"])["match_score"]
    assert match(a_skills, jds["microsoft_swe"])["match_score"] > match(k_skills, jds["microsoft_swe"])["match_score"]


def test_priya_readiness_and_match(env_setup):
    profs, jds = env_setup
    p_skills = profs["Priya Menon"]["skills"]

    # Priya's Skill Match on oracle_asa is higher than on google_swe, microsoft_swe and google_ds
    priya_asa = match(p_skills, jds["oracle_asa"])["match_score"]
    assert priya_asa > match(p_skills, jds["google_swe"])["match_score"]
    assert priya_asa > match(p_skills, jds["microsoft_swe"])["match_score"]
    assert priya_asa > match(p_skills, jds["google_ds"])["match_score"]

    # and her Talent Check readiness for Oracle FSS (id 24) is higher than for Google (id 4)
    oracle_score = talent_check(profs["Priya Menon"], 24)["readiness_score"]
    google_score = talent_check(profs["Priya Menon"], 4)["readiness_score"]
    assert oracle_score > google_score, f"Expected Oracle ({oracle_score}) > Google ({google_score})"


def test_rohan_competitiveness(env_setup):
    profs, jds = env_setup
    rohan = profs["Rohan Verma"]

    # Rohan scores within 15 points of the best candidate on every company
    for cid in (4, 24, 78):
        best_company = max(talent_check(p, cid)["readiness_score"] for p in profs.values())
        rohan_company = talent_check(rohan, cid)["readiness_score"]
        diff = best_company - rohan_company
        assert diff <= 15, f"Company {cid}: Rohan diff {diff} > 15"

    # Rohan scores within 15 points of the best candidate on SWE and DS roles
    for jid in ("google_ds", "google_swe", "microsoft_swe", "oracle_ase"):
        best_jd = max(match(p["skills"], jds[jid])["match_score"] for p in profs.values())
        rohan_jd = match(rohan["skills"], jds[jid])["match_score"]
        diff = best_jd - rohan_jd
        assert diff <= 15, f"JD {jid}: Rohan diff {diff} > 15"


def test_candidate_score_spread(env_setup):
    profs, _ = env_setup
    # Scores differ across candidates for the same company (spread >= 15 points)
    for cid in (4, 24, 78):
        scores = [talent_check(p, cid)["readiness_score"] for p in profs.values()]
        spread = max(scores) - min(scores)
        assert spread >= 15, f"Company {cid}: spread {spread} < 15"
