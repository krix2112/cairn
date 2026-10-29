"""
RADIX Git Provenance Engine (app/provenance.py)

Purpose:
Check whether the GitHub evidence behind a resume's claims looks real,
from public GitHub REST data only.
All wording explicitly states: "signals, not proof".

Formula:
provenance score 0-100 = 40 x claim support + 30 x average repo strength + 20 x activity consistency + 10 x hygiene
- claim support (0 to 1): Average support of resume project claims (Supported=1.0, Weak=0.4, Not found=0.0)
  and programming language claims (Verified=1.0, Minor=0.5, No public code=0.0).
- average repo strength (0 to 1): Average evidence strength of analyzed non-fork repositories
  (Strong=1.0, Moderate=0.6, Weak=0.2, Not enough data=0.0).
- activity consistency (0 to 1): Proportion of repositories with iterative commit distributions
  (penalizing single-day dumps) plus multi-month development spread bonus.
- hygiene (0 to 1): Proportion of repositories meeting engineering standards (README, tests, CI, license).
"""

from datetime import datetime, timezone
import hashlib
import json
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple, Union

from rapidfuzz import fuzz
import requests

from .store import get_store

# 6-hour caching for GitHub API responses: key -> (timestamp, data, headers)
_GITHUB_CACHE: Dict[str, Tuple[float, Any, Dict[str, str]]] = {}
CACHE_TTL_SECONDS = 6 * 3600

# Canonical programming languages recognized for skill claim checks
PROGRAMMING_LANGUAGES = {
    "python", "c++", "cpp", "c", "java", "javascript", "typescript", "golang",
    "go", "rust", "c#", "csharp", "ruby", "php", "swift", "kotlin", "scala",
    "shell", "bash", "html", "css", "sql", "dart", "r", "julia", "elixir",
    "haskell", "clojure", "lua", "perl"
}


def _clean_username(username: str) -> str:
    """Normalize GitHub username from handle or full URL."""
    u = username.strip()
    if "github.com/" in u:
        u = u.split("github.com/")[-1].strip("/")
    u = u.lstrip("@").strip().rstrip("/")
    if "?" in u:
        u = u.split("?")[0]
    if "/" in u:
        u = u.split("/")[0]
    return u


def _get_auth_headers() -> Dict[str, str]:
    """Build headers for GitHub REST API. GITHUB_TOKEN is used if present and never logged."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "RADIX-Git-Provenance-Engine"
    }
    token = os.getenv("GITHUB_TOKEN")
    if token and token.strip():
        headers["Authorization"] = f"token {token.strip()}"
    return headers


def _fetch_github_api(
    url: str,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 6.0
) -> Tuple[int, Any, Dict[str, str]]:
    """
    Cached HTTP GET against GitHub REST API with 6-hour TTL.
    Returns (status_code, response_json, headers_dict).
    """
    now = time.time()
    cache_key = url
    if cache_key in _GITHUB_CACHE:
        ts, data, hdrs = _GITHUB_CACHE[cache_key]
        if now - ts < CACHE_TTL_SECONDS:
            return 200, data, hdrs

    store_key = hashlib.sha256(url.encode()).hexdigest()
    store, _ = get_store()
    cached = store.get("github", store_key)
    if cached and isinstance(cached, dict) and "data" in cached:
        data = cached["data"]
        hdrs = cached.get("headers", {})
        _GITHUB_CACHE[cache_key] = (now, data, hdrs)
        return 200, data, hdrs

    req_headers = _get_auth_headers()
    if headers:
        req_headers.update(headers)

    try:
        resp = requests.get(url, headers=req_headers, timeout=timeout)
        hdrs = dict(resp.headers)
        if resp.status_code == 200:
            data = resp.json()
            _GITHUB_CACHE[cache_key] = (now, data, hdrs)
            store.set("github", store_key, {"data": data, "headers": hdrs}, ttl_seconds=CACHE_TTL_SECONDS)
            return 200, data, hdrs
        else:
            try:
                err_data = resp.json()
            except Exception:
                err_data = {"message": resp.text}
            return resp.status_code, err_data, hdrs
    except Exception as e:
        return 500, {"message": str(e)}, {}


def parse_projects_from_resume_text(text: str) -> List[Dict[str, str]]:
    """
    Extract project titles and descriptions from the Projects section of resume text.
    Handles standard bullet formatting and clean section extraction.
    """
    if not text or not text.strip():
        return []

    lines = text.splitlines()
    in_projects = False
    project_lines: List[str] = []

    # Section headers triggering start of Projects section
    start_pattern = re.compile(
        r"^(?:[#*_\s]*)(?:academic\s+|technical\s+|personal\s+)?projects(?:\s*[:\-–]?\s*)$",
        re.IGNORECASE
    )
    # Section headers that mark the end of the Projects section
    end_pattern = re.compile(
        r"^(?:[#*_\s]*)(?:experience|work\s+experience|internships|hackathons|education|skills|certifications|achievements|publications|preferred\s+roles)(?:\s*[:\-–/]?\s*)",
        re.IGNORECASE
    )

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if not in_projects:
            if start_pattern.match(stripped):
                in_projects = True
                continue
        else:
            if end_pattern.match(stripped) and len(project_lines) > 0:
                break
            project_lines.append(stripped)

    # If no explicit Projects section header was found, fallback to scanning entire text for project-like bullets
    raw_entries: List[str] = []
    if project_lines:
        current_bullet: List[str] = []
        for line in project_lines:
            if re.match(r"^[•\*\-\u2022\u25cf\u25cb]|\d+[\.\)]\s+", line):
                if current_bullet:
                    raw_entries.append(" ".join(current_bullet))
                    current_bullet = []
                cleaned = re.sub(r"^[•\*\-\u2022\u25cf\u25cb]|\d+[\.\)]\s+", "", line).strip()
                current_bullet.append(cleaned)
            else:
                if current_bullet:
                    current_bullet.append(line)
                elif len(raw_entries) == 0:
                    current_bullet.append(line)
        if current_bullet:
            raw_entries.append(" ".join(current_bullet))

    # Parse into structured name + description dicts
    projects = []
    for entry in raw_entries:
        entry_clean = re.sub(r"\s+", " ", entry).strip()
        if len(entry_clean) < 10:
            continue

        # Look for title separators: "Title: Description" or "Title - Description"
        split_match = re.split(r"\s*[:\-–—]\s*", entry_clean, maxsplit=1)
        if len(split_match) == 2 and len(split_match[0]) <= 50 and len(split_match[0].split()) <= 7:
            title = split_match[0].strip()
            desc = split_match[1].strip()
        else:
            # First clause or sentence up to 60 chars as title
            parts = re.split(r"[,;.]\s*", entry_clean)
            title = parts[0].strip()
            if len(title.split()) > 8 or len(title) > 60:
                title = " ".join(title.split()[:6])
            desc = entry_clean

        projects.append({
            "name": title,
            "description": desc
        })

    return projects


def _check_history_shape(commit_timestamps: List[str]) -> Tuple[bool, float, str]:
    """
    Analyzes commit distribution. Flags if >= 70% of candidate commits occur within a 24-hour window,
    or if 1-2 commits add the entire codebase.
    Returns (flagged, max_24h_ratio, plain_english_reason).
    """
    if not commit_timestamps:
        return False, 0.0, "No commit activity records available (signals, not proof)."

    if len(commit_timestamps) in (1, 2):
        return True, 1.0, (
            "Flagged: Entire repository history consists of only 1-2 commits, "
            "indicating a single bulk upload rather than iterative development (signals, not proof)."
        )

    # Parse timestamps to float epochs
    epochs = []
    for ts in commit_timestamps:
        try:
            # Replace Z with UTC timezone
            cleaned_ts = ts.replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned_ts)
            epochs.append(dt.timestamp())
        except Exception:
            continue

    if not epochs:
        return False, 0.0, "Unable to parse commit dates (signals, not proof)."

    epochs.sort()
    n = len(epochs)
    max_in_24h = 1

    # 24 hours in seconds = 86400
    for i in range(n):
        window_end = epochs[i] + 86400
        count = 1
        for j in range(i + 1, n):
            if epochs[j] <= window_end:
                count += 1
            else:
                break
        if count > max_in_24h:
            max_in_24h = count

    ratio = max_in_24h / n
    pct = round(ratio * 100, 1)

    if ratio >= 0.70:
        return True, ratio, (
            f"Flagged: {pct}% of candidate commits occurred within a 24-hour window, "
            "suggesting a bulk import or single-day upload rather than sustained iterative development (signals, not proof)."
        )

    return False, ratio, (
        f"Iterative commit history: largest 24-hour commit burst represents {pct}% of total commits, "
        "indicating sustained progression over time (signals, not proof)."
    )


def _check_default_branch_tree(owner: str, repo_name: str) -> Dict[str, Any]:
    """
    Checks the default-branch root contents for README, test suite, CI workflows, and license.
    """
    url = f"https://api.github.com/repos/{owner}/{repo_name}/contents"
    status, contents, _ = _fetch_github_api(url)

    hygiene = {
        "readme": False,
        "readme_name": "",
        "readme_snippet": "",
        "tests": False,
        "ci": False,
        "license": False
    }

    if status != 200 or not isinstance(contents, list):
        return hygiene

    for item in contents:
        name = item.get("name", "")
        name_lower = name.lower()
        item_type = item.get("type", "file")

        # README
        if "readme" in name_lower:
            hygiene["readme"] = True
            hygiene["readme_name"] = name

        # Tests
        if item_type == "dir" and name_lower in ("test", "tests", "spec", "specs", "__tests__", "testing"):
            hygiene["tests"] = True
        elif item_type == "file" and (name_lower.startswith("test_") or name_lower.endswith(("_test.py", ".test.js", ".spec.ts"))):
            hygiene["tests"] = True

        # CI Workflows (.github, .circleci, .travis.yml)
        if name_lower in (".github", ".circleci", ".travis.yml", ".gitlab-ci.yml"):
            hygiene["ci"] = True

        # License
        if "license" in name_lower or "copying" in name_lower:
            hygiene["license"] = True

    return hygiene


def evaluate_provenance(
    github_username: str,
    resume_text: Optional[str] = None,
    projects: Optional[List[Any]] = None,
    skills: Optional[List[Any]] = None
) -> Dict[str, Any]:
    """
    Main Git Provenance Engine entry point.
    Evaluates public GitHub evidence against resume projects and skills claims.
    All wording emphasizes 'signals, not proof'.
    """
    warnings: List[str] = []
    username = _clean_username(github_username)

    if not username:
        return {
            "score": 0,
            "level": "Not enough data",
            "repos": [],
            "claims": {"projects": [], "languages": []},
            "timeline": [],
            "rate_limit": {"limit": 60, "remaining": 60, "reset": 0},
            "warnings": ["No GitHub username provided for provenance evaluation."],
            "forks_with_zero_commits": []
        }

    token = os.getenv("GITHUB_TOKEN")
    has_token = bool(token and token.strip())
    max_analyze_repos = 8 if has_token else 5

    # 1. Fetch User Profile
    user_url = f"https://api.github.com/users/{username}"
    status, user_data, hdrs = _fetch_github_api(user_url)

    rate_limit = {
        "limit": int(hdrs.get("x-ratelimit-limit", 60)),
        "remaining": int(hdrs.get("x-ratelimit-remaining", 60)),
        "reset": int(hdrs.get("x-ratelimit-reset", 0))
    }

    if status == 404:
        return {
            "score": 0,
            "level": "Not enough data",
            "repos": [],
            "claims": {"projects": [], "languages": []},
            "timeline": [],
            "rate_limit": rate_limit,
            "warnings": [f"GitHub user '{username}' was not found. Signals cannot be verified."],
            "forks_with_zero_commits": []
        }

    if status in (403, 429) or rate_limit["remaining"] <= 0:
        warnings.append("GitHub API rate limit reached. Returning partial result based on available signals.")
        return {
            "score": 0,
            "level": "Not enough data",
            "repos": [],
            "claims": {"projects": [], "languages": []},
            "timeline": [],
            "rate_limit": rate_limit,
            "warnings": warnings,
            "forks_with_zero_commits": []
        }

    public_repos_count = user_data.get("public_repos", 0)
    if public_repos_count == 0:
        return {
            "score": 0,
            "level": "Not enough data",
            "repos": [],
            "claims": {"projects": [], "languages": []},
            "timeline": [],
            "rate_limit": rate_limit,
            "warnings": [f"User '{username}' has no public repositories available for evaluation."],
            "forks_with_zero_commits": []
        }

    # 2. List up to 30 repositories sorted by recent push
    repos_url = f"https://api.github.com/users/{username}/repos?sort=pushed&direction=desc&per_page=30"
    r_status, repos_list, r_hdrs = _fetch_github_api(repos_url)

    if "x-ratelimit-remaining" in r_hdrs:
        rate_limit["remaining"] = int(r_hdrs.get("x-ratelimit-remaining", rate_limit["remaining"]))

    if r_status != 200 or not isinstance(repos_list, list):
        warnings.append("Failed to list public repositories. Returning partial result.")
        return {
            "score": 0,
            "level": "Not enough data",
            "repos": [],
            "claims": {"projects": [], "languages": []},
            "timeline": [],
            "rate_limit": rate_limit,
            "warnings": warnings,
            "forks_with_zero_commits": []
        }

    # Separate non-fork repos and forks
    non_fork_repos = [r for r in repos_list if not r.get("fork")]
    fork_repos = [r for r in repos_list if r.get("fork")]

    # Check forks with zero commits by the candidate
    forks_zero_commits = []
    for fork in fork_repos:
        f_owner = fork.get("owner", {}).get("login", username)
        f_name = fork.get("name", "")
        # Inspect user's commits in fork
        f_commits_url = f"https://api.github.com/repos/{f_owner}/{f_name}/commits?author={username}&per_page=1"
        c_status, c_data, c_hdrs = _fetch_github_api(f_commits_url)
        if "x-ratelimit-remaining" in c_hdrs:
            rate_limit["remaining"] = int(c_hdrs.get("x-ratelimit-remaining", rate_limit["remaining"]))

        has_user_commits = (c_status == 200 and isinstance(c_data, list) and len(c_data) > 0)
        if not has_user_commits:
            forks_zero_commits.append({
                "name": f_name,
                "url": fork.get("html_url", f"https://github.com/{f_owner}/{f_name}"),
                "created_at": fork.get("created_at", "")
            })

    if forks_zero_commits:
        warnings.append(
            f"Candidate has {len(forks_zero_commits)} forked repositories with zero user commits "
            "(fork-only, indicates no original code authored; signals, not proof)."
        )

    # 3. Analyze up to max_analyze_repos non-fork repositories
    repos_to_analyze = non_fork_repos[:max_analyze_repos]
    analyzed_repos = []
    all_monthly_commits: Dict[str, int] = {}
    aggregated_lang_bytes: Dict[str, int] = {}

    for repo in repos_to_analyze:
        owner = repo.get("owner", {}).get("login", username)
        name = repo.get("name", "")
        html_url = repo.get("html_url", f"https://github.com/{owner}/{name}")
        created_at = repo.get("created_at", "")
        stars = repo.get("stargazers_count", 0)
        forks_count = repo.get("forks_count", 0)

        # Languages
        lang_url = f"https://api.github.com/repos/{owner}/{name}/languages"
        l_status, lang_data, l_hdrs = _fetch_github_api(lang_url)
        if "x-ratelimit-remaining" in l_hdrs:
            rate_limit["remaining"] = int(l_hdrs.get("x-ratelimit-remaining", rate_limit["remaining"]))
        repo_languages = lang_data if (l_status == 200 and isinstance(lang_data, dict)) else {}

        for l_name, l_bytes in repo_languages.items():
            aggregated_lang_bytes[l_name] = aggregated_lang_bytes.get(l_name, 0) + int(l_bytes)

        # Candidate's commits
        commits_url = f"https://api.github.com/repos/{owner}/{name}/commits?author={username}&per_page=100"
        cm_status, commits_data, cm_hdrs = _fetch_github_api(commits_url)
        if "x-ratelimit-remaining" in cm_hdrs:
            rate_limit["remaining"] = int(cm_hdrs.get("x-ratelimit-remaining", rate_limit["remaining"]))

        user_commits = commits_data if (cm_status == 200 and isinstance(commits_data, list)) else []
        commit_dates: List[str] = []
        repo_monthly_commits: Dict[str, int] = {}

        for c in user_commits:
            try:
                commit_info = c.get("commit", {})
                d_str = commit_info.get("author", {}).get("date") or commit_info.get("committer", {}).get("date")
                if d_str:
                    commit_dates.append(d_str)
                    m_key = d_str[:7]
                    repo_monthly_commits[m_key] = repo_monthly_commits.get(m_key, 0) + 1
                    all_monthly_commits[m_key] = all_monthly_commits.get(m_key, 0) + 1
            except Exception:
                continue

        commit_dates.sort()
        first_commit = commit_dates[0] if commit_dates else created_at
        last_commit = commit_dates[-1] if commit_dates else created_at

        # Default-branch tree inspection (README, tests, CI, license)
        hygiene = _check_default_branch_tree(owner, name)
        if repo.get("license"):
            hygiene["license"] = True

        # Signals evaluation per repo
        is_dump_flagged, max_burst_ratio, history_reason = _check_history_shape(commit_dates)

        # Authorship share (candidate commits vs total repo commit count)
        user_commit_cnt = len(user_commits)
        authorship_pct = 100.0 if user_commit_cnt > 0 else 0.0
        authorship_reason = (
            f"Candidate authored substantial code ({user_commit_cnt} commits recorded) in this repository (signals, not proof)."
            if user_commit_cnt > 0 else
            "Zero candidate commits detected in repository (signals, not proof)."
        )

        # Hygiene reason
        hygiene_items = []
        if hygiene["readme"]:
            hygiene_items.append("README")
        if hygiene["tests"]:
            hygiene_items.append("tests")
        if hygiene["ci"]:
            hygiene_items.append("CI workflow")
        if hygiene["license"]:
            hygiene_items.append("license")
        hygiene_reason = (
            f"Engineering hygiene present: {', '.join(hygiene_items)} (signals, not proof)."
            if hygiene_items else
            "Minimal engineering hygiene: no automated tests or CI detected (signals, not proof)."
        )

        # External traction bonus
        traction_reason = (
            f"External traction signal: {stars} stars and {forks_count} forks (signals, not proof)."
            if (stars > 0 or forks_count > 0) else
            "No public stars or forks recorded (signals, not proof)."
        )

        # Evidence strength classification: Strong | Moderate | Weak | Not enough data
        if user_commit_cnt == 0:
            evidence_strength = "Not enough data"
        elif is_dump_flagged or (user_commit_cnt <= 2 and not hygiene["tests"]):
            evidence_strength = "Weak"
        elif user_commit_cnt >= 5 and hygiene["readme"] and (hygiene["tests"] or hygiene["ci"]):
            evidence_strength = "Strong"
        else:
            evidence_strength = "Moderate"

        signals = [
            {"signal": "authorship_share", "value": round(authorship_pct, 1), "reason": authorship_reason},
            {"signal": "history_shape", "flagged": is_dump_flagged, "reason": history_reason},
            {"signal": "engineering_hygiene", "reason": hygiene_reason},
            {"signal": "external_traction", "stars": stars, "forks": forks_count, "reason": traction_reason},
            {"signal": "fork_status", "is_fork": False, "reason": "Original repository, not a fork (signals, not proof)."}
        ]

        analyzed_repos.append({
            "name": name,
            "url": html_url,
            "is_fork": False,
            "evidence_strength": evidence_strength,
            "created_at": created_at,
            "first_commit": first_commit,
            "last_commit": last_commit,
            "commit_count": user_commit_cnt,
            "stars": stars,
            "forks": forks_count,
            "languages": repo_languages,
            "hygiene": hygiene,
            "monthly_commits": repo_monthly_commits,
            "signals": signals
        })

    # 4. Claim Checks
    # (1) Resume Projects -> Best matching repo
    project_items: List[Dict[str, str]] = []
    if projects and isinstance(projects, list):
        for p in projects:
            if isinstance(p, dict):
                project_items.append({
                    "name": str(p.get("name", "")),
                    "description": str(p.get("description", ""))
                })
            elif isinstance(p, str):
                project_items.append({"name": p, "description": p})
    elif resume_text:
        project_items = parse_projects_from_resume_text(resume_text)

    project_claims = []
    for proj in project_items:
        p_name = proj["name"]
        p_desc = proj["description"]

        best_score = 0
        best_repo = None

        for r in analyzed_repos:
            # Match project name against repo name
            name_score = fuzz.token_set_ratio(p_name.lower(), r["name"].lower())
            # Match project description against repo name + description
            combined_target = f"{r['name']} {r['hygiene'].get('readme_name', '')}"
            desc_score = fuzz.token_set_ratio(p_desc.lower(), combined_target.lower())
            total_sim = max(name_score, int(0.6 * name_score + 0.4 * desc_score))

            if total_sim > best_score:
                best_score = total_sim
                best_repo = r

        if best_repo and best_score >= 60:
            if best_repo["evidence_strength"] in ("Strong", "Moderate"):
                status_str = "Supported"
                claim_reason = (
                    f"Repository '{best_repo['name']}' ({best_repo['evidence_strength']} evidence) "
                    f"matches project claim '{p_name}' with {best_score}% name/keyword overlap (signals, not proof)."
                )
            else:
                status_str = "Weak"
                claim_reason = (
                    f"Repository '{best_repo['name']}' matches project claim '{p_name}', "
                    "but repository exhibits weak evidence or single-day dump patterns (signals, not proof)."
                )
        elif best_repo and best_score >= 45:
            status_str = "Weak"
            claim_reason = (
                f"Tentative match with repository '{best_repo['name']}' ({best_score}% similarity), "
                "insufficient code overlap to fully verify claim (signals, not proof)."
            )
        else:
            status_str = "Not found"
            claim_reason = f"No public repository matching project claim '{p_name}' was found (signals, not proof)."

        project_claims.append({
            "project_name": p_name,
            "matched_repo": best_repo["name"] if best_repo and best_score >= 45 else None,
            "match_score": best_score,
            "status": status_str,
            "reason": claim_reason
        })

    # (2) Programming Languages in Resume Skills -> Share of Repo Bytes
    skill_names: List[str] = []
    if skills and isinstance(skills, list):
        for s in skills:
            if isinstance(s, dict):
                s_name = s.get("skill_name") or s.get("skill") or ""
                s_cat = s.get("category_code") or ""
                if s_cat == "COD" or s_name.lower() in PROGRAMMING_LANGUAGES:
                    skill_names.append(s_name)
            elif isinstance(s, str):
                if s.lower() in PROGRAMMING_LANGUAGES:
                    skill_names.append(s)

    # Deduplicate skills
    seen_skills = set()
    deduped_skills = []
    for s in skill_names:
        s_norm = s.strip().lower()
        if s_norm not in seen_skills:
            seen_skills.add(s_norm)
            deduped_skills.append(s.strip())

    total_bytes = sum(aggregated_lang_bytes.values())
    language_claims = []

    for s_name in deduped_skills:
        # Find bytes for this language in aggregated_lang_bytes
        matched_bytes = 0
        canonical_lang = s_name
        for lang_k, b_val in aggregated_lang_bytes.items():
            if (lang_k.lower() == s_name.lower()) or (
                s_name.lower() in ("cpp", "c++") and lang_k.lower() in ("c++", "cpp")
            ) or (
                s_name.lower() in ("golang", "go") and lang_k.lower() in ("go", "golang")
            ):
                matched_bytes += b_val
                canonical_lang = lang_k

        share_pct = (matched_bytes / total_bytes * 100.0) if total_bytes > 0 else 0.0

        if share_pct >= 10.0:
            l_status = "Verified (>= 10%)"
            l_reason = (
                f"{round(share_pct, 1)}% of candidate's public repository bytes written in {canonical_lang} "
                f"({matched_bytes:,} bytes, signals, not proof)."
            )
        elif share_pct >= 1.0:
            l_status = "Minor (1-10%)"
            l_reason = (
                f"{round(share_pct, 1)}% of candidate's public repository bytes written in {canonical_lang} "
                f"({matched_bytes:,} bytes, signals, not proof)."
            )
        else:
            l_status = "No public code"
            l_reason = f"No public repository code detected in {s_name} (signals, not proof)."

        language_claims.append({
            "language": s_name,
            "bytes": matched_bytes,
            "share_pct": round(share_pct, 1),
            "status": l_status,
            "reason": l_reason
        })

    # (3) Provenance Score (0 to 100)
    # provenance score 0-100 = 40 x claim support + 30 x average repo strength + 20 x activity consistency + 10 x hygiene
    # Claim support component (0 to 1)
    claim_scores = []
    for pc in project_claims:
        if pc["status"] == "Supported":
            claim_scores.append(1.0)
        elif pc["status"] == "Weak":
            claim_scores.append(0.4)
        else:
            claim_scores.append(0.0)

    for lc in language_claims:
        if lc["status"] == "Verified (>= 10%)":
            claim_scores.append(1.0)
        elif lc["status"] == "Minor (1-10%)":
            claim_scores.append(0.5)
        else:
            claim_scores.append(0.0)

    claim_support = (sum(claim_scores) / len(claim_scores)) if claim_scores else 0.5

    # Average repo strength component (0 to 1)
    strength_map = {"Strong": 1.0, "Moderate": 0.6, "Weak": 0.2, "Not enough data": 0.0}
    repo_scores = [strength_map.get(r["evidence_strength"], 0.0) for r in analyzed_repos]
    avg_repo_strength = (sum(repo_scores) / len(repo_scores)) if repo_scores else 0.0

    # Activity consistency component (0 to 1)
    if analyzed_repos:
        non_dump_count = sum(
            1 for r in analyzed_repos
            if not any(s.get("signal") == "history_shape" and s.get("flagged") for s in r["signals"])
        )
        consistency_ratio = non_dump_count / len(analyzed_repos)
        # Bonus if commits span across multiple months
        month_count = len(all_monthly_commits)
        month_bonus = 0.2 if month_count >= 3 else (0.1 if month_count >= 2 else 0.0)
        activity_consistency = min(1.0, 0.8 * consistency_ratio + month_bonus)
    else:
        activity_consistency = 0.0

    # Hygiene component (0 to 1)
    if analyzed_repos:
        hygiene_scores = []
        for r in analyzed_repos:
            h = r["hygiene"]
            h_score = (0.35 if h["readme"] else 0.0) + \
                      (0.35 if h["tests"] else 0.0) + \
                      (0.20 if h["ci"] else 0.0) + \
                      (0.10 if h["license"] else 0.0)
            hygiene_scores.append(h_score)
        hygiene_val = sum(hygiene_scores) / len(hygiene_scores)
    else:
        hygiene_val = 0.0

    # Calculate overall weighted score
    raw_score = 40.0 * claim_support + 30.0 * avg_repo_strength + 20.0 * activity_consistency + 10.0 * hygiene_val
    final_score = int(round(raw_score))
    final_score = max(0, min(100, final_score))

    if not analyzed_repos:
        evidence_level = "Not enough data"
    elif final_score >= 75:
        evidence_level = "Strong"
    elif final_score >= 50:
        evidence_level = "Moderate"
    elif final_score >= 25:
        evidence_level = "Weak"
    else:
        evidence_level = "Not enough data"

    # Timeline sorted chronologically
    timeline = [
        {"month": m, "commits": count}
        for m, count in sorted(all_monthly_commits.items())
    ]

    return {
        "score": final_score,
        "level": evidence_level,
        "repos": analyzed_repos,
        "claims": {
            "projects": project_claims,
            "languages": language_claims
        },
        "timeline": timeline,
        "rate_limit": rate_limit,
        "warnings": warnings,
        "forks_with_zero_commits": forks_zero_commits
    }

