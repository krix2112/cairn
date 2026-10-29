import csv
import json
import os
from rapidfuzz import fuzz, process
from .config import SKILLSET_MAP, COMPANIES, HOURS_PER_LEVEL
from .talent_check import candidate_levels
from . import data_source

SKILL_NAMES = {

    "COD": "Coding Foundations",
    "DSA": "Data Structures & Algorithms",
    "APTI": "Quantitative Aptitude",
    "COMM": "Workplace Communication",
    "OOD": "Object-Oriented Design",
    "AI": "Machine Learning & Stats",
    "SQL": "Databases & SQL",
    "SYSD": "System Design",
    "CLOUD": "Cloud & Infrastructure",
    "SWE": "Software Engineering",
    "NETW": "Computer Networks",
    "OS": "Operating Systems"
}

def get_all_companies():
    """
    Returns benchmark companies that have complete 12 skill levels from data_source.
    """
    try:
        return data_source.get_all_company_benchmarks()
    except Exception:
        return {}


def get_sorted_companies_list():
    """
    Returns all benchmark companies sorted alphabetically by name:
    [{"id": cid, "name": name, "bar": bar}, ...]
    """
    try:
        return data_source.get_sorted_companies_list()
    except Exception:
        return []



def find_matching_company(query_name: str, threshold: int = 88):
    """
    Fuzzy match a company name against the 113 companies using rapidfuzz >= 88.
    Returns (company_id, company_name, True) if match found, else (None, None, False).
    """
    if not query_name or not query_name.strip():
        return None, None, False

    clean_query = query_name.strip()
    comps = get_all_companies()
    
    # Direct case-insensitive check first
    for cid, d in comps.items():
        if clean_query.lower() == d["name"].lower():
            return cid, d["name"], True

    # Build choices mapping: name -> cid
    name_map = {d["name"]: cid for cid, d in comps.items()}
    names = list(name_map.keys())

    # Fuzzy match with token_set_ratio which handles substrings, extra words (e.g. "Google Inc" -> "Google")
    best = process.extractOne(clean_query, names, scorer=fuzz.token_set_ratio)
    if best and best[1] >= threshold:
        matched_name = best[0]
        return name_map[matched_name], matched_name, True

    # Fallback with token_sort_ratio
    best_sort = process.extractOne(clean_query, names, scorer=fuzz.token_sort_ratio)
    if best_sort and best_sort[1] >= threshold:
        matched_name = best_sort[0]
        return name_map[matched_name], matched_name, True

    return None, None, False


def compute_talent_check_score(candidate_levels_dict, required_dict):
    """
    Computes deterministic talent readiness score:
    100 * sum(min(c_i, r_i) * r_i) / sum(r_i^2)
    """
    num = 0
    den = 0
    for code, r in required_dict.items():
        c = candidate_levels_dict.get(code, 0)
        num += min(c, r) * r
        den += r * r
    return (100.0 * num / den) if den > 0 else 0.0


def compute_waterfall(candidate_levels_dict, company_id: int):
    """
    In-memory calculation of points lost per skill category:
    loss_i = 100 * r_i * (r_i - min(c_i, r_i)) / sum(r^2)
    Asserted: sum(loss_i) == 100 - score
    """
    all_comps = get_all_companies()
    comp = all_comps.get(company_id)
    if not comp:
        comp = {
            "company_id": company_id,
            "name": COMPANIES.get(company_id, f"Company {company_id}"),
            "required": {c: 7 for c in SKILLSET_MAP.values()}
        }

    req = comp["required"]
    den = sum(r * r for r in req.values())
    raw_score = compute_talent_check_score(candidate_levels_dict, req)
    final_score = round(raw_score)

    items = []
    total_loss_raw = 0.0

    for code, r in req.items():
        c = candidate_levels_dict.get(code, 0)
        c_eff = min(c, r)
        loss = (100.0 * r * (r - c_eff)) / den if den > 0 else 0.0
        total_loss_raw += loss
        name = SKILL_NAMES.get(code, code)
        items.append({
            "category_code": code,
            "name": name,
            "candidate_level": c,
            "required_level": r,
            "points_lost": round(loss, 2),
            "points_lost_int": round(loss),
            "plain_english": f"{name} costs you {round(loss)} points: you are at {c}, {comp['name']} expects {r}"
        })

    items.sort(key=lambda x: -x["points_lost"])

    return {
        "company_id": company_id,
        "company_name": comp["name"],
        "final_score": final_score,
        "total_loss": round(total_loss_raw),
        "items": items
    }


def compute_next_best_skills(candidate_levels_dict, company_id: int, top_n: int = 5):
    """
    Identifies top 5 highest-gain skill improvements:
    gain_per_level = (100 * r_i) / sum(r^2)
    roi = gain_per_level / HOURS_PER_LEVEL[code]
    """
    all_comps = get_all_companies()
    comp = all_comps.get(company_id)
    if not comp:
        comp = {
            "company_id": company_id,
            "name": COMPANIES.get(company_id, f"Company {company_id}"),
            "required": {c: 7 for c in SKILLSET_MAP.values()}
        }

    req = comp["required"]
    den = sum(r * r for r in req.values())

    eligible = []
    for code, r in req.items():
        c = candidate_levels_dict.get(code, 0)
        if c < r:
            gap = r - c
            pts_gain = (100.0 * r) / den if den > 0 else 0.0
            hours = HOURS_PER_LEVEL.get(code, 8)
            roi = pts_gain / hours if hours > 0 else 0.0
            name = SKILL_NAMES.get(code, code)
            eligible.append({
                "category_code": code,
                "name": name,
                "candidate_level": c,
                "required_level": r,
                "gap": gap,
                "points_gain_per_level": round(pts_gain, 2),
                "hours_needed": hours,
                "roi": round(roi, 3),
                "recommendation": f"Advance {name} from level {c} to {c + 1} (+{round(pts_gain, 1)} pts readiness in ~{hours} hrs)"
            })

    # Sort primarily by immediate points gain, secondarily by ROI
    eligible.sort(key=lambda x: (-x["points_gain_per_level"], -x["roi"]))
    return eligible[:top_n]
