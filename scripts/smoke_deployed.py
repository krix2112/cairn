"""
Smoke Test for Deployed Cairn / Radix Instance (scripts/smoke_deployed.py)

Usage:
  python scripts/smoke_deployed.py <base_url>
Example:
  python scripts/smoke_deployed.py https://cairn.vercel.app
  python scripts/smoke_deployed.py http://localhost:8000
"""

import sys
import time
import requests


def run_smoke_test(base_url: str):
    base_url = base_url.rstrip("/")
    print(f"\n=======================================================")
    print(f"Starting Cairn Deployment Smoke Test against: {base_url}")
    print(f"=======================================================\n")

    passed = 0
    total = 0

    def test_endpoint(name: str, fn):
        nonlocal passed, total
        total += 1
        t0 = time.perf_counter()
        try:
            fn()
            duration_ms = round((time.perf_counter() - t0) * 1000, 1)
            print(f"  [PASS] {name} ({duration_ms} ms)")
            passed += 1
        except Exception as e:
            duration_ms = round((time.perf_counter() - t0) * 1000, 1)
            print(f"  [FAIL] {name} ({duration_ms} ms): {e}")

    # 1. Health check
    def check_health():
        resp = requests.get(f"{base_url}/health", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert data.get("status") == "ok", f"Expected status 'ok', got {data.get('status')}"
        print(f"         Storage: {data.get('storage')} | Auth: {data.get('auth')} | LLM: {data.get('llm')}")

    test_endpoint("GET /health", check_health)

    # 2. Config check
    def check_config():
        resp = requests.get(f"{base_url}/config", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert "supabase_url" in data, "Missing supabase_url in config"
        assert "supabase_publishable_key" in data, "Missing supabase_publishable_key in config"
        assert "service_key" not in data, "CRITICAL: Service key leaked in /config!"
        assert "service_role" not in str(data).lower(), "CRITICAL: Service key leaked in /config!"

    test_endpoint("GET /config (Public keys only, zero secret leakage)", check_config)

    # 3. Companies benchmark list
    def check_companies():
        resp = requests.get(f"{base_url}/companies", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert isinstance(data, list), "Expected list of companies"
        assert len(data) >= 100, f"Expected >= 100 benchmark companies, got {len(data)}"

    test_endpoint("GET /companies (Benchmark dataset loaded)", check_companies)

    # 4. Sample files endpoint
    def check_samples():
        resp = requests.get(f"{base_url}/samples", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        assert "sample" in data, "Missing sample definition"

    test_endpoint("GET /samples (Single sample pair rohan_verma + google_swe)", check_samples)

    # 5. Static Pages
    for page in ["", "index.html", "analyze.html", "login.html", "dashboard.html", "fonts.css"]:
        def check_static(p=page):
            path = f"/{p}" if p else "/"
            resp = requests.get(f"{base_url}{path}", timeout=10)
            assert resp.status_code == 200, f"Expected 200 for {path}, got {resp.status_code}"
        label = f"GET /{page}" if page else "GET / (Landing page)"
        test_endpoint(label, check_static)

    # 6. Sample file downloads
    def check_sample_file_dl():
        resp = requests.get(f"{base_url}/samples/file/resumes/rohan_verma.pdf", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert len(resp.content) > 1000, "Downloaded sample file is too small"

    test_endpoint("GET /samples/file/resumes/rohan_verma.pdf", check_sample_file_dl)

    # 7. End-to-end Analyze check (with sample)
    def check_analyze():
        # Fetch sample files
        res_file = requests.get(f"{base_url}/samples/file/resumes/rohan_verma.pdf", timeout=10)
        jd_file = requests.get(f"{base_url}/samples/file/jds/google_swe.pdf", timeout=10)

        files = {
            "resume": ("rohan_verma.pdf", res_file.content, "application/pdf"),
            "jd_file": ("google_swe.pdf", jd_file.content, "application/pdf")
        }
        data = {
            "company_id": 1
        }
        resp = requests.post(f"{base_url}/analyze", files=files, data=data, timeout=30)
        assert resp.status_code == 200, f"Expected 200 for /analyze, got {resp.status_code}: {resp.text[:200]}"
        result = resp.json()
        assert "match" in result, "Missing match in /analyze result"
        assert "readiness" in result, "Missing readiness in /analyze result"
        assert "ats" in result, "Missing ats in /analyze result"
        assert "socials" in result, "Missing socials in /analyze result"
        print(f"         Match: {result['match']['match_score']}% | Readiness: {result['readiness']['overall_score']}% | ATS: {result['ats']['score']}%")

    test_endpoint("POST /analyze (Full diagnostic pipeline)", check_analyze)

    print(f"\n-------------------------------------------------------")
    print(f"Summary: {passed} of {total} checks passed.")
    print(f"-------------------------------------------------------\n")
    if passed < total:
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/smoke_deployed.py <base_url>")
        sys.exit(1)
    run_smoke_test(sys.argv[1])

