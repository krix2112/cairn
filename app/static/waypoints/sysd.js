/**
 * WAYPOINT 09: SYSD — "The Citadel"
 * Tint: Ice Steel (#BFD3E6) with Signal Amber (#FFB020) accents on Deep Slate (#0B1018)
 * True 30-degree isometric architectural system visualization.
 * Progressive topology unlock by candidate level, dynamic particle flow, scenario builder,
 * traffic stress simulation (heat saturation vs cache relief), node kill failover, and architectural tradeoffs.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let isDestroyed = false;
  let isPaused = false;
  let animId = null;
  let trafficRps = 25; // 1 to 100
  let isNodeKilled = false;
  let activeScenario = "url_shortener"; // "url_shortener" | "notifications" | "file_storage"

  const candLvl = Math.min(10, Math.max(0, ctx.level ?? 6));
  const reqLvl = Math.min(10, Math.max(0, ctx.required ?? 8));

  // Topology unlock tiers
  const hasLB = candLvl >= 4;
  const numServers = candLvl >= 7 ? 3 : (candLvl >= 4 ? 2 : 1);
  const hasCache = candLvl >= 5;
  const hasReplica = candLvl >= 6;
  const hasQueue = candLvl >= 8;
  const hasWorkers = candLvl >= 9;

  const SCENARIOS = {
    url_shortener: {
      name: "URL Shortener (e.g. TinyURL)",
      flow: "Clients → Edge LB → App Servers → Redis Cache (Read Heavy 100:1) → Sharded DB Primary/Replica",
      desc: "High read-to-write ratio (100:1). Hash collisions handled via Base62 encoding. Redis LRU cache absorbs 98% of redirect requests.",
      critical: ["lb", "app1", "cache", "db_primary"]
    },
    notifications: {
      name: "Notification Engine (e.g. Push/SMS)",
      flow: "Clients → API Gateway → Fanout Message Queue → Async Worker Pool → Third-Party Gateway",
      desc: "Write-heavy burst traffic. Decoupled using Kafka/RabbitMQ partitions to prevent downstream rate-limiting from blocking user requests.",
      critical: ["lb", "app1", "queue", "workers"]
    },
    file_storage: {
      name: "Distributed File Vault (e.g. Drive)",
      flow: "Clients → CloudFront CDN → Metadata Store (DB) + Direct Multipart S3 Object Upload",
      desc: "Separates control plane (metadata DB) from data plane (blob storage). Pre-signed URLs bypass app servers for petabyte-scale throughput.",
      critical: ["lb", "app1", "db_primary", "db_replica"]
    }
  };

  el.style.backgroundColor = "#0B1018";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.style.color = "#BFD3E6";
  el.style.fontFamily = "var(--font-mono, monospace)";

  el.innerHTML = `
    <div class="citadel-stage" style="position: absolute; inset: 0; display: flex; flex-direction: column; padding: 22px 26px 16px; box-sizing: border-box; overflow-y: auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; position: relative; z-index: 2; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #BFD3E6; box-shadow: 0 0 10px #BFD3E6;"></span>
            <span style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #BFD3E6; font-weight: 600;">The Citadel · Distributed Architecture</span>
          </div>
          <p style="margin: 4px 0 0; font-size: 13px; color: #7B8E9F;">
            Isometric distributed consensus. Topology scale follows level (${candLvl}/10). Benchmarked requirement: ${reqLvl}/10.
          </p>
        </div>

        <!-- Controls: Traffic slider & Kill Node -->
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px; background: rgba(191,211,230,0.06); border: 1px solid rgba(191,211,230,0.2); padding: 5px 12px; border-radius: 4px; font-size: 11px;">
            <span>Traffic:</span>
            <input type="range" id="sysd-traffic-slider" min="5" max="100" value="${trafficRps}" style="width: 90px; accent-color: #FFB020; cursor: pointer;" />
            <span id="sysd-traffic-val" style="color: #FFB020; font-weight: 600; min-width: 45px;">${trafficRps}k/s</span>
          </div>

          <button id="sysd-btn-kill" style="font-family: inherit; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: 1px solid #E5646B; background: rgba(229,100,107,0.12); color: #E5646B; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <span>${isNodeKilled ? "Restore App Server" : "Kill App Node 1"}</span>
          </button>
        </div>
      </div>

      <!-- Isometric SVG Scene + Canvas Particles Overlay -->
      <div style="position: relative; flex: 1; min-height: 250px; background: radial-gradient(circle at 50% 40%, rgba(191,211,230,0.05) 0%, rgba(11,16,24,0.95) 75%); border: 1px solid rgba(191,211,230,0.15); border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
        <svg id="citadel-svg" viewBox="0 0 960 440" style="width: 100%; height: 100%; display: block;" preserveAspectRatio="xMidYMid meet">
          <defs>
            <!-- Isometric Grid and Gradients -->
            <linearGradient id="iso-card-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#182333" />
              <stop offset="100%" stop-color="#0E1724" />
            </linearGradient>
            <linearGradient id="iso-card-heat" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#3D181A" />
              <stop offset="100%" stop-color="#1F0D0E" />
            </linearGradient>
            <linearGradient id="ghost-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="rgba(191,211,230,0.02)" />
              <stop offset="100%" stop-color="rgba(191,211,230,0.0)" />
            </linearGradient>
          </defs>

          <!-- System Network Connector Lines -->
          <g id="citadel-links" stroke="rgba(191,211,230,0.2)" stroke-width="1.5" stroke-dasharray="4,4">
            <!-- Client to LB -->
            <path d="M 120 220 L 250 220" />
            <!-- LB to App Servers -->
            <path d="M 290 220 L 410 140" />
            <path d="M 290 220 L 410 220" />
            <path d="M 290 220 L 410 300" />
            <!-- App Servers to Cache / DB -->
            <path d="M 470 140 L 600 140" />
            <path d="M 470 220 L 600 220" />
            <path d="M 470 300 L 600 300" />
            <!-- DB Primary to Replica -->
            <path d="M 660 220 L 780 220" />
            <!-- Queue to Workers -->
            <path d="M 660 300 L 780 300" />
          </g>

          <!-- 1. Clients Group -->
          <g class="citadel-node" transform="translate(60, 180)">
            <rect width="70" height="75" rx="6" fill="url(#iso-card-fill)" stroke="#BFD3E6" stroke-width="1.2" />
            <text x="35" y="28" font-size="11" fill="#BFD3E6" text-anchor="middle" font-weight="700">CLIENTS</text>
            <text x="35" y="46" font-size="9" fill="#7B8E9F" text-anchor="middle">Web / Mobile</text>
            <circle cx="35" cy="60" r="4" fill="#9BC53D" />
          </g>

          <!-- 2. Load Balancer (Unlocked at lvl 4) -->
          <g class="citadel-node" id="node-lb" transform="translate(230, 180)" opacity="${hasLB ? '1' : '0.4'}">
            <rect width="75" height="75" rx="6" fill="url(#iso-card-fill)" stroke="${hasLB ? '#BFD3E6' : 'rgba(191,211,230,0.3)'}" stroke-dasharray="${hasLB ? 'none' : '4,4'}" stroke-width="1.2" />
            <text x="37" y="26" font-size="10.5" fill="#BFD3E6" text-anchor="middle" font-weight="700">NGINX LB</text>
            <text x="37" y="44" font-size="8.5" fill="#7B8E9F" text-anchor="middle">Round Robin</text>
            <text x="37" y="60" font-size="8.5" fill="${hasLB ? '#9BC53D' : '#FFB020'}" text-anchor="middle">${hasLB ? 'Active (L4/L7)' : 'Ghost (Req: L4)'}</text>
          </g>

          <!-- 3. App Servers (1 to 3) -->
          <!-- Server 1 -->
          <g class="citadel-node" id="node-app1" transform="translate(390, 105)">
            <rect id="rect-app1" width="85" height="65" rx="6" fill="url(#iso-card-fill)" stroke="#BFD3E6" stroke-width="1.2" />
            <text x="42" y="24" font-size="10.5" fill="#BFD3E6" text-anchor="middle" font-weight="700">APP POD 1</text>
            <text x="42" y="40" font-size="8.5" fill="#7B8E9F" text-anchor="middle">Node/Go API</text>
            <text id="status-app1" x="42" y="54" font-size="8" fill="#9BC53D" text-anchor="middle">Online · 20ms</text>
          </g>
          <!-- Server 2 -->
          <g class="citadel-node" id="node-app2" transform="translate(390, 185)" opacity="${numServers >= 2 ? '1' : '0.35'}">
            <rect width="85" height="65" rx="6" fill="url(#iso-card-fill)" stroke="${numServers >= 2 ? '#BFD3E6' : 'rgba(191,211,230,0.3)'}" stroke-dasharray="${numServers >= 2 ? 'none' : '4,4'}" stroke-width="1.2" />
            <text x="42" y="24" font-size="10.5" fill="#BFD3E6" text-anchor="middle" font-weight="700">APP POD 2</text>
            <text x="42" y="40" font-size="8.5" fill="#7B8E9F" text-anchor="middle">Node/Go API</text>
            <text x="42" y="54" font-size="8" fill="${numServers >= 2 ? '#9BC53D' : '#FFB020'}" text-anchor="middle">${numServers >= 2 ? 'Online' : 'Ghost (Req: L4)'}</text>
          </g>
          <!-- Server 3 -->
          <g class="citadel-node" id="node-app3" transform="translate(390, 265)" opacity="${numServers >= 3 ? '1' : '0.35'}">
            <rect width="85" height="65" rx="6" fill="url(#iso-card-fill)" stroke="${numServers >= 3 ? '#BFD3E6' : 'rgba(191,211,230,0.3)'}" stroke-dasharray="${numServers >= 3 ? 'none' : '4,4'}" stroke-width="1.2" />
            <text x="42" y="24" font-size="10.5" fill="#BFD3E6" text-anchor="middle" font-weight="700">APP POD 3</text>
            <text x="42" y="40" font-size="8.5" fill="#7B8E9F" text-anchor="middle">Node/Go API</text>
            <text x="42" y="54" font-size="8" fill="${numServers >= 3 ? '#9BC53D' : '#FFB020'}" text-anchor="middle">${numServers >= 3 ? 'Online' : 'Ghost (Req: L7)'}</text>
          </g>

          <!-- 4. Distributed Cache (Redis) -->
          <g class="citadel-node" id="node-cache" transform="translate(580, 105)" opacity="${hasCache ? '1' : '0.35'}">
            <rect width="90" height="65" rx="6" fill="url(#iso-card-fill)" stroke="${hasCache ? '#FFB020' : 'rgba(191,211,230,0.3)'}" stroke-dasharray="${hasCache ? 'none' : '4,4'}" stroke-width="1.2" />
            <text x="45" y="24" font-size="10.5" fill="#FFB020" text-anchor="middle" font-weight="700">REDIS CACHE</text>
            <text x="45" y="40" font-size="8.5" fill="#7B8E9F" text-anchor="middle">LRU Eviction</text>
            <text x="45" y="54" font-size="8" fill="${hasCache ? '#9BC53D' : '#FFB020'}" text-anchor="middle">${hasCache ? '96% Hit Ratio' : 'Ghost (Req: L5)'}</text>
          </g>

          <!-- 5. Database Primary -->
          <g class="citadel-node" id="node-db-primary" transform="translate(580, 185)">
            <rect width="90" height="65" rx="6" fill="url(#iso-card-fill)" stroke="#BFD3E6" stroke-width="1.2" />
            <text x="45" y="24" font-size="10.5" fill="#BFD3E6" text-anchor="middle" font-weight="700">DB PRIMARY</text>
            <text x="45" y="40" font-size="8.5" fill="#7B8E9F" text-anchor="middle">ACID Writes</text>
            <text x="45" y="54" font-size="8" fill="#9BC53D" text-anchor="middle">Write Leader</text>
          </g>

          <!-- 6. Database Read Replica -->
          <g class="citadel-node" id="node-db-replica" transform="translate(760, 185)" opacity="${hasReplica ? '1' : '0.35'}">
            <rect width="90" height="65" rx="6" fill="url(#iso-card-fill)" stroke="${hasReplica ? '#BFD3E6' : 'rgba(191,211,230,0.3)'}" stroke-dasharray="${hasReplica ? 'none' : '4,4'}" stroke-width="1.2" />
            <text x="45" y="24" font-size="10.5" fill="#BFD3E6" text-anchor="middle" font-weight="700">READ REPLICA</text>
            <text x="45" y="40" font-size="8.5" fill="#7B8E9F" text-anchor="middle">Binlog Sync</text>
            <text x="45" y="54" font-size="8" fill="${hasReplica ? '#9BC53D' : '#FFB020'}" text-anchor="middle">${hasReplica ? 'Async Read Pool' : 'Ghost (Req: L6)'}</text>
          </g>

          <!-- 7. Message Queue -->
          <g class="citadel-node" id="node-queue" transform="translate(580, 265)" opacity="${hasQueue ? '1' : '0.35'}">
            <rect width="90" height="65" rx="6" fill="url(#iso-card-fill)" stroke="${hasQueue ? '#BFD3E6' : 'rgba(191,211,230,0.3)'}" stroke-dasharray="${hasQueue ? 'none' : '4,4'}" stroke-width="1.2" />
            <text x="45" y="24" font-size="10.5" fill="#BFD3E6" text-anchor="middle" font-weight="700">KAFKA QUEUE</text>
            <text x="45" y="40" font-size="8.5" fill="#7B8E9F" text-anchor="middle">Log Partitions</text>
            <text x="45" y="54" font-size="8" fill="${hasQueue ? '#9BC53D' : '#FFB020'}" text-anchor="middle">${hasQueue ? 'Buffered' : 'Ghost (Req: L8)'}</text>
          </g>

          <!-- 8. Background Workers -->
          <g class="citadel-node" id="node-workers" transform="translate(760, 265)" opacity="${hasWorkers ? '1' : '0.35'}">
            <rect width="90" height="65" rx="6" fill="url(#iso-card-fill)" stroke="${hasWorkers ? '#BFD3E6' : 'rgba(191,211,230,0.3)'}" stroke-dasharray="${hasWorkers ? 'none' : '4,4'}" stroke-width="1.2" />
            <text x="45" y="24" font-size="10.5" fill="#BFD3E6" text-anchor="middle" font-weight="700">WORKERS</text>
            <text x="45" y="40" font-size="8.5" fill="#7B8E9F" text-anchor="middle">Async Processing</text>
            <text x="45" y="54" font-size="8" fill="${hasWorkers ? '#9BC53D' : '#FFB020'}" text-anchor="middle">${hasWorkers ? 'Autoscaled' : 'Ghost (Req: L9)'}</text>
          </g>
        </svg>

        <!-- Canvas for Dynamic Traffic Particles -->
        <canvas id="citadel-particles-canvas" style="position: absolute; inset: 0; pointer-events: none; width: 100%; height: 100%;"></canvas>

        <!-- Dynamic Failover / Outage Alert Overlay -->
        <div id="citadel-alert-banner" style="display: none; position: absolute; bottom: 12px; left: 16px; right: 16px; padding: 8px 14px; border-radius: 4px; font-size: 11px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.6);"></div>
      </div>

      <!-- Scenario Selector -->
      <div style="background: rgba(18,25,36,0.6); border: 1px solid rgba(191,211,230,0.18); border-radius: 6px; padding: 10px 14px; margin-bottom: 12px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
          ${Object.entries(SCENARIOS).map(([k, s], idx) => `
            <button class="sysd-scenario-btn ${k === activeScenario ? "active" : ""}" data-key="${k}" style="font-family: inherit; font-size: 11px; padding: 4px 10px; border-radius: 4px; border: 1px solid ${k === activeScenario ? "#BFD3E6" : "rgba(191,211,230,0.2)"}; background: ${k === activeScenario ? "rgba(191,211,230,0.15)" : "transparent"}; color: ${k === activeScenario ? "#F3EEE4" : "#7B8E9F"}; cursor: pointer; transition: all 0.2s ease;">
              ${s.name}
            </button>
          `).join("")}
        </div>
        <p id="scenario-flow-text" style="margin: 0 0 4px; font-size: 11.5px; color: #FFB020; font-weight: 500;"></p>
        <p id="scenario-desc-text" style="margin: 0; font-size: 11px; color: #7B8E9F;"></p>
      </div>

      <!-- 3 Architectural Tradeoffs Callouts -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
        <div style="padding: 8px 12px; border-radius: 4px; background: rgba(191,211,230,0.04); border: 1px solid rgba(191,211,230,0.12); font-size: 10.5px;">
          <strong style="color: #BFD3E6;">CAP Invariants:</strong> Under network partitions, CP architectures prioritize exact consistency by rejecting writes; AP architectures sustain 100% availability with eventual consistency.
        </div>
        <div style="padding: 8px 12px; border-radius: 4px; background: rgba(191,211,230,0.04); border: 1px solid rgba(191,211,230,0.12); font-size: 10.5px;">
          <strong style="color: #FFB020;">Cache Invalidation:</strong> Cache-Aside works well for read-heavy workloads; Write-Through maintains consistency but adds latency; Write-Behind buffers writes for peak database protection.
        </div>
        <div style="padding: 8px 12px; border-radius: 4px; background: rgba(191,211,230,0.04); border: 1px solid rgba(191,211,230,0.12); font-size: 10.5px;">
          <strong style="color: #9BC53D;">Scale Boundaries:</strong> Vertical scaling hits memory and socket ceilings; horizontal scaling demands stateless app tiers, sticky sessions at LB, and distributed caching.
        </div>
      </div>
    </div>
  `;

  // Dynamic Particles Canvas
  const canvas = el.querySelector("#citadel-particles-canvas");
  const ctx2d = canvas ? canvas.getContext("2d") : null;
  let particles = [];

  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement || el;
    canvas.width = parent ? parent.clientWidth || 800 : 800;
    canvas.height = parent ? parent.clientHeight || 400 : 400;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function spawnParticle() {
    if (particles.length > trafficRps * 1.5) return;
    const paths = [
      [{x: 120, y: 220}, {x: 250, y: 220}, {x: 410, y: isNodeKilled ? 220 : 140}, {x: 600, y: hasCache ? 140 : 220}],
      [{x: 120, y: 220}, {x: 250, y: 220}, {x: 410, y: 220}, {x: 600, y: 220}, {x: 780, y: 220}]
    ];
    const path = paths[Math.floor(Math.random() * paths.length)];
    particles.push({
      path,
      step: 0,
      t: 0,
      speed: 0.015 + (trafficRps / 100) * 0.035,
      color: trafficRps > 75 ? "#FF9A3D" : "#BFD3E6"
    });
  }

  function updateScenario(key) {
    activeScenario = key;
    const s = SCENARIOS[key];
    const flowEl = el.querySelector("#scenario-flow-text");
    const descEl = el.querySelector("#scenario-desc-text");
    if (flowEl) flowEl.textContent = s.flow;
    if (descEl) descEl.textContent = s.desc;
  }
  updateScenario("url_shortener");

  // Interaction: Scenario Switcher
  const scnBtns = el.querySelectorAll(".sysd-scenario-btn");
  scnBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      scnBtns.forEach(b => {
        b.style.background = "transparent";
        b.style.borderColor = "rgba(191,211,230,0.2)";
        b.style.color = "#7B8E9F";
      });
      btn.style.background = "rgba(191,211,230,0.15)";
      btn.style.borderColor = "#BFD3E6";
      btn.style.color = "#F3EEE4";
      updateScenario(btn.getAttribute("data-key"));
    });
  });

  // Interaction: Traffic Slider
  const slider = el.querySelector("#sysd-traffic-slider");
  const valLabel = el.querySelector("#sysd-traffic-val");
  const rectApp1 = el.querySelector("#rect-app1");
  const statusApp1 = el.querySelector("#status-app1");

  function updateTrafficState() {
    if (valLabel) valLabel.textContent = `${trafficRps}k/s`;

    // Overload single server if traffic high and no LB / cache
    if (trafficRps > 65 && (!hasLB || numServers === 1)) {
      if (rectApp1) {
        rectApp1.setAttribute("stroke", "#E5646B");
        rectApp1.setAttribute("fill", "url(#iso-card-heat)");
      }
      if (statusApp1) {
        statusApp1.textContent = "High Load · 880ms (P99)";
        statusApp1.setAttribute("fill", "#E5646B");
      }
    } else {
      if (rectApp1 && !isNodeKilled) {
        rectApp1.setAttribute("stroke", "#BFD3E6");
        rectApp1.setAttribute("fill", "url(#iso-card-fill)");
      }
      if (statusApp1 && !isNodeKilled) {
        statusApp1.textContent = `Online · ${Math.max(12, Math.round(50 - (candLvl * 3)))}ms`;
        statusApp1.setAttribute("fill", "#9BC53D");
      }
    }
  }

  if (slider) {
    slider.addEventListener("input", (e) => {
      trafficRps = parseInt(e.target.value, 10);
      updateTrafficState();
    });
  }

  // Interaction: Kill a Node
  const btnKill = el.querySelector("#btn-kill");
  const alertBanner = el.querySelector("#citadel-alert-banner");

  if (btnKill) {
    btnKill.addEventListener("click", () => {
      isNodeKilled = !isNodeKilled;
      btnKill.innerHTML = `<span>${isNodeKilled ? "Restore App Server" : "Kill App Node 1"}</span>`;

      if (isNodeKilled) {
        if (rectApp1) {
          rectApp1.setAttribute("stroke", "#E5646B");
          rectApp1.setAttribute("fill", "#2D1012");
        }
        if (statusApp1) {
          statusApp1.textContent = "TERMINATED (0 RPS)";
          statusApp1.setAttribute("fill", "#E5646B");
        }

        if (alertBanner) {
          alertBanner.style.display = "block";
          if (numServers > 1 && hasLB) {
            alertBanner.style.background = "rgba(155, 197, 61, 0.15)";
            alertBanner.style.border = "1px solid #9BC53D";
            alertBanner.style.color = "#9BC53D";
            alertBanner.textContent = "FAILOVER SUCCESS: NGINX LB detected App Pod 1 failure. Health check redirected 100% of ingress to redundant App Pods with zero dropped connections.";
          } else {
            alertBanner.style.background = "rgba(229, 100, 107, 0.2)";
            alertBanner.style.border = "1px solid #E5646B";
            alertBanner.style.color = "#E5646B";
            alertBanner.textContent = "OUTAGE WARNING: Single Point of Failure (SPOF) triggered. No redundant pods or load balancer provisioned at candidate level. 502 Bad Gateway.";
          }
        }
      } else {
        if (alertBanner) alertBanner.style.display = "none";
        updateTrafficState();
      }
    });
  }

  // Animation Loop for Traffic
  function render() {
    if (isDestroyed) return;
    if (!isPaused && ctx2d && !reducedMotion) {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      const wScale = canvas.width / 960;
      const hScale = canvas.height / 440;

      if (Math.random() < 0.25) spawnParticle();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.t += p.speed;
        if (p.t >= 1) {
          p.t = 0;
          p.step++;
          if (p.step >= p.path.length - 1) {
            particles.splice(i, 1);
            continue;
          }
        }

        const p1 = p.path[p.step];
        const p2 = p.path[p.step + 1];
        const cx = (p1.x + (p2.x - p1.x) * p.t) * wScale;
        const cy = (p1.y + (p2.y - p1.y) * p.t) * hScale;

        ctx2d.beginPath();
        ctx2d.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx2d.fillStyle = p.color;
        ctx2d.shadowColor = p.color;
        ctx2d.shadowBlur = 6;
        ctx2d.fill();
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
      if (animId) cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", resizeCanvas);
    }
  };
}

if (typeof window !== "undefined") {
  window.WAYPOINT_SCENES = window.WAYPOINT_SCENES || {};
  window.WAYPOINT_SCENES.SYSD = { mount };
}
