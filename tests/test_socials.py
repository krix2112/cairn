import unittest.mock as mock
import pytest
from app.socials import extract_socials, get_social_stats, _STATS_CACHE

def test_extract_socials_from_text():
    sample_text = """
    Rohan Verma
    Software Engineer | Bengaluru, India
    Email: rohan@example.com | Phone: +91 9876543210
    LinkedIn: linkedin.com/in/rohanverma-dev
    GitHub: github.com/rohanverma
    LeetCode: leetcode.com/u/rohan_codes
    Codeforces: https://codeforces.com/profile/rohan_cf
    Personal Portfolio: https://rohanverma.me/projects
    Twitter: https://x.com/rohan_dev
    """
    results = extract_socials(sample_text)
    platforms = {r["platform"]: r for r in results}

    assert "github" in platforms
    assert platforms["github"]["username"] == "rohanverma"

    assert "linkedin" in platforms
    assert platforms["linkedin"]["username"] == "rohanverma-dev"

    assert "leetcode" in platforms
    assert platforms["leetcode"]["username"] == "rohan_codes"

    assert "codeforces" in platforms
    assert platforms["codeforces"]["username"] == "rohan_cf"

    assert "twitter" in platforms
    assert platforms["twitter"]["username"] == "rohan_dev"

    assert "website" in platforms
    assert "rohanverma.me" in platforms["website"]["url"]


def test_extract_socials_bare_handles():
    sample_text = """
    Jane Doe
    Profiles:
    GitHub: jane-engineer
    LeetCode: jane_algo
    Codeforces: jane_master
    HackerRank: jane_hack
    """
    results = extract_socials(sample_text)
    platforms = {r["platform"]: r for r in results}

    assert "github" in platforms
    assert platforms["github"]["username"] == "jane-engineer"

    assert "leetcode" in platforms
    assert platforms["leetcode"]["username"] == "jane_algo"

    assert "codeforces" in platforms
    assert platforms["codeforces"]["username"] == "jane_master"

    assert "hackerrank" in platforms
    assert platforms["hackerrank"]["username"] == "jane_hack"


def test_social_stats_linkedin_never_scraped():
    # LinkedIn must return available=False with reason="link only" and zero network calls
    with mock.patch("requests.get") as mock_get:
        stats = get_social_stats("linkedin", "rohanverma")
        assert not stats["available"]
        assert stats["reason"] == "link only"
        mock_get.assert_not_called()


def test_social_stats_github_mocked():
    _STATS_CACHE.clear()
    mock_resp = mock.MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "public_repos": 42,
        "followers": 100,
        "created_at": "2019-01-01T00:00:00Z",
        "bio": "Open source builder",
        "company": "Tech Corp"
    }

    with mock.patch("requests.get", return_value=mock_resp) as mock_get:
        stats = get_social_stats("github", "octocat")
        assert stats["available"]
        assert stats["stats"]["public_repos"] == 42
        assert stats["stats"]["followers"] == 100
        mock_get.assert_called_once()

        # Test cache hit (no second network call)
        stats2 = get_social_stats("github", "octocat")
        assert stats2["available"]
        assert mock_get.call_count == 1


def test_social_stats_codeforces_mocked():
    _STATS_CACHE.clear()
    mock_resp = mock.MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "OK",
        "result": [{
            "rating": 1650,
            "maxRating": 1720,
            "rank": "expert",
            "maxRank": "expert"
        }]
    }

    with mock.patch("requests.get", return_value=mock_resp) as mock_get:
        stats = get_social_stats("codeforces", "tourist")
        assert stats["available"]
        assert stats["stats"]["rating"] == 1650
        assert stats["stats"]["rank"] == "expert"
        mock_get.assert_called_once()


def test_social_stats_leetcode_mocked():
    _STATS_CACHE.clear()
    mock_resp = mock.MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "data": {
            "matchedUser": {
                "submitStatsGlobal": {
                    "acSubmissionNum": [
                        {"difficulty": "All", "count": 450},
                        {"difficulty": "Easy", "count": 150},
                        {"difficulty": "Medium", "count": 250},
                        {"difficulty": "Hard", "count": 50}
                    ]
                },
                "profile": {
                    "ranking": 12500
                }
            }
        }
    }

    with mock.patch("requests.post", return_value=mock_resp) as mock_post:
        stats = get_social_stats("leetcode", "algo_master")
        assert stats["available"]
        assert stats["stats"]["total_solved"] == 450
        assert stats["stats"]["medium_solved"] == 250
        mock_post.assert_called_once()

