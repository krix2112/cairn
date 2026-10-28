import glob
import os
import re
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import extract as X
from app.config import CODES

VALID_CODES = set(CODES)
JD_FILES = sorted(glob.glob("data/jds/*.pdf"))
RESUME_FILES = sorted(glob.glob("data/resumes/*.pdf"))

def _run_suite(use_cache: bool = True):
    all_files = [(f, "jd") for f in JD_FILES] + [(f, "resume") for f in RESUME_FILES]
    assert len(JD_FILES) == 6, f"Expected 6 JDs, found {len(JD_FILES)}"
    assert len(RESUME_FILES) == 4, f"Expected 4 resumes, found {len(RESUME_FILES)}"

    results = {}
    for path, kind in all_files:
        name = os.path.basename(path)
        res = X.extract(path, kind, name, use_cache=use_cache)
        results[name] = res

        # 1. Assert every file returns >= 5 skills
        skills = res.get("skills", [])
        assert len(skills) >= 5, f"{name}: expected >= 5 skills, got {len(skills)}"

        # 2. Assert category codes are valid
        for s in skills:
            code = s.get("category_code")
            assert code in VALID_CODES, f"{name}: invalid category code '{code}' in skill '{s.get('skill_name')}'"

            # 3. Assert no evidence string contains CTC/RSUs
            ev = s.get("evidence", "").lower()
            assert not re.search(r"\b(ctc|rsus?)\b", ev), f"{name}: evidence contains CTC/RSUs: '{ev}'"

    # 4. Assert Priya's resume has SQL/NETW/OS
    priya_skills = results["priya_menon.pdf"]["skills"]
    priya_cats = {s["category_code"] for s in priya_skills}
    for req in ("SQL", "NETW", "OS"):
        assert req in priya_cats, f"priya_menon.pdf is missing required category '{req}'. Found: {priya_cats}"

    # 5. Assert Rohan's resume has DSA/SYSD/OOD
    rohan_skills = results["rohan_verma.pdf"]["skills"]
    rohan_cats = {s["category_code"] for s in rohan_skills}
    for req in ("DSA", "SYSD", "OOD"):
        assert req in rohan_cats, f"rohan_verma.pdf is missing required category '{req}'. Found: {rohan_cats}"

    return results


def test_extract_fallback():
    """Test extract() with API keys removed (forces fallback)."""
    orig_gemini = os.environ.pop("GEMINI_API_KEY", None)
    orig_groq = os.environ.pop("GROQ_API_KEY", None)
    orig_openai = os.environ.pop("OPENAI_API_KEY", None)
    orig_no_cache = os.environ.get("RADIX_NO_CACHE")
    os.environ["RADIX_NO_CACHE"] = "1"

    try:
        results = _run_suite(use_cache=False)
        print("\n[PASSED] test_extract_fallback: all 10 files asserted successfully.")
    finally:
        if orig_gemini is not None:
            os.environ["GEMINI_API_KEY"] = orig_gemini
        if orig_groq is not None:
            os.environ["GROQ_API_KEY"] = orig_groq
        if orig_openai is not None:
            os.environ["OPENAI_API_KEY"] = orig_openai
        if orig_no_cache is not None:
            os.environ["RADIX_NO_CACHE"] = orig_no_cache
        else:
            os.environ.pop("RADIX_NO_CACHE", None)


def test_extract_with_real_key():
    """Test extract() with real API key if configured."""
    has_key = X.is_llm_configured()
    if not has_key:
        pytest.skip("No real API key found in environment (.env). Skipping real-key test.")

    results = _run_suite(use_cache=True)
    print("\n[PASSED] test_extract_with_real_key: all 10 files asserted successfully with active LLM.")


if __name__ == "__main__":
    print("--- Running test_extract_fallback ---")
    test_extract_fallback()

    print("\n--- Running test_extract_with_real_key ---")
    if X.is_llm_configured():
        test_extract_with_real_key()
    else:
        print("Note: Real API key (GEMINI_API_KEY or GROQ_API_KEY) is not currently set in .env.")
    print("\nAll tests completed.")
