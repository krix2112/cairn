import json
import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
import httpx
from dotenv import load_dotenv

# Ensure environment is loaded
load_dotenv()

logger = logging.getLogger("radix.data_source")

CACHE_TTL = 3600  # 1 hour in-process TTL
HTTP_TIMEOUT = 3.0  # 3 seconds per request
HTTP_RETRIES = 1  # 1 retry on transient failure

_CACHE: Dict[str, Any] = {}
_CACHE_TS: Dict[str, float] = {}
_ACTIVE_DATA_SOURCE: str = "unknown"  # "supabase" | "snapshot" | "failed"


class DataSourceUnavailableError(Exception):
    """Raised when reference data cannot be fetched from Supabase or snapshot fallback."""
    pass


def is_fallback_allowed() -> bool:
    """
    Returns True if snapshot fallback is permitted.
    Default: 1 for local environments, 0 when VERCEL is detected.
    """
    val = os.getenv("ALLOW_SNAPSHOT_FALLBACK")
    if val is not None:
        return val.strip() in ("1", "true", "True", "yes")
    # Default 0 on Vercel, 1 locally
    is_vercel = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV"))
    return not is_vercel


def get_active_source() -> str:
    """Returns the current data source name: 'supabase', 'snapshot', or 'failed'."""
    return _ACTIVE_DATA_SOURCE


def _get_supabase_client() -> Tuple[str, str, httpx.Client]:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise DataSourceUnavailableError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    client = httpx.Client(timeout=HTTP_TIMEOUT, follow_redirects=True)
    return url, key, client


def _fetch_with_retry(client: httpx.Client, method: str, url: str, **kwargs) -> httpx.Response:
    last_err = None
    for attempt in range(HTTP_RETRIES + 1):
        try:
            resp = client.request(method, url, **kwargs)
            if resp.status_code >= 500:
                # 5xx error, retry
                last_err = DataSourceUnavailableError(f"Supabase HTTP {resp.status_code}: {resp.text[:100]}")
                time.sleep(0.3)
                continue
            return resp
        except Exception as e:
            last_err = e
            if attempt < HTTP_RETRIES:
                time.sleep(0.3)
            else:
                raise DataSourceUnavailableError(f"HTTP request error: {e}") from e
    if last_err:
        raise last_err


def _get_snapshot_dir() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # Check data/snapshot, then seed/snapshot
    d1 = os.path.join(base_dir, "data", "snapshot")
    if os.path.exists(d1):
        return d1
    d2 = os.path.join(base_dir, "seed", "snapshot")
    if os.path.exists(d2):
        return d2
    return d1


def _read_snapshot_json(filename: str) -> Any:
    sdir = _get_snapshot_dir()
    fpath = os.path.join(sdir, filename)
    if not os.path.exists(fpath):
        raise DataSourceUnavailableError(f"Snapshot file not found: {fpath}")
    with open(fpath, "r", encoding="utf-8") as f:
        return json.load(f)


def _cache_get(key: str) -> Optional[Any]:
    now = time.time()
    if key in _CACHE:
        ts = _CACHE_TS.get(key, 0)
        if now - ts < CACHE_TTL:
            return _CACHE[key]
    return None


def _cache_set(key: str, data: Any):
    _CACHE[key] = data
    _CACHE_TS[key] = time.time()


# ==============================================================================
# Public Data Source APIs
# ==============================================================================

def get_skill_sets() -> List[Dict[str, Any]]:
    """
    Fetch all 12 skill sets.
    Returns: [{"id": 1, "code": "COD", "name": "Coding", "sort_order": 1}, ...]
    """
    global _ACTIVE_DATA_SOURCE
    cached = _cache_get("skill_sets")
    if cached is not None:
        return cached

    # Try Supabase
    try:
        url, key, client = _get_supabase_client()
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        resp = _fetch_with_retry(
            client,
            "GET",
            f"{url}/rest/v1/skill_sets?select=*&order=sort_order",
            headers=headers,
        )
        if resp.status_code == 200:
            data = resp.json()
            if len(data) == 12:
                _ACTIVE_DATA_SOURCE = "supabase"
                _cache_set("skill_sets", data)
                return data
    except Exception as e:
        logger.warning(f"Failed to fetch skill_sets from Supabase: {e}")

    # Fallback
    if is_fallback_allowed():
        try:
            data = _read_snapshot_json("skill_sets.json")
            _ACTIVE_DATA_SOURCE = "snapshot"
            _cache_set("skill_sets", data)
            return data
        except Exception as fe:
            logger.error(f"Snapshot fallback failed for skill_sets: {fe}")

    _ACTIVE_DATA_SOURCE = "failed"
    raise DataSourceUnavailableError("skill_sets data unavailable from Supabase and snapshot fallback.")


def get_skillset_map() -> Dict[int, str]:
    """
    Dynamic replacement for hardcoded SKILLSET_MAP in config.py.
    Maps skill_set_id -> category code (e.g., 1 -> 'COD', 2 -> 'DSA').
    """
    skills = get_skill_sets()
    return {s["id"]: s["code"] for s in skills}


def get_code_to_id_map() -> Dict[str, int]:
    """Maps skill code -> skill_set_id (e.g., 'COD' -> 1)."""
    skills = get_skill_sets()
    return {s["code"]: s["id"] for s in skills}


def get_all_companies_raw() -> List[Dict[str, Any]]:
    """
    Fetch all 118 company rows from company_json.
    Returns list of {"company_id": int, "json_id": int, "name": str, "short_json": dict, "full_json": dict}
    """
    global _ACTIVE_DATA_SOURCE
    cached = _cache_get("companies_raw")
    if cached is not None:
        return cached

    try:
        url, key, client = _get_supabase_client()
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        resp = _fetch_with_retry(
            client,
            "GET",
            f"{url}/rest/v1/company_json?select=*&limit=200",
            headers=headers,
        )
        if resp.status_code == 200:
            data = resp.json()
            _ACTIVE_DATA_SOURCE = "supabase"
            _cache_set("companies_raw", data)
            return data
    except Exception as e:
        logger.warning(f"Failed to fetch company_json from Supabase: {e}")

    if is_fallback_allowed():
        try:
            data = _read_snapshot_json("companies.json")
            _ACTIVE_DATA_SOURCE = "snapshot"
            _cache_set("companies_raw", data)
            return data
        except Exception as fe:
            logger.error(f"Snapshot fallback failed for company_json: {fe}")

    _ACTIVE_DATA_SOURCE = "failed"
    raise DataSourceUnavailableError("company_json data unavailable.")


def get_all_skill_levels_raw() -> List[Dict[str, Any]]:
    """
    Fetch all 1356 rows from company_skill_levels.
    Returns list of {"id": int, "company_id": int, "skill_set_id": int, "required_level": int, "required_proficiency_level_id": int}
    """
    global _ACTIVE_DATA_SOURCE
    cached = _cache_get("levels_raw")
    if cached is not None:
        return cached

    try:
        url, key, client = _get_supabase_client()
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        # Fetch with pagination if needed (1356 rows)
        all_rows = []
        page_size = 1000
        offset = 0
        while True:
            resp = _fetch_with_retry(
                client,
                "GET",
                f"{url}/rest/v1/company_skill_levels?select=*&limit={page_size}&offset={offset}",
                headers=headers,
            )
            if resp.status_code == 200:
                chunk = resp.json()
                all_rows.extend(chunk)
                if len(chunk) < page_size:
                    break
                offset += page_size
            else:
                raise DataSourceUnavailableError(f"HTTP {resp.status_code} fetching levels")

        if len(all_rows) > 0:
            _ACTIVE_DATA_SOURCE = "supabase"
            _cache_set("levels_raw", all_rows)
            return all_rows
    except Exception as e:
        logger.warning(f"Failed to fetch company_skill_levels from Supabase: {e}")

    if is_fallback_allowed():
        try:
            data = _read_snapshot_json("company_skill_levels.json")
            _ACTIVE_DATA_SOURCE = "snapshot"
            _cache_set("levels_raw", data)
            return data
        except Exception as fe:
            logger.error(f"Snapshot fallback failed for company_skill_levels: {fe}")

    _ACTIVE_DATA_SOURCE = "failed"
    raise DataSourceUnavailableError("company_skill_levels data unavailable.")


def get_all_company_benchmarks() -> Dict[int, Dict[str, Any]]:
    """
    Returns structured benchmark companies:
    {
      company_id: {
        "company_id": int,
        "name": str,
        "required": {skill_code: int_level},
        "bar": float_average_level
      }
    }
    Only includes companies with all 12 skill levels mapped.
    """
    cached = _cache_get("company_benchmarks")
    if cached is not None:
        return cached

    skill_map = get_skillset_map()
    companies_raw = get_all_companies_raw()
    levels_raw = get_all_skill_levels_raw()

    names = {c["company_id"]: c.get("name") or f"Company {c['company_id']}" for c in companies_raw}

    companies_dict: Dict[int, Dict[str, Any]] = {}
    for r in levels_raw:
        cid = r["company_id"]
        sid = r["skill_set_id"]
        req_lvl = r["required_level"]
        code = skill_map.get(sid)
        if not code:
            continue
        if cid not in companies_dict:
            companies_dict[cid] = {
                "company_id": cid,
                "name": names.get(cid, f"Company {cid}"),
                "required": {}
            }
        companies_dict[cid]["required"][code] = req_lvl

    valid: Dict[int, Dict[str, Any]] = {}
    for cid, data in companies_dict.items():
        if len(data["required"]) == 12:
            req_vals = list(data["required"].values())
            data["bar"] = round(sum(req_vals) / len(req_vals), 1)
            valid[cid] = data

    _cache_set("company_benchmarks", valid)
    return valid


def get_sorted_companies_list() -> List[Dict[str, Any]]:
    """Returns all companies sorted alphabetically: [{"id": cid, "name": name, "bar": bar}, ...]"""
    benchmarks = get_all_company_benchmarks()
    items = [{"id": cid, "name": d["name"], "bar": d.get("bar", 0.0)} for cid, d in benchmarks.items()]
    items.sort(key=lambda x: x["name"].lower())
    return items


def get_company_required_levels(company_id: int) -> Dict[str, int]:
    """Returns {skill_code: required_level} for the given company_id."""
    benchmarks = get_all_company_benchmarks()
    if company_id in benchmarks:
        return benchmarks[company_id]["required"]

    # Fallback to direct lookup from levels_raw
    skill_map = get_skillset_map()
    levels_raw = get_all_skill_levels_raw()
    res = {}
    for r in levels_raw:
        if r["company_id"] == company_id:
            code = skill_map.get(r["skill_set_id"])
            if code:
                res[code] = r["required_level"]
    return res


def get_roadmap_kb() -> Dict[str, Any]:
    """
    Fetch roadmap_kb from app_content table (key='roadmap_kb').
    """
    global _ACTIVE_DATA_SOURCE
    cached = _cache_get("roadmap_kb")
    if cached is not None:
        return cached

    try:
        url, key, client = _get_supabase_client()
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        resp = _fetch_with_retry(
            client,
            "GET",
            f"{url}/rest/v1/app_content?key=eq.roadmap_kb&select=data",
            headers=headers,
        )
        if resp.status_code == 200:
            rows = resp.json()
            if rows and "data" in rows[0]:
                data = rows[0]["data"]
                _ACTIVE_DATA_SOURCE = "supabase"
                _cache_set("roadmap_kb", data)
                return data
    except Exception as e:
        logger.warning(f"Failed to fetch roadmap_kb from Supabase: {e}")

    if is_fallback_allowed():
        try:
            data = _read_snapshot_json("roadmap_kb.json")
            _ACTIVE_DATA_SOURCE = "snapshot"
            _cache_set("roadmap_kb", data)
            return data
        except Exception as fe:
            logger.error(f"Snapshot fallback failed for roadmap_kb: {fe}")

    _ACTIVE_DATA_SOURCE = "failed"
    raise DataSourceUnavailableError("roadmap_kb data unavailable.")


def get_samples_meta() -> Dict[str, Any]:
    """
    Fetch metadata for all sample JDs and Resumes.
    Returns: {"jds": [...], "resumes": [...]}
    """
    global _ACTIVE_DATA_SOURCE
    cached = _cache_get("samples_meta")
    if cached is not None:
        return cached

    try:
        url, key, client = _get_supabase_client()
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        resp = _fetch_with_retry(
            client,
            "GET",
            f"{url}/rest/v1/samples?select=*&order=name",
            headers=headers,
        )
        if resp.status_code == 200:
            rows = resp.json()
            jds = [r["meta"] for r in rows if r["kind"] == "jd"]
            resumes = [r["meta"] for r in rows if r["kind"] == "resume"]
            if jds and resumes:
                data = {"jds": jds, "resumes": resumes}
                _ACTIVE_DATA_SOURCE = "supabase"
                _cache_set("samples_meta", data)
                return data
    except Exception as e:
        logger.warning(f"Failed to fetch samples from Supabase: {e}")

    if is_fallback_allowed():
        try:
            data = _read_snapshot_json("samples.json")
            _ACTIVE_DATA_SOURCE = "snapshot"
            _cache_set("samples_meta", data)
            return data
        except Exception as fe:
            logger.error(f"Snapshot fallback failed for samples: {fe}")

    _ACTIVE_DATA_SOURCE = "failed"
    raise DataSourceUnavailableError("samples metadata unavailable.")


def get_sample_file_url(kind: str, filename: str) -> str:
    """Returns the public Supabase storage URL for a sample PDF."""
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    # standard normalized path
    clean_name = os.path.basename(filename)
    if not clean_name.endswith(".pdf"):
        clean_name += ".pdf"
    folder = "jds" if kind.startswith("jd") else "resumes"
    return f"{url}/storage/v1/object/public/samples/{folder}/{clean_name}"


def get_sample_file_bytes(kind: str, filename: str) -> bytes:
    """
    Fetches raw bytes for a sample PDF:
    1. From Supabase public storage bucket
    2. Fallback to local file if available
    """
    clean_name = os.path.basename(filename)
    if not clean_name.endswith(".pdf"):
        clean_name += ".pdf"
    folder = "jds" if kind.startswith("jd") else "resumes"

    pub_url = get_sample_file_url(folder, clean_name)
    try:
        client = httpx.Client(timeout=5.0, follow_redirects=True)
        resp = _fetch_with_retry(client, "GET", pub_url)
        if resp.status_code == 200 and len(resp.content) > 1000:
            return resp.content
    except Exception as e:
        logger.warning(f"Could not download sample from Supabase storage: {e}")

    # Fallback to local disk if present (in seed/ or data/)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for parent in ("seed", "data"):
        local_path = os.path.join(base_dir, parent, folder, clean_name)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()

    raise DataSourceUnavailableError(f"Sample file {folder}/{clean_name} not found.")


def check_health_data() -> Dict[str, Any]:
    """
    Validates health and counts of reference data.
    Returns: {"data_source": "supabase"|"snapshot", "companies": N, "levels": N, "skill_sets": 12}
    """
    try:
        skills = get_skill_sets()
        comps = get_all_companies_raw()
        levels = get_all_skill_levels_raw()
        return {
            "status": "ok",
            "data_source": _ACTIVE_DATA_SOURCE,
            "companies": len(comps),
            "levels": len(levels),
            "skill_sets": len(skills),
        }
    except DataSourceUnavailableError as e:
        return {
            "status": "unavailable",
            "data_source": "failed",
            "error": str(e)
        }

