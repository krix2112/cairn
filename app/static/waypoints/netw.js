/**
 * WAYPOINT 02: NETW — "The Signal Tower"
 * Tint: Phosphor Green (#6BFF9E) on Black (#05100A) with CRT scanline raster
 * Lighthouse signal tower scanning 8 network topology nodes (Client, DNS, CDN, Router, Firewall, LB, Origin, DB).
 * Packet inspector with TCP 3-way handshake (SYN, SYN-ACK, ACK), TLS negotiation,
 * step-through timeline, packet loss exponential backoff, latency stretching, TCP vs UDP comparison, and network glossary.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let isDestroyed = false;
  let isPaused = false;
  let animId = null;
  let packetLossPct = 0; // 0 to 50%
  let linkLatencyMs = 25; // 5 to 200ms
  let isUdpMode = false;
  let currentStageIdx = 0;
  let isTransmitting = false;
  let transmitTimer = null;

  const candLvl = Math.min(10, Math.max(0, ctx.level ?? 6));
  const reqLvl = Math.min(10, Math.max(0, ctx.required ?? 7));

  const NODES = [
    { id: "client", name: "Client Host", ip: "192.168.1.42", x: 60, y: 160, unlock: 1 },
    { id: "dns", name: "DNS Resolver", ip: "8.8.8.8", x: 180, y: 70, unlock: 2 },
    { id: "router", name: "Border Router", ip: "172.16.0.1", x: 280, y: 160, unlock: 3 },
    { id: "cdn", name: "Edge CDN", ip: "104.16.24.1", x: 380, y: 80, unlock: 4 },
    { id: "firewall", name: "SPI Firewall", ip: "Stateful L4", x: 480, y: 160, unlock: 5 },
    { id: "lb", name: "Load Balancer", ip: "VIP: 142.250.72.14", x: 580, y: 160, unlock: 6 },
    { id: "server", name: "Origin App", ip: "10.0.1.50:443", x: 700, y: 120, unlock: 7 },
    { id: "db", name: "Internal DB", ip: "10.0.2.10:5432", x: 820, y: 160, unlock: 9 }
  ];

  const PACKET_STAGES_TCP = [
    { name: "1. DNS Query", info: "Client sends UDP query to 8.8.8.8 for 'api.cairn.internal' (A Record: 142.250.72.14)", rtt: 12, flags: "UDP / Port 53" },
    { name: "2. TCP SYN", info: "Client initiates handshake: SYN seq=1000 win=65535 mss=1460 to Port 443", rtt: 25, flags: "[SYN] seq=1000" },
    { name: "3. TCP SYN-ACK", info: "Origin responds: SYN-ACK seq=5000 ack=1001 (Connection Accepted)", rtt: 50, flags: "[SYN, ACK] ack=1001" },
    { name: "4. TCP ACK & TLS", info: "Client finalizes 3-way handshake with ACK and initiates TLS 1.3 ClientHello", rtt: 75, flags: "[ACK] + TLS 1.3" },
    { name: "5. HTTP/2 GET", info: "Encrypted HTTP/2 Stream 1 HEADERS GET /api/v1/benchmarks", rtt: 95, flags: "DATA (Encrypted)" },
    { name: "6. HTTP 200 OK", info: "Origin dispatches 200 OK response with JSON payload (gzip compressed)", rtt: 120, flags: "HTTP/2 200 OK" }
  ];

  const PACKET_STAGES_UDP = [
    { name: "1. Datagram Sent", info: "Direct UDP datagram dispatched: no connection handshake, zero overhead", rtt: 10, flags: "UDP No-State" },
    { name: "2. Fire & Forget", info: "Packet traverses edge router; no ACK tracked, no retransmission buffers", rtt: 20, flags: "UDP / Stream" },
    { name: "3. Fast Delivery", info: "Immediate packet consumption at destination: optimal for low-latency VoIP/QUIC", rtt: 30, flags: "Payload Received" }
  ];

  el.style.backgroundColor = "#05100A";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.style.color = "#6BFF9E";
  el.style.fontFamily = "var(--font-mono, monospace)";

  el.innerHTML = `
    <!-- CRT Scanline Overlay -->
    <div style="position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03)); background-size: 100% 3px, 6px 100%; pointer-events: none; z-index: 20;"></div>

    <div class="signal-stage" style="position: absolute; inset: 0; display: flex; flex-direction: column; padding: 22px 26px 16px; box-sizing: border-box; overflow-y: auto; z-index: 10;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; position: relative; z-index: 2; flex-wrap: wrap; gap: 8px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #6BFF9E; box-shadow: 0 0 10px #6BFF9E;"></span>
            <span style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #6BFF9E; font-weight: 600;">The Signal Tower · OSI & Transport Layer</span>
          </div>
          <p style="margin: 4px 0 0; font-size: 13px; color: #7CA88B;">
            Lighthouse packet telemetry. Reachable nodes follow candidate level (${candLvl}/10). Benchmarked requirement: ${reqLvl}/10.
          </p>
        </div>

        <!-- Controls: Send, Protocol Toggle, Latency, Loss -->
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <button id="btn-netw-send" style="font-family: inherit; font-size: 11px; padding: 5px 12px; border-radius: 4px; border: 1px solid #6BFF9E; background: rgba(107,255,158,0.18); color: #6BFF9E; font-weight: 700; cursor: pointer;">
            Send Request (TCP)
          </button>
          <button id="btn-netw-step" style="font-family: inherit; font-size: 11px; padding: 5px 10px; border-radius: 4px; border: 1px solid rgba(107,255,158,0.3); background: rgba(5,16,10,0.7); color: #7CA88B; cursor: pointer;">
            Step ▶
          </button>
          <button id="btn-netw-protocol" style="font-family: inherit; font-size: 11px; padding: 5px 10px; border-radius: 4px; border: 1px solid rgba(107,255,158,0.3); background: rgba(5,16,10,0.7); color: #6BFF9E; cursor: pointer;">
            Mode: TCP
          </button>

          <div style="display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(107,255,158,0.2); padding: 4px 8px; border-radius: 4px; font-size: 11px;">
            <span>Loss:</span>
            <input type="range" id="netw-loss-slider" min="0" max="40" value="${packetLossPct}" style="width: 55px; accent-color: #E5646B; cursor: pointer;" />
            <span id="netw-loss-val" style="color: ${packetLossPct > 0 ? '#E5646B' : '#6BFF9E'}; min-width: 30px;">${packetLossPct}%</span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(107,255,158,0.2); padding: 4px 8px; border-radius: 4px; font-size: 11px;">
            <span>Latency:</span>
            <input type="range" id="netw-lat-slider" min="5" max="150" value="${linkLatencyMs}" style="width: 55px; accent-color: #6BFF9E; cursor: pointer;" />
            <span id="netw-lat-val" style="color: #6BFF9E; min-width: 40px;">${linkLatencyMs}ms</span>
          </div>
        </div>
      </div>

      <!-- Signal Tower & 8 Network Nodes Topology -->
      <div style="position: relative; flex: 1; min-height: 250px; background: radial-gradient(circle at 10% 20%, rgba(107,255,158,0.08) 0%, rgba(5,16,10,0.95) 70%); border: 1px solid rgba(107,255,158,0.2); border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
        <svg id="network-topology-svg" viewBox="0 0 920 300" style="width: 100%; height: 100%; display: block;" preserveAspectRatio="xMidYMid meet">
          <!-- Signal Tower Rotating Beam in Background -->
          <g id="lighthouse-tower" transform="translate(40, 40)">
            <polygon points="10,0 20,0 24,60 6,60" fill="rgba(107,255,158,0.15)" stroke="#6BFF9E" stroke-width="1.2" />
            <circle cx="15" cy="10" r="6" fill="#6BFF9E" />
          </g>

          <!-- Links between Nodes -->
          <g stroke="rgba(107,255,158,0.2)" stroke-width="1.2" stroke-dasharray="3,3">
            <line x1="100" y1="160" x2="180" y2="90" />
            <line x1="100" y1="160" x2="280" y2="160" />
            <line x1="280" y1="160" x2="380" y2="100" />
            <line x1="280" y1="160" x2="480" y2="160" />
            <line x1="480" y1="160" x2="580" y2="160" />
            <line x1="580" y1="160" x2="700" y2="130" />
            <line x1="700" y1="130" x2="820" y2="160" />
          </g>

          <!-- 8 Network Node Islands -->
          ${NODES.map(n => {
            const isUnlocked = candLvl >= n.unlock;
            const isGhost = reqLvl >= n.unlock && !isUnlocked;
            return `
              <g class="netw-node" id="node-${n.id}" transform="translate(${n.x - 45}, ${n.y - 28})" opacity="${isUnlocked ? '1' : '0.35'}">
                <rect width="90" height="56" rx="5" fill="#0A160F" stroke="${isUnlocked ? '#6BFF9E' : (isGhost ? '#6BFF9E' : 'rgba(107,255,158,0.2)')}" stroke-dasharray="${isGhost ? '3,3' : 'none'}" stroke-width="1.2" />
                <text x="45" y="20" font-size="9.5" fill="#6BFF9E" text-anchor="middle" font-weight="700">${n.name}</text>
                <text x="45" y="34" font-size="8" fill="#7CA88B" text-anchor="middle">${n.ip}</text>
                <circle cx="45" cy="45" r="3" fill="${isUnlocked ? '#6BFF9E' : '#2A4D35'}" />
              </g>
            `;
          }).join("")}
        </svg>

        <!-- Canvas for Animated Moving Packet Beam & Header Inspector -->
        <canvas id="signal-canvas" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;"></canvas>

        <!-- Packet Inspector HUD Overlay (Bottom-right) -->
        <div id="packet-hud" style="position: absolute; bottom: 12px; right: 16px; background: rgba(5,16,10,0.92); border: 1px solid #6BFF9E; border-radius: 4px; padding: 8px 12px; font-size: 10.5px; max-width: 360px; z-index: 15; box-shadow: 0 4px 16px rgba(0,0,0,0.6);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 700; color: #6BFF9E;">Frame Telemetry:</span>
            <span id="hud-flags" style="color: #9BC53D;">IDLE</span>
          </div>
          <div id="hud-desc" style="color: #7CA88B; font-size: 10px; line-height: 1.3;">
            Ready to initiate socket transport. Press 'Send Request' or 'Step'.
          </div>
        </div>
      </div>

      <!-- Network Micro Glossary (IP, Port, Latency) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
        <div style="padding: 8px 12px; border-radius: 4px; background: rgba(107,255,158,0.05); border: 1px solid rgba(107,255,158,0.15); font-size: 10.5px;">
          <strong style="color: #6BFF9E; display: block; margin-bottom: 2px;">IP Address (L3 Network):</strong> Unique logical host locator in IPv4 (32-bit) or IPv6 (128-bit) routing datagrams across autonomous networks.
        </div>
        <div style="padding: 8px 12px; border-radius: 4px; background: rgba(107,255,158,0.05); border: 1px solid rgba(107,255,158,0.15); font-size: 10.5px;">
          <strong style="color: #6BFF9E; display: block; margin-bottom: 2px;">Port Number (L4 Transport):</strong> 16-bit multiplexing identifier (0-65535) directing incoming packets to specific process sockets (e.g. 80 HTTP, 443 HTTPS).
        </div>
        <div style="padding: 8px 12px; border-radius: 4px; background: rgba(107,255,158,0.05); border: 1px solid rgba(107,255,158,0.15); font-size: 10.5px;">
          <strong style="color: #6BFF9E; display: block; margin-bottom: 2px;">RTT &amp; Latency:</strong> Round-Trip Time governed by propagation speed of light in fiber, queuing delay at switches, and TCP handshake overhead.
        </div>
      </div>
    </div>
  `;

  // Canvas Rotating Lighthouse Beam & Transmitting Packet
  const canvas = el.querySelector("#signal-canvas");
  const ctx2d = canvas ? canvas.getContext("2d") : null;
  let beamAngle = 0;
  let packetX = -1;
  let packetY = -1;
  let targetX = -1;
  let targetY = -1;

  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement || el;
    canvas.width = parent ? parent.clientWidth || 800 : 800;
    canvas.height = parent ? parent.clientHeight || 400 : 400;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function executeStage(stageIdx) {
    const stages = isUdpMode ? PACKET_STAGES_UDP : PACKET_STAGES_TCP;
    if (stageIdx >= stages.length) {
      currentStageIdx = 0;
      isTransmitting = false;
      return;
    }
    const stage = stages[stageIdx];
    const hudFlags = el.querySelector("#hud-flags");
    const hudDesc = el.querySelector("#hud-desc");

    // Check packet loss drop
    if (packetLossPct > 0 && Math.random() * 100 < packetLossPct) {
      if (hudFlags) {
        hudFlags.textContent = "PACKET DROPPED (Loss Triggered)";
        hudFlags.style.color = "#E5646B";
      }
      if (hudDesc) {
        hudDesc.textContent = `Retransmission required. TCP Reno activating exponential backoff (RTO = ${linkLatencyMs * 4}ms).`;
      }
      return;
    }

    if (hudFlags) {
      hudFlags.textContent = stage.flags;
      hudFlags.style.color = "#9BC53D";
    }
    if (hudDesc) {
      hudDesc.textContent = `${stage.info} (RTT: ${stage.rtt + linkLatencyMs}ms)`;
    }

    // Packet coordinate animation target
    const nodeFrom = NODES[stageIdx % NODES.length];
    const nodeTo = NODES[(stageIdx + 1) % NODES.length];
    const wScale = canvas.width / 920;
    const hScale = canvas.height / 300;

    packetX = nodeFrom.x * wScale;
    packetY = nodeFrom.y * hScale;
    targetX = nodeTo.x * wScale;
    targetY = nodeTo.y * hScale;
  }

  // Button Listeners
  const btnSend = el.querySelector("#btn-netw-send");
  if (btnSend) {
    btnSend.addEventListener("click", () => {
      currentStageIdx = 0;
      isTransmitting = true;
      executeStage(0);

      const stages = isUdpMode ? PACKET_STAGES_UDP : PACKET_STAGES_TCP;
      if (transmitTimer) clearInterval(transmitTimer);
      transmitTimer = setInterval(() => {
        if (isDestroyed) return;
        currentStageIdx++;
        if (currentStageIdx >= stages.length) {
          clearInterval(transmitTimer);
          isTransmitting = false;
        } else {
          executeStage(currentStageIdx);
        }
      }, reducedMotion ? 200 : 700 + linkLatencyMs * 4);
    });
  }

  const btnStep = el.querySelector("#btn-netw-step");
  if (btnStep) {
    btnStep.addEventListener("click", () => {
      const stages = isUdpMode ? PACKET_STAGES_UDP : PACKET_STAGES_TCP;
      currentStageIdx = (currentStageIdx + 1) % stages.length;
      executeStage(currentStageIdx);
    });
  }

  const btnProto = el.querySelector("#btn-netw-protocol");
  if (btnProto) {
    btnProto.addEventListener("click", () => {
      isUdpMode = !isUdpMode;
      btnProto.textContent = isUdpMode ? "Mode: UDP" : "Mode: TCP";
      if (btnSend) btnSend.textContent = isUdpMode ? "Send Datagram (UDP)" : "Send Request (TCP)";
      currentStageIdx = 0;
      executeStage(0);
    });
  }

  const lossSlider = el.querySelector("#netw-loss-slider");
  const lossVal = el.querySelector("#netw-loss-val");
  if (lossSlider) {
    lossSlider.addEventListener("input", (e) => {
      packetLossPct = parseInt(e.target.value, 10);
      if (lossVal) {
        lossVal.textContent = `${packetLossPct}%`;
        lossVal.style.color = packetLossPct > 0 ? "#E5646B" : "#6BFF9E";
      }
    });
  }

  const latSlider = el.querySelector("#netw-lat-slider");
  const latVal = el.querySelector("#netw-lat-val");
  if (latSlider) {
    latSlider.addEventListener("input", (e) => {
      linkLatencyMs = parseInt(e.target.value, 10);
      if (latVal) latVal.textContent = `${linkLatencyMs}ms`;
    });
  }

  // Render Loop
  function render() {
    if (isDestroyed) return;
    if (!isPaused && ctx2d && !reducedMotion) {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Rotating Lighthouse Beam
      beamAngle += 0.015;
      const originX = 55 * (canvas.width / 920);
      const originY = 50 * (canvas.height / 300);

      ctx2d.save();
      ctx2d.beginPath();
      ctx2d.moveTo(originX, originY);
      ctx2d.arc(originX, originY, 400, beamAngle - 0.2, beamAngle + 0.2);
      ctx2d.closePath();
      const grad = ctx2d.createRadialGradient(originX, originY, 10, originX, originY, 400);
      grad.addColorStop(0, "rgba(107, 255, 158, 0.25)");
      grad.addColorStop(1, "rgba(107, 255, 158, 0.0)");
      ctx2d.fillStyle = grad;
      ctx2d.fill();
      ctx2d.restore();

      // 2. Transmitting Packet Trajectory
      if (packetX > 0 && targetX > 0) {
        packetX += (targetX - packetX) * 0.12;
        packetY += (targetY - packetY) * 0.12;

        ctx2d.beginPath();
        ctx2d.arc(packetX, packetY, 5, 0, Math.PI * 2);
        ctx2d.fillStyle = "#6BFF9E";
        ctx2d.shadowColor = "#6BFF9E";
        ctx2d.shadowBlur = 10;
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
      if (transmitTimer) clearInterval(transmitTimer);
      if (animId) cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", resizeCanvas);
    }
  };
}

if (typeof window !== "undefined") {
  window.WAYPOINT_SCENES = window.WAYPOINT_SCENES || {};
  window.WAYPOINT_SCENES.NETW = { mount };
}
