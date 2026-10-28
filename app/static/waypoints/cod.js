/**
 * WAYPOINT 03: COD — "The Forge"
 * Tint: Molten Orange (#FF9A3D) on Warm Black (#120B08)
 * Art-directed smithy scene with live SVG displacement shimmer, Canvas ember physics,
 * typing syntax terminal, thermometer benchmark gauge, and interactive hammer strike / quench.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let animId = null;
  let isDestroyed = false;
  let isPaused = false;
  let whatIfBoost = 0;
  let boostTimer = null;
  let quenchActive = false;

  const currentLevel = () => Math.min(10, Math.max(0, (ctx.level ?? 6) + whatIfBoost));
  const reqLevel = ctx.required ?? 8;

  // Root container styling
  el.style.backgroundColor = "#120B08";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", `The Forge: Programming Waypoint. Candidate level ${ctx.level} out of 10, required ${reqLevel}.`);

  el.innerHTML = `
    <!-- SVG Definitions & Heat Displacement Shimmer -->
    <svg style="position: absolute; width: 0; height: 0;" aria-hidden="true">
      <defs>
        <filter id="forge-heat-shimmer">
          <feTurbulence id="forge-turbulence" type="fractalNoise" baseFrequency="0.04 0.08" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <radialGradient id="furnace-glow" cx="15%" cy="65%" r="60%">
          <stop offset="0%" stop-color="#FF9A3D" stop-opacity="0.35" />
          <stop offset="45%" stop-color="#FF521B" stop-opacity="0.15" />
          <stop offset="100%" stop-color="#120B08" stop-opacity="0" />
        </radialGradient>
      </defs>
    </svg>

    <!-- Warm Atmospheric Background Glow -->
    <div style="position: absolute; inset: 0; background: radial-gradient(circle at 18% 70%, rgba(255, 154, 61, 0.22) 0%, rgba(18, 11, 8, 0) 65%); pointer-events: none;"></div>

    <!-- Canvas for Embers and Strike Sparks -->
    <canvas id="forge-canvas" class="waypoint-canvas-layer"></canvas>

    <!-- Terminal Code Window (Above Anvil) -->
    <div id="forge-terminal" style="
      position: absolute;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: min(520px, 88%);
      background: rgba(18, 11, 8, 0.92);
      border: 1px solid rgba(255, 154, 61, 0.28);
      border-radius: 6px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255, 154, 61, 0.2);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      padding: 12px 16px;
      color: #F3EEE4;
      z-index: 5;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 154, 61, 0.15); padding-bottom: 6px; margin-bottom: 8px;">
        <span style="font-size: 11px; color: #FF9A3D; display: flex; align-items: center; gap: 6px;">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: #FF9A3D; display: inline-block;"></span>
          forge_eval.py · Two-Pointer Invariant
        </span>
        <span id="forge-code-status" style="font-size: 10px; color: #8C877D;">Executing...</span>
      </div>
      <div id="forge-code-body" style="white-space: pre-wrap; font-family: inherit; min-height: 54px; color: #F3EEE4;"></div>
      <div id="forge-code-output" style="margin-top: 6px; font-size: 11px; color: #9BC53D; opacity: 0; transition: opacity 0.3s ease;">
        &gt; Passed 100/100 tests · 0.04ms runtime
      </div>
    </div>

    <!-- Central Smithy SVG: Furnace, Anvil, Ingot, Thermometer, Hammer -->
    <svg id="forge-svg-stage" viewBox="0 0 1000 600" style="position: absolute; inset: 0; width: 100%; height: 100%;" preserveAspectRatio="xMidYMid meet">
      <!-- Furnace on the Left -->
      <g id="furnace-group" transform="translate(40, 220)">
        <!-- Furnace Arch -->
        <path d="M 40 340 L 40 120 C 40 40 180 40 180 120 L 180 340 Z" fill="#1C1410" stroke="#3D291F" stroke-width="3" />
        <!-- Furnace Interior Mouth -->
        <path d="M 65 340 L 65 140 C 65 85 155 85 155 140 L 155 340 Z" fill="#0D0705" />
        <!-- Glowing Coals Core -->
        <ellipse cx="110" cy="310" rx="42" ry="22" fill="#FF521B" filter="url(#forge-heat-shimmer)" />
        <ellipse cx="110" cy="305" rx="30" ry="14" fill="#FF9A3D" />
        <ellipse cx="110" cy="300" rx="16" ry="8" fill="#FFF2D6" />
      </g>

      <!-- Anvil Stand & Base (Centre) -->
      <g id="anvil-group" transform="translate(440, 310)" style="cursor: pointer;">
        <!-- Wooden Block Base -->
        <polygon points="10,250 110,250 100,160 20,160" fill="#2A1E17" stroke="#1A120E" stroke-width="2" />
        <line x1="20" y1="180" x2="100" y2="180" stroke="#140C07" stroke-width="3" />
        
        <!-- Heavy Cast-Iron Anvil Body -->
        <path d="M 20 160 L 100 160 L 95 130 C 85 125 75 120 70 105 L 120 105 C 135 105 145 95 135 85 L 75 85 L 80 65 L -10 65 C -25 75 -25 90 5 95 L 45 95 C 45 115 35 125 25 130 Z" 
              fill="#2E2B29" stroke="#5E5A56" stroke-width="2" />
        
        <!-- Anvil Horn & Face Highlight -->
        <polygon points="-8,67 78,67 76,71 -4,71" fill="#757069" opacity="0.8" />
        
        <!-- The Ingot Resting on Anvil Face -->
        <rect id="forge-ingot" x="12" y="47" width="54" height="18" rx="2" 
              fill="#FF8A22" stroke="#FFF2D6" stroke-width="1"
              filter="url(#forge-heat-shimmer)" 
              style="transition: fill 0.6s ease, filter 0.6s ease;" />
      </g>

      <!-- Thermometer Benchmark Rod (Beside Anvil) -->
      <g id="thermometer-group" transform="translate(620, 270)">
        <!-- Rod Base -->
        <rect x="0" y="0" width="12" height="180" rx="6" fill="#1A120E" stroke="#3D291F" stroke-width="2" />
        <!-- Mercury Level Fill -->
        <rect id="thermo-fill" x="2" y="100" width="8" height="78" rx="4" fill="#FF9A3D" style="transition: height 0.5s ease, y 0.5s ease;" />
        <!-- Target Pin (Company Requirement) -->
        <g id="thermo-target-pin" transform="translate(0, 40)" style="transition: transform 0.5s ease;">
          <line x1="-12" y1="0" x2="24" y2="0" stroke="#F3EEE4" stroke-width="2.5" />
          <polygon points="24,-4 32,0 24,4" fill="#F3EEE4" />
          <text x="36" y="4" fill="#F3EEE4" font-family="var(--font-mono)" font-size="11" font-weight="600">REQ: ${reqLevel}</text>
        </g>
        <!-- Candidate Level Tick -->
        <g id="thermo-cand-pin" transform="translate(0, 80)" style="transition: transform 0.5s ease;">
          <line x1="-8" y1="0" x2="20" y2="0" stroke="#FF9A3D" stroke-width="2" stroke-dasharray="2 2" />
          <text x="-48" y="4" fill="#FF9A3D" font-family="var(--font-mono)" font-size="11" font-weight="600">YOU: ${currentLevel()}</text>
        </g>
      </g>

      <!-- Animated Hammer Object -->
      <g id="forge-hammer" transform="translate(485, 230) rotate(-42)" style="transform-origin: 0px 100px; transition: transform 0.1s cubic-bezier(0.18, 0.89, 0.32, 1.28);">
        <!-- Wooden Handle -->
        <rect x="-4" y="0" width="8" height="110" rx="3" fill="#6B4B35" stroke="#331E12" stroke-width="1.5" />
        <!-- Steel Hammer Head -->
        <rect x="-18" y="-18" width="36" height="24" rx="2" fill="#4A4744" stroke="#8C877D" stroke-width="2" />
        <rect x="14" y="-16" width="6" height="20" fill="#B7AE9C" />
      </g>
    </svg>

    <!-- Floating HUD Actions: Strike Hammer / Quench / What-If -->
    <div style="position: absolute; bottom: 20px; right: 20px; display: flex; gap: 10px; z-index: 10;">
      <button id="btn-strike-hammer" type="button" class="btn btn-primary" style="height: 38px; padding: 0 16px; font-size: 12px; background: #FF7A3D; border-color: #FF9A3D;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        <span>Strike Anvil (Space)</span>
      </button>
      <button id="btn-quench" type="button" class="btn btn-secondary" style="height: 38px; padding: 0 14px; font-size: 12px;">
        <span>Quench</span>
      </button>
    </div>

    <!-- Readout Badge (Bottom-Left) -->
    <div class="waypoint-readout-badge" style="border-color: rgba(255, 154, 61, 0.4);">
      <span style="width: 7px; height: 7px; border-radius: 50%; background: #FF9A3D; box-shadow: 0 0 8px #FF9A3D;"></span>
      <span>You: ${currentLevel()} · ${ctx.companyName || "Target"} expects: ${reqLevel}</span>
    </div>
  `;

  // ——— Canvas Particle System (Rising Embers & Spark Bursts) ———
  const canvas = el.querySelector("#forge-canvas");
  const ctx2d = canvas.getContext("2d");
  let width, height;
  let particles = [];
  let sparks = [];

  function resizeCanvas() {
    width = canvas.width = el.clientWidth;
    height = canvas.height = el.clientHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function spawnEmbers() {
    if (particles.length < 38) {
      particles.push({
        x: width * 0.18 + (Math.random() - 0.5) * 80,
        y: height * 0.65 + Math.random() * 40,
        vx: (Math.random() - 0.3) * 0.8,
        vy: -0.8 - Math.random() * 1.6,
        size: 1.2 + Math.random() * 2.2,
        alpha: 0.8 + Math.random() * 0.2,
        decay: 0.006 + Math.random() * 0.012
      });
    }
  }

  function emitSparkBurst(cx, cy) {
    if (reducedMotion) return;
    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 7.5;
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 1.5 + Math.random() * 2.5,
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        color: Math.random() > 0.3 ? "#FFD07B" : "#FFF7EB"
      });
    }
  }

  // Heat color scale mapping to level (0-10)
  function getHeatColor(lvl) {
    if (lvl <= 2) return { fill: "#59544F", glow: "#3A3734" };
    if (lvl <= 4) return { fill: "#B83A14", glow: "#7A2007" };
    if (lvl <= 6) return { fill: "#E8691C", glow: "#B83A14" };
    if (lvl <= 8) return { fill: "#FF9A3D", glow: "#FF521B" };
    return { fill: "#FFF0D4", glow: "#FFB066" };
  }

  function updateIngotVisuals() {
    const lvl = currentLevel();
    const colors = getHeatColor(lvl);
    const ingotEl = el.querySelector("#forge-ingot");
    if (ingotEl) {
      ingotEl.setAttribute("fill", colors.fill);
      ingotEl.style.filter = lvl >= 5 ? "url(#forge-heat-shimmer)" : "none";
    }

    // Update thermometer
    const fillEl = el.querySelector("#thermo-fill");
    const candPin = el.querySelector("#thermo-cand-pin");
    const targetPin = el.querySelector("#thermo-target-pin");
    
    // Height: 0-180px mapped to 0-10
    const fillHeight = Math.max(12, (lvl / 10) * 170);
    const fillY = 180 - fillHeight;
    if (fillEl) {
      fillEl.setAttribute("height", fillHeight);
      fillEl.setAttribute("y", fillY);
    }
    if (candPin) {
      candPin.setAttribute("transform", `translate(0, ${fillY})`);
      candPin.querySelector("text").textContent = `YOU: ${lvl}`;
    }
    if (targetPin) {
      const targetY = 180 - (reqLevel / 10) * 170;
      targetPin.setAttribute("transform", `translate(0, ${targetY})`);
    }
  }
  updateIngotVisuals();

  // ——— Live Code Typing Animation in Smithy ———
  const codeLines = [
    `def is_palindrome(s: str) -> bool:`,
    `    l, r = 0, len(s) - 1`,
    `    while l < r:`,
    `        if s[l] != s[r]: return False`,
    `        l += 1; r -= 1`,
    `    return True`
  ];
  const fullCodeText = codeLines.join("\n");
  const codeBodyEl = el.querySelector("#forge-code-body");
  const codeStatusEl = el.querySelector("#forge-code-status");
  const codeOutputEl = el.querySelector("#forge-code-output");
  let charIdx = 0;
  let typingTimer = null;

  function typeCodeStep() {
    if (isDestroyed) return;
    if (charIdx <= fullCodeText.length) {
      if (codeBodyEl) {
        codeBodyEl.textContent = fullCodeText.slice(0, charIdx) + (charIdx % 4 === 0 ? "█" : "");
      }
      charIdx++;
      typingTimer = setTimeout(typeCodeStep, 28);
    } else {
      if (codeBodyEl) codeBodyEl.textContent = fullCodeText;
      if (codeStatusEl) codeStatusEl.textContent = "Done";
      if (codeOutputEl) codeOutputEl.style.opacity = "1";
    }
  }
  typeCodeStep();

  // ——— Strike Hammer Interaction ———
  const hammerEl = el.querySelector("#forge-hammer");
  function strikeHammer() {
    if (quenchActive) return;
    
    // Strike rotation animation
    hammerEl.style.transform = "translate(470px, 255px) rotate(15deg)";
    
    // Screen shake 2px
    el.style.transform = "translate(2px, -2px)";
    setTimeout(() => { el.style.transform = "translate(-2px, 2px)"; }, 45);
    setTimeout(() => { el.style.transform = "none"; }, 90);

    // Spark burst from ingot coordinates
    const rect = canvas.getBoundingClientRect();
    emitSparkBurst(width * 0.49, height * 0.62);

    // Reset hammer back
    setTimeout(() => {
      hammerEl.style.transform = "translate(485px, 230px) rotate(-42deg)";
    }, 140);

    // What-if preview: +1 boost for 3.5s
    whatIfBoost = 1;
    updateIngotVisuals();
    clearTimeout(boostTimer);
    boostTimer = setTimeout(() => {
      whatIfBoost = 0;
      updateIngotVisuals();
    }, 3500);
  }

  // Quench cooling interaction
  function quenchIngot() {
    quenchActive = true;
    whatIfBoost = -2;
    updateIngotVisuals();
    
    // Steam cloud burst
    for (let i = 0; i < 30; i++) {
      sparks.push({
        x: width * 0.48 + (Math.random() - 0.5) * 40,
        y: height * 0.62,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1.5 - Math.random() * 2.5,
        size: 3 + Math.random() * 4,
        alpha: 0.7,
        decay: 0.015,
        color: "rgba(220, 220, 230, 0.6)"
      });
    }

    setTimeout(() => {
      whatIfBoost = 0;
      quenchActive = false;
      updateIngotVisuals();
    }, 2000);
  }

  // Event Listeners
  const btnStrike = el.querySelector("#btn-strike-hammer");
  const btnQuench = el.querySelector("#btn-quench");
  const anvilGroup = el.querySelector("#anvil-group");

  if (btnStrike) btnStrike.addEventListener("click", strikeHammer);
  if (btnQuench) btnQuench.addEventListener("click", quenchIngot);
  if (anvilGroup) anvilGroup.addEventListener("click", strikeHammer);

  function handleKeyDown(e) {
    if (e.code === "Space" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      strikeHammer();
    }
  }
  window.addEventListener("keydown", handleKeyDown);

  // Animation Loop (60fps)
  function render(time) {
    if (isDestroyed) return;
    if (isPaused) {
      animId = requestAnimationFrame(render);
      return;
    }

    ctx2d.clearRect(0, 0, width, height);

    if (!reducedMotion) {
      spawnEmbers();

      // Render Embers
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(255, 154, 61, ${p.alpha})`;
        ctx2d.shadowColor = "#FF521B";
        ctx2d.shadowBlur = 6;
        ctx2d.fill();
      }

      // Render Sparks
      ctx2d.shadowBlur = 0;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.15; // gravity
        s.alpha -= s.decay;

        if (s.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx2d.beginPath();
        ctx2d.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx2d.fillStyle = s.color;
        ctx2d.globalAlpha = Math.max(0, s.alpha);
        ctx2d.fill();
        ctx2d.globalAlpha = 1.0;
      }
    }

    animId = requestAnimationFrame(render);
  }
  animId = requestAnimationFrame(render);

  // IntersectionObserver to pause offscreen
  const observer = new IntersectionObserver(([entry]) => {
    isPaused = !entry.isIntersecting;
  }, { threshold: 0.1 });
  observer.observe(el);

  // VisibilityChange to pause on background tab
  function handleVisibility() {
    isPaused = document.hidden;
  }
  document.addEventListener("visibilitychange", handleVisibility);

  return {
    destroy() {
      isDestroyed = true;
      cancelAnimationFrame(animId);
      clearTimeout(typingTimer);
      clearTimeout(boostTimer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", resizeCanvas);
    }
  };
}

if (typeof window !== "undefined") {
  window.WAYPOINT_SCENES = window.WAYPOINT_SCENES || {};
  window.WAYPOINT_SCENES.COD = { mount };
}
