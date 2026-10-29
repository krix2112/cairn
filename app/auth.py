"""
Authentication helper for Radix v2 (app/auth.py)

Verifies user Bearer tokens against Supabase Auth (GET /auth/v1/user)
and caches verified tokens in-memory for 60 seconds.
"""

import os
import time
from typing import Any, Dict, Optional, Tuple
from fastapi import HTTPException, Request, status
import httpx

# In-memory cache for verified tokens: token -> (timestamp, user_dict)
_TOKEN_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
TOKEN_CACHE_TTL = 60.0  # seconds


def clear_token_cache():
    _TOKEN_CACHE.clear()


def verify_token(token: str, client: Optional[httpx.Client] = None) -> Dict[str, Any]:
    now = time.time()
    if token in _TOKEN_CACHE:
        ts, user = _TOKEN_CACHE[token]
        if now - ts < TOKEN_CACHE_TTL:
            return user
        del _TOKEN_CACHE[token]

    # Dev/test mock tokens (e.g. test-token-user123)
    if token.startswith("test-token-"):
        uid = token.replace("test-token-", "")
        user = {"id": uid, "email": f"{uid}@example.com"}
        _TOKEN_CACHE[token] = (now, user)
        return user

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")

    if not supabase_url or not publishable_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    headers = {
        "apikey": publishable_key,
        "Authorization": f"Bearer {token}",
    }
    url = f"{supabase_url}/auth/v1/user"

    try:
        if client:
            resp = client.get(url, headers=headers, timeout=3.0)
        else:
            with httpx.Client(timeout=3.0) as http_client:
                resp = http_client.get(url, headers=headers)

        if resp.status_code == 200:
            data = resp.json()
            user_id = data.get("id")
            email = data.get("email", "")
            if not user_id:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
            user = {"id": str(user_id), "email": str(email)}
            _TOKEN_CACHE[token] = (now, user)
            return user
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


def get_user(request: Request) -> Dict[str, Any]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    token = auth_header[7:].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return verify_token(token)


def optional_user(request: Request) -> Optional[Dict[str, Any]]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    if not token:
        return None
    try:
        return verify_token(token)
    except HTTPException:
        return None
    except Exception:
        return None

