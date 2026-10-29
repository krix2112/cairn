"""
RADIX Storage & Caching Layer (app/store.py)

Provides CacheStore and RateLimiter interfaces with two implementations:
1. LocalStore: disk cache under data/cache/ + in-memory rate limiter.
2. SupabaseStore: PostgREST extraction_cache & api_cache + hit_rate_limit RPC.

Every Supabase call has a 2-second timeout and degrades gracefully
(cache miss, rate limiter allows) with a logged warning, never a 500.
"""

import hashlib
import json
import logging
import os
import tempfile
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Tuple

import httpx

logger = logging.getLogger("radix.store")


class CacheStore:
    def get(self, namespace: str, key: str) -> Optional[Any]:
        raise NotImplementedError

    def set(self, namespace: str, key: str, data: Any, ttl_seconds: Optional[int] = None) -> bool:
        raise NotImplementedError


class RateLimiter:
    def allow(self, bucket: str, window_seconds: int, max_hits: int) -> bool:
        raise NotImplementedError


class LocalStore(CacheStore, RateLimiter):
    """Local file-based cache and in-memory rate limiter."""

    def __init__(self, cache_dir: str = "data/cache"):
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)
        self._memory_cache: Dict[str, Tuple[float, Optional[float], Any]] = {}
        self._rate_limits: Dict[str, Tuple[int, float]] = {}

    def clear(self):
        self._memory_cache.clear()
        self._rate_limits.clear()

    def _get_file_path(self, namespace: str, key: str) -> str:
        safe_key = hashlib.sha256(f"{namespace}:{key}".encode()).hexdigest() if len(key) > 64 or "/" in key or "\\" in key else key
        if namespace == "extract":
            return os.path.join(self.cache_dir, f"{safe_key}.json")
        return os.path.join(self.cache_dir, f"{namespace}_{safe_key}.json")

    def get(self, namespace: str, key: str) -> Optional[Any]:
        full_key = f"{namespace}:{key}"
        now = time.time()

        # Check memory first
        if full_key in self._memory_cache:
            created_at, expires_at, data = self._memory_cache[full_key]
            if expires_at is None or now < expires_at:
                return data
            del self._memory_cache[full_key]

        # For extract namespace only, check disk
        if namespace == "extract":
            path = self._get_file_path(namespace, key)
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        entry = json.load(f)
                    return entry
                except Exception as e:
                    logger.warning("LocalStore get error: %s", type(e).__name__)
        return None

    def set(self, namespace: str, key: str, data: Any, ttl_seconds: Optional[int] = None) -> bool:
        now = time.time()
        expires_at = (now + ttl_seconds) if ttl_seconds else None
        full_key = f"{namespace}:{key}"
        self._memory_cache[full_key] = (now, expires_at, data)

        if namespace == "extract":
            path = self._get_file_path(namespace, key)
            try:
                temp_path = path + ".tmp"
                with open(temp_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                os.replace(temp_path, path)
                return True
            except Exception as e:
                logger.warning("LocalStore set error: %s", type(e).__name__)
                return False
        return True

    def allow(self, bucket: str, window_seconds: int, max_hits: int) -> bool:
        now = time.time()
        if bucket not in self._rate_limits:
            self._rate_limits[bucket] = (1, now)
            return 1 <= max_hits

        count, window_start = self._rate_limits[bucket]
        if now - window_start >= window_seconds:
            self._rate_limits[bucket] = (1, now)
            return 1 <= max_hits

        new_count = count + 1
        self._rate_limits[bucket] = (new_count, window_start)
        return new_count <= max_hits


class SupabaseStore(CacheStore, RateLimiter):
    """Supabase PostgREST cache and RPC rate limiter with automatic local fallback."""

    def __init__(self, supabase_url: str, supabase_service_key: str, client: Optional[httpx.Client] = None):
        self.supabase_url = supabase_url.rstrip("/")
        self.service_key = supabase_service_key
        self._client = client
        self._local_fallback = LocalStore()
        self._logged_missing_rpc = False

    def _headers(self, prefer_upsert: bool = False) -> Dict[str, str]:
        hdrs = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if prefer_upsert:
            hdrs["Prefer"] = "resolution=merge-duplicates"
        return hdrs

    def _request(self, method: str, path: str, **kwargs) -> Optional[httpx.Response]:
        url = f"{self.supabase_url}{path}"
        kwargs.setdefault("timeout", 2.0)
        try:
            if self._client:
                return self._client.request(method, url, **kwargs)
            with httpx.Client(timeout=2.0) as client:
                return client.request(method, url, **kwargs)
        except Exception as e:
            logger.warning("Supabase request error (%s %s): %s", method, path, type(e).__name__)
            return None

    def get(self, namespace: str, key: str) -> Optional[Any]:
        try:
            if namespace == "extract":
                # Table: extraction_cache (cache_key, data, created_at)
                resp = self._request(
                    "GET",
                    f"/rest/v1/extraction_cache?cache_key=eq.{key}&select=data",
                    headers=self._headers()
                )
            else:
                # Table: api_cache (cache_key, data, expires_at)
                composite_key = f"{namespace}:{key}"
                now_iso = datetime.now(timezone.utc).isoformat()
                resp = self._request(
                    "GET",
                    f"/rest/v1/api_cache?cache_key=eq.{composite_key}&expires_at=gt.{now_iso}&select=data",
                    headers=self._headers()
                )

            if resp is not None and resp.status_code == 200:
                rows = resp.json()
                if isinstance(rows, list) and len(rows) > 0 and "data" in rows[0]:
                    return rows[0]["data"]
        except Exception as e:
            logger.debug("SupabaseStore get error: %s", type(e).__name__)
        return None

    def set(self, namespace: str, key: str, data: Any, ttl_seconds: Optional[int] = None) -> bool:
        try:
            if namespace == "extract":
                payload = {"cache_key": key, "data": data}
                resp = self._request(
                    "POST",
                    "/rest/v1/extraction_cache",
                    headers=self._headers(prefer_upsert=True),
                    json=payload
                )
            else:
                composite_key = f"{namespace}:{key}"
                ttl = ttl_seconds if ttl_seconds is not None else 6 * 3600
                expires_at = (datetime.now(timezone.utc) + timedelta(seconds=ttl)).isoformat()
                payload = {
                    "cache_key": composite_key,
                    "data": data,
                    "expires_at": expires_at
                }
                resp = self._request(
                    "POST",
                    "/rest/v1/api_cache",
                    headers=self._headers(prefer_upsert=True),
                    json=payload
                )

            if resp is not None and resp.status_code in (200, 201, 204):
                return True
        except Exception as e:
            logger.debug("SupabaseStore set error: %s", type(e).__name__)

        # Fallback to /tmp on failure
        try:
            tmp_path = os.path.join(tempfile.gettempdir(), f"{namespace}_{hashlib.sha256(key.encode()).hexdigest()}.json")
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except Exception:
            pass
        return False

    def allow(self, bucket: str, window_seconds: int, max_hits: int) -> bool:
        try:
            # RPC: hit_rate_limit(p_bucket, p_window_seconds, p_max) -> boolean
            payload = {
                "p_bucket": bucket,
                "p_window_seconds": window_seconds,
                "p_max": max_hits
            }
            resp = self._request(
                "POST",
                "/rest/v1/rpc/hit_rate_limit",
                headers=self._headers(),
                json=payload
            )
            if resp is not None and resp.status_code == 200:
                result = resp.json()
                if isinstance(result, bool):
                    return result
            elif not self._logged_missing_rpc and resp is not None and resp.status_code == 404:
                self._logged_missing_rpc = True
        except Exception as e:
            logger.debug("SupabaseStore allow error: %s", type(e).__name__)
        # Graceful degradation: allow request if rate limiter is unreachable
        return True


# Global store instance management
_GLOBAL_STORE: Optional[Tuple[CacheStore, RateLimiter]] = None


def get_store(client: Optional[httpx.Client] = None) -> Tuple[CacheStore, RateLimiter]:
    global _GLOBAL_STORE
    if client is not None:
        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
        if supabase_url and supabase_key:
            s = SupabaseStore(supabase_url, supabase_key, client=client)
            return s, s
        l = LocalStore()
        return l, l

    if _GLOBAL_STORE is not None:
        return _GLOBAL_STORE

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if supabase_url and supabase_key:
        s = SupabaseStore(supabase_url, supabase_key)
        _GLOBAL_STORE = (s, s)
        return _GLOBAL_STORE
    l = LocalStore()
    _GLOBAL_STORE = (l, l)
    return _GLOBAL_STORE


def reset_store():
    global _GLOBAL_STORE
    if _GLOBAL_STORE and hasattr(_GLOBAL_STORE[0], "clear"):
        _GLOBAL_STORE[0].clear()
    _GLOBAL_STORE = None
