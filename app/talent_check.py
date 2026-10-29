import csv
import os
from .config import SKILLSET_MAP, COMPANIES
from . import data_source

PTS = {"high": 3, "medium": 2, "low": 1}

def required(company_id: int):
    try:
        return data_source.get_company_required_levels(company_id)
    except Exception:
        return {}


def candidate_levels(skills):
    pts = {}
    for s in skills:
        code = s.get("category_code")
        if code and code != "OTHER":
            pts[code] = pts.get(code, 0) + PTS.get(s.get("confidence"), 1)
    return {c: min(10, round(2 + 1.8 * p)) for c, p in pts.items()}

def talent_check(profile_or_skills, company_id: int, company_name: str = ""):
    """
    Evaluates talent readiness against target company requirement levels.
    Accepts either a profile dict {"skills": [...]} or a skills list directly in memory.
    """
    if isinstance(profile_or_skills, dict):
        skills = profile_or_skills.get("skills", [])
    elif isinstance(profile_or_skills, list):
        skills = profile_or_skills
    else:
        skills = []

    req = required(company_id)
    cand = candidate_levels(skills)

    gaps = [
        {
            "category_code": c,
            "required_level": r,
            "candidate_level": cand.get(c, 0),
            "gap": cand.get(c, 0) < r,
        }
        for c, r in req.items()
    ]

    den = sum(g["required_level"] ** 2 for g in gaps)
    num = sum(min(g["candidate_level"], g["required_level"]) * g["required_level"] for g in gaps)
    score = (100.0 * num / den) if den > 0 else 0.0

    comp_label = company_name or COMPANIES.get(company_id, str(company_id))

    return {
        "company_id": company_id,
        "company": comp_label,
        "skillset_gap": sorted(gaps, key=lambda g: g["candidate_level"] - g["required_level"]),
        "readiness_score": round(score),
    }
