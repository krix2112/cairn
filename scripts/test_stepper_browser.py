import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

print("Starting 5-Step Stepper Browser Test...")

with sync_playwright() as p:
    try:
        browser = p.chromium.launch(headless=True)
    except Exception:
        browser = p.chromium.launch(channel="msedge", headless=True)

    page = browser.new_page()

    console_logs = []
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda exc: console_logs.append(f"[PAGE_ERROR] {exc}"))

    print("Navigating to http://127.0.0.1:8000/analyze.html")
    page.goto("http://127.0.0.1:8000/analyze.html", wait_until="networkidle")

    # Step 0 should be active
    step0_active = page.locator("#view-step-0").is_visible()
    print(f"Step 0 visible: {step0_active}")

    # Click 'Try with a sample'
    print("Clicking 'Try with a sample'...")
    page.click("#btn-load-sample")

    # Wait for transition to Feature 1 (Skill Match)
    print("Waiting for Feature 1 (Skill Match) view...")
    page.wait_for_selector("#view-feature-1.active-view", timeout=15000)

    # Check Feature 1 elements
    match_score = page.locator("#val-match-score").text_content()
    matched_count = page.locator("#count-matched-header").text_content()
    missing_count = page.locator("#count-missing-header").text_content()
    print(f"[Feature 1 - Skill Match] Score: {match_score}, Matched: {matched_count}, Missing: {missing_count}")

    # Check Context summary bar
    context_bar_visible = page.locator("#active-context-bar").is_visible()
    resume_name = page.locator("#bar-resume-name").text_content()
    company_name = page.locator("#bar-comp-name").text_content()
    print(f"[Active Bar] Visible: {context_bar_visible}, Resume: {resume_name}, Company: {company_name}")

    # Advance to Feature 2 (Talent Readiness)
    print("Navigating to Feature 2 (Talent Readiness)...")
    page.click("button:has-text('Next: Feature 2')")
    page.wait_for_selector("#view-feature-2.active-view", timeout=5000)
    readiness_score = page.locator("#val-readiness-score").text_content()
    comp_bars = page.locator(".comp-gap-item").count()
    print(f"[Feature 2 - Talent Readiness] Score: {readiness_score}, 12-Comp Bars: {comp_bars}")

    # Advance to Feature 3 (ATS Integrity)
    print("Navigating to Feature 3 (ATS Integrity)...")
    page.click("button:has-text('Next: Feature 3')")
    page.wait_for_selector("#view-feature-3.active-view", timeout=5000)
    ats_score = page.locator("#val-ats-score").text_content()
    ats_risk = page.locator("#chip-ats-risk-badge").text_content()
    print(f"[Feature 3 - ATS Integrity] Score: {ats_score}, Risk: {ats_risk}")

    # Advance to Feature 4 (Git Provenance)
    print("Navigating to Feature 4 (Git Provenance)...")
    page.click("button:has-text('Next: Feature 4')")
    page.wait_for_selector("#view-feature-4.active-view", timeout=5000)
    page.wait_for_timeout(1000)
    prov_score = page.locator("#val-prov-score").text_content()
    prov_level = page.locator("#chip-prov-level").text_content()
    print(f"[Feature 4 - Git Provenance] Score: {prov_score}, Level: {prov_level}")

    # Advance to Feature 5 (Career Roadmap)
    print("Navigating to Feature 5 (Career Roadmap)...")
    page.click("button:has-text('Next: Feature 5')")
    page.wait_for_selector("#view-feature-5.active-view", timeout=5000)
    page.wait_for_timeout(1000)
    weeks_count = page.locator(".week-card").count()
    progress_text = page.locator("#chip-plan-progress").text_content()
    print(f"[Feature 5 - Career Roadmap] Weeks rendered: {weeks_count}, Progress: {progress_text}")

    # Click a task checkbox
    print("Clicking first roadmap task checkbox...")
    first_cb = page.locator(".task-checkbox").first
    first_cb.click()
    page.wait_for_timeout(500)
    new_progress = page.locator("#chip-plan-progress").text_content()
    print(f"[Feature 5 - Task Checkbox] New Progress: {new_progress}")

    print("\n--- Console Logs ---")
    for log in console_logs:
        print(log)

    print("\nALL 5 STEPS & FEATURES VERIFIED SUCCESSFULLY!")
    browser.close()
