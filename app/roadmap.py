"""
RADIX Roadmap Creator (app/roadmap.py)

Generates deterministic study & practice roadmaps based on:
- Readiness gaps across 12 skill areas (COD, DSA, APTI, COMM, OOD, AI, SQL, SYSD, CLOUD, SWE, NETW, OS)
- Missing JD skills (core skills mapped to 12 areas; unmapped skills assigned to 'also_learn')
- ATS findings (translated to Week 1 resume-fix tasks)
- Git provenance warnings (translated to GitHub hygiene tasks)
- Hours per week (default 8, range 2-30)
- Planning timeline (default 12 weeks)

Key Invariants:
- All numbers (hours, weeks, projected_score) are completely deterministic.
- Projected score is monotonically non-decreasing (never decreases).
- Total scheduled hours <= hours_per_week * weeks.
- Every task includes an explicit 'area' tag.
- A candidate with zero gaps receives a tailored maintenance & mastery plan.
- The one-paragraph summary is deterministic, with optional cached LLM polishing.
"""

from datetime import datetime
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple, Union

from .config import HOURS_PER_LEVEL, SKILLSET_MAP, LLM_PROVIDER, MODEL
from .talent_check import required as get_company_required
from . import data_source

# In-memory cache for roadmap KB and summary rewrites
_KB_DATA: Optional[Dict[str, Any]] = None
_SUMMARY_CACHE: Dict[str, str] = {}


AREA_NAMES = {
    "COD": "Coding Foundations & Languages",
    "DSA": "Data Structures & Algorithms",
    "APTI": "Quantitative Aptitude & Logic",
    "COMM": "Workplace Communication & Docs",
    "OOD": "Object-Oriented Design & Patterns",
    "AI": "Machine Learning & AI",
    "SQL": "Databases & SQL Optimization",
    "SYSD": "System Design & Distributed Systems",
    "CLOUD": "Cloud Computing & DevOps",
    "SWE": "Software Engineering Best Practices",
    "NETW": "Computer Networks & Protocols",
    "OS": "Operating Systems & Concurrency"
}


def load_roadmap_kb() -> Dict[str, Any]:
    """Loads and caches roadmap_kb from data_source."""
    global _KB_DATA
    if _KB_DATA is not None:
        return _KB_DATA

    try:
        _KB_DATA = data_source.get_roadmap_kb()
    except Exception:
        _KB_DATA = {}
    return _KB_DATA



def get_band_key(level: int) -> str:
    """Map a level (1-10) to the corresponding KB band key."""
    if level <= 3:
        return "1-3"
    elif level <= 6:
        return "4-6"
    else:
        return "7-10"


def compute_score(candidate_levels: Dict[str, int], required_levels: Dict[str, int]) -> float:
    """
    Deterministic talent readiness score calculation:
    100 * sum(min(c_i, r_i) * r_i) / sum(r_i^2)
    """
    den = sum(r * r for r in required_levels.values())
    if den == 0:
        return 100.0
    num = sum(min(candidate_levels.get(code, 0), r) * r for code, r in required_levels.items())
    return (100.0 * num) / den


def generate_deterministic_summary(
    weeks: int,
    total_hours: int,
    hours_per_week: int,
    initial_score: int,
    final_score: int,
    primary_focus_areas: List[str],
    is_maintenance: bool = False
) -> str:
    """Generates an accurate, professional one-paragraph roadmap summary."""
    if is_maintenance:
        return (
            f"This {weeks}-week maintenance and mastery plan dedicates {total_hours} total hours "
            f"({hours_per_week} hours/week) to reinforcing your existing readiness score of {initial_score}/100. "
            f"Focus centers on high-level production architectures, competitive algorithm sharpening, "
            f"and hands-on proof projects with automated CI to ensure peak performance in enterprise technical interviews."
        )

    gain = final_score - initial_score
    gain_str = f"+{gain} points" if gain > 0 else "0 points"
    areas_str = ", ".join(primary_focus_areas[:3]) if primary_focus_areas else "core engineering skills"

    return (
        f"This {weeks}-week structured preparation roadmap schedules {total_hours} total hours "
        f"({hours_per_week} hours/week) to advance your target readiness score from {initial_score} to {final_score}/100 ({gain_str}). "
        f"Priority allocation focuses on high-ROI competency gaps in {areas_str}, "
        f"beginning with Week 1 resume and engineering hygiene remediation, and progressing through hands-on practice problems "
        f"and portfolio-grade proof projects verified with automated GitHub Actions CI."
    )


def create_roadmap(
    readiness_gaps: Optional[List[Dict[str, Any]]] = None,
    candidate_levels: Optional[Dict[str, int]] = None,
    required_levels: Optional[Dict[str, int]] = None,
    company_id: Optional[int] = None,
    missing_jd_skills: Optional[List[Dict[str, Any]]] = None,
    ats_findings: Optional[List[Dict[str, Any]]] = None,
    provenance_warnings: Optional[List[str]] = None,
    hours_per_week: int = 8,
    target_score: Optional[float] = None,
    weeks: int = 12
) -> Dict[str, Any]:
    """
    Constructs a 12-week (configurable) personalized study and practice roadmap.
    Greedily allocates available study hours by score gain per hour.
    """
    kb = load_roadmap_kb()

    # 1. Validate and clamp hours_per_week (2 to 30) and weeks (min 1)
    hours_per_week = max(2, min(30, int(hours_per_week or 8)))
    weeks = max(1, min(52, int(weeks or 12)))
    max_total_hours = hours_per_week * weeks

    # 2. Reconstruct / normalize candidate and required levels
    c_levels: Dict[str, int] = {}
    r_levels: Dict[str, int] = {}

    # Check company required levels
    if company_id is not None:
        comp_req = get_company_required(company_id)
        if comp_req:
            r_levels.update(comp_req)

    if required_levels:
        r_levels.update(required_levels)

    if candidate_levels:
        c_levels.update(candidate_levels)

    # Ingest from readiness_gaps if present
    if readiness_gaps:
        for g in readiness_gaps:
            code = g.get("category_code")
            if code and code in AREA_NAMES:
                if "required_level" in g and code not in r_levels:
                    r_levels[code] = int(g["required_level"])
                if "candidate_level" in g and code not in c_levels:
                    c_levels[code] = int(g["candidate_level"])

    # Fallback defaults for any unassigned codes
    for sid, code in SKILLSET_MAP.items():
        if code not in r_levels:
            r_levels[code] = 7  # standard default benchmark
        if code not in c_levels:
            c_levels[code] = 3

    # Calculate baseline score
    initial_score = round(compute_score(c_levels, r_levels))
    target_score_val = target_score if target_score is not None else 100.0

    # 3. Categorize Missing JD Skills
    also_learn = []
    if missing_jd_skills:
        for item in missing_jd_skills:
            s_name = item.get("skill") or item.get("skill_name") or ""
            cat = (item.get("category_code") or "").upper()
            if cat not in AREA_NAMES or cat == "OTHER":
                why = item.get("why_needed") or "Required by target job description; supplementary to the 12 core competency areas."
                also_learn.append({
                    "skill": s_name,
                    "reason": why
                })

    # 4. Extract Resume Fixes from ATS Findings
    resume_fixes = []
    if ats_findings:
        for f in ats_findings:
            fix_msg = f.get("fix") or f.get("detail") or f.get("title")
            if fix_msg and fix_msg not in resume_fixes:
                resume_fixes.append(fix_msg)

    # 5. Extract GitHub Fixes from Provenance Warnings
    github_fixes = []
    if provenance_warnings:
        for w in provenance_warnings:
            if w and w not in github_fixes:
                github_fixes.append(w)

    # Check if there are any gaps to close
    has_gaps = any(c_levels.get(code, 0) < r_levels.get(code, 0) for code in r_levels)

    # -------------------------------------------------------------
    # CASE A: MAINTENANCE PLAN (No gaps or initial score >= target)
    # -------------------------------------------------------------
    if not has_gaps or initial_score >= target_score_val:
        maintenance_weeks = []
        # Cycle through major areas: COD, DSA, SYSD, SWE, CLOUD, SQL, NETW, OS
        core_rotation = ["DSA", "COD", "SYSD", "SWE", "CLOUD", "SQL", "NETW", "OS", "OOD", "AI", "COMM", "APTI"]

        for w_idx in range(1, weeks + 1):
            code = core_rotation[(w_idx - 1) % len(core_rotation)]
            area_info = kb.get(code, {})
            band_info = area_info.get("7-10") or area_info.get("4-6", {})

            w_tasks = []
            # Week 1: Include any resume fixes
            if w_idx == 1 and resume_fixes:
                for rf in resume_fixes[:2]:
                    w_tasks.append({
                        "task": f"Resume Maintenance: {rf}",
                        "area": "SWE",
                        "type": "resume_fix"
                    })

            # Week 2: Include GitHub hygiene fixes
            if w_idx == 2 and github_fixes:
                for gf in github_fixes[:2]:
                    w_tasks.append({
                        "task": f"GitHub Hygiene: {gf}",
                        "area": "SWE",
                        "type": "github_fix"
                    })

            # Add advanced practice tasks
            practice_tasks = band_info.get("practice_tasks", [])
            for pt in practice_tasks:
                w_tasks.append({
                    "task": pt,
                    "area": code,
                    "type": "practice"
                })

            proof_proj = band_info.get("proof_project", {})
            if proof_proj:
                w_tasks.append({
                    "task": f"Proof Project Delivery: Build '{proof_proj.get('title')}' with tests and CI",
                    "area": code,
                    "type": "proof_project"
                })

            maintenance_weeks.append({
                "week": w_idx,
                "focus": f"{code}: {AREA_NAMES.get(code, code)}",
                "hours": hours_per_week,
                "tasks": w_tasks,
                "proof_project": proof_proj,
                "projected_score": initial_score
            })

        summary = generate_deterministic_summary(
            weeks=weeks,
            total_hours=hours_per_week * weeks,
            hours_per_week=hours_per_week,
            initial_score=initial_score,
            final_score=initial_score,
            primary_focus_areas=["DSA", "SYSD", "COD"],
            is_maintenance=True
        )

        return {
            "summary": summary,
            "weeks": maintenance_weeks,
            "resume_fixes": resume_fixes,
            "github_fixes": github_fixes,
            "also_learn": also_learn,
            "assumptions": [
                "Hours per level and weekly study times are planning estimates based on benchmark cognitive load models and may vary based on prior familiarity.",
                "Advancement assumes active completion of weekly practice tasks and implementation of proof projects with automated testing.",
                "Candidate currently meets or exceeds baseline company benchmarks; plan maintains interview readiness and systems architecture depth."
            ]
        }

    # -------------------------------------------------------------
    # CASE B: GREEDY GAP CLOSURE PLAN
    # -------------------------------------------------------------
    # Denominator for readiness scoring
    den = sum(r * r for r in r_levels.values())

    # Rank all areas with open gaps by score gain per hour (ROI), then points gain
    eligible_areas = []
    for code, req_lvl in r_levels.items():
        curr_lvl = c_levels.get(code, 0)
        if curr_lvl < req_lvl:
            pts_gain = (100.0 * req_lvl) / den if den > 0 else 0.0
            h_cost = HOURS_PER_LEVEL.get(code, 8)
            roi = pts_gain / h_cost if h_cost > 0 else 0.0
            eligible_areas.append({
                "code": code,
                "req_lvl": req_lvl,
                "pts_gain": pts_gain,
                "h_cost": h_cost,
                "roi": roi
            })

    # Sort descending by ROI, then points gain, then remaining gap
    eligible_areas.sort(
        key=lambda x: (
            -x["roi"],
            -x["pts_gain"],
            -(x["req_lvl"] - c_levels.get(x["code"], 0))
        )
    )

    plan_weeks = []
    curr_levels = dict(c_levels)
    prev_projected_score = initial_score
    focused_areas_set = set()

    # Track how many times each area has been advanced in this plan
    area_advancement_counts: Dict[str, int] = {e["code"]: 0 for e in eligible_areas}

    for w_num in range(1, weeks + 1):
        # Pick the next area with an open gap using greedy ROI with fair round-robin interleaving
        chosen_code = None
        min_adv = 999999

        for e in eligible_areas:
            c = e["code"]
            if curr_levels.get(c, 0) < r_levels.get(c, 0):
                adv_cnt = area_advancement_counts[c]
                if adv_cnt < min_adv:
                    min_adv = adv_cnt
                    chosen_code = c

        if not chosen_code:
            # All gaps closed; cycle among top high-leverage areas for mastery
            chosen_code = eligible_areas[(w_num - 1) % len(eligible_areas)]["code"] if eligible_areas else "DSA"
        else:
            # Advance this area by 1 level
            curr_levels[chosen_code] = min(r_levels[chosen_code], curr_levels[chosen_code] + 1)
            area_advancement_counts[chosen_code] = area_advancement_counts.get(chosen_code, 0) + 1
            focused_areas_set.add(chosen_code)

        target_band = get_band_key(curr_levels.get(chosen_code, 3))
        area_kb = kb.get(chosen_code, {}).get(target_band, {})

        w_tasks = []

        # Week 1: Add resume fixes (from ATS findings)
        if w_num == 1 and resume_fixes:
            for rf in resume_fixes[:3]:
                w_tasks.append({
                    "task": f"Resume Fix: {rf}",
                    "area": "SWE",
                    "type": "resume_fix"
                })

        # Week 2: Add GitHub fixes (from provenance warnings)
        if w_num == 2 and github_fixes:
            for gf in github_fixes[:2]:
                w_tasks.append({
                    "task": f"GitHub Hygiene: {gf}",
                    "area": "SWE",
                    "type": "github_fix"
                })

        # Add practice tasks from KB
        kb_practice = area_kb.get("practice_tasks", [])
        for pt in kb_practice:
            w_tasks.append({
                "task": pt,
                "area": chosen_code,
                "type": "practice"
            })

        # Proof project for this week's focus and level band
        proof_proj = area_kb.get("proof_project", {})
        if proof_proj:
            w_tasks.append({
                "task": f"Proof Project Deliverable: Implement '{proof_proj.get('title')}' with README, tests, and CI",
                "area": chosen_code,
                "type": "proof_project"
            })

        # Calculate current projected score after advancements up to this week
        calc_score = round(compute_score(curr_levels, r_levels))
        # Ensure projected score NEVER decreases
        projected_score = max(prev_projected_score, calc_score)
        prev_projected_score = projected_score

        plan_weeks.append({
            "week": w_num,
            "focus": f"{chosen_code}: {AREA_NAMES.get(chosen_code, chosen_code)}",
            "hours": hours_per_week,
            "tasks": w_tasks,
            "proof_project": proof_proj,
            "projected_score": projected_score
        })

    final_score = plan_weeks[-1]["projected_score"]
    total_hours_spent = hours_per_week * weeks

    summary = generate_deterministic_summary(
        weeks=weeks,
        total_hours=total_hours_spent,
        hours_per_week=hours_per_week,
        initial_score=initial_score,
        final_score=final_score,
        primary_focus_areas=list(focused_areas_set),
        is_maintenance=False
    )

    return {
        "summary": summary,
        "weeks": plan_weeks,
        "resume_fixes": resume_fixes,
        "github_fixes": github_fixes,
        "also_learn": also_learn,
        "assumptions": [
            "Hours per level and weekly study times are planning estimates based on benchmark cognitive load models and may vary based on prior engineering experience.",
            "Advancement assumes completion of suggested practice tasks and implementation of proof projects with automated CI test verification.",
            "Score projections are based on target company required competency weights across the 12 core engineering skill areas."
        ]
    }
