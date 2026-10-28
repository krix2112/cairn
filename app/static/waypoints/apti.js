/**
 * WAYPOINT 11: APTI — "The Observatory"
 * Tint: Starlight Blue (#8FB4FF) on Midnight (#070B1A)
 * Art-directed celestial observatory with interactive brass telescope, 6 topic constellations,
 * twinkling Canvas starfield + periodic shooting stars, and 12 curated warm-up puzzles (2 per topic)
 * with instant feedback and step-by-step explanations.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let animId = null;
  let isDestroyed = false;
  let isPaused = false;
  let currentConstellationIdx = 0;
  let selectedOption = null;
  let answered = false;

  const candLvl = ctx.level ?? 6;
  const reqLvl = ctx.required ?? 8;

  // 6 Constellations with 2 double-checked warm-up puzzles each (12 total)
  const CONSTELLATIONS = [
    {
      id: "ratios",
      title: "Ratios & Proportions",
      coords: { x: 220, y: 160 },
      stars: [
        { x: 0, y: 0 }, { x: 38, y: -24 }, { x: 74, y: 10 }, { x: 110, y: -18 }, { x: 50, y: 44 }
      ],
      connections: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 0]],
      puzzles: [
        {
          q: "In an engineering team, the ratio of backend developers to frontend developers is 5 : 3. If there are 24 frontend developers, what is the total number of developers?",
          options: ["40", "56", "64", "72"],
          correct: 2, // 64 (5/3 * 24 = 40 backend; 40 + 24 = 64)
          explanation: "Backend = (5/3) × 24 = 40. Total developers = 40 + 24 = 64."
        },
        {
          q: "If A : B = 2 : 3 and B : C = 4 : 5, find the compounded ratio A : C.",
          options: ["8 : 15", "6 : 15", "8 : 12", "10 : 15"],
          correct: 0, // 8 : 15 ((2/3) * (4/5) = 8/15)
          explanation: "A/C = (A/B) × (B/C) = (2/3) × (4/5) = 8/15. Thus A : C = 8 : 15."
        }
      ]
    },
    {
      id: "percentages",
      title: "Percentages & Growth",
      coords: { x: 420, y: 130 },
      stars: [
        { x: 0, y: 0 }, { x: 44, y: -30 }, { x: 80, y: 0 }, { x: 40, y: 35 }, { x: 120, y: 20 }
      ],
      connections: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4]],
      puzzles: [
        {
          q: "An API server's response latency increased by 20% during peak hours to 180ms. What was its original baseline latency?",
          options: ["144ms", "150ms", "155ms", "160ms"],
          correct: 1, // 150ms (180 / 1.2 = 150)
          explanation: "Baseline × 1.20 = 180ms → Baseline = 180 / 1.2 = 150ms."
        },
        {
          q: "A developer receives a 25% salary increase, followed by a 20% deduction in tax. How does the final take-home compare to the initial base?",
          options: ["Same (0% change)", "5% increase", "5% decrease", "2% increase"],
          correct: 0, // 1.25 * 0.80 = 1.00 (same)
          explanation: "1.00 × 1.25 × (1 - 0.20) = 1.25 × 0.80 = 1.00 (0% net change)."
        }
      ]
    },
    {
      id: "work",
      title: "Time & Work Rates",
      coords: { x: 620, y: 170 },
      stars: [
        { x: 0, y: 10 }, { x: 30, y: -35 }, { x: 65, y: -20 }, { x: 95, y: 25 }, { x: 45, y: 30 }
      ],
      connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]],
      puzzles: [
        {
          q: "Engineer A builds a microservice in 6 days. Engineer B builds it in 12 days. Working together, how many days will it take?",
          options: ["3 days", "4 days", "4.5 days", "5 days"],
          correct: 1, // 4 days (1/6 + 1/12 = 3/12 = 1/4 -> 4 days)
          explanation: "Combined rate = 1/6 + 1/12 = 3/12 = 1/4. Days required = 1 / (1/4) = 4 days."
        },
        {
          q: "Pipe A fills a database cache buffer in 4 hours; Pipe B drains it in 6 hours. With both open, how long to fill an empty buffer?",
          options: ["8 hours", "10 hours", "12 hours", "14 hours"],
          correct: 2, // 12 hours (1/4 - 1/6 = 1/12 -> 12 hours)
          explanation: "Net filling rate = 1/4 - 1/6 = 1/12. Time = 12 hours."
        }
      ]
    },
    {
      id: "probability",
      title: "Probability & Permutations",
      coords: { x: 800, y: 150 },
      stars: [
        { x: 0, y: 0 }, { x: 35, y: -40 }, { x: 75, y: -30 }, { x: 50, y: 15 }, { x: 95, y: 25 }
      ],
      connections: [[0, 1], [1, 2], [2, 3], [0, 3], [3, 4]],
      puzzles: [
        {
          q: "Two fair 6-sided dice are rolled simultaneously. What is the probability that the sum of the numbers is exactly 7?",
          options: ["1/12", "1/9", "1/6", "5/36"],
          correct: 2, // 1/6 (6 outcomes: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) out of 36)
          explanation: "Sum = 7 outcomes: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1) = 6 pairs. P = 6/36 = 1/6."
        },
        {
          q: "In how many distinct ways can 4 microservices be deployed across 4 unique cloud regions (one service per region)?",
          options: ["16", "24", "48", "64"],
          correct: 1, // 4! = 24
          explanation: "Number of permutations = 4! = 4 × 3 × 2 × 1 = 24 ways."
        }
      ]
    },
    {
      id: "sequences",
      title: "Logical Sequences",
      coords: { x: 310, y: 310 },
      stars: [
        { x: 0, y: 0 }, { x: 35, y: 25 }, { x: 70, y: 10 }, { x: 105, y: 40 }, { x: 60, y: -25 }
      ],
      connections: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 2]],
      puzzles: [
        {
          q: "Find the next number in the series: 3, 7, 15, 31, 63, ?",
          options: ["124", "127", "129", "131"],
          correct: 1, // 127 (each step is 2x + 1 or +4, +8, +16, +32, +64)
          explanation: "Each term is 2n + 1: (63 × 2) + 1 = 127 (or differences double: +4, +8, +16, +32, +64)."
        },
        {
          q: "Identify the missing number: 2, 6, 12, 20, 30, ?",
          options: ["40", "42", "44", "48"],
          correct: 1, // 42 (n*(n+1) -> 1*2, 2*3, 3*4, 4*5, 5*6, 6*7 = 42)
          explanation: "Pattern is n(n+1): 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42."
        }
      ]
    },
    {
      id: "interpretation",
      title: "Data Interpretation",
      coords: { x: 690, y: 310 },
      stars: [
        { x: 0, y: 20 }, { x: 40, y: -20 }, { x: 80, y: -10 }, { x: 50, y: 35 }, { x: 110, y: 20 }
      ],
      connections: [[0, 1], [1, 2], [2, 4], [0, 3], [3, 4]],
      puzzles: [
        {
          q: "A server cluster processed 400k requests in Q1 and 520k requests in Q2. What was the percentage increase in traffic?",
          options: ["25%", "30%", "32%", "35%"],
          correct: 1, // 30% ((520 - 400) / 400 = 120 / 400 = 30%)
          explanation: "Percentage increase = (520k - 400k) / 400k = 120 / 400 = 0.30 = 30%."
        },
        {
          q: "Out of 800 total test cases, 640 pass, 120 fail, and 40 are skipped. What percentage of executed tests (passed + failed) passed?",
          options: ["80.0%", "82.5%", "84.2%", "85.0%"],
          correct: 2, // 640 / (640 + 120) = 640 / 760 = 84.21%
          explanation: "Executed tests = 640 + 120 = 760. Passed ratio = 640 / 760 ≈ 84.2%."
        }
      ]
    }
  ];

  el.style.backgroundColor = "#070B1A";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", `The Observatory: Quantitative Aptitude Waypoint. Candidate level ${candLvl} out of 10, required ${reqLvl}.`);

  el.innerHTML = `
    <!-- Twinkling Starlight Canvas + Periodic Shooting Star -->
    <canvas id="observatory-canvas" class="waypoint-canvas-layer"></canvas>

    <!-- Dome Slit SVG Silhouette & Constellations -->
    <svg id="observatory-svg" viewBox="0 0 1000 600" style="position: absolute; inset: 0; width: 100%; height: 100%;" preserveAspectRatio="xMidYMid meet">
      <!-- Dark Dome Slit Vignette Border -->
      <path d="M 0 0 L 1000 0 L 1000 600 L 0 600 Z M 120 40 C 350 -10, 650 -10, 880 40 L 920 540 L 80 540 Z" 
            fill="#050812" fill-rule="evenodd" opacity="0.65" />

      <!-- Constellations Group -->
      <g id="constellations-group"></g>

      <!-- Brass Telescope Silhouette in Foreground -->
      <g id="telescope-mount" transform="translate(180, 480)" style="transition: transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1);">
        <!-- Tripod Legs -->
        <line x1="0" y1="0" x2="-70" y2="120" stroke="#4A3D2E" stroke-width="6" />
        <line x1="0" y1="0" x2="0" y2="120" stroke="#685640" stroke-width="7" />
        <line x1="0" y1="0" x2="70" y2="120" stroke="#4A3D2E" stroke-width="6" />
        <circle cx="0" cy="0" r="16" fill="#8C7350" stroke="#A88B63" stroke-width="2" />
        
        <!-- Telescope Barrel Pivot -->
        <g id="telescope-barrel" transform="rotate(-35)" style="transform-origin: 0px 0px; transition: transform 0.4s ease;">
          <rect x="-14" y="-12" width="190" height="24" rx="4" fill="#A88B63" stroke="#D4AF7A" stroke-width="2" />
          <rect x="156" y="-16" width="18" height="32" rx="3" fill="#D4AF7A" />
          <rect x="-24" y="-8" width="16" height="16" rx="2" fill="#5E4C38" />
        </g>
      </g>
    </svg>

    <!-- Warm-Up Puzzle Overlay Panel (Right Side) -->
    <div id="puzzle-modal" style="
      position: absolute;
      top: 20px;
      right: 20px;
      width: min(440px, 90%);
      background: rgba(7, 11, 26, 0.95);
      border: 1px solid rgba(143, 180, 255, 0.35);
      border-radius: var(--radius-md);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7);
      padding: 20px;
      z-index: 20;
      color: #F3EEE4;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(143, 180, 255, 0.15); padding-bottom: 8px; margin-bottom: 12px;">
        <div>
          <span id="puzzle-topic-tag" style="font-family: var(--font-mono); font-size: 11px; color: #8FB4FF; text-transform: uppercase;"></span>
          <span style="font-family: var(--font-mono); font-size: 10px; color: #736E65; margin-left: 8px;">Puzzle 1 of 2</span>
        </div>
        <span style="font-size: 10px; color: #736E65; font-family: var(--font-mono);">Warm-up · Practice only</span>
      </div>

      <p id="puzzle-question" style="font-size: 13px; line-height: 1.5; margin-bottom: 16px; color: #F3EEE4;"></p>

      <div id="puzzle-options-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;"></div>

      <div id="puzzle-feedback" style="display: none; padding: 10px 12px; border-radius: var(--radius-sm); font-size: 12px; line-height: 1.45; margin-bottom: 12px;"></div>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #736E65;">
        <span>Press ← / → or click stars to aim</span>
        <button id="btn-next-puzzle" type="button" class="btn btn-secondary" style="height: 28px; padding: 0 10px; font-size: 11px;">
          Next Puzzle
        </button>
      </div>
    </div>

    <!-- Readout Badge (Bottom-Left) -->
    <div class="waypoint-readout-badge" style="border-color: rgba(143, 180, 255, 0.4);">
      <span style="width: 7px; height: 7px; border-radius: 50%; background: #8FB4FF; box-shadow: 0 0 8px #8FB4FF;"></span>
      <span>You: ${candLvl} · ${ctx.companyName || "Target"} expects: ${reqLvl}</span>
    </div>
  `;

  // ——— Render SVG Constellations ———
  const constGroup = el.querySelector("#constellations-group");
  let puzzleIndex = 0;

  function renderConstellations() {
    if (!constGroup) return;
    constGroup.innerHTML = "";

    CONSTELLATIONS.forEach((c, idx) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("transform", `translate(${c.coords.x}, ${c.coords.y})`);
      g.style.cursor = "pointer";

      const isCurrent = idx === currentConstellationIdx;

      // Requirement target ring (Dashed faint ring)
      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("cx", 45);
      ring.setAttribute("cy", 0);
      ring.setAttribute("r", 58);
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", isCurrent ? "#8FB4FF" : "rgba(143, 180, 255, 0.25)");
      ring.setAttribute("stroke-width", isCurrent ? "1.5" : "1");
      ring.setAttribute("stroke-dasharray", "4 4");
      g.appendChild(ring);

      // Connection lines between stars
      c.connections.forEach(([s1, s2]) => {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", c.stars[s1].x);
        line.setAttribute("y1", c.stars[s1].y);
        line.setAttribute("x2", c.stars[s2].x);
        line.setAttribute("y2", c.stars[s2].y);
        line.setAttribute("stroke", isCurrent ? "#8FB4FF" : "rgba(143, 180, 255, 0.35)");
        line.setAttribute("stroke-width", isCurrent ? "1.8" : "1");
        g.appendChild(line);
      });

      // Stars in constellation
      c.stars.forEach((st, sIdx) => {
        const isBright = candLvl >= (sIdx + 1) * 2;
        const star = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        star.setAttribute("cx", st.x);
        star.setAttribute("cy", st.y);
        star.setAttribute("r", isBright ? "4.5" : "2.5");
        star.setAttribute("fill", isBright ? "#FFFFFF" : "#7BA3E8");
        if (isBright) star.setAttribute("filter", "drop-shadow(0 0 4px #8FB4FF)");
        g.appendChild(star);
      });

      // Constellation Label
      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", 45);
      txt.setAttribute("y", 76);
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("fill", isCurrent ? "#F3EEE4" : "#8FB4FF");
      txt.setAttribute("font-family", "var(--font-mono)");
      txt.setAttribute("font-size", "11");
      txt.setAttribute("font-weight", isCurrent ? "600" : "400");
      txt.textContent = c.title;
      g.appendChild(txt);

      g.addEventListener("click", () => {
        selectConstellation(idx);
      });
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `Point telescope to ${c.title}`);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectConstellation(idx);
        }
      });

      constGroup.appendChild(g);
    });
  }

  function aimTelescopeAt(targetCoords) {
    const barrel = el.querySelector("#telescope-barrel");
    if (!barrel) return;
    const dx = targetCoords.x - 180;
    const dy = targetCoords.y - 480;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;
    barrel.style.transform = `rotate(${angleDeg.toFixed(1)}deg)`;
  }

  function loadCurrentPuzzle() {
    const cur = CONSTELLATIONS[currentConstellationIdx];
    const puz = cur.puzzles[puzzleIndex % cur.puzzles.length];

    const topicEl = el.querySelector("#puzzle-topic-tag");
    const qEl = el.querySelector("#puzzle-question");
    const optList = el.querySelector("#puzzle-options-list");
    const fbEl = el.querySelector("#puzzle-feedback");

    topicEl.textContent = cur.title;
    qEl.textContent = puz.q;
    fbEl.style.display = "none";
    answered = false;
    optList.innerHTML = "";

    puz.options.forEach((opt, optIdx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary";
      btn.style.justifyContent = "flex-start";
      btn.style.height = "34px";
      btn.style.padding = "0 14px";
      btn.style.fontSize = "12px";
      btn.style.fontFamily = "var(--font-mono)";
      btn.innerHTML = `<span style="color: #8FB4FF; margin-right: 8px;">${String.fromCharCode(65 + optIdx)}.</span> ${opt}`;

      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const isCorrect = optIdx === puz.correct;

        btn.style.borderColor = isCorrect ? "#9BC53D" : "#FF7A3D";
        btn.style.background = isCorrect ? "rgba(155, 197, 61, 0.15)" : "rgba(255, 122, 61, 0.15)";

        fbEl.style.display = "block";
        fbEl.style.background = isCorrect ? "rgba(155, 197, 61, 0.12)" : "rgba(255, 122, 61, 0.12)";
        fbEl.style.border = `1px solid ${isCorrect ? "#9BC53D" : "#FF7A3D"}`;
        fbEl.style.color = isCorrect ? "#9BC53D" : "#FF9A3D";
        fbEl.innerHTML = `<strong>${isCorrect ? "✓ Correct!" : "✗ Invariant Review:"}</strong> ${puz.explanation}`;
      });

      optList.appendChild(btn);
    });
  }

  function selectConstellation(idx) {
    currentConstellationIdx = idx;
    puzzleIndex = 0;
    renderConstellations();
    aimTelescopeAt(CONSTELLATIONS[idx].coords);
    loadCurrentPuzzle();
  }

  selectConstellation(0);

  const btnNext = el.querySelector("#btn-next-puzzle");
  if (btnNext) {
    btnNext.addEventListener("click", () => {
      puzzleIndex++;
      loadCurrentPuzzle();
    });
  }

  function handleArrows(e) {
    if (e.key === "ArrowRight") {
      selectConstellation((currentConstellationIdx + 1) % CONSTELLATIONS.length);
    } else if (e.key === "ArrowLeft") {
      selectConstellation((currentConstellationIdx - 1 + CONSTELLATIONS.length) % CONSTELLATIONS.length);
    }
  }
  window.addEventListener("keydown", handleArrows);

  // ——— Canvas Starfield & Shooting Star Loop ———
  const canvas = el.querySelector("#observatory-canvas");
  const ctx2d = canvas.getContext("2d");
  let width, height;
  let bgStars = [];
  let shootingStar = null;
  let lastShootingTime = (typeof performance !== "undefined" ? performance.now() : Date.now());

  function resizeCanvas() {
    width = canvas.width = el.clientWidth;
    height = canvas.height = el.clientHeight;
    bgStars = [];
    for (let i = 0; i < 64; i++) {
      bgStars.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.85,
        r: 0.6 + Math.random() * 1.4,
        alpha: 0.2 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2
      });
    }
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function triggerShootingStar() {
    shootingStar = {
      x: width * 0.2 + Math.random() * (width * 0.5),
      y: Math.random() * (height * 0.3),
      vx: 6 + Math.random() * 4,
      vy: 3 + Math.random() * 3,
      len: 40 + Math.random() * 40,
      life: 1.0,
      decay: 0.025
    };
  }

  function render(now) {
    if (isDestroyed) return;
    if (isPaused) {
      animId = requestAnimationFrame(render);
      return;
    }

    ctx2d.clearRect(0, 0, width, height);

    if (!reducedMotion) {
      const t = now * 0.001;

      // Twinkling stars
      bgStars.forEach(st => {
        const twinkle = Math.sin(t * 1.6 + st.phase);
        const a = Math.max(0.1, Math.min(1.0, st.alpha + twinkle * 0.25));
        ctx2d.beginPath();
        ctx2d.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(243, 238, 228, ${a.toFixed(2)})`;
        ctx2d.fill();
      });

      // Shooting star every 10s
      if (now - lastShootingTime > 10000) {
        lastShootingTime = now;
        triggerShootingStar();
      }

      if (shootingStar) {
        ctx2d.beginPath();
        ctx2d.moveTo(shootingStar.x, shootingStar.y);
        ctx2d.lineTo(shootingStar.x - shootingStar.vx * 4, shootingStar.y - shootingStar.vy * 4);
        ctx2d.strokeStyle = `rgba(255, 255, 255, ${shootingStar.life.toFixed(2)})`;
        ctx2d.lineWidth = 1.5;
        ctx2d.stroke();

        shootingStar.x += shootingStar.vx;
        shootingStar.y += shootingStar.vy;
        shootingStar.life -= shootingStar.decay;

        if (shootingStar.life <= 0) shootingStar = null;
      }
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
      cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("keydown", handleArrows);
      window.removeEventListener("resize", resizeCanvas);
    }
  };
}

if (typeof window !== "undefined") {
  window.WAYPOINT_SCENES = window.WAYPOINT_SCENES || {};
  window.WAYPOINT_SCENES.APTI = { mount };
}
