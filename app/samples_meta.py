import glob
import os
import re
from typing import Any, Dict, List, Optional
from pypdf import PdfReader

ROOT = os.path.join(os.path.dirname(__file__), "..", "data")

_SAMPLES_META_CACHE: Optional[Dict[str, Any]] = None


def format_ctc_short(ctc_str: str) -> str:
    """Format an Indian currency CTC string like '₹32,00,000' to short form '₹32L'."""
    nums = re.sub(r"[^\d]", "", ctc_str)
    if not nums:
        return ctc_str
    val = int(nums)
    lakhs = val / 100000.0
    if lakhs == int(lakhs):
        return f"₹{int(lakhs)}L"
    formatted = f"{lakhs:.2f}".rstrip("0").rstrip(".")
    return f"₹{formatted}L"


def parse_jd_meta(pdf_path: str) -> Dict[str, Any]:
    """Parse title line, role category, location, and CTC from JD PDF text."""
    reader = PdfReader(pdf_path)
    txt = reader.pages[0].extract_text()
    lines = [line.strip() for line in txt.split("\n") if line.strip()]

    # 1. Title line: everything before 'Role Category:'
    title_lines = []
    for line in lines:
        if line.startswith("Role Category:"):
            break
        title_lines.append(line)
    full_title = " ".join(title_lines)

    company = ""
    role = ""
    if "—" in full_title:
        parts = full_title.split("—", 1)
        company = parts[0].strip()
        role = parts[1].strip()
    elif "-" in full_title:
        parts = full_title.split("-", 1)
        company = parts[0].strip()
        role = parts[1].strip()
    else:
        role = full_title

    # 2. Role Category
    role_category = ""
    for line in lines:
        if line.startswith("Role Category:"):
            role_category = line.replace("Role Category:", "").strip()
            break

    # 3. Location and CTC line
    location = ""
    ctc = ""
    for line in lines:
        if "·" in line and "CTC" in line:
            parts = [p.strip() for p in line.split("·")]
            loc_part = parts[0]
            loc_clean = re.sub(r",\s*India\b", "", loc_part).strip()
            location = re.sub(r"\s+", " ", loc_clean)

            m_ctc = re.search(r"(₹[\d,]+)", line)
            if m_ctc:
                ctc = m_ctc.group(1)
            break

    name = os.path.basename(pdf_path)[:-4]
    company_id = 4 if "Google" in company else (78 if "Microsoft" in company else 24)

    return {
        "name": name,
        "company": company,
        "role": role,
        "role_category": role_category,
        "location": location,
        "ctc": ctc,
        "ctc_short": format_ctc_short(ctc),
        "company_id": company_id,
    }


def parse_resume_meta(pdf_path: str) -> Dict[str, Any]:
    """Parse candidate full name and subtitle headline from resume PDF text."""
    reader = PdfReader(pdf_path)
    txt = reader.pages[0].extract_text()
    lines = [line.strip() for line in txt.split("\n") if line.strip()]

    # Ignore header banners
    clean_lines = [l for l in lines if "RADIX" not in l and not l.startswith("Page ")]
    full_name = clean_lines[0] if clean_lines else ""

    # Headline is line(s) between full_name and 'Education'
    headline_lines = []
    for l in clean_lines[1:]:
        if l == "Education" or l.startswith("Education"):
            break
        headline_lines.append(l)
    headline = " ".join(headline_lines).strip()

    name = os.path.basename(pdf_path)[:-4]

    return {
        "name": name,
        "full_name": full_name,
        "headline": headline,
        "email": f"{name}@demo.local",
    }


def get_samples_meta(use_cache: bool = True) -> Dict[str, Any]:
    """Return parsed metadata for all sample JDs and resumes via data_source."""
    global _SAMPLES_META_CACHE
    if use_cache and _SAMPLES_META_CACHE is not None:
        return _SAMPLES_META_CACHE

    try:
        from . import data_source
        data = data_source.get_samples_meta()
        if use_cache:
            _SAMPLES_META_CACHE = data
        return data
    except Exception:
        pass

    jd_files = sorted(glob.glob(os.path.join(ROOT, "jds", "*.pdf")))
    resume_files = sorted(glob.glob(os.path.join(ROOT, "resumes", "*.pdf")))

    jds = [parse_jd_meta(f) for f in jd_files]
    resumes = [parse_resume_meta(f) for f in resume_files]

    data = {
        "jds": jds,
        "resumes": resumes,
    }

    if use_cache:
        _SAMPLES_META_CACHE = data

    return data

