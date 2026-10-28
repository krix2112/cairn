/**
 * WAYPOINT 08: CLOUD — "The Skyway"
 * Tint: Peach (#FFB59A) and Sky (#8FD0FF) on Twilight Gradient (#0E1A33 to #2A3F66)
 * Floating cloud topology with luminous rail ships, container layer build animation,
 * horizontal pod autoscaling, rollback recovery, regional failover, and cloud concept primitives.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let isDestroyed = false;
  let isPaused = false;
  let animId = null;
  let podCount = 3;
  let isDeploying = false;
  let deployTimer = null;
  let isRollback = false;
  let isRegionFailed = false;

  const candLvl = Math.min(10, Math.max(0, ctx.level ?? 6));
  const reqLvl = Math.min(10, Math.max(0, ctx.required ?? 8));

  // Determine Cloud provider mentions from JD / evidence
  const allText = ((ctx.jdSkills || []).join(" ") + " " + (ctx.evidence || []).join(" ")).toLowerCase();
  const provider = allText.includes("azure") ? "Azure (AKS / ACR)" : (allText.includes("aws") ? "AWS (EKS / ECR)" : "Cloud Native (K8s / OCI)");

  const ISLANDS = [
    { id: "source", name: "1. Source Repo", role: "Git Hooks & Triggers", unlock: 1, icon: "⌨" },
    { id: "build", name: "2. Build Runner", role: "Layered OCI Compiler", unlock: 3, icon: "⚙" },
    { id: "registry", name: "3. Container Registry", role: "Immutable Digest Store", unlock: 5, icon: "⎈" },
    { id: "cluster", name: "4. Kube Cluster", role: "Reconciled Pod Pool", unlock: 7, icon: "☁" },
    { id: "edge", name: "5. Edge Ingress", role: "Anycast & TLS Gateway", unlock: 9, icon: "⚡" }
  ];

  const CONCEPTS = [
    { name: "Container", def: "Isolated userspace process sharing the host kernel via cgroups and namespaces." },
    { name: "Image", def: "Read-only layered root filesystem configured with OCI execution manifest." },
    { name: "Orchestrator", def: "Declarative control plane reconciling desired vs observed pod state across nodes." },
    { name: "Load Balancer", def: "L4/L7 ingress distributing network sessions across healthy container endpoints." },
    { name: "CI/CD", def: "Automated test, build, artifact signing, and canary deployment delivery pipeline." },
    { name: "Observability", def: "Distributed metrics, structured logs, and OpenTelemetry trace propagation." }
  ];

  el.style.backgroundColor = "#0E1A33";
  el.style.background = "linear-gradient(180deg, #0E1A33 0%, #1A284A 50%, #2A3F66 100%)";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.style.color = "#8FD0FF";
  el.style.fontFamily = "var(--font-mono, monospace)";

  el.innerHTML = `
    <div class="skyway-stage" style="position: absolute; inset: 0; display: flex; flex-direction: column; padding: 22px 26px 16px; box-sizing: border-box; overflow-y: auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; position: relative; z-index: 2; flex-wrap: wrap; gap: 8px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #FFB59A; box-shadow: 0 0 10px #FFB59A;"></span>
            <span style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #FFB59A; font-weight: 600;">The Skyway · Container Infrastructure</span>
            <span style="font-size: 10px; background: rgba(143,208,255,0.15); border: 1px solid rgba(143,208,255,0.3); padding: 2px 7px; border-radius: 3px; color: #8FD0FF;">${provider}</span>
          </div>
          <p style="margin: 4px 0 0; font-size: 13px; color: #C4D7ED;">
            Floating CI/CD and cluster topology. Unlocked islands follow candidate level (${candLvl}/10). Requirement: ${reqLvl}/10.
          </p>
        </div>

        <!-- Action Controls -->
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <button id="btn-cloud-deploy" style="font-family: inherit; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: 1px solid #FFB59A; background: rgba(255,181,154,0.18); color: #FFB59A; font-weight: 700; cursor: pointer;">
            Deploy v2.4
          </button>
          <button id="btn-cloud-rollback" style="font-family: inherit; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: 1px solid rgba(143,208,255,0.3); background: rgba(14,26,51,0.6); color: #8FD0FF; cursor: pointer;">
            Roll Back
          </button>
          <button id="btn-cloud-failover" style="font-family: inherit; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: 1px solid #E5646B; background: rgba(229,100,107,0.12); color: #E5646B; cursor: pointer;">
            Region Failure
          </button>
          <div style="display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(143,208,255,0.2); padding: 4px 10px; border-radius: 4px; font-size: 11px;">
            <span>Scale:</span>
            <input type="range" id="cloud-scale-slider" min="1" max="8" value="${podCount}" style="width: 70px; accent-color: #8FD0FF; cursor: pointer;" />
            <span id="cloud-pod-count" style="color: #FFB59A; font-weight: 600;">${podCount} Pods</span>
          </div>
        </div>
      </div>

      <!-- Cloud Archipelago Stage & Luminous Rails -->
      <div style="position: relative; flex: 1; min-height: 240px; border: 1px solid rgba(143,208,255,0.15); border-radius: 6px; overflow: hidden; margin-bottom: 12px; background: radial-gradient(circle at 50% 20%, rgba(143,208,255,0.08) 0%, transparent 60%);">
        <!-- Canvas for Luminous Rail Ships & Pod Particles -->
        <canvas id="skyway-canvas" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;"></canvas>

        <!-- Floating Cloud Islands Row -->
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-around; padding: 10px 20px; box-sizing: border-box; z-index: 5;">
          ${ISLANDS.map(isl => {
            const isUnlocked = candLvl >= isl.unlock;
            const isGhost = reqLvl >= isl.unlock && !isUnlocked;
            return `
              <div class="sky-island" id="island-${isl.id}" style="width: 140px; padding: 12px 10px; border-radius: 8px; background: ${isUnlocked ? 'rgba(14,26,51,0.85)' : 'rgba(14,26,51,0.35)'}; border: 1px ${isGhost ? 'dashed #FFB59A' : 'solid ' + (isUnlocked ? '#8FD0FF' : 'rgba(143,208,255,0.25)')}; box-shadow: ${isUnlocked ? '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none'}; opacity: ${isUnlocked ? '1' : '0.4'}; text-align: center; transition: all 0.3s ease;">
                <div style="font-size: 16px; margin-bottom: 4px;">${isl.icon}</div>
                <div style="font-size: 11px; font-weight: 700; color: ${isUnlocked ? '#FFB59A' : '#7B8E9F'};">${isl.name}</div>
                <div style="font-size: 9.5px; color: #8FD0FF; margin-top: 2px;">${isl.role}</div>
                <div style="font-size: 9px; margin-top: 6px; padding: 2px 4px; border-radius: 3px; background: rgba(0,0,0,0.3); color: ${isUnlocked ? '#9BC53D' : '#FFB59A'};">
                  ${isUnlocked ? 'Online' : 'Req: L' + isl.unlock}
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <!-- Layer Stacking Build Drawer (Active during Deploy) -->
        <div id="docker-build-drawer" style="position: absolute; bottom: 12px; left: 16px; background: rgba(10,18,34,0.95); border: 1px solid #FFB59A; border-radius: 6px; padding: 10px 14px; font-size: 10.5px; max-width: 320px; display: none; z-index: 20; box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #FFB59A; font-weight: 700;">OCI Container Build:</span>
            <span id="docker-build-step" style="color: #9BC53D;">Layer 1/4</span>
          </div>
          <div id="docker-layers-list" style="display: flex; flex-direction: column; gap: 4px;"></div>
        </div>

        <!-- Regional Outage Banner -->
        <div id="cloud-failover-alert" style="display: none; position: absolute; top: 12px; left: 20px; right: 20px; padding: 8px 12px; border-radius: 4px; background: rgba(229,100,107,0.25); border: 1px solid #E5646B; color: #F3EEE4; font-size: 11px; font-weight: 600; text-align: center; z-index: 30;">
          Region us-east-1 disconnected. Traffic automatically rerouted to us-west-2 cluster via DNS Anycast health checks.
        </div>
      </div>

      <!-- Cloud Concept Strip (6 Chips) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px;">
        ${CONCEPTS.map(c => `
          <div style="padding: 7px 10px; border-radius: 4px; background: rgba(14,26,51,0.6); border: 1px solid rgba(143,208,255,0.18); font-size: 10px;">
            <strong style="color: #FFB59A; display: block; margin-bottom: 2px;">${c.name}</strong>
            <span style="color: #8FD0FF; line-height: 1.3;">${c.def}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  // Canvas Rail Ships & Pod Trajectory Animation
  const canvas = el.querySelector("#skyway-canvas");
  const ctx2d = canvas ? canvas.getContext("2d") : null;
  let ships = [];

  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement || el;
    canvas.width = parent ? parent.clientWidth || 800 : 800;
    canvas.height = parent ? parent.clientHeight || 400 : 400;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function spawnShip() {
    if (ships.length >= 6) return;
    ships.push({
      x: 40,
      y: canvas.height * 0.5 + (Math.random() - 0.5) * 40,
      speed: 1.2 + Math.random() * 0.8,
      size: 12,
      color: "#FFB59A"
    });
  }

  // Interaction: Deploy Animation
  const btnDeploy = el.querySelector("#btn-cloud-deploy");
  const buildDrawer = el.querySelector("#docker-build-drawer");
  const stepLabel = el.querySelector("#docker-build-step");
  const layersList = el.querySelector("#docker-layers-list");

  const DOCKER_STEPS = [
    { text: "FROM alpine:3.19 (Base OS layer)", time: 400 },
    { text: "COPY ./bin/server /app/server (Binary layer)", time: 900 },
    { text: "RUN chmod +x /app/server (Permissions)", time: 1400 },
    { text: "ENTRYPOINT [\"/app/server\"] (Image digest signed)", time: 2000 }
  ];

  if (btnDeploy) {
    btnDeploy.addEventListener("click", () => {
      if (isDeploying) return;
      isDeploying = true;
      btnDeploy.textContent = "Building...";
      btnDeploy.style.borderColor = "#9BC53D";
      btnDeploy.style.color = "#9BC53D";

      if (buildDrawer) {
        buildDrawer.style.display = "block";
        if (layersList) layersList.innerHTML = "";
      }

      DOCKER_STEPS.forEach((s, idx) => {
        setTimeout(() => {
          if (isDestroyed) return;
          if (stepLabel) stepLabel.textContent = `Layer ${idx + 1}/4`;
          if (layersList) {
            const div = document.createElement("div");
            div.style.color = "#8FD0FF";
            div.textContent = `✔ ${s.text}`;
            layersList.appendChild(div);
          }
          // Launch ship on completion
          if (idx === DOCKER_STEPS.length - 1) {
            spawnShip();
            setTimeout(() => {
              if (isDestroyed) return;
              isDeploying = false;
              btnDeploy.textContent = "Deploy v2.4";
              btnDeploy.style.borderColor = "#FFB59A";
              btnDeploy.style.color = "#FFB59A";
              if (buildDrawer) buildDrawer.style.display = "none";
            }, 1200);
          }
        }, s.time);
      });
    });
  }

  // Rollback button
  const btnRollback = el.querySelector("#btn-cloud-rollback");
  if (btnRollback) {
    btnRollback.addEventListener("click", () => {
      isRollback = !isRollback;
      btnRollback.textContent = isRollback ? "Rollback Active (v2.3)" : "Roll Back";
      btnRollback.style.borderColor = isRollback ? "#FFB020" : "rgba(143,208,255,0.3)";
      btnRollback.style.color = isRollback ? "#FFB020" : "#8FD0FF";
    });
  }

  // Region failover button
  const btnFailover = el.querySelector("#btn-cloud-failover");
  const failAlert = el.querySelector("#cloud-failover-alert");
  const edgeIsland = el.querySelector("#island-edge");

  if (btnFailover) {
    btnFailover.addEventListener("click", () => {
      isRegionFailed = !isRegionFailed;
      btnFailover.textContent = isRegionFailed ? "Restore Region" : "Region Failure";
      if (failAlert) failAlert.style.display = isRegionFailed ? "block" : "none";
      if (edgeIsland) {
        edgeIsland.style.opacity = isRegionFailed ? "0.3" : "1";
        edgeIsland.style.borderColor = isRegionFailed ? "#E5646B" : "#8FD0FF";
      }
    });
  }

  // Scale slider
  const scaleSlider = el.querySelector("#cloud-scale-slider");
  const podCountLabel = el.querySelector("#cloud-pod-count");
  if (scaleSlider) {
    scaleSlider.addEventListener("input", (e) => {
      podCount = parseInt(e.target.value, 10);
      if (podCountLabel) podCountLabel.textContent = `${podCount} Pods`;
    });
  }

  // Render Loop
  function render() {
    if (isDestroyed) return;
    if (!isPaused && ctx2d && !reducedMotion) {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);

      if (Math.random() < 0.02) spawnShip();

      // Draw horizontal luminous connection rails
      ctx2d.beginPath();
      ctx2d.moveTo(40, canvas.height * 0.5);
      ctx2d.lineTo(canvas.width - 40, canvas.height * 0.5);
      ctx2d.strokeStyle = "rgba(143, 208, 255, 0.25)";
      ctx2d.lineWidth = 1.5;
      ctx2d.setLineDash([6, 6]);
      ctx2d.stroke();
      ctx2d.setLineDash([]);

      // Update & Draw container ships
      for (let i = ships.length - 1; i >= 0; i--) {
        const s = ships[i];
        s.x += s.speed;
        if (s.x > canvas.width) {
          ships.splice(i, 1);
          continue;
        }

        ctx2d.fillStyle = s.color;
        ctx2d.fillRect(s.x, s.y - 6, s.size, 12);
        ctx2d.shadowColor = s.color;
        ctx2d.shadowBlur = 8;
        ctx2d.strokeRect(s.x, s.y - 6, s.size, 12);
        ctx2d.shadowBlur = 0;
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
      if (deployTimer) clearTimeout(deployTimer);
      if (animId) cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", resizeCanvas);
    }
  };
}

if (typeof window !== "undefined") {
  window.WAYPOINT_SCENES = window.WAYPOINT_SCENES || {};
  window.WAYPOINT_SCENES.CLOUD = { mount };
}
