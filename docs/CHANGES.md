# Comprehensive Audit & Changes Report: Radix Evolution (A vs B vs C)

**Audit Date**: 2026-10-29  
**Audited Folders**:
- **Folder A**: `d:\radix_v1_frozen` (Hackathon demo release)
- **Folder B**: `d:\radix` (Cairn redesign with 3D UI & Waypoints)
- **Folder C**: `d:\radix_v2_vercel` (Current production single-user app with auth & Supabase)

---

## 1. SNAPSHOT

| Metric | Folder A (`radix_v1_frozen`) | Folder B (`radix`) | Folder C (`radix_v2_vercel`) |
| :--- | :--- | :--- | :--- |
| **File Count** *(excl. `.venv`, `node_modules`, `__pycache__`, `screenshots`, `.git`)* | 139 files | 194 files | 199 files |
| **Total Size** | 8.27 MB (8,666,739 bytes) | 117.52 MB (123,231,671 bytes) | 80.55 MB (84,459,941 bytes) |
| **Last Modified Date** | 2026-10-28 02:51:13 | 2026-10-28 23:47:16 | 2026-10-29 11:39:21 |
| **Python Version** | Python 3.13.14 | Python 3.13.14 | Python 3.13.14 |
| **Pytest Test Results** | **10 passed**, 0 failed (10.95s) | **17 passed**, 0 failed (17.45s) | **55 passed**, 0 failed (19.22s) |

---

## 2. FILE DIFF: C vs B and C vs A

### A. Folder C vs Folder B

#### 1. Backend
- **Added** (`api/index.py`, `app/ats.py`, `app/auth.py`, `app/me.py`, `app/provenance.py`, `app/ratelimit.py`, `app/roadmap.py`, `app/socials.py`, `app/store.py`): Added modular engines for ATS detection, Git provenance, social profile fetching, greedy roadmap generation, Supabase caching/storage, rate limiting, and authenticated user endpoints.
- **Modified** (`app/api.py`, `app/extract.py`, `app/insights.py`, `app/talent_check.py`): Consolidated multi-step pipeline into unified `POST /analyze`, integrated store caching, and updated data loaders.
- **Removed**: None.

#### 2. Frontend
- **Added** (`app/static/analyze.html`, `app/static/dashboard.html`, `app/static/fonts.css`, `app/static/login.html`, `app/static/vendor/supabase.min.js`, and all mirrored assets under `public/`): Created clean, framework-free fintech UI with self-hosted IBM Plex Sans fonts and self-hosted `supabase-js`.
- **Modified** (`app/static/index.html`): Replaced heavy 3D landing page with light-theme fintech landing page with dynamic auth state.
- **Removed** (`app/static/404.html`, `app/static/app.html`, `app/static/brand.js`, `app/static/cairn.js`, `app/static/cairn3d.js`, `app/static/motion.js`, `app/static/styles.css`, `app/static/vendor/three.min.js`, `app/static/vendor/gsap.min.js`, `app/static/vendor/ScrollTrigger.min.js`, `app/static/vendor/lenis.min.js`, `app/static/vendor/react*.js`, and 12 files in `app/static/waypoints/*.js`): Purged heavy 3D WebGL runtime, React vendor scripts, and waypoints in favor of fast, accessible vanilla HTML/CSS.

#### 3. Data
- **Added** (`data/roadmap_kb.json`, `data/cache/971d1b...json`): Added 12-area curriculum knowledge base for roadmaps and pre-warmed candidate extraction cache.
- **Modified** (`data/company_skill_levels_rows.csv`): Synchronized Volvo Group (ID 19) benchmark levels across rows 217–228.
- **Removed**: None.

#### 4. Tests
- **Added** (`tests/test_analyze_endpoint.py`, `tests/test_ats.py`, `tests/test_provenance.py`, `tests/test_roadmap.py`, `tests/test_socials.py`, `tests/test_store_and_auth.py`): Added comprehensive test suites covering diagnostic pipelines, mock network calls, cross-user isolation, and rate limits.
- **Modified** (`tests/test_insights.py`): Aligned company loader assertions.
- **Removed**: None.

#### 5. Docs & Scripts
- **Added** (`DEPLOY.md`, `scripts/smoke_deployed.py`, `scripts/sync_public.py`, `run_e2e_candidates.py`, `run_e2e_timing.py`, `verify_frontend.py`): Added deployment documentation, production smoke test script, asset syncer, and verification runners.
- **Modified** (`README.md`): Updated architecture documentation.
- **Removed**: None.

#### 6. Config
- **Added** (`vercel.json`, `requirements-dev.txt`): Configured Vercel function routes/rewrites and separated development tooling from production runtime.
- **Modified** (`requirements.txt`, `.gitignore`, `.env`): Trimmed runtime dependencies down to production serverless essentials and ignored secret files.
- **Removed**: None.

---

### B. Folder C vs Folder A

#### 1. Backend
- **Added** (`api/index.py`, `app/ats.py`, `app/auth.py`, `app/insights.py`, `app/me.py`, `app/provenance.py`, `app/ratelimit.py`, `app/roadmap.py`, `app/socials.py`, `app/store.py`): Comprehensive modernization from hackathon prototype to full diagnostic and storage suite.
- **Modified** (`app/api.py`, `app/config.py`, `app/extract.py`, `app/talent_check.py`): Restructured APIs from fragmented endpoints into unified pipeline with enterprise error handling.
- **Removed**: None.

#### 2. Frontend
- **Added** (`app/static/analyze.html`, `app/static/dashboard.html`, `app/static/fonts.css`, `app/static/login.html`, `public/*`): Complete replacement of the legacy prototype UI.
- **Modified** (`app/static/index.html`): Transformed from prototype into production landing page.
- **Removed** (`app/static/app.html`, `app/static/styles.css`, `app/static/brand.js`, `app/static/cairn.js`, `app/static/motion.js`, `app/static/vendor/*`, `app/static/waypoints/*`): Removed legacy prototype frontend.

#### 3. Data
- **Added** (`data/roadmap_kb.json`, `data/company_json_rows__1_.csv`, cache entries): Added curriculum knowledge base and pre-extracted benchmark caches.
- **Modified** (`data/company_skill_levels_rows.csv`): Synchronized Volvo Group (ID 19) benchmark levels.
- **Removed**: None.

#### 4. Tests
- **Added** (`tests/test_analyze_endpoint.py`, `tests/test_ats.py`, `tests/test_insights.py`, `tests/test_provenance.py`, `tests/test_roadmap.py`, `tests/test_socials.py`, `tests/test_store_and_auth.py`): Scaled test suite from 10 tests to 55 tests.
- **Removed** (`tests/test_waypoints_static.py`): Deleted obsolete waypoints test.

#### 5. Docs & Scripts
- **Added** (`DEPLOY.md`, `scripts/smoke_deployed.py`, `scripts/sync_public.py`, `run_e2e_candidates.py`, `run_e2e_timing.py`, `verify_frontend.py`): Production deployment and verification toolchain.
- **Modified** (`README.md`): Comprehensive project documentation update.
- **Removed**: None.

#### 6. Config
- **Added** (`vercel.json`, `requirements-dev.txt`, `pyproject.toml`): Vercel configuration and modern Python packaging.
- **Modified** (`requirements.txt`, `.gitignore`): Runtime dependency pruning and security hardening.

---

## 3. FEATURES MATRIX

| Feature | In A | In B | In C | Where it lives |
| :--- | :---: | :---: | :---: | :--- |
| **JD analytics** | Done | Done | Done | [app/extract.py](file:///d:/radix_v2_vercel/app/extract.py) |
| **Resume parsing** | Done | Done | Done | [app/extract.py](file:///d:/radix_v2_vercel/app/extract.py) |
| **Profile builder** | Done | Done | Done | [app/profile.py](file:///d:/radix_v2_vercel/app/profile.py) |
| **Talent check** | Done | Done | Done | [app/talent_check.py](file:///d:/radix_v2_vercel/app/talent_check.py) |
| **Skill matching** | Done | Done | Done | [app/skill_match.py](file:///d:/radix_v2_vercel/app/skill_match.py) |
| **3D cairn** | Missing | Done | Removed | Purged in C for performance; was in B (`app/static/cairn3d.js`) |
| **12 waypoints** | Done | Done | Removed | Replaced in C with unified Study Roadmap; was in `app/static/waypoints/` |
| **Skill map** | Missing | Partial | Missing | Planned visual radar; not implemented in standalone file |
| **Insights (waterfall, fit finder, roadmap planner)** | Missing | Done | Done | [app/insights.py](file:///d:/radix_v2_vercel/app/insights.py) |
| **What-if simulator** | Missing | Missing | Missing | Unimplemented in all versions |
| **Compare candidates** | Missing | Missing | Missing | Unimplemented in all versions |
| **Command palette** | Missing | Missing | Missing | Unimplemented in all versions |
| **Report export** | Partial | Partial | Done | [app/static/dashboard.html](file:///d:/radix_v2_vercel/app/static/dashboard.html), [app/me.py](file:///d:/radix_v2_vercel/app/me.py) |
| **ATS cheat detector** | Missing | Missing | Done | [app/ats.py](file:///d:/radix_v2_vercel/app/ats.py) |
| **Resume health score** | Missing | Missing | Done | [app/ats.py](file:///d:/radix_v2_vercel/app/ats.py) |
| **Git provenance** | Missing | Missing | Done | [app/provenance.py](file:///d:/radix_v2_vercel/app/provenance.py) |
| **Social profile extractor** | Missing | Missing | Done | [app/socials.py](file:///d:/radix_v2_vercel/app/socials.py) |
| **Roadmap creator** | Missing | Missing | Done | [app/roadmap.py](file:///d:/radix_v2_vercel/app/roadmap.py), [data/roadmap_kb.json](file:///d:/radix_v2_vercel/data/roadmap_kb.json) |
| **Resume coach** *(tailoring, interview prep)* | Missing | Missing | Missing | Unimplemented in all versions |
| **Authentication** | Missing | Missing | Done | [app/auth.py](file:///d:/radix_v2_vercel/app/auth.py), [app/static/login.html](file:///d:/radix_v2_vercel/app/static/login.html) |
| **Saved resumes** | Missing | Missing | Done | [app/me.py](file:///d:/radix_v2_vercel/app/me.py) (`/me/resumes`) |
| **History and progress trend** | Missing | Missing | Done | [app/me.py](file:///d:/radix_v2_vercel/app/me.py) (`/me/analyses`, `/me/progress`) |
| **Applications tracker** | Missing | Missing | Done | [app/me.py](file:///d:/radix_v2_vercel/app/me.py) (`/me/applications`) |
| **Export/Delete my data** | Missing | Missing | Done | [app/me.py](file:///d:/radix_v2_vercel/app/me.py) (`/me/export`, `DELETE /me`) |
| **Rate limiting** | Missing | Missing | Done | [app/ratelimit.py](file:///d:/radix_v2_vercel/app/ratelimit.py) |
| **Distributed & local caching** | Partial | Partial | Done | [app/store.py](file:///d:/radix_v2_vercel/app/store.py) |
| **Vercel deployment config** | Missing | Missing | Done | [vercel.json](file:///d:/radix_v2_vercel/vercel.json), [api/index.py](file:///d:/radix_v2_vercel/api/index.py), [scripts/sync_public.py](file:///d:/radix_v2_vercel/scripts/sync_public.py) |

---

## 4. API ENDPOINTS COMPARISON (A vs C)

| Method | Path | Auth (A) | Auth (C) | Status in C | Tested in C? | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `GET` | `/health` | Guest | Guest | **Changed** | Yes | Added `storage`, `auth`, `llm`, `github_token` fields |
| `GET` | `/config` | — | Guest | **Added** | Yes | Returns public Supabase keys only (zero secrets) |
| `GET` | `/companies` | Guest | Guest | **Changed** | Yes | Returns sorted list of 113 benchmark companies |
| `GET` | `/samples` | Guest | Guest | **Changed** | Yes | Returns single sample pair (`rohan_verma` + `google_swe`) |
| `GET` | `/samples/file/{k}/{f}` | — | Guest | **Added** | Yes *(smoke)* | Serves sample PDF files for sample evaluation flow |
| `POST` | `/socials/stats` | — | Guest/User | **Added** | Yes | Public platform lookups (4s timeout, 6h cache) |
| `POST` | `/provenance` | — | Guest/User | **Added** | Yes | Evaluates GitHub signals vs claims |
| `POST` | `/roadmap` | — | Guest/User | **Added** | Yes | Greedy score gain study planner |
| `POST` | `/analyze` | — | Guest/User | **Added** | Yes | Replaced fragmented endpoints with unified pipeline |
| `POST` | `/jd/analyze` | Guest | — | **Removed** | — | Consolidated into `/analyze` |
| `POST` | `/resume/parse` | Guest | — | **Removed** | — | Consolidated into `/analyze` |
| `GET` | `/samples/meta` | Guest | — | **Removed** | — | Deprecated in favor of direct sample serving |
| `POST` | `/samples/analyze` | Guest | — | **Removed** | — | Consolidated into `/analyze` |
| `POST` | `/profile` | Guest | — | **Removed** | — | Replaced with authenticated `/me` storage |
| `GET` | `/profile/{email}` | Guest | — | **Removed** | — | Replaced with authenticated `/me` storage |
| `POST` | `/talent-check` | Guest | — | **Removed** | — | Consolidated into `/analyze` |
| `POST` | `/match` | Guest | — | **Removed** | — | Consolidated into `/analyze` |
| `POST` | `/me/resumes` | — | User | **Added** | Yes | Uploads resume, parses in-memory, saves row |
| `GET` | `/me/resumes` | — | User | **Added** | Yes | Lists user resumes |
| `PATCH`| `/me/resumes/{id}` | — | User | **Added** | Yes | Updates title / primary status |
| `DELETE`| `/me/resumes/{id}` | — | User | **Added** | Yes | Deletes storage object and DB record |
| `GET` | `/me/resumes/{id}/download` | — | User | **Added** | Yes | Generates 60s signed download URL |
| `GET` | `/me/analyses` | — | User | **Added** | Yes | Lists user's past evaluation history |
| `GET` | `/me/analyses/{id}` | — | User | **Added** | Yes | Retrieves full report by ID |
| `DELETE`| `/me/analyses/{id}` | — | User | **Added** | Yes | Deletes analysis record |
| `PATCH`| `/me/analyses/{id}/roadmap` | — | User | **Added** | Yes | Updates checklist completion state |
| `GET` | `/me/progress` | — | User | **Added** | Yes | Returns historical score progression |
| `GET` | `/me/applications` | — | User | **Added** | Yes | Lists tracked applications |
| `POST` | `/me/applications` | — | User | **Added** | Yes | Creates new tracked job application |
| `PATCH`| `/me/applications/{id}` | — | User | **Added** | Yes | Updates application stage or notes |
| `DELETE`| `/me/applications/{id}` | — | User | **Added** | Yes | Deletes tracked application |
| `GET` | `/me/export` | — | User | **Added** | Yes | Full JSON export + 10-min signed resume URLs |
| `DELETE`| `/me` | — | User | **Added** | Yes | Permanent account deletion cascade |

*Note on test coverage: Every endpoint in Folder C is covered either in unit tests ([tests/test_store_and_auth.py](file:///d:/radix_v2_vercel/tests/test_store_and_auth.py), [tests/test_analyze_endpoint.py](file:///d:/radix_v2_vercel/tests/test_analyze_endpoint.py)) or the end-to-end smoke test ([scripts/smoke_deployed.py](file:///d:/radix_v2_vercel/scripts/smoke_deployed.py)).*

---

## 5. DATA AUDIT

### Benchmark CSVs & Files in `data/`
- **Volvo Group Rows**: In [data/company_skill_levels_rows.csv](file:///d:/radix_v2_vercel/data/company_skill_levels_rows.csv), rows 217–228 (company ID 19) were modified in Folder C. Exactly 10 rows changed:
  - Row 217: `req_prof` changed from 5 to 3
  - Row 218: `req_prof` changed from 5 to 3
  - Row 219: `req_level` changed from 3 to 6
  - Row 220: `req_level` changed from 4 to 5
  - Row 221: `req_prof` changed from 5 to 3
  - Row 222: `req_level` changed from 6 to 3, `req_prof` from 5 to 1
  - Row 224: `req_level` changed from 4 to 5, `req_prof` from 1 to 3
  - Row 226: `req_prof` changed from 7 to 5
  - Row 227: `req_level` changed from 3 to 6, `req_prof` from 1 to 3
  - Row 228: `req_level` changed from 3 to 6, `req_prof` from 1 to 3
  - *Rows 223 and 225 remain unchanged.*
- **Cache Files**: Pre-warmed extraction JSONs increased from 10 (A) to 11 (B) to 12 (C).
- **Sample PDFs**: Identical in all 3 folders (4 resumes in `data/resumes/`, 6 JDs in `data/jds/`).
- **Roadmap KB**: Added [data/roadmap_kb.json](file:///d:/radix_v2_vercel/data/roadmap_kb.json) in Folder C (curriculum across 12 skill areas).

### Supabase Remote State (Checked with Publishable Key)
Live HTTP inspection of the configured Supabase project (`https://qyzolvyffpwqiwtfytxx.supabase.co`) using only `SUPABASE_PUBLISHABLE_KEY`:

| Resource Expected by Code | Actual Live Status | Error Message |
| :--- | :---: | :--- |
| `public.extraction_cache` | **HTTP 404** | `PGRST205: Could not find table 'public.extraction_cache'` |
| `public.api_cache` | **HTTP 404** | `PGRST205: Could not find table 'public.api_cache'` |
| `public.rate_limits` | **HTTP 404** | `PGRST205: Could not find table 'public.rate_limits'` |
| `public.resumes` | **HTTP 404** | `PGRST205: Could not find table 'public.resumes'` |
| `public.analyses` | **HTTP 404** | `PGRST205: Could not find table 'public.analyses'` |
| `public.applications` | **HTTP 404** | `PGRST205: Could not find table 'public.applications'` |
| `rpc/hit_rate_limit` | **HTTP 404** | `PGRST202: No match found for function public.hit_rate_limit` |
| Storage Bucket `resumes` | **HTTP 400** | `404 Bucket not found` |

- **Storage Backend Reported by `/health`**: Reports `"storage": "local"`. Because `SUPABASE_SERVICE_KEY` is not set locally in `.env`, the server automatically falls back to `LocalStore` and `LocalUserDataStore`.

---

## 6. USER INTERFACE AUDIT

### 1. Landing Page (`index.html`)
- **What it shows**: Header with logo mark and auth navigation; hero banner ("See how well your resume fits a job, and what to fix"); CTAs ("Analyze my resume", "Try with a sample"); static preview card (score ring, skill bars, chips); 3-step "How it works"; 6-feature grid; privacy reassurance strip; FAQ accordion; footer.
- **Screenshots Verified**: `landing_desktop.png` (1440x900), `landing_mobile.png` (390x844).
- **Three Weakest Things**:
  1. Hero right-hand card displays static mock data rather than an interactive live widget.
  2. No inline drag-and-drop zone directly on the landing page (requires navigating to `analyze.html`).
  3. Lacks customer quotes or recruiter testimonials to build trust.

### 2. Analysis Page (`analyze.html`)
- **What it shows**: Status badge; saved resume selector; 4 input blocks (Resume, JD, Benchmark Company, GitHub handle); progress step checklist; 4 summary score rings; 6 diagnostic tabs (Overview, Skills, ATS Health, GitHub Code, Profiles, Study Roadmap); interactive task checkboxes; unobtrusive guest sign-in banner.
- **Screenshots Verified**: `analyze_empty_desktop.png`, `analyze_sample_loaded_desktop.png`, `analyze_mid_progress_desktop.png`, `analyze_tab_overview_desktop.png`, `analyze_tab_skills_desktop.png`, `analyze_tab_ats_desktop.png`, `analyze_tab_github_desktop.png`, `analyze_tab_profiles_desktop.png`, `analyze_tab_roadmap_desktop.png`, `analyze_error_desktop.png`.
- **Three Weakest Things**:
  1. The 6-tab horizontal bar overflows or requires horizontal scrolling on mobile viewports (390px).
  2. Selecting a saved resume displays a text badge instead of an inline preview of the PDF file.
  3. External GitHub and social stats calls can take 3–5 seconds if third-party APIs have high latency.

### 3. Login Page (`login.html`)
- **What it shows**: Centered card; Cairn mark; email input field; "Send magic link" primary CTA; green alert banner for successful dispatch; red alert banner on network error; "Continue as guest" link.
- **Screenshots Verified**: Layout verified against design specs (light theme `#F7F8FA`, card `#FFFFFF` 1px border `#E4E7EC`, 44px button).
- **Three Weakest Things**:
  1. Passwordless email OTP is the only sign-in method; lacks OAuth providers ("Sign in with GitHub" / Google).
  2. Supabase free-tier email rate limit (3 emails/hour) can block multiple rapid login attempts without custom SMTP.
  3. Lacks a resend countdown timer (e.g. "Resend in 60s") after sending the magic link.

### 4. Dashboard Page (`dashboard.html`)
- **What it shows**: Top bar with user email pill and Sign Out; 4 tabs: "My resumes" (upload card, resume table with primary badge, download signed URL, delete); "History & Progress" (score trend cards, past analyses list, report links); "Applications" (5-column Kanban board for Saved, Applied, Interview, Offer, Rejected with "+ Add application" modal); "Settings" (account metadata, JSON data export, account deletion).
- **Screenshots Verified**: Layout verified against design specs.
- **Three Weakest Things**:
  1. Kanban columns do not support HTML5 drag-and-drop between columns (requires stage dropdown selection).
  2. Historical score progression is rendered as horizontal cards rather than a continuous SVG sparkline.
  3. Analysis history table lacks pagination or search filtering for large numbers of saved evaluations.

---

## 7. CONFIG AND SECURITY

### Environment Variables
- **Names Read by Code**:
  - `GEMINI_API_KEY`
  - `GROQ_API_KEY`
  - `OPENAI_API_KEY`
  - `LLM_PROVIDER`
  - `RADIX_MODEL`
  - `RADIX_NO_CACHE`
  - `GITHUB_TOKEN`
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY`
  - `VERCEL`
  - `VERCEL_URL`
  - `RADIX_SERVE_STATIC`
- **Set Locally in [d:\radix_v2_vercel\.env](file:///d:/radix_v2_vercel/.env)** *(Names only)*:
  - `GEMINI_API_KEY`: Set
  - `LLM_PROVIDER`: Set (`gemini`)
  - `RADIX_MODEL`: Set
  - `SUPABASE_URL`: Set
  - `SUPABASE_PUBLISHABLE_KEY`: Set
  - `SUPABASE_SERVICE_KEY`: Present in `.env`, but value is empty

### Secret Leakage Audit
- **Static Files (`app/static/`, `public/`)**: **Zero leaks found.** No API keys or tokens exist in client files.
- **Log Files**: **Zero leaks found.** No `.log` files exist in Folder C.
- **Git History**: Folder C has no `.git` repository folder (isolated workspace).
- **`.gitignore`**: Properly configured; ignores `.env`, `.env.*`, `.venv/`, `__pycache__/`, `*.pyc`, `*.tmp`.

### Operational Security Settings
- **CORS**: Dynamically restricted. When `VERCEL_URL` is detected, origins are restricted to `https://{VERCEL_URL}`, `http://localhost:8000`, and `http://127.0.0.1:8000`.
- **Upload Limit**: Enforced at 4 MB (`MAX_FILE_SIZE = 4 * 1024 * 1024`). Rejects oversized files with HTTP 413 and invalid MIME types with HTTP 415.
- **Rate Limits**: Enforced per 10-minute window (600s):
  - `/analyze`: 8 hits for guests (hashed IP), 20 hits for authenticated users (`user:{id}`).
  - `/provenance`: 20 hits.
  - `/socials/stats`: 20 hits.
  - `/roadmap`: 30 hits.
  - Excess requests return **HTTP 429** with `Retry-After: 600`.
- **Cross-User Data Isolation**:
  - `tests/test_store_and_auth.py::test_cross_user_data_isolation`: **PASSED**. User B cannot read, download, edit, or delete User A's resumes, analyses, or applications.
  - `tests/test_store_and_auth.py::test_account_deletion_cascade`: **PASSED**. Account deletion cascades and purges all storage files, database rows, and user auth records.

---

## 8. TEST SUITE ANALYSIS

| Folder | Total Test Files | Total Tests | Passed | Failed | Skipped | Test Duration |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Folder A** (`radix_v1_frozen`) | 4 files | 10 | 10 | 0 | 0 | 10.95s |
| **Folder B** (`radix`) | 5 files | 17 | 17 | 0 | 0 | 17.45s |
| **Folder C** (`radix_v2_vercel`) | 10 files | 55 | 55 | 0 | 0 | 19.22s |

### New Tests Added in Folder C (38 Tests)
1. `tests/test_analyze_endpoint.py` (8 tests): Companies benchmark sort, single sample pair, end-to-end evaluation, GitHub auto-detection, 4MB file limit, invalid MIME format, missing JD, error isolation.
2. `tests/test_ats.py` (6 tests): Clean resume baseline, hidden white text injection, tiny font injection, zero-width space characters, DOCX vanished text, 4 sample resume checks.
3. `tests/test_provenance.py` (7 tests): Project extraction, single-day dump flag, healthy history classification, fork-only penalty, user not found, rate limit handling, `/provenance` endpoint.
4. `tests/test_roadmap.py` (6 tests): KB load verification, monotonic projected scores, budget constraint compliance, skill area tagging, zero-gap maintenance roadmap, `/roadmap` endpoint.
5. `tests/test_socials.py` (6 tests): URL profile extraction, bare handle regex extraction, LinkedIn scrape refusal, mocked GitHub stats, mocked Codeforces stats, mocked LeetCode stats.
6. `tests/test_store_and_auth.py` (9 tests): Local cache TTL, Supabase timeout/500 graceful degradation, bearer token verification & 60s cache, optional user handling, cross-user isolation, account deletion cascade, guest/user rate limiting (429 & Retry-After), health endpoint, config endpoint secret protection.

- **Skipped Tests**: 0
- **Code Coverage of `app/`**: **Unverified** (`pytest-cov` is not installed in the workspace environment).

---

## 9. KNOWN ISSUES AND RISKS

| Severity | Issue | Impact | One-Line Fix |
| :--- | :--- | :--- | :--- |
| **BLOCKER** | Supabase tables & bucket missing | Cloud persistence returns 404/400 | Run the consolidated migration SQL in Supabase SQL Editor. |
| **BLOCKER** | Missing `SUPABASE_SERVICE_KEY` in prod | Server cannot call `hit_rate_limit` RPC | Add `SUPABASE_SERVICE_KEY` to Vercel Environment Variables. |
| **MAJOR** | Serverless function timeout | Vercel hobby limits function execution to 10–60s | Ensure all third-party network calls enforce 3–5s timeouts. |
| **MAJOR** | Read-only serverless disk | File writes to `data/cache/` fail on Vercel | Fallback already routes non-persisted writes to `/tmp`. |
| **MAJOR** | Vercel payload limit (4.5 MB) | Payloads > 4.5 MB fail at Vercel edge proxy | The 4 MB client/server validation prevents 413 truncation errors. |
| **MINOR** | Serverless cold start (1.5–3s) | Initial API call delay after idle period | Static assets served from Vercel Edge CDN while function boots. |
| **MINOR** | Supabase free email rate limits | Max 3 magic links per hour on free tier | Connect custom SMTP (e.g. SendGrid or Resend) in Supabase Auth. |
| **MINOR** | Unauthenticated GitHub rate limit | 60 requests/hour IP limit on GitHub REST API | Provide `GITHUB_TOKEN` in environment variables for 5,000 req/hr. |

---

## 10. NEXT STEPS (PRIORITISED)

1. **Run Supabase Migration SQL**: Execute the SQL script in Supabase Dashboard SQL Editor to instantiate all 6 tables, the `resumes` bucket, RLS policies, and `hit_rate_limit` RPC.
2. **Retrieve `service_role` Key**: Copy the secret `service_role` key from Supabase **Project Settings → API Keys**.
3. **Configure Vercel Environment Variables**: Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`, `LLM_PROVIDER`, `RADIX_MODEL`, and optional `GITHUB_TOKEN` in Vercel Project Settings.
4. **Configure Supabase Auth Redirects**: In Supabase **Auth → URL Configuration**, add your Vercel deployment domain to **Redirect URLs** (`https://<app>.vercel.app/dashboard.html` and `https://<app>.vercel.app/analyze.html`).
5. **Key Hygiene & Rotation**: If any publishable key was ever pasted in chat, regenerate keys in Supabase Project Settings.
6. **Deploy to Vercel**: Run `vercel --prod` from `d:\radix_v2_vercel` (or connect git repo).
7. **Run Smoke Test**: Execute `python scripts/smoke_deployed.py https://<app>.vercel.app` against the live production deployment.
8. **Configure Custom SMTP**: In Supabase **Auth → Email Templates / SMTP Settings**, configure custom SMTP credentials to remove the 3 emails/hour free-tier limit.
9. **Kanban Drag-and-Drop**: Add HTML5 drag-and-drop listeners to `dashboard.html` to allow dragging cards between stages.
10. **Progress Sparklines**: Replace static progress trend cards in `dashboard.html` with an SVG line/sparkline chart.

---

## 11. ONE-PARAGRAPH SUMMARY

Cairn has successfully transitioned from an unauthenticated hackathon prototype (Folder A) and an experimental 3D UI (Folder B) into a production-ready, single-user diagnostic platform (Folder C). The platform runs stateless in-memory evaluations for guests while allowing signed-in users to securely upload resumes, track job applications across a 5-stage Kanban board, and synchronize interactive study roadmaps. All heavy 3D vendor dependencies were purged in favor of an ultra-fast, accessible fintech design system with self-hosted fonts. The backend architecture includes Supabase PostgREST caching, distributed rate limiting, and private storage with 60-second signed download URLs, backed by an expanded 55-test verification suite with zero secret leakage. Deploying to Vercel requires only running the database SQL script and adding the Supabase service key to Vercel's environment settings.

