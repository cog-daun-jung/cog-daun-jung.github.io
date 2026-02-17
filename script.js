// =========================
// Daun site script.js (final)
// - Year
// - Active nav highlight
// - Reusable canvas demos
//   * mini demos: demoEnsemble, demoFace, demoDecision
//   * optional big demo: demoCanvas + toggleMotion (only if present)
// =========================

// Update year (safe)
(() => {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();

// Active nav (safe + supports inProgress)
(function setActiveNav(){
  const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  const map = {
    "": "index",
    "index.html": "index",
    "publications.html": "publications",
    "talks.html": "talks",
    "projects.html": "projects",
    "inprogress.html": "inprogress",
    "inprogress.htm": "inprogress",
  };

  const key = map[file] || "index";
  const a = document.querySelector(`.menu a[data-nav="${key}"]`);
  if (a) a.classList.add("active");
})();

// ---------- Utilities ----------
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

// Deterministic hash for repeatable jitter
function hash(a, b){
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function setupCanvas(canvas){
  const ctx = canvas.getContext("2d", { alpha: true });
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resize(){
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height };
  }

  return { ctx, resize, dpr };
}

function attachPointer(canvas, pointer){
  function setPointerFromEvent(e){
    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e) ? e.touches[0].clientX : e.clientX;
    const y = ("touches" in e) ? e.touches[0].clientY : e.clientY;
    pointer.x = clamp(x - rect.left, 0, rect.width);
    pointer.y = clamp(y - rect.top, 0, rect.height);
    pointer.active = true;
  }

  canvas.addEventListener("mousemove", setPointerFromEvent);
  canvas.addEventListener("mouseenter", () => pointer.active = true);
  canvas.addEventListener("mouseleave", () => pointer.active = false);

  canvas.addEventListener("touchstart", (e) => { setPointerFromEvent(e); }, { passive: true });
  canvas.addEventListener("touchmove", (e) => { setPointerFromEvent(e); }, { passive: true });
  canvas.addEventListener("touchend", () => { pointer.active = false; });

  return setPointerFromEvent;
}

// ---------- Demo 1: Ensemble lines (your original logic, generalized) ----------
function createEnsembleLinesDemo(canvas, opts = {}){
  const { ctx, resize } = setupCanvas(canvas);

  const state = {
    running: true,
    t: 0,
    pointer: { x: 0, y: 0, active: false },
    lines: [],
    cols: 0,
    rows: 0,
    cell: 22,
    baseAngle: opts.baseAngle ?? (Math.PI * 0.18),
    spread: opts.spread ?? (Math.PI * 0.22),
    frame: opts.frame ?? false,
    influenceScale: opts.influenceScale ?? 0.22,
    lineWidth: opts.lineWidth ?? 1.35,
    pad: opts.pad ?? 10,
    radius: opts.radius ?? 16,
  };

  attachPointer(canvas, state.pointer);

  function buildGrid(w, h){
    state.cell = Math.max(18, Math.min(28, Math.floor(Math.min(w, h) / 14)));
    state.cols = Math.max(1, Math.floor((w - 18) / state.cell));
    state.rows = Math.max(1, Math.floor((h - 18) / state.cell));

    state.lines = [];
    const x0 = (w - (state.cols - 1) * state.cell) / 2;
    const y0 = (h - (state.rows - 1) * state.cell) / 2;

    for(let r = 0; r < state.rows; r++){
      for(let c = 0; c < state.cols; c++){
        const x = x0 + c * state.cell;
        const y = y0 + r * state.cell;
        const jitter = (hash(c, r) - 0.5) * 0.35;
        state.lines.push({
          x, y,
          seed: hash(r, c),
          angle0: state.baseAngle + jitter
        });
      }
    }
  }

  function doResize(){
    const { w, h } = resize();
    buildGrid(w, h);
    draw(w, h);
  }

  function draw(w, h){
    ctx.clearRect(0, 0, w, h);

    if(state.frame){
      ctx.save();
      ctx.strokeStyle = "rgba(17,19,24,0.10)";
      ctx.lineWidth = 1;
      roundRect(ctx, state.pad, state.pad, w - state.pad * 2, h - state.pad * 2, state.radius);
      ctx.stroke();
      ctx.restore();
    }

    const px = state.pointer.x;
    const py = state.pointer.y;
    const influence = Math.min(w, h) * state.influenceScale;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = state.lineWidth;

    for(const L of state.lines){
      const dx = state.pointer.active ? (L.x - px) : 1e6;
      const dy = state.pointer.active ? (L.y - py) : 1e6;
      const dist = Math.hypot(dx, dy);

      const local = state.pointer.active
        ? Math.exp(-(dist * dist) / (2 * influence * influence))
        : 0;

      const breathe = 0.06 * Math.sin(state.t * 0.018 + L.seed * 6.28);

      const angle = L.angle0
        + breathe
        + local * (state.spread * (0.9 * Math.sin(state.t * 0.03 + L.seed * 6.28)));

      const len = state.cell * 0.48;
      const x1 = L.x - Math.cos(angle) * len * 0.5;
      const y1 = L.y - Math.sin(angle) * len * 0.5;
      const x2 = L.x + Math.cos(angle) * len * 0.5;
      const y2 = L.y + Math.sin(angle) * len * 0.5;

      const alpha = 0.32 + 0.50 * local;
      ctx.strokeStyle = `rgba(17,19,24,${alpha.toFixed(3)})`;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function loop(){
    if(state.running){
      state.t += 1;
      const rect = canvas.getBoundingClientRect();
      draw(rect.width, rect.height);
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", doResize);
  doResize();
  loop();

  return {
    setRunning: (v) => { state.running = !!v; },
    toggle: () => { state.running = !state.running; return state.running; },
    redraw: () => {
      const rect = canvas.getBoundingClientRect();
      draw(rect.width, rect.height);
    }
  };
}

// ---------- Demo 2: Face learning & aging (face-space cloud) ----------
function runFaceDemo(canvas){
  const { ctx, resize } = setupCanvas(canvas);
  const pointer = { x: 0, y: 0, active: false };
  attachPointer(canvas, pointer);

  let t = 0;
  let w = 0, h = 0;

  function doResize(){
    const r = resize();
    w = r.w; h = r.h;
  }

  function tick(){
    t += 1;
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.50;
    const cy = h * 0.52;

    const px = pointer.active ? pointer.x : cx;
    const py = pointer.active ? pointer.y : cy;

    // subtle "face boundary"
    ctx.save();
    ctx.strokeStyle = "rgba(17,19,24,0.09)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.22, h * 0.30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // points around a ring that gently contracts/expands (experience), with local repulsion near cursor (adaptation-ish)
    const n = 140;
    const sigma = (Math.min(w, h) * 0.22);
    for(let i = 0; i < n; i++){
      const a = (i / n) * Math.PI * 2;
      const r0 = 0.92 + 0.22 * Math.sin(t * 0.03 + i * 0.7);
      const rx = w * 0.22 * r0;
      const ry = h * 0.30 * r0;

      let x = cx + Math.cos(a) * rx;
      let y = cy + Math.sin(a) * ry;

      if(pointer.active){
        const dx = x - px;
        const dy = y - py;
        const dist = Math.hypot(dx, dy);
        const k = Math.exp(-(dist * dist) / (2 * sigma * sigma));
        x += (dx / (dist + 1e-6)) * 10 * k;
        y += (dy / (dist + 1e-6)) * 10 * k;
      }

      ctx.fillStyle = `rgba(17,19,24,${pointer.active ? 0.18 : 0.12})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // "prototype / norm" point
    ctx.fillStyle = "rgba(45,91,255,0.55)";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // tiny eye cue
    ctx.fillStyle = "rgba(17,19,24,0.16)";
    ctx.beginPath();
    ctx.arc(cx - w * 0.06, cy - h * 0.05, 2.0, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.06, cy - h * 0.05, 2.0, 0, Math.PI * 2);
    ctx.fill();

    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", doResize);
  doResize();
  tick();
}

// ---------- Demo 3: Decision making (drift-ish trajectory to bounds) ----------
function runDecisionDemo(canvas){
  const { ctx, resize } = setupCanvas(canvas);
  const pointer = { x: 0, y: 0, active: false };
  attachPointer(canvas, pointer);

  let t = 0;
  let w = 0, h = 0;

  const walk = { x: 0, y: 0, vy: 0, done: false, freeze: 0 };
  function resetWalk(){
    walk.x = 0;
    walk.y = 0;
    walk.vy = 0;
    walk.done = false;
    walk.freeze = 0;
  }
  resetWalk();

  function doResize(){
    const r = resize();
    w = r.w; h = r.h;
  }

  function tick(){
    t += 1;
    ctx.clearRect(0, 0, w, h);

    const left = w * 0.12;
    const right = w * 0.88;
    const top = h * 0.22;
    const bottom = h * 0.78;
    const midY = (top + bottom) / 2;

    // bounds
    ctx.save();
    ctx.strokeStyle = "rgba(17,19,24,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.stroke();
    ctx.restore();

    // update random walk
    if(!walk.done){
      const drift = pointer.active ? (pointer.x / w - 0.5) * 0.10 : 0.0;
      walk.vy += drift + (Math.random() - 0.5) * 0.10;
      walk.vy *= 0.86;
      walk.x += 1.8;
      walk.y += walk.vy * 22;

      const y = midY + walk.y;
      const x = left + walk.x;

      if(y < top || y > bottom || x > right){
        walk.done = true;
        walk.freeze = 26;
      }
    } else {
      walk.freeze -= 1;
      if(walk.freeze <= 0) resetWalk();
    }

    // trace (simple curve to current point)
    const x = left + walk.x;
    const y = midY + walk.y;

    ctx.save();
    ctx.strokeStyle = "rgba(17,19,24,0.22)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(left, midY);
    ctx.quadraticCurveTo(left + walk.x * 0.45, midY + walk.y * 0.25, x, y);
    ctx.stroke();

    // particle
    ctx.fillStyle = walk.done ? "rgba(45,91,255,0.55)" : "rgba(17,19,24,0.25)";
    ctx.beginPath();
    ctx.arc(x, y, 3.0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", doResize);
  doResize();
  tick();
}

// ---------- Initialize mini demos if canvases exist ----------
(function initDemos(){
  // Research Interests mini demos
  const c1 = document.getElementById("demoEnsemble");
  const c2 = document.getElementById("demoFace");
  const c3 = document.getElementById("demoDecision");

  if(c1) createEnsembleLinesDemo(c1, { frame: false, influenceScale: 0.25, lineWidth: 1.25 });
  if(c2) runFaceDemo(c2);
  if(c3) runDecisionDemo(c3);

  // Optional: keep the original large hero demo ONLY if it still exists on the page
  const heroCanvas = document.getElementById("demoCanvas");
  if(heroCanvas){
    const heroDemo = createEnsembleLinesDemo(heroCanvas, { frame: true, influenceScale: 0.22, lineWidth: 1.35 });

    // Optional: toggle button if it exists
    const toggleBtn = document.getElementById("toggleMotion");
    if(toggleBtn){
      toggleBtn.addEventListener("click", () => {
        const running = heroDemo.toggle();
        toggleBtn.textContent = running ? "Pause" : "Play";
        if(running) heroDemo.redraw();
      });
    }
  }
})();
// Projects: card tabs (tablist)
(function initProjectCards(){
  const cards = document.querySelectorAll(".project-cards .proj-card");
  const panels = document.querySelectorAll(".project-panel");
  if(!cards.length || !panels.length) return;

  function activate(targetId){
    cards.forEach(c => {
      const on = c.dataset.target === targetId;
      c.classList.toggle("active", on);
      c.setAttribute("aria-selected", on ? "true" : "false");
    });

    panels.forEach(p => {
      const on = p.id === targetId;
      p.classList.toggle("active", on);
      p.setAttribute("aria-hidden", on ? "false" : "true");
    });
  }

  cards.forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.target)));

  const initial = document.querySelector(".project-cards .proj-card.active")?.dataset.target || cards[0].dataset.target;
  activate(initial);
})();

// Slider: autoplay + hover pause + swipe (supports multiple sliders)
(function initSliders(){
  const sliders = document.querySelectorAll("[data-slider]");
  if(!sliders.length) return;

  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  sliders.forEach(slider => {
    const slides = Array.from(slider.querySelectorAll(".slide"));
    const dotsWrap = slider.querySelector("[data-dots]");
    const prevBtn = slider.querySelector("[data-prev]");
    const nextBtn = slider.querySelector("[data-next]");
    if(!slides.length || !dotsWrap || !prevBtn || !nextBtn) return;

    let idx = 0;
    let timer = null;

    const autoplayMs = Number(slider.getAttribute("data-autoplay")) || 0;
    const shouldAutoplay = !prefersReduced && autoplayMs >= 1500;

    function pauseAllVideos(){
      slides.forEach(s => {
        const v = s.querySelector("video");
        if(v && !v.paused) v.pause();
      });
    }

    // Build dots
    dotsWrap.innerHTML = "";
    const dots = slides.map((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot";
      b.setAttribute("aria-label", `Go to slide ${i+1}`);
      b.addEventListener("click", () => go(i, true));
      dotsWrap.appendChild(b);
      return b;
    });

    function render(){
      slides.forEach((s, i) => s.classList.toggle("is-active", i === idx));
      dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
    }

    function go(i, userInitiated=false){
      pauseAllVideos();
      idx = (i + slides.length) % slides.length;
      render();
      if(userInitiated) restartAutoplay();
    }

    function next(userInitiated=false){ go(idx + 1, userInitiated); }
    function prev(userInitiated=false){ go(idx - 1, userInitiated); }

    prevBtn.addEventListener("click", () => prev(true));
    nextBtn.addEventListener("click", () => next(true));

    // Keyboard support
    slider.tabIndex = 0;
    slider.addEventListener("keydown", (e) => {
      if(e.key === "ArrowLeft") prev(true);
      if(e.key === "ArrowRight") next(true);
    });

    // Autoplay
    function stopAutoplay(){
      if(timer){ clearInterval(timer); timer = null; }
    }
    function startAutoplay(){
      if(!shouldAutoplay || autoplayMs === 0) return;
      stopAutoplay();
      timer = setInterval(() => next(false), autoplayMs);
    }
    function restartAutoplay(){
      stopAutoplay();
      startAutoplay();
    }

    // Pause on hover (desktop)
    slider.addEventListener("mouseenter", stopAutoplay);
    slider.addEventListener("mouseleave", startAutoplay);

    // Pause on touch interaction (mobile)
    slider.addEventListener("touchstart", stopAutoplay, { passive: true });
    slider.addEventListener("touchend", startAutoplay, { passive: true });

    // Swipe support
    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    function onTouchStart(e){
      if(!e.touches || e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isSwiping = true;
    }

    function onTouchMove(e){
      if(!isSwiping) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      // If mostly vertical, don't treat as swipe (allow scroll)
      if(Math.abs(dy) > Math.abs(dx) * 1.2){
        isSwiping = false;
        return;
      }

      // Prevent horizontal scroll jitter
      if(Math.abs(dx) > 18) e.preventDefault();
    }

    function onTouchEnd(e){
      if(!isSwiping) return;
      isSwiping = false;

      const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : startX;
      const dx = endX - startX;

      if(Math.abs(dx) > 50){
        if(dx < 0) next(true);
        else prev(true);
      }
    }

    // Attach swipe handlers to the slide viewport
    const viewport = slider.querySelector(".slides");
    if(viewport){
      viewport.addEventListener("touchstart", onTouchStart, { passive: true });
      viewport.addEventListener("touchmove", onTouchMove, { passive: false });
      viewport.addEventListener("touchend", onTouchEnd, { passive: true });
    }

    // Init
    render();
    startAutoplay();
  });
})();
