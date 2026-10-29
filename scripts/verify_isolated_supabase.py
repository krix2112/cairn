#!/usr/bin/env python3
"""
Verify Radix runs completely from Supabase alone with zero local data files.
"""

import os
import sys

# Ensure root is in sys.path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

# Force snapshot fallback OFF to guarantee pure Supabase operation
os.environ["ALLOW_SNAPSHOT_FALLBACK"] = "0"

from fastapi.testclient import TestClient
from app.api import app
from app import data_source

client = TestClient(app)

print("=== Testing Radix Pure Supabase Mode (Zero local data files) ===")

# 1. Health check
r_health = client.get("/health")
print(f"1. /health -> status {r_health.status_code}: {r_health.json()}")
assert r_health.status_code == 200, f"Health check failed: {r_health.text}"
hdata = r_health.json()
assert hdata.get("data_source") == "supabase", f"Expected data_source 'supabase', got {hdata.get('data_source')}"
assert hdata.get("companies") == 118, f"Expected 118 companies, got {hdata.get('companies')}"
assert hdata.get("levels") == 1356, f"Expected 1356 levels, got {hdata.get('levels')}"
assert hdata.get("skill_sets") == 12, f"Expected 12 skill_sets, got {hdata.get('skill_sets')}"
print("[PASS] /health verified pure Supabase source.")

# 2. Companies check
r_comps = client.get("/companies")
print(f"2. /companies -> status {r_comps.status_code}, count: {len(r_comps.json())}")
assert r_comps.status_code == 200
assert len(r_comps.json()) == 113
print("[PASS] /companies returned all 113 benchmark companies.")

# 3. Samples check
r_samples = client.get("/samples")
print(f"3. /samples -> status {r_samples.status_code}: {r_samples.json().get('sample')}")
assert r_samples.status_code == 200
sample_pair = r_samples.json().get("sample", {})
assert sample_pair.get("resume") == "rohan_verma"
assert sample_pair.get("jd") == "google_swe"
print("[PASS] /samples verified.")

# 4. Storage file download check (served from Supabase storage)
r_file = client.get("/samples/file/resumes/rohan_verma.pdf")
print(f"4. /samples/file/resumes/rohan_verma.pdf -> status {r_file.status_code}, size: {len(r_file.content)} bytes")
assert r_file.status_code == 200
assert len(r_file.content) > 1000
assert r_file.content.startswith(b"%PDF")
print("[PASS] Sample PDF fetched from Supabase public storage bucket.")

# 5. Full /analyze endpoint test using sample parameters
print("5. Running /analyze with sample files...")
resume_bytes = r_file.content
r_jd_file = client.get("/samples/file/jds/google_swe.pdf")
assert r_jd_file.status_code == 200
jd_bytes = r_jd_file.content

files = {
    "resume": ("rohan_verma.pdf", resume_bytes, "application/pdf"),
    "jd_file": ("google_swe.pdf", jd_bytes, "application/pdf"),
}
r_analyze = client.post("/analyze", files=files, data={"company_id": 4})

print(f"   /analyze -> status {r_analyze.status_code}")
assert r_analyze.status_code == 200, f"/analyze failed: {r_analyze.text}"
res = r_analyze.json()
print(f"   Match Score: {res.get('match', {}).get('match_score')}")
print(f"   Readiness Score: {res.get('readiness', {}).get('readiness_score')}")
print(f"   ATS Level: {res.get('ats', {}).get('level')}")
print(f"   Company: {res.get('company', {}).get('company_name')}")
print(f"   Timings total: {res.get('timings', {}).get('total')}s")
assert res.get("match", {}).get("match_score") is not None
assert res.get("readiness", {}).get("readiness_score") is not None
assert res.get("ats", {}).get("level") is not None
print("[PASS] Full /analyze pipeline executed successfully with Supabase alone!")


print("\n=== ALL REMOTE SUPABASE IN-MEMORY CHECKS PASSED ===")
