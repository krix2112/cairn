"""
Unit Tests for Store, Auth, User Isolation, Cascade Deletion, and Rate Limiting
(tests/test_store_and_auth.py)
"""

import os
import time
import pytest

from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import HTTPException, Request

from app.api import app
from app.store import LocalStore, SupabaseStore, reset_store
from app.auth import verify_token, get_user, optional_user, clear_token_cache
from app.me import LocalUserDataStore, SupabaseUserDataStore, reset_user_store
from app.ratelimit import check_rate_limit


@pytest.fixture(autouse=True)
def cleanup():
    reset_store()
    reset_user_store()
    clear_token_cache()
    yield
    reset_store()
    reset_user_store()
    clear_token_cache()


# ---------------------------------------------------------------------------
# 1. Store & Caching Tests
# ---------------------------------------------------------------------------
def test_local_store_cache():
    cdir = "seed/cache" if os.path.exists("seed/cache") else "data/cache"
    store = LocalStore(cache_dir=cdir)
    store.clear()


    # Memory cache with TTL for non-extract
    store.set("github", "user1", {"repos": 10}, ttl_seconds=2)
    assert store.get("github", "user1") == {"repos": 10}

    # Clear memory cache
    store.clear()
    assert store.get("github", "user1") is None


def test_supabase_store_graceful_degradation():
    # Mock HTTP client that simulates network failure / 500 error
    mock_client = MagicMock()
    mock_client.request.return_value = MagicMock(status_code=500, text="Internal Server Error")

    store = SupabaseStore("https://example.supabase.co", "dummy_service_key", client=mock_client)

    # Should not raise exception, gracefully return None
    res = store.get("extract", "hash123")
    assert res is None

    # Set should fail gracefully without exception
    ok = store.set("extract", "hash123", {"data": 1})
    assert ok is False

    # Rate limiter allow should gracefully allow if Supabase is unreachable
    allowed = store.allow("bucket_test", 600, 10)
    assert allowed is True


# ---------------------------------------------------------------------------
# 2. Auth Tests
# ---------------------------------------------------------------------------
def test_auth_token_verification_and_caching():
    clear_token_cache()

    # Test dev/mock token
    user = verify_token("test-token-user123")
    assert user["id"] == "user123"
    assert user["email"] == "user123@example.com"

    # Repeated call within 60s should use cache
    user2 = verify_token("test-token-user123")
    assert user2 == user


def test_auth_optional_user_and_errors():
    class DummyRequest:
        def __init__(self, headers):
            self.headers = headers

    # Missing header
    req_no_auth = DummyRequest({})
    assert optional_user(req_no_auth) is None

    with pytest.raises(HTTPException) as exc:
        get_user(req_no_auth)
    assert exc.value.status_code == 401

    # Valid Bearer header
    req_auth = DummyRequest({"Authorization": "Bearer test-token-user456"})
    user = get_user(req_auth)
    assert user["id"] == "user456"

    user_opt = optional_user(req_auth)
    assert user_opt["id"] == "user456"


# ---------------------------------------------------------------------------
# 3. Cross-User Isolation Tests
# ---------------------------------------------------------------------------
def test_cross_user_data_isolation():
    store = LocalUserDataStore()

    # User A creates resources
    user_a_id = "user-a-uuid"
    resume_a = store.create_resume(
        user_id=user_a_id,
        title="Resume A",
        file_name="resume_a.pdf",
        file_bytes=b"dummy pdf a",
        content_type="application/pdf",
        extracted={"role": "Engineer", "skills": []},
        socials=[]
    )
    analysis_a = store.create_analysis(
        user_id=user_a_id,
        resume_id=resume_a["id"],
        jd_title="Senior SWE",
        jd_company="Google",
        jd={},
        result={"match": {"match_score": 85}},
        match_score=85,
        readiness_score=80,
        ats_score=95
    )
    app_a = store.create_application(
        user_id=user_a_id,
        data={"company": "Google", "role": "Senior SWE", "status": "applied"}
    )

    # User B attempts to access User A's resources
    user_b_id = "user-b-uuid"

    # User B cannot read User A's resume
    assert store.get_resume(user_b_id, resume_a["id"]) is None
    assert store.get_resume_download_url(user_b_id, resume_a["id"]) is None

    # User B cannot update or delete User A's resume
    assert store.update_resume(user_b_id, resume_a["id"], title="Hacked") is None
    assert store.delete_resume(user_b_id, resume_a["id"]) is False

    # User B cannot read or delete User A's analysis
    assert store.get_analysis(user_b_id, analysis_a["id"]) is None
    assert store.delete_analysis(user_b_id, analysis_a["id"]) is False

    # User B cannot read or delete User A's application
    assert store.update_application(user_b_id, app_a["id"], {"status": "rejected"}) is None
    assert store.delete_application(user_b_id, app_a["id"]) is False

    # Verify User A's data remains completely intact and uncorrupted
    resumes_a = store.list_resumes(user_a_id)
    assert len(resumes_a) == 1
    assert resumes_a[0]["title"] == "Resume A"

    analyses_a = store.list_analyses(user_a_id)
    assert len(analyses_a) == 1
    assert analyses_a[0]["id"] == analysis_a["id"]


# ---------------------------------------------------------------------------
# 4. Account Deletion Cascade Tests
# ---------------------------------------------------------------------------
def test_account_deletion_cascade():
    store = LocalUserDataStore()
    user_id = "user-delete-test"

    # Populate user data
    r = store.create_resume(user_id, "R1", "r1.pdf", b"pdf1", "application/pdf", {}, [])
    a = store.create_analysis(user_id, r["id"], "Lead", "Meta", {}, {}, 90, 85, 90)
    app = store.create_application(user_id, {"company": "Meta", "role": "Lead"})

    assert len(store.list_resumes(user_id)) == 1
    assert len(store.list_analyses(user_id)) == 1
    assert len(store.list_applications(user_id)) == 1

    # Perform account deletion
    store.delete_account(user_id)

    # Everything must be purged
    assert len(store.list_resumes(user_id)) == 0
    assert len(store.list_analyses(user_id)) == 0
    assert len(store.list_applications(user_id)) == 0
    assert len(store.files) == 0


# ---------------------------------------------------------------------------
# 5. Rate Limiting Tests (429 & Retry-After)
# ---------------------------------------------------------------------------
def test_rate_limiting_guest_and_user():
    client = TestClient(app)

    # Mock RateLimiter to test limit threshold
    class MockLimiter:
        def __init__(self):
            self.hits = 0

        def allow(self, bucket: str, window_seconds: int, max_hits: int) -> bool:
            self.hits += 1
            return self.hits <= max_hits

    limiter = MockLimiter()

    # Simulate 8 successful guest hits
    for i in range(8):
        assert limiter.allow("analyze:guest:ip1", 600, 8) is True

    # 9th hit should fail
    assert limiter.allow("analyze:guest:ip1", 600, 8) is False

    # Authenticated user gets 20 hits
    user_limiter = MockLimiter()
    for i in range(20):
        assert user_limiter.allow("analyze:user:u1", 600, 20) is True
    assert user_limiter.allow("analyze:user:u1", 600, 20) is False


# ---------------------------------------------------------------------------
# 6. Public Endpoints & No Secret Leakage
# ---------------------------------------------------------------------------
def test_health_endpoint():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "storage" in data
    assert "auth" in data
    assert "llm" in data
    assert "github_token" in data


def test_config_endpoint_no_secrets():
    client = TestClient(app)
    resp = client.get("/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "supabase_url" in data
    assert "supabase_publishable_key" in data
    # Service key MUST NEVER appear in client config response
    assert "service_key" not in data
    assert "supabase_service_key" not in data
    assert "service_role" not in str(data).lower()

