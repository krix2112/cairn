from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from . import extract as X, profile as P
from .talent_check import talent_check
from .skill_match import match
from .config import COMPANIES, LLM_PROVIDER, MODEL
import glob, os
from fastapi.staticfiles import StaticFiles

ROOT = os.path.join(os.path.dirname(__file__), '..', 'data')
app = FastAPI(title="RADIX Talent Match")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/companies")
def companies():
    return COMPANIES

@app.get("/health")
def health():
    provider = os.getenv("LLM_PROVIDER", LLM_PROVIDER).lower()
    model = os.getenv("RADIX_MODEL", MODEL)
    has_key = bool(os.getenv("GEMINI_API_KEY") if provider == "gemini" else os.getenv("GROQ_API_KEY"))
    engine = f"{provider.capitalize()} · {model}" if has_key else "keyword fallback"
    return {
        "status": "ok",
        "llm": has_key,
        "provider": provider,
        "model": model,
        "engine": engine,
        "active": has_key
    }

@app.post("/jd/analyze")
async def jd(file: UploadFile = File(...)):
    raw = await file.read()
    if not X.is_cached(raw, "jd") and not X.is_llm_configured():
        raise HTTPException(status_code=503, detail="Needs LLM access: This document is not in local cache and requires an active LLM connection to analyze.")
    try:
        return X.extract(raw, "jd", file.filename)
    except Exception as e:
        raise HTTPException(status_code=503, detail="Needs LLM access: Real model extraction is unavailable while offline.")

@app.post("/resume/parse")
async def resume(file: UploadFile = File(...)):
    raw = await file.read()
    if not X.is_cached(raw, "resume") and not X.is_llm_configured():
        raise HTTPException(status_code=503, detail="Needs LLM access: This document is not in local cache and requires an active LLM connection to parse.")
    try:
        return _res(X.extract(raw, "resume", file.filename))
    except Exception as e:
        raise HTTPException(status_code=503, detail="Needs LLM access: Real model extraction is unavailable while offline.")

def _res(r):
    return {**{k: v for k, v in r.items() if k != "_text"}, "prefill": P.from_resume(r)}

from .samples_meta import get_samples_meta

@app.get("/samples")
def samples():
    return {k: sorted(os.path.basename(f)[:-4] for f in glob.glob(f"{ROOT}/{k}/*.pdf")) for k in ("jds", "resumes")}

@app.get("/samples/meta")
def samples_meta():
    return get_samples_meta()

@app.post("/samples/analyze")
def sample(b: dict):
    k = "jds" if b["kind"] == "jd" else "resumes"
    n = os.path.basename(b["name"])
    r = X.extract(f"{ROOT}/{k}/{n}.pdf", b["kind"], n + ".pdf")
    return r if b["kind"] == "jd" else _res(r)

@app.post("/profile")
def save_profile(p: dict):
    try:
        return P.save(p)
    except ValueError as e:
        raise HTTPException(422, e.args[0])

@app.get("/profile/{email}")
def get_profile(email: str):
    try:
        return P.load(email)
    except FileNotFoundError:
        raise HTTPException(404, "no profile")

@app.post("/talent-check")
def tc(body: dict):
    return talent_check(P.load(body["email"]), int(body["company_id"]))

@app.post("/match")
def mt(body: dict):
    return match(P.load(body["email"])["skills"], body["jd"])

from . import insights as INSIGHTS

@app.get("/insights/fit")
def insights_fit(email: str):
    try:
        return INSIGHTS.get_insights_fit(email)
    except FileNotFoundError:
        raise HTTPException(404, "Candidate profile not found")

@app.get("/insights/roles")
def insights_roles(email: str):
    try:
        return INSIGHTS.get_insights_roles(email)
    except FileNotFoundError:
        raise HTTPException(404, "Candidate profile not found")

@app.get("/insights/waterfall")
def insights_waterfall(email: str, company_id: int = 4):
    try:
        return INSIGHTS.get_insights_waterfall(email, company_id)
    except FileNotFoundError:
        raise HTTPException(404, "Candidate profile not found")

@app.get("/insights/band")
def insights_band(email: str, company_id: int = 4):
    try:
        return INSIGHTS.get_insights_band(email, company_id)
    except FileNotFoundError:
        raise HTTPException(404, "Candidate profile not found")

@app.post("/insights/plan")
def insights_plan(body: dict):
    try:
        email = body.get("email")
        cid = int(body.get("company_id", 4))
        hpw = float(body.get("hours_per_week", 10))
        target = int(body.get("target_score", 75))
        return INSIGHTS.post_insights_plan(email, cid, hpw, target)
    except FileNotFoundError:
        raise HTTPException(404, "Candidate profile not found")

app.mount('/', StaticFiles(directory=os.path.join(os.path.dirname(__file__), 'static'), html=True))

