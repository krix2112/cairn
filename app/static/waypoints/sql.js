/**
 * WAYPOINT 06: SQL — "The Archive"
 * Tint: Oxblood (#E5646B) with Parchment (#E9DFC8) on Dark Walnut (#110A0A)
 * Vaulted archival library with ledger tables, brass lamps, animated query thread joins,
 * real in-memory query execution, index seek vs table scan simulator, and 3NF schema trade-offs.
 */

export function mount(el, ctx) {
  const reducedMotion = ctx.reducedMotion || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let isDestroyed = false;
  let isPaused = false;
  let animId = null;
  let useIndex = true;
  let activeQueryIdx = 0;
  let isExecuting = false;
  let execTimer = null;

  const candLvl = Math.min(10, Math.max(0, ctx.level ?? 6));
  const reqLvl = Math.min(10, Math.max(0, ctx.required ?? 7));

  // In-Memory Database Store for The Archive
  const DB = {
    users: [
      { id: 101, name: "Ada Lovelace", role: "admin", dept: "Architecture", active: true },
      { id: 102, name: "Alan Turing", role: "engineer", dept: "Intelligence", active: true },
      { id: 103, name: "Grace Hopper", role: "admin", dept: "Compilers", active: true },
      { id: 104, name: "Claude Shannon", role: "analyst", dept: "Signals", active: false },
      { id: 105, name: "Margaret Hamilton", role: "lead", dept: "Flight Systems", active: true },
      { id: 106, name: "Donald Knuth", role: "engineer", dept: "Algorithms", active: true }
    ],
    orders: [
      { id: 501, user_id: 101, product_id: 901, amount: 240, status: "completed" },
      { id: 502, user_id: 102, product_id: 903, amount: 120, status: "completed" },
      { id: 503, user_id: 101, product_id: 902, amount: 450, status: "pending" },
      { id: 504, user_id: 105, product_id: 901, amount: 320, status: "completed" },
      { id: 505, user_id: 103, product_id: 904, amount: 890, status: "completed" },
      { id: 506, user_id: 106, product_id: 902, amount: 150, status: "refunded" }
    ],
    products: [
      { id: 901, name: "Telemetry Engine", category: "Core", price: 240 },
      { id: 902, name: "Index Accelerator", category: "Storage", price: 450 },
      { id: 903, name: "Log Buffer Pro", category: "Core", price: 120 },
      { id: 904, name: "ACID Vault Key", category: "Security", price: 890 }
    ],
    events: [
      { id: 8001, user_id: 101, event: "login", created_at: "2026-09-12" },
      { id: 8002, user_id: 102, event: "query_exec", created_at: "2026-09-15" },
      { id: 8003, user_id: 101, event: "export_csv", created_at: "2026-10-02" },
      { id: 8004, user_id: 105, event: "login", created_at: "2026-10-04" },
      { id: 8005, user_id: 103, event: "schema_alter", created_at: "2026-10-09" },
      { id: 8006, user_id: 102, event: "index_create", created_at: "2026-10-14" }
    ],
    payments: [
      { id: 701, order_id: 501, method: "stripe", status: "settled", fee: 4.8 },
      { id: 702, order_id: 502, method: "wire", status: "settled", fee: 15.0 },
      { id: 703, order_id: 503, method: "card", status: "pending", fee: 9.0 },
      { id: 704, order_id: 504, method: "stripe", status: "settled", fee: 6.4 },
      { id: 705, order_id: 505, method: "wire", status: "failed", fee: 0.0 },
      { id: 706, order_id: 506, method: "card", status: "refunded", fee: 3.0 }
    ]
  };

  const QUERIES = [
    {
      id: "select_filter",
      label: "1. Filter with Index",
      sql: "SELECT id, name, dept FROM users WHERE role = 'admin';",
      table: "users",
      explain: "Scans for role = 'admin'. With index: B-Tree directly locates 2 qualifying rows. Without index: Full scan checks all 6 rows.",
      eval: () => {
        const rows = DB.users.filter(u => u.role === "admin").map(u => ({ id: u.id, name: u.name, dept: u.dept }));
        return { cols: ["id", "name", "dept"], rows, stepsScan: DB.users.length, stepsIndex: 2, matchedIds: [101, 103] };
      }
    },
    {
      id: "inner_join",
      label: "2. Key Relational JOIN",
      sql: "SELECT orders.id, users.name, orders.amount FROM orders INNER JOIN users ON orders.user_id = users.id;",
      table: "orders",
      explain: "Hash Join maps orders.user_id to users.id. Glowing relational threads connect matching keys across ledgers.",
      eval: () => {
        const userMap = new Map(DB.users.map(u => [u.id, u.name]));
        const rows = DB.orders.map(o => ({ order_id: o.id, customer: userMap.get(o.user_id) || "Unknown", amount: `$${o.amount}` }));
        return { cols: ["order_id", "customer", "amount"], rows, stepsScan: DB.orders.length, stepsIndex: 1, matchedIds: [501, 502, 503, 504, 505, 506] };
      }
    },
    {
      id: "group_count",
      label: "3. Aggregation & GROUP BY",
      sql: "SELECT status, COUNT(*) AS count, SUM(fee) AS total_fees FROM payments GROUP BY status;",
      table: "payments",
      explain: "Hash aggregate groups rows into status buckets, accumulating count and fees.",
      eval: () => {
        const acc = {};
        DB.payments.forEach(p => {
          if (!acc[p.status]) acc[p.status] = { count: 0, fee: 0 };
          acc[p.status].count++;
          acc[p.status].fee += p.fee;
        });
        const rows = Object.entries(acc).map(([st, v]) => ({ status: st, count: v.count, total_fees: `$${v.fee.toFixed(1)}` }));
        return { cols: ["status", "count", "total_fees"], rows, stepsScan: DB.payments.length, stepsIndex: 3, matchedIds: [701, 702, 703, 704, 705, 706] };
      }
    },
    {
      id: "mau_cohort",
      label: "4. Monthly Active Users (MAU)",
      sql: "SELECT SUBSTR(created_at, 1, 7) AS cohort, COUNT(DISTINCT user_id) AS active_users FROM events GROUP BY cohort;",
      table: "events",
      explain: "Extracts year-month partitions and computes unique active users for executive reporting.",
      eval: () => {
        const cohorts = {};
        DB.events.forEach(e => {
          const m = e.created_at.slice(0, 7);
          cohorts[m] = cohorts[m] || new Set();
          cohorts[m].add(e.user_id);
        });
        const rows = Object.entries(cohorts).map(([m, set]) => ({ cohort: m, active_users: set.size }));
        return { cols: ["cohort", "active_users"], rows, stepsScan: DB.events.length, stepsIndex: 2, matchedIds: [8001, 8002, 8003, 8004, 8005, 8006] };
      }
    },
    {
      id: "truncate_vs_delete",
      label: "5. TRUNCATE vs DELETE",
      sql: "-- TRUNCATE deallocates data pages instantly; DELETE logs every row\nTRUNCATE TABLE events; -- O(1) DDL page release vs O(N) DML undo logging",
      table: "events",
      explain: "DELETE generates undo/redo logs row-by-row and fires row triggers. TRUNCATE is DDL: resets high-water mark, deallocates extents.",
      eval: () => {
        return {
          cols: ["operation", "mechanism", "rollback_support", "relative_speed"],
          rows: [
            { operation: "DELETE", mechanism: "Row-by-row log entry", rollback_support: "Full transaction rollback", relative_speed: "1x (Heavy write I/O)" },
            { operation: "TRUNCATE", mechanism: "Deallocates B-tree pages", rollback_support: "DDL log scope only", relative_speed: "85x (Instant lock release)" }
          ],
          stepsScan: 1,
          stepsIndex: 1,
          matchedIds: []
        };
      }
    }
  ];

  // Shell HTML
  el.style.backgroundColor = "#110A0A";
  el.style.position = "relative";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.overflow = "hidden";
  el.style.color = "#E9DFC8";
  el.style.fontFamily = "var(--font-mono, monospace)";

  el.innerHTML = `
    <div class="archive-stage" style="position: absolute; inset: 0; display: flex; flex-direction: column; padding: 24px 28px 18px; box-sizing: border-box; overflow-y: auto;">
      <!-- Vault Header & Ambient Brass Lamps -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; position: relative; z-index: 2;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #E5646B; box-shadow: 0 0 10px #E5646B;"></span>
            <span style="font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #E5646B; font-weight: 600;">The Archive · Relational Vault</span>
          </div>
          <p style="margin: 4px 0 0; font-size: 13px; color: #A89F91;">
            Vaulted relational ledgers illuminated by candidate competence (${candLvl}/10). Benchmarked requirement: ${reqLvl}/10.
          </p>
        </div>

        <!-- Controls: Index Toggle & Schema Accordion -->
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; background: rgba(229,100,107,0.08); border: 1px solid rgba(229,100,107,0.3); padding: 5px 10px; border-radius: 4px; font-size: 11px;">
            <input type="checkbox" id="sql-index-toggle" ${useIndex ? "checked" : ""} style="accent-color: #E5646B; cursor: pointer;" />
            <span style="color: #E9DFC8; font-weight: 500;">B-Tree Index Active</span>
          </label>
          <div id="step-counter-badge" style="font-size: 11px; padding: 5px 10px; border-radius: 4px; background: rgba(0,0,0,0.4); border: 1px solid rgba(233,223,200,0.15); color: #9BC53D;">
            Seek: 1 Step
          </div>
        </div>
      </div>

      <!-- Lamp Row (Brass lamps lighting the shelves) -->
      <div style="display: flex; justify-content: space-around; align-items: center; margin-bottom: 12px; height: 26px;">
        ${[...Array(10)].map((_, idx) => {
          const isLit = idx < candLvl;
          const isGhost = idx === reqLvl - 1;
          return `
            <div title="Shelf Lamp ${idx + 1}" style="display: flex; flex-direction: column; align-items: center;">
              <div style="width: 1px; height: 10px; background: rgba(233,223,200,0.2);"></div>
              <div style="width: 8px; height: 6px; border-radius: 3px 3px 0 0; background: ${isLit ? "#E5646B" : isGhost ? "transparent" : "#30221E"}; border: 1px solid ${isGhost ? "#E5646B" : "transparent"}; box-shadow: ${isLit ? "0 0 12px rgba(229,100,107,0.8)" : "none"};"></div>
            </div>
          `;
        }).join("")}
      </div>

      <!-- Main Central Visual: Tables Grid & Joining Thread Canvas -->
      <div style="position: relative; flex: 1; min-height: 220px; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 16px;">
        <canvas id="archive-threads-canvas" style="position: absolute; inset: 0; pointer-events: none; z-index: 10; width: 100%; height: 100%;"></canvas>

        <!-- Ledgers Table 1: Users -->
        <div class="ledger-box" id="ledger-users" style="background: rgba(25,16,16,0.85); border: 1px solid rgba(229,100,107,0.25); border-radius: 6px; padding: 10px; overflow-x: auto; box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(229,100,107,0.2); padding-bottom: 6px; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: #E5646B; text-transform: uppercase;">Table: users (PK id)</span>
            <span style="font-size: 10px; color: #8F8275;">6 records · 3NF</span>
          </div>
          <table style="width: 100%; font-size: 10.5px; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="color: #A89F91; border-bottom: 1px solid rgba(233,223,200,0.1);">
                <th style="padding: 3px;">id</th>
                <th style="padding: 3px;">name</th>
                <th style="padding: 3px;">role</th>
                <th style="padding: 3px;">dept</th>
              </tr>
            </thead>
            <tbody>
              ${DB.users.map(u => `
                <tr id="row-users-${u.id}" class="archive-row" style="transition: background 0.25s ease;">
                  <td style="padding: 3px; font-weight: 600; color: #E5646B;">${u.id}</td>
                  <td style="padding: 3px;">${u.name}</td>
                  <td style="padding: 3px; color: ${u.role === 'admin' ? '#FFB020' : '#E9DFC8'};">${u.role}</td>
                  <td style="padding: 3px; color: #A89F91;">${u.dept}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- Ledgers Table 2: Orders -->
        <div class="ledger-box" id="ledger-orders" style="background: rgba(25,16,16,0.85); border: 1px solid rgba(229,100,107,0.25); border-radius: 6px; padding: 10px; overflow-x: auto; box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(229,100,107,0.2); padding-bottom: 6px; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: #E5646B; text-transform: uppercase;">Table: orders (FK user_id)</span>
            <span style="font-size: 10px; color: #8F8275;">6 records</span>
          </div>
          <table style="width: 100%; font-size: 10.5px; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="color: #A89F91; border-bottom: 1px solid rgba(233,223,200,0.1);">
                <th style="padding: 3px;">id</th>
                <th style="padding: 3px;">user_id</th>
                <th style="padding: 3px;">amount</th>
                <th style="padding: 3px;">status</th>
              </tr>
            </thead>
            <tbody>
              ${DB.orders.map(o => `
                <tr id="row-orders-${o.id}" class="archive-row" style="transition: background 0.25s ease;">
                  <td style="padding: 3px; font-weight: 600;">${o.id}</td>
                  <td style="padding: 3px; color: #E5646B;">${o.user_id}</td>
                  <td style="padding: 3px; color: #9BC53D;">$${o.amount}</td>
                  <td style="padding: 3px; color: #A89F91;">${o.status}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- Live Execution Result Panel -->
        <div class="ledger-box" id="ledger-result" style="background: rgba(18,12,12,0.95); border: 1px solid #E5646B; border-radius: 6px; padding: 10px; overflow-x: auto; box-shadow: 0 0 20px rgba(229,100,107,0.15);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(229,100,107,0.3); padding-bottom: 6px; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: #9BC53D; text-transform: uppercase;">Query Output Buffer</span>
            <span id="output-meta-tag" style="font-size: 10px; color: #E9DFC8;">0 ms</span>
          </div>
          <div id="query-result-table-host" style="font-size: 10.5px; max-height: 140px; overflow-y: auto;">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>

      <!-- Query Selector Bar (5 Queries) -->
      <div style="background: rgba(15,10,10,0.8); border: 1px solid rgba(229,100,107,0.25); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
          ${QUERIES.map((q, idx) => `
            <button class="sql-query-btn ${idx === 0 ? "active" : ""}" data-idx="${idx}" style="font-family: inherit; font-size: 11px; padding: 4px 10px; border-radius: 4px; border: 1px solid ${idx === 0 ? "#E5646B" : "rgba(233,223,200,0.2)"}; background: ${idx === 0 ? "rgba(229,100,107,0.18)" : "transparent"}; color: ${idx === 0 ? "#E9DFC8" : "#A89F91"}; cursor: pointer; transition: all 0.2s ease;">
              ${q.label}
            </button>
          `).join("")}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
          <pre id="current-sql-code" style="margin: 0; font-size: 11.5px; color: #E5646B; white-space: pre-wrap; font-family: inherit;"></pre>
          <button id="btn-run-sql" style="font-family: inherit; font-size: 11px; padding: 5px 14px; border-radius: 4px; border: none; background: #E5646B; color: #110A0A; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>Execute</span>
            <span style="font-size: 10px;">▶</span>
          </button>
        </div>
        <p id="sql-explain-text" style="margin: 6px 0 0; font-size: 11px; color: #8F8275;"></p>
      </div>

      <!-- Architectural Schema Note: 3NF vs Denormalized Dimensional Model -->
      <div style="padding: 8px 12px; border-radius: 4px; background: rgba(229,100,107,0.06); border: 1px solid rgba(229,100,107,0.18); font-size: 11px; color: #C9BFA8; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <strong style="color: #E5646B;">Schema Architecture:</strong> 3NF eliminates modification anomalies and optimizes transactional throughput (OLTP); denormalized star/snowflake schemas sacrifice write purity for instant analytical aggregations (OLAP).
        </div>
        <span style="color: #8F8275; font-size: 10px;">Microsoft Data Analyst Benchmark</span>
      </div>
    </div>
  `;

  // Canvas Thread Animation
  const canvas = el.querySelector("#archive-threads-canvas");
  const ctx2d = canvas ? canvas.getContext("2d") : null;
  let threads = [];

  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement || el;
    canvas.width = parent ? parent.clientWidth || 800 : 800;
    canvas.height = parent ? parent.clientHeight || 400 : 400;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function executeQuery(idx) {
    if (isExecuting) return;
    isExecuting = true;
    const q = QUERIES[idx];
    const explainEl = el.querySelector("#sql-explain-text");
    const codeEl = el.querySelector("#current-sql-code");
    const counterEl = el.querySelector("#step-counter-badge");
    const resultHost = el.querySelector("#query-result-table-host");
    const metaTag = el.querySelector("#output-meta-tag");

    if (explainEl) explainEl.textContent = q.explain;
    if (codeEl) codeEl.textContent = q.sql;

    // Reset rows highlight
    el.querySelectorAll(".archive-row").forEach(r => {
      r.style.background = "transparent";
    });

    const evaluated = q.eval();
    const steps = useIndex ? evaluated.stepsIndex : evaluated.stepsScan;

    if (counterEl) {
      counterEl.textContent = useIndex
        ? `Index Seek: ${steps} ${steps === 1 ? 'Step' : 'Steps'} · O(log N)`
        : `Table Scan: ${steps} Steps · O(N)`;
      counterEl.style.color = useIndex ? "#9BC53D" : "#FF9A3D";
    }

    // Highlighting matching rows
    evaluated.matchedIds.forEach(id => {
      const row = el.querySelector(`#row-${q.table}-${id}`);
      if (row) {
        row.style.background = "rgba(229,100,107,0.28)";
      }
    });

    // Animate thread for JOIN
    threads = [];
    if (q.id === "inner_join" && ctx2d && !reducedMotion) {
      const usersBox = el.querySelector("#ledger-users");
      const ordersBox = el.querySelector("#ledger-orders");
      if (usersBox && ordersBox) {
        const uRect = usersBox.getBoundingClientRect();
        const oRect = ordersBox.getBoundingClientRect();
        const cRect = canvas.getBoundingClientRect();

        DB.orders.forEach((o, i) => {
          threads.push({
            x1: (oRect.left + 40) - cRect.left,
            y1: (oRect.top + 60 + i * 20) - cRect.top,
            x2: (uRect.right - 40) - cRect.left,
            y2: (uRect.top + 60 + ((o.user_id - 101) * 20)) - cRect.top,
            progress: 0,
            speed: 0.03 + Math.random() * 0.02
          });
        });
      }
    }

    if (execTimer) clearTimeout(execTimer);
    execTimer = setTimeout(() => {
      if (isDestroyed) return;
      isExecuting = false;

      // Render output table
      let html = `<table style="width: 100%; border-collapse: collapse; text-align: left;"><thead><tr style="color: #A89F91; border-bottom: 1px solid rgba(233,223,200,0.15);">`;
      evaluated.cols.forEach(c => {
        html += `<th style="padding: 3px 6px;">${c}</th>`;
      });
      html += `</tr></thead><tbody>`;
      evaluated.rows.forEach(r => {
        html += `<tr style="border-bottom: 1px solid rgba(233,223,200,0.05);">`;
        evaluated.cols.forEach(c => {
          html += `<td style="padding: 3px 6px; color: #E9DFC8;">${r[c]}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      if (resultHost) resultHost.innerHTML = html;
      if (metaTag) metaTag.textContent = `${evaluated.rows.length} rows returned in ${useIndex ? '0.4 ms' : '2.8 ms'}`;
    }, reducedMotion ? 50 : 350);
  }

  // Initial query execution
  executeQuery(0);

  // Button Listeners
  const queryBtns = el.querySelectorAll(".sql-query-btn");
  queryBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      queryBtns.forEach(b => {
        b.style.background = "transparent";
        b.style.borderColor = "rgba(233,223,200,0.2)";
        b.style.color = "#A89F91";
      });
      btn.style.background = "rgba(229,100,107,0.18)";
      btn.style.borderColor = "#E5646B";
      btn.style.color = "#E9DFC8";
      activeQueryIdx = parseInt(btn.getAttribute("data-idx"), 10);
      executeQuery(activeQueryIdx);
    });
  });

  const btnRun = el.querySelector("#btn-run-sql");
  if (btnRun) {
    btnRun.addEventListener("click", () => executeQuery(activeQueryIdx));
  }

  const idxToggle = el.querySelector("#sql-index-toggle");
  if (idxToggle) {
    idxToggle.addEventListener("change", (e) => {
      useIndex = e.target.checked;
      executeQuery(activeQueryIdx);
    });
  }

  // Render Loop for JOIN threads
  function render() {
    if (isDestroyed) return;
    if (!isPaused && ctx2d && threads.length > 0 && !reducedMotion) {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      threads.forEach(t => {
        if (t.progress < 1) t.progress += t.speed;
        const curX = t.x1 + (t.x2 - t.x1) * t.progress;
        const curY = t.y1 + (t.y2 - t.y1) * t.progress;

        ctx2d.beginPath();
        ctx2d.moveTo(t.x1, t.y1);
        ctx2d.lineTo(curX, curY);
        ctx2d.strokeStyle = "rgba(229, 100, 107, 0.7)";
        ctx2d.lineWidth = 1.8;
        ctx2d.stroke();

        ctx2d.beginPath();
        ctx2d.arc(curX, curY, 2.5, 0, Math.PI * 2);
        ctx2d.fillStyle = "#FFB020";
        ctx2d.fill();
      });
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
      if (execTimer) clearTimeout(execTimer);
      if (animId) cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", resizeCanvas);
    }
  };
}

if (typeof window !== "undefined") {
  window.WAYPOINT_SCENES = window.WAYPOINT_SCENES || {};
  window.WAYPOINT_SCENES.SQL = { mount };
}
