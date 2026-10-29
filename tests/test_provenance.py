from datetime import datetime, timezone
import unittest.mock as mock
import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.provenance import (
    evaluate_provenance,
    parse_projects_from_resume_text,
    _GITHUB_CACHE
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_github_cache():
    _GITHUB_CACHE.clear()


def test_parse_projects_from_resume_text():
    sample_resume = """
    Jane Doe
    jane@example.com

    Education
    B.Tech Computer Science

    Projects
    • Distributed Notification Service: Designed and built a scalable notification engine with Redis and Kafka.
    • Movie Recommendation System: Built collaborative filtering recommender evaluated on MovieLens dataset.
    • Object-Oriented Design Patterns: Published article series on creational and structural patterns.

    Skills
    Python, C++, Docker, Kubernetes
    """
    projects = parse_projects_from_resume_text(sample_resume)
    assert len(projects) == 3
    assert "Distributed Notification Service" in projects[0]["name"]
    assert "Redis and Kafka" in projects[0]["description"]


def test_single_day_dump_flagged():
    """Flag when >= 70% of user commits fall within 24 hours."""
    # 10 commits on the same day within 3 hours
    mock_commits = [
        {"commit": {"author": {"date": f"2024-03-15T10:{i:02d}:00Z"}}}
        for i in range(10)
    ]

    mock_user = {"login": "dumpuser", "public_repos": 1}
    mock_repos = [{
        "name": "dump-project",
        "fork": False,
        "owner": {"login": "dumpuser"},
        "html_url": "https://github.com/dumpuser/dump-project",
        "created_at": "2024-03-15T09:00:00Z",
        "stargazers_count": 0,
        "forks_count": 0
    }]
    mock_langs = {"Python": 50000}
    mock_contents = [{"name": "README.md", "type": "file"}]

    def mock_get(url, *args, **kwargs):
        resp = mock.MagicMock()
        resp.headers = {"x-ratelimit-remaining": "55", "x-ratelimit-limit": "60", "x-ratelimit-reset": "0"}
        if "/users/dumpuser/repos" in url:
            resp.status_code = 200
            resp.json.return_value = mock_repos
        elif "/users/dumpuser" in url:
            resp.status_code = 200
            resp.json.return_value = mock_user
        elif "/languages" in url:
            resp.status_code = 200
            resp.json.return_value = mock_langs
        elif "/commits" in url:
            resp.status_code = 200
            resp.json.return_value = mock_commits
        elif "/contents" in url:
            resp.status_code = 200
            resp.json.return_value = mock_contents
        else:
            resp.status_code = 404
            resp.json.return_value = {}
        return resp

    with mock.patch("requests.get", side_effect=mock_get):
        res = evaluate_provenance(
            github_username="dumpuser",
            projects=[{"name": "dump-project", "description": "single day dump project"}],
            skills=[{"skill_name": "Python", "category_code": "COD"}]
        )

        assert res["level"] in ("Weak", "Moderate")
        assert len(res["repos"]) == 1
        repo = res["repos"][0]
        assert repo["evidence_strength"] == "Weak"
        history_signal = next(s for s in repo["signals"] if s["signal"] == "history_shape")
        assert history_signal["flagged"] is True
        assert "24-hour window" in history_signal["reason"]
        assert "signals, not proof" in history_signal["reason"]


def test_healthy_history_strong():
    """Sustained commits across multiple months, tests, CI, and README yields Strong evidence."""
    # 20 commits spread over 4 months
    mock_commits = []
    months = ["2024-01", "2024-02", "2024-03", "2024-04"]
    for m in months:
        for d in range(1, 6):
            mock_commits.append({
                "commit": {"author": {"date": f"{m}-{d:02d}T14:00:00Z"}}
            })

    mock_user = {"login": "starbuilder", "public_repos": 1}
    mock_repos = [{
        "name": "production-app",
        "fork": False,
        "owner": {"login": "starbuilder"},
        "html_url": "https://github.com/starbuilder/production-app",
        "created_at": "2024-01-01T10:00:00Z",
        "stargazers_count": 12,
        "forks_count": 3
    }]
    mock_langs = {"Python": 120000, "C++": 40000}
    mock_contents = [
        {"name": "README.md", "type": "file"},
        {"name": "tests", "type": "dir"},
        {"name": ".github", "type": "dir"},
        {"name": "LICENSE", "type": "file"}
    ]

    def mock_get(url, *args, **kwargs):
        resp = mock.MagicMock()
        resp.headers = {"x-ratelimit-remaining": "50", "x-ratelimit-limit": "60", "x-ratelimit-reset": "0"}
        if "/users/starbuilder/repos" in url:
            resp.status_code = 200
            resp.json.return_value = mock_repos
        elif "/users/starbuilder" in url:
            resp.status_code = 200
            resp.json.return_value = mock_user
        elif "/languages" in url:
            resp.status_code = 200
            resp.json.return_value = mock_langs
        elif "/commits" in url:
            resp.status_code = 200
            resp.json.return_value = mock_commits
        elif "/contents" in url:
            resp.status_code = 200
            resp.json.return_value = mock_contents
        else:
            resp.status_code = 404
            resp.json.return_value = {}
        return resp

    with mock.patch("requests.get", side_effect=mock_get):
        res = evaluate_provenance(
            github_username="starbuilder",
            projects=[{"name": "production-app", "description": "Production grade application"}],
            skills=[
                {"skill_name": "Python", "category_code": "COD"},
                {"skill_name": "C++", "category_code": "COD"},
                {"skill_name": "Rust", "category_code": "COD"}
            ]
        )

        assert res["level"] == "Strong"
        assert res["score"] >= 75
        repo = res["repos"][0]
        assert repo["evidence_strength"] == "Strong"
        assert repo["hygiene"]["readme"] is True
        assert repo["hygiene"]["tests"] is True
        assert repo["hygiene"]["ci"] is True
        assert len(res["timeline"]) == 4

        # Claim checks
        claims = res["claims"]
        p_claim = claims["projects"][0]
        assert p_claim["status"] == "Supported"

        langs = {l["language"]: l for l in claims["languages"]}
        assert langs["Python"]["status"] == "Verified (>= 10%)"
        assert langs["Rust"]["status"] == "No public code"


def test_fork_only_weak():
    """Forks with zero commits by user flagged as Weak evidence / no original work."""
    mock_user = {"login": "forker", "public_repos": 1}
    # User has only a forked repository
    mock_repos = [{
        "name": "upstream-framework",
        "fork": True,
        "owner": {"login": "original-author"},
        "html_url": "https://github.com/forker/upstream-framework",
        "created_at": "2024-01-01T10:00:00Z"
    }]

    def mock_get(url, *args, **kwargs):
        resp = mock.MagicMock()
        resp.headers = {"x-ratelimit-remaining": "50", "x-ratelimit-limit": "60", "x-ratelimit-reset": "0"}
        if "/users/forker/repos" in url:
            resp.status_code = 200
            resp.json.return_value = mock_repos
        elif "/users/forker" in url:
            resp.status_code = 200
            resp.json.return_value = mock_user
        elif "/commits" in url:
            resp.status_code = 200
            resp.json.return_value = []  # 0 commits by user
        else:
            resp.status_code = 404
            resp.json.return_value = {}
        return resp

    with mock.patch("requests.get", side_effect=mock_get):
        res = evaluate_provenance(
            github_username="forker",
            projects=[{"name": "upstream-framework", "description": "Framwork project"}]
        )

        assert res["level"] in ("Weak", "Not enough data")
        assert len(res["forks_with_zero_commits"]) == 1
        assert res["forks_with_zero_commits"][0]["name"] == "upstream-framework"
        assert any("zero user commits" in w for w in res["warnings"])


def test_user_not_found():
    """404 status from GitHub returns Not enough data and clear warning."""
    def mock_get(url, *args, **kwargs):
        resp = mock.MagicMock()
        resp.status_code = 404
        resp.headers = {"x-ratelimit-remaining": "59", "x-ratelimit-limit": "60", "x-ratelimit-reset": "0"}
        resp.json.return_value = {"message": "Not Found"}
        return resp

    with mock.patch("requests.get", side_effect=mock_get):
        res = evaluate_provenance(github_username="nonexistent_user_99999")
        assert res["score"] == 0
        assert res["level"] == "Not enough data"
        assert len(res["repos"]) == 0
        assert any("not found" in w.lower() for w in res["warnings"])


def test_rate_limit_handled():
    """403 rate limit returns partial result and warning."""
    def mock_get(url, *args, **kwargs):
        resp = mock.MagicMock()
        resp.status_code = 403
        resp.headers = {"x-ratelimit-remaining": "0", "x-ratelimit-limit": "60", "x-ratelimit-reset": "1700000000"}
        resp.json.return_value = {"message": "API rate limit exceeded"}
        return resp

    with mock.patch("requests.get", side_effect=mock_get):
        res = evaluate_provenance(github_username="octocat")
        assert res["level"] == "Not enough data"
        assert res["rate_limit"]["remaining"] == 0
        assert any("rate limit" in w.lower() for w in res["warnings"])


def test_post_provenance_endpoint():
    """Test POST /provenance API endpoint."""
    mock_user = {"login": "sampleuser", "public_repos": 1}
    mock_repos = [{
        "name": "sample-repo",
        "fork": False,
        "owner": {"login": "sampleuser"},
        "html_url": "https://github.com/sampleuser/sample-repo",
        "created_at": "2024-02-01T10:00:00Z",
        "stargazers_count": 2,
        "forks_count": 0
    }]
    mock_langs = {"Python": 10000}
    mock_commits = [
        {"commit": {"author": {"date": f"2024-02-{d:02d}T10:00:00Z"}}}
        for d in range(1, 8)
    ]
    mock_contents = [{"name": "README.md", "type": "file"}]

    def mock_get(url, *args, **kwargs):
        resp = mock.MagicMock()
        resp.headers = {"x-ratelimit-remaining": "40", "x-ratelimit-limit": "60", "x-ratelimit-reset": "0"}
        if "/users/sampleuser/repos" in url:
            resp.status_code = 200
            resp.json.return_value = mock_repos
        elif "/users/sampleuser" in url:
            resp.status_code = 200
            resp.json.return_value = mock_user
        elif "/languages" in url:
            resp.status_code = 200
            resp.json.return_value = mock_langs
        elif "/commits" in url:
            resp.status_code = 200
            resp.json.return_value = mock_commits
        elif "/contents" in url:
            resp.status_code = 200
            resp.json.return_value = mock_contents
        else:
            resp.status_code = 404
            resp.json.return_value = {}
        return resp

    with mock.patch("requests.get", side_effect=mock_get):
        payload = {
            "github_username": "sampleuser",
            "projects": [{"name": "sample-repo", "description": "sample project"}],
            "skills": ["Python"]
        }
        res = client.post("/provenance", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "score" in data
        assert "level" in data
        assert "repos" in data
        assert "claims" in data
        assert "timeline" in data
        assert "rate_limit" in data
        assert "warnings" in data

