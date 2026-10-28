/**
 * WAYPOINT 10: AI — "The Firefly Net"
 * Tint: Electric Violet-Free Teal-Cyan (#4FE3C1) on Deep Indigo-Black (#060A12)
 * Art-directed night meadow neural network where floating fireflies form 4 active layers,
 * traveling signal weight pulses, ghost benchmark layer outline, and dual interactive simulators:
 * (1) Gradient Descent Loss Bowl with learning-rate overshoot physics
 * (2) Bias vs Variance Polynomial Curve Fitter with real-time train/test loss metrics.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let isDestroyed = false;
  let isPaused = false;
  let animId = null;
  let activeTab = "gradient"; // "gradient" | "bias_variance"

  const candLvl = ctx.level ?? 9;
  const reqLvl = ctx.required ?? 7;

  // Check which topics JD mentions (bias-variance, gradient descent, neural networks, overfitting)
  const jdText = (ctx.jdSkills || []).join(" ").toLowerCase();
  const jdHasGD = jdText.includes("gradient") || jdText.includes("optimization") || ctx.name.includes("Data Scientist");
  const jdHasBV = jdText.includes("bias") || jdText.includes("variance") || jdText.includes("model");

  el.style.backgroundColor = "#060A12";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", `The Firefly Net: Machine Learning and Statistics Waypoint. Candidate level ${candLvl} out of 10, required ${reqLvl}.`);

  el.innerHTML = `
    <!-- Deep Indigo Radial Meadow Atmosphere -->
    <div style="position: absolute; inset: 0; background: radial-gradient(circle at 35% 50%, rgba(79, 227, 193, 0.12) 0%, rgba(6, 10, 18, 0) 65%); pointer-events: none;"></div>

    <!-- Canvas for Floating Fireflies & Network Synaptic Pulses -->
    <canvas id="firefly-canvas" class="waypoint-canvas-layer"></canvas>

    <!-- Neural Network Layer Overlay (SVG) -->
    <svg id="firefly-net-svg" viewBox="0 0 1000 600" style="position: absolute; inset: 0; width: 100%; height: 100%;" preserveAspectRatio="xMidYMid meet">
      <!-- Synaptic Filaments -->
      <g id="synapse-group"></g>

      <!-- Firefly Nodes (4 Layers: Input -> H1 -> H2 -> Output) -->
      <g id="firefly-nodes-group"></g>

      <!-- Ghost Benchmark Layer Outline (Dashed Outline at reqLvl) -->
      <rect x="360" y="90" width="130" height="420" rx="6" fill="none" stroke="#4FE3C1" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.45" />
      <text x="425" y="80" text-anchor="middle" fill="#4FE3C1" font-family="var(--font-mono)" font-size="10" opacity="0.7">
        BENCHMARK DEPTH (REQ: ${reqLvl})
      </text>
    </svg>

    <!-- Interactive Simulator Panel (Right Side: Gradient Descent vs Bias/Variance) -->
    <div style="
      position: absolute;
      top: 18px;
      right: 18px;
      width: min(380px, 88%);
      background: rgba(6, 10, 18, 0.94);
      border: 1px solid rgba(79, 227, 193, 0.3);
      border-radius: var(--radius-md);
      box-shadow: 0 12px 36px rgba(0,0,0,0.6);
      padding: 16px 20px;
      z-index: 10;
      color: #F3EEE4;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(79, 227, 193, 0.15); padding-bottom: 8px; margin-bottom: 12px;">
        <span style="font-family: var(--font-mono); font-size: 11px; color: #4FE3C1; text-transform: uppercase;">ML Lab Dynamics</span>
        <div style="display: flex; gap: 6px;">
          <button id="btn-tab-gd" type="button" class="waypoint-toggle-btn active" style="color: #4FE3C1; border-color: #4FE3C1;">Gradient Descent</button>
          <button id="btn-tab-bv" type="button" class="waypoint-toggle-btn">Bias vs Variance</button>
        </div>
      </div>

      <!-- Simulator 1: Gradient Descent Bowl -->
      <div id="sim-container-gd">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #A7A298; margin-bottom: 6px;">
          <span>Loss Surface J(w) = w²</span>
          <span id="label-lr">Learning Rate: η = 0.30</span>
        </div>
        <canvas id="gd-curve-canvas" width="340" height="130" style="width: 100%; height: 130px; background: rgba(10, 16, 28, 0.8); border: 1px solid rgba(79, 227, 193, 0.2); border-radius: 4px; display: block; margin-bottom: 10px;"></canvas>
        <div style="margin-bottom: 10px;">
          <input id="slider-lr" type="range" min="0.05" max="1.15" step="0.05" value="0.30" style="width: 100%; accent-color: #4FE3C1; cursor: pointer;" aria-label="Learning rate slider" />
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span id="gd-status-text" style="font-family: var(--font-mono); font-size: 11px; color: #4FE3C1;">Smooth Convergence</span>
          <div style="display: flex; gap: 6px;">
            <button id="btn-gd-roll" type="button" class="btn btn-primary" style="height: 28px; padding: 0 10px; font-size: 11px; background: #35BCA0; border-color: #4FE3C1;">Roll Step</button>
            <button id="btn-gd-reset" type="button" class="btn btn-secondary" style="height: 28px; padding: 0 10px; font-size: 11px;">Reset</button>
          </div>
        </div>
      </div>

      <!-- Simulator 2: Bias vs Variance -->
      <div id="sim-container-bv" style="display: none;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #A7A298; margin-bottom: 6px;">
          <span>Model Polynomial Degree: <strong id="label-poly-deg" style="color: #4FE3C1;">Degree 3 (Balanced)</strong></span>
        </div>
        <canvas id="bv-curve-canvas" width="340" height="130" style="width: 100%; height: 130px; background: rgba(10, 16, 28, 0.8); border: 1px solid rgba(79, 227, 193, 0.2); border-radius: 4px; display: block; margin-bottom: 10px;"></canvas>
        <div style="margin-bottom: 10px;">
          <input id="slider-poly" type="range" min="1" max="9" step="1" value="3" style="width: 100%; accent-color: #4FE3C1; cursor: pointer;" aria-label="Model polynomial complexity slider" />
        </div>
        <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 11px;">
          <span style="color: #F3EEE4;">Train Loss: <strong id="val-train-loss" style="color: #9BC53D;">0.12</strong></span>
          <span style="color: #F3EEE4;">Test Loss: <strong id="val-test-loss" style="color: #9BC53D;">0.15</strong></span>
        </div>
      </div>

      <!-- JD Relevance Note -->
      <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(79, 227, 193, 0.15); font-family: var(--font-mono); font-size: 10px; color: #736E65;">
        ${jdHasGD || jdHasBV ? `<span style="color: #4FE3C1;">✓ Explicitly evaluated in active ${ctx.companyName} role spec</span>` : `Core theoretical benchmark evaluated across AI engineering tiers`}
      </div>
    </div>

    <!-- Readout Badge (Bottom-Left) -->
    <div class="waypoint-readout-badge" style="border-color: rgba(79, 227, 193, 0.4);">
      <span style="width: 7px; height: 7px; border-radius: 50%; background: #4FE3C1; box-shadow: 0 0 8px #4FE3C1;"></span>
      <span>You: ${candLvl} · ${ctx.companyName || "Target"} expects: ${reqLvl}</span>
    </div>
  `;

  // ——— 4-Layer Neural Network Firefly Topology ———
  const synapseGroup = el.querySelector("#synapse-group");
  const nodesGroup = el.querySelector("#firefly-nodes-group");

  const LAYERS = [
    { x: 120, count: 4, label: "Input" },
    { x: 260, count: 5, label: "Hidden 1" },
    { x: 400, count: 5, label: "Hidden 2" },
    { x: 540, count: 3, label: "Output" }
  ];

  let networkNodes = [];

  function buildNeuralNetwork() {
    if (!synapseGroup || !nodesGroup) return;
    synapseGroup.innerHTML = "";
    nodesGroup.innerHTML = "";
    networkNodes = [];

    // Calculate node coordinates
    LAYERS.forEach((layer, lIdx) => {
      const activeForLevel = lIdx <= Math.floor(candLvl * 0.35) + 1;
      const layerNodes = [];
      const spacing = 360 / (layer.count + 1);

      for (let i = 0; i < layer.count; i++) {
        const y = 120 + (i + 1) * spacing;
        layerNodes.push({ x: layer.x, y, active: activeForLevel });

        // Node Glow Circle
        const nodeG = document.createElementNS("http://www.w3.org/2000/svg", "g");
        nodeG.setAttribute("transform", `translate(${layer.x}, ${y})`);

        const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        glow.setAttribute("r", activeForLevel ? "10" : "6");
        glow.setAttribute("fill", activeForLevel ? "rgba(79, 227, 193, 0.25)" : "rgba(79, 227, 193, 0.05)");
        nodeG.appendChild(glow);

        const core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        core.setAttribute("r", activeForLevel ? "4.5" : "2.5");
        core.setAttribute("fill", activeForLevel ? "#4FE3C1" : "#243E38");
        nodeG.appendChild(core);

        nodesGroup.appendChild(nodeG);
      }
      networkNodes.push(layerNodes);
    });

    // Draw connecting synapses
    for (let l = 0; l < networkNodes.length - 1; l++) {
      const currentLayer = networkNodes[l];
      const nextLayer = networkNodes[l + 1];

      currentLayer.forEach(n1 => {
        nextLayer.forEach(n2 => {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", n1.x);
          line.setAttribute("y1", n1.y);
          line.setAttribute("x2", n2.x);
          line.setAttribute("y2", n2.y);
          const isSynapseActive = n1.active && n2.active;
          line.setAttribute("stroke", isSynapseActive ? "rgba(79, 227, 193, 0.28)" : "rgba(79, 227, 193, 0.06)");
          line.setAttribute("stroke-width", isSynapseActive ? "1.2" : "0.8");
          synapseGroup.appendChild(line);
        });
      });
    }
  }
  buildNeuralNetwork();

  // ——— Simulator 1: Gradient Descent Loss Bowl ———
  const gdCanvas = el.querySelector("#gd-curve-canvas");
  const gdCtx = gdCanvas.getContext("2d");
  const lrSlider = el.querySelector("#slider-lr");
  const lrLabel = el.querySelector("#label-lr");
  const gdStatus = el.querySelector("#gd-status-text");
  const btnGdRoll = el.querySelector("#btn-gd-roll");
  const btnGdReset = el.querySelector("#btn-gd-reset");

  let learningRate = 0.30;
  let ballW = 3.2; // starts at w = 3.2 on curve y = 0.15 * w^2

  function drawGDBowl() {
    const w = gdCanvas.width;
    const h = gdCanvas.height;
    gdCtx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h - 25;

    // Draw bowl curve: J(w) = a * w^2
    gdCtx.beginPath();
    for (let x = 0; x < w; x++) {
      const worldW = (x - cx) / 28;
      const worldJ = 0.12 * (worldW * worldW);
      const py = cy - worldJ * 26;
      if (x === 0) gdCtx.moveTo(x, py);
      else gdCtx.lineTo(x, py);
    }
    gdCtx.strokeStyle = "rgba(79, 227, 193, 0.5)";
    gdCtx.lineWidth = 2;
    gdCtx.stroke();

    // Draw ball position
    const ballX = cx + ballW * 28;
    const ballY = cy - 0.12 * (ballW * ballW) * 26;

    gdCtx.beginPath();
    gdCtx.arc(ballX, ballY, 6, 0, Math.PI * 2);
    gdCtx.fillStyle = "#4FE3C1";
    gdCtx.shadowColor = "#4FE3C1";
    gdCtx.shadowBlur = 8;
    gdCtx.fill();
    gdCtx.shadowBlur = 0;
  }
  drawGDBowl();

  function stepGD() {
    // Gradient of J(w) = 0.12 * w^2 is dJ/dw = 0.24 * w
    const grad = 0.24 * ballW;
    ballW = ballW - learningRate * grad * 8.0;

    if (learningRate > 0.85) {
      gdStatus.textContent = "Overshooting / Diverging!";
      gdStatus.style.color = "#FF7A3D";
    } else if (learningRate < 0.12) {
      gdStatus.textContent = "Slow Crawl / Vanishing Step";
      gdStatus.style.color = "#A7A298";
    } else {
      gdStatus.textContent = "Smooth Optimal Convergence";
      gdStatus.style.color = "#4FE3C1";
    }
    drawGDBowl();
  }

  btnGdRoll.addEventListener("click", stepGD);
  btnGdReset.addEventListener("click", () => {
    ballW = 3.2;
    drawGDBowl();
    gdStatus.textContent = "Reset to Top of Bowl";
    gdStatus.style.color = "#4FE3C1";
  });

  lrSlider.addEventListener("input", (e) => {
    learningRate = parseFloat(e.target.value);
    lrLabel.textContent = `Learning Rate: η = ${learningRate.toFixed(2)}`;
  });

  // ——— Simulator 2: Bias vs Variance ———
  const bvCanvas = el.querySelector("#bv-curve-canvas");
  const bvCtx = bvCanvas.getContext("2d");
  const polySlider = el.querySelector("#slider-poly");
  const polyLabel = el.querySelector("#label-poly-deg");
  const trainLossEl = el.querySelector("#val-train-loss");
  const testLossEl = el.querySelector("#val-test-loss");

  // Fixed sample points with quadratic curve + noise
  const samplePoints = [
    { x: 30, y: 100 }, { x: 60, y: 85 }, { x: 90, y: 68 }, { x: 120, y: 74 },
    { x: 150, y: 55 }, { x: 180, y: 48 }, { x: 210, y: 52 }, { x: 240, y: 42 },
    { x: 270, y: 40 }, { x: 300, y: 35 }, { x: 320, y: 32 }
  ];

  function drawBiasVariance(degree) {
    const w = bvCanvas.width;
    const h = bvCanvas.height;
    bvCtx.clearRect(0, 0, w, h);

    // Draw Scatter Points
    samplePoints.forEach(p => {
      bvCtx.beginPath();
      bvCtx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      bvCtx.fillStyle = "#F3EEE4";
      bvCtx.fill();
    });

    // Draw Fitted Curve according to complexity degree
    bvCtx.beginPath();
    for (let x = 20; x < 330; x += 4) {
      let y = 100 - (x * 0.22); // base degree 1 line
      if (degree === 1) {
        // Underfit straight line
        y = 105 - (x * 0.22);
      } else if (degree <= 4) {
        // Balanced gentle curve
        const norm = (x - 170) / 100;
        y = 52 + (norm * norm) * 28 - norm * 20;
      } else {
        // Overfit wild wiggly curve
        const norm = (x - 170) / 100;
        const wiggle = Math.sin(x * 0.15) * (degree * 4.2);
        y = 52 + (norm * norm) * 28 - norm * 20 + wiggle;
      }

      if (x === 20) bvCtx.moveTo(x, y);
      else bvCtx.lineTo(x, y);
    }
    bvCtx.strokeStyle = degree <= 4 ? "#4FE3C1" : "#FF7A3D";
    bvCtx.lineWidth = 2;
    bvCtx.stroke();

    // Update Metrics
    if (degree === 1) {
      polyLabel.textContent = "Degree 1 (Underfitting / High Bias)";
      polyLabel.style.color = "#FF9A3D";
      trainLossEl.textContent = "0.48";
      trainLossEl.style.color = "#FF9A3D";
      testLossEl.textContent = "0.52";
      testLossEl.style.color = "#FF9A3D";
    } else if (degree <= 4) {
      polyLabel.textContent = `Degree ${degree} (Optimal Sweet Spot)`;
      polyLabel.style.color = "#4FE3C1";
      trainLossEl.textContent = (0.16 - degree * 0.02).toFixed(2);
      trainLossEl.style.color = "#9BC53D";
      testLossEl.textContent = (0.18 - degree * 0.01).toFixed(2);
      testLossEl.style.color = "#9BC53D";
    } else {
      polyLabel.textContent = `Degree ${degree} (Overfitting / High Variance)`;
      polyLabel.style.color = "#FF521B";
      trainLossEl.textContent = (Math.max(0.01, 0.10 - degree * 0.015)).toFixed(2);
      trainLossEl.style.color = "#9BC53D"; // low train
      testLossEl.textContent = (0.25 + (degree - 4) * 0.18).toFixed(2);
      testLossEl.style.color = "#FF7A3D"; // massive test error
    }
  }

  polySlider.addEventListener("input", (e) => {
    drawBiasVariance(parseInt(e.target.value, 10));
  });
  drawBiasVariance(3);

  // ——— Tabs Switcher ———
  const btnTabGd = el.querySelector("#btn-tab-gd");
  const btnTabBv = el.querySelector("#btn-tab-bv");
  const simGd = el.querySelector("#sim-container-gd");
  const simBv = el.querySelector("#sim-container-bv");

  btnTabGd.addEventListener("click", () => {
    activeTab = "gradient";
    btnTabGd.classList.add("active");
    btnTabGd.style.color = "#4FE3C1";
    btnTabGd.style.borderColor = "#4FE3C1";
    btnTabBv.classList.remove("active");
    btnTabBv.style.color = "var(--c-bone-secondary)";
    btnTabBv.style.borderColor = "var(--c-hairline)";
    simGd.style.display = "block";
    simBv.style.display = "none";
    drawGDBowl();
  });

  btnTabBv.addEventListener("click", () => {
    activeTab = "bias_variance";
    btnTabBv.classList.add("active");
    btnTabBv.style.color = "#4FE3C1";
    btnTabBv.style.borderColor = "#4FE3C1";
    btnTabGd.classList.remove("active");
    btnTabGd.style.color = "var(--c-bone-secondary)";
    btnTabGd.style.borderColor = "var(--c-hairline)";
    simGd.style.display = "none";
    simBv.style.display = "block";
    drawBiasVariance(parseInt(polySlider.value, 10));
  });

  // ——— Floating Firefly Ambient Canvas Loop ———
  const canvas = el.querySelector("#firefly-canvas");
  const ctx2d = canvas.getContext("2d");
  let width, height;
  let fireflies = [];
  let pulseTravelers = [];

  function resizeCanvas() {
    width = canvas.width = el.clientWidth;
    height = canvas.height = el.clientHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  for (let i = 0; i < 32; i++) {
    fireflies.push({
      x: Math.random() * 640 + 80,
      y: Math.random() * 400 + 80,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: 1.5 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2
    });
  }

  function render(time) {
    if (isDestroyed) return;
    if (isPaused) {
      animId = requestAnimationFrame(render);
      return;
    }

    ctx2d.clearRect(0, 0, width, height);

    if (!reducedMotion) {
      const t = time * 0.0015;

      // Draw floating firefly lights
      fireflies.forEach(f => {
        f.x += f.vx;
        f.y += f.vy;
        if (f.x < 60 || f.x > 700) f.vx *= -1;
        if (f.y < 60 || f.y > 520) f.vy *= -1;

        const pulse = Math.sin(t * 2 + f.phase);
        const alpha = Math.max(0.15, Math.min(0.9, 0.5 + pulse * 0.4));

        ctx2d.beginPath();
        ctx2d.arc(f.x, f.y, f.size * (1 + pulse * 0.3), 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(79, 227, 193, ${alpha.toFixed(2)})`;
        ctx2d.shadowColor = "#4FE3C1";
        ctx2d.shadowBlur = 8;
        ctx2d.fill();
        ctx2d.shadowBlur = 0;
      });
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
  window.WAYPOINT_SCENES.AI = { mount };
}
