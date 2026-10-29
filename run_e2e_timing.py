import json
from fastapi.testclient import TestClient
from app.api import app

client = TestClient(app)

resume_path = "data/resumes/rohan_verma.pdf"
jd_path = "data/jds/google_swe.pdf"

with open(resume_path, "rb") as rf, open(jd_path, "rb") as jf:
    files = {
        "resume": ("rohan_verma.pdf", rf, "application/pdf"),
        "jd_file": ("google_swe.pdf", jf, "application/pdf")
    }
    res = client.post("/analyze", files=files)

print(f"HTTP Status: {res.status_code}")
data = res.json()

print("\n======================================================")
print("   END-TO-END ANALYSIS (rohan_verma + google_swe)")
print("======================================================")
print(f"Candidate Extracted Skills: {data['extract']['resume']['skills_count']}")
print(f"Job Description Skills:     {data['extract']['jd']['skills_count']}")
print(f"Skill Match Score:          {data['match']['match_score']} / 100")
print(f"Matched Skills Count:       {data['match']['matched_count']}")
print(f"Missing Skills Count:       {data['match']['missing_count']}")
print(f"Detected Company:           {data['company']['company']} (ID: {data['company']['company_id']}, Auto-Detected: {data['company']['auto_detected']})")
print(f"Talent Readiness Score:     {data['readiness']['readiness_score']} / 100")
print(f"Waterfall Items:            {len(data['readiness']['waterfall'])} competencies")
print(f"Top Next-Best Skills:       {len(data['readiness']['next_best_skills'])} recommended")
for nbs in data['readiness']['next_best_skills'][:3]:
    print(f"  * {nbs['recommendation']}")

print(f"ATS Risk Level:             {data['ats']['level']} (Risk Score: {data['ats']['risk_score']} / 100)")
print(f"ATS Findings:               {len(data['ats']['findings'])} finding(s)")
print(f"Extracted Social Profiles:  {len(data['socials'])}")
for s in data['socials']:
    print(f"  * {s['platform']:12s} @{s['username']:18s} -> {s['url']}")

print("\n------------------------------------------------------")
print("                 SECTION TIMINGS")
print("------------------------------------------------------")
for sec, dur in data['timings'].items():
    print(f"  {sec:12s} : {dur:6.3f} s")
print("======================================================\n")

