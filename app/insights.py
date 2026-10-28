import csv
import json
import os
import glob
from .config import SKILLSET_MAP, COMPANIES, HOURS_PER_LEVEL
from .talent_check import candidate_levels
from . import profile as P
from . import extract as X
from .skill_match import match
from .samples_meta import get_samples_meta

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CSV_SKILLS = os.path.join(DATA_DIR, "company_skill_levels_rows.csv")
CSV_NAMES = os.path.join(DATA_DIR, "company_json_rows__1_.csv")

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

_COMPANY_CACHE = None

def get_all_companies():
    """
    Loads and caches the 113 companies that have complete 12 skill levels
    from company_skill_levels_rows.csv paired with names from company_json_rows__1_.csv.
    """
    global _COMPANY_CACHE
    if _COMPANY_CACHE is not None:
        return _COMPANY_CACHE

    # 1. Parse company names from company_json_rows__1_.csv
    names = {}
    if os.path.exists(CSV_NAMES):
        with open(CSV_NAMES, "r", encoding="utf-8", errors="ignore") as f:
            r = csv.reader(f)
            header = next(r, None)
            for row in r:
                if len(row) < 3:
                    continue
                try:
                    cid = int(row[1])
                    short_str = row[2]
                    data = json.loads(short_str)
                    name = data.get("name")
                    if name:
                        names[cid] = name
                except Exception:
                    continue

    # Fallbacks from hardcoded benchmark constants if needed
    for cid, cname in COMPANIES.items():
        if cid not in names:
            names[cid] = cname

    # 2. Parse skill levels per company from company_skill_levels_rows.csv
    companies_dict = {}
    if os.path.exists(CSV_SKILLS):
        with open(CSV_SKILLS, "r", encoding="utf-8") as f:
            r = csv.DictReader(f)
            for row in r:
                cid = int(row["company_id"])
                sid = int(row["skill_set_id"])
                req = int(row["required_level"])
                code = SKILLSET_MAP.get(sid)
                if not code:
                    continue
                if cid not in companies_dict:
                    companies_dict[cid] = {
                        "company_id": cid,
                        "name": names.get(cid, f"Company {cid}"),
                        "required": {}
                    }
                companies_dict[cid]["required"][code] = req

    # Keep companies with all 12 skills
    valid = {}
    for cid, data in companies_dict.items():
        if len(data["required"]) == 12:
            req_vals = list(data["required"].values())
            data["bar"] = round(sum(req_vals) / len(req_vals), 1)
            valid[cid] = data

    _COMPANY_CACHE = valid
    return _COMPANY_CACHE

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

def get_insights_fit(email: str):
    """
    Returns readiness score for all 113 companies sorted high to low,
    candidate's percentile vs distribution of company bars, and Safe/Target/Reach category.
    """
    profile = P.load(email)
    cand_levels = candidate_levels(profile.get("skills", []))
    all_companies = get_all_companies()

    entries = []
    all_bars = []

    for cid, comp in all_companies.items():
        req = comp["required"]
        raw_score = compute_talent_check_score(cand_levels, req)
        score = round(raw_score)
        bar = comp["bar"]
        all_bars.append(bar)

        # Largest gap area (greatest difference between required and candidate)
        largest_gap_area = "None"
        max_gap = -999
        for code, r in req.items():
            c = cand_levels.get(code, 0)
            gap = r - c
            if gap > max_gap:
                max_gap = gap
                largest_gap_area = code

        category = "Safe" if score >= 75 else ("Target" if score >= 50 else "Reach")

        entries.append({
            "company_id": cid,
            "name": comp["name"],
            "score": score,
            "bar": bar,
            "largest_gap_area": largest_gap_area,
            "largest_gap_name": SKILL_NAMES.get(largest_gap_area, largest_gap_area),
            "category": category
        })

    # Sort descending by score, tiebreak ascending by company name
    entries.sort(key=lambda x: (-x["score"], x["name"]))

    # Candidate mean skill level across 12 categories
    all_codes = list(SKILLSET_MAP.values())
    cand_mean = sum(cand_levels.get(c, 0) for c in all_codes) / len(all_codes)
    
    # Candidate percentile versus distribution of company required bars
    if all_bars:
        percentile = round(100.0 * sum(1 for b in all_bars if cand_mean >= b) / len(all_bars), 1)
    else:
        percentile = 50.0

    return {
        "email": email,
        "candidate_mean": round(cand_mean, 1),
        "percentile": percentile,
        "total_companies": len(entries),
        "entries": entries
    }

def get_insights_roles(email: str):
    """
    Returns skill-match score against all 6 JDs ranked, with the top missing skill for each.
    """
    profile = P.load(email)
    skills = profile.get("skills", [])
    jd_files = sorted(glob.glob(os.path.join(DATA_DIR, "jds", "*.pdf")))
    meta_list = get_samples_meta().get("jds", [])
    meta_by_name = {m.get("name"): m for m in meta_list}

    ranked = []
    for fpath in jd_files:
        name = os.path.basename(fpath)[:-4]
        jd_data = X.extract(fpath, "jd", name + ".pdf")
        m_res = match(skills, jd_data)
        
        missing = m_res.get("missing_skills", [])
        top_missing = missing[0].get("skill") or missing[0].get("skill_name") if missing else "None"
        
        meta = meta_by_name.get(name, {})
        role_title = meta.get("role", name.replace("_", " ").title())
        company_name = meta.get("company", "Tech Enterprise")

        ranked.append({
            "jd_id": name,
            "role": role_title,
            "company": company_name,
            "match_score": m_res.get("match_score", 0),
            "matched_count": len(m_res.get("matched_skills", [])),
            "missing_count": len(missing),
            "top_missing_skill": top_missing
        })

    ranked.sort(key=lambda x: -x["match_score"])
    return ranked

def get_insights_waterfall(email: str, company_id: int):
    """
    Calculates per-area points lost:
    loss_i = 100 * r_i * (r_i - min(c_i, r_i)) / sum(r^2)
    Asserted: sum(loss_i) == 100 - score
    """
    profile = P.load(email)
    cand_levels = candidate_levels(profile.get("skills", []))
    all_companies = get_all_companies()
    
    if company_id not in all_companies:
        company_id = 4 # default to Google
    
    comp = all_companies.get(company_id) or {
        "company_id": company_id,
        "name": COMPANIES.get(company_id, f"Company {company_id}"),
        "required": {c: 7 for c in SKILLSET_MAP.values()}
    }
    
    req = comp["required"]
    den = sum(r * r for r in req.values())
    raw_score = compute_talent_check_score(cand_levels, req)
    final_score = round(raw_score)

    items = []
    total_loss_raw = 0.0

    for code, r in req.items():
        c = cand_levels.get(code, 0)
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

def get_insights_band(email: str, company_id: int):
    """
    Calculates readiness score under pessimistic, base, and optimistic interpretations
    of resume evidence confidence.
    """
    profile = P.load(email)
    skills = profile.get("skills", [])
    all_companies = get_all_companies()
    
    comp = all_companies.get(company_id) or {
        "required": {c: 7 for c in SKILLSET_MAP.values()}
    }
    req = comp["required"]

    def eval_confidence(pts_map):
        pts = {}
        for s in skills:
            code = s.get("category_code")
            if code and code != "OTHER":
                pts[code] = pts.get(code, 0) + pts_map.get(s.get("confidence", "low"), 1)
        # Existing formula: min(10, round(2 + 1.8 * p))
        cand = {c: min(10, round(2 + 1.8 * p)) for c, p in pts.items()}
        return round(compute_talent_check_score(cand, req))

    # Points per confidence
    score_pessimistic = eval_confidence({"high": 2, "medium": 1, "low": 0})
    score_base = eval_confidence({"high": 3, "medium": 2, "low": 1})
    score_optimistic = eval_confidence({"high": 4, "medium": 3, "low": 2})

    return {
        "pessimistic": score_pessimistic,
        "base": score_base,
        "optimistic": score_optimistic,
        "summary": f"Your score is {score_pessimistic}–{score_optimistic} depending on how the resume evidence is read."
    }

def post_insights_plan(email: str, company_id: int, hours_per_week: float, target_score: int):
    """
    Greedy study allocation model (ESTIMATE).
    Gain per hour = (100 * r_i / sum(r^2)) / HOURS_PER_LEVEL[area]
    """
    profile = P.load(email)
    cand_levels = dict(candidate_levels(profile.get("skills", [])))
    all_companies = get_all_companies()
    
    comp = all_companies.get(company_id) or {
        "required": {c: 7 for c in SKILLSET_MAP.values()}
    }
    req = comp["required"]
    den = sum(r * r for r in req.values())

    # Ensure all 12 skills exist in candidate dictionary
    for c in SKILLSET_MAP.values():
        if c not in cand_levels:
            cand_levels[c] = 0

    curr_levels = {c: float(cand_levels[c]) for c in req}
    initial_score = round(compute_talent_check_score({c: round(v) for c, v in curr_levels.items()}, req))

    hours_per_week = max(2.0, min(50.0, float(hours_per_week)))
    target_score = max(initial_score, min(100, int(target_score)))

    milestones = []
    curve = [{"week": 0, "score": initial_score}]
    
    current_score = float(initial_score)
    weeks_needed = None
    max_weeks = 26

    for w in range(1, max_weeks + 1):
        if current_score >= target_score:
            if weeks_needed is None:
                weeks_needed = w - 1
            curve.append({"week": w, "score": round(current_score)})
            continue

        available_hours = hours_per_week
        week_areas_worked = []
        total_levels_gained = 0.0

        while available_hours > 0.01:
            # Find eligible areas where current < required
            eligible = []
            for code, r in req.items():
                c = curr_levels[code]
                if c < r:
                    h_per_lvl = float(HOURS_PER_LEVEL.get(code, 8))
                    gain_per_lvl = (100.0 * r) / den if den > 0 else 0.0
                    gain_per_hr = gain_per_lvl / h_per_lvl
                    eligible.append((gain_per_hr, code, h_per_lvl, r - c))

            if not eligible:
                break # All requirements met

            # Pick highest score gain per hour
            eligible.sort(key=lambda x: -x[0])
            _, best_code, h_per_lvl, gap = eligible[0]

            hours_needed_for_gap = gap * h_per_lvl
            hours_to_spend = min(available_hours, hours_needed_for_gap)
            levels_gained = hours_to_spend / h_per_lvl

            curr_levels[best_code] += levels_gained
            available_hours -= hours_to_spend
            total_levels_gained += levels_gained

            area_name = SKILL_NAMES.get(best_code, best_code)
            if not any(a["code"] == best_code for a in week_areas_worked):
                week_areas_worked.append({
                    "code": best_code,
                    "name": area_name,
                    "hours": round(hours_to_spend, 1),
                    "levels": round(levels_gained, 2)
                })

        current_score = compute_talent_check_score({c: round(v) for c, v in curr_levels.items()}, req)
        score_int = round(current_score)
        curve.append({"week": w, "score": score_int})

        primary_area = week_areas_worked[0]["name"] if week_areas_worked else "Consolidation"
        primary_code = week_areas_worked[0]["code"] if week_areas_worked else "SWE"
        milestones.append({
            "week": w,
            "area": primary_area,
            "category_code": primary_code,
            "levels_gained": round(total_levels_gained, 1),
            "hours": round(hours_per_week - available_hours, 1),
            "projected_score": score_int
        })

        if current_score >= target_score and weeks_needed is None:
            weeks_needed = w

    reachable = weeks_needed is not None
    if reachable:
        headline = f"At {int(hours_per_week)} h/week you reach {target_score} in {weeks_needed} week{'s' if weeks_needed != 1 else ''} (estimate)"
    else:
        headline = f"Not reachable within 26 weeks at {int(hours_per_week)} h/week (estimate)"

    return {
        "email": email,
        "company_id": company_id,
        "hours_per_week": hours_per_week,
        "target_score": target_score,
        "reachable": reachable,
        "weeks_needed": weeks_needed if reachable else "not reachable within 26 weeks",
        "headline": headline,
        "milestones": milestones,
        "curve": curve
    }
