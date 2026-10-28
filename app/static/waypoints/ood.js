/**
 * WAYPOINT 05: OOD — "The Workshop"
 * Tint: Blueprint Cyan (#5BC8E8) on Navy Drafting Paper (#0A1626)
 * Art-directed architect drafting table with blueprint grid, interactive draggable class boxes,
 * dynamic SVG inheritance connector arrows, pegboard of 6 pattern tools with unlock states,
 * and animated live blueprint pattern diagrams (Strategy, Observer, Factory, etc.).
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let isDestroyed = false;
  let isPaused = false;
  let animId = null;
  let activeTool = "strategy";

  const candLvl = ctx.level ?? 7;
  const reqLvl = ctx.required ?? 8;

  // 6 Pattern Tools with unlock threshold & animated diagram specs
  const TOOLS = [
    {
      id: "singleton",
      name: "Singleton",
      reqLevel: 2,
      desc: "Guarantees a class has only one instance and provides global access to it.",
      code: "class Database:\n  _inst = None\n  def __new__(cls):\n    if not cls._inst: cls._inst = super().__new__(cls)\n    return cls._inst"
    },
    {
      id: "factory",
      name: "Factory",
      reqLevel: 4,
      desc: "Defines an interface for creating objects, letting subclasses decide which class to instantiate.",
      code: "class ShapeFactory:\n  @staticmethod\n  def create(kind):\n    if kind == 'circle': return Circle()\n    return Rectangle()"
    },
    {
      id: "strategy",
      name: "Strategy",
      reqLevel: 6,
      desc: "Encapsulates swappable algorithmic families into isolated classes with a shared contract.",
      code: "class SortContext:\n  def __init__(self, strat): self.strat = strat\n  def execute(self, data): return self.strat.sort(data)"
    },
    {
      id: "observer",
      name: "Observer",
      reqLevel: 7,
      desc: "Maintains a subscription list and notifies dependents automatically of state changes.",
      code: "class Subject:\n  def notify(self, event):\n    for obs in self._listeners: obs.update(event)"
    },
    {
      id: "decorator",
      name: "Decorator",
      reqLevel: 8,
      desc: "Attaches additional responsibilities dynamically without modifying underlying classes.",
      code: "class AuthDecorator(Service):\n  def handle(self, req):\n    self.authenticate(req); return self._wrapped.handle(req)"
    },
    {
      id: "adapter",
      name: "Adapter",
      reqLevel: 9,
      desc: "Converts the interface of a legacy or third-party service into the target interface expected.",
      code: "class StripeAdapter(PaymentGateway):\n  def charge(self, amt): return self._stripe.create_charge(amount_cents=amt*100)"
    }
  ];

  // Determine tool unlock states based on candidate level or evidence
  const evidenceStr = (ctx.evidence || []).join(" ").toLowerCase();
  TOOLS.forEach(t => {
    t.unlocked = candLvl >= t.reqLevel || evidenceStr.includes(t.id);
  });

  // Default Draggable Class Boxes Coordinates
  const initialNodes = {
    shape: { id: "shape", title: "<<abstract>> Shape", color: "#5BC8E8", x: 260, y: 70, w: 150, h: 64, parent: null },
    circle: { id: "circle", title: "Circle", color: "#F3EEE4", x: 120, y: 200, w: 120, h: 54, parent: "shape" },
    rect: { id: "rect", title: "Rectangle", color: "#F3EEE4", x: 280, y: 200, w: 120, h: 54, parent: "shape" },
    triangle: { id: "triangle", title: "Triangle", color: "#F3EEE4", x: 440, y: 200, w: 120, h: 54, parent: "shape" }
  };
  let nodes = JSON.parse(JSON.stringify(initialNodes));

  el.style.backgroundColor = "#0A1626";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", `The Workshop: Object-Oriented Design Waypoint. Candidate level ${candLvl} out of 10, required ${reqLvl}.`);

  el.innerHTML = `
    <!-- Fine Blueprint Grid Pattern -->
    <svg style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;" aria-hidden="true">
      <defs>
        <pattern id="blueprint-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="24" y2="0" stroke="rgba(91, 200, 232, 0.08)" stroke-width="1" />
          <line x1="0" y1="0" x2="0" y2="24" stroke="rgba(91, 200, 232, 0.08)" stroke-width="1" />
        </pattern>
        <marker id="arrow-inherit" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <polygon points="0,0 10,5 0,10" fill="none" stroke="#5BC8E8" stroke-width="1.5" />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="url(#blueprint-grid)" />
    </svg>

    <!-- Main Drafting Surface & Arrow Connectors SVG -->
    <svg id="drafting-svg" viewBox="0 0 1000 600" style="position: absolute; inset: 0; width: 100%; height: 100%;">
      <!-- Inheritance Connecting Arrows -->
      <g id="arrows-group"></g>

      <!-- Interactive Class Boxes -->
      <g id="classes-group"></g>

      <!-- Pattern Blueprint Animation Stage (Left Bottom) -->
      <g id="pattern-stage" transform="translate(60, 310)"></g>
    </svg>

    <!-- Pegboard of 6 Pattern Tools (Right Column) -->
    <div style="
      position: absolute;
      top: 18px;
      right: 18px;
      width: 250px;
      background: rgba(10, 22, 38, 0.94);
      border: 1px solid rgba(91, 200, 232, 0.3);
      border-radius: var(--radius-sm);
      box-shadow: 0 12px 36px rgba(0,0,0,0.5);
      padding: 14px 16px;
      z-index: 10;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(91, 200, 232, 0.2); padding-bottom: 8px; margin-bottom: 10px;">
        <span style="font-family: var(--font-mono); font-size: 11px; color: #5BC8E8; text-transform: uppercase;">Pattern Pegboard</span>
        <span style="font-family: var(--font-mono); font-size: 10px; color: #A7A298;">${TOOLS.filter(t => t.unlocked).length} / 6 Unlocked</span>
      </div>

      <div id="pegboard-list" style="display: flex; flex-direction: column; gap: 6px;"></div>

      <div style="margin-top: 14px; pt: 10px; border-top: 1px solid rgba(91, 200, 232, 0.15); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 10px; color: #736E65;">Drag boxes to test layout</span>
        <button id="btn-reset-layout" type="button" class="btn btn-secondary" style="height: 26px; padding: 0 8px; font-size: 10px;">Reset</button>
      </div>
    </div>

    <!-- Active Pattern Inspection Panel (Bottom Center) -->
    <div id="pattern-info-card" style="
      position: absolute;
      bottom: 20px;
      left: 60px;
      width: min(560px, 80%);
      background: rgba(10, 22, 38, 0.92);
      border: 1px solid rgba(91, 200, 232, 0.28);
      border-radius: var(--radius-sm);
      padding: 14px 18px;
      z-index: 10;
      color: #F3EEE4;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong id="pattern-card-title" style="color: #5BC8E8; font-size: 14px;">Strategy Pattern</strong>
        <span id="pattern-card-status" style="font-family: var(--font-mono); font-size: 10px; color: #9BC53D;">Active Blueprint</span>
      </div>
      <p id="pattern-card-desc" style="font-size: 12px; line-height: 1.5; color: #A7A298; margin-bottom: 8px;"></p>
      <pre id="pattern-card-code" style="font-family: var(--font-mono); font-size: 11px; color: #F3EEE4; background: rgba(5, 12, 20, 0.85); padding: 8px 12px; border-radius: 4px; overflow-x: auto; margin: 0;"></pre>
    </div>

    <!-- Readout Badge (Bottom-Left) -->
    <div class="waypoint-readout-badge" style="border-color: rgba(91, 200, 232, 0.4); left: 20px; bottom: 20px;">
      <span style="width: 7px; height: 7px; border-radius: 50%; background: #5BC8E8; box-shadow: 0 0 8px #5BC8E8;"></span>
      <span>You: ${candLvl} · ${ctx.companyName || "Target"} expects: ${reqLvl}</span>
    </div>
  `;

  // ——— Render SVG Class Boxes & Dynamic Arrows ———
  const classesGroup = el.querySelector("#classes-group");
  const arrowsGroup = el.querySelector("#arrows-group");

  function renderArrows() {
    if (!arrowsGroup) return;
    arrowsGroup.innerHTML = "";

    Object.values(nodes).forEach(child => {
      if (!child.parent || !nodes[child.parent]) return;
      const parent = nodes[child.parent];

      const x1 = child.x + child.w / 2;
      const y1 = child.y;
      const x2 = parent.x + parent.w / 2;
      const y2 = parent.y + parent.h;

      // Curved or stepped inheritance arrow with marker
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const midY = (y1 + y2) / 2;
      path.setAttribute("d", `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#5BC8E8");
      path.setAttribute("stroke-width", "1.6");
      path.setAttribute("stroke-dasharray", "4 3");
      path.setAttribute("marker-end", "url(#arrow-inherit)");
      arrowsGroup.appendChild(path);
    });
  }

  function renderClassBoxes() {
    if (!classesGroup) return;
    classesGroup.innerHTML = "";

    Object.values(nodes).forEach(n => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("transform", `translate(${n.x}, ${n.y})`);
      g.style.cursor = "grab";

      // Blueprint Box
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "0");
      rect.setAttribute("width", n.w);
      rect.setAttribute("height", n.h);
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", "rgba(10, 22, 38, 0.9)");
      rect.setAttribute("stroke", n.color);
      rect.setAttribute("stroke-width", "1.5");
      rect.setAttribute("box-shadow", "0 4px 12px rgba(0,0,0,0.5)");
      g.appendChild(rect);

      // Header Bar
      const headLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      headLine.setAttribute("x1", "0");
      headLine.setAttribute("y1", "24");
      headLine.setAttribute("x2", n.w);
      headLine.setAttribute("y2", "24");
      headLine.setAttribute("stroke", "rgba(91, 200, 232, 0.2)");
      headLine.setAttribute("stroke-width", "1");
      g.appendChild(headLine);

      // Class Name
      const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
      title.setAttribute("x", n.w / 2);
      title.setAttribute("y", "16");
      title.setAttribute("text-anchor", "middle");
      title.setAttribute("fill", n.color);
      title.setAttribute("font-family", "var(--font-mono)");
      title.setAttribute("font-size", "10");
      title.setAttribute("font-weight", "600");
      title.textContent = n.title;
      g.appendChild(title);

      // Dragging Logic
      let isDragging = false;
      let startMouseX = 0, startMouseY = 0;
      let origX = n.x, origY = n.y;

      function onMouseDown(e) {
        isDragging = true;
        g.style.cursor = "grabbing";
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        origX = n.x;
        origY = n.y;
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      }

      function onMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;
        n.x = Math.max(10, Math.min(540, origX + dx));
        n.y = Math.max(20, Math.min(260, origY + dy));
        g.setAttribute("transform", `translate(${n.x}, ${n.y})`);
        renderArrows();
      }

      function onMouseUp() {
        isDragging = false;
        g.style.cursor = "grab";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }

      g.addEventListener("mousedown", onMouseDown);
      classesGroup.appendChild(g);
    });

    renderArrows();
  }
  renderClassBoxes();

  // Reset layout handler
  const btnReset = el.querySelector("#btn-reset-layout");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      nodes = JSON.parse(JSON.stringify(initialNodes));
      renderClassBoxes();
    });
  }

  // ——— Pegboard Pattern Tools List ———
  const pegboardList = el.querySelector("#pegboard-list");
  const cardTitle = el.querySelector("#pattern-card-title");
  const cardDesc = el.querySelector("#pattern-card-desc");
  const cardCode = el.querySelector("#pattern-card-code");

  function selectPattern(toolId) {
    activeTool = toolId;
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool) return;

    cardTitle.textContent = `${tool.name} Pattern`;
    cardDesc.textContent = tool.desc;
    cardCode.textContent = tool.code;

    // Highlight active in pegboard
    const buttons = pegboardList.querySelectorAll("button");
    buttons.forEach(b => {
      const match = b.getAttribute("data-tool") === toolId;
      b.style.borderColor = match ? "#5BC8E8" : "rgba(91, 200, 232, 0.15)";
      b.style.background = match ? "rgba(91, 200, 232, 0.12)" : "rgba(10, 22, 38, 0.6)";
    });

    renderPatternAnimation(toolId);
  }

  TOOLS.forEach(t => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-tool", t.id);
    btn.style.display = "flex";
    btn.style.justifyContent = "space-between";
    btn.style.alignItems = "center";
    btn.style.width = "100%";
    btn.style.padding = "6px 10px";
    btn.style.borderRadius = "4px";
    btn.style.border = "1px solid rgba(91, 200, 232, 0.15)";
    btn.style.background = "rgba(10, 22, 38, 0.6)";
    btn.style.cursor = t.unlocked ? "pointer" : "not-allowed";
    btn.style.color = t.unlocked ? "#F3EEE4" : "#5E5A56";
    btn.style.fontFamily = "var(--font-mono)";
    btn.style.fontSize = "11px";

    btn.innerHTML = `
      <span style="display: flex; align-items: center; gap: 6px;">
        <span style="width: 5px; height: 5px; border-radius: 50%; background: ${t.unlocked ? "#5BC8E8" : "#5E5A56"};"></span>
        ${t.name}
      </span>
      <span>${t.unlocked ? "✓" : "🔒 Lvl " + t.reqLevel}</span>
    `;

    if (t.unlocked) {
      btn.addEventListener("click", () => selectPattern(t.id));
    }
    pegboardList.appendChild(btn);
  });

  // ——— Pattern Blueprint SVG Simulation ———
  const patternStage = el.querySelector("#pattern-stage");
  let pulseTimer = null;

  function renderPatternAnimation(id) {
    if (!patternStage) return;
    patternStage.innerHTML = "";
    clearInterval(pulseTimer);

    if (id === "strategy") {
      patternStage.innerHTML = `
        <rect x="0" y="0" width="100" height="40" rx="3" fill="#0A1626" stroke="#5BC8E8" stroke-width="1.5" />
        <text x="50" y="24" text-anchor="middle" fill="#5BC8E8" font-family="var(--font-mono)" font-size="10">Context</text>
        
        <path d="M 100 20 L 170 20" stroke="#5BC8E8" stroke-width="2" marker-end="url(#arrow-inherit)" />
        
        <rect id="strat-active-box" x="180" y="0" width="130" height="40" rx="3" fill="#0A1626" stroke="#9BC53D" stroke-width="1.5" />
        <text id="strat-active-text" x="245" y="24" text-anchor="middle" fill="#9BC53D" font-family="var(--font-mono)" font-size="10">StrategyA (Quick)</text>
      `;

      let flip = false;
      pulseTimer = setInterval(() => {
        flip = !flip;
        const box = patternStage.querySelector("#strat-active-box");
        const txt = patternStage.querySelector("#strat-active-text");
        if (box && txt) {
          box.setAttribute("stroke", flip ? "#FF9A3D" : "#9BC53D");
          txt.setAttribute("fill", flip ? "#FF9A3D" : "#9BC53D");
          txt.textContent = flip ? "StrategyB (Merge)" : "StrategyA (Quick)";
        }
      }, 1600);
    } else if (id === "observer") {
      patternStage.innerHTML = `
        <rect x="0" y="40" width="90" height="40" rx="3" fill="#0A1626" stroke="#5BC8E8" stroke-width="1.5" />
        <text x="45" y="64" text-anchor="middle" fill="#5BC8E8" font-family="var(--font-mono)" font-size="10">Subject</text>

        <path d="M 90 50 L 160 20" stroke="#5BC8E8" stroke-width="1.5" stroke-dasharray="3 3" />
        <path d="M 90 60 L 160 60" stroke="#5BC8E8" stroke-width="1.5" stroke-dasharray="3 3" />
        <path d="M 90 70 L 160 100" stroke="#5BC8E8" stroke-width="1.5" stroke-dasharray="3 3" />

        <rect x="170" y="5" width="80" height="30" rx="3" fill="#0A1626" stroke="#F3EEE4" stroke-width="1" />
        <text x="210" y="24" text-anchor="middle" fill="#F3EEE4" font-family="var(--font-mono)" font-size="9">Obs 1</text>
        
        <rect x="170" y="45" width="80" height="30" rx="3" fill="#0A1626" stroke="#F3EEE4" stroke-width="1" />
        <text x="210" y="64" text-anchor="middle" fill="#F3EEE4" font-family="var(--font-mono)" font-size="9">Obs 2</text>

        <rect x="170" y="85" width="80" height="30" rx="3" fill="#0A1626" stroke="#F3EEE4" stroke-width="1" />
        <text x="210" y="104" text-anchor="middle" fill="#F3EEE4" font-family="var(--font-mono)" font-size="9">Obs 3</text>
      `;
    } else {
      // Generic pattern diagram fallback
      patternStage.innerHTML = `
        <rect x="0" y="10" width="120" height="40" rx="3" fill="#0A1626" stroke="#5BC8E8" stroke-width="1.5" />
        <text x="60" y="34" text-anchor="middle" fill="#5BC8E8" font-family="var(--font-mono)" font-size="10">${id.toUpperCase()}</text>
      `;
    }
  }

  selectPattern("strategy");

  const observer = new IntersectionObserver(([entry]) => {
    isPaused = !entry.isIntersecting;
  }, { threshold: 0.1 });
  observer.observe(el);

  return {
    destroy() {
      isDestroyed = true;
      clearInterval(pulseTimer);
      observer.disconnect();
    }
  };
}

if (typeof window !== "undefined") {
  window.WAYPOINT_SCENES = window.WAYPOINT_SCENES || {};
  window.WAYPOINT_SCENES.OOD = { mount };
}
