import glob, os
from dotenv import load_dotenv
load_dotenv()

from app import extract as X, profile as P
from app.talent_check import talent_check
from app.skill_match import match

profs = {}
for f in sorted(glob.glob("data/resumes/*.pdf")):
    r = X.extract(f, "resume", os.path.basename(f))
    p = P.from_resume(r, email=os.path.basename(f)[:-4] + "@demo.com")
    profs[p["name"]] = P.save(p)

print("%-22s" % "", *["%-11s" % c for c in ("Google", "Oracle FSS", "Microsoft")])
for n, p in profs.items():
    print("%-22s" % n, *["%-11s" % talent_check(p, c)["readiness_score"] for c in (4, 24, 78)])

jds = {os.path.basename(f)[:-4]: X.extract(f, "jd", os.path.basename(f)) for f in sorted(glob.glob("data/jds/*.pdf"))}
print("\nSkill match %")
print("%-22s" % "", *["%-14s" % j for j in jds])
for n, p in profs.items():
    print("%-22s" % n, *["%-14s" % match(p["skills"], j)["match_score"] for j in jds.values()])
