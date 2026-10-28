import json, os, re
D = os.path.join(os.path.dirname(__file__), "..", "profiles")
def _p(email): return os.path.join(D, re.sub(r"[^a-z0-9@._-]","_",email.lower())+".json")
FIELDS = ["name","email","education","skills","hackathons","internships","certifications","preferred_roles","cv_file"]
def validate(p):
    errs = [f"missing {f}" for f in ("name","email") if not p.get(f)]
    if p.get("email") and "@" not in p["email"]: errs.append("bad email")
    return errs
def save(p):
    e = validate(p)
    if e: raise ValueError(e)
    p = {f:p.get(f,[] if f not in ("name","email","education","cv_file") else "") for f in FIELDS}
    os.makedirs(D, exist_ok=True); json.dump(p, open(_p(p["email"]),"w"), indent=2); return p
def load(email): return json.load(open(_p(email)))
def from_resume(res, name="", email=""):
    t = res.get("_text") or ""
    sec = lambda h: [l.strip("• ").strip() for l in re.split(r"\n", (re.search(h+r"\s*\n(.*?)(?:\n[A-Z][A-Za-z /]+\n|\Z)", t, re.S) or [0,""])[1]) if l.strip()]
    edu = (sec("Education") or [""])[0]
    return {"name":name or next((l.strip() for l in t.split("\n") if l.strip() and "RADIX" not in l and not l.startswith("Page")),""),"email":email,"education":edu,"skills":res["skills"],
            "hackathons":sec("Hackathons / Internships"),"internships":[],"certifications":sec("Certifications"),
            "preferred_roles":[r.strip() for r in ", ".join(sec("Preferred Roles")).split(",") if r.strip()],"cv_file":res["source_file"]}
