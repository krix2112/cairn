# Cairn Demo Script & Live Presentation Playbook

**Duration:** 30 Minutes  
**Audience:** Hackathon Judges, Hiring Leaders, Engineering Mentors  
**Tagline:** *"Know your footing."*

---

## ⏱️ Timeline & Agenda Overview

| Time Window | Segment | Goal |
|---|---|---|
| **00:00 – 03:00 (3 min)** | The Problem | The broken hiring funnel & why arbitrary resumes fail |
| **03:00 – 08:00 (5 min)** | Architecture & Design | 12 Skill Areas, Deterministic Curves, Grounded Data |
| **08:00 – 23:00 (15 min)** | Live Walkthrough | Interactive demonstration of the end-to-end user journey |
| **23:00 – 26:00 (3 min)** | One Challenge We Faced | Balancing LLM speed/quotas with deterministic precision |
| **26:00 – 30:00 (4 min)** | Buffer & Q&A | Answering judge questions & review of data contracts |

---

## 🎤 Detailed Walkthrough & Script

### 1. The Problem (00:00 – 03:00)
- *"Every day, engineering graduates and hiring managers play an asymmetric guessing game. Resumes are stuffed with buzzwords, while job descriptions list impossible wishlists. Candidates don't know where they actually stand against real company standards, and hiring managers are overwhelmed by uncalibrated claims."*
- *"We built **Cairn** to replace that guesswork. Like alpine cairns that mark safe trails across dangerous mountain ridges, Cairn gives engineers visible, grounded footing: 12 stones, calibrated against 113 real company hiring bars, with transparent, deterministic scoring."*

### 2. Architecture & Design Decisions (03:00 – 08:00)
- Open `docs/ARCHITECTURE.md` on slide or screen:
  1. **Normalized Data Contract:** 12 standardized skill categories (`COD`, `DSA`, `APTI`, `COMM`, `OOD`, `AI`, `SQL`, `SYSD`, `CLOUD`, `SWE`, `NETW`, `OS`).
  2. **FastAPI & Multi-Tier Extraction:** Real Gemini structured JSON extraction + SHA-256 caching + instant regex fallback.
  3. **Deterministic Mathematical Scoring:** Explain the quadratic readiness formula $\frac{\sum \min(C_i, R_i) \cdot R_i}{\sum R_i^2}$. Emphasize that surplus in easy skills never masks deficits in critical core requirements.
  4. **Empirical Grounding:** Validated against 113 corporate hiring benchmarks (Google, Microsoft, Oracle FSS).

---

### 3. Live Walkthrough & Exact Clicks (08:00 – 23:00)

#### Step 1: Open the Landing Page
- Navigate to `http://localhost:8000/`.
- Point out the atmospheric aesthetic: dusk canvas, mountain ridges, and the real-time Cairn stone simulation.
- Click the primary action button: **"Open Cairn"** (routes directly to `app.html#/job`).

#### Step 2: Step 1 — Job Description Benchmark (`#/job`)
- Under **Verified Samples**, select **"Google LLC — Software Engineer (SWE)"** (`Bengaluru, Hybrid · ₹32,00,000 CTC`).
- Show the extracted benchmark requirements: 11 distinct competencies extracted with quotes and confidence tags.
- Click **"Continue with Selected Job"** (routes to `#/resume`).

#### Step 3: Step 2 — Candidate Resume Parsing (`#/resume`)
- Under **Sample Candidates**, select **"Rohan Verma"** (*Strong all-rounder — competitive fit across nearly every role in this pack*).
- Highlight the real-time extraction: 11 verified skills mapped to categories, along with education (CGPA 9.1), hackathons, and startup internships.
- Click **"Proceed to Profile Builder"** (routes to `#/profile`).

#### Step 4: Step 3 — Profile Builder & Persistence (`#/profile`)
- Show prefilled form fields: Name, Email (`rohan.verma@demo.local`), Education, and verified skill badges with confidence pills.
- Show that the candidate can adjust, add, or delete skills before locking.
- Click **"Save Profile & Run Readiness Check"** (saves to `profiles/rohan.verma@demo.local.json` and routes to `#/check`).

#### Step 5: Step 4 — Talent Check & The Cairn Visualizer (`#/check`)
- **The Hero Visual:** Watch the 12-stone Cairn animate and settle live on the mountain ridge.
- Note the score: **62% Readiness for Google**.
- **The Stone Breakdown:**
  - Lichen green stones: Competencies that meet or exceed Google's bar (Level 8 Coding, Level 9 DSA, Level 9 Systems Design).
  - Ember/coral stones: Deficit areas (Networking gap, Cloud gap).
- **Interactive "What-If" Sliders:**
  - Adjust the **Networking** slider from Level 0 up to Level 9.
  - Watch the Cairn stones restack in real time and see the Readiness Score jump from 62% to 75%!
- **Next Stones Priority:** Show the prioritized recommendations list telling Rohan exactly which two skills yield the highest immediate hiring leverage.

#### Step 6: Step 4 Extension — Cohort Comparison Drawer
- Click **"Compare Candidates"** at the top right of the Talent Check view.
- Open the cross-candidate matrix comparing Ananya, Karthik, Priya, and Rohan across Google, Oracle FSS, and Microsoft.
- Demonstrate that scores differ significantly based on true role alignment:
  - Priya is highest on Oracle FSS (41%).
  - Ananya is competitive on SWE (64%).
  - Rohan leads across all generalist tiers (75% on Oracle, 64% on Microsoft, 62% on Google).
- Click **"Proceed to Role Match"** (routes to `#/match`).

#### Step 7: Step 5 — Deep Skill Match & Missing Gaps (`#/match`)
- Show the **71% Match Score** against Google SWE.
- View **Matched Skills** (C++, DSA, System Design, OOD, OS, Git, Testing).
- View **Missing Gaps with Business Rationale:** Highlights `Networking Fundamentals` and `Distributed Systems RPC` with the exact excerpt from Google's hiring manager stating why it is needed.

#### Step 8: Waypoint Scene — "The Forge" (`#/skill/SWE`)
- Click on any skill chip or navigate to `#/skill/SWE`.
- The live interactive SVG/Canvas Waypoint scene opens: a layered dark industrial workshop with glowing ember sparks, blueprint grids, and candidate vs company required level metrics.
- Demonstrate keyboard accessibility and the "Skip animation" toggle.

#### Step 9: Report & Dossier Summary (`#/report`)
- Click **"Review Complete Dossier"**.
- View the unified candidate footing summary ready for hiring committee presentation.

---

### 4. One Challenge We Faced (23:00 – 26:00)
- *"During development, we faced a major challenge: balancing the creative power of cutting-edge LLMs with strict operational reliability and determinism. Initially, free-tier API quotas and transient 503 spike errors from LLM providers caused intermittent delays. Furthermore, relying on an LLM to generate numerical readiness scores resulted in floating-point drift."*
- *"We solved this by establishing a strict architectural separation of concerns:*
  1. *The LLM is used **strictly for semantic parsing and structured JSON extraction**.*
  2. *All extracted payloads are cryptographically hashed via SHA-256 into local disk cache.*
  3. *All scoring is handled by **pure, deterministic quadratic mathematical formulas**.*
  4. *The application operates 100% offline with zero latency during live presentations, yet retains full online LLM capability for custom uploads."*

---

### 5. Buffer & Judge Q&A (26:00 – 30:00)
- Open floor for questions (refer to `docs/QA_PREP.md`).

---

## 🛡️ Emergency Contingency & Fallback Plan

| Failure Scenario | Immediate Action |
|---|---|
| **Internet Disconnection / No Wi-Fi** | Zero action needed! Cairn runs **100% offline**. All 6 JDs and 4 resumes are stored in `data/cache/` and all libraries (React 18, GSAP, Google Fonts) are self-hosted in `app/static/vendor/`. |
| **Port 8000 Conflict** | Execute `run.bat` — it automatically detects and force-kills any lingering PID listening on port 8000 before launching. |
| **Laptop / Machine Failure** | 1. Use the pre-packaged `radix_submission.zip` on any judge machine (just unzip, run `pip install -r requirements.txt`, and `run.bat`).<br>2. Complete high-resolution UI walkthrough screenshots are preserved in `C:\Users\studi\radix_screenshots_backup`. |
