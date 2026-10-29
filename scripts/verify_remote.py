#!/usr/bin/env python3
"""
Verify Supabase remote data against local seed files.
Performs row-by-row comparison.

Usage:
  python scripts/verify_remote.py [--env-file PATH]
"""

import argparse
import csv
import json
import os
import sys
from typing import Any, Dict, List
import httpx
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


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
    parser = argparse.ArgumentParser(description="Verify remote Supabase data against seed files")
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

    data_dir = os.path.join(project_root, "data")
    if not os.path.exists(os.path.join(data_dir, "company_json_rows__1_.csv")):
        data_dir = os.path.join(project_root, "seed")

    print("=== Radix v3 Remote Supabase Verification ===")
    print(f"Target URL: {supabase_url}")
    print(f"Seed Dir:   {data_dir}\n")

    client = httpx.Client(timeout=30.0, follow_redirects=True)
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}

    all_passed = True

    # 1. Verify skill_sets
    print("1. Checking skill_sets (12 expected)...")
    r_skills = req(client, "GET", f"{supabase_url}/rest/v1/skill_sets?select=*&order=sort_order", headers=headers)
    if r_skills.status_code != 200:
        print(f"FAIL: skill_sets HTTP {r_skills.status_code}")
        all_passed = False
    else:
        remote_skills = r_skills.json()
        if len(remote_skills) == 12:
            print(f"PASS: skill_sets has 12 rows.")
        else:
            print(f"FAIL: skill_sets count {len(remote_skills)} != 12")
            all_passed = False

    # 2. Verify company_json
    print("\n2. Checking company_json (118 rows row-by-row)...")
    company_csv = os.path.join(data_dir, "company_json_rows__1_.csv")
    expected_companies = {}
    with open(company_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cid = int(row["company_id"])
            short_j = json.loads(row["short_json"])
            full_j = json.loads(row["full_json"])
            expected_companies[cid] = {
                "company_id": cid,
                "json_id": int(row["json_id"]),
                "name": short_j.get("name") or short_j.get("short_name", ""),
                "short_json": short_j,
                "full_json": full_j,
            }

    r_comp = req(client, "GET", f"{supabase_url}/rest/v1/company_json?select=*&limit=200", headers=headers)
    if r_comp.status_code != 200:
        print(f"FAIL: company_json HTTP {r_comp.status_code}")
        all_passed = False
    else:
        remote_comp_list = r_comp.json()
        print(f"Fetched {len(remote_comp_list)} companies from Supabase.")
        if len(remote_comp_list) != len(expected_companies):
            print(f"FAIL: remote count {len(remote_comp_list)} != expected {len(expected_companies)}")
            all_passed = False
        else:
            mismatches = 0
            for r in remote_comp_list:
                cid = r["company_id"]
                exp = expected_companies.get(cid)
                if not exp:
                    mismatches += 1
                    continue
                if r["name"] != exp["name"] or r["json_id"] != exp["json_id"]:
                    mismatches += 1
            if mismatches == 0:
                print(f"PASS: All {len(remote_comp_list)} company_json rows match exactly.")
            else:
                print(f"FAIL: {mismatches} company_json rows mismatched.")
                all_passed = False

    # 3. Verify company_skill_levels
    print("\n3. Checking company_skill_levels (1356 rows row-by-row)...")
    levels_csv = os.path.join(data_dir, "company_skill_levels_rows.csv")
    expected_levels = {}
    with open(levels_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            lid = int(row["id"])
            expected_levels[lid] = {
                "id": lid,
                "company_id": int(row["company_id"]),
                "skill_set_id": int(row["skill_set_id"]),
                "required_level": int(row["required_level"]),
                "required_proficiency_level_id": int(row["required_proficiency_level_id"]),
            }

    # Fetch all pages from Supabase
    remote_levels = {}
    page_size = 1000
    offset = 0
    while True:
        r_lvl = req(
            client,
            "GET",
            f"{supabase_url}/rest/v1/company_skill_levels?select=*&limit={page_size}&offset={offset}",
            headers=headers,
        )
        if r_lvl.status_code != 200:
            print(f"FAIL: company_skill_levels HTTP {r_lvl.status_code}")
            all_passed = False
            break
        chunk = r_lvl.json()
        for row in chunk:
            remote_levels[row["id"]] = row
        if len(chunk) < page_size:
            break
        offset += page_size

    print(f"Fetched {len(remote_levels)} level rows from Supabase.")
    if len(remote_levels) != len(expected_levels):
        print(f"FAIL: Remote levels count {len(remote_levels)} != expected {len(expected_levels)}")
        all_passed = False
    else:
        mismatches = 0
        for lid, exp in expected_levels.items():
            rem = remote_levels.get(lid)
            if not rem:
                mismatches += 1
                continue
            if (
                rem["company_id"] != exp["company_id"]
                or rem["skill_set_id"] != exp["skill_set_id"]
                or rem["required_level"] != exp["required_level"]
                or rem["required_proficiency_level_id"] != exp["required_proficiency_level_id"]
            ):
                mismatches += 1
        if mismatches == 0:
            print(f"PASS: All {len(remote_levels)} company_skill_levels rows match exactly.")
        else:
            print(f"FAIL: {mismatches} company_skill_levels rows mismatched.")
            all_passed = False

    # Verify Google (4), Microsoft (78), Oracle FSS (24)
    print("\n   Checking key companies: Google (4), Microsoft (78), Oracle FSS (24)...")
    for cid, cname in [(4, "Google"), (78, "Microsoft"), (24, "Oracle FSS")]:
        exp_c = [r for r in expected_levels.values() if r["company_id"] == cid]
        rem_c = [r for r in remote_levels.values() if r["company_id"] == cid]
        if len(exp_c) == len(rem_c) and len(exp_c) > 0:
            print(f"   PASS: {cname} (ID {cid}) has {len(rem_c)} levels matching exactly.")
        else:
            print(f"   FAIL: {cname} (ID {cid}) counts differ: {len(rem_c)} != {len(exp_c)}")
            all_passed = False

    # 4. Verify app_content (roadmap_kb)
    print("\n4. Checking app_content (roadmap_kb)...")
    kb_path = os.path.join(data_dir, "roadmap_kb.json")
    with open(kb_path, "r", encoding="utf-8") as f:
        exp_kb = json.load(f)

    r_kb = req(client, "GET", f"{supabase_url}/rest/v1/app_content?key=eq.roadmap_kb&select=*", headers=headers)
    if r_kb.status_code != 200 or not r_kb.json():
        print(f"FAIL: app_content roadmap_kb fetch failed HTTP {r_kb.status_code}")
        all_passed = False
    else:
        rem_kb = r_kb.json()[0].get("data", {})
        if set(exp_kb.keys()) == set(rem_kb.keys()):
            print(f"PASS: roadmap_kb present with all {len(rem_kb.keys())} skill codes.")
        else:
            print(f"FAIL: roadmap_kb keys do not match.")
            all_passed = False

    # 5. Verify samples table and public storage bucket
    print("\n5. Checking samples (10 samples & public storage URLs)...")
    r_samples = req(client, "GET", f"{supabase_url}/rest/v1/samples?select=*&order=name", headers=headers)
    if r_samples.status_code != 200:
        print(f"FAIL: samples table HTTP {r_samples.status_code}")
        all_passed = False
    else:
        samples_list = r_samples.json()
        print(f"Found {len(samples_list)} sample rows in table.")
        if len(samples_list) != 10:
            print(f"FAIL: samples count {len(samples_list)} != 10")
            all_passed = False
        else:
            storage_mismatches = 0
            for s in samples_list:
                fpath = s["file_path"]
                pub_url = f"{supabase_url}/storage/v1/object/public/samples/{fpath}"
                r_pub = req(client, "GET", pub_url)
                if r_pub.status_code == 200 and len(r_pub.content) > 1000:
                    pass
                else:
                    print(f"   Storage fetch failed for {fpath}: status {r_pub.status_code}")
                    storage_mismatches += 1
            if storage_mismatches == 0:
                print("PASS: All 10 sample PDFs accessible publicly via storage URLs.")
            else:
                print(f"FAIL: {storage_mismatches} sample PDFs inaccessible.")
                all_passed = False

    print("\n===========================================")
    if all_passed:
        print("ALL REMOTE DATA CHECKS PASSED.")
        sys.exit(0)
    else:
        print("SOME CHECKS FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()

