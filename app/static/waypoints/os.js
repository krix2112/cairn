/**
 * WAYPOINT 01: OS — "The Engine Room"
 * Tint: Copper-Rose (#D98B6A) and Steel (#A9B4C2) on Graphite (#0E0F11)
 * Steampunk CPU turbine with meshing quad-core gears, process queue conveyor, and memory hall.
 * 3 Deep Interactive Tabs:
 * 1. Process Scheduler: Round Robin (q=2), Priority, SJF, FCFS with exact 5-process workload (P1:5, P2:3, P3:8, P4:2, P5:4), live Gantt timeline, mathematically exact Tw and Ttat.
 * 2. Virtual Memory: 4-frame page table with FIFO vs LRU eviction simulator on reference string, hit/fault counter.
 * 3. Concurrency Threads: Mutex Lock toggle demonstrating lost update race condition vs serialized critical section.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let isDestroyed = false;
  let isPaused = false;
  let animId = null;
  let activeTab = "scheduler"; // "scheduler" | "memory" | "threads"
  let schedAlgo = "rr"; // "rr" | "sjf" | "priority" | "fcfs"
  let memAlgo = "lru"; // "fifo" | "lru"
  let hasMutex = false;
  let threadRunning = false;
  let gearAngle = 0;

  const candLvl = Math.min(10, Math.max(0, ctx.level ?? 6));
  const reqLvl = Math.min(10, Math.max(0, ctx.required ?? 7));

  // The 5 fixed processes from specification
  const PROCESSES = [
    { id: "P1", burst: 5, priority: 3, color: "#D98B6A" },
    { id: "P2", burst: 3, priority: 1, color: "#A9B4C2" },
    { id: "P3", burst: 8, priority: 4, color: "#FFB020" },
    { id: "P4", burst: 2, priority: 2, color: "#9BC53D" },
    { id: "P5", burst: 4, priority: 5, color: "#5BC8E8" }
  ];

  // Mathematical Scheduler Engine
  function calculateSchedule(algo) {
    let gantt = [];
    let waitTimes = {};
    let turnTimes = {};

    if (algo === "fcfs") {
      let t = 0;
      PROCESSES.forEach(p => {
        gantt.push({ id: p.id, start: t, end: t + p.burst, color: p.color });
        waitTimes[p.id] = t;
        turnTimes[p.id] = t + p.burst;
        t += p.burst;
      });
    } else if (algo === "sjf") {
      const sorted = [...PROCESSES].sort((a, b) => a.burst - b.burst);
      let t = 0;
      sorted.forEach(p => {
        gantt.push({ id: p.id, start: t, end: t + p.burst, color: p.color });
        waitTimes[p.id] = t;
        turnTimes[p.id] = t + p.burst;
        t += p.burst;
      });
    } else if (algo === "priority") {
      // Lower number = higher priority
      const sorted = [...PROCESSES].sort((a, b) => a.priority - b.priority);
      let t = 0;
      sorted.forEach(p => {
        gantt.push({ id: p.id, start: t, end: t + p.burst, color: p.color });
        waitTimes[p.id] = t;
        turnTimes[p.id] = t + p.burst;
        t += p.burst;
      });
    } else if (algo === "rr") {
      // Round Robin with quantum = 2
      const q = 2;
      const rem = {};
      PROCESSES.forEach(p => rem[p.id] = p.burst);
      let t = 0;
      let completed = 0;
      const lastFinished = {};

      while (completed < PROCESSES.length) {
        let madeProgress = false;
        for (const p of PROCESSES) {
          if (rem[p.id] > 0) {
            madeProgress = true;
            const slice = Math.min(rem[p.id], q);
            gantt.push({ id: p.id, start: t, end: t + slice, color: p.color });
            rem[p.id] -= slice;
            t += slice;
            if (rem[p.id] === 0) {
              completed++;
              lastFinished[p.id] = t;
            }
          }
        }
        if (!madeProgress) break;
      }
      PROCESSES.forEach(p => {
        turnTimes[p.id] = lastFinished[p.id];
        waitTimes[p.id] = turnTimes[p.id] - p.burst;
      });
    }

    const totalWait = Object.values(waitTimes).reduce((a, b) => a + b, 0);
    const totalTurn = Object.values(turnTimes).reduce((a, b) => a + b, 0);
    const avgWait = (totalWait / PROCESSES.length).toFixed(1);
    const avgTurn = (totalTurn / PROCESSES.length).toFixed(1);

    return { gantt, avgWait, avgTurn };
  }

  // Memory Simulation State
  const REF_STRING = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1];
  let memStepIdx = 0;
  let frames = [null, null, null, null];
  let memFaults = 0;
  let memHits = 0;
  let pageHistory = []; // For LRU

  function stepMemory() {
    if (memStepIdx >= REF_STRING.length) return;
    const page = REF_STRING[memStepIdx];
    const hitIdx = frames.indexOf(page);

    if (hitIdx !== -1) {
      memHits++;
      if (memAlgo === "lru") {
        pageHistory = pageHistory.filter(p => p !== page);
        pageHistory.push(page);
      }
    } else {
      memFaults++;
      const emptyIdx = frames.indexOf(null);
      if (emptyIdx !== -1) {
        frames[emptyIdx] = page;
      } else {
        // Eviction
        let evictIdx = 0;
        if (memAlgo === "fifo") {
          evictIdx = (memFaults - 1) % 4;
        } else {
          // LRU
          const lruPage = pageHistory[0];
          evictIdx = frames.indexOf(lruPage);
          if (evictIdx === -1) evictIdx = 0;
        }
        frames[evictIdx] = page;
      }
      pageHistory = pageHistory.filter(p => p !== page);
      pageHistory.push(page);
    }
    memStepIdx++;
    renderMemoryFrames(hitIdx !== -1);
  }

  function resetMemory() {
    memStepIdx = 0;
    frames = [null, null, null, null];
    memFaults = 0;
    memHits = 0;
    pageHistory = [];
    renderMemoryFrames(false);
  }

  el.style.backgroundColor = "#0E0F11";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.style.color = "#D98B6A";
  el.style.fontFamily = "var(--font-mono, monospace)";

  el.innerHTML = `
    <div class="engine-stage" style="position: absolute; inset: 0; display: flex; flex-direction: column; padding: 22px 26px 16px; box-sizing: border-box; overflow-y: auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; position: relative; z-index: 2; flex-wrap: wrap; gap: 8px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #D98B6A; box-shadow: 0 0 10px #D98B6A;"></span>
            <span style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #D98B6A; font-weight: 600;">The Engine Room · Kernel &amp; Systems Primitives</span>
          </div>
          <p style="margin: 4px 0 0; font-size: 13px; color: #A9B4C2;">
            Quad-core CPU turbine. Operating machinery unlocked by candidate level (${candLvl}/10). Benchmarked: ${reqLvl}/10.
          </p>
        </div>

        <!-- Tab Switcher -->
        <div style="display: flex; gap: 6px; background: rgba(14,15,17,0.7); border: 1px solid rgba(217,139,106,0.3); border-radius: 4px; padding: 3px;">
          <button class="os-tab-btn active" data-tab="scheduler" style="font-family: inherit; font-size: 11px; padding: 4px 10px; border-radius: 3px; border: none; background: rgba(217,139,106,0.2); color: #D98B6A; cursor: pointer; font-weight: 600;">
            1. Scheduler (Gantt)
          </button>
          <button class="os-tab-btn" data-tab="memory" style="font-family: inherit; font-size: 11px; padding: 4px 10px; border-radius: 3px; border: none; background: transparent; color: #A9B4C2; cursor: pointer;">
            2. Virtual Memory
          </button>
          <button class="os-tab-btn" data-tab="threads" style="font-family: inherit; font-size: 11px; padding: 4px 10px; border-radius: 3px; border: none; background: transparent; color: #A9B4C2; cursor: pointer;">
            3. Mutex &amp; Race
          </button>
        </div>
      </div>

      <!-- Main Engine Viewport: SVG Quad-Core Gears & Conveyor -->
      <div style="position: relative; flex: 1; min-height: 250px; background: radial-gradient(circle at 50% 50%, rgba(217,139,106,0.06) 0%, rgba(14,15,17,0.95) 75%); border: 1px solid rgba(217,139,106,0.2); border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
        <canvas id="engine-gears-canvas" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;"></canvas>

        <!-- Tab 1: Scheduler Panel -->
        <div id="panel-scheduler" class="os-panel" style="position: absolute; inset: 0; padding: 14px 18px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; z-index: 10;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 6px;">
              ${["rr", "sjf", "priority", "fcfs"].map(a => `
                <button class="os-algo-btn ${a === schedAlgo ? 'active' : ''}" data-algo="${a}" style="font-family: inherit; font-size: 10.5px; padding: 3px 8px; border-radius: 3px; border: 1px solid ${a === schedAlgo ? '#D98B6A' : 'rgba(169,180,194,0.2)'}; background: ${a === schedAlgo ? 'rgba(217,139,106,0.2)' : 'transparent'}; color: ${a === schedAlgo ? '#D98B6A' : '#A9B4C2'}; cursor: pointer;">
                  ${a.toUpperCase()}
                </button>
              `).join("")}
            </div>
            <div id="sched-metrics" style="font-size: 11px; color: #A9B4C2; background: rgba(0,0,0,0.4); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(217,139,106,0.2);">
              Avg Waiting: <strong style="color: #9BC53D;" id="val-avg-wait">--</strong> ms · Avg Turnaround: <strong style="color: #FFB020;" id="val-avg-turn">--</strong> ms
            </div>
          </div>

          <!-- Live Gantt Chart Box -->
          <div style="background: rgba(14,15,17,0.85); border: 1px solid rgba(217,139,106,0.3); border-radius: 4px; padding: 10px 14px;">
            <div style="font-size: 10px; color: #D98B6A; font-weight: 700; margin-bottom: 6px; text-transform: uppercase;">
              Execution Timeline (Gantt) · Workload: P1:5ms, P2:3ms, P3:8ms, P4:2ms, P5:4ms
            </div>
            <div id="gantt-chart-bar" style="height: 34px; display: flex; width: 100%; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);"></div>
            <div id="gantt-ticks" style="display: flex; justify-content: space-between; font-size: 9px; color: #7B8594; margin-top: 4px;"></div>
          </div>

          <div style="font-size: 10.5px; color: #8F99A8; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 4px;">
            <strong>Scheduler Invariant:</strong> Preemptive Round Robin guarantees response fairness; Shortest Job First mathematically minimizes average waiting time ($T_w$) at the risk of long-job starvation.
          </div>
        </div>

        <!-- Tab 2: Memory Panel -->
        <div id="panel-memory" class="os-panel" style="position: absolute; inset: 0; padding: 14px 18px; box-sizing: border-box; display: none; flex-direction: column; justify-content: space-between; z-index: 10;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size: 11px; color: #A9B4C2;">Page Replacement:</span>
              <button id="btn-mem-lru" style="font-family: inherit; font-size: 10.5px; padding: 3px 8px; border-radius: 3px; border: 1px solid #D98B6A; background: rgba(217,139,106,0.2); color: #D98B6A; cursor: pointer;">LRU</button>
              <button id="btn-mem-fifo" style="font-family: inherit; font-size: 10.5px; padding: 3px 8px; border-radius: 3px; border: 1px solid rgba(169,180,194,0.2); background: transparent; color: #A9B4C2; cursor: pointer;">FIFO</button>
            </div>
            <div style="display: flex; gap: 8px;">
              <button id="btn-mem-step" style="font-family: inherit; font-size: 10.5px; padding: 4px 12px; border-radius: 4px; border: 1px solid #9BC53D; background: rgba(155,197,61,0.15); color: #9BC53D; font-weight: 700; cursor: pointer;">Step Page Ref ▶</button>
              <button id="btn-mem-reset" style="font-family: inherit; font-size: 10.5px; padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(169,180,194,0.2); background: transparent; color: #A9B4C2; cursor: pointer;">Reset</button>
            </div>
          </div>

          <!-- 4 Physical Memory Frames Bays -->
          <div style="display: flex; justify-content: center; gap: 16px; margin: 10px 0;">
            ${[0, 1, 2, 3].map(i => `
              <div id="frame-bay-${i}" style="width: 100px; height: 90px; border-radius: 6px; background: rgba(14,15,17,0.85); border: 1.5px solid rgba(217,139,106,0.4); display: flex; flex-direction: column; align-items: center; justify-content: center; transition: all 0.3s ease;">
                <span style="font-size: 9px; color: #7B8594; text-transform: uppercase;">Frame Bay ${i}</span>
                <span id="frame-val-${i}" style="font-size: 24px; font-weight: 700; color: #A9B4C2; margin-top: 4px;">--</span>
              </div>
            `).join("")}
          </div>

          <!-- Reference String Stream & Stats -->
          <div style="background: rgba(14,15,17,0.7); border: 1px solid rgba(217,139,106,0.2); border-radius: 4px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 10.5px;">
              <span style="color: #7B8594;">Reference String: </span>
              <span id="mem-ref-string" style="color: #D98B6A; font-weight: 600;">${REF_STRING.join(", ")}</span>
            </div>
            <div style="font-size: 11px;">
              Faults: <strong id="val-mem-faults" style="color: #E5646B;">0</strong> · Hits: <strong id="val-mem-hits" style="color: #9BC53D;">0</strong>
            </div>
          </div>
        </div>

        <!-- Tab 3: Threads Panel -->
        <div id="panel-threads" class="os-panel" style="position: absolute; inset: 0; padding: 14px 18px; box-sizing: border-box; display: none; flex-direction: column; justify-content: space-between; z-index: 10;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; background: rgba(217,139,106,0.1); border: 1px solid rgba(217,139,106,0.3); padding: 4px 10px; border-radius: 4px; font-size: 11px;">
                <input type="checkbox" id="os-mutex-toggle" style="accent-color: #9BC53D; cursor: pointer;" />
                <span style="color: #D98B6A; font-weight: 600;">pthread_mutex_t Active</span>
              </label>
              <button id="btn-run-threads" style="font-family: inherit; font-size: 11px; padding: 5px 14px; border-radius: 4px; border: 1px solid #D98B6A; background: #D98B6A; color: #0E0F11; font-weight: 700; cursor: pointer;">
                Execute Concurrency Test
              </button>
            </div>
            <div style="font-size: 11px; color: #A9B4C2;">
              Expected Invariant: <strong style="color: #9BC53D;">2,000 increments</strong>
            </div>
          </div>

          <!-- Counter Readout Gauge -->
          <div style="text-align: center; padding: 16px; background: rgba(14,15,17,0.85); border: 1px solid rgba(217,139,106,0.3); border-radius: 6px;">
            <div style="font-size: 11px; color: #7B8594; text-transform: uppercase;">Shared volatile int counter</div>
            <div id="thread-counter-val" style="font-size: 42px; font-weight: 800; color: #D98B6A; margin: 6px 0; font-family: var(--font-fraunces, serif);">
              0
            </div>
            <div id="thread-result-status" style="font-size: 11px; color: #A9B4C2;">
              Thread 1 (+1000) &amp; Thread 2 (+1000) waiting to enter critical section.
            </div>
          </div>

          <div style="font-size: 10.5px; color: #8F99A8; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 4px;">
            <strong>Atomic Invariant:</strong> Without hardware CAS (Compare-And-Swap) or kernel mutexes, interleaved read-modify-write instructions clobber intermediate register state, triggering lost updates.
          </div>
        </div>
      </div>

      <!-- Footer Machining Note -->
      <div style="padding: 8px 12px; border-radius: 4px; background: rgba(217,139,106,0.05); border: 1px solid rgba(217,139,106,0.15); font-size: 10.5px; color: #C4CCD6; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <strong style="color: #D98B6A;">Kernel Primitives:</strong> Context switches incur direct cache translation lookaside buffer (TLB) flush overhead; memory paging virtualization enables process isolation via page tables.
        </div>
        <span style="color: #7B8594; font-size: 10px;">Foundational Systems Benchmark</span>
      </div>
    </div>
  `;

  // Canvas Meshing Gears
  const canvas = el.querySelector("#engine-gears-canvas");
  const ctx2d = canvas ? canvas.getContext("2d") : null;

  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement || el;
    canvas.width = parent ? parent.clientWidth || 800 : 800;
    canvas.height = parent ? parent.clientHeight || 400 : 400;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function drawGear(cx, cy, radius, teeth, angle, color) {
    if (!ctx2d) return;
    ctx2d.save();
    ctx2d.translate(cx, cy);
    ctx2d.rotate(angle);
    ctx2d.beginPath();
    ctx2d.strokeStyle = color;
    ctx2d.lineWidth = 1.8;

    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const nextA = ((i + 1) / teeth) * Math.PI * 2;
      const midA = a + (nextA - a) * 0.5;
      ctx2d.lineTo(Math.cos(a) * (radius - 5), Math.sin(a) * (radius - 5));
      ctx2d.lineTo(Math.cos(midA) * (radius + 5), Math.sin(midA) * (radius + 5));
      ctx2d.lineTo(Math.cos(nextA) * (radius - 5), Math.sin(nextA) * (radius - 5));
    }
    ctx2d.closePath();
    ctx2d.stroke();
    ctx2d.beginPath();
    ctx2d.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
    ctx2d.stroke();
    ctx2d.restore();
  }

  function renderScheduler(algo) {
    const res = calculateSchedule(algo);
    const avgWaitEl = el.querySelector("#val-avg-wait");
    const avgTurnEl = el.querySelector("#val-avg-turn");
    const ganttBar = el.querySelector("#gantt-chart-bar");
    const ticksEl = el.querySelector("#gantt-ticks");

    if (avgWaitEl) avgWaitEl.textContent = res.avgWait;
    if (avgTurnEl) avgTurnEl.textContent = res.avgTurn;

    const totalDuration = res.gantt[res.gantt.length - 1].end;

    if (ganttBar) {
      ganttBar.innerHTML = res.gantt.map(g => {
        const pct = ((g.end - g.start) / totalDuration) * 100;
        return `
          <div style="width: ${pct}%; background: ${g.color}; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #0E0F11; border-right: 1px solid rgba(0,0,0,0.3);" title="${g.id} (${g.start}-${g.end}ms)">
            ${g.id}
          </div>
        `;
      }).join("");
    }

    if (ticksEl) {
      ticksEl.innerHTML = `<span>0ms</span><span>${Math.round(totalDuration * 0.5)}ms</span><span>${totalDuration}ms</span>`;
    }
  }
  renderScheduler("rr");

  function renderMemoryFrames(isHit) {
    for (let i = 0; i < 4; i++) {
      const valEl = el.querySelector(`#frame-val-${i}`);
      const bayEl = el.querySelector(`#frame-bay-${i}`);
      if (valEl) valEl.textContent = frames[i] !== null ? frames[i] : "--";
      if (bayEl) {
        if (frames[i] !== null) {
          bayEl.style.borderColor = isHit ? "#9BC53D" : "#D98B6A";
        } else {
          bayEl.style.borderColor = "rgba(217,139,106,0.3)";
        }
      }
    }
    const faultsEl = el.querySelector("#val-mem-faults");
    const hitsEl = el.querySelector("#val-mem-hits");
    if (faultsEl) faultsEl.textContent = memFaults;
    if (hitsEl) hitsEl.textContent = memHits;
  }

  // Tab Listeners
  const tabBtns = el.querySelectorAll(".os-tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => {
        b.style.background = "transparent";
        b.style.color = "#A9B4C2";
      });
      btn.style.background = "rgba(217,139,106,0.2)";
      btn.style.color = "#D98B6A";
      activeTab = btn.getAttribute("data-tab");

      el.querySelectorAll(".os-panel").forEach(p => p.style.display = "none");
      const targetPanel = el.querySelector(`#panel-${activeTab}`);
      if (targetPanel) targetPanel.style.display = "flex";
    });
  });

  // Algo Listeners
  const algoBtns = el.querySelectorAll(".os-algo-btn");
  algoBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      algoBtns.forEach(b => {
        b.style.background = "transparent";
        b.style.borderColor = "rgba(169,180,194,0.2)";
        b.style.color = "#A9B4C2";
      });
      btn.style.background = "rgba(217,139,106,0.2)";
      btn.style.borderColor = "#D98B6A";
      btn.style.color = "#D98B6A";
      schedAlgo = btn.getAttribute("data-algo");
      renderScheduler(schedAlgo);
    });
  });

  // Memory Listeners
  const btnStepMem = el.querySelector("#btn-mem-step");
  if (btnStepMem) btnStepMem.addEventListener("click", stepMemory);
  const btnResetMem = el.querySelector("#btn-mem-reset");
  if (btnResetMem) btnResetMem.addEventListener("click", resetMemory);

  const btnLru = el.querySelector("#btn-mem-lru");
  const btnFifo = el.querySelector("#btn-mem-fifo");
  if (btnLru && btnFifo) {
    btnLru.addEventListener("click", () => {
      memAlgo = "lru";
      btnLru.style.borderColor = "#D98B6A";
      btnLru.style.color = "#D98B6A";
      btnLru.style.background = "rgba(217,139,106,0.2)";
      btnFifo.style.borderColor = "rgba(169,180,194,0.2)";
      btnFifo.style.color = "#A9B4C2";
      btnFifo.style.background = "transparent";
      resetMemory();
    });
    btnFifo.addEventListener("click", () => {
      memAlgo = "fifo";
      btnFifo.style.borderColor = "#D98B6A";
      btnFifo.style.color = "#D98B6A";
      btnFifo.style.background = "rgba(217,139,106,0.2)";
      btnLru.style.borderColor = "rgba(169,180,194,0.2)";
      btnLru.style.color = "#A9B4C2";
      btnLru.style.background = "transparent";
      resetMemory();
    });
  }

  // Threads Mutex Listeners
  const mutexToggle = el.querySelector("#os-mutex-toggle");
  if (mutexToggle) {
    mutexToggle.addEventListener("change", (e) => {
      hasMutex = e.target.checked;
    });
  }

  const btnThreads = el.querySelector("#btn-run-threads");
  const counterVal = el.querySelector("#thread-counter-val");
  const resultStatus = el.querySelector("#thread-result-status");

  if (btnThreads) {
    btnThreads.addEventListener("click", () => {
      if (threadRunning) return;
      threadRunning = true;
      let count = 0;
      const target = hasMutex ? 2000 : 1420 + Math.floor(Math.random() * 160);

      const intv = setInterval(() => {
        if (isDestroyed) { clearInterval(intv); return; }
        count += 60;
        if (count >= target) {
          count = target;
          clearInterval(intv);
          threadRunning = false;
          if (counterVal) counterVal.textContent = count.toLocaleString();
          if (resultStatus) {
            if (hasMutex) {
              resultStatus.innerHTML = "<span style='color: #9BC53D; font-weight: 700;'>MUTEX PROTECTED:</span> Exactly 2,000 increments. Critical section serialized safely.";
            } else {
              resultStatus.innerHTML = `<span style='color: #E5646B; font-weight: 700;'>RACE CONDITION:</span> Lost ${2000 - count} updates! Non-atomic assembly read-modify-write collision.`;
            }
          }
        } else {
          if (counterVal) counterVal.textContent = count.toLocaleString();
        }
      }, 25);
    });
  }

  // Render Loop
  function render() {
    if (isDestroyed) return;
    if (!isPaused && ctx2d && !reducedMotion) {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      gearAngle += 0.015;

      const cx = canvas.width * 0.5;
      const cy = canvas.height * 0.5;

      // Draw Quad-core CPU Meshing Gears
      const numGears = Math.min(4, Math.max(1, Math.round(candLvl * 0.4)));
      drawGear(cx - 70, cy - 30, 48, 16, gearAngle, "#D98B6A");
      if (numGears >= 2) drawGear(cx + 20, cy - 30, 48, 16, -gearAngle, "#A9B4C2");
      if (numGears >= 3) drawGear(cx - 70, cy + 60, 48, 16, -gearAngle, "#FFB020");
      if (numGears >= 4) drawGear(cx + 20, cy + 60, 48, 16, gearAngle, "#9BC53D");
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
  window.WAYPOINT_SCENES.OS = { mount };
}
