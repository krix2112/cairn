import json
from fastapi.testclient import TestClient
from app.api import app

def run_e2e():
    client = TestClient(app)
    resumes = [
        "ananya_rao.pdf",
        "karthik_subramaniam.pdf",
        "priya_menon.pdf",
        "rohan_verma.pdf"
    ]
    jd_path = "data/jds/google_swe.pdf"

    print("\n" + "=" * 70)
    print("END-TO-END TESTCLIENT RUN: 4 CANDIDATES vs GOOGLE SWE")
    print("=" * 70)

    for r_name in resumes:
        r_path = f"data/resumes/{r_name}"
        with open(r_path, "rb") as rf, open(jd_path, "rb") as jf:
            res = client.post(
                "/analyze",
                files={
                    "resume": (r_name, rf, "application/pdf"),
                    "jd_file": ("google_swe.pdf", jf, "application/pdf")
                }
            )
        assert res.status_code == 200, f"Failed /analyze for {r_name}: {res.text}"
        data = res.json()

        match_score = data.get("match", {}).get("match_score", 0)
        readiness_score = data.get("readiness", {}).get("readiness_score", 0)
        ats_info = data.get("ats", {})
        ats_level = ats_info.get("level", "Unknown")
        findings = ats_info.get("findings", [])
        top_finding = (
            f"{findings[0].get('title')}: {findings[0].get('fix') or findings[0].get('detail')}"
            if findings else "Clean - No ATS flags"
        )
        socials = data.get("socials", [])
        detected_gh = data.get("github_username_detected")

        # Call /roadmap endpoint
        rm_res = client.post(
            "/roadmap",
            json={
                "readiness_gaps": data.get("readiness", {}).get("skillset_gap", []),
                "company_id": data.get("company", {}).get("company_id", 4),
                "missing_jd_skills": data.get("match", {}).get("missing_skills", []),
                "ats_findings": findings,
                "hours_per_week": 8,
                "weeks": 12
            }
        )
        assert rm_res.status_code == 200, f"Failed /roadmap for {r_name}: {rm_res.text}"
        rm_data = rm_res.json()
        weeks = rm_data.get("weeks", [])

        candidate_name = r_name.replace(".pdf", "").replace("_", " ").title()
        print(f"\nCandidate: {candidate_name} ({r_name})")
        print("-" * 50)
        print(f"  Match Score     : {match_score}%")
        print(f"  Readiness Score : {readiness_score}/100")
        print(f"  ATS Level       : {ats_level}")
        print(f"  Top Finding     : {top_finding}")
        print(f"  Detected Socials: {socials if socials else 'None detected in text'}")
        print(f"  Detected GitHub : {detected_gh if detected_gh else 'None'}")
        print(f"  Roadmap Summary : {rm_data.get('summary')[:140]}...")
        print("\n  First Two Roadmap Weeks:")
        for w in weeks[:2]:
            print(f"    * Week {w['week']}: Focus: {w['focus']} | {w['hours']} hrs | Projected Score: {w['projected_score']}")
            for t in w.get("tasks", []):
                print(f"        - [{t.get('area')}] ({t.get('type')}): {t.get('task')}")
            if w.get("proof_project"):
                print(f"        Proof Project: {w['proof_project'].get('title')} -> Deliverables: {w['proof_project'].get('deliverables', [])[:2]}")
        print("=" * 70)

if __name__ == "__main__":
    run_e2e()

