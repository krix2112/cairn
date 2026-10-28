import csv, os
from .config import SKILLSET_MAP, COMPANIES
CSV = os.path.join(os.path.dirname(__file__), "..", "data", "company_skill_levels_rows.csv")
PTS = {"high":3,"medium":2,"low":1}
def required(company_id):
    return {SKILLSET_MAP[int(r["skill_set_id"])]:int(r["required_level"])
            for r in csv.DictReader(open(CSV)) if int(r["company_id"])==company_id}
def candidate_levels(skills):
    pts = {}
    for s in skills: pts[s["category_code"]] = pts.get(s["category_code"],0)+PTS.get(s.get("confidence"),1)
    return {c: min(10, round(2+1.8*p)) for c,p in pts.items() if c!="OTHER"}
def talent_check(profile, company_id):
    req, cand = required(company_id), candidate_levels(profile["skills"])
    gaps = [{"category_code":c,"required_level":r,"candidate_level":cand.get(c,0),"gap":cand.get(c,0)<r} for c,r in req.items()]
    # weighted by required level: harder skillsets count more; surplus doesn't offset deficits
    score = 100*sum(min(g["candidate_level"],g["required_level"])*g["required_level"] for g in gaps)/sum(g["required_level"]**2 for g in gaps)
    return {"company":COMPANIES.get(company_id,str(company_id)),"skillset_gap":sorted(gaps,key=lambda g:g["candidate_level"]-g["required_level"]),"readiness_score":round(score)}
