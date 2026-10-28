/**
 * WAYPOINT 04: DSA — "The Grove"
 * Tint: Lichen (#9BC53D) on Deep Green-Black (#08130C)
 * Art-directed algorithmic grove scene with recursive seeded branching tree,
 * ghost canopy benchmark outline, 8 interactive structure branches, drifting leaves,
 * and dynamic Grow and Wind sliders.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let animId = null;
  let isDestroyed = false;
  let isPaused = false;
  let simulatedLevel = ctx.level ?? 7;
  let windStrength = 1.0;
  let activeBranch = null;

  const reqLevel = ctx.required ?? 9;

  // Eight canonical structures and metadata
  const STRUCTURES = [
    { name: "Array", cost: "O(1) access · O(n) insert/delete", usage: "Contiguous buffer, random access, binary search", key: "array" },
    { name: "Linked List", cost: "O(1) prepend/append · O(n) lookup", usage: "Dynamic queues, fast insertion, LRU cache nodes", key: "linked list" },
    { name: "Stack", cost: "O(1) push/pop · O(n) scan", usage: "LIFO history, recursion call frames, monotonic monotonic spans", key: "stack" },
    { name: "Queue", cost: "O(1) enqueue/dequeue · O(n) scan", usage: "FIFO buffers, BFS graph traversals, task scheduling", key: "queue" },
    { name: "Hash Map", cost: "O(1) avg lookup · O(n) worst-case collision", usage: "Constant-time key lookups, frequency maps, memoization", key: "hash" },
    { name: "Tree", cost: "O(log n) balanced search · O(n) traversal", usage: "Hierarchical scopes, prefix tries, binary decision trees", key: "tree" },
    { name: "Heap", cost: "O(1) peek · O(log n) push/pop", usage: "Priority queues, top-k element tracking, Dijkstra shortest path", key: "heap" },
    { name: "Graph", cost: "O(V + E) BFS/DFS · O(E log V) shortest path", usage: "Dependency resolution, topological sorting, network flows", key: "graph" }
  ];

  // Determine which structures candidate has evidence for
  const candidateEvidenceStr = (ctx.evidence || []).join(" ").toLowerCase() + " " + (ctx.jdSkills || []).join(" ").toLowerCase();
  STRUCTURES.forEach(s => {
    s.hasEvidence = candidateEvidenceStr.includes(s.key) || s.name.toLowerCase().includes("array") || s.name.toLowerCase().includes("hash") || (ctx.level >= 6);
  });

  el.style.backgroundColor = "#08130C";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", `The Grove: Data Structures and Algorithms Waypoint. Candidate level ${ctx.level} out of 10, required ${reqLevel}.`);

  el.innerHTML = `
    <!-- Forest Dusk Ambient Radiance -->
    <div style="position: absolute; inset: 0; background: radial-gradient(circle at 50% 85%, rgba(155, 197, 61, 0.14) 0%, rgba(8, 19, 12, 0) 70%); pointer-events: none;"></div>

    <!-- Canvas for Drifting Foliage Particles -->
    <canvas id="grove-canvas" class="waypoint-canvas-layer"></canvas>

    <!-- Interactive Tree SVG Layer -->
    <svg id="grove-tree-svg" viewBox="0 0 1000 600" style="position: absolute; inset: 0; width: 100%; height: 100%;" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="canopy-target-glow" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stop-color="#9BC53D" stop-opacity="0.12" />
          <stop offset="100%" stop-color="#08130C" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- Ghost Benchmark Canopy Target (Dashed Arc) -->
      <path id="ghost-canopy" d="M 180 340 C 220 110, 780 110, 820 340" 
            fill="none" stroke="#9BC53D" stroke-width="2" stroke-dasharray="6 6" opacity="0.6" />
      <text x="500" y="115" text-anchor="middle" fill="#9BC53D" font-family="var(--font-mono)" font-size="11" letter-spacing="0.08em" opacity="0.8">
        BENCHMARK CANOPY · ${ctx.companyName || "Target"} REQ: ${reqLevel}/10
      </text>

      <!-- Forest Floor Base -->
      <line x1="80" y1="520" x2="920" y2="520" stroke="#1D3020" stroke-width="3" />
      <path d="M 450 520 Q 500 514 550 520" fill="#142416" />

      <!-- Procedural Branches Root Group -->
      <g id="tree-branch-root"></g>
    </svg>

    <!-- Hovered Structure Inspector Card (Top-Right) -->
    <div id="grove-card" class="waypoint-hud-panel" style="top: 20px; right: 20px; transition: opacity 0.25s ease; opacity: 0; pointer-events: none;">
      <div class="waypoint-hud-card" style="border-color: rgba(155, 197, 61, 0.4); background: rgba(8, 19, 12, 0.94);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong id="card-struct-title" style="color: #9BC53D; font-size: 14px;">Structure</strong>
          <span id="card-struct-status" style="font-family: var(--font-mono); font-size: 10px; color: #F3EEE4;">Leafed</span>
        </div>
        <div id="card-struct-cost" style="font-family: var(--font-mono); font-size: 11px; color: #F3EEE4; margin-bottom: 6px;"></div>
        <div id="card-struct-usage" style="color: #A7A298; font-size: 11px; line-height: 1.4;"></div>
      </div>
    </div>

    <!-- Interactive Sliders (Bottom-Right): Grow & Wind -->
    <div style="
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: rgba(8, 19, 12, 0.92);
      border: 1px solid rgba(155, 197, 61, 0.3);
      border-radius: var(--radius-sm);
      padding: 12px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 10;
      width: 220px;
    ">
      <div>
        <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 11px; margin-bottom: 4px; color: #F3EEE4;">
          <span>Grow Tree</span>
          <span id="label-grow-lvl" style="color: #9BC53D;">Lvl ${simulatedLevel}</span>
        </div>
        <input id="slider-grow" type="range" min="0" max="10" step="1" value="${simulatedLevel}" 
               style="width: 100%; accent-color: #9BC53D; cursor: pointer;" aria-label="Grow tree level slider" />
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 11px; margin-bottom: 4px; color: #A7A298;">
          <span>Canopy Wind</span>
          <span id="label-wind-val">1.0x</span>
        </div>
        <input id="slider-wind" type="range" min="0" max="3" step="0.2" value="1.0" 
               style="width: 100%; accent-color: #9BC53D; cursor: pointer;" aria-label="Canopy wind sway slider" />
      </div>
    </div>

    <!-- Readout Badge (Bottom-Left) -->
    <div class="waypoint-readout-badge" style="border-color: rgba(155, 197, 61, 0.4);">
      <span style="width: 7px; height: 7px; border-radius: 50%; background: #9BC53D; box-shadow: 0 0 8px #9BC53D;"></span>
      <span id="grove-readout-text">You: ${simulatedLevel} · ${ctx.companyName || "Target"} expects: ${reqLevel}</span>
    </div>
  `;

  // ——— Seeded Procedural Tree Rendering ———
  const branchRoot = el.querySelector("#tree-branch-root");
  const cardEl = el.querySelector("#grove-card");
  const cardTitle = el.querySelector("#card-struct-title");
  const cardStatus = el.querySelector("#card-struct-status");
  const cardCost = el.querySelector("#card-struct-cost");
  const cardUsage = el.querySelector("#card-struct-usage");

  function buildProceduralTree() {
    if (!branchRoot) return;
    branchRoot.innerHTML = "";

    const trunkHeight = 120 + (simulatedLevel / 10) * 110;
    const generations = Math.min(6, 2 + Math.floor(simulatedLevel * 0.4));
    const startX = 500;
    const startY = 520;

    let branchIndex = 0;

    function renderBranch(x, y, len, angle, depth) {
      if (depth <= 0 || len < 12) return;

      const rad = (angle * Math.PI) / 180;
      const x2 = x + len * Math.sin(rad);
      const y2 = y - len * Math.cos(rad);

      const strokeW = Math.max(1.8, depth * 2.2);
      const isTopBranch = depth <= 2;
      const struct = STRUCTURES[branchIndex % STRUCTURES.length];
      branchIndex++;

      // Create branch line
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x);
      line.setAttribute("y1", y);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("stroke", struct.hasEvidence ? "#8A8072" : "#4A433A");
      line.setAttribute("stroke-width", strokeW);
      line.setAttribute("class", "tree-branch-line");
      branchRoot.appendChild(line);

      // Leaves cluster at tips
      if (isTopBranch && struct.hasEvidence) {
        const leafGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        leafGroup.setAttribute("transform", `translate(${x2}, ${y2})`);
        leafGroup.style.cursor = "pointer";

        // Cluster of small lichen leaf circles
        const leafCount = Math.floor(3 + (simulatedLevel / 10) * 5);
        for (let l = 0; l < leafCount; l++) {
          const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          c.setAttribute("cx", (Math.random() - 0.5) * 22);
          c.setAttribute("cy", (Math.random() - 0.5) * 18);
          c.setAttribute("r", 3 + Math.random() * 4);
          c.setAttribute("fill", l % 2 === 0 ? "#9BC53D" : "#B8E05A");
          c.setAttribute("opacity", "0.85");
          leafGroup.appendChild(c);
        }

        // Branch Node Badge (Pill)
        const pill = document.createElementNS("http://www.w3.org/2000/svg", "g");
        pill.setAttribute("transform", `translate(0, -18)`);

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const textLen = struct.name.length * 6.5 + 16;
        rect.setAttribute("x", -textLen / 2);
        rect.setAttribute("y", -10);
        rect.setAttribute("width", textLen);
        rect.setAttribute("height", 18);
        rect.setAttribute("rx", 4);
        rect.setAttribute("fill", "rgba(8, 19, 12, 0.9)");
        rect.setAttribute("stroke", "#9BC53D");
        rect.setAttribute("stroke-width", 1);
        pill.appendChild(rect);

        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("y", 3);
        txt.setAttribute("fill", "#F3EEE4");
        txt.setAttribute("font-family", "var(--font-mono)");
        txt.setAttribute("font-size", "10");
        txt.textContent = struct.name;
        pill.appendChild(txt);

        leafGroup.appendChild(pill);

        // Interaction: hover / focus on leaf group
        function showCard() {
          cardTitle.textContent = struct.name;
          cardStatus.textContent = struct.hasEvidence ? "Evidence Found" : "Foundational";
          cardStatus.style.color = struct.hasEvidence ? "#9BC53D" : "#A7A298";
          cardCost.textContent = struct.cost;
          cardUsage.textContent = struct.usage;
          cardEl.style.opacity = "1";
          line.setAttribute("stroke", "#9BC53D");
          line.setAttribute("stroke-width", strokeW + 2);
        }

        function hideCard() {
          cardEl.style.opacity = "0";
          line.setAttribute("stroke", struct.hasEvidence ? "#8A8072" : "#4A433A");
          line.setAttribute("stroke-width", strokeW);
        }

        leafGroup.addEventListener("mouseenter", showCard);
        leafGroup.addEventListener("mouseleave", hideCard);
        leafGroup.addEventListener("focus", showCard);
        leafGroup.addEventListener("blur", hideCard);
        leafGroup.setAttribute("tabindex", "0");
        leafGroup.setAttribute("role", "button");
        leafGroup.setAttribute("aria-label", `${struct.name}: ${struct.cost}`);

        branchRoot.appendChild(leafGroup);
      }

      // Branching recurrence
      const nextLen = len * (0.68 + (depth % 2) * 0.08);
      const spread = 24 + (depth * 3);
      renderBranch(x2, y2, nextLen, angle - spread, depth - 1);
      renderBranch(x2, y2, nextLen, angle + spread, depth - 1);
    }

    // Trunk
    renderBranch(startX, startY, trunkHeight, 0, generations);
  }
  buildProceduralTree();

  // Sliders
  const growSlider = el.querySelector("#slider-grow");
  const windSlider = el.querySelector("#slider-wind");
  const growLabel = el.querySelector("#label-grow-lvl");
  const windLabel = el.querySelector("#label-wind-val");
  const readoutText = el.querySelector("#grove-readout-text");

  if (growSlider) {
    growSlider.addEventListener("input", (e) => {
      simulatedLevel = parseInt(e.target.value, 10);
      growLabel.textContent = `Lvl ${simulatedLevel}`;
      readoutText.textContent = `You: ${simulatedLevel} · ${ctx.companyName || "Target"} expects: ${reqLevel}`;
      buildProceduralTree();
    });
  }

  if (windSlider) {
    windSlider.addEventListener("input", (e) => {
      windStrength = parseFloat(e.target.value);
      windLabel.textContent = `${windStrength.toFixed(1)}x`;
    });
  }

  // ——— Canvas Drifting Leaves ———
  const canvas = el.querySelector("#grove-canvas");
  const ctx2d = canvas.getContext("2d");
  let width, height;
  let leaves = [];

  function resizeCanvas() {
    width = canvas.width = el.clientWidth;
    height = canvas.height = el.clientHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function spawnLeaves() {
    if (leaves.length < 24) {
      leaves.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.4,
        vx: (Math.random() - 0.4) * 1.2 * windStrength,
        vy: 0.6 + Math.random() * 1.2,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.05,
        size: 3 + Math.random() * 4,
        color: Math.random() > 0.4 ? "#9BC53D" : "#7BA62E",
        alpha: 0.6 + Math.random() * 0.3
      });
    }
  }

  let timeAngle = 0;
  function render(time) {
    if (isDestroyed) return;
    if (isPaused) {
      animId = requestAnimationFrame(render);
      return;
    }

    ctx2d.clearRect(0, 0, width, height);

    if (!reducedMotion) {
      spawnLeaves();
      timeAngle += 0.02 * windStrength;

      for (let i = leaves.length - 1; i >= 0; i--) {
        const lf = leaves[i];
        lf.x += lf.vx + Math.sin(timeAngle + lf.y * 0.01) * 0.8 * windStrength;
        lf.y += lf.vy;
        lf.rot += lf.vRot;

        if (lf.y > height + 20 || lf.x < -20 || lf.x > width + 20) {
          leaves.splice(i, 1);
          continue;
        }

        ctx2d.save();
        ctx2d.translate(lf.x, lf.y);
        ctx2d.rotate(lf.rot);
        ctx2d.fillStyle = lf.color;
        ctx2d.globalAlpha = lf.alpha;
        ctx2d.beginPath();
        ctx2d.ellipse(0, 0, lf.size, lf.size * 0.55, 0, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.restore();
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
      window.removeEventListener("resize", resizeCanvas);
    }
  };
}

if (typeof window !== "undefined") {
  window.WAYPOINT_SCENES = window.WAYPOINT_SCENES || {};
  window.WAYPOINT_SCENES.DSA = { mount };
}
