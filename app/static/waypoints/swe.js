/**
 * WAYPOINT 07: SWE — "The Switchyard"
 * Tint: Signal Yellow (#FFD84A) on Charcoal (#101113) with Rail White lines
 * Metro-style railway switchyard for software engineering workflows.
 * Main branch spine, branching PR switches, test gate signal gantry (Unit, Integration, Lint, Security),
 * commit train physics, break-and-fix test simulation, technical debt accumulator & refactoring scrubber,
 * testing pyramid diagram, and code review rigor callouts.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let isDestroyed = false;
  let isPaused = false;
  let animId = null;
  let isSwitchThrown = false;
  let brokenGateIdx = -1; // -1 = all healthy
  let techDebt = 22; // 0 to 100%
  let fixTimer = null;

  const candLvl = Math.min(10, Math.max(0, ctx.level ?? 6));
  const reqLvl = Math.min(10, Math.max(0, ctx.required ?? 7));

  // 4 Test Gates
  const GATES = [
    { name: "Unit Tests", desc: "Fast hermetic boundary checks (95% coverage)", unlock: 2 },
    { name: "Integration", desc: "Contract testing with mock services", unlock: 4 },
    { name: "Static Lint", desc: "AST analysis, type checks, cognitive complexity", unlock: 6 },
    { name: "Security Audit", desc: "SAST scanning & CVE dependency audit", unlock: 8 }
  ];

  el.style.backgroundColor = "#101113";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.style.color = "#E5E7EB";
  el.style.fontFamily = "var(--font-mono, monospace)";

  el.innerHTML = `
    <div class="switchyard-stage" style="position: absolute; inset: 0; display: flex; flex-direction: column; padding: 22px 26px 16px; box-sizing: border-box; overflow-y: auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; position: relative; z-index: 2; flex-wrap: wrap; gap: 8px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #FFD84A; box-shadow: 0 0 10px #FFD84A;"></span>
            <span style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #FFD84A; font-weight: 600;">The Switchyard · Engineering Discipline</span>
          </div>
          <p style="margin: 4px 0 0; font-size: 13px; color: #9CA3AF;">
            Continuous integration metro tracks. Signal gantry unlocked by candidate level (${candLvl}/10). Requirement: ${reqLvl}/10.
          </p>
        </div>

        <!-- Action Controls -->
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <button id="btn-swe-commit" style="font-family: inherit; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: 1px solid #FFD84A; background: rgba(255,216,74,0.15); color: #FFD84A; font-weight: 700; cursor: pointer;">
            + Commit Train
          </button>
          <button id="btn-swe-pr" style="font-family: inherit; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: 1px solid rgba(229,231,235,0.3); background: rgba(255,255,255,0.05); color: #E5E7EB; cursor: pointer;">
            Open PR
          </button>
          <button id="btn-swe-break" style="font-family: inherit; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: 1px solid #E5646B; background: rgba(229,100,107,0.12); color: #E5646B; cursor: pointer;">
            Break a Test
          </button>
          <button id="btn-swe-merge" style="font-family: inherit; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: 1px solid #9BC53D; background: rgba(155,197,61,0.15); color: #9BC53D; font-weight: 700; cursor: pointer;">
            Merge to Main
          </button>
          <button id="btn-swe-refactor" style="font-family: inherit; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: 1px solid #5BC8E8; background: rgba(91,200,232,0.15); color: #5BC8E8; cursor: pointer;">
            Refactor (Scrub Debt)
          </button>
        </div>
      </div>

      <!-- Metro Switchyard Track Viewport -->
      <div style="position: relative; flex: 1; min-height: 250px; background: #131518; border: 1px solid rgba(255,216,74,0.15); border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
        <svg id="switchyard-svg" viewBox="0 0 920 380" style="width: 100%; height: 100%; display: block;" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="track-rust-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#703622" />
              <stop offset="100%" stop-color="#A84C2F" />
            </linearGradient>
          </defs>

          <!-- 1. Main Line (Trunk / main branch) -->
          <g id="main-track">
            <!-- Bedding -->
            <path d="M 40 120 L 880 120" stroke="rgba(255,255,255,0.06)" stroke-width="14" />
            <!-- Rails -->
            <path d="M 40 115 L 880 115" stroke="#E5E7EB" stroke-width="2" />
            <path d="M 40 125 L 880 125" stroke="#E5E7EB" stroke-width="2" />
            <!-- Ties -->
            ${[...Array(28)].map((_, i) => `<line x1="${60 + i * 30}" y1="110" x2="${60 + i * 30}" y2="130" stroke="rgba(229,231,235,0.2)" stroke-width="2" />`).join("")}
            <text x="50" y="100" font-size="11" fill="#FFD84A" font-weight="700">BRANCH: main (prod)</text>
          </g>

          <!-- 2. Feature Branch Track -->
          <g id="feature-track">
            <!-- Diverging path -->
            <path id="switch-track-path" d="M 220 120 C 300 120, 320 230, 420 230 L 700 230 C 760 230, 780 120, 840 120" fill="none" stroke="rgba(255,216,74,0.4)" stroke-width="3" stroke-dasharray="4,4" />
            <text x="430" y="215" font-size="10.5" fill="#E5E7EB" font-weight="600">FEATURE: feat/fast-telemetry</text>
          </g>

          <!-- 3. Signal Gantry with 4 Gates -->
          <g id="gantry-group" transform="translate(430, 40)">
            <rect width="360" height="42" rx="4" fill="rgba(16,17,19,0.9)" stroke="rgba(255,216,74,0.3)" stroke-width="1.2" />
            <text x="180" y="16" font-size="9" fill="#9CA3AF" text-anchor="middle" letter-spacing="0.1em">AUTOMATED VERIFICATION GANTRY</text>
            <!-- 4 Light Beacons -->
            ${GATES.map((g, idx) => {
              const isUnlocked = candLvl >= g.unlock;
              const isGhost = reqLvl >= g.unlock && !isUnlocked;
              const isBroken = brokenGateIdx === idx;
              const lightColor = isBroken ? "#E5646B" : (isUnlocked ? "#9BC53D" : (isGhost ? "#FFD84A" : "#4B5563"));
              return `
                <g transform="translate(${25 + idx * 85}, 22)">
                  <circle cx="8" cy="6" r="5" fill="${lightColor}" stroke="${isGhost ? '#FFD84A' : 'none'}" stroke-dasharray="${isGhost ? '2,2' : 'none'}" />
                  <text x="20" y="10" font-size="9" fill="${isBroken ? '#E5646B' : (isUnlocked ? '#E5E7EB' : '#6B7280')}" font-weight="600">${g.name.split(' ')[0]}</text>
                </g>
              `;
            }).join("")}
          </g>

          <!-- Release Station Depot -->
          <g transform="translate(810, 80)">
            <rect width="65" height="80" rx="4" fill="rgba(255,216,74,0.08)" stroke="#FFD84A" stroke-width="1.5" />
            <text x="32" y="32" font-size="10" fill="#FFD84A" font-weight="700" text-anchor="middle">RELEASE</text>
            <text x="32" y="52" font-size="8.5" fill="#9CA3AF" text-anchor="middle">v2.4.0</text>
            <circle cx="32" cy="66" r="4" fill="#9BC53D" />
          </g>
        </svg>

        <!-- Canvas for Moving Train Physics -->
        <canvas id="switchyard-canvas" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;"></canvas>

        <!-- Technical Debt Rust Warning Overlay -->
        <div style="position: absolute; bottom: 12px; left: 16px; background: rgba(16,17,19,0.92); border: 1px solid rgba(255,216,74,0.25); border-radius: 4px; padding: 6px 12px; font-size: 11px; display: flex; align-items: center; gap: 10px;">
          <span>Technical Debt:</span>
          <div style="width: 90px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
            <div id="tech-debt-bar" style="width: ${techDebt}%; height: 100%; background: ${techDebt > 60 ? '#E5646B' : '#FFD84A'}; transition: width 0.3s ease;"></div>
          </div>
          <span id="tech-debt-label" style="color: ${techDebt > 60 ? '#E5646B' : '#FFD84A'}; font-weight: 600;">${techDebt}%</span>
        </div>
      </div>

      <!-- Testing Pyramid & 3 Callouts Row -->
      <div style="display: grid; grid-template-columns: 240px 1fr; gap: 12px; flex-wrap: wrap;">
        <!-- Testing Pyramid Micro-Diagram -->
        <div style="padding: 10px 14px; border-radius: 4px; background: rgba(19,21,24,0.7); border: 1px solid rgba(255,216,74,0.15); text-align: center;">
          <div style="font-size: 10px; color: #FFD84A; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">Testing Pyramid (Fowler)</div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
            <div style="width: 50px; padding: 2px 0; background: rgba(229,100,107,0.3); border: 1px solid #E5646B; font-size: 8.5px; border-radius: 2px; color: #E5646B;">E2E (5%)</div>
            <div style="width: 100px; padding: 2px 0; background: rgba(255,216,74,0.2); border: 1px solid #FFD84A; font-size: 8.5px; border-radius: 2px; color: #FFD84A;">Integration (25%)</div>
            <div style="width: 160px; padding: 3px 0; background: rgba(155,197,61,0.2); border: 1px solid #9BC53D; font-size: 9px; border-radius: 2px; color: #9BC53D; font-weight: 600;">Unit Tests (70%)</div>
          </div>
        </div>

        <!-- 3 Disciplined Habits Callouts -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
          <div style="padding: 8px 10px; border-radius: 4px; background: rgba(19,21,24,0.6); border: 1px solid rgba(255,255,255,0.08); font-size: 10px;">
            <strong style="color: #FFD84A; display: block; margin-bottom: 2px;">Code Review Rigor:</strong> Inspect for invariant boundaries, thread-safety, and edge conditions, not just formatting conventions.
          </div>
          <div style="padding: 8px 10px; border-radius: 4px; background: rgba(19,21,24,0.6); border: 1px solid rgba(255,255,255,0.08); font-size: 10px;">
            <strong style="color: #9BC53D; display: block; margin-bottom: 2px;">Hermetic CI Pipeline:</strong> All dependencies vendored or digest-pinned. No flaky tests; tests never communicate across external networks.
          </div>
          <div style="padding: 8px 10px; border-radius: 4px; background: rgba(19,21,24,0.6); border: 1px solid rgba(255,255,255,0.08); font-size: 10px;">
            <strong style="color: #5BC8E8; display: block; margin-bottom: 2px;">Trunk-Based Delivery:</strong> Small commits, short-lived feature branches (&lt;24h), feature flags for unfinished code.
          </div>
        </div>
      </div>
    </div>
  `;

  // Canvas Train Animation
  const canvas = el.querySelector("#switchyard-canvas");
  const ctx2d = canvas ? canvas.getContext("2d") : null;
  let trains = [];

  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement || el;
    canvas.width = parent ? parent.clientWidth || 800 : 800;
    canvas.height = parent ? parent.clientHeight || 400 : 400;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function spawnTrain(isFeature = false, label = "feat(api)") {
    trains.push({
      x: 50,
      y: isFeature ? 230 : 120,
      targetTrack: isFeature ? "feature" : "main",
      speed: 1.8 + Math.random() * 0.5,
      isHalted: false,
      label,
      color: "#FFD84A"
    });
  }

  // Initial train
  spawnTrain(false, "chore: init");

  // Interaction: Commit button
  const btnCommit = el.querySelector("#btn-swe-commit");
  if (btnCommit) {
    btnCommit.addEventListener("click", () => {
      spawnTrain(false, "fix: memory leak");
      techDebt = Math.min(100, techDebt + 4);
      updateDebtDisplay();
    });
  }

  // Open PR button
  const btnPr = el.querySelector("#btn-swe-pr");
  if (btnPr) {
    btnPr.addEventListener("click", () => {
      spawnTrain(true, "PR #421");
    });
  }

  // Break a test button
  const btnBreak = el.querySelector("#btn-swe-break");
  if (btnBreak) {
    btnBreak.addEventListener("click", () => {
      brokenGateIdx = 1; // Break Integration Gate
      renderGantryLights();
      // Halt all trains near gantry
      trains.forEach(t => {
        if (t.x < 550) t.isHalted = true;
      });

      // Dispatch automated fix train after 2.5s
      if (fixTimer) clearTimeout(fixTimer);
      fixTimer = setTimeout(() => {
        if (isDestroyed) return;
        brokenGateIdx = -1;
        renderGantryLights();
        trains.forEach(t => { t.isHalted = false; });
      }, 2600);
    });
  }

  // Merge button
  const btnMerge = el.querySelector("#btn-swe-merge");
  if (btnMerge) {
    btnMerge.addEventListener("click", () => {
      isSwitchThrown = true;
      spawnTrain(false, "merge: PR #421");
      techDebt = Math.min(100, techDebt + 8);
      updateDebtDisplay();
    });
  }

  // Refactor button
  const btnRefactor = el.querySelector("#btn-swe-refactor");
  if (btnRefactor) {
    btnRefactor.addEventListener("click", () => {
      techDebt = 0;
      updateDebtDisplay();
    });
  }

  function updateDebtDisplay() {
    const bar = el.querySelector("#tech-debt-bar");
    const label = el.querySelector("#tech-debt-label");
    if (bar) {
      bar.style.width = `${techDebt}%`;
      bar.style.background = techDebt > 60 ? "#E5646B" : "#FFD84A";
    }
    if (label) {
      label.textContent = `${techDebt}%`;
      label.style.color = techDebt > 60 ? "#E5646B" : "#FFD84A";
    }
  }

  function renderGantryLights() {
    const gantry = el.querySelector("#gantry-group");
    if (!gantry) return;
    gantry.innerHTML = `
      <rect width="360" height="42" rx="4" fill="rgba(16,17,19,0.9)" stroke="rgba(255,216,74,0.3)" stroke-width="1.2" />
      <text x="180" y="16" font-size="9" fill="#9CA3AF" text-anchor="middle" letter-spacing="0.1em">AUTOMATED VERIFICATION GANTRY</text>
      ${GATES.map((g, idx) => {
        const isUnlocked = candLvl >= g.unlock;
        const isGhost = reqLvl >= g.unlock && !isUnlocked;
        const isBroken = brokenGateIdx === idx;
        const lightColor = isBroken ? "#E5646B" : (isUnlocked ? "#9BC53D" : (isGhost ? "#FFD84A" : "#4B5563"));
        return `
          <g transform="translate(${25 + idx * 85}, 22)">
            <circle cx="8" cy="6" r="5" fill="${lightColor}" stroke="${isGhost ? '#FFD84A' : 'none'}" stroke-dasharray="${isGhost ? '2,2' : 'none'}" />
            <text x="20" y="10" font-size="9" fill="${isBroken ? '#E5646B' : (isUnlocked ? '#E5E7EB' : '#6B7280')}" font-weight="600">${g.name.split(' ')[0]}</text>
          </g>
        `;
      }).join("")}
    `;
  }

  // Render Loop
  function render() {
    if (isDestroyed) return;
    if (!isPaused && ctx2d && !reducedMotion) {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      const wScale = canvas.width / 920;
      const hScale = canvas.height / 380;

      for (let i = trains.length - 1; i >= 0; i--) {
        const t = trains[i];
        if (!t.isHalted) {
          t.x += t.speed;
        }

        if (t.x > 840) {
          trains.splice(i, 1);
          continue;
        }

        const cx = t.x * wScale;
        const cy = t.y * hScale;

        // Draw train commit block
        ctx2d.fillStyle = t.isHalted ? "#E5646B" : "#FFD84A";
        ctx2d.fillRect(cx - 24, cy - 8, 48, 16);
        ctx2d.strokeStyle = "#101113";
        ctx2d.lineWidth = 1.5;
        ctx2d.strokeRect(cx - 24, cy - 8, 48, 16);

        // Train text
        ctx2d.fillStyle = "#101113";
        ctx2d.font = "8.5px monospace";
        ctx2d.textAlign = "center";
        ctx2d.fillText(t.label, cx, cy + 3);
      }
    }
    animId = requestAnimationFrame(render);
  }
  if (!reducedMotion) {
    animId = requestAnimationFrame(render);
  }

  const observer = new IntersectionObserver(([entry]) => {
    isPaused = !entry.isIntersecting;
  }, { threshold: 0.1 });
  observer.observe(el);

  function handleVisibility() {
    isPaused = document.hidden;
  }
  document.addEventListener("visibilitychange", handleVisibility);

  return {
    destroy() {
      isDestroyed = true;
      if (fixTimer) clearTimeout(fixTimer);
      if (animId) cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", resizeCanvas);
    }
  };
}

if (typeof window !== "undefined") {
  window.WAYPOINT_SCENES = window.WAYPOINT_SCENES || {};
  window.WAYPOINT_SCENES.SWE = { mount };
}
