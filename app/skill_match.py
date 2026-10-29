from typing import Any, Dict, List, Optional
from rapidfuzz import fuzz

W = {"high": 3, "medium": 2, "low": 1}

def _get_skill_name(s: Any) -> str:
    if isinstance(s, dict):
        return str(s.get("skill_name") or s.get("name") or s.get("skill") or "").strip()
    return str(s).strip() if s else ""

def _get_category_code(s: Any) -> str:
    if isinstance(s, dict):
        return str(s.get("category_code") or "OTHER").strip()
    return "OTHER"

def match(profile_skills, jd, thr: int = 80) -> Dict[str, Any]:
    mine = profile_skills or []
    matched, missing, num, den = [], [], 0, 0
    jd_skills = jd.get("skills", []) if isinstance(jd, dict) else []
    for j in jd_skills:
        w = W.get(j.get("confidence") if isinstance(j, dict) else "medium", 1)
        den += w
        j_name = _get_skill_name(j)
        j_cat = _get_category_code(j)

        best = max(
            mine,
            key=lambda s: fuzz.token_set_ratio(j_name, _get_skill_name(s)) + (30 if _get_category_code(s) == j_cat else 0),
            default=None
        )
        sim = fuzz.token_set_ratio(j_name, _get_skill_name(best)) if best else 0
        same = best is not None and _get_category_code(best) == j_cat
        if best and (sim >= thr or same):
            f = 1.0 if sim >= thr else 0.7   # category-level match = partial credit
            b_conf = best.get("confidence", "medium") if isinstance(best, dict) else "medium"
            num += w * f * min(1, 0.6 + 0.2 * W.get(b_conf, 1))
            matched.append({
                "jd_skill": j_name,
                "category_code": j_cat,
                "candidate_skill": _get_skill_name(best)
            })
        else:
            evidence = j.get("evidence", "") if isinstance(j, dict) else ""
            missing.append({
                "skill": j_name,
                "category_code": j_cat,
                "why_needed": evidence
            })

    source_file = jd.get("source_file", "") if isinstance(jd, dict) else ""
    return {
        "jd_source_file": source_file,
        "match_score": round(100 * num / den) if den else 0,
        "matched_skills": matched,
        "missing_skills": missing
    }
