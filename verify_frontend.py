import os
import time
import threading
import json
import uvicorn
from playwright.sync_api import sync_playwright
from app.api import app

def run_verification():
    os.makedirs("screenshots", exist_ok=True)

    # 1. Start backend server
    print("Starting background uvicorn server on port 8099...")
    server = uvicorn.Server(uvicorn.Config(app=app, host="127.0.0.1", port=8099, log_level="warning"))
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()
    time.sleep(1.5)

    base_url = "http://127.0.0.1:8099"
    console_errors = []

    with sync_playwright() as p:
        # Launch headed chromium
        print("Launching headed Chromium...")
        browser = p.chromium.launch(headless=False, slow_mo=50)

        # Helper to attach error listeners
        def setup_listeners(page):
            def on_console(msg):
                clean_text = msg.text.encode("ascii", "replace").decode("ascii")
                if msg.type == "error":
                    print(f"[CONSOLE ERROR] {clean_text}")
                    console_errors.append(clean_text)
                else:
                    print(f"[{msg.type.upper()}] {clean_text}")
            def on_page_error(exc):
                clean_exc = str(exc).encode("ascii", "replace").decode("ascii")
                print(f"[PAGE ERROR] {clean_exc}")
                console_errors.append(clean_exc)
            page.on("console", on_console)
            page.on("pageerror", on_page_error)

        # ------------------------------------------------------------------
        # 1. LANDING PAGE (Desktop 1440x900 & Mobile 390x844)
        # ------------------------------------------------------------------
        print("\n=== Testing Landing Page (Desktop) ===")
        context_desktop = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context_desktop.new_page()
        setup_listeners(page)

        page.goto(f"{base_url}/index.html", wait_until="networkidle")
        page.screenshot(path="screenshots/landing_desktop.png", full_page=True)
        print("Saved screenshots/landing_desktop.png")

        print("\n=== Testing Landing Page (Mobile) ===")
        context_mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        page_mobile = context_mobile.new_page()
        setup_listeners(page_mobile)

        page_mobile.goto(f"{base_url}/index.html", wait_until="networkidle")
        page_mobile.screenshot(path="screenshots/landing_mobile.png", full_page=True)
        print("Saved screenshots/landing_mobile.png")
        context_mobile.close()

        # ------------------------------------------------------------------
        # 2. ANALYSIS PAGE - EMPTY & ERROR STATES
        # ------------------------------------------------------------------
        print("\n=== Testing Analysis Page - Empty & Error State (Desktop) ===")
        page = context_desktop.new_page()
        setup_listeners(page)
        page.goto(f"{base_url}/analyze.html", wait_until="networkidle")
        page.wait_for_selector("#company-select option", state="attached")
        page.screenshot(path="screenshots/analyze_empty_desktop.png", full_page=True)
        print("Saved screenshots/analyze_empty_desktop.png")

        # Click analyze with empty form to trigger validation errors
        page.click("#btn-analyze")
        page.wait_for_selector("#resume-error.visible")
        page.screenshot(path="screenshots/analyze_error_desktop.png", full_page=True)
        print("Saved screenshots/analyze_error_desktop.png")

        # Mobile error state
        context_mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        page_mobile = context_mobile.new_page()
        setup_listeners(page_mobile)
        page_mobile.goto(f"{base_url}/analyze.html", wait_until="networkidle")
        page_mobile.wait_for_selector("#company-select option", state="attached")
        page_mobile.screenshot(path="screenshots/analyze_empty_mobile.png", full_page=True)
        print("Saved screenshots/analyze_empty_mobile.png")

        page_mobile.click("#btn-analyze")
        page_mobile.wait_for_selector("#resume-error.visible")
        page_mobile.screenshot(path="screenshots/analyze_error_mobile.png", full_page=True)
        print("Saved screenshots/analyze_error_mobile.png")
        context_mobile.close()

        # ------------------------------------------------------------------
        # 3. SAMPLE FLOW & MID-ANALYSIS
        # ------------------------------------------------------------------
        print("\n=== Testing Sample Loading ===")
        page.click("#btn-try-sample")
        # Wait for file pills to appear
        page.wait_for_selector("#resume-status-text .file-pill", timeout=10000)
        page.screenshot(path="screenshots/analyze_sample_loaded_desktop.png", full_page=True)
        print("Saved screenshots/analyze_sample_loaded_desktop.png")

        print("\n=== Triggering Analysis & Capturing Mid-Progress ===")
        page.click("#btn-analyze")
        # Wait for progress card to appear
        page.wait_for_selector("#progress-card", state="visible", timeout=5000)
        time.sleep(0.4)
        page.screenshot(path="screenshots/analyze_mid_progress_desktop.png", full_page=True)
        print("Saved screenshots/analyze_mid_progress_desktop.png")

        # ------------------------------------------------------------------
        # 4. FINISHED RESULTS & TABS (Desktop)
        # ------------------------------------------------------------------
        print("\n=== Waiting for Analysis Results ===")
        # Wait until results wrapper is visible
        page.wait_for_selector("#results-wrapper", state="visible", timeout=30000)
        # Wait for lazy items (roadmap weeks and github repos)
        page.wait_for_selector("#roadmap-weeks-list .week-card", state="attached", timeout=30000)
        time.sleep(1.0) # allow animations/render to settle

        print("\n=== Capturing Finished Results on All Tabs (Desktop) ===")
        # Tab 1: Overview
        page.screenshot(path="screenshots/analyze_tab_overview_desktop.png", full_page=True)
        print("Saved screenshots/analyze_tab_overview_desktop.png")

        # Tab 2: Skills
        page.click("button.tab-btn[data-tab='skills']")
        time.sleep(0.3)
        page.screenshot(path="screenshots/analyze_tab_skills_desktop.png", full_page=True)
        print("Saved screenshots/analyze_tab_skills_desktop.png")

        # Tab 3: ATS Check
        page.click("button.tab-btn[data-tab='ats']")
        time.sleep(0.3)
        page.screenshot(path="screenshots/analyze_tab_ats_desktop.png", full_page=True)
        print("Saved screenshots/analyze_tab_ats_desktop.png")

        # Tab 4: GitHub Proof
        page.click("button.tab-btn[data-tab='github']")
        page.wait_for_function("document.getElementById('gh-score-level-chip') && document.getElementById('gh-score-level-chip').textContent !== 'Checking'", timeout=30000)
        time.sleep(0.5)
        page.screenshot(path="screenshots/analyze_tab_github_desktop.png", full_page=True)
        print("Saved screenshots/analyze_tab_github_desktop.png")

        # Tab 5: Profiles
        page.click("button.tab-btn[data-tab='profiles']")
        time.sleep(0.3)
        page.screenshot(path="screenshots/analyze_tab_profiles_desktop.png", full_page=True)
        print("Saved screenshots/analyze_tab_profiles_desktop.png")

        # Tab 6: Roadmap
        page.click("button.tab-btn[data-tab='roadmap']")
        time.sleep(0.3)
        page.screenshot(path="screenshots/analyze_tab_roadmap_desktop.png", full_page=True)
        print("Saved screenshots/analyze_tab_roadmap_desktop.png")

        # Test Roadmap interaction: check first task checkbox
        first_checkbox = page.locator("#roadmap-weeks-list input[type='checkbox']").first
        first_checkbox.check()
        time.sleep(0.2)
        assert first_checkbox.is_checked(), "Checkbox should be checked"
        print("Verified Roadmap checkbox interactive state")

        # Test Collapsed summary & Edit inputs
        page.click("#btn-edit-inputs")
        time.sleep(0.3)
        assert page.is_visible("#inputs-panel"), "Inputs panel should be visible after clicking edit"
        page.screenshot(path="screenshots/analyze_edit_reopened_desktop.png", full_page=True)
        print("Saved screenshots/analyze_edit_reopened_desktop.png")

        # ------------------------------------------------------------------
        # 5. FINISHED RESULTS ON MOBILE (390x844)
        # ------------------------------------------------------------------
        print("\n=== Capturing Finished Results on Mobile (390x844) ===")
        context_mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        page_m = context_mobile.new_page()
        setup_listeners(page_m)

        # Open analyze with sample query param
        page_m.goto(f"{base_url}/analyze.html?sample=true", wait_until="networkidle")
        page_m.wait_for_selector("#resume-status-text .file-pill", timeout=10000)
        page_m.click("#btn-analyze")
        page_m.wait_for_selector("#results-wrapper", state="visible", timeout=30000)
        page_m.wait_for_selector("#roadmap-weeks-list .week-card", state="attached", timeout=30000)
        time.sleep(1.0)

        # Tab 1: Overview
        page_m.screenshot(path="screenshots/analyze_tab_overview_mobile.png", full_page=True)
        print("Saved screenshots/analyze_tab_overview_mobile.png")

        # Tab 2: Skills
        page_m.click("button.tab-btn[data-tab='skills']")
        time.sleep(0.3)
        page_m.screenshot(path="screenshots/analyze_tab_skills_mobile.png", full_page=True)
        print("Saved screenshots/analyze_tab_skills_mobile.png")

        # Tab 3: ATS Check
        page_m.click("button.tab-btn[data-tab='ats']")
        time.sleep(0.3)
        page_m.screenshot(path="screenshots/analyze_tab_ats_mobile.png", full_page=True)
        print("Saved screenshots/analyze_tab_ats_mobile.png")

        # Tab 4: GitHub Proof
        page_m.click("button.tab-btn[data-tab='github']")
        page_m.wait_for_function("document.getElementById('gh-score-level-chip') && document.getElementById('gh-score-level-chip').textContent !== 'Checking'", timeout=30000)
        time.sleep(0.5)
        page_m.screenshot(path="screenshots/analyze_tab_github_mobile.png", full_page=True)
        print("Saved screenshots/analyze_tab_github_mobile.png")

        # Tab 5: Profiles
        page_m.click("button.tab-btn[data-tab='profiles']")
        time.sleep(0.3)
        page_m.screenshot(path="screenshots/analyze_tab_profiles_mobile.png", full_page=True)
        print("Saved screenshots/analyze_tab_profiles_mobile.png")

        # Tab 6: Roadmap
        page_m.click("button.tab-btn[data-tab='roadmap']")
        time.sleep(0.3)
        page_m.screenshot(path="screenshots/analyze_tab_roadmap_mobile.png", full_page=True)
        print("Saved screenshots/analyze_tab_roadmap_mobile.png")

        context_mobile.close()
        context_desktop.close()
        browser.close()

    server.should_exit = True
    print("\n=== Console Errors Report ===")
    print(f"Total console errors encountered: {len(console_errors)}")
    for err in console_errors:
        print(f"  - {err}")

    assert len(console_errors) == 0, f"Found {len(console_errors)} console errors!"
    print("\n[SUCCESS] Verification run completed successfully with 0 console errors!")

if __name__ == "__main__":
    run_verification()
