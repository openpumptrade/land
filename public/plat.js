// The plat: a cadastral map of the eight city index markets, drawn as one SVG.
// Each market is a lot with its photograph clipped inside, a lot number, the
// ticker, the index in $/sqft, today's move and the square feet the coin holds.
//
//   setLots([{ key, label, city, price, change_1d, change_30d, sqft, notional, reserved }])
//   allocate({ sqft, label })   a purchase: the lot flashes and "+sqft" floats up
//   onSelect(fn)                click handler, receives the lot key

const CITY = { USA: 'United States', NYC: 'New York City', Chicago: 'Chicago', LosAngeles: 'Los Angeles', Miami: 'Miami', Austin: 'Austin', WashingtonDC: 'Washington, DC', SanFrancisco: 'San Francisco' };
const LABEL = { USA: 'USA', NYC: 'NYC', Chicago: 'CHI', LosAngeles: 'LA', Miami: 'MIA', Austin: 'ATX', WashingtonDC: 'DC', SanFrancisco: 'SF' };
const ORDER = Object.keys(CITY);

// Geometry (viewBox 1000×720). The tract is a slightly skewed quadrilateral,
// split by LAND AVENUE into a north and a south tier; lot widths differ on purpose.
const TOP = x => 62 - 22 * (x - 40) / 920;       // slanted north boundary
const BOT = x => 704 - 18 * (x - 40) / 920;      // slanted south boundary
const ROAD = { y0: 368, y1: 404 };
const TIERS = [
  { y: 'north', lots: [['USA', 40, 330], ['NYC', 330, 560], ['Chicago', 560, 770], ['LosAngeles', 770, 960]] },
  { y: 'south', lots: [['Miami', 40, 285], ['Austin', 285, 480], ['WashingtonDC', 480, 725], ['SanFrancisco', 725, 960]] },
];
function polyOf(tier, x0, x1) {
  return tier === 'north'
    ? [[x0, TOP(x0)], [x1, TOP(x1)], [x1, ROAD.y0], [x0, ROAD.y0]]
    : [[x0, ROAD.y1], [x1, ROAD.y1], [x1, BOT(x1)], [x0, BOT(x0)]];
}
const LOTS = [];
TIERS.forEach(t => t.lots.forEach(([key, x0, x1], i) => LOTS.push({ key, tier: t.y, x0, x1, poly: polyOf(t.y, x0, x1), n: LOTS.length + 1 })));

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const num = (v, d = 2) => (+Number(v).toFixed(d)).toLocaleString(undefined, { maximumFractionDigits: d });
const sqftFmt = v => { v = Number(v) || 0; return v === 0 ? '0' : v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v < 100 ? v.toFixed(2) : num(v, 0); };
const pctFmt = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${(Math.abs(v || 0) * 100).toFixed(2)}%`;
const pts = poly => poly.map(p => p.join(',')).join(' ');
const text = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
const feet = px => `${(px * 0.5).toFixed(2)}'`;   // 1 svg unit = 0.5 ft, for the dimension strings
const bearing = (a, b) => {
  const dx = b[0] - a[0], dy = a[1] - b[1];
  const deg = Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI;
  const d = Math.floor(deg), m = Math.floor((deg - d) * 60), s = Math.round(((deg - d) * 60 - m) * 60);
  return `${dy >= 0 ? 'N' : 'S'} ${String(d).padStart(2, '0')}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}" ${dx >= 0 ? 'E' : 'W'}`;
};
const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export class Plat {
  constructor(svg) {
    this.svg = svg;
    this.lots = new Map();
    this.select = null;
    this.build();
  }

  onSelect(fn) { this.select = fn; }

  build() {
    const NS = 'http://www.w3.org/2000/svg';
    const tract = [[40, TOP(40)], [960, TOP(960)], [960, BOT(960)], [40, BOT(40)]];
    let defs = '';
    let lots = '';
    for (const L of LOTS) {
      const [x0, y0] = [L.x0, Math.min(...L.poly.map(p => p[1]))];
      const w = L.x1 - L.x0, h = Math.max(...L.poly.map(p => p[1])) - y0;
      defs += `<clipPath id="clip-${L.key}"><polygon points="${pts(L.poly)}"/></clipPath>`;
      lots += `
        <g class="lot empty" data-key="${L.key}" tabindex="0" role="button" aria-label="${esc(CITY[L.key])}">
          <image class="photo" href="/cities/${L.key.toLowerCase()}.jpg" x="${x0}" y="${y0}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${L.key})"/>
          <polygon class="shade" points="${pts(L.poly)}"/>
          <polygon class="edge" points="${pts(L.poly)}"/>
          <text class="lotno" x="${x0 + 14}" y="${y0 + 26}">LOT ${L.n}</text>
          ${w >= 220 ? `<text class="dim" x="${(x0 + L.x1) / 2}" y="${y0 + 26}" text-anchor="middle">${feet(w)}</text>` : ''}
          <text class="tkr" x="${x0 + 14}" y="${y0 + h - 70}">${LABEL[L.key]}</text>
          <text class="city" x="${x0 + 14}" y="${y0 + h - 54}">${esc(CITY[L.key]).toUpperCase()}</text>
          <text class="price" x="${x0 + 14}" y="${y0 + h - 32}">–</text>
          <text class="held" x="${x0 + 14}" y="${y0 + h - 14}">NO POSITION</text>
          <g class="chip" transform="translate(${L.x1 - 14}, ${y0 + 16})"><rect x="-58" y="-2" width="58" height="20" rx="2"/><text x="-29" y="12" text-anchor="middle">–</text></g>
          <polygon class="flash" points="${pts(L.poly)}"/>
        </g>`;
    }
    // bearings + distances along the tract boundary, written outside each edge
    const edges = [[tract[0], tract[1], 0, -22, 'middle'], [tract[1], tract[2], 24, 0, 'start'], [tract[2], tract[3], 0, 34, 'middle'], [tract[3], tract[0], -24, 0, 'end']];
    const bearings = edges.map(([a, b, dx, dy, anchor], i) => {
      const mx = (a[0] + b[0]) / 2 + dx, my = (a[1] + b[1]) / 2 + dy;
      const rot = i % 2 ? (i === 1 ? 90 : -90) : 0;
      return `<text class="bearing" x="${mx}" y="${my}" text-anchor="middle" transform="rotate(${rot} ${mx} ${my})">${bearing(a, b)}  ·  ${feet(length(a, b))}</text>`;
    }).join('');
    this.svg.innerHTML = `
      <defs>${defs}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="var(--grid)" stroke-width="1"/></pattern>
        <marker id="tick" markerWidth="6" markerHeight="6" refX="3" refY="3"><path d="M3 0v6" stroke="var(--bone-2)"/></marker>
      </defs>
      <rect class="paper" x="0" y="0" width="1000" height="720" fill="url(#grid)"/>
      <polygon class="tract" points="${pts(tract)}"/>
      <g class="road">
        <rect x="40" y="${ROAD.y0}" width="920" height="${ROAD.y1 - ROAD.y0}"/>
        <line x1="40" y1="${(ROAD.y0 + ROAD.y1) / 2}" x2="960" y2="${(ROAD.y0 + ROAD.y1) / 2}"/>
        <text x="500" y="${(ROAD.y0 + ROAD.y1) / 2 + 5}" text-anchor="middle">L A N D   A V E N U E   ·   60' R.O.W.</text>
      </g>
      <g class="lots">${lots}</g>
      <g class="corners">${tract.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4"/>`).join('')}</g>
      ${bearings}
      <g class="north" transform="translate(944, 54)"><path d="M0 -22 L8 6 L0 0 L-8 6 Z"/><text y="22" text-anchor="middle">N</text></g>
      <g class="scale" transform="translate(60, 690)"><line x1="0" y1="0" x2="200" y2="0" marker-start="url(#tick)" marker-mid="url(#tick)" marker-end="url(#tick)"/><line x1="0" y1="0" x2="100" y2="0" class="dark"/><text x="0" y="-6">0</text><text x="100" y="-6" text-anchor="middle">50</text><text x="200" y="-6" text-anchor="end">100 FT</text></g>
      <text class="stamp" x="960" y="700" text-anchor="end">SCALE 1" = 50'  ·  EIGHT LOTS  ·  PARCL V4 MAINNET</text>`;
    for (const g of this.svg.querySelectorAll('.lot')) {
      this.lots.set(g.dataset.key, g);
      g.addEventListener('click', () => this.select?.(g.dataset.key));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.select?.(g.dataset.key); } });
    }
    const fl = document.createElementNS(NS, 'g'); fl.setAttribute('class', 'floaters'); this.svg.append(fl);
  }

  setLots(data) {
    if (!Array.isArray(data)) return;
    for (const d of data) {
      const key = d.key ?? d.name;
      const g = this.lots.get(key); if (!g) continue;
      const ch = Number(d.change_1d) || 0;
      text(g.querySelector('.price'), d.price != null ? `$${num(d.price, 2)} / SQFT` : '–');
      const chip = g.querySelector('.chip');
      text(chip.querySelector('text'), d.price != null ? pctFmt(ch) : '–');
      chip.setAttribute('class', `chip ${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}`);
      const held = Number(d.sqft) || 0, reserved = Number(d.reserved) || 0;
      text(g.querySelector('.held'), held > 0 ? `${sqftFmt(held)} SQFT · $${num(d.notional ?? held * (d.price ?? 0), 0)}` : reserved > 0 ? `${sqftFmt(reserved)} SQFT UNDER CONTRACT` : 'NO POSITION');
      g.classList.toggle('empty', held <= 0);
    }
  }

  allocate({ sqft = 0, label = null } = {}) {
    const key = ORDER.find(k => k === label || LABEL[k] === label) ?? ORDER[0];
    const g = this.lots.get(key); if (!g) return;
    g.classList.remove('bought'); void g.getBBox(); g.classList.add('bought');
    if (!sqft) return;
    const L = LOTS.find(l => l.key === key);
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('class', 'floater');
    t.setAttribute('x', (L.x0 + L.x1) / 2); t.setAttribute('y', (Math.min(...L.poly.map(p => p[1])) + Math.max(...L.poly.map(p => p[1]))) / 2);
    t.setAttribute('text-anchor', 'middle');
    t.textContent = `+${sqftFmt(sqft)} sqft`;
    this.svg.querySelector('.floaters').appendChild(t);
    setTimeout(() => t.remove(), 1600);
  }
}

export { CITY, LABEL, ORDER };
