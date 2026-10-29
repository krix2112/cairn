"""
Rate Limiting Helper (app/ratelimit.py)

Enforces per-endpoint limits:
- /analyze: 8 guest / 20 signed-in per 10 min
- /provenance: 20 per 10 min
- /socials/stats: 20 per 10 min
- /roadmap: 30 per 10 min

Uses Supabase RPC hit_rate_limit or in-memory LocalStore.
Returns HTTP 429 with Retry-After: 600 on limit breach.
"""

import hashlib
from typing import Any, Dict, Optional
from fastapi import HTTPException, Request, status
from .store import get_store


def check_rate_limit(
    request: Request,
    endpoint: str,
    user: Optional[Dict[str, Any]] = None,
    guest_limit: int = 20,
    user_limit: int = 20,
    window_seconds: int = 600
):
    _, limiter = get_store()

    if user and user.get("id"):
        bucket = f"{endpoint}:user:{user['id']}"
        limit = user_limit
    else:
        # Extract IP behind proxies (Vercel, Cloudflare, etc.)
        forwarded = request.headers.get("x-forwarded-for", "")
        ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
        ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest()[:16]
        bucket = f"{endpoint}:guest:{ip_hash}"
        limit = guest_limit

    allowed = limiter.allow(bucket, window_seconds, limit)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You have reached the limit. Please try again in a few minutes.",
            headers={"Retry-After": str(window_seconds)}
        )

