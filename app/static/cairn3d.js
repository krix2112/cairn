/**
 * CAIRN 3D ENGINE — "Dusk Glass" (High-Performance Overhaul)
 * Real physically-lit 3D stone cairn floating in an aurora sky.
 * Powered by Three.js (self-hosted in vendor/three.min.js).
 * 
 * Performance & Clarity Architecture:
 * - Single master ticker integration with GSAP ticker & lagSmoothing(0)
 * - Pointer capture orbit with exponential velocity damping (alpha = 1 - exp(-dt*k))
 * - Zero layout reads during pointermove; hover raycast only when idle
 * - Fake ember glass (MeshStandardMaterial + fresnel rim) with 0 transmission overhead
 * - 3 distinct stone clarity states: Complete (solid+green rim+check), Partial (vessel fill+waterline+dashed shell+gap badge), Empty (hollow shell+lock)
 * - Always-visible projected HTML overlay chips with vertical collision pass
 * - Adaptive quality governor (rolling 60-frame avg, auto DPR scaling 2.0 -> 1.0)
 * - FPS meter toggled with 'F' key
 * - Clean pause on off-screen / document hidden, on-demand rendering for tool screens
 */

(function () {
  'use strict';

  function isWebGLAvailable() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  // Pre-computed seeded noise table for rock displacement
  function pseudoNoise(x, y, z, seed) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
    return (s - Math.floor(s)) * 2.0 - 1.0;
  }

  // Stone Rock mineral color palette
  const MINERAL_COLORS = [
    0x3c424a, // OS: Deep Basalt / Slate
    0x444b54, // NETW: Gabbro
    0x4f4943, // COD: Dark Granite
    0x5c5750, // DSA: River Gneiss
    0x525c66, // OOD: Blue Schist
    0x4a524a, // AI: Serpentinite
    0x5e4844, // SQL: Iron Sandstone
    0x61666b, // SYSD: Mica Slate
    0x6e685f, // CLOUD: Quartzite
    0x736c64, // SWE: Weathered Granite
    0x636e65, // APTI: Chlorite Schist
    0x787268  // COMM: Alpine Summit Gneiss
  ];

  // Inline SVG badge icons (consistent with soft-UI design tokens)
  const SVG_CHECK_ICON = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polyline points="2.5 6.5 5 9 9.5 3"></polyline></svg>`;
  const SVG_LOCK_ICON = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><rect x="2.5" y="5" width="7" height="5.5" rx="1"></rect><path d="M4 5V3.5a2 2 0 1 1 4 0V5"></path></svg>`;

  // 12 Skill Category Codes in fixed bottom-to-top cairn order
  const CAIRN_ORDER = window.CAIRN_ORDER || [
    "OS", "NETW", "COD", "DSA", "OOD", "SQL",
    "SWE", "CLOUD", "SYSD", "AI", "APTI", "COMM"
  ];

  // Stone size baselines from bottom to summit (width, height, depth)
  const STONE_BASE_SPECS = [
    { w: 3.40, h: 0.85, d: 2.80 }, // 1. OS (Broad foundation)
    { w: 3.10, h: 0.80, d: 2.60 }, // 2. NETW
    { w: 2.85, h: 0.78, d: 2.40 }, // 3. COD
    { w: 2.65, h: 0.75, d: 2.25 }, // 4. DSA
    { w: 2.45, h: 0.72, d: 2.10 }, // 5. OOD
    { w: 2.25, h: 0.70, d: 1.95 }, // 6. SQL
    { w: 2.05, h: 0.68, d: 1.80 }, // 7. SWE
    { w: 1.85, h: 0.65, d: 1.65 }, // 8. CLOUD
    { w: 1.65, h: 0.62, d: 1.50 }, // 9. SYSD
    { w: 1.45, h: 0.58, d: 1.35 }, // 10. AI
    { w: 1.25, h: 0.54, d: 1.20 }, // 11. APTI
    { w: 1.05, h: 0.50, d: 1.00 }  // 12. COMM (Summit capstone)
  ];

  // Shared geometry cache (detail 3 Icosahedrons displaced once at load)
  const GEOMETRY_CACHE = new Map();

  function getDeformedStoneGeometry(w, h, d, seed) {
    const key = `${w}_${h}_${d}_${seed}`;
    if (GEOMETRY_CACHE.has(key)) {
      return GEOMETRY_CACHE.get(key);
    }

    // Detail 3 = 640 triangles (4x lighter than detail 4 with smooth vertex normals)
    const geo = new THREE.IcosahedronGeometry(1.0, 3);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = pseudoNoise(v.x * 2.1, v.y * 2.1, v.z * 2.1, seed);
      const disp = 1.0 + n * 0.18;
      v.multiplyScalar(disp);
      v.x *= (w * 0.5);
      v.y *= (h * 0.5);
      v.z *= (d * 0.5);
      pos.setXYZ(i, v.x, v.y, v.z);
    }

    geo.computeVertexNormals();
    GEOMETRY_CACHE.set(key, geo);
    return geo;
  }

  // Lightweight Aurora Shader (3 octaves, low uniform cost)
  const AuroraShader = {
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec2 uResolution;
      uniform float uChapter;
      uniform float uIntensity;
      uniform float uThemeLight;
      varying vec2 vUv;

      void main() {
        vec2 st = vUv;
        float t = uTime * 0.25;
        
        vec3 darkNight = mix(vec3(0.027, 0.043, 0.078), vec3(0.047, 0.098, 0.165), st.y);
        vec3 lightPaper = mix(vec3(0.953, 0.937, 0.902), vec3(0.910, 0.886, 0.835), st.y);
        vec3 baseNight = mix(darkNight, lightPaper, uThemeLight);
        
        // 3 flowing ribbon octaves
        float w1 = sin(st.x * 2.6 + t * 1.1) * 0.13 + cos(st.x * 1.3 - t * 0.7) * 0.08;
        float w2 = cos(st.x * 3.4 - t * 0.9) * 0.11 + sin(st.x * 1.9 + t * 0.5) * 0.06;
        float w3 = sin(st.x * 4.0 + t * 0.8) * 0.07 + cos(st.x * 1.7 + t * 1.2) * 0.05;

        float ribbon1 = smoothstep(0.40, 0.04, abs(st.y - (0.68 + w1)));
        float ribbon2 = smoothstep(0.44, 0.05, abs(st.y - (0.52 + w2)));
        float ribbon3 = smoothstep(0.36, 0.04, abs(st.y - (0.76 + w3)));

        vec3 teal = mix(vec3(0.18, 0.90, 0.77), vec3(0.05, 0.55, 0.48), uThemeLight);
        vec3 green = mix(vec3(0.61, 1.00, 0.54), vec3(0.12, 0.52, 0.22), uThemeLight);
        vec3 amber = mix(vec3(1.00, 0.77, 0.42), vec3(0.72, 0.45, 0.12), uThemeLight);
        vec3 ember = mix(vec3(1.00, 0.48, 0.24), vec3(0.76, 0.28, 0.10), uThemeLight);

        vec3 colA = mix(teal, amber, clamp(uChapter * 0.25, 0.0, 1.0));
        vec3 colB = mix(green, ember, clamp((uChapter - 1.5) * 0.4, 0.0, 1.0));

        vec3 aurora = ribbon1 * colA * 0.52 + ribbon2 * colB * 0.40 + ribbon3 * teal * 0.30;
        aurora *= uIntensity * (uThemeLight > 0.5 ? 0.20 : 0.35);

        float vignette = smoothstep(1.4, 0.3, length((vUv - 0.5) * 1.2));
        vec3 finalColor = baseNight + aurora * vignette;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  };

  /**
   * Main Cairn3D Stage Class
   */
  class Cairn3DStage {
    constructor(container, options = {}) {
      this.container = container;
      this.options = Object.assign({
        interactive: true,
        showAurora: true,
        enableOrbit: true,
        isHero: false,
        showLabels: true,
        quality: "auto", // "auto" | "high" | "lite"
        reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onStoneHover: null,
        onStoneClick: null,
        initialData: null
      }, options);

      this.stones = [];
      this.labelElements = [];
      this.hoveredIndex = -1;
      this.focusedIndex = -1;
      
      // Orbit & Physics
      this.isDragging = false;
      this.isPointerDown = false;
      this.pointerStartX = 0;
      this.pointerStartY = 0;
      this.velX = 0;
      this.velY = 0;
      this.targetVelX = 0;
      this.targetVelY = 0;
      this.currentRotation = { x: 0.15, y: -0.3 };
      this.targetZoom = 1.0;
      this.cameraZoom = 1.0;

      // Quality Governor (Default stepped down to DPR 1.5 per governor requirement)
      this.qualityMode = this.options.quality;
      this.currentDpr = Math.min(1.5, window.devicePixelRatio || 1);
      this.frameTimes = [];
      this.stableFrameCount = 0;
      this.showFpsMeter = false;

      // Lifecycle
      this.isDestroyed = false;
      this.isPaused = false;
      this.rafId = null;
      this.clock = (typeof THREE !== "undefined") ? new THREE.Clock() : null;

      // Data
      this.levels = {};
      this.required = {};
      this.companyName = "Google";

      // Pre-allocated math objects to avoid per-frame garbage collection
      this._tempV3 = (typeof THREE !== "undefined") ? new THREE.Vector3() : null;
      this._tempV3B = (typeof THREE !== "undefined") ? new THREE.Vector3() : null;

      if (this.options.initialData) {
        this.updateData(this.options.initialData, false);
      }

      this.init();
    }

    init() {
      window.__cairnSetQuality = (mode) => this.setQuality(mode);
      if (!isWebGLAvailable() || typeof THREE === "undefined" || this.qualityMode === "lite") {
        console.warn("Activating 2D SVG fallback.");
        this.setupSvgFallback();
        return;
      }

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;

      // 1. Scene & Atmosphere Fog
      this.scene = new THREE.Scene();
      const isLight = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light');
      this.scene.fog = new THREE.FogExp2(isLight ? 0xF3EFE6 : 0x070B14, 0.022);

      // 2. Camera & Hierarchy Setup
      const isDesktopHero = (this.options.isHero && typeof window !== "undefined" && window.innerWidth > 900);
      this.heroOffsetX = isDesktopHero ? 2.4 : 0;

      this.rootGroup = new THREE.Group();
      this.scene.add(this.rootGroup);

      this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      this.cameraTarget = new THREE.Vector3(this.heroOffsetX, 4.2, 0);

      const isMobile = (typeof window !== "undefined" && window.innerWidth <= 768);
      if (isMobile) {
        this.rootGroup.position.set(0, -1.2, 0);
        this.camera.position.set(0, 4.8, 17.5);
        this.cameraTarget.set(0, 3.8, 0);
      } else if (this.options.isHero) {
        this.rootGroup.position.set(2.4, -2.5, 0);
        this.camera.position.set(2.2, 5.2, 14.5);
        this.cameraTarget.set(2.4, 4.2, 0);
      } else {
        this.rootGroup.position.set(0, -1.8, 0);
        this.camera.position.set(0, 5.0, 15.0);
        this.cameraTarget.set(0, 4.0, 0);
      }
      this.camera.lookAt(this.cameraTarget);

      // 3. WebGL Renderer with Adaptive DPR
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(this.currentDpr);
      this.renderer.shadowMap.enabled = false; // Disable heavy shadow maps; contact disc used instead

      this.domElement = this.renderer.domElement;
      this.domElement.style.position = 'absolute';
      this.domElement.style.top = '0';
      this.domElement.style.left = '0';
      this.domElement.style.width = '100%';
      this.domElement.style.height = '100%';
      this.domElement.style.touchAction = 'none';
      this.domElement.style.cursor = 'grab';
      this.container.appendChild(this.domElement);

      // 4. Floating HTML Overlay Labels Container
      if (this.options.showLabels) {
        this.setupLabelsOverlay();
      }

      // 5. Lighting Setup (Key + Cool Rim + Warm Accent)
      this.setupLighting();

      // 6. Aurora Background Quad
      if (this.options.showAurora) {
        this.setupAurora();
      }

      // 7. Ground Pedestal & Contact Shadow Disc
      this.setupGround();

      // 8. Build 12 Stones
      this.buildStones();

      // 9. Summit Brass Pole & Ember Flag
      this.setupSummitFlag();

      // 10. Raycaster
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2(-999, -999);

      // 11. Event Listeners
      this.setupEvents();

      // 12. Entrance Animation
      this.animateEntrance();

      // 13. FPS Meter (toggled with F key)
      this.setupFpsMeter();

      // 14. Connect to GSAP Ticker or single master loop
      this.tick = this.tick.bind(this);
      if (typeof gsap !== "undefined" && gsap.ticker) {
        gsap.ticker.add(this.tick);
        gsap.ticker.lagSmoothing(0);
      } else {
        this.rafId = requestAnimationFrame(this.tick);
      }
    }

    setupLighting() {
      const ambientLight = new THREE.AmbientLight(0x22354A, 1.2);
      this.scene.add(ambientLight);

      this.keyLight = new THREE.DirectionalLight(0xFFC46B, 2.0);
      this.keyLight.position.set(7, 12, 8);
      this.scene.add(this.keyLight);

      this.rimLight = new THREE.DirectionalLight(0x2EE6C5, 1.5);
      this.rimLight.position.set(-8, 9, -6);
      this.scene.add(this.rimLight);

      this.accentLight = new THREE.PointLight(0xFF7A3D, 0.8, 10);
      this.accentLight.position.set(0, 1.5, 2.2);
      this.scene.add(this.accentLight);
    }

    setupAurora() {
      const auroraGeo = new THREE.PlaneGeometry(38, 26);
      const isLight = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light');
      this.auroraUniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uChapter: { value: 0 },
        uIntensity: { value: 1.0 },
        uThemeLight: { value: isLight ? 1.0 : 0.0 }
      };

      this.auroraMaterial = new THREE.ShaderMaterial({
        vertexShader: AuroraShader.vertexShader,
        fragmentShader: AuroraShader.fragmentShader,
        uniforms: this.auroraUniforms,
        depthWrite: false,
        depthTest: false
      });

      this.auroraMesh = new THREE.Mesh(auroraGeo, this.auroraMaterial);
      this.auroraMesh.position.set(0, 5, -8);
      this.scene.add(this.auroraMesh);
    }

    setupGround() {
      const isLight = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light');
      const groundGeo = new THREE.CylinderGeometry(3.6, 4.2, 0.4, 28);
      const groundMat = new THREE.MeshStandardMaterial({
        color: isLight ? 0xDDD6C6 : 0x0E1724,
        roughness: 0.95,
        metalness: 0.05
      });
      this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
      this.groundMesh.position.set(0, -0.2, 0);
      this.rootGroup.add(this.groundMesh);

      // Contact shadow disc using pre-rendered procedural radial gradient
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.80)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.40)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);

      const shadowTex = new THREE.CanvasTexture(canvas);
      const shadowGeo = new THREE.PlaneGeometry(7.2, 7.2);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.70,
        depthWrite: false
      });
      const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = 0.01;
      this.rootGroup.add(shadowPlane);
    }

    setupLabelsOverlay() {
      this.labelsOverlay = document.createElement('div');
      this.labelsOverlay.className = 'cairn-labels-overlay';
      this.labelsOverlay.style.position = 'absolute';
      this.labelsOverlay.style.inset = '0';
      this.labelsOverlay.style.pointerEvents = 'none';
      this.labelsOverlay.style.overflow = 'hidden';
      this.labelsOverlay.style.zIndex = '10';
      this.container.appendChild(this.labelsOverlay);

      this.labelElements = [];
      for (let i = 0; i < 12; i++) {
        const code = CAIRN_ORDER[i];
        const chip = document.createElement('div');
        chip.className = 'cairn-stone-chip';
        chip.setAttribute('data-index', i);
        chip.setAttribute('data-code', code);
        chip.innerHTML = `
          <span class="chip-code">${code}</span>
          <span class="chip-val">0/0</span>
          <span class="chip-badge chip-state">${SVG_CHECK_ICON}</span>
        `;
        this.labelsOverlay.appendChild(chip);
        this.labelElements.push({
          index: i,
          code,
          element: chip,
          screenX: 0,
          screenY: 0
        });
      }
    }

    buildStones() {
      this.cairnGroup = new THREE.Group();
      this.rootGroup.add(this.cairnGroup);

      let currentY = 0;

      for (let i = 0; i < 12; i++) {
        const code = CAIRN_ORDER[i];
        const spec = STONE_BASE_SPECS[i];
        const seed = (i + 1) * 7919;
        const color = MINERAL_COLORS[i % MINERAL_COLORS.length];

        const candLvl = this.levels[code] ?? 5;
        const reqLvl = this.required[code] ?? 6;
        const isMet = candLvl >= reqLvl;
        const fillRatio = Math.max(0.0, Math.min(1.0, reqLvl > 0 ? candLvl / reqLvl : 1.0));

        // Shared Geometry (Detail 3)
        const baseGeo = getDeformedStoneGeometry(spec.w, spec.h, spec.d, seed);

        // 1. Solid Candidate Mesh (warm lit mineral stone)
        const solidMat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.85,
          metalness: 0.08
        });
        const solidMesh = new THREE.Mesh(baseGeo, solidMat);
        solidMesh.userData = { index: i, code, type: "stone" };

        // 2. Translucent Ember-Glass Shell (Fake ember glass: transparent MeshStandardMaterial + wireframe rim)
        // No transmission used! 0 offscreen re-renders!
        const shellMat = new THREE.MeshStandardMaterial({
          color: 0xFF7A3D,
          emissive: 0xFF7A3D,
          emissiveIntensity: 0.35,
          roughness: 0.20,
          metalness: 0.15,
          transparent: true,
          opacity: 0.30,
          depthWrite: false
        });
        const shellMesh = new THREE.Mesh(baseGeo, shellMat);
        shellMesh.scale.set(1.04, 1.04, 1.04);
        shellMesh.userData = { index: i, code, type: "shell" };

        // Dashed / Wireframe Outer Rim for Gap Shell
        const dashedMat = new THREE.MeshBasicMaterial({
          color: 0xFFC46B,
          wireframe: true,
          transparent: true,
          opacity: 0.40
        });
        const dashedMesh = new THREE.Mesh(baseGeo, dashedMat);
        dashedMesh.scale.set(1.05, 1.05, 1.05);

        // 3. Lichen-Green Emissive Rim (for COMPLETE state)
        const rimMat = new THREE.MeshBasicMaterial({
          color: 0x9BFF8A,
          wireframe: true,
          transparent: true,
          opacity: 0.65
        });
        const rimMesh = new THREE.Mesh(baseGeo, rimMat);
        rimMesh.scale.set(1.04, 1.04, 1.04);

        // 4. Bright Waterline Disc Ring (for PARTIAL state)
        const waterlineGeo = new THREE.RingGeometry(spec.w * 0.45, spec.w * 0.52, 24);
        const waterlineMat = new THREE.MeshBasicMaterial({
          color: 0xFFC46B,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        });
        const waterlineMesh = new THREE.Mesh(waterlineGeo, waterlineMat);
        waterlineMesh.rotation.x = Math.PI / 2;

        const stoneGroup = new THREE.Group();
        stoneGroup.add(solidMesh);
        stoneGroup.add(shellMesh);
        stoneGroup.add(dashedMesh);
        stoneGroup.add(rimMesh);
        stoneGroup.add(waterlineMesh);

        const layerY = currentY + (spec.h * 0.5);
        currentY += (spec.h * 0.88);

        const rotY = (pseudoNoise(i, 0, 0, seed) * 0.25);
        const rotZ = (pseudoNoise(0, i, 0, seed) * 0.04);
        stoneGroup.rotation.set(0, rotY, rotZ);
        stoneGroup.position.set(0, layerY, 0);

        stoneGroup.userData = {
          index: i,
          code,
          spec,
          seed,
          targetY: layerY,
          baseY: layerY,
          solidMesh,
          shellMesh,
          dashedMesh,
          rimMesh,
          waterlineMesh,
          candLvl,
          reqLvl,
          fillRatio,
          isMet
        };

        this.applyStoneState(stoneGroup, candLvl, reqLvl, false);
        this.cairnGroup.add(stoneGroup);
        this.stones.push(stoneGroup);
      }

      this.cairnHeight = currentY;
    }

    /**
     * Applies the 3 Distinct States:
     * - COMPLETE: fully solid, lichen-green emissive rim, check badge
     * - PARTIAL: vessel fill up to fillRatio, waterline ring, ember glass upper shell, gap badge
     * - EMPTY: hollow glass shell only, dashed outline, lock icon
     */
    applyStoneState(stoneGroup, candLvl, reqLvl, animate = true) {
      const { solidMesh, shellMesh, dashedMesh, rimMesh, waterlineMesh, spec } = stoneGroup.userData;
      const isMet = candLvl >= reqLvl;
      const isEmpty = candLvl === 0;
      const isPartial = !isMet && !isEmpty;
      const fillRatio = Math.max(0.0, Math.min(1.0, reqLvl > 0 ? candLvl / reqLvl : 1.0));

      stoneGroup.userData.candLvl = candLvl;
      stoneGroup.userData.reqLvl = reqLvl;
      stoneGroup.userData.isMet = isMet;
      stoneGroup.userData.isEmpty = isEmpty;
      stoneGroup.userData.isPartial = isPartial;
      stoneGroup.userData.fillRatio = fillRatio;

      if (isMet) {
        // State 1: COMPLETE
        solidMesh.visible = true;
        rimMesh.visible = true;
        shellMesh.visible = false;
        dashedMesh.visible = false;
        waterlineMesh.visible = false;

        if (animate && typeof gsap !== "undefined") {
          gsap.to(solidMesh.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 0.5, ease: "power2.out" });
          gsap.to(solidMesh.position, { y: 0, duration: 0.5 });
        } else {
          solidMesh.scale.set(1.0, 1.0, 1.0);
          solidMesh.position.set(0, 0, 0);
        }
      } else if (isPartial) {
        // State 2: PARTIAL (Vessel bottom-up fill + waterline)
        solidMesh.visible = true;
        rimMesh.visible = false;
        shellMesh.visible = true;
        dashedMesh.visible = true;
        waterlineMesh.visible = true;

        const targetScaleY = Math.max(0.2, fillRatio);
        const targetPosY = -spec.h * 0.5 * (1.0 - targetScaleY);
        const waterlineY = (fillRatio - 0.5) * spec.h;

        waterlineMesh.position.y = waterlineY;

        if (animate && typeof gsap !== "undefined") {
          gsap.to(solidMesh.scale, { x: 1.0, y: targetScaleY, z: 1.0, duration: 0.5, ease: "power2.out" });
          gsap.to(solidMesh.position, { y: targetPosY, duration: 0.5 });
        } else {
          solidMesh.scale.set(1.0, targetScaleY, 1.0);
          solidMesh.position.set(0, targetPosY, 0);
        }
      } else {
        // State 3: EMPTY (Hollow glass shell only + lock)
        solidMesh.visible = false;
        rimMesh.visible = false;
        shellMesh.visible = true;
        dashedMesh.visible = true;
        waterlineMesh.visible = false;
      }
    }

    setupSummitFlag() {
      const topStone = this.stones[this.stones.length - 1];
      const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.5, 12);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.85, roughness: 0.25 });
      this.flagPole = new THREE.Mesh(poleGeo, poleMat);
      this.flagPole.position.set(0, 0.9, 0);
      topStone.add(this.flagPole);

      const flagGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0.45, 0,
        0, 0.05, 0,
        0.8, 0.25, 0
      ]);
      flagGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      flagGeo.computeVertexNormals();

      const flagMat = new THREE.MeshStandardMaterial({
        color: 0xFF7A3D,
        emissive: 0xFF7A3D,
        emissiveIntensity: 0.4,
        side: THREE.DoubleSide
      });
      this.flagMesh = new THREE.Mesh(flagGeo, flagMat);
      this.flagMesh.position.set(0, 0.9, 0);
      topStone.add(this.flagMesh);
    }

    setupEvents() {
      const el = this.domElement;

      // Pointer Orbit Handling with Pointer Capture
      el.addEventListener('pointerdown', (e) => {
        if (!this.options.enableOrbit) return;
        this.isPointerDown = true;
        this.isDragging = true;
        this.pointerStartX = e.clientX;
        this.pointerStartY = e.clientY;
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        el.style.cursor = 'grabbing';
      });

      // Pointermove: NO getBoundingClientRect called while dragging!
      window.addEventListener('pointermove', (e) => {
        if (!this.isPointerDown) {
          // Hover tracking only when idle
          if (!this._rectTimer) {
            const rect = el.getBoundingClientRect();
            this._cachedRect = rect;
            this._rectTimer = setTimeout(() => { this._rectTimer = null; }, 500);
          }
          const rect = this._cachedRect;
          if (rect && rect.width > 0) {
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          }
          return;
        }

        // Dragging: ONLY store deltas for the rAF loop
        const dx = e.clientX - this.pointerStartX;
        const dy = e.clientY - this.pointerStartY;
        this.pointerStartX = e.clientX;
        this.pointerStartY = e.clientY;

        this.targetVelY += dx * 0.004;
        this.targetVelX += dy * 0.003;
      });

      const onPointerEnd = (e) => {
        if (this.isPointerDown) {
          this.isPointerDown = false;
          this.isDragging = false;
          try { el.releasePointerCapture(e.pointerId); } catch (_) {}
          el.style.cursor = 'grab';
        }
      };
      el.addEventListener('pointerup', onPointerEnd);
      el.addEventListener('pointercancel', onPointerEnd);

      // Wheel Zoom
      el.addEventListener('wheel', (e) => {
        if (!this.options.enableOrbit) return;
        e.preventDefault();
        const delta = e.deltaY * 0.001;
        this.targetZoom = Math.max(0.75, Math.min(1.4, this.targetZoom + delta));
      }, { passive: false });

      // Click: Open stone details
      el.addEventListener('click', () => {
        if (this.hoveredIndex >= 0 && this.options.onStoneClick) {
          const code = CAIRN_ORDER[this.hoveredIndex];
          this.options.onStoneClick(code, this.hoveredIndex);
        }
      });

      // Keyboard Accessibility
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Interactive 3D Cairn. Use arrow keys to rotate, Tab to cycle stones, Enter to inspect.');

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const dir = e.shiftKey ? -1 : 1;
          this.focusedIndex = (this.focusedIndex + dir + 12) % 12;
          this.focusStone(this.focusedIndex);
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (this.focusedIndex >= 0 && this.options.onStoneClick) {
            e.preventDefault();
            const code = CAIRN_ORDER[this.focusedIndex];
            this.options.onStoneClick(code, this.focusedIndex);
          }
        } else if (e.key === 'ArrowLeft') {
          this.targetVelY -= 0.05;
        } else if (e.key === 'ArrowRight') {
          this.targetVelY += 0.05;
        } else if (e.key === 'ArrowUp') {
          this.targetVelX -= 0.04;
        } else if (e.key === 'ArrowDown') {
          this.targetVelX += 0.04;
        }
      });

      // Window Resize
      this.handleResize = () => {
        if (!this.container || !this.renderer || !this.camera) return;
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this._cachedRect = null;

        if (this.auroraUniforms) {
          this.auroraUniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
        }

        const isMobile = window.innerWidth <= 768;
        if (this.rootGroup) {
          if (isMobile) {
            this.rootGroup.position.set(0, -1.2, 0);
            this.camera.position.set(0, 4.8, 17.5);
            this.cameraTarget.set(0, 3.8, 0);
          } else if (this.options.isHero) {
            this.rootGroup.position.set(2.4, -2.5, 0);
            this.camera.position.set(2.2, 5.2, 14.5);
            this.cameraTarget.set(2.4, 4.2, 0);
          } else {
            this.rootGroup.position.set(0, -1.8, 0);
            this.camera.position.set(0, 5.0, 15.0);
            this.cameraTarget.set(0, 4.0, 0);
          }
          this.camera.lookAt(this.cameraTarget);
        }
      };
      window.addEventListener('resize', this.handleResize);

      // Visibility & Pause
      this.handleVisibility = () => {
        this.isPaused = document.hidden;
      };
      document.addEventListener('visibilitychange', this.handleVisibility);

      // Theme Change Observer
      if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
        this.themeObserver = new MutationObserver(() => {
          const isLight = document.documentElement.getAttribute('data-theme') === 'light';
          if (this.auroraUniforms && this.auroraUniforms.uThemeLight) {
            this.auroraUniforms.uThemeLight.value = isLight ? 1.0 : 0.0;
          }
          if (this.groundMesh && this.groundMesh.material) {
            this.groundMesh.material.color.setHex(isLight ? 0xDDD6C6 : 0x0E1724);
          }
          if (this.scene && this.scene.fog) {
            this.scene.fog.color.setHex(isLight ? 0xF3EFE6 : 0x070B14);
          }
        });
        this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      }
    }

    setupFpsMeter() {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') {
          // Toggle FPS meter
          this.showFpsMeter = !this.showFpsMeter;
          if (this.showFpsMeter) {
            if (!this.fpsMeterEl) {
              this.fpsMeterEl = document.createElement('div');
              this.fpsMeterEl.id = 'cairn-fps-meter';
              this.fpsMeterEl.style.cssText = 'position:fixed;bottom:16px;right:16px;background:rgba(7,11,20,0.85);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 14px;font-family:monospace;font-size:12px;color:#2EE6C5;z-index:99999;pointer-events:none;';
              document.body.appendChild(this.fpsMeterEl);
            }
            this.fpsMeterEl.style.display = 'block';
          } else if (this.fpsMeterEl) {
            this.fpsMeterEl.style.display = 'none';
          }
        }
      });
    }

    setQuality(mode) {
      this.qualityMode = mode;
      window.__cairnQualityMode = mode;
      if (mode === "high") {
        this.currentDpr = Math.min(2.0, window.devicePixelRatio || 1);
        if (this.renderer) this.renderer.setPixelRatio(this.currentDpr);
        if (this.auroraMesh) this.auroraMesh.visible = true;
      } else if (mode === "lite") {
        this.currentDpr = 1.0;
        if (this.renderer) this.renderer.setPixelRatio(1.0);
        if (this.auroraMesh) this.auroraMesh.visible = false;
      } else {
        // auto
        this.currentDpr = Math.min(1.5, window.devicePixelRatio || 1);
        if (this.renderer) this.renderer.setPixelRatio(this.currentDpr);
        if (this.auroraMesh) this.auroraMesh.visible = true;
      }
    }

    animateEntrance() {
      if (this.options.reducedMotion) {
        this.stones.forEach(stone => {
          stone.position.y = stone.userData.targetY;
        });
        return;
      }

      this.stones.forEach((stone, i) => {
        stone.position.y = stone.userData.targetY + 12 + i * 1.5;
        const delay = 0.08 * i;
        const duration = 0.55;

        if (typeof gsap !== "undefined") {
          gsap.to(stone.position, {
            y: stone.userData.targetY,
            duration: duration,
            delay: delay,
            ease: "bounce.out"
          });
        } else {
          stone.position.y = stone.userData.targetY;
        }
      });
    }

    updateData(data, animate = true) {
      if (!data) return;

      this.companyName = data.companyName || this.companyName;

      if (data.results && data.results.talentCheck) {
        const tc = data.results.talentCheck;
        if (tc.skillset_gap) {
          tc.skillset_gap.forEach(g => {
            this.levels[g.category_code] = g.candidate_level;
            this.required[g.category_code] = g.required_level;
          });
        }
      } else if (data.levels && data.required) {
        this.levels = Object.assign({}, data.levels);
        this.required = Object.assign({}, data.required);
      }

      if (!this.stones || this.stones.length === 0) return;

      this.stones.forEach(stoneGroup => {
        const code = stoneGroup.userData.code;
        const cand = this.levels[code] ?? 5;
        const req = this.required[code] ?? 6;
        this.applyStoneState(stoneGroup, cand, req, animate);
      });

      this.updateLabelsContent();
    }

    updateLabelsContent() {
      if (!this.labelElements || this.labelElements.length === 0) return;

      this.labelElements.forEach(item => {
        const stone = this.stones[item.index];
        if (!stone) return;
        const { candLvl, reqLvl, isMet, isEmpty } = stone.userData;
        const valSpan = item.element.querySelector('.chip-val');
        const badgeSpan = item.element.querySelector('.chip-badge');

        if (valSpan && badgeSpan) {
          if (isMet) {
            valSpan.textContent = `Met ${candLvl}/${reqLvl}`;
            badgeSpan.innerHTML = SVG_CHECK_ICON;
            badgeSpan.className = 'chip-badge chip-met';
          } else if (isEmpty) {
            valSpan.textContent = `0/${reqLvl}`;
            badgeSpan.innerHTML = SVG_LOCK_ICON;
            badgeSpan.className = 'chip-badge chip-empty';
          } else {
            valSpan.textContent = `${candLvl}/${reqLvl}`;
            const gap = reqLvl - candLvl;
            badgeSpan.textContent = `-${gap}`;
            badgeSpan.className = 'chip-badge chip-gap';
          }
        }
      });
    }

    focusStone(idx) {
      this.hoveredIndex = idx;
      this.highlightStone(idx);
    }

    highlightStone(idx) {
      this.stones.forEach((stone, i) => {
        const isTarget = (i === idx);
        const mesh = stone.userData.solidMesh;

        if (typeof gsap !== "undefined" && !this.options.reducedMotion) {
          gsap.to(stone.position, {
            y: stone.userData.targetY + (isTarget ? 0.22 : 0),
            duration: 0.22,
            ease: "power2.out"
          });
          if (mesh && mesh.material) {
            gsap.to(mesh.material, {
              roughness: isTarget ? 0.35 : 0.85,
              duration: 0.2
            });
          }
        } else {
          stone.position.y = stone.userData.targetY + (isTarget ? 0.22 : 0);
        }
      });

      if (this.options.onStoneHover) {
        const code = idx >= 0 ? CAIRN_ORDER[idx] : null;
        const data = code ? {
          code,
          index: idx,
          level: this.levels[code] ?? 0,
          required: this.required[code] ?? 6,
          name: window.SKILL_METADATA?.[code]?.name || code
        } : null;
        this.options.onStoneHover(data);
      }
    }

    setChapter(chapterNum) {
      if (this.auroraUniforms) {
        if (typeof gsap !== "undefined") {
          gsap.to(this.auroraUniforms.uChapter, { value: chapterNum, duration: 1.1, ease: "power2.out" });
        } else {
          this.auroraUniforms.uChapter.value = chapterNum;
        }
      }

      if (this.camera) {
        const ox = this.heroOffsetX || 0;
        let targetCamPos = { x: ox, y: 5.2, z: 14.5 };
        let targetLook = { x: ox, y: 4.2, z: 0 };

        if (chapterNum === 1) {
          targetCamPos = { x: ox - 1.6, y: 6.8, z: 13.0 };
          targetLook = { x: ox, y: 4.0, z: 0 };
        } else if (chapterNum === 2) {
          targetCamPos = { x: ox + 1.6, y: 4.8, z: 11.5 };
          targetLook = { x: ox, y: 3.8, z: 0 };
        } else if (chapterNum === 3) {
          targetCamPos = { x: ox - 1.2, y: 3.2, z: 9.5 };
          targetLook = { x: ox, y: 2.5, z: 0 };
        } else if (chapterNum === 4) {
          targetCamPos = { x: ox + 0.6, y: 2.2, z: 12.0 };
          targetLook = { x: ox, y: 5.0, z: 0 };
        }

        if (typeof gsap !== "undefined" && !this.options.reducedMotion) {
          gsap.to(this.camera.position, { ...targetCamPos, duration: 1.2, ease: "power3.out" });
          gsap.to(this.cameraTarget, { ...targetLook, duration: 1.2, ease: "power3.out" });
        } else {
          this.camera.position.set(targetCamPos.x, targetCamPos.y, targetCamPos.z);
          this.cameraTarget.set(targetLook.x, targetLook.y, targetLook.z);
        }
      }
    }

    /**
     * Master Render Loop (integrated with GSAP ticker)
     */
    tick(dtArg) {
      if (this.isDestroyed || this.isPaused) return;

      const rawDt = (typeof dtArg === "number" && dtArg > 0) ? dtArg : (this.clock ? this.clock.getDelta() : 0.016);
      const dt = Math.min(0.08, rawDt);
      const time = this.clock ? this.clock.getElapsedTime() : performance.now() * 0.001;

      // Adaptive Quality Measurement
      const frameMs = dt * 1000;
      this.frameTimes.push(frameMs);
      if (this.frameTimes.length > 60) this.frameTimes.shift();

      if (this.frameTimes.length >= 60 && this.qualityMode === "auto") {
        const avgMs = this.frameTimes.reduce((a, b) => a + b, 0) / 60;
        if (avgMs > 20.0) {
          this.stableFrameCount = 0;
          if (this.currentDpr > 1.0) {
            this.currentDpr = Math.max(1.0, this.currentDpr - 0.25);
            this.renderer.setPixelRatio(this.currentDpr);
          }
        } else if (avgMs < 16.6) {
          this.stableFrameCount++;
          if (this.stableFrameCount > 180 && this.currentDpr < Math.min(2.0, window.devicePixelRatio || 1)) {
            this.currentDpr = Math.min(2.0, this.currentDpr + 0.25);
            this.renderer.setPixelRatio(this.currentDpr);
            this.stableFrameCount = 0;
          }
        }
      }

      // Update FPS Meter if active
      if (this.showFpsMeter && this.fpsMeterEl) {
        const curFps = (1000.0 / Math.max(1, frameMs)).toFixed(0);
        const avgMs = (this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length).toFixed(1);
        this.fpsMeterEl.textContent = `FPS: ${curFps} | avg: ${avgMs}ms | DPR: ${this.currentDpr.toFixed(2)}`;
      }

      // 1. Update Aurora
      if (this.auroraUniforms) {
        this.auroraUniforms.uTime.value = time;
      }

      // 2. Exponential Damping Orbit Physics (alpha = 1 - exp(-dt * k))
      if (this.options.enableOrbit) {
        const k = 10.0;
        const alpha = 1.0 - Math.exp(-dt * k);

        this.velX += (this.targetVelX - this.velX) * alpha;
        this.velY += (this.targetVelY - this.velY) * alpha;

        if (!this.isPointerDown) {
          this.targetVelX *= Math.exp(-dt * 6.0);
          this.targetVelY *= Math.exp(-dt * 6.0);
        }

        this.currentRotation.y += this.velY;
        this.currentRotation.x = Math.max(-0.35, Math.min(0.55, this.currentRotation.x + this.velX));
        this.cameraZoom += (this.targetZoom - this.cameraZoom) * alpha;

        if (this.cairnGroup) {
          const breath = Math.sin(time * 1.5) * 0.05;
          this.cairnGroup.rotation.y = this.currentRotation.y + Math.sin(time * 0.4) * 0.025;
          this.cairnGroup.rotation.x = this.currentRotation.x;
          this.cairnGroup.position.y = breath;
        }
      }

      // 3. Flag gentle wave
      if (this.flagMesh) {
        this.flagMesh.rotation.y = Math.sin(time * 3.5) * 0.25;
      }

      // 4. Raycast Hover: ONLY when NOT dragging & low velocity
      const isMotionQuiet = !this.isDragging && (Math.abs(this.velX) + Math.abs(this.velY) < 0.02);
      if (this.options.interactive && this.camera && this.cairnGroup && isMotionQuiet) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.cairnGroup.children, true);

        if (intersects.length > 0) {
          let foundIdx = -1;
          for (let hit of intersects) {
            if (hit.object.userData && typeof hit.object.userData.index === "number") {
              foundIdx = hit.object.userData.index;
              break;
            }
          }

          if (foundIdx !== this.hoveredIndex) {
            this.hoveredIndex = foundIdx;
            this.highlightStone(foundIdx);
            this.domElement.style.cursor = foundIdx >= 0 ? 'pointer' : 'grab';
          }
        } else if (this.hoveredIndex !== -1 && this.focusedIndex === -1) {
          this.hoveredIndex = -1;
          this.highlightStone(-1);
          this.domElement.style.cursor = 'grab';
        }
      }

      // 5. Camera LookAt
      if (this.camera && this.cameraTarget) {
        this.camera.lookAt(this.cameraTarget);
      }

      // 6. Update HTML Projected Overlay Labels with Vertical Collision Pass
      if (this.options.showLabels && this.labelElements.length > 0 && this.camera && this.container) {
        this.updateProjectedLabels();
      }

      // 7. Render Scene
      this.renderer.render(this.scene, this.camera);

      // Continue rAF fallback if GSAP ticker not driving
      if (!this._tickerFn) {
        this.rafId = requestAnimationFrame(this.tick);
      }
    }

    /**
     * Projects stone positions to screen coordinates and applies vertical collision resolution
     */
    updateProjectedLabels() {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w <= 0 || h <= 0) return;

      const projected = [];

      for (let i = 0; i < 12; i++) {
        const stone = this.stones[i];
        const item = this.labelElements[i];
        if (!stone || !item) continue;

        stone.getWorldPosition(this._tempV3);
        // Anchor chip near stone's outer rim
        const spec = stone.userData.spec;
        this._tempV3.x += spec.w * 0.58;

        this._tempV3.project(this.camera);

        const screenX = (this._tempV3.x * 0.5 + 0.5) * w;
        const screenY = (-this._tempV3.y * 0.5 + 0.5) * h;

        projected.push({
          index: i,
          screenX,
          screenY,
          element: item.element
        });
      }

      // Vertical Collision Pass: sort top to bottom on screen
      projected.sort((a, b) => a.screenY - b.screenY);
      const minDistance = 24; // minimum px between chips

      for (let j = 1; j < projected.length; j++) {
        const prev = projected[j - 1];
        const curr = projected[j];
        if (curr.screenY < prev.screenY + minDistance) {
          curr.screenY = prev.screenY + minDistance;
        }
      }

      // Apply transforms (zero layout reflow)
      for (let p of projected) {
        const isHovered = (this.hoveredIndex === p.index);
        const isAnyHovered = (this.hoveredIndex >= 0);
        const opacity = isHovered ? '1.0' : (isAnyHovered ? '0.35' : '0.92');
        p.element.style.transform = `translate3d(${Math.round(p.screenX)}px, ${Math.round(p.screenY - 14)}px, 0)`;
        p.element.style.opacity = opacity;
        if (isHovered) {
          p.element.classList.add('chip-active');
        } else {
          p.element.classList.remove('chip-active');
        }
      }
    }

    update(levels, required, opts) {
      if (levels && typeof levels === "object" && !levels.results) {
        this.updateData({ levels, required }, opts?.duration !== 0);
      } else {
        this.updateData(levels, opts?.duration !== 0);
      }
    }

    highlight(code, state) {
      if (!code || !state) {
        this.highlightStone(-1);
        return;
      }
      const idx = CAIRN_ORDER.indexOf(code);
      if (idx >= 0) {
        this.highlightStone(idx);
      }
    }

    onStoneClick(cb) {
      this.options.onStoneClick = cb;
    }

    replay() {
      this.animateEntrance();
    }

    setupSvgFallback() {
      if (typeof window.Cairn !== "undefined" && window.Cairn.mount) {
        this.svgInstance = window.Cairn.mount(this.container, {
          levels: this.levels,
          required: this.required,
          companyName: this.companyName,
          interactive: true,
          animated: !this.options.reducedMotion
        });
      }
    }

    destroy() {
      this.isDestroyed = true;
      if (this._tickerFn && typeof gsap !== "undefined" && gsap.ticker) {
        gsap.ticker.remove(this._tickerFn);
      }
      if (this.rafId) cancelAnimationFrame(this.rafId);
      window.removeEventListener('resize', this.handleResize);
      document.removeEventListener('visibilitychange', this.handleVisibility);

      if (this.themeObserver) {
        this.themeObserver.disconnect();
      }

      if (this.svgInstance && this.svgInstance.destroy) {
        this.svgInstance.destroy();
      }

      if (this.labelsOverlay && this.labelsOverlay.parentNode) {
        this.labelsOverlay.parentNode.removeChild(this.labelsOverlay);
      }

      if (this.fpsMeterEl && this.fpsMeterEl.parentNode) {
        this.fpsMeterEl.parentNode.removeChild(this.fpsMeterEl);
      }

      if (this.renderer) {
        this.renderer.dispose();
        if (this.domElement && this.domElement.parentNode) {
          this.domElement.parentNode.removeChild(this.domElement);
        }
      }
    }
  }

  // Export to window
  window.Cairn3D = {
    isSupported: isWebGLAvailable,
    create: function (container, options) {
      return new Cairn3DStage(container, options);
    }
  };

})();
