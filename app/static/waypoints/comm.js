/**
 * WAYPOINT 12: COMM — "The Amphitheatre"
 * Tint: Warm Gold (#F2C166) on Dusk Plum-Black (#130D14)
 * Art-directed classical semicircular amphitheatre with 10 concentric stone tiers,
 * podium oscilloscope waveform clarity mapping, hold-to-speak audio ripple waves,
 * and technical-to-stakeholder sentence translator with reactive audience engagement.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let animId = null;
  let isDestroyed = false;
  let isPaused = false;
  let isSpeaking = false;
  let rippleRadius = 0;
  let translateMode = "stakeholder"; // "engineer" | "stakeholder"
  let pairIdx = 0;

  const candLvl = ctx.level ?? 9;
  const reqLvl = ctx.required ?? 7;

  const TRANSLATION_PAIRS = [
    {
      eng: "We added an index on composite keys to cut p95 query latency from 850ms to 42ms.",
      stakeholder: "We made the search page about 5x faster for everyone using the app.",
      metric: "5x speedup · Zero user churn"
    },
    {
      eng: "Refactored monolithic handlers into isolated microservices to quarantine fault domains.",
      stakeholder: "Prevented a bug in billing or reporting from taking down the entire website.",
      metric: "99.99% uptime · Zero cascade downtime"
    },
    {
      eng: "Migrated legacy batch cron ETL into streaming pub/sub event pipeline with deduplication.",
      stakeholder: "Sales and finance dashboards now update live in 3 seconds instead of overnight.",
      metric: "Live real-time visibility · 0 stale data"
    }
  ];

  el.style.backgroundColor = "#130D14";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", `The Amphitheatre: Communication Waypoint. Candidate level ${candLvl} out of 10, required ${reqLvl}.`);

  el.innerHTML = `
    <!-- Dusk Plum Radial Glow -->
    <div style="position: absolute; inset: 0; background: radial-gradient(circle at 50% 90%, rgba(242, 193, 102, 0.16) 0%, rgba(19, 13, 20, 0) 70%); pointer-events: none;"></div>

    <!-- Canvas for Oscilloscope Waveform & Acoustic Sound Ripples -->
    <canvas id="amphi-canvas" class="waypoint-canvas-layer"></canvas>

    <!-- Amphitheatre SVG: 10 Tiers & Audience Silhouettes -->
    <svg id="amphi-svg" viewBox="0 0 1000 600" style="position: absolute; inset: 0; width: 100%; height: 100%;" preserveAspectRatio="xMidYMid meet">
      <!-- Semicircular Stone Tiers -->
      <g id="amphi-tiers-group"></g>

      <!-- Target Benchmark Line across required tier -->
      <path id="amphi-target-line" d="" fill="none" stroke="#F2C166" stroke-width="2.5" stroke-dasharray="6 4" opacity="0.8" />

      <!-- Podium on Stage (Centre Foreground) -->
      <g id="amphi-podium" transform="translate(500, 520)">
        <polygon points="-50,0 50,0 35,40 -35,40" fill="#2E242E" stroke="#4F3E4F" stroke-width="2" />
        <rect x="-8" y="-35" width="16" height="35" rx="3" fill="#6B556B" />
        <ellipse cx="0" cy="-40" rx="9" ry="6" fill="#F2C166" opacity="0.9" />
        <circle cx="0" cy="-40" r="14" fill="none" stroke="#F2C166" stroke-width="1.5" opacity="0.4" />
      </g>
    </svg>

    <!-- Technical-to-Stakeholder Translation Card (Top Centre) -->
    <div style="
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: min(580px, 92%);
      background: rgba(19, 13, 20, 0.94);
      border: 1px solid rgba(242, 193, 102, 0.3);
      border-radius: var(--radius-md);
      box-shadow: 0 12px 36px rgba(0,0,0,0.6);
      padding: 16px 20px;
      z-index: 10;
      color: #F3EEE4;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-family: var(--font-mono); font-size: 11px; color: #F2C166; display: flex; align-items: center; gap: 6px;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #F2C166;"></span>
          Technical Translation Engine
        </span>
        <div style="display: flex; gap: 6px;">
          <button id="btn-mode-eng" type="button" class="waypoint-toggle-btn">To Engineers</button>
          <button id="btn-mode-stake" type="button" class="waypoint-toggle-btn active" style="color: #F2C166; border-color: #F2C166;">To Stakeholders</button>
          <button id="btn-next-pair" type="button" class="waypoint-toggle-btn" title="Next Example">↻ Next</button>
        </div>
      </div>

      <div id="translation-text" style="font-size: 14px; line-height: 1.55; color: #F3EEE4; min-height: 44px; transition: opacity 0.2s ease;"></div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-family: var(--font-mono); font-size: 11px; color: #A7A298;">
        <span id="audience-reaction" style="color: #9BC53D;">Audience Engagement: 100% · Crystal Clear</span>
        <span id="translation-metric" style="color: #F2C166;"></span>
      </div>
    </div>

    <!-- Hold-to-Speak Button (Bottom-Right) -->
    <div style="position: absolute; bottom: 20px; right: 20px; z-index: 10; display: flex; gap: 10px;">
      <button id="btn-speak" type="button" class="btn btn-primary" style="height: 38px; padding: 0 16px; font-size: 12px; background: #E5B450; border-color: #F2C166;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        <span>Hold to Project Voice (Space)</span>
      </button>
    </div>

    <!-- Readout Badge (Bottom-Left) -->
    <div class="waypoint-readout-badge" style="border-color: rgba(242, 193, 102, 0.4);">
      <span style="width: 7px; height: 7px; border-radius: 50%; background: #F2C166; box-shadow: 0 0 8px #F2C166;"></span>
      <span>You: ${candLvl} · ${ctx.companyName || "Target"} expects: ${reqLvl}</span>
    </div>
  `;

  // ——— Render Semicircular Amphitheatre Tiers & Audience ———
  const tiersGroup = el.querySelector("#amphi-tiers-group");
  const targetLineEl = el.querySelector("#amphi-target-line");
  const centerX = 500;
  const centerY = 520;
  let audienceSeats = [];

  function buildAmphitheatre() {
    if (!tiersGroup) return;
    tiersGroup.innerHTML = "";
    audienceSeats = [];

    for (let tier = 1; tier <= 10; tier++) {
      const radius = 90 + tier * 36;
      const isFilled = tier <= candLvl;

      // Tier Stone Arch Path
      const startAngle = Math.PI * 0.12;
      const endAngle = Math.PI * 0.88;

      const x1 = centerX - radius * Math.cos(startAngle);
      const y1 = centerY - radius * Math.sin(startAngle);
      const x2 = centerX - radius * Math.cos(endAngle);
      const y2 = centerY - radius * Math.sin(endAngle);

      const tierPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      tierPath.setAttribute("d", `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`);
      tierPath.setAttribute("fill", "none");
      tierPath.setAttribute("stroke", isFilled ? "#3D2B3D" : "#241824");
      tierPath.setAttribute("stroke-width", "18");
      tierPath.setAttribute("stroke-linecap", "round");
      tiersGroup.appendChild(tierPath);

      // Target benchmark line at reqLvl
      if (tier === reqLvl) {
        targetLineEl.setAttribute("d", `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`);
      }

      // Seat Silhouettes along the tier arc
      const seatsCount = 6 + tier * 3;
      for (let s = 0; s < seatsCount; s++) {
        const angle = startAngle + (s / (seatsCount - 1)) * (endAngle - startAngle);
        const sx = centerX - radius * Math.cos(angle);
        const sy = centerY - radius * Math.sin(angle);

        const person = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        person.setAttribute("cx", sx);
        person.setAttribute("cy", sy);
        person.setAttribute("r", "3.2");

        // Audience color: gold if filled and stakeholder mode, confused grey if eng mode, dark if unfilled
        let seatColor = "#2A1F2A";
        if (isFilled) {
          seatColor = translateMode === "stakeholder" ? "#F2C166" : "#7A6B7A";
        }
        person.setAttribute("fill", seatColor);
        person.setAttribute("opacity", isFilled ? "0.9" : "0.35");
        person.style.transition = "fill 0.4s ease, opacity 0.4s ease";

        tiersGroup.appendChild(person);
        audienceSeats.push({ el: person, tier, angle, radius, isFilled });
      }
    }
  }
  buildAmphitheatre();

  // ——— Translation Switcher ———
  const textEl = el.querySelector("#translation-text");
  const metricEl = el.querySelector("#translation-metric");
  const reactionEl = el.querySelector("#audience-reaction");
  const btnEng = el.querySelector("#btn-mode-eng");
  const btnStake = el.querySelector("#btn-mode-stake");
  const btnNext = el.querySelector("#btn-next-pair");
  let translateTimer = null;

  function updateTranslationDisplay() {
    if (isDestroyed) return;
    const pair = TRANSLATION_PAIRS[pairIdx % TRANSLATION_PAIRS.length];
    if (textEl) textEl.style.opacity = "0";

    if (translateTimer) clearTimeout(translateTimer);
    translateTimer = setTimeout(() => {
      if (isDestroyed) return;
      if (translateMode === "stakeholder") {
        if (textEl) textEl.innerHTML = `<strong style="color: #F2C166;">Plain Language:</strong> "${pair.stakeholder}"`;
        if (metricEl) metricEl.textContent = pair.metric;
        if (reactionEl) {
          reactionEl.textContent = "Audience Engagement: 100% · Resonates with Executive Leaders";
          reactionEl.style.color = "#9BC53D";
        }
        if (btnStake) {
          btnStake.classList.add("active");
          btnStake.style.color = "#F2C166";
          btnStake.style.borderColor = "#F2C166";
        }
        if (btnEng) {
          btnEng.classList.remove("active");
          btnEng.style.color = "var(--c-bone-secondary)";
          btnEng.style.borderColor = "var(--c-hairline)";
        }
      } else {
        if (textEl) textEl.innerHTML = `<strong style="color: #A7A298;">Technical Jargon:</strong> "${pair.eng}"`;
        if (metricEl) metricEl.textContent = "High technical density · Non-specialists lose context";
        if (reactionEl) {
          reactionEl.textContent = "Audience Engagement: 35% · Confused Stakeholders";
          reactionEl.style.color = "#FF9A3D";
        }
        if (btnEng) {
          btnEng.classList.add("active");
          btnEng.style.color = "#F3EEE4";
          btnEng.style.borderColor = "#F3EEE4";
        }
        if (btnStake) {
          btnStake.classList.remove("active");
          btnStake.style.color = "var(--c-bone-secondary)";
          btnStake.style.borderColor = "var(--c-hairline)";
        }
      }
      if (textEl) textEl.style.opacity = "1";
      buildAmphitheatre();
    }, 150);
  }
  updateTranslationDisplay();

  btnEng.addEventListener("click", () => { translateMode = "engineer"; updateTranslationDisplay(); });
  btnStake.addEventListener("click", () => { translateMode = "stakeholder"; updateTranslationDisplay(); });
  btnNext.addEventListener("click", () => { pairIdx++; updateTranslationDisplay(); });

  // ——— Speak Ripple Interaction ———
  const btnSpeak = el.querySelector("#btn-speak");
  function startSpeaking() { isSpeaking = true; }
  function stopSpeaking() { isSpeaking = false; }

  if (btnSpeak) {
    btnSpeak.addEventListener("mousedown", startSpeaking);
    btnSpeak.addEventListener("mouseup", stopSpeaking);
    btnSpeak.addEventListener("mouseleave", stopSpeaking);
    btnSpeak.addEventListener("touchstart", (e) => { e.preventDefault(); startSpeaking(); });
    btnSpeak.addEventListener("touchend", stopSpeaking);
  }

  function handleKeyDown(e) {
    if (e.code === "Space" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      startSpeaking();
    }
  }
  function handleKeyUp(e) {
    if (e.code === "Space") stopSpeaking();
  }
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  // ——— Canvas Waveform Oscilloscope & Sound Ripples ———
  const canvas = el.querySelector("#amphi-canvas");
  const ctx2d = canvas.getContext("2d");
  let width, height;
  let wavePhase = 0;
  let activeRipples = [];

  function resizeCanvas() {
    width = canvas.width = el.clientWidth;
    height = canvas.height = el.clientHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function render(time) {
    if (isDestroyed) return;
    if (isPaused) {
      animId = requestAnimationFrame(render);
      return;
    }

    ctx2d.clearRect(0, 0, width, height);

    if (!reducedMotion) {
      wavePhase += 0.05;

      // Spawn ripples while speaking
      if (isSpeaking && Math.random() > 0.4) {
        activeRipples.push({
          r: 20,
          maxR: 440,
          alpha: 0.85,
          color: translateMode === "stakeholder" ? "#F2C166" : "#A7A298"
        });
      }

      // Draw acoustic ripples
      for (let i = activeRipples.length - 1; i >= 0; i--) {
        const rip = activeRipples[i];
        rip.r += 3.8;
        rip.alpha -= 0.012;

        if (rip.alpha <= 0 || rip.r >= rip.maxR) {
          activeRipples.splice(i, 1);
          continue;
        }

        ctx2d.beginPath();
        ctx2d.arc(width * 0.5, height * 0.86, rip.r, Math.PI * 1.1, Math.PI * 1.9);
        ctx2d.strokeStyle = rip.color;
        ctx2d.lineWidth = 1.8;
        ctx2d.globalAlpha = Math.max(0, rip.alpha);
        ctx2d.stroke();
        ctx2d.globalAlpha = 1.0;
      }

      // Draw Oscilloscope Waveform at the podium
      const waveX = width * 0.5 - 70;
      const waveY = height * 0.86;
      const waveW = 140;

      ctx2d.beginPath();
      for (let x = 0; x < waveW; x++) {
        // High level = clean pure sine; Low level = noisy jagged
        const noiseFactor = Math.max(0, (10 - candLvl) * 0.15);
        const sine = Math.sin(wavePhase + x * 0.12) * (isSpeaking ? 14 : 7);
        const noise = (Math.random() - 0.5) * (noiseFactor * 16);
        const y = waveY + sine + noise;

        if (x === 0) ctx2d.moveTo(waveX + x, y);
        else ctx2d.lineTo(waveX + x, y);
      }
      ctx2d.strokeStyle = isSpeaking ? "#F2C166" : "#A7A298";
      ctx2d.lineWidth = 2;
      ctx2d.shadowColor = "#F2C166";
      ctx2d.shadowBlur = isSpeaking ? 8 : 2;
      ctx2d.stroke();
      ctx2d.shadowBlur = 0;
    }

    animId = requestAnimationFrame(render);
  }
  animId = requestAnimationFrame(render);

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
      if (translateTimer) clearTimeout(translateTimer);
      cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", resizeCanvas);
    }
  };
}

if (typeof window !== "undefined") {
  window.WAYPOINT_SCENES = window.WAYPOINT_SCENES || {};
  window.WAYPOINT_SCENES.COMM = { mount };
}
