#!/usr/bin/env python3
"""
Create data/snapshot/ JSON files from local seed files.
Used for offline snapshot fallback when ALLOW_SNAPSHOT_FALLBACK=1.
"""

import csv
import json
import os
import sys

def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(project_root, "data")
    if not os.path.exists(data_dir):
        data_dir = os.path.join(project_root, "seed")

    snapshot_dir = os.path.join(project_root, "data", "snapshot")
    os.makedirs(snapshot_dir, exist_ok=True)

    print(f"Generating snapshots into {snapshot_dir} from {data_dir}...")

    # 1. skill_sets.json
    skill_sets = [
        {"id": 1, "code": "COD", "name": "Coding", "sort_order": 1},
        {"id": 2, "code": "DSA", "name": "Data Structures & Algorithms", "sort_order": 2},
        {"id": 3, "code": "APTI", "name": "Aptitude & Problem Solving", "sort_order": 3},
        {"id": 4, "code": "COMM", "name": "Communication Skills", "sort_order": 4},
        {"id": 5, "code": "OOD", "name": "Object-Oriented Programming & Design", "sort_order": 5},
        {"id": 6, "code": "AI", "name": "AI-Native Engineering", "sort_order": 6},
        {"id": 7, "code": "SQL", "name": "SQL & Design", "sort_order": 7},
        {"id": 8, "code": "SYSD", "name": "System Design & Architecture", "sort_order": 8},
        {"id": 9, "code": "CLOUD", "name": "DevOps & Cloud", "sort_order": 9},
        {"id": 10, "code": "SWE", "name": "Software Engineering", "sort_order": 10},
        {"id": 11, "code": "NETW", "name": "Computer Networking", "sort_order": 11},
        {"id": 12, "code": "OS", "name": "Operating Systems", "sort_order": 12},
    ]
    with open(os.path.join(snapshot_dir, "skill_sets.json"), "w", encoding="utf-8") as f:
        json.dump(skill_sets, f, indent=2)

    # 2. company_json.json
    company_csv = os.path.join(data_dir, "company_json_rows__1_.csv")
    companies = []
    with open(company_csv, "r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            short_j = json.loads(r["short_json"])
            full_j = json.loads(r["full_json"])
            name = short_j.get("name") or short_j.get("short_name", "")
            companies.append({
                "company_id": int(r["company_id"]),
                "json_id": int(r["json_id"]),
                "name": name,
                "short_json": short_j,
                "full_json": full_j,
            })
    with open(os.path.join(snapshot_dir, "companies.json"), "w", encoding="utf-8") as f:
        json.dump(companies, f)

    # 3. company_skill_levels.json
    levels_csv = os.path.join(data_dir, "company_skill_levels_rows.csv")
    levels = []
    with open(levels_csv, "r", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            levels.append({
                "id": int(r["id"]),
                "company_id": int(r["company_id"]),
                "skill_set_id": int(r["skill_set_id"]),
                "required_level": int(r["required_level"]),
                "required_proficiency_level_id": int(r["required_proficiency_level_id"]),
            })
    with open(os.path.join(snapshot_dir, "company_skill_levels.json"), "w", encoding="utf-8") as f:
        json.dump(levels, f)

    # 4. roadmap_kb.json
    kb_path = os.path.join(data_dir, "roadmap_kb.json")
    with open(kb_path, "r", encoding="utf-8") as f:
        kb_data = json.load(f)
    with open(os.path.join(snapshot_dir, "roadmap_kb.json"), "w", encoding="utf-8") as f:
        json.dump(kb_data, f)

    # 5. samples.json
    # Read sample metadata
    sys.path.insert(0, project_root)
    from app.samples_meta import get_samples_meta
    smeta = get_samples_meta()
    with open(os.path.join(snapshot_dir, "samples.json"), "w", encoding="utf-8") as f:
        json.dump(smeta, f, indent=2)

    print("Snapshot files successfully generated in data/snapshot/:")
    for fname in os.listdir(snapshot_dir):
        sz = os.path.getsize(os.path.join(snapshot_dir, fname))
        print(f"  {fname}: {sz} bytes")

if __name__ == "__main__":
    main()

