// Minimal canvas charts for the Analytics page: one series per chart, a quiet
// grid, and a hover tooltip. Text stays in text colors, never the series color.

const MARK = '#0e7a50';
const MARK_FILL = 'rgba(14,122,80,0.10)';
const GRID = 'rgba(14,16,19,0.07)';
const AXIS_TEXT = '#677080';
const FONT = '500 11px "JetBrains Mono", ui-monospace, monospace';

function setup(canvas) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

// "Nice" upper bound for 4 gridlines; whole-number steps for counts.
function niceMax(v, integer = false) {
  if (integer) return Math.max(4, Math.ceil(v / 4) * 4);
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(m => m >= v);
}

function tooltip(wrap) {
  let tip = wrap.querySelector('.chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    wrap.appendChild(tip);
  }
  return tip;
}

function frame(ctx, w, h, max, fmt, pad, lo = 0) {
  ctx.font = FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h - pad.t - pad.b) * (1 - i / 4);
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(y) + 0.5);
    ctx.lineTo(w - pad.r, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.fillStyle = AXIS_TEXT;
    ctx.fillText(fmt(lo + ((max - lo) * i) / 4), pad.l - 8, y);
  }
}

// points: [{ x: number (ms), y: number }]
export function lineChart(canvas, points, { fmt = String, axis = fmt, xfmt = String, label = '', integer = false, floor = false, empty = '' } = {}) {
  const wrap = canvas.parentElement;
  const draw = hover => {
    const { ctx, w, h } = setup(canvas);
    const pad = { l: 64, r: 12, t: 12, b: 26 };
    if (points.length < 2 || (empty && !points.some(p => p.y > 0))) {
      ctx.font = FONT; ctx.fillStyle = AXIS_TEXT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(points.length < 2 ? 'Collecting marks' : empty, w / 2, h / 2);
      tooltip(wrap).hidden = true;
      return;
    }
    const ys = points.map(p => p.y);
    let lo = 0, max;
    if (floor) { const mn = Math.min(...ys), mx = Math.max(...ys), span = Math.max(mx - mn, Math.abs(mx) * 0.002, 1e-9); lo = mn - span * 0.15; max = mx + span * 0.15; }
    else max = niceMax(Math.max(...ys) * (integer ? 1 : 1.1), integer);
    frame(ctx, w, h, max, axis, pad, lo);
    const x0 = points[0].x, x1 = points.at(-1).x;
    const X = x => pad.l + ((x - x0) / Math.max(1, x1 - x0)) * (w - pad.l - pad.r);
    const Y = y => pad.t + (h - pad.t - pad.b) * (1 - (y - lo) / (max - lo));

    // x labels: start, middle, end
    ctx.textAlign = 'center'; ctx.fillStyle = AXIS_TEXT;
    for (const p of [points[0], points[points.length >> 1], points.at(-1)]) ctx.fillText(xfmt(p.x), Math.min(w - 30, Math.max(pad.l + 20, X(p.x))), h - 10);

    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.lineTo(X(x1), Y(lo)); ctx.lineTo(X(x0), Y(lo)); ctx.closePath();
    ctx.fillStyle = MARK_FILL;
    ctx.fill();
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.strokeStyle = MARK; ctx.lineWidth = 1.75; ctx.lineJoin = 'round';
    ctx.stroke();

    const tip = tooltip(wrap);
    if (hover == null) { tip.hidden = true; return; }
    const p = points.reduce((best, q) => (Math.abs(X(q.x) - hover) < Math.abs(X(best.x) - hover) ? q : best));
    ctx.strokeStyle = 'rgba(14,16,19,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(X(p.x)) + 0.5, pad.t); ctx.lineTo(Math.round(X(p.x)) + 0.5, h - pad.b); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 4, 0, Math.PI * 2);
    ctx.fillStyle = MARK; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    tip.hidden = false;
    tip.innerHTML = `<span>${xfmt(p.x)}</span><b>${fmt(p.y)}</b>${label ? `<em>${label}</em>` : ''}`;
    tip.style.left = `${Math.min(w - tip.offsetWidth - 4, Math.max(4, X(p.x) - tip.offsetWidth / 2))}px`;
    tip.style.top = `${Math.max(0, Y(p.y) - tip.offsetHeight - 12)}px`;
  };
  bindHover(canvas, draw);
  draw(null);
}

// items: [{ label: string, value: number, sub?: string }]
export function barChart(canvas, items, { fmt = String, axis = fmt, label = '', every = 1 } = {}) {
  const wrap = canvas.parentElement;
  const draw = hover => {
    const { ctx, w, h } = setup(canvas);
    const pad = { l: 64, r: 12, t: 12, b: 26 };
    if (!items.length) {
      ctx.font = FONT; ctx.fillStyle = AXIS_TEXT; ctx.textAlign = 'center';
      ctx.fillText('nothing yet', w / 2, h / 2);
      return;
    }
    const max = niceMax(Math.max(...items.map(i => i.value)) * 1.1);
    frame(ctx, w, h, max, axis, pad);
    const slot = (w - pad.l - pad.r) / items.length;
    const bw = Math.max(2, Math.min(28, slot - 2));      // 2px surface gap between bars
    const base = h - pad.b;
    let hit = -1;
    items.forEach((it, i) => {
      const x = pad.l + i * slot + (slot - bw) / 2;
      const bh = ((h - pad.t - pad.b) * it.value) / max;
      if (hover != null && hover >= pad.l + i * slot && hover < pad.l + (i + 1) * slot) hit = i;
      ctx.fillStyle = hit === i ? '#3fd98e' : MARK;
      if (bh > 0) {
        const r = Math.min(4, bw / 2, bh);                // rounded data end, square at the baseline
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x, base - bh + r);
        ctx.quadraticCurveTo(x, base - bh, x + r, base - bh);
        ctx.lineTo(x + bw - r, base - bh);
        ctx.quadraticCurveTo(x + bw, base - bh, x + bw, base - bh + r);
        ctx.lineTo(x + bw, base);
        ctx.closePath();
        ctx.fill();
      }
      // label every Nth bar, plus the last one unless it would crowd its neighbour
      if (i % every === 0 || (i === items.length - 1 && i % every >= every / 2)) {
        ctx.fillStyle = AXIS_TEXT; ctx.textAlign = 'center';
        ctx.fillText(it.label, x + bw / 2, h - 10);
      }
    });
    const tip = tooltip(wrap);
    if (hit < 0) { tip.hidden = true; return; }
    const it = items[hit];
    tip.hidden = false;
    tip.innerHTML = `<span>${it.label}${it.sub ? ` · ${it.sub}` : ''}</span><b>${fmt(it.value)}</b>${label ? `<em>${label}</em>` : ''}`;
    const cx = pad.l + hit * slot + slot / 2;
    tip.style.left = `${Math.min(w - tip.offsetWidth - 4, Math.max(4, cx - tip.offsetWidth / 2))}px`;
    tip.style.top = `${Math.max(0, base - ((h - pad.t - pad.b) * it.value) / max - tip.offsetHeight - 12)}px`;
  };
  bindHover(canvas, draw);
  draw(null);
}

function bindHover(canvas, draw) {
  canvas._draw = draw;
  if (canvas._bound) return;
  canvas._bound = true;
  canvas.addEventListener('pointermove', e => canvas._draw(e.clientX - canvas.getBoundingClientRect().left));
  canvas.addEventListener('pointerleave', () => canvas._draw(null));
}
