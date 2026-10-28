from rapidfuzz import fuzz
W = {"high":3,"medium":2,"low":1}
def match(profile_skills, jd, thr=80):
    mine, matched, missing, num, den = profile_skills, [], [], 0, 0
    for j in jd["skills"]:
        w = W.get(j.get("confidence"),1); den += w
        best = max(mine, key=lambda s: fuzz.token_set_ratio(j["skill_name"], s["skill_name"]) + (30 if s["category_code"]==j["category_code"] else 0), default=None)
        sim = fuzz.token_set_ratio(j["skill_name"], best["skill_name"]) if best else 0
        same = best and best["category_code"]==j["category_code"]
        if best and (sim>=thr or same):
            f = 1.0 if sim>=thr else 0.7   # category-level match = partial credit
            num += w*f*min(1,0.6+0.2*W.get(best.get("confidence"),1)); matched.append({"jd_skill":j["skill_name"],"category_code":j["category_code"],"candidate_skill":best["skill_name"]})
        else: missing.append({"skill":j["skill_name"],"category_code":j["category_code"],"why_needed":j["evidence"]})
    return {"jd_source_file":jd["source_file"],"match_score":round(100*num/den) if den else 0,"matched_skills":matched,"missing_skills":missing}
