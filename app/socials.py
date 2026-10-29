import io
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests
from pypdf import PdfReader
from docx import Document
from .store import get_store

# Supported platforms mapping
PLATFORM_DOMAINS = {
    "linkedin": [r"linkedin\.com/in/([a-zA-Z0-9_\-\.]+)/?"],
    "github": [r"github\.com/([a-zA-Z0-9_\-\.]+)/?"],
    "leetcode": [r"leetcode\.com/(?:u/)?([a-zA-Z0-9_\-\.]+)/?"],
    "codeforces": [r"codeforces\.com/profile/([a-zA-Z0-9_\-\.]+)/?"],
    "codechef": [r"codechef\.com/users/([a-zA-Z0-9_\-\.]+)/?"],
    "hackerrank": [r"hackerrank\.com/(?:profile/)?([a-zA-Z0-9_\-\.]+)/?"],
    "kaggle": [r"kaggle\.com/([a-zA-Z0-9_\-\.]+)/?"],
    "geeksforgeeks": [r"geeksforgeeks\.org/user/([a-zA-Z0-9_\-\.]+)/?"],
    "stackoverflow": [r"stackoverflow\.com/users/(\d+)(?:/([a-zA-Z0-9_\-\.]+))?/?"],
    "medium": [r"medium\.com/@?([a-zA-Z0-9_\-\.]+)/?"],
    "twitter": [r"(?:twitter|x)\.com/([a-zA-Z0-9_\-\.]+)/?"]
}

# Regex for bare text handles: e.g. "GitHub: rohanverma", "LeetCode: rohan_v"
BARE_HANDLE_PATTERNS = {
    "github": r"\bgithub\s*[:\-–]\s*@?([a-zA-Z0-9_\-\.]{2,39})\b",
    "leetcode": r"\bleetcode\s*[:\-–]\s*@?([a-zA-Z0-9_\-\.]{2,39})\b",
    "codeforces": r"\bcodeforces\s*[:\-–]\s*@?([a-zA-Z0-9_\-\.]{2,39})\b",
    "codechef": r"\bcodechef\s*[:\-–]\s*@?([a-zA-Z0-9_\-\.]{2,39})\b",
    "hackerrank": r"\bhackerrank\s*[:\-–]\s*@?([a-zA-Z0-9_\-\.]{2,39})\b",
    "kaggle": r"\bkaggle\s*[:\-–]\s*@?([a-zA-Z0-9_\-\.]{2,39})\b",
    "linkedin": r"\blinkedin\s*[:\-–]\s*@?([a-zA-Z0-9_\-\.]{2,39})\b",
    "twitter": r"\b(?:twitter|x)\s*[:\-–]\s*@?([a-zA-Z0-9_\-\.]{2,39})\b",
}

# Cache for social stats: key -> (timestamp, data)
class _StatsCacheDict(dict):
    def clear(self):
        super().clear()
        try:
            store, _ = get_store()
            if hasattr(store, "clear"):
                store.clear()
        except Exception:
            pass

_STATS_CACHE: Dict[Tuple[str, str], Tuple[float, Dict[str, Any]]] = _StatsCacheDict()
CACHE_TTL_SECONDS = 6 * 3600  # 6 hours


def _clean_username(u: str) -> str:
    u = u.strip().rstrip("/")
    if "?" in u:
        u = u.split("?")[0]
    if "#" in u:
        u = u.split("#")[0]
    return u


def _classify_url(url: str, source: str = "text") -> Optional[Dict[str, Any]]:
    if not url:
        return None
    url = url.strip().rstrip(".,;)>]")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    for platform, patterns in PLATFORM_DOMAINS.items():
        for pat in patterns:
            m = re.search(pat, url, re.IGNORECASE)
            if m:
                # Group 1 or Group 2 (for stackoverflow)
                user = m.group(2) if len(m.groups()) >= 2 and m.group(2) else m.group(1)
                user = _clean_username(user)
                if user and user.lower() not in ("in", "users", "profile", "user"):
                    return {
                        "platform": platform,
                        "username": user,
                        "url": url,
                        "source": source,
                        "confidence": "high"
                    }

    # Check if it's a personal website / portfolio
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        
        # Exclude common cloud/mail/document/CDN hosts
        EXCLUDED_DOMAINS = {
            "google.com", "gmail.com", "outlook.com", "yahoo.com", "microsoft.com",
            "drive.google.com", "docs.google.com", "dropbox.com", "amazon.com",
            "cloudflare.com", "vercel.app", "netlify.app", "github.io"
        }
        if domain and "." in domain and domain not in EXCLUDED_DOMAINS:
            # Check if github.io or personal domain
            username = parsed.path.strip("/").split("/")[0] or domain.split(".")[0]
            return {
                "platform": "website",
                "username": username,
                "url": url,
                "source": source,
                "confidence": "medium"
            }
        elif "github.io" in domain:
            user = domain.replace(".github.io", "")
            return {
                "platform": "website",
                "username": user,
                "url": url,
                "source": source,
                "confidence": "high"
            }
    except Exception:
        pass

    return None


def extract_socials(
    resume_text: str,
    file_bytes: Optional[bytes] = None,
    filename: str = ""
) -> List[Dict[str, Any]]:
    """
    Extracts social and coding profile links from resume text, PDF annotations, and DOCX links.
    Stateless, local-only, zero network calls.
    """
    found_map: Dict[Tuple[str, str], Dict[str, Any]] = {}
    fname_lower = filename.lower()

    # 1. Extract links from PDF Annotations (/Annots -> /URI)
    if file_bytes and fname_lower.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                if "/Annots" in page:
                    annots = page["/Annots"]
                    for a in annots:
                        try:
                            obj = a.get_object() if hasattr(a, "get_object") else a
                            if "/A" in obj and "/URI" in obj["/A"]:
                                uri = str(obj["/A"]["/URI"]).strip()
                                item = _classify_url(uri, source="link")
                                if item:
                                    key = (item["platform"], item["username"].lower())
                                    found_map[key] = item
                        except Exception:
                            continue
        except Exception:
            pass

    # 2. Extract links from DOCX relationships (w:hyperlink)
    if file_bytes and fname_lower.endswith(".docx"):
        try:
            doc = Document(io.BytesIO(file_bytes))
            for rel in doc.part.rels.values():
                if "hyperlink" in rel.reltype:
                    target_url = rel.target_ref
                    item = _classify_url(target_url, source="link")
                    if item:
                        key = (item["platform"], item["username"].lower())
                        found_map[key] = item
        except Exception:
            pass

    # 3. Extract URLs in resume text
    url_matches = re.findall(
        r"(?:https?://|www\.)[^\s<>\"'{}|\\^`\[\]]+|(?:linkedin\.com/in/|github\.com/|leetcode\.com/)[^\s<>\"'{}|\\^`\[\]]+",
        resume_text,
        re.IGNORECASE
    )
    for raw_url in url_matches:
        item = _classify_url(raw_url, source="text")
        if item:
            key = (item["platform"], item["username"].lower())
            if key not in found_map:
                found_map[key] = item

    # 4. Extract bare text handles ("GitHub: octocat", "LeetCode: coder123")
    for platform, pat in BARE_HANDLE_PATTERNS.items():
        for m in re.finditer(pat, resume_text, re.IGNORECASE):
            raw_match = m.group(1).strip()
            if raw_match.lower() in ("http", "https") or "://" in raw_match:
                continue
            if "/" in raw_match:
                user = raw_match.split("/")[-1]
            elif raw_match.lower().endswith((".com", ".org", ".io", ".net", ".me")):
                continue
            else:
                user = raw_match
            user = _clean_username(user)
            if user and len(user) >= 2 and user.lower() not in ("in", "user", "profile"):
                key = (platform, user.lower())
                if key not in found_map:
                    base_url = {
                        "github": f"https://github.com/{user}",
                        "leetcode": f"https://leetcode.com/{user}",
                        "codeforces": f"https://codeforces.com/profile/{user}",
                        "codechef": f"https://codechef.com/users/{user}",
                        "hackerrank": f"https://hackerrank.com/{user}",
                        "kaggle": f"https://kaggle.com/{user}",
                        "linkedin": f"https://linkedin.com/in/{user}",
                        "twitter": f"https://x.com/{user}"
                    }.get(platform, "")
                    found_map[key] = {
                        "platform": platform,
                        "username": user,
                        "url": base_url,
                        "source": "text",
                        "confidence": "medium"
                    }

    # Sort results deterministically: high confidence first, then platform
    results = list(found_map.values())
    results.sort(key=lambda x: (x["confidence"] != "high", x["platform"], x["username"]))
    return results


def get_social_stats(platform: str, username: str) -> Dict[str, Any]:
    """
    Fetches public stats for GitHub, Codeforces, or LeetCode with 4s timeout and 6h caching.
    Never scrapes LinkedIn ('link only'). Never logs secrets.
    """
    p = platform.lower().strip()
    u = username.strip()
    cache_key = (p, u.lower())
    now = time.time()

    # 1. Check in-memory and store cache
    if cache_key in _STATS_CACHE:
        ts, cached_data = _STATS_CACHE[cache_key]
        if now - ts < CACHE_TTL_SECONDS:
            return cached_data

    store, _ = get_store()
    cached = store.get(p, u.lower())
    if cached is not None:
        _STATS_CACHE[cache_key] = (now, cached)
        return cached

    # 2. LinkedIn & link-only platforms
    if p in ("linkedin", "twitter", "website", "kaggle", "medium", "geeksforgeeks", "hackerrank", "codechef"):
        res = {
            "available": False,
            "platform": p,
            "username": u,
            "reason": "link only"
        }
        _STATS_CACHE[cache_key] = (now, res)
        store.set(p, u.lower(), res, ttl_seconds=CACHE_TTL_SECONDS)
        return res

    # 3. GitHub Public User API
    if p == "github":
        url = f"https://api.github.com/users/{u}"
        headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "RADIX-Talent-Match"}
        token = os.getenv("GITHUB_TOKEN")
        if token:
            headers["Authorization"] = f"token {token}"

        try:
            resp = requests.get(url, headers=headers, timeout=4.0)
            if resp.status_code == 200:
                data = resp.json()
                res = {
                    "available": True,
                    "platform": "github",
                    "username": u,
                    "stats": {
                        "public_repos": data.get("public_repos", 0),
                        "public_gists": data.get("public_gists", 0),
                        "followers": data.get("followers", 0),
                        "following": data.get("following", 0),
                        "created_at": data.get("created_at"),
                        "bio": data.get("bio") or "",
                        "company": data.get("company") or ""
                    }
                }
            elif resp.status_code == 404:
                res = {"available": False, "platform": "github", "username": u, "reason": "user not found"}
            else:
                res = {"available": False, "platform": "github", "username": u, "reason": f"GitHub API status {resp.status_code}"}
        except Exception as e:
            res = {"available": False, "platform": "github", "username": u, "reason": "timeout or network error"}

        _STATS_CACHE[cache_key] = (now, res)
        store.set(p, u.lower(), res, ttl_seconds=CACHE_TTL_SECONDS)
        return res

    # 4. Codeforces Official user.info API
    if p == "codeforces":
        url = f"https://codeforces.com/api/user.info?handles={u}"
        headers = {"User-Agent": "RADIX-Talent-Match"}
        try:
            resp = requests.get(url, headers=headers, timeout=4.0)
            if resp.status_code == 200:
                body = resp.json()
                if body.get("status") == "OK" and body.get("result"):
                    user_info = body["result"][0]
                    res = {
                        "available": True,
                        "platform": "codeforces",
                        "username": u,
                        "stats": {
                            "rating": user_info.get("rating", 0),
                            "max_rating": user_info.get("maxRating", 0),
                            "rank": user_info.get("rank", "unrated"),
                            "max_rank": user_info.get("maxRank", "unrated"),
                            "contribution": user_info.get("contribution", 0)
                        }
                    }
                else:
                    res = {"available": False, "platform": "codeforces", "username": u, "reason": body.get("comment", "user not found")}
            else:
                res = {"available": False, "platform": "codeforces", "username": u, "reason": f"Codeforces API status {resp.status_code}"}
        except Exception:
            res = {"available": False, "platform": "codeforces", "username": u, "reason": "timeout or network error"}

        _STATS_CACHE[cache_key] = (now, res)
        store.set(p, u.lower(), res, ttl_seconds=CACHE_TTL_SECONDS)
        return res

    # 5. LeetCode Public GraphQL (Best effort)
    if p == "leetcode":
        url = "https://leetcode.com/graphql"
        query = """
        query getUserProfile($username: String!) {
            matchedUser(username: $username) {
                username
                submitStatsGlobal {
                    acSubmissionNum {
                        difficulty
                        count
                    }
                }
                profile {
                    ranking
                    reputation
                }
            }
        }
        """
        payload = {"query": query, "variables": {"username": u}}
        headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=4.0)
            if resp.status_code == 200:
                data = resp.json()
                matched = data.get("data", {}).get("matchedUser")
                if matched:
                    stats_list = matched.get("submitStatsGlobal", {}).get("acSubmissionNum", [])
                    solved_map = {item.get("difficulty"): item.get("count", 0) for item in stats_list}
                    res = {
                        "available": True,
                        "platform": "leetcode",
                        "username": u,
                        "stats": {
                            "total_solved": solved_map.get("All", 0),
                            "easy_solved": solved_map.get("Easy", 0),
                            "medium_solved": solved_map.get("Medium", 0),
                            "hard_solved": solved_map.get("Hard", 0),
                            "ranking": matched.get("profile", {}).get("ranking")
                        }
                    }
                else:
                    res = {"available": False, "platform": "leetcode", "username": u, "reason": "user not found"}
            else:
                res = {"available": False, "platform": "leetcode", "username": u, "reason": f"LeetCode GraphQL status {resp.status_code}"}
        except Exception:
            res = {"available": False, "platform": "leetcode", "username": u, "reason": "timeout or network error"}

        _STATS_CACHE[cache_key] = (now, res)
        store.set(p, u.lower(), res, ttl_seconds=CACHE_TTL_SECONDS)
        return res

    # Fallback for unrecognized platform
    return {"available": False, "platform": p, "username": u, "reason": "link only"}
