// Update year
document.getElementById("year").textContent = new Date().getFullYear();

// Canvas demo
const canvas = document.getElementById("demoCanvas");
const ctx = canvas.getContext("2d", { alpha: true });

const state = {
  running: true,
  t: 0,
  pointer: { x: 0, y: 0, active: false },
  dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
  lines: [],
  cols: 0,
  rows: 0,
  cell: 22,
  baseAngle: Math.PI * 0.18,
  spread: Math.PI * 0.22
};

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

function resize(){
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * state.dpr);
  canvas.height = Math.floor(rect.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  const w = rect.width;
  const h = rect.height;

  state.cell = Math.max(18, Math.min(28, Math.floor(Math.min(w, h) / 14)));
  state.cols = Math.floor((w - 18) / state.cell);
  state.rows = Math.floor((h - 18) / state.cell);

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

function draw(){
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  // Subtle frame
  ctx.save();
  ctx.strokeStyle = "rgba(17,19,24,0.10)";
  ctx.lineWidth = 1;
  roundRect(ctx, 10, 10, w - 20, h - 20, 16);
  ctx.stroke();
  ctx.restore();

  const px = state.pointer.x;
  const py = state.pointer.y;
  const influence = Math.min(w, h) * 0.22;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 1.35;

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
    draw();
  }
  requestAnimationFrame(loop);
}

function setPointerFromEvent(e){
  const rect = canvas.getBoundingClientRect();
  const x = ("touches" in e) ? e.touches[0].clientX : e.clientX;
  const y = ("touches" in e) ? e.touches[0].clientY : e.clientY;
  state.pointer.x = clamp(x - rect.left, 0, rect.width);
  state.pointer.y = clamp(y - rect.top, 0, rect.height);
  state.pointer.active = true;
}

canvas.addEventListener("mousemove", setPointerFromEvent);
canvas.addEventListener("mouseenter", () => state.pointer.active = true);
canvas.addEventListener("mouseleave", () => state.pointer.active = false);

canvas.addEventListener("touchstart", (e) => { setPointerFromEvent(e); }, { passive: true });
canvas.addEventListener("touchmove", (e) => { setPointerFromEvent(e); }, { passive: true });
canvas.addEventListener("touchend", () => { state.pointer.active = false; });

const toggleBtn = document.getElementById("toggleMotion");
toggleBtn.addEventListener("click", () => {
  state.running = !state.running;
  toggleBtn.textContent = state.running ? "Pause" : "Play";
  if(state.running) draw();
});

window.addEventListener("resize", () => {
  resize();
  draw();
});

resize();
draw();
loop();
