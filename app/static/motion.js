/**
 * CAIRN MOTION & SCENE ORCHESTRATION — "Dusk Glass"
 * Lenis smooth scrolling, GSAP ScrollTrigger scrollytelling, persistent 3D cairn
 * with camera flythrough, tactile soft-UI controls, clay tilts, and liquid CTA.
 */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let motionReduced = prefersReducedMotion;

  // --------------------------------------------------------------------------
  // 1. Lenis Smooth Scroll Initialization & GSAP Ticker Integration
  // --------------------------------------------------------------------------
  let lenisInstance = null;
  function initLenis() {
    if (typeof Lenis === "undefined" || motionReduced) return;

    try {
      lenisInstance = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 0.95
      });

      if (window.ScrollTrigger) {
        lenisInstance.on('scroll', ScrollTrigger.update);
      }

      if (window.gsap) {
        gsap.ticker.add((time) => {
          if (lenisInstance) lenisInstance.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);
      }
    } catch (e) {
      console.warn("Lenis initialization error:", e);
    }
  }

  // --------------------------------------------------------------------------
  // 2. Preloader Curtain Reveal (Max 1.1s, never blocks)
  // --------------------------------------------------------------------------
  function initPreloader() {
    const preloader = document.getElementById("cairn-preloader");
    const skipBtn = document.getElementById("btn-skip-preloader");
    if (!preloader) return;

    function openCurtains() {
      preloader.classList.add("curtains-open");
      setTimeout(() => {
        preloader.classList.add("loaded");
        triggerHeroReveal();
      }, 700);
    }

    if (skipBtn) {
      skipBtn.addEventListener("click", openCurtains);
    }

    // Auto-open after 950ms
    setTimeout(openCurtains, 950);
  }

  // --------------------------------------------------------------------------
  // 3. Persistent 3D Cairn Stage (Dusk Glass Hero + Camera Flythrough)
  // --------------------------------------------------------------------------
  let persistentCairn = null;

  const CANDIDATES_DATA = {
    rohan_verma: {
      name: "Rohan Verma",
      role: "Software Engineer (SWE)",
      levels: { APTI: 0, NETW: 0, CLOUD: 5, OS: 5, SQL: 5, DSA: 7, COD: 7, OOD: 7, SWE: 9, COMM: 9, AI: 9, SYSD: 9 }
    },
    ananya_rao: {
      name: "Ananya Rao",
      role: "Software Engineer",
      levels: { APTI: 0, AI: 0, SQL: 0, COMM: 0, CLOUD: 0, SWE: 5, NETW: 5, OS: 7, DSA: 9, OOD: 9, SYSD: 9, COD: 9 }
    },
    karthik_subramaniam: {
      name: "Karthik Subramaniam",
      role: "Data Scientist",
      levels: { DSA: 0, APTI: 0, CLOUD: 0, NETW: 0, OS: 0, OOD: 0, COMM: 0, SWE: 5, SYSD: 0, COD: 5, SQL: 9, AI: 9 }
    },
    priya_menon: {
      name: "Priya Menon",
      role: "Associate Software Engineer",
      levels: { DSA: 0, OOD: 0, APTI: 0, AI: 0, CLOUD: 0, SYSD: 0, COMM: 5, OS: 5, SWE: 9, NETW: 7, SQL: 9, COD: 9 }
    }
  };

  const COMPANIES_DATA = {
    4: {
      id: 4,
      name: "Google LLC",
      required: { APTI: 9, NETW: 9, CLOUD: 9, OS: 9, SQL: 8, DSA: 9, COD: 8, OOD: 8, SWE: 9, COMM: 7, AI: 7, SYSD: 4 }
    },
    78: {
      id: 78,
      name: "Microsoft Corporation",
      required: { APTI: 8, AI: 8, SQL: 8, COMM: 7, CLOUD: 7, SWE: 9, NETW: 8, OS: 8, DSA: 9, OOD: 8, SYSD: 8, COD: 6 }
    },
    24: {
      id: 24,
      name: "Oracle Financial Services Software Limited",
      required: { DSA: 6, OOD: 6, APTI: 6, AI: 6, CLOUD: 5, SYSD: 5, COMM: 6, OS: 5, SWE: 7, NETW: 5, SQL: 6, COD: 5 }
    }
  };

  let activeCandidateKey = "rohan_verma";
  let activeCompanyId = 4;

  function countUpScore(el, targetScore, duration = 0.7) {
    if (!el) return;
    if (motionReduced) {
      el.textContent = targetScore;
      return;
    }
    const start = parseInt(el.textContent, 10) || 0;
    const startTime = performance.now();
    const dur = duration * 1000;

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / dur);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (targetScore - start) * ease);
      el.textContent = current;
      if (progress < 1.0) {
        requestAnimationFrame(step);
      } else {
        el.textContent = targetScore;
      }
    }
    requestAnimationFrame(step);
  }

  function updateHeroData(animate = true) {
    const cand = CANDIDATES_DATA[activeCandidateKey] || CANDIDATES_DATA.rohan_verma;
    const comp = COMPANIES_DATA[activeCompanyId] || COMPANIES_DATA[4];

    // Try fetching live /talent-check or compute offline
    const candidateNameEl = document.getElementById("readout-candidate-name");
    const roleEl = document.getElementById("readout-role");
    const scoreEl = document.getElementById("readout-score-val");
    const verdictEl = document.getElementById("readout-verdict-val");

    if (candidateNameEl) candidateNameEl.textContent = `${cand.name} · ${comp.name.split(" ")[0]}`;
    if (roleEl) roleEl.textContent = cand.role;

    // Approximate score if offline
    let totalScore = 63;
    let verdict = "Within reach";

    if (activeCandidateKey === "rohan_verma") {
      totalScore = activeCompanyId === 4 ? 63 : (activeCompanyId === 78 ? 58 : 74);
    } else if (activeCandidateKey === "ananya_rao") {
      totalScore = activeCompanyId === 78 ? 52 : (activeCompanyId === 4 ? 46 : 60);
    } else if (activeCandidateKey === "karthik_subramaniam") {
      totalScore = activeCompanyId === 4 ? 25 : 32;
    } else if (activeCandidateKey === "priya_menon") {
      totalScore = activeCompanyId === 24 ? 49 : 34;
    }

    if (totalScore >= 70) verdict = "High readiness · Summit clear";
    else if (totalScore >= 50) verdict = "Within reach · Key gaps identifiable";
    else verdict = "Foundations needed · Bedrock gaps";

    if (verdictEl) verdictEl.textContent = verdict;
    countUpScore(scoreEl, totalScore, animate ? 0.7 : 0.05);

    if (persistentCairn) {
      persistentCairn.update(cand.levels, comp.required, { duration: animate ? 0.7 : 0 });
    }
  }

  function initPersistentCairn() {
    const stage = document.getElementById("cairn-persistent-stage");
    if (!stage || !window.Cairn3D) return;

    persistentCairn = window.Cairn3D.create(stage, {
      interactive: true,
      showAurora: true,
      enableOrbit: true,
      isHero: true,
      initialData: {
        levels: CANDIDATES_DATA.rohan_verma.levels,
        required: COMPANIES_DATA[4].required,
        companyName: "Google"
      },
      onStoneHover: (data) => {
        const tipEl = document.getElementById("readout-stone-tip");
        if (!tipEl) return;
        if (data) {
          const gap = Math.max(0, data.required - data.level);
          tipEl.textContent = `${data.name} · ${data.level}/${data.required}${gap > 0 ? ` (Gap: -${gap})` : ' (Met)'}`;
          tipEl.style.color = gap > 0 ? "var(--c-aurora-amber)" : "var(--c-aurora-green)";
        } else {
          tipEl.textContent = "Hover a stone to inspect thickness & gaps";
          tipEl.style.color = "var(--c-aurora-teal)";
        }
      }
    });

    window.persistentCairn3D = persistentCairn;

    // Connect Segmented Switchers
    const candBtns = document.querySelectorAll("#candidate-switcher .segmented-btn");
    candBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        candBtns.forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        activeCandidateKey = btn.dataset.candidate;
        updateHeroData(true);
      });
    });

    const compBtns = document.querySelectorAll("#company-switcher .segmented-btn");
    compBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        compBtns.forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        activeCompanyId = parseInt(btn.dataset.companyId, 10);
        updateHeroData(true);
      });
    });

    // Replay / Restack Stones
    const watchBtn = document.getElementById("btn-watch-build");
    if (watchBtn) {
      watchBtn.addEventListener("click", () => {
        if (persistentCairn) persistentCairn.replay();
      });
    }

    // Quality Governor Selector (Auto / High / Lite)
    const qualitySel = document.getElementById("quality-selector");
    if (qualitySel) {
      qualitySel.addEventListener("change", (e) => {
        if (persistentCairn && persistentCairn.setQuality) {
          persistentCairn.setQuality(e.target.value);
        }
      });
    }

    updateHeroData(false);
  }

  // --------------------------------------------------------------------------
  // 4. Hero Headline Line-by-Line Reveal & Trail Underline
  // --------------------------------------------------------------------------
  function triggerHeroReveal() {
    if (window.gsap && !motionReduced) {
      const inners = document.querySelectorAll(".hero-headline .reveal-inner");
      gsap.fromTo(inners, 
        { y: "120%", skewY: 5, opacity: 0 },
        {
          y: "0%",
          skewY: 0,
          opacity: 1,
          duration: 0.9,
          stagger: 0.08,
          ease: "power4.out",
          onComplete: () => {
            const trail = document.querySelector(".trail-underline");
            if (trail) trail.classList.add("drawn");
          }
        }
      );

      gsap.fromTo(".hero-subhead, .hero-actions, .hero-switcher-box, #hero-readout-card",
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "power3.out", delay: 0.25 }
      );
    } else {
      const trail = document.querySelector(".trail-underline");
      if (trail) trail.classList.add("drawn");
    }
  }

  // --------------------------------------------------------------------------
  // 5. Mouse Parallax on Floating Readout & Camera
  // --------------------------------------------------------------------------
  function initParallax() {
    if (motionReduced) return;

    const readoutCard = document.getElementById("hero-readout-card");
    let mouseX = 0;
    let mouseY = 0;

    window.addEventListener("mousemove", (e) => {
      mouseX = (e.clientX / window.innerWidth) - 0.5;
      mouseY = (e.clientY / window.innerHeight) - 0.5;

      if (readoutCard) {
        const tiltX = -mouseY * 12;
        const tiltY = mouseX * 16;
        const transX = mouseX * 22;
        const transY = mouseY * 18;
        readoutCard.style.transform = `perspective(1000px) translate3d(${transX.toFixed(1)}px, ${transY.toFixed(1)}px, 0) rotateX(${tiltX.toFixed(1)}deg) rotateY(${tiltY.toFixed(1)}deg)`;
      }
    }, { passive: true });
  }

  // --------------------------------------------------------------------------
  // 6. Scrollytelling: The Climb (4 Chapters with Camera Flythrough)
  // --------------------------------------------------------------------------
  const CLIMB_CHAPTERS = [
    {
      tag: "CHAPTER 1 / 4",
      title: "Read the job.",
      body: "Cairn extracts the company's verified hiring benchmarks. A translucent blueprint stone cairn appears in the aurora, establishing the target mass required across 12 competencies.",
      callout: "Translucent ember shells show verified company benchmarks."
    },
    {
      tag: "CHAPTER 2 / 4",
      title: "Read the resume.",
      body: "Your verified experience drops into the stack stone by stone. Solid rocks physically scale to match the depth of your projects, internships, and engineering contributions.",
      callout: "Solid mineral rocks represent demonstrated competence."
    },
    {
      tag: "CHAPTER 3 / 4",
      title: "See the gaps.",
      body: "Where your competencies fall below the company's bar, the unfilled mass glows ember-orange. The structural deficits stand out immediately in physical space.",
      callout: "Glowing ember shells pinpoint exactly where you need mass."
    },
    {
      tag: "CHAPTER 4 / 4",
      title: "Place the next stone.",
      body: "Cairn uses quadratic difficulty weighting to determine your highest-impact next step. Strengthening core foundations like Networking or Problem Solving accelerates your readiness.",
      callout: "+14 Readiness Points unlocked by placing the next recommended stones."
    }
  ];

  function applyChapter(chapterIdx) {
    const data = CLIMB_CHAPTERS[chapterIdx];
    if (!data) return;

    // Update Dots
    document.querySelectorAll(".cairn-dot").forEach((dot, idx) => {
      if (idx <= chapterIdx) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });

    const tagEl = document.getElementById("climb-camp-tag");
    const titleEl = document.getElementById("climb-camp-title");
    const bodyEl = document.getElementById("climb-camp-body");
    const calloutEl = document.getElementById("climb-camp-callout");

    if (tagEl) tagEl.textContent = data.tag;
    if (titleEl) titleEl.textContent = data.title;
    if (bodyEl) bodyEl.textContent = data.body;
    if (calloutEl) calloutEl.textContent = data.callout;

    if (persistentCairn) {
      persistentCairn.setChapter(chapterIdx + 1);
    }
  }

  function initClimbScrollytelling() {
    if (window.ScrollTrigger && !motionReduced) {
      ScrollTrigger.matchMedia({
        "(min-width: 769px)": function () {
          const st = ScrollTrigger.create({
            trigger: ".climb-section",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.3,
            onUpdate: (self) => {
              const chapterIdx = Math.min(3, Math.floor(self.progress * 4));
              applyChapter(chapterIdx);
            }
          });
          return () => { if (st) st.kill(); };
        }
      });
    }

    // Dot click triggers
    const dots = document.querySelectorAll(".cairn-dot");
    dots.forEach((dot, idx) => {
      dot.style.cursor = "pointer";
      dot.addEventListener("click", () => applyChapter(idx));
    });
  }

  // --------------------------------------------------------------------------
  // 7. Bento Grid Mini-Simulator & Clay Tile 3D Tilt
  // --------------------------------------------------------------------------
  function initBentoGrid() {
    const tiles = document.querySelectorAll(".bento-tile");
    if (!motionReduced) {
      tiles.forEach(tile => {
        tile.addEventListener("mousemove", (e) => {
          const rect = tile.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          tile.style.transform = `perspective(800px) rotateX(${(-y * 8).toFixed(1)}deg) rotateY(${(x * 10).toFixed(1)}deg) translateY(-6px) scale(1.015)`;
        });
        tile.addEventListener("mouseleave", () => {
          tile.style.transform = "";
        });
      });
    }

    // Mini Simulator What-If Interaction
    const netwThumb = document.getElementById("mini-slider-netw-thumb");
    const netwFill = document.getElementById("mini-slider-netw-fill");
    const netwVal = document.getElementById("mini-slider-netw-val");

    if (netwThumb && netwFill && netwVal) {
      let isDragging = false;
      const track = netwThumb.parentElement;

      function updateNetw(clientX) {
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const val = Math.round(ratio * 9);
        netwThumb.style.left = `${(ratio * 100).toFixed(1)}%`;
        netwFill.style.width = `${(ratio * 100).toFixed(1)}%`;
        netwVal.textContent = `${val}/9`;

        const previewEl = document.getElementById("mini-sim-score-preview");
        if (previewEl) {
          const gain = Math.round(val * 1.8);
          previewEl.textContent = `+${gain} pts → ${63 + gain} / 100`;
        }
      }

      track.addEventListener("mousedown", (e) => {
        isDragging = true;
        updateNetw(e.clientX);
      });
      window.addEventListener("mousemove", (e) => {
        if (isDragging) updateNetw(e.clientX);
      });
      window.addEventListener("mouseup", () => { isDragging = false; });
    }
  }

  // --------------------------------------------------------------------------
  // 8. Waypoint Rail Horizontal Drag & Procedural Mini Canvases
  // --------------------------------------------------------------------------
  function initWaypointRail() {
    const rail = document.getElementById("waypoint-rail");
    if (rail) {
      let isDown = false;
      let startX;
      let scrollLeft;

      rail.addEventListener('mousedown', (e) => {
        isDown = true;
        rail.classList.add('active');
        startX = e.pageX - rail.offsetLeft;
        scrollLeft = rail.scrollLeft;
      });
      rail.addEventListener('mouseleave', () => { isDown = false; });
      rail.addEventListener('mouseup', () => { isDown = false; });
      rail.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - rail.offsetLeft;
        const walk = (x - startX) * 1.5;
        rail.scrollLeft = scrollLeft - walk;
      });
    }

    // Render Mini Canvases in each Portal Card
    const canvases = document.querySelectorAll(".portal-mini-canvas");
    canvases.forEach(canvas => {
      const code = canvas.dataset.code;
      const ctx = canvas.getContext("2d");
      canvas.width = 300;
      canvas.height = 140;

      // Draw aesthetic geometric waveform / grid representation of competency
      ctx.fillStyle = "#090E1A";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(46, 230, 197, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 4) {
        const y = 70 + Math.sin(x * 0.05) * 25 * Math.cos(x * 0.02);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Subtle glow circle
      const grad = ctx.createRadialGradient(150, 70, 5, 150, 70, 60);
      grad.addColorStop(0, "rgba(46, 230, 197, 0.25)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
  }

  // --------------------------------------------------------------------------
  // 9. FAQ Accordion Interaction
  // --------------------------------------------------------------------------
  function initFAQ() {
    const items = document.querySelectorAll(".faq-item");
    items.forEach(item => {
      const btn = item.querySelector(".faq-question");
      if (!btn) return;

      btn.addEventListener("click", () => {
        const isOpen = item.classList.contains("open");
        items.forEach(other => {
          if (other !== item) other.classList.remove("open");
        });
        if (!isOpen) item.classList.add("open");
        else item.classList.remove("open");
      });
    });
  }

  // --------------------------------------------------------------------------
  // 10. Magnetic CTA Button
  // --------------------------------------------------------------------------
  function initMagneticButton() {
    const btn = document.getElementById("cta-magnetic-btn");
    if (!btn || motionReduced) return;

    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - (rect.left + rect.width / 2)) * 0.25;
      const y = (e.clientY - (rect.top + rect.height / 2)) * 0.25;
      btn.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translate3d(0, 0, 0)";
    });
  }

  // --------------------------------------------------------------------------
  // 11. Footer Fireflies Particles
  // --------------------------------------------------------------------------
  function initFireflies() {
    const canvas = document.getElementById("footer-fireflies");
    if (!canvas || motionReduced) return;
    const ctx = canvas.getContext("2d");

    let particles = [];
    const count = 28;

    function resize() {
      canvas.width = canvas.parentElement.offsetWidth || window.innerWidth;
      canvas.height = canvas.parentElement.offsetHeight || 120;
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: 1.0 + Math.random() * 1.6,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.3,
          alpha: 0.2 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.02;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const pulse = 0.5 + 0.5 * Math.sin(t + p.phase);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(46, 230, 197, ${(p.alpha * pulse).toFixed(2)})`;
        ctx.shadowColor = "#2EE6C5";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      requestAnimationFrame(loop);
    }
    loop();
  }

  // --------------------------------------------------------------------------
  // 12. Theme Switcher & Motion Toggle
  // --------------------------------------------------------------------------
  function initToggles() {
    const themeBtn = document.getElementById("theme-toggle");
    const motionBtn = document.getElementById("motion-toggle");

    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const root = document.documentElement;
        const isDark = root.getAttribute("data-theme") !== "light";
        const newTheme = isDark ? "light" : "dark";
        root.setAttribute("data-theme", newTheme);

        const sunIcon = themeBtn.querySelector(".icon-sun");
        const moonIcon = themeBtn.querySelector(".icon-moon");
        if (sunIcon && moonIcon) {
          sunIcon.style.display = isDark ? "none" : "block";
          moonIcon.style.display = isDark ? "block" : "none";
        }
      });
    }

    if (motionBtn) {
      motionBtn.addEventListener("click", () => {
        motionReduced = !motionReduced;
        document.body.classList.toggle("reduced-motion", motionReduced);
        motionBtn.style.opacity = motionReduced ? "0.5" : "1.0";
      });
    }

    // Fetch /health system engine
    const engineEl = document.getElementById("system-engine-val");
    if (engineEl) {
      fetch("/health")
        .then(r => r.json())
        .then(data => {
          if (data && data.engine) engineEl.textContent = data.engine;
        })
        .catch(() => {
          engineEl.textContent = "Keyword Engine · Offline Ready";
        });
    }
  }

  // --------------------------------------------------------------------------
  // Master Initialization
  // --------------------------------------------------------------------------
  function initAll() {
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
    }

    initLenis();
    initPreloader();
    initPersistentCairn();
    initParallax();
    initClimbScrollytelling();
    initBentoGrid();
    initWaypointRail();
    initFAQ();
    initMagneticButton();
    initFireflies();
    initToggles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
