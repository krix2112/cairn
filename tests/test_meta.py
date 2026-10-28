import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.samples_meta import get_samples_meta, parse_jd_meta, parse_resume_meta


def test_samples_meta_jds():
    """Verify all 6 sample JDs match real PDF text parsing."""
    meta = get_samples_meta(use_cache=False)
    jds_by_name = {j["name"]: j for j in meta["jds"]}

    assert len(jds_by_name) == 6, f"Expected 6 sample JDs, found {len(jds_by_name)}"

    # 1. Google SWE = Bengaluru (Hybrid), ₹32,00,000
    swe = jds_by_name["google_swe"]
    assert "Google" in swe["company"]
    assert "Software Engineer" in swe["role"]
    assert swe["location"] == "Bengaluru (Hybrid)"
    assert swe["ctc"] == "₹32,00,000"
    assert swe["ctc_short"] == "₹32L"

    # 2. Google Data Scientist = Bengaluru, ₹28,00,000
    ds = jds_by_name["google_ds"]
    assert "Google" in ds["company"]
    assert "Data Scientist" in ds["role"]
    assert ds["location"] == "Bengaluru"
    assert ds["ctc"] == "₹28,00,000"
    assert ds["ctc_short"] == "₹28L"

    # 3. Microsoft SWE = Hyderabad, ₹28,00,000
    ms_swe = jds_by_name["microsoft_swe"]
    assert "Microsoft" in ms_swe["company"]
    assert "Software Engineer" in ms_swe["role"]
    assert ms_swe["location"] == "Hyderabad"
    assert ms_swe["ctc"] == "₹28,00,000"
    assert ms_swe["ctc_short"] == "₹28L"

    # 4. Microsoft Data Analyst = Hyderabad, ₹18,00,000
    ms_da = jds_by_name["microsoft_da"]
    assert "Microsoft" in ms_da["company"]
    assert "Data Analyst" in ms_da["role"]
    assert ms_da["location"] == "Hyderabad"
    assert ms_da["ctc"] == "₹18,00,000"
    assert ms_da["ctc_short"] == "₹18L"

    # 5. Oracle Associate Software Engineer = Bengaluru / Mumbai, ₹5,50,000
    ora_ase = jds_by_name["oracle_ase"]
    assert "Oracle" in ora_ase["company"]
    assert "Associate Software Engineer" in ora_ase["role"]
    assert ora_ase["location"] == "Bengaluru / Mumbai"
    assert ora_ase["ctc"] == "₹5,50,000"
    assert ora_ase["ctc_short"] == "₹5.5L"

    # 6. Oracle Application Support Analyst = Bengaluru / Chennai, ₹4,50,000
    ora_asa = jds_by_name["oracle_asa"]
    assert "Oracle" in ora_asa["company"]
    assert "Application Support Analyst" in ora_asa["role"]
    assert ora_asa["location"] == "Bengaluru / Chennai"
    assert ora_asa["ctc"] == "₹4,50,000"
    assert ora_asa["ctc_short"] == "₹4.5L"


def test_samples_meta_resumes():
    """Verify all 4 sample resume headlines match real PDF subtitle lines."""
    meta = get_samples_meta(use_cache=False)
    res_by_name = {r["name"]: r for r in meta["resumes"]}

    assert len(res_by_name) == 4, f"Expected 4 sample resumes, found {len(res_by_name)}"

    # Ananya = systems-leaning generalist
    ananya = res_by_name["ananya_rao"]
    assert ananya["full_name"] == "Ananya Rao"
    assert "systems-leaning generalist" in ananya["headline"].lower()

    # Karthik = data-leaning analyst
    karthik = res_by_name["karthik_subramaniam"]
    assert karthik["full_name"] == "Karthik Subramaniam"
    assert "data-leaning analyst" in karthik["headline"].lower()

    # Priya = entry-level, support-oriented
    priya = res_by_name["priya_menon"]
    assert priya["full_name"] == "Priya Menon"
    assert "entry-level, support-oriented" in priya["headline"].lower()

    # Rohan = strong all-rounder
    rohan = res_by_name["rohan_verma"]
    assert rohan["full_name"] == "Rohan Verma"
    assert "strong all-rounder" in rohan["headline"].lower()
