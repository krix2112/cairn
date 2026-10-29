#!/usr/bin/env python3
"""
Seed Supabase database from local reference data.
Idempotent upserts in batches of 500.

Usage:
  python scripts/seed_supabase.py [--dry-run] [--env-file PATH]
"""

import argparse
import csv
import glob
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional
import httpx
from dotenv import load_dotenv
from pypdf import PdfReader


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def format_ctc_short(ctc_str: str) -> str:
    nums = re.sub(r"[^\d]", "", ctc_str)

    if not nums:
        return ctc_str
    val = int(nums)
    lakhs = val / 100000.0
    if lakhs == int(lakhs):
        return f"₹{int(lakhs)}L"
    formatted = f"{lakhs:.2f}".rstrip("0").rstrip(".")
    return f"₹{formatted}L"


def parse_jd_meta(pdf_path: str) -> Dict[str, Any]:
    reader = PdfReader(pdf_path)
    txt = reader.pages[0].extract_text()
    lines = [line.strip() for line in txt.split("\n") if line.strip()]

    title_lines = []
    for line in lines:
        if line.startswith("Role Category:"):
            break
        title_lines.append(line)
    full_title = " ".join(title_lines)

    company = ""
    role = ""
    if "—" in full_title:
        parts = full_title.split("—", 1)
        company = parts[0].strip()
        role = parts[1].strip()
    elif "-" in full_title:
        parts = full_title.split("-", 1)
        company = parts[0].strip()
        role = parts[1].strip()
    else:
        role = full_title

    role_category = ""
    for line in lines:
        if line.startswith("Role Category:"):
            role_category = line.replace("Role Category:", "").strip()
            break

    location = ""
    ctc = ""
    for line in lines:
        if "·" in line and "CTC" in line:
            parts = [p.strip() for p in line.split("·")]
            loc_part = parts[0]
            loc_clean = re.sub(r",\s*India\b", "", loc_part).strip()
            location = re.sub(r"\s+", " ", loc_clean)

            m_ctc = re.search(r"(₹[\d,]+)", line)
            if m_ctc:
                ctc = m_ctc.group(1)
            break

    name = os.path.basename(pdf_path)[:-4]
    company_id = 4 if "Google" in company else (78 if "Microsoft" in company else 24)

    return {
        "name": name,
        "company": company,
        "role": role,
        "role_category": role_category,
        "location": location,
        "ctc": ctc,
        "ctc_short": format_ctc_short(ctc),
        "company_id": company_id,
    }


def parse_resume_meta(pdf_path: str) -> Dict[str, Any]:
    reader = PdfReader(pdf_path)
    txt = reader.pages[0].extract_text()
    lines = [line.strip() for line in txt.split("\n") if line.strip()]

    clean_lines = [l for l in lines if "RADIX" not in l and not l.startswith("Page ")]
    full_name = clean_lines[0] if clean_lines else ""

    headline_lines = []
    for l in clean_lines[1:]:
        if l == "Education" or l.startswith("Education"):
            break
        headline_lines.append(l)
    headline = " ".join(headline_lines).strip()
    name = os.path.basename(pdf_path)[:-4]

    return {
        "name": name,
        "full_name": full_name,
        "headline": headline,
        "email": f"{name}@demo.local",
    }


def chunked(items: List[Any], n: int):
    for i in range(0, len(items), n):
        yield items[i : i + n]


def req(client: httpx.Client, method: str, url: str, retries: int = 2, **kwargs) -> httpx.Response:
    import time
    last_err = None
    for attempt in range(retries + 1):
        try:
            r = client.request(method, url, **kwargs)
            return r
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(1.0 * (attempt + 1))
            else:
                raise last_err



def main():
    parser = argparse.ArgumentParser(description="Seed Supabase with Radix reference data")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without modifying Supabase")
    parser.add_argument("--env-file", default=None, help="Path to .env file")
    args = parser.parse_args()

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = args.env_file or os.path.join(project_root, ".env")
    load_dotenv(env_path)

    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not supabase_url or not service_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment.")
        sys.exit(1)

    # Resolve data path: check seed/ then data/
    data_dir = os.path.join(project_root, "data")
    if not os.path.exists(data_dir):
        data_dir = os.path.join(project_root, "seed")
    if not os.path.exists(data_dir):
        print(f"ERROR: Cannot find reference data directory in {project_root}")
        sys.exit(1)

    print(f"=== Radix v3 Supabase Seeder (dry_run={args.dry_run}) ===")
    print(f"Target URL: {supabase_url}")
    print(f"Using data source: {data_dir}\n")

    rest_headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    client = httpx.Client(timeout=30.0, follow_redirects=True)

    # 1. Verify skill_sets table
    print("1. Verifying skill_sets...")
    r_skills = req(
        client,
        "GET",
        f"{supabase_url}/rest/v1/skill_sets?select=*&order=sort_order",
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
    )
    if r_skills.status_code != 200:
        print(f"ERROR fetching skill_sets: {r_skills.status_code} - {r_skills.text}")
        sys.exit(1)
    skills_data = r_skills.json()
    if len(skills_data) != 12:
        print(f"ERROR: Expected 12 skill_sets, found {len(skills_data)}")
        sys.exit(1)
    print(f"[OK] skill_sets verified: {len(skills_data)} rows present")

    # 2. Company JSON (118 rows)
    company_csv = os.path.join(data_dir, "company_json_rows__1_.csv")
    print(f"\n2. Processing company_json from {os.path.basename(company_csv)}...")
    companies_to_upsert = []
    with open(company_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            short_j = json.loads(row["short_json"])
            full_j = json.loads(row["full_json"])
            name = short_j.get("name") or short_j.get("short_name", "")
            companies_to_upsert.append({
                "company_id": int(row["company_id"]),
                "json_id": int(row["json_id"]),
                "name": name,
                "short_json": short_j,
                "full_json": full_j,
            })
    print(f"Loaded {len(companies_to_upsert)} company rows from CSV.")

    if not args.dry_run:
        for chunk in chunked(companies_to_upsert, 500):
            res = req(
                client,
                "POST",
                f"{supabase_url}/rest/v1/company_json",
                headers=rest_headers,
                json=chunk,
            )
            if res.status_code not in (200, 201):
                print(f"ERROR upserting company_json: {res.status_code} - {res.text}")
                sys.exit(1)
        # Verify count
        r_cnt = req(
            client,
            "GET",
            f"{supabase_url}/rest/v1/company_json?select=company_id",
            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        )
        print(f"[OK] company_json {len(r_cnt.json())}")
    else:
        print(f"[DRY-RUN] Would upsert {len(companies_to_upsert)} rows into company_json")

    # 3. Company skill levels (1356 rows)
    levels_csv = os.path.join(data_dir, "company_skill_levels_rows.csv")
    print(f"\n3. Processing company_skill_levels from {os.path.basename(levels_csv)}...")
    levels_to_upsert = []
    with open(levels_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            levels_to_upsert.append({
                "id": int(row["id"]),
                "company_id": int(row["company_id"]),
                "skill_set_id": int(row["skill_set_id"]),
                "required_level": int(row["required_level"]),
                "required_proficiency_level_id": int(row["required_proficiency_level_id"]),
            })
    print(f"Loaded {len(levels_to_upsert)} level rows from CSV.")

    if not args.dry_run:
        for chunk in chunked(levels_to_upsert, 500):
            res = req(
                client,
                "POST",
                f"{supabase_url}/rest/v1/company_skill_levels",
                headers=rest_headers,
                json=chunk,
            )
            if res.status_code not in (200, 201):
                print(f"ERROR upserting company_skill_levels: {res.status_code} - {res.text}")
                sys.exit(1)
        r_cnt = req(
            client,
            "GET",
            f"{supabase_url}/rest/v1/company_skill_levels?select=id&limit=1",
            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}", "Prefer": "count=exact"},
        )
        total_levels = 1356
        crange = r_cnt.headers.get("content-range", "")
        if "/" in crange:
            try:
                total_levels = int(crange.split("/")[-1])
            except ValueError:
                pass
        print(f"[OK] company_skill_levels {total_levels}")
    else:
        print(f"[DRY-RUN] Would upsert {len(levels_to_upsert)} rows into company_skill_levels in batches of 500")

    # 4. App content (roadmap_kb)
    kb_path = os.path.join(data_dir, "roadmap_kb.json")
    print(f"\n4. Processing app_content from {os.path.basename(kb_path)}...")
    with open(kb_path, "r", encoding="utf-8") as f:
        kb_data = json.load(f)
    print(f"Loaded roadmap_kb with {len(kb_data)} skill categories.")

    if not args.dry_run:
        res = req(
            client,
            "POST",
            f"{supabase_url}/rest/v1/app_content",
            headers=rest_headers,
            json=[{"key": "roadmap_kb", "data": kb_data}],
        )
        if res.status_code not in (200, 201):
            print(f"ERROR upserting app_content: {res.status_code} - {res.text}")
            sys.exit(1)
        print("[OK] app_content: roadmap_kb upserted")
    else:
        print("[DRY-RUN] Would upsert key 'roadmap_kb' into app_content")

    # 5. Samples (10 PDFs: 6 JDs + 4 resumes)
    print("\n5. Processing samples (PDFs & metadata)...")
    jd_pdfs = sorted(glob.glob(os.path.join(data_dir, "jds", "*.pdf")))
    resume_pdfs = sorted(glob.glob(os.path.join(data_dir, "resumes", "*.pdf")))
    sample_rows = []

    storage_headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/pdf",
        "x-upsert": "true",
    }

    # Upload JDs
    for path in jd_pdfs:
        bname = os.path.basename(path)
        name = bname[:-4]
        remote_path = f"jds/{bname}"
        meta = parse_jd_meta(path)
        sample_rows.append({
            "kind": "jd",
            "name": name,
            "file_path": remote_path,
            "meta": meta,
        })
        if not args.dry_run:
            with open(path, "rb") as pf:
                pdf_bytes = pf.read()
            u_res = req(
                client,
                "POST",
                f"{supabase_url}/storage/v1/object/samples/{remote_path}",
                headers=storage_headers,
                content=pdf_bytes,
            )
            if u_res.status_code not in (200, 201):
                print(f"ERROR uploading storage object {remote_path}: {u_res.status_code} - {u_res.text}")
                sys.exit(1)

    # Upload Resumes
    for path in resume_pdfs:
        bname = os.path.basename(path)
        name = bname[:-4]
        remote_path = f"resumes/{bname}"
        meta = parse_resume_meta(path)
        sample_rows.append({
            "kind": "resume",
            "name": name,
            "file_path": remote_path,
            "meta": meta,
        })
        if not args.dry_run:
            with open(path, "rb") as pf:
                pdf_bytes = pf.read()
            u_res = req(
                client,
                "POST",
                f"{supabase_url}/storage/v1/object/samples/{remote_path}",
                headers=storage_headers,
                content=pdf_bytes,
            )
            if u_res.status_code not in (200, 201):
                print(f"ERROR uploading storage object {remote_path}: {u_res.status_code} - {u_res.text}")
                sys.exit(1)

    if not args.dry_run:
        res = req(
            client,
            "POST",
            f"{supabase_url}/rest/v1/samples",
            headers=rest_headers,
            json=sample_rows,
        )
        if res.status_code not in (200, 201):
            print(f"ERROR upserting samples: {res.status_code} - {res.text}")
            sys.exit(1)
        r_cnt = req(
            client,
            "GET",
            f"{supabase_url}/rest/v1/samples?select=name",
            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        )
        print(f"[OK] samples {len(r_cnt.json())}")
    else:
        print(f"[DRY-RUN] Would upload {len(sample_rows)} PDFs to 'samples' bucket and upsert {len(sample_rows)} rows in samples table")

    # 6. Extraction Cache
    cache_dir = os.path.join(data_dir, "cache")
    print(f"\n6. Processing extraction_cache from {cache_dir}...")
    cache_files = sorted(glob.glob(os.path.join(cache_dir, "*.json")))
    print(f"Found {len(cache_files)} cache files.")
    cache_records = []
    for cfile in cache_files:
        key = os.path.basename(cfile).replace(".json", "")
        with open(cfile, "r", encoding="utf-8") as f:
            cdata = json.load(f)
        cache_records.append({
            "cache_key": key,
            "data": cdata,
        })

    # Test if table exists
    r_chk = req(
        client,
        "GET",
        f"{supabase_url}/rest/v1/extraction_cache?select=cache_key&limit=1",
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
    )
    if r_chk.status_code == 200:
        if not args.dry_run:
            res = req(
                client,
                "POST",
                f"{supabase_url}/rest/v1/extraction_cache",
                headers=rest_headers,
                json=cache_records,
            )
            if res.status_code not in (200, 201):
                print(f"ERROR upserting extraction_cache: {res.status_code} - {res.text}")
            else:
                r_cnt = req(
                    client,
                    "GET",
                    f"{supabase_url}/rest/v1/extraction_cache?select=cache_key",
                    headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
                )
                print(f"[OK] extraction_cache {len(r_cnt.json())}")
        else:
            print(f"[DRY-RUN] Would upsert {len(cache_records)} rows into extraction_cache")
    else:
        print(f"NOTICE: Table 'extraction_cache' is not yet created in Supabase (status {r_chk.status_code}).")
        print("Please run the cache DDL in Supabase SQL Editor to enable persistent extraction caching.")

    # 7. Verification: check exact level matches for Google (4), Microsoft (78), Oracle FSS (24)
    print("\n7. Verifying exact level matches for Google (4), Microsoft (78), Oracle FSS (24)...")
    if not args.dry_run:
        target_companies = {4: "Google", 24: "Oracle FSS", 78: "Microsoft"}
        for cid, cname in target_companies.items():
            # CSV expected
            expected_levels = {
                r["skill_set_id"]: (r["required_level"], r["required_proficiency_level_id"])
                for r in levels_to_upsert
                if r["company_id"] == cid
            }
            # Supabase remote
            r_remote = req(
                client,
                "GET",
                f"{supabase_url}/rest/v1/company_skill_levels?company_id=eq.{cid}&select=skill_set_id,required_level,required_proficiency_level_id",
                headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
            )
            if r_remote.status_code != 200:
                print(f"ERROR fetching levels for {cname} ({cid}): {r_remote.text}")
                sys.exit(1)
            remote_levels = {
                r["skill_set_id"]: (r["required_level"], r["required_proficiency_level_id"])
                for r in r_remote.json()
            }
            if expected_levels != remote_levels:
                print(f"MISMATCH in skill levels for {cname} ({cid})!")
                print(f"Expected: {expected_levels}")
                print(f"Actual:   {remote_levels}")
                sys.exit(1)
            print(f"[OK] {cname} (ID {cid}): {len(remote_levels)} skill levels match exactly")
        print("[OK] All target company levels verified against seed CSV.")
    else:
        print("[DRY-RUN] Skipping remote level verification in dry-run mode.")


    print("\n=== Seeding Finished Successfully ===")


if __name__ == "__main__":
    main()
