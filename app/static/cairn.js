/**
 * CAIRN COMPONENT — cairn.js
 * Procedural SVG stone cairn stacked and settled live.
 * 12 stones from bedrock to summit:
 * OS -> NETW -> COD -> DSA -> OOD -> SQL -> SWE -> CLOUD -> SYSD -> AI -> APTI -> COMM
 */

(function () {
  const STONE_PALETTE = [
    "#8C877D", // 0 OS
    "#A39D90", // 1 NETW
    "#6F6B65", // 2 COD
    "#B7AE9C", // 3 DSA
    "#5E5A56", // 4 OOD
    "#9A8F7F"  // 5 SQL
  ];

  const DEFAULT_ORDER = [
    "OS",
    "NETW",
    "COD",
    "DSA",
    "OOD",
    "SQL",
    "SWE",
    "CLOUD",
    "SYSD",
    "AI",
    "APTI",
    "COMM"
  ];

  // Seeded PRNG (Mulberry32) for stable procedural rocks per code
  function createRng(seed) {
    let s = (seed >>> 0) || 12345;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Generate smooth Catmull-Rom cubic Bezier path for organic stone
  function generateStonePath(code, rx, ry, numPts) {
    const rng = createRng(hashString("cairn_stone_shape_" + code));
    const pts = [];
    const count = numPts || 12;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const jitter = 0.92 + rng() * 0.16; // 0.92 - 1.08
      // Natural gravitational flattening on bottom resting plane
      const sinA = Math.sin(angle);
      const yMod = sinA > 0.15 ? 0.95 : (sinA < -0.3 ? 1.05 : 1.0);
      const x = Math.cos(angle) * rx * jitter;
      const y = sinA * ry * jitter * yMod;
      pts.push({ x, y });
    }

    const n = pts.length;
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];

      const c1x = p1.x + (p2.x - p0.x) / 6.0;
      const c1y = p1.y + (p2.y - p0.y) / 6.0;
      const c2x = p2.x - (p3.x - p1.x) / 6.0;
      const c2y = p2.y - (p3.y - p1.y) / 6.0;

      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    d += " Z";
    return d;
  }

  // Main Component Constructor
  function renderCairn(container, options) {
    if (!container) return null;

    const opts = options || {};
    let levels = Object.assign({}, opts.levels || {});
    let required = Object.assign({}, opts.required || {});
    const order = opts.order || DEFAULT_ORDER;
    let mode = opts.mode || "full"; // "full" | "target-only" | "candidate-only" | "gap-focus" | "next-stone"
    let clickCallback = opts.onStoneClick || null;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Clear container
    container.innerHTML = "";
    container.style.position = "relative";
    container.style.userSelect = "none";

    // Create SVG Viewport with safe headroom for summit flag and flagpole
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    const viewBoxWidth = 440;
    const viewBoxHeight = 520;
    svg.setAttribute("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Stone Cairn Skill Readiness Visualization");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.overflow = "hidden";
    svg.style.display = "block";

    // Overlay Dust Canvas
    const canvas = document.createElement("canvas");
    canvas.width = viewBoxWidth;
    canvas.height = viewBoxHeight;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "10";
    const ctx = canvas.getContext("2d");

    // Accessible Screen Reader Table
    const srTable = document.createElement("table");
    srTable.className = "sr-only";
    srTable.innerHTML = `
      <caption>Cairn Competency Breakdown (12 Skill Stones)</caption>
      <thead><tr><th>Skill Code</th><th>Competency</th><th>Your Level</th><th>Target Level</th><th>Status</th></tr></thead>
      <tbody></tbody>
    `;
    const srTbody = srTable.querySelector("tbody");

    // SVG Defs (feTurbulence texture, gradients, drop shadows)
    const defs = document.createElementNS(svgNS, "defs");
    defs.innerHTML = `
      <!-- Speckle Granite Texture Filter -->
      <filter id="cairn-stone-speckle" x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.10" numOctaves="4" result="noise"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.12 0" in="noise" result="coloredNoise"/>
        <feComposite operator="in" in="coloredNoise" in2="SourceGraphic" result="speckles"/>
        <feBlend mode="multiply" in="SourceGraphic" in2="speckles"/>
      </filter>

      <!-- Soft Contact Shadow -->
      <filter id="cairn-contact-shadow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.4"/>
      </filter>

      <!-- Ground Base Ledge Gradient -->
      <linearGradient id="ledge-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#182739"/>
        <stop offset="60%" stop-color="#121D2B"/>
        <stop offset="100%" stop-color="#0E1520"/>
      </linearGradient>

      <!-- Ember Flag Gradient -->
      <linearGradient id="flag-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#FF7A3D"/>
        <stop offset="100%" stop-color="#FF945A"/>
      </linearGradient>

      <!-- Dark Slate Gradient for Unworked Gap Stones -->
      <linearGradient id="slate-grad" x1="25%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stop-color="#1C2735" stop-opacity="0.95"/>
        <stop offset="55%" stop-color="#131B26" stop-opacity="0.98"/>
        <stop offset="100%" stop-color="#0B1017"/>
      </linearGradient>
    `;
    svg.appendChild(defs);

    // Group for ground ledge
    const groundGroup = document.createElementNS(svgNS, "g");
    groundGroup.className.baseVal = "cairn-ground";
    groundGroup.innerHTML = `
      <!-- Ground Shadow -->
      <ellipse cx="220" cy="474" rx="150" ry="14" fill="rgba(6, 10, 16, 0.70)" filter="blur(6px)" />
      <!-- Base Ledge Stone -->
      <path d="M 50 472 Q 220 458 390 472 L 406 498 Q 220 510 34 498 Z" fill="url(#ledge-grad)" stroke="rgba(243,238,228,0.10)" stroke-width="1"/>
      <path d="M 68 470 Q 220 460 372 470" stroke="#FF7A3D" stroke-width="0.8" stroke-opacity="0.25" fill="none"/>
    `;
    svg.appendChild(groundGroup);

    // Root Group for Stones
    const stackGroup = document.createElementNS(svgNS, "g");
    stackGroup.className.baseVal = "cairn-stack";
    svg.appendChild(stackGroup);

    // Flag Group
    const flagGroup = document.createElementNS(svgNS, "g");
    flagGroup.className.baseVal = "cairn-summit-flag";
    flagGroup.style.opacity = "0";
    svg.appendChild(flagGroup);

    // Floating Interactive Tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "cairn-stone-tooltip";
    tooltip.style.position = "absolute";
    tooltip.style.pointerEvents = "none";
    tooltip.style.zIndex = "50";
    tooltip.style.opacity = "0";
    tooltip.style.transition = "opacity 0.15s ease, transform 0.15s ease";

    container.appendChild(svg);
    container.appendChild(canvas);
    container.appendChild(tooltip);
    container.appendChild(srTable);

    // Dust particles system
    let particles = [];
    function spawnDustPuff(x, y, stoneWidth) {
      if (prefersReducedMotion) return;
      const count = 6;
      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * stoneWidth * 0.75;
        particles.push({
          x: x + spread,
          y: y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -0.7 - Math.random() * 1.2,
          radius: 1.5 + Math.random() * 2.2,
          alpha: 0.65,
          decay: 0.02 + Math.random() * 0.02,
          color: Math.random() > 0.4 ? "#A39D90" : "#B7AE9C"
        });
      }
      if (!animatingDust) {
        animatingDust = true;
        requestAnimationFrame(renderDust);
      }
    }

    let animatingDust = false;
    function renderDust() {
      ctx.clearRect(0, 0, viewBoxWidth, viewBoxHeight);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
      if (particles.length > 0) {
        requestAnimationFrame(renderDust);
      } else {
        animatingDust = false;
      }
    }

    // Geometry Calculation of Stacking — Natural balanced alpine pyramid
    let stoneElements = {};
    let stoneLayouts = [];

    function calculateLayout(currentReq) {
      stoneLayouts = [];
      let currentBaseY = 470; // resting surface on ledge
      let currentCenterX = 220;
      let prevHeight = 36;

      for (let i = 0; i < order.length; i++) {
        const code = order[i];
        const reqLvl = Math.max(1, Math.min(10, currentReq[code] != null ? currentReq[code] : 6));

        // Stable alpine taper from 228px down to 96px
        const width = Math.round(228 - i * 12.0);
        const height = Math.round(36 - i * 1.25);

        // Hand-placed jitter & rotation for organic balance
        const rng = createRng(hashString("cairn_stone_pos_" + code));
        const xJitter = (rng() - 0.5) * 2.5;
        const rot = (rng() - 0.5) * 1.8;

        const stoneX = currentCenterX + xJitter;
        const stoneY = i === 0 ? (currentBaseY - height / 2) : (stoneLayouts[i - 1].y - (prevHeight / 2 + height / 2) * 0.72);

        stoneLayouts.push({
          code,
          index: i,
          reqLevel: reqLvl,
          width,
          height,
          x: stoneX,
          y: stoneY,
          rotation: rot,
          pathD: generateStonePath(code, width / 2, height / 2)
        });

        prevHeight = height;
        currentCenterX = 220 + (stoneX - 220) * 0.15;
      }
      return stoneLayouts;
    }

    // Build or Update the SVG Dom
    function buildCairnDOM(initialAnimation) {
      const layouts = calculateLayout(required);
      stackGroup.innerHTML = "";
      srTbody.innerHTML = "";
      stoneElements = {};

      layouts.forEach((layout, index) => {
        const code = layout.code;
        const candLvl = levels[code] || 0;
        const reqLvl = layout.reqLevel;
        const palColor = STONE_PALETTE[index % STONE_PALETTE.length];

        // Screen reader row
        const meta = (window.SKILL_METADATA && window.SKILL_METADATA[code]) || { name: code, desc: "" };
        const statusText = candLvl >= reqLvl ? "Meets/Exceeds" : candLvl === 0 ? "Gap (No evidence yet)" : `Gap of ${reqLvl - candLvl} level(s)`;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${code}</td>
          <td>${meta.name}</td>
          <td>${candLvl} / 10</td>
          <td>${reqLvl} / 10</td>
          <td>${statusText}</td>
        `;
        srTbody.appendChild(tr);

        // Stone Group (Procedural layout translation & rotation)
        const g = document.createElementNS(svgNS, "g");
        g.className.baseVal = `cairn-stone-item cairn-stone-${code}`;
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", `${meta.name}: candidate level ${candLvl}, target required ${reqLvl}.`);
        g.setAttribute("transform", `translate(${layout.x.toFixed(1)}, ${layout.y.toFixed(1)}) rotate(${layout.rotation.toFixed(1)})`);
        g.style.cursor = "pointer";
        g.style.outline = "none";

        // Inner Motion Group for relative GSAP drop, lift, squash
        const motionGroup = document.createElementNS(svgNS, "g");
        motionGroup.className.baseVal = "stone-motion-group";
        g.appendChild(motionGroup);

        // Unique Gradient per stone lit from sunset side (top-right)
        const gradId = `cairn-grad-${code}`;
        let grad = document.getElementById(gradId);
        if (!grad) {
          grad = document.createElementNS(svgNS, "linearGradient");
          grad.id = gradId;
          grad.setAttribute("x1", "25%");
          grad.setAttribute("y1", "0%");
          grad.setAttribute("x2", "80%");
          grad.setAttribute("y2", "100%");
          grad.innerHTML = `
            <stop offset="0%" stop-color="#D4CDBC" stop-opacity="0.95"/>
            <stop offset="40%" stop-color="${palColor}"/>
            <stop offset="100%" stop-color="#322F2C"/>
          `;
          defs.appendChild(grad);
        }

        const isSufficient = candLvl >= reqLvl && candLvl > 0;
        const isTargetOnly = mode === "target-only";
        const isUnworked = candLvl === 0 && !isTargetOnly;
        const hasPartialGap = candLvl > 0 && candLvl < reqLvl && !isTargetOnly;

        // 1. Soft Contact Shadow beneath stone
        const shadow = document.createElementNS(svgNS, "ellipse");
        shadow.setAttribute("cx", "0");
        shadow.setAttribute("cy", (layout.height / 2 - 1).toFixed(1));
        shadow.setAttribute("rx", (layout.width / 2 * 0.88).toFixed(1));
        shadow.setAttribute("ry", "2.6");
        shadow.setAttribute("fill", "rgba(6, 10, 16, 0.50)");
        shadow.setAttribute("filter", "url(#cairn-contact-shadow)");
        shadow.className.baseVal = "stone-contact-shadow";
        shadow.style.opacity = isTargetOnly ? "0.2" : (isUnworked ? "0.45" : "0.85");
        motionGroup.appendChild(shadow);

        // 2. Main Stone Body (Tactile, physical mountain rock)
        const stonePath = document.createElementNS(svgNS, "path");
        stonePath.setAttribute("d", layout.pathD);
        stonePath.setAttribute("filter", "url(#cairn-stone-speckle)");
        stonePath.className.baseVal = "stone-fill-path";

        if (isTargetOnly) {
          stonePath.setAttribute("fill", "rgba(255, 122, 61, 0.05)");
          stonePath.setAttribute("stroke", "rgba(255, 122, 61, 0.65)");
          stonePath.setAttribute("stroke-width", "1.4");
          stonePath.setAttribute("stroke-dasharray", "5,4");
        } else if (isUnworked) {
          // Physical dark slate foundation stone: prevents floating while indicating missing mass
          stonePath.setAttribute("fill", "url(#slate-grad)");
          stonePath.setAttribute("stroke", "rgba(255, 122, 61, 0.75)");
          stonePath.setAttribute("stroke-width", "1.4");
          stonePath.setAttribute("stroke-dasharray", "5,3.5");
        } else if (isSufficient) {
          stonePath.setAttribute("fill", `url(#${gradId})`);
          stonePath.setAttribute("stroke", "rgba(155, 197, 61, 0.95)");
          stonePath.setAttribute("stroke-width", "1.8");
          stonePath.setAttribute("stroke-dasharray", "none");
        } else {
          // Partial gap: warm solid granite with ember rim
          stonePath.setAttribute("fill", `url(#${gradId})`);
          stonePath.setAttribute("stroke", "rgba(255, 122, 61, 0.85)");
          stonePath.setAttribute("stroke-width", "1.5");
          stonePath.setAttribute("stroke-dasharray", "none");
        }
        motionGroup.appendChild(stonePath);

        // 3. Crescent Rim Highlight (Sunset Side)
        const crescent = document.createElementNS(svgNS, "path");
        crescent.setAttribute("d", layout.pathD);
        crescent.setAttribute("fill", "none");
        crescent.setAttribute("stroke", "rgba(246, 197, 139, 0.50)");
        crescent.setAttribute("stroke-width", "1.2");
        crescent.setAttribute("stroke-dasharray", `${layout.width * 0.45}, ${layout.width * 2}`);
        crescent.style.opacity = (candLvl > 0 && !isTargetOnly) ? "1" : "0";
        motionGroup.appendChild(crescent);

        // 4. Moss Patch on shoulder if candidate meets or exceeds
        const mossPatch = document.createElementNS(svgNS, "path");
        const mw = layout.width * 0.20;
        const mh = layout.height * 0.24;
        mossPatch.setAttribute("d", `M ${-mw} ${-mh * 0.5} Q 0 ${-mh * 1.1} ${mw * 0.8} ${-mh * 0.3} Q 0 ${-mh * 0.2} ${-mw} ${-mh * 0.5} Z`);
        mossPatch.setAttribute("fill", "#9BC53D");
        mossPatch.setAttribute("opacity", (isSufficient && !isTargetOnly) ? "0.85" : "0");
        mossPatch.className.baseVal = "stone-moss-patch";
        motionGroup.appendChild(mossPatch);

        // Event listeners (Hover, Focus, Click)
        g.addEventListener("mouseenter", (e) => onStoneHover(code, layout, e));
        g.addEventListener("mouseleave", () => onStoneLeave());
        g.addEventListener("focus", (e) => onStoneHover(code, layout, e));
        g.addEventListener("blur", () => onStoneLeave());
        g.addEventListener("click", () => {
          if (clickCallback) clickCallback(code);
        });
        g.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (clickCallback) clickCallback(code);
          }
        });

        stackGroup.appendChild(g);
        stoneElements[code] = {
          group: g,
          motionGroup,
          stonePath,
          crescent,
          mossPath: mossPatch,
          shadowEl: shadow,
          gradId,
          layout
        };
      });

      // Summit Flag on top of summit stone (index 11)
      const summit = layouts[layouts.length - 1];
      const flagX = summit.x;
      const flagY = summit.y - summit.height / 2;
      flagGroup.setAttribute("transform", `translate(${flagX.toFixed(1)}, ${flagY.toFixed(1)})`);
      flagGroup.innerHTML = `
        <!-- Flagpole -->
        <line x1="0" y1="2" x2="0" y2="-30" stroke="#A7A298" stroke-width="1.5" stroke-linecap="round"/>
        <!-- Ember Pennant Flag -->
        <path class="pennant-cloth" d="M 0 -30 Q 15 -26 24 -22 Q 15 -18 0 -14 Z" fill="url(#flag-grad)" stroke="#FF7A3D" stroke-width="0.8"/>
      `;

      // Animate Flag unfurl & mountain breeze sway
      if (!prefersReducedMotion && window.gsap) {
        gsap.to(flagGroup.querySelector(".pennant-cloth"), {
          scaleX: 1.12,
          scaleY: 0.92,
          duration: 1.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
        gsap.to(flagGroup, {
          rotation: 2.0,
          duration: 2.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          transformOrigin: "bottom center"
        });
      }

      // Initial Assembly Animation
      if (initialAnimation && !prefersReducedMotion && window.gsap) {
        animateAssembly();
      } else {
        flagGroup.style.opacity = "1";
      }
    }

    // Assembly Animation: stones drop with 90ms stagger, spring easing, squash, dust
    function animateAssembly() {
      const stoneList = order.map(c => stoneElements[c]).filter(Boolean);
      const tl = gsap.timeline();

      stoneList.forEach((st, idx) => {
        const dropDistance = 140 + idx * 16;

        gsap.set(st.motionGroup, {
          y: -dropDistance,
          opacity: 0,
          scaleY: 1.10
        });

        tl.to(st.motionGroup, {
          y: 0,
          opacity: 1,
          scaleY: 1.0,
          duration: 0.65,
          ease: "elastic.out(1, 0.75)",
          onStart: () => {
            setTimeout(() => {
              spawnDustPuff(st.layout.x, st.layout.y + st.layout.height / 2, st.layout.width);
            }, 260);
          }
        }, idx * 0.09);
      });

      // Summit Flag unfurls last
      flagGroup.style.opacity = "0";
      tl.to(flagGroup, {
        opacity: 1,
        duration: 0.5,
        ease: "power2.out"
      }, "+=0.12");
    }

    // Hover Interaction: clean lift, dim others, dock tooltip
    function onStoneHover(code, layout, event) {
      const candLvl = levels[code] || 0;
      const reqLvl = layout.reqLevel;
      const meta = (window.SKILL_METADATA && window.SKILL_METADATA[code]) || { name: code };

      // Dim other stones to 60%, lift hovered stone 4px relative
      order.forEach(c => {
        const item = stoneElements[c];
        if (!item) return;
        if (c === code) {
          gsap.to(item.motionGroup, {
            y: -4,
            duration: 0.2,
            ease: "power2.out",
            overwrite: "auto"
          });
          gsap.to(item.group, {
            opacity: 1,
            duration: 0.2,
            overwrite: "auto"
          });
        } else {
          gsap.to(item.group, {
            opacity: 0.6,
            duration: 0.2,
            ease: "power2.out",
            overwrite: "auto"
          });
        }
      });

      // Tooltip position & text via precise SVG screen transformation
      const pt = svg.createSVGPoint();
      pt.x = layout.x;
      pt.y = layout.y - layout.height / 2 - 12;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const screenPt = pt.matrixTransform(ctm);
        const containerRect = container.getBoundingClientRect();
        const tipX = screenPt.x - containerRect.left;
        const tipY = screenPt.y - containerRect.top;
        tooltip.style.left = `${tipX.toFixed(1)}px`;
        tooltip.style.top = `${tipY.toFixed(1)}px`;
      } else {
        const rect = container.getBoundingClientRect();
        const scaleX = rect.width / viewBoxWidth;
        const scaleY = rect.height / viewBoxHeight;
        tooltip.style.left = `${(layout.x * scaleX).toFixed(1)}px`;
        tooltip.style.top = `${((layout.y - layout.height / 2 - 14) * scaleY).toFixed(1)}px`;
      }

      const statusTag = candLvl >= reqLvl ? "Ready" : candLvl === 0 ? "Needs Practice" : `Needs +${reqLvl - candLvl} Points`;
      tooltip.textContent = `${meta.name} · You: ${candLvl} / Target: ${reqLvl} · ${statusTag}`;
      tooltip.style.transform = "translate(-50%, -100%)";
      tooltip.style.opacity = "1";
    }

    function onStoneLeave() {
      order.forEach(c => {
        const item = stoneElements[c];
        if (!item) return;
        gsap.to(item.motionGroup, {
          y: 0,
          duration: 0.24,
          ease: "power2.out",
          overwrite: "auto"
        });
        gsap.to(item.group, {
          opacity: 1,
          duration: 0.24,
          ease: "power2.out",
          overwrite: "auto"
        });
      });
      tooltip.style.opacity = "0";
    }

    // Update function: Re-animates state changes smoothly without remounting
    function update(newLevels, newRequired, opts) {
      const nextLevels = newLevels || levels;
      const nextRequired = newRequired || required;
      const duration = (opts && opts.duration) || 0.45;
      levels = Object.assign({}, nextLevels);
      required = Object.assign({}, nextRequired);

      order.forEach(code => {
        const item = stoneElements[code];
        if (!item) return;

        const reqLvl = Math.max(1, Math.min(10, required[code] != null ? required[code] : 6));
        const candLvl = levels[code] || 0;
        const isSufficient = candLvl >= reqLvl && candLvl > 0;
        const isUnworked = candLvl === 0;

        if (isUnworked) {
          item.stonePath.setAttribute("fill", "url(#slate-grad)");
          item.stonePath.setAttribute("stroke", "rgba(255, 122, 61, 0.75)");
          item.stonePath.setAttribute("stroke-width", "1.4");
          item.stonePath.setAttribute("stroke-dasharray", "5,3.5");
          if (item.shadowEl) item.shadowEl.style.opacity = "0.45";
          if (item.crescent) item.crescent.style.opacity = "0";
          if (item.mossPath) item.mossPath.style.opacity = "0";
        } else if (isSufficient) {
          item.stonePath.setAttribute("fill", `url(#${item.gradId})`);
          item.stonePath.setAttribute("stroke", "rgba(155, 197, 61, 0.95)");
          item.stonePath.setAttribute("stroke-width", "1.8");
          item.stonePath.setAttribute("stroke-dasharray", "none");
          if (item.shadowEl) item.shadowEl.style.opacity = "0.85";
          if (item.crescent) item.crescent.style.opacity = "1";
          if (item.mossPath) {
            gsap.to(item.mossPath, { opacity: 0.85, duration: duration, ease: "power2.out" });
          }
        } else {
          // Partial gap: warm solid stone with ember rim
          item.stonePath.setAttribute("fill", `url(#${item.gradId})`);
          item.stonePath.setAttribute("stroke", "rgba(255, 122, 61, 0.85)");
          item.stonePath.setAttribute("stroke-width", "1.5");
          item.stonePath.setAttribute("stroke-dasharray", "none");
          if (item.shadowEl) item.shadowEl.style.opacity = "0.85";
          if (item.crescent) item.crescent.style.opacity = "1";
          if (item.mossPath) {
            gsap.to(item.mossPath, { opacity: 0, duration: duration, ease: "power2.out" });
          }
        }
      });
    }

    // Highlight a specific skill stone
    function highlight(code, state) {
      const item = stoneElements[code];
      if (!item) return;
      if (state) {
        gsap.to(item.motionGroup, {
          y: -5,
          duration: 0.25,
          ease: "power2.out"
        });
        item.stonePath.setAttribute("stroke", "#FF7A3D");
        item.stonePath.setAttribute("stroke-width", "2.2");
      } else {
        gsap.to(item.motionGroup, {
          y: 0,
          duration: 0.25,
          ease: "power2.out"
        });
        const candLvl = levels[code] || 0;
        const reqLvl = item.layout.reqLevel;
        const isSufficient = candLvl >= reqLvl && candLvl > 0;
        const isUnworked = candLvl === 0;

        if (isUnworked) {
          item.stonePath.setAttribute("stroke", "rgba(255, 122, 61, 0.75)");
          item.stonePath.setAttribute("stroke-width", "1.4");
          item.stonePath.setAttribute("stroke-dasharray", "5,3.5");
        } else if (isSufficient) {
          item.stonePath.setAttribute("stroke", "rgba(155, 197, 61, 0.95)");
          item.stonePath.setAttribute("stroke-width", "1.8");
          item.stonePath.setAttribute("stroke-dasharray", "none");
        } else {
          item.stonePath.setAttribute("stroke", "rgba(255, 122, 61, 0.85)");
          item.stonePath.setAttribute("stroke-width", "1.5");
          item.stonePath.setAttribute("stroke-dasharray", "none");
        }
      }
    }

    // Initial build
    buildCairnDOM(true);

    return {
      update,
      highlight,
      onStoneClick: (cb) => { clickCallback = cb; },
      replay: () => animateAssembly(),
      destroy: () => {
        container.innerHTML = "";
      }
    };
  }

  // Standalone Mini Stone SVG for Waypoints
  function renderMiniStoneSVG(code, width) {
    const w = width || 44;
    const h = Math.round(w * 0.52);
    const pathD = generateStonePath(code, (w / 2) * 0.9, (h / 2) * 0.9, 10);
    const palIdx = DEFAULT_ORDER.indexOf(code);
    const color = STONE_PALETTE[palIdx >= 0 ? palIdx % STONE_PALETTE.length : 0];
    const gradId = `mini-grad-${code}`;
    return `
      <svg class="waypoint-stone-glyph" viewBox="-${(w/2).toFixed(1)} -${(h/2).toFixed(1)} ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="${gradId}" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stop-color="#D4CDBC" stop-opacity="0.9"/>
            <stop offset="45%" stop-color="${color}"/>
            <stop offset="100%" stop-color="#3A3836"/>
          </linearGradient>
        </defs>
        <path d="${pathD}" fill="url(#${gradId})" stroke="rgba(243, 238, 228, 0.15)" stroke-width="1"/>
      </svg>
    `;
  }

  // Expose globally
  if (typeof window !== "undefined") {
    window.renderCairn = renderCairn;
    window.renderMiniStoneSVG = renderMiniStoneSVG;
  }
})();
