# Cairn: Know Your Footing.

> **Readiness analytics & competence waypoint engine for high-conviction engineering careers.**  
> Built for the RADIX Talent Match Hackathon · 28 October 2026.

Cairn evaluates job descriptions and engineering resumes across **12 normalized competency areas** (`COD`, `DSA`, `APTI`, `COMM`, `OOD`, `AI`, `SQL`, `SYSD`, `CLOUD`, `SWE`, `NETW`, `OS`), calibrating candidate footing against verified benchmark hiring standards (Google, Microsoft, Oracle FSS) with quadratic readiness curves and precision gap diagnostics.

---

## 🚀 Windows Quickstart

Run these exact commands in PowerShell or Command Prompt from the project root:

```powershell
# 1. Create a Python virtual environment
python -m venv .venv

# 2. Activate the virtual environment
.venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the server (clears port 8000 automatically)
run.bat
```

Once running, open your browser at **[http://localhost:8000](http://localhost:8000)**.
- Landing page: `http://localhost:8000/`
- Tool: `http://localhost:8000/app.html`

---

## 🛠️ Offline-Safe Demo Mode

Cairn is **100% demo-safe offline**. All 6 benchmark JDs and 4 candidate resumes are pre-extracted by Gemini 3.5 Flash Lite and securely cached in `data/cache/`.
- No internet connection or API key is required to run the full live demo with sample files.
- If offline and a user uploads an uncached file, the UI displays a clean `"Needs LLM access"` notice instead of failing.
- Optional: to enable live real-time LLM extraction for arbitrary new files, set `GEMINI_API_KEY` in `.env`.

---

## 🧪 Testing & Verification

Run the full automated test suite:
```powershell
.venv\Scripts\pytest -v
```

Run the benchmark evaluation matrix CLI:
```powershell
.venv\Scripts\python demo.py
```

---

## 🔧 Troubleshooting

1. **Port 8000 busy:** Running `run.bat` automatically terminates any lingering process on port 8000 before launching Uvicorn.
2. **Manual port release:** In PowerShell, run `Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force`.
3. **Missing GEMINI_API_KEY:** The app runs in offline demo mode using verified cached extractions; no key is required.
4. **Adding a key:** Place `GEMINI_API_KEY=your_key` in `.env` to enable live LLM extraction on newly uploaded custom files.
5. **Playwright not needed:** All UI dependencies, Google Fonts, React 18, and GSAP run self-hosted in `app/static/vendor/` with no headless browser required.
6. **Virtual environment path:** If `python` refers to global Python, ensure `.venv\Scripts\activate` was executed first.
