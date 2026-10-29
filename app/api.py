import os
import time
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import extract as X
from .talent_check import talent_check, candidate_levels
from .skill_match import match
from .config import LLM_PROVIDER, MODEL
from .ats import ats_check
from .socials import extract_socials, get_social_stats
from .provenance import evaluate_provenance
from .roadmap import create_roadmap
from . import insights as INSIGHTS
from . import data_source

from .auth import optional_user
from .ratelimit import check_rate_limit
from . import me
from .me import get_user_store

MAX_FILE_SIZE = 4 * 1024 * 1024  # 4 MB
ALLOWED_RESUME_EXTS = (".pdf", ".docx", ".doc", ".txt")
ALLOWED_JD_EXTS = (".pdf", ".docx", ".doc", ".txt")

ALLOWED_RESUME_MIMES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "application/octet-stream"
}

ALLOWED_JD_MIMES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "application/octet-stream"
}

app = FastAPI(title="RADIX Talent Match v2", version="2.0.0")

allowed_origins = ["*"]
vercel_url = os.getenv("VERCEL_URL", "").strip()
if vercel_url:
    allowed_origins = [
        f"https://{vercel_url}",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.middleware("http")
async def handle_api_prefix(request: Request, call_next):
    path = request.scope.get("path", "")
    if path.startswith("/api/") and not path.startswith("/api/index.py"):
        subpath = path[4:]
        if not subpath.startswith("/"):
            subpath = "/" + subpath
        request.scope["path"] = subpath
    elif path == "/api":
        request.scope["path"] = "/"
    return await call_next(request)


app.include_router(me.router)


class SocialStatsRequest(BaseModel):
    platform: str
    username: str


class ProvenanceRequest(BaseModel):
    github_username: str
    resume_text: Optional[str] = None
    projects: Optional[list] = None
    skills: Optional[list] = None


class RoadmapRequest(BaseModel):
    readiness_gaps: Optional[list] = None
    candidate_levels: Optional[dict] = None
    required_levels: Optional[dict] = None
    company_id: Optional[int] = None
    missing_jd_skills: Optional[list] = None
    ats_findings: Optional[list] = None
    provenance_warnings: Optional[list] = None
    hours_per_week: Optional[int] = 8
    target_score: Optional[float] = None
    weeks: Optional[int] = 12


@app.get("/health")
def health():
    hdata = data_source.check_health_data()
    if hdata.get("status") != "ok":
        raise HTTPException(status_code=503, detail="Reference data source unavailable")

    provider = os.getenv("LLM_PROVIDER", LLM_PROVIDER).lower()
    model = os.getenv("RADIX_MODEL", MODEL)
    has_key = bool(os.getenv("GEMINI_API_KEY") if provider == "gemini" else (os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")))
    engine = f"{provider.capitalize()} · {model}" if has_key else "keyword fallback"

    has_supabase_url = bool(os.getenv("SUPABASE_URL", "").strip())
    has_supabase_service = bool(os.getenv("SUPABASE_SERVICE_KEY", "").strip())
    has_supabase_pub = bool(os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip() or os.getenv("SUPABASE_ANON_KEY", "").strip())

    storage_status = "supabase" if (has_supabase_url and has_supabase_service) else "local"
    auth_status = "supabase" if (has_supabase_url and has_supabase_pub) else "disabled"
    has_github_token = bool(os.getenv("GITHUB_TOKEN", "").strip())

    return {
        "status": "ok",
        "data_source": hdata.get("data_source", "supabase"),
        "companies": hdata.get("companies", 0),
        "levels": hdata.get("levels", 0),
        "skill_sets": hdata.get("skill_sets", 12),
        "storage": storage_status,
        "auth": auth_status,
        "llm": has_key,
        "github_token": has_github_token,
        "provider": provider,
        "model": model,
        "engine": engine,
        "active": has_key
    }


@app.get("/config")
def get_config():
    """Returns public config for client-side Supabase authentication."""
    return {
        "supabase_url": os.getenv("SUPABASE_URL", "").strip(),
        "supabase_publishable_key": (os.getenv("SUPABASE_PUBLISHABLE_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")).strip()
    }


@app.get("/companies")
def get_companies():
    """Returns all 113 benchmark companies sorted alphabetically by name."""
    try:
        return data_source.get_sorted_companies_list()
    except data_source.DataSourceUnavailableError:
        raise HTTPException(status_code=503, detail="Company benchmark data unavailable")


@app.get("/samples")
def get_samples():
    """Returns sample metadata and the default sample pair for 'Try with a sample'."""
    try:
        smeta = data_source.get_samples_meta()
    except Exception:
        smeta = {"jds": [], "resumes": []}

    return {
        "sample": {
            "resume": "rohan_verma",
            "jd": "google_swe",
            "resume_file": "rohan_verma.pdf",
            "jd_file": "google_swe.pdf"
        },
        "all": smeta
    }


@app.get("/samples/file/{kind}/{filename}")
def get_sample_file(kind: str, filename: str):
    """Serves sample resume and JD files from remote Supabase public storage (or snapshot)."""
    safe_name = os.path.basename(filename)
    if kind not in ("resumes", "jds"):
        raise HTTPException(status_code=400, detail="Invalid sample kind")
    try:
        file_bytes = data_source.get_sample_file_bytes(kind, safe_name)
        media_type = "application/pdf" if safe_name.lower().endswith(".pdf") else "application/octet-stream"
        return Response(
            content=file_bytes,
            media_type=media_type,
            headers={"Content-Disposition": f'inline; filename="{safe_name}"'}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Sample file not found")



@app.post("/socials/stats")
def fetch_social_stats(req: SocialStatsRequest, request: Request):
    """
    Lazy social platform stats endpoint with 4s timeout and 6h caching.
    LinkedIn is never scraped (returns link only).
    """
    user = optional_user(request)
    check_rate_limit(request, "socials_stats", user=user, guest_limit=20, user_limit=20)
    return get_social_stats(req.platform, req.username)


@app.post("/provenance")
def get_provenance(req: ProvenanceRequest, request: Request):
    """
    Evaluates public GitHub provenance signals against resume projects and skills claims.
    All returned wording explicitly states 'signals, not proof'.
    """
    user = optional_user(request)
    check_rate_limit(request, "provenance", user=user, guest_limit=20, user_limit=20)
    return evaluate_provenance(
        github_username=req.github_username,
        resume_text=req.resume_text,
        projects=req.projects,
        skills=req.skills
    )


@app.post("/roadmap")
def get_roadmap(req: RoadmapRequest, request: Request):
    """
    Generates a deterministic study and practice roadmap greedily allocating study hours
    by readiness score gain per hour.
    """
    user = optional_user(request)
    check_rate_limit(request, "roadmap", user=user, guest_limit=30, user_limit=30)
    return create_roadmap(
        readiness_gaps=req.readiness_gaps,
        candidate_levels=req.candidate_levels,
        required_levels=req.required_levels,
        company_id=req.company_id,
        missing_jd_skills=req.missing_jd_skills,
        ats_findings=req.ats_findings,
        provenance_warnings=req.provenance_warnings,
        hours_per_week=req.hours_per_week or 8,
        target_score=req.target_score,
        weeks=req.weeks or 12
    )


@app.post("/analyze")
async def analyze(
    request: Request,
    resume: Optional[UploadFile] = File(None),
    resume_id: Optional[str] = Form(None),
    save: Optional[bool] = Form(False),
    jd_file: Optional[UploadFile] = File(None),
    jd_text: Optional[str] = Form(None),
    company_id: Optional[str] = Form(None),
    github_username: Optional[str] = Form(None)
):
    """
    Single-user analysis pipeline:
    1. Extract resume and JD
    2. Skill matching with why missing skills matter
    3. Company detection (rapidfuzz >= 88) or resolution
    4. Talent readiness check + waterfall + top 5 next-best-skills
    5. ATS risk and cheat detection
    6. Social profile extraction
    7. Full response with per-step timings
    """
    try:
        overall_start = time.perf_counter()
        timings = {}

        user = optional_user(request)
        check_rate_limit(request, "analyze", user=user, guest_limit=8, user_limit=20)

        # Parse company_id safely
        cid_int: Optional[int] = None
        if company_id is not None and str(company_id).strip():
            try:
                cid_int = int(str(company_id).strip())
            except (ValueError, TypeError):
                cid_int = None

        # --- VALIDATION ---
        saved_resume_row = None
        if resume is not None and resume.filename:
            resume_name = resume.filename
            if not (resume_name.lower().endswith(ALLOWED_RESUME_EXTS) or resume.content_type in ALLOWED_RESUME_MIMES):
                raise HTTPException(
                    status_code=415,
                    detail="Unsupported file format for resume. Please upload a PDF (.pdf), Word (.docx, .doc), or text (.txt) file."
                )

            resume_bytes = await resume.read()
            if len(resume_bytes) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"File size exceeds the 4 MB limit ({len(resume_bytes)/(1024*1024):.1f} MB uploaded). Please upload a smaller file."
                )
            if len(resume_bytes) == 0:
                raise HTTPException(status_code=400, detail="Uploaded resume file is empty.")
        elif resume_id:
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required to use saved resumes")
            store = get_user_store()
            saved_resume_row = store.get_resume(user["id"], resume_id)
            if not saved_resume_row:
                raise HTTPException(status_code=404, detail="Saved resume not found")
            resume_name = saved_resume_row.get("file_name", "saved_resume.pdf")
            saved_extracted = saved_resume_row.get("extracted") or {}
            resume_text_cached = saved_extracted.get("_text", "")
            resume_bytes = resume_text_cached.encode("utf-8")
        else:
            raise HTTPException(status_code=422, detail="Please upload a resume file or select a saved resume.")

        has_jd_file = jd_file is not None and bool(jd_file.filename)
        has_jd_text = bool(jd_text and jd_text.strip())

        if not has_jd_file and not has_jd_text:
            raise HTTPException(
                status_code=422,
                detail="Please provide a job description as a file or text."
            )

        if has_jd_file:
            jd_name = jd_file.filename or "job_description.pdf"
            if not (jd_name.lower().endswith(ALLOWED_JD_EXTS) or jd_file.content_type in ALLOWED_JD_MIMES):
                raise HTTPException(
                    status_code=415,
                    detail="Unsupported file format for job description. Please upload a PDF (.pdf), DOCX (.docx), or text (.txt) file."
                )
            jd_bytes = await jd_file.read()
            if len(jd_bytes) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"Job description exceeds the 4 MB limit ({len(jd_bytes)/(1024*1024):.1f} MB uploaded). Please upload a smaller file."
                )
        else:
            jd_name = "pasted_jd.txt"
            jd_bytes = jd_text.strip().encode("utf-8")

        # --- STEP 1: EXTRACTION ---
        t0 = time.perf_counter()
        extract_res = {}
        resume_data = {}
        jd_data = {}
        resume_text = ""
        jd_text_str = ""

        try:
            if saved_resume_row and saved_resume_row.get("extracted"):
                resume_data = saved_resume_row["extracted"]
                resume_text = resume_data.get("_text", "")
            else:
                resume_data = X.extract(resume_bytes, "resume", resume_name, use_cache=True)
                resume_text = X.read_text(resume_bytes, resume_name)
                resume_data["_text"] = resume_text

            jd_data = X.extract(jd_bytes, "jd", jd_name, use_cache=True)
            jd_text_str = X.read_text(jd_bytes, jd_name)

            extract_res = {
                "resume": {
                    "source_file": resume_data.get("source_file", resume_name),
                    "role": resume_data.get("role", ""),
                    "skills": resume_data.get("skills", []),
                    "skills_count": len(resume_data.get("skills", [])),
                    "raw_text": resume_text
                },
                "jd": {
                    "source_file": jd_data.get("source_file", jd_name),
                    "company": jd_data.get("company", ""),
                    "role": jd_data.get("role", ""),
                    "skills": jd_data.get("skills", []),
                    "skills_count": len(jd_data.get("skills", []))
                }
            }
        except Exception as e:
            extract_res = {"error": f"Extraction failed: {str(e)}"}
        timings["extract"] = round(time.perf_counter() - t0, 3)

        # --- STEP 2: SKILL MATCH ---
        t0 = time.perf_counter()
        match_res = {}
        try:
            if "error" in extract_res:
                match_res = {"error": "Skipped due to extraction error"}
            else:
                cand_skills = resume_data.get("skills", [])
                m_out = match(cand_skills, jd_data)

                # Enrich missing skills with why they matter
                missing_enriched = []
                for item in m_out.get("missing_skills", []):
                    why = item.get("why_needed") or (
                        f"Required for {item.get('category_code', 'core')} competencies specified in the role description."
                    )
                    missing_enriched.append({
                        "skill": item.get("skill"),
                        "category_code": item.get("category_code"),
                        "why_needed": why
                    })

                match_res = {
                    "match_score": m_out.get("match_score", 0),
                    "matched_count": len(m_out.get("matched_skills", [])),
                    "missing_count": len(missing_enriched),
                    "matched_skills": m_out.get("matched_skills", []),
                    "missing_skills": missing_enriched
                }
        except Exception as e:
            match_res = {"error": f"Skill matching failed: {str(e)}"}
        timings["match"] = round(time.perf_counter() - t0, 3)

        # --- STEP 3: COMPANY DETECTION & RESOLUTION ---
        t0 = time.perf_counter()
        company_res = {}
        resolved_cid = None
        resolved_name = None

        try:
            all_comps = INSIGHTS.get_all_companies()
            if cid_int is not None and cid_int in all_comps:
                resolved_cid = cid_int
                resolved_name = all_comps[resolved_cid]["name"]
                company_res = {
                    "company_id": resolved_cid,
                    "company": resolved_name,
                    "auto_detected": False
                }
            else:
                # Fuzzy-match JD's company name against 113 companies using rapidfuzz >= 88
                jd_comp = jd_data.get("company", "") if "error" not in extract_res else ""
                auto_cid, auto_name, matched_ok = INSIGHTS.find_matching_company(jd_comp, threshold=88)
                if matched_ok:
                    resolved_cid = auto_cid
                    resolved_name = auto_name
                    company_res = {
                        "company_id": resolved_cid,
                        "company": resolved_name,
                        "auto_detected": True
                    }
                else:
                    company_res = {
                        "company_id": None,
                        "company": None,
                        "auto_detected": False
                    }
        except Exception as e:
            company_res = {"error": f"Company resolution failed: {str(e)}"}
        timings["company"] = round(time.perf_counter() - t0, 3)

        # --- STEP 4: TALENT READINESS & WATERFALL & NEXT-BEST-SKILLS ---
        t0 = time.perf_counter()
        readiness_res = None
        try:
            if resolved_cid is not None and "error" not in extract_res:
                cand_skills = resume_data.get("skills", [])
                cand_lvls = candidate_levels(cand_skills)
                tc = talent_check(cand_skills, resolved_cid, resolved_name)
                wf = INSIGHTS.compute_waterfall(cand_lvls, resolved_cid)
                next_best = INSIGHTS.compute_next_best_skills(cand_lvls, resolved_cid, top_n=5)

                readiness_res = {
                    "readiness_score": tc["readiness_score"],
                    "company_id": resolved_cid,
                    "company": resolved_name,
                    "skillset_gap": tc["skillset_gap"],
                    "waterfall": wf["items"],
                    "next_best_skills": next_best
                }
            else:
                # Readiness is null when no company is identified/specified so UI shows a company picker
                readiness_res = None
        except Exception as e:
            readiness_res = {"error": f"Readiness evaluation failed: {str(e)}"}
        timings["readiness"] = round(time.perf_counter() - t0, 3)

        # --- STEP 5: ATS RISK & CHEAT DETECTION ---
        t0 = time.perf_counter()
        ats_res = {}
        try:
            cand_skills = resume_data.get("skills", []) if "error" not in extract_res else []
            ats_res = ats_check(
                file_bytes=resume_bytes,
                filename=resume_name,
                text=resume_text,
                jd_text=jd_text_str,
                skills_extracted=cand_skills
            )
        except Exception as e:
            ats_res = {"error": f"ATS check failed: {str(e)}"}
        timings["ats"] = round(time.perf_counter() - t0, 3)

        # --- STEP 6: SOCIAL PROFILE EXTRACTION ---
        t0 = time.perf_counter()
        socials_res = []
        github_detected = None
        try:
            socials_res = extract_socials(resume_text, file_bytes=resume_bytes, filename=resume_name)
            if github_username and github_username.strip():
                gh_clean = github_username.strip().lstrip("@")
                if not any(s.get("platform") == "github" and s.get("username").lower() == gh_clean.lower() for s in socials_res):
                    socials_res.append({
                        "platform": "github",
                        "username": gh_clean,
                        "url": f"https://github.com/{gh_clean}",
                        "source": "input",
                        "confidence": "high"
                    })
            # Extract detected GitHub username if available
            for s in socials_res:
                if s.get("platform") == "github" and s.get("username"):
                    github_detected = s.get("username")
                    break
        except Exception as e:
            socials_res = {"error": f"Social extraction failed: {str(e)}"}
        timings["socials"] = round(time.perf_counter() - t0, 3)

        # --- STEP 7: RESPONSE AGGREGATION & TIMINGS ---
        timings["total"] = round(time.perf_counter() - overall_start, 3)

        response_data = {
            "extract": extract_res,
            "match": match_res,
            "company": company_res,
            "readiness": readiness_res,
            "ats": ats_res,
            "socials": socials_res,
            "github_username_detected": github_detected,
            "timings": timings
        }

        if save and user:
            try:
                store = get_user_store()
                r_score = None
                if isinstance(readiness_res, dict):
                    r_score = readiness_res.get("readiness_score") or readiness_res.get("overall_score")
                ats_s = None
                if isinstance(ats_res, dict):
                    ats_s = ats_res.get("risk_score") or ats_res.get("score")
                m_score = None
                if isinstance(match_res, dict):
                    m_score = match_res.get("match_score")

                created_analysis = store.create_analysis(
                    user_id=user["id"],
                    resume_id=saved_resume_row["id"] if saved_resume_row else (resume_id if resume_id else None),
                    jd_title=extract_res.get("jd", {}).get("role") or "",
                    jd_company=company_res.get("company") or company_res.get("company_name") or extract_res.get("jd", {}).get("company") or "",
                    jd=extract_res.get("jd", {}),
                    result=response_data,
                    match_score=m_score,
                    readiness_score=r_score,
                    ats_score=ats_s
                )
                response_data["analysis_id"] = created_analysis.get("id")
            except Exception as e:
                pass

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


from fastapi.staticfiles import StaticFiles

if os.getenv("VERCEL") != "1" or os.getenv("RADIX_SERVE_STATIC") == "1":
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    if os.path.exists(static_dir):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

