// LAND UI: pill nav, the opening, the hero stage, reveals, portfolio / analytics / how it works.
import { lineChart } from './charts.js';
import { API } from './config.js';

const $ = id => document.getElementById(id);
const PAGES = ['/', '/land', '/stats', '/rules'];
const STILL = new URLSearchParams(location.search).has('still');
if (STILL) document.body.classList.add('still');   // ?still=1: no motion, for screenshots
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CITIES = { USA: 'United States', NYC: 'New York City', Chicago: 'Chicago', LosAngeles: 'Los Angeles', Miami: 'Miami', Austin: 'Austin', WashingtonDC: 'Washington, DC', SanFrancisco: 'San Francisco' };
const LABELS = { USA: 'USA', NYC: 'NYC', Chicago: 'CHI', LosAngeles: 'LA', Miami: 'MIA', Austin: 'ATX', WashingtonDC: 'DC', SanFrancisco: 'SF' };
const KEYS = Object.keys(CITIES);
const photo = key => `/cities/${String(key).toLowerCase()}.jpg`;

// ---------- formatting ----------
const sol = lamports => (lamports / 1e9).toLocaleString(undefined, { maximumFractionDigits: 4 });
const num = (v, d = 2) => (+Number(v).toFixed(d)).toLocaleString(undefined, { maximumFractionDigits: d });
const fix2 = v => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sqft = v => { v = Number(v) || 0; return v === 0 ? '0' : v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v < 100 ? v.toFixed(2) : num(v, 0); };
const usd = v => { const a = Math.abs(Number(v) || 0); return `${v < 0 ? '−' : ''}$${a < 100 ? fix2(a) : num(a, 0)}`; };
const signed = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}$${fix2(Math.abs(v))}`;
const pctS = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${(Math.abs(v) * 100).toFixed(2)}%`;
const time = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const setText = (id, v) => { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = v; };
const getJson = async path => (await fetch(API + path)).json();
const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };
const hhmm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const until = t => { const s = Math.max(0, Math.round((t - Date.now()) / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const short = a => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '—');
const ext = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`;
const pill = (href, text) => `<a class="pill" href="${esc(href)}" target="_blank" rel="noopener">${text} ↗</a>`;
const tx = sig => pill(`https://solscan.io/tx/${sig}`, short(sig));
const cls = v => (v > 0 ? 'up' : v < 0 ? 'down' : '');

// ---------- the logomark: a 16×16 pixel coin with a house, drawn on canvas ----------
const LOGO = ['....oooooooo....', '..ooAAAAAAAAoo..', '.oAHHAAAAAAAAAo.', '.oAHAAAAWAAAAAo.', 'oAAAAAAWWWAAAAAo', 'oAAAAAWWWWWAAAAo', 'oAAAAWWWWWWWAAAo', 'oAAAWWWWWWWWWAAo', 'oAAAAWWWWWWWAAAo', 'oAAAAWWAWAWWAAAo', 'oAAAAWWAWAWWAAAo', 'oAAAAWWWAWWWAADo', '.oAAAAAAAAAADDo.', '.oAAAAAAAAAADDo.', '..ooAAAAAAAAoo..', '....oooooooo....'];
const LOGO_C = { o: '#06281b', A: '#5CF2B0', H: '#b6f9da', D: '#3fd98e', W: '#06281b' };
function logo(canvas, px = 2) {
  canvas.width = 16 * px; canvas.height = 16 * px; const ctx = canvas.getContext('2d');
  LOGO.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { ctx.fillStyle = LOGO_C[ch]; ctx.fillRect(x * px, y * px, px, px); } }));
  canvas.style.imageRendering = 'pixelated';
  return canvas;
}
logo($('brandLogo'), 2); logo($('fcoinLogo'), 8);

// ---------- nav ----------
const tabs = $('navtabs'), ind = $('tabind');
function place(a) { if (!a) { ind.style.opacity = 0; return; } ind.style.opacity = 1; ind.style.width = a.offsetWidth + 'px'; ind.style.transform = `translateX(${a.offsetLeft}px)`; }
const homeInd = () => place(tabs.querySelector('a.on'));
tabs.querySelectorAll('a').forEach(a => a.addEventListener('mouseenter', () => place(a))); tabs.addEventListener('mouseleave', homeInd);
addEventListener('resize', homeInd); document.fonts?.ready.then(homeInd);
$('burger').onclick = () => $('navlinks').classList.toggle('open');
if (matchMedia('(pointer:fine)').matches) document.querySelectorAll('.mag').forEach(b => { b.addEventListener('mousemove', e => { const r = b.getBoundingClientRect(); b.style.translate = `${(e.clientX - r.left - r.width / 2) * .18}px ${(e.clientY - r.top - r.height / 2) * .3}px`; }); b.addEventListener('mouseleave', () => { b.style.translate = '0 0'; }); });
$('apiLink').href = (API || location.origin) + '/api/engine';

// ---------- routing ----------
function route() {
  const path = PAGES.includes(location.pathname) ? location.pathname : '/';
  const kind = path === '/' ? '/' : 'page';
  for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== kind;
  for (const a of document.querySelectorAll('[data-p]')) a.classList.toggle('on', a.dataset.p === path);
  $('navlinks').classList.remove('open');
  requestAnimationFrame(homeInd);
  if (kind === 'page') for (const el of document.querySelectorAll('[data-page]')) el.hidden = el.dataset.page !== path;
  scrollTo(0, 0);
  if (path === '/') loadHome();
  if (path === '/land') loadLand();
  if (path === '/stats') loadStats();
  if (path === '/rules') { loadRules(); loadCredits(); }
}
function go(path) { history.pushState(null, '', path); route(); }
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-nav]');
  if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault(); go(a.getAttribute('href'));
});
addEventListener('popstate', route);

// ---------- shared engine state ----------
let engineData = null, engineAt = 0;
async function engineState(maxAge = 10_000) {
  if (engineData && Date.now() - engineAt < maxAge) return engineData;
  try { engineData = await getJson('/api/engine'); engineAt = Date.now(); }
  catch { throw new Error('api'); }
  renderCA(engineData.config.token_mint || META_CA);
  for (const el of document.querySelectorAll('[data-every]')) el.textContent = Math.round(engineData.config.every_ms / 60000);
  return engineData;
}
const META_CA = document.querySelector('meta[name="land-ca"]')?.content?.trim() || '';
let shownMint;
function renderCA(mint) {
  if (mint === shownMint) return;
  shownMint = mint;
  $('ca').classList.toggle('set', !!mint);
  $('caCopy').hidden = !mint;
  $('caValue').textContent = mint ? short(mint) : 'not launched yet';
  $('caValue').title = mint || '';
  const href = mint ? `https://pump.fun/coin/${mint}` : 'https://pump.fun';
  $('buyBtn').href = $('buyBtn2').href = href;
  $('buyBtn').textContent = mint ? 'Buy $LAND' : 'Launching soon';
  $('buyBtn2').textContent = mint ? 'Buy $LAND →' : 'Launching soon';
}
$('caCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(shownMint); toast('contract address copied'); } catch { toast('copy failed', true); } });
let toastTimer = null;
function toast(msg, err) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle('err', !!err); t.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.display = 'none'; }, err ? 6000 : 3000);
}
renderCA(META_CA);

// ---------- parcel card pieces ----------
const img = (key, cls = 'ph') => { const im = document.createElement('img'); im.src = photo(key); im.alt = ''; im.className = cls; im.loading = 'lazy'; return im; };
function spark(canvas, v, w = 192, h = 52) {
  v = (v || []).map(Number).filter(x => x > 0);
  canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d');
  if (v.length < 2) return;
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  ctx.beginPath();
  v.forEach((p, i) => { const x = (i / (v.length - 1)) * (w - 6) + 3, y = h - 6 - ((p - min) / span) * (h - 12); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = v.at(-1) >= v[0] ? '#0e7a50' : '#d43f3a'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}

// ---------- hero: floating parcels + the stage ----------
(function floaters() {
  const spots = [[3, 14, -8, 'NYC'], [88, 11, 7, 'Miami'], [12, 58, 6, 'SanFrancisco'], [92, 52, -6, 'Chicago'], [20, 82, 4, 'Austin'], [78, 84, -5, 'LosAngeles']];
  const box = $('hfloat');
  spots.forEach(([x, y, rot, key], i) => { const d = document.createElement('div'); d.className = 'fl'; d.style.left = x + '%'; d.style.top = y + '%'; d.style.setProperty('--rot', rot + 'deg'); d.style.setProperty('--d', (i * -1.3) + 's'); d.appendChild(img(key)); box.appendChild(d); });
})();
let feat = 0, featTimer = null;
function stage(lots) {
  const flow = $('flow');
  const n = lots.length; if (!n) return;
  const picks = [lots[feat % n], lots[(feat + 1) % n], lots[(feat + 2) % n]];
  const pos = [[-9, -44, 10], [8, 44, 6], [0, 0, -4]];
  const cards = $('fcards'); cards.innerHTML = '';
  picks.forEach((x, i) => {
    const d = document.createElement('a'); d.className = 'nft-card'; d.href = '/land'; d.dataset.nav = '';
    d.style.setProperty('--rot', pos[i][0] + 'deg'); d.style.setProperty('--dx', pos[i][1] + 'px'); d.style.setProperty('--dy', pos[i][2] + 'px'); d.style.zIndex = i === 2 ? 3 : 1;
    const im = document.createElement('div'); im.className = 'nft-img'; im.appendChild(img(x.name)); d.appendChild(im);
    d.insertAdjacentHTML('beforeend', `<div class="nm"><b>${esc(x.label)}</b><span>$${fix2(x.price)}<i>${x.sqft > 0 ? ` ✓ ${sqft(x.sqft)} sqft` : ''}</i></span></div>`);
    cards.appendChild(d);
  });
  const f = picks[2];
  $('stg-meta').textContent = `$LAND → ${f.city} · $${fix2(f.price)} / sqft · ${pctS(f.change_1d)} today`;
  $('tip-txt').textContent = f.valid_until ? `${f.city} index · next print in ${until(f.valid_until)} · 30d ${pctS(f.change_30d)}` : `${f.city} index · 30d ${pctS(f.change_30d)}`;
  flow.classList.remove('sw');
}
function nextFeat() { const d = engineData; if (!d) return; const flow = $('flow'); flow.classList.add('sw'); setTimeout(() => { feat++; stage(d.land.lots ?? []); }, 360); }

// ---------- river + parcels grid + tape ----------
function river(lots) {
  const mk = x => { const d = document.createElement('div'); d.className = 'rv-card'; d.appendChild(img(x.name)); d.insertAdjacentHTML('beforeend', `<span>${esc(x.label)} · $${fix2(x.price)}<b>${pctS(x.change_1d)}</b></span>`); return d; };
  const a = lots.slice(0, 4), b = lots.slice(4);
  [['river-a', a.length ? a : lots], ['river-b', b.length ? b : lots]].forEach(([id, list]) => { const row = $(id); if (row.dataset.k === list.map(x => x.name + x.price).join()) return; row.dataset.k = list.map(x => x.name + x.price).join(); row.innerHTML = ''; [...list, ...list, ...list, ...list].forEach(x => row.appendChild(mk(x))); });
}
function parcels(lots) {
  const grid = $('parcelGrid');
  grid.innerHTML = '';
  for (const x of lots) {
    const a = document.createElement('a'); a.className = 'parcel'; a.href = '/land'; a.dataset.nav = '';
    a.appendChild(img(x.name));
    a.insertAdjacentHTML('beforeend', `<div class="top"><div><div class="nm">${esc(x.city)}</div><div class="tk">$${esc(x.label)} · market ${x.id}</div></div><div class="px">$${fix2(x.price)}<small>PER SQFT</small></div></div>
      <div class="kv"><div><div class="k">today</div><div class="v ${cls(x.change_1d)}">${pctS(x.change_1d)}</div></div><div><div class="k">30 days</div><div class="v ${cls(x.change_30d)}">${pctS(x.change_30d)}</div></div><div><div class="k">held</div><div class="v">${sqft(x.sqft)} sqft</div></div></div>
      <div class="bot"><span>${x.oracle_status === 'Active' ? 'index active' : esc(x.oracle_status)} · ${Math.round(x.weight * 100)}% target</span><canvas class="spark"></canvas></div>`);
    spark(a.querySelector('canvas'), x.spark, 144, 44);
    grid.appendChild(a);
  }
}
function tape(L) {
  const items = [
    ...(L.claims ?? []).map(x => ({ at: x.at, t: `<b>claim</b> ${sol(x.lamports)} SOL from the creator vault` })),
    ...(L.swaps ?? []).map(x => ({ at: x.at, t: `<b>convert</b> ${sol(x.lamports)} SOL → ${usd(x.usdc)} USDC` })),
    ...(L.bridges ?? []).map(x => ({ at: x.at, t: `<b>bridge</b> ${usd(x.usdc)} USDC → Parcl` })),
    ...(L.orders ?? []).filter(o => o.kind === 'buy').map(x => ({ at: x.at, t: `<b>buy</b> ${sqft(x.sqft)} sqft ${esc(x.city ?? x.name)} · ${usd(x.usd)}` })),
  ].sort((a, b) => b.at - a.at).slice(0, 14);
  const el = $('tape');
  const html = items.map(x => `<span>${x.t} · ${ago(x.at)}</span>`).join('');
  if (!items.length) { if (!el.dataset.k) return; el.dataset.k = ''; el.innerHTML = '<span>waiting for the first cycle…</span>'; return; }
  if (el.dataset.k === html) return; el.dataset.k = html; el.innerHTML = html + html;
}

// ---------- overview ----------
let homeTimer = null;
async function loadHome() {
  clearTimeout(homeTimer);
  if (location.pathname !== '/') return;
  try { await engineState(0); renderHome(); } catch {}
  homeTimer = setTimeout(loadHome, 15_000);
}
function renderHome() {
  const d = engineData; if (!d || location.pathname !== '/') return;
  const { config: c, live: l, totals: t, ledger: L, flow: f, land: Ld } = d;
  const lots = Ld.lots ?? [];
  const holding = Ld.sqft > 0;
  const set = (id, v) => { const el = $(id); if (el && el.innerHTML !== v) el.innerHTML = v; };
  set('kpSqft', `${sqft(Ld.sqft)}<small>sqft</small>`);
  set('kpValue', usd(Ld.notional));
  set('kpClaimed', `${sol(t.claimed_lamports)}<small>SOL</small>`);
  set('kpBridged', usd(t.bridged_usdc));
  setText('kick', holding ? `Live on Solana · ${sqft(Ld.sqft)} sqft held across ${Ld.cities} ${Ld.cities === 1 ? 'city' : 'cities'}` : f.armed ? `Live on Solana · engine armed${c.dry ? ' · dry run' : ''}` : 'Live on Solana · creator rewards → Parcl');
  setText('fpaid', `${sqft(Ld.sqft)} sqft`);
  setText('fholders', holding ? `${usd(Ld.notional)} at today's index · ${signed(Ld.upnl)}` : f.next_run ? `next cycle in ${until(f.next_run)}` : 'waiting for the first cycle');
  setText('stg-live', holding ? `live · ${Ld.cities} ${Ld.cities === 1 ? 'city' : 'cities'}` : 'real indices · parcl v4');
  const vault = l.vault;
  setText('s1-claim', vault ? `${vault.claimable_sol.toFixed(4)} SOL` : '—');
  setText('s1-total', `${sol(t.claimed_lamports)} SOL`);
  setText('s1-wallet', c.wallet ? short(c.wallet) : c.creator ? short(c.creator) : '—');
  setText('s3-sqft', sqft(Ld.sqft));
  setText('s3-val', usd(Ld.notional));
  const buys = (L.orders ?? []).filter(o => o.kind === 'buy').slice(0, 3);
  if (buys.length) $('s3-bubs').innerHTML = buys.map(o => `<span class="b">+${sqft(o.sqft)} sqft ${esc(o.label ?? o.name)}</span>`).join('');
  setText('tx-state', holding ? '● live' : f.armed ? `● armed${c.dry ? ' · dry' : ''}` : '● standby');
  setText('tx-wallet', c.wallet ? short(c.wallet) : '—');
  setText('tx-markets', String(lots.length || 8));
  setText('tx-cycles', String((L.claims ?? []).length + (L.orders ?? []).length || '—'));
  if (lots.length) {
    if (!$('fcards').children.length) stage(lots);
    if (!featTimer && !STILL && !REDUCED) featTimer = setInterval(nextFeat, 7000);
    river(lots);
    if ($('parcelGrid').dataset.k !== lots.map(x => x.name + x.price + x.sqft).join()) { $('parcelGrid').dataset.k = lots.map(x => x.name + x.price + x.sqft).join(); parcels(lots); }
  }
  tape(L);
}
setInterval(() => { const d = engineData; if (d && location.pathname === '/' && d.flow.next_run && !(d.land.sqft > 0)) setText('fholders', `next cycle in ${until(d.flow.next_run)}`); }, 1000);

// ---------- portfolio ----------
let landTimer = null;
function positions(table, lots, { compact = false } = {}) {
  table.innerHTML = `<thead><tr><th>market</th><th class="num">index $/sqft</th><th class="num">1d</th><th class="num">30d</th><th>trend</th><th class="num">target</th><th class="num">held</th>${compact ? '' : '<th class="num">value</th><th class="num">pnl</th>'}</tr></thead><tbody>` +
    (lots.map(x => `<tr><td><span class="mk-tbl"><img src="${photo(x.name)}" alt=""><span><span class="n">${esc(x.city)}</span><span class="c">$${esc(x.label)} · market ${x.id}${x.oracle_status !== 'Active' ? ` · ${esc(x.oracle_status)}` : ''}</span></span></span></td><td class="num">${fix2(x.price)}</td><td class="num ${cls(x.change_1d)}">${pctS(x.change_1d)}</td><td class="num ${cls(x.change_30d)}">${pctS(x.change_30d)}</td><td><canvas class="spark" data-spark="${x.spark.join(',')}"></canvas></td><td class="num"><span class="wbar"><i style="--w:${Math.round(x.weight * 100)}%"></i>${Math.round(x.weight * 100)}%</span></td><td class="num">${sqft(x.sqft)} sqft</td>${compact ? '' : `<td class="num">${x.sqft ? usd(x.notional) : '—'}</td><td class="num ${cls(x.upnl)}">${x.sqft ? signed(x.upnl) : '—'}</td>`}</tr>`).join('')
      || `<tr><td colspan="${compact ? 7 : 9}" class="mute">Reading the markets…</td></tr>`) + '</tbody>';
  for (const cv of table.querySelectorAll('canvas[data-spark]')) spark(cv, cv.dataset.spark.split(','));
}
function statePill(el, { holding, armed, dry }) {
  el.textContent = holding ? 'Live · holding' : armed ? (dry ? 'Armed · dry run' : 'Armed') : 'Pre-launch';
  el.className = `state-pill ${holding ? 'live' : armed ? 'armed' : ''}`;
}
async function loadLand() {
  clearTimeout(landTimer);
  if (location.pathname !== '/land') return;
  let d;
  try { d = await engineState(0); } catch { landTimer = setTimeout(loadLand, 20_000); return; }
  const { config: c, live: l, ledger: L, land: Ld, flow: f } = d;
  const holding = Ld.sqft > 0;
  setText('ldSqft', sqft(Ld.sqft));
  setText('ldSqftSub', holding ? `across ${Ld.cities} ${Ld.cities === 1 ? 'city' : 'cities'}` : 'no positions yet');
  setText('ldValue', usd(Ld.notional));
  const vs = $('ldValueSub'); vs.textContent = holding ? `${signed(Ld.upnl)} unrealized` : 'unrealized —'; vs.className = `s ${holding ? cls(Ld.upnl) : ''}`;
  setText('ldColl', usd(Ld.collateral ?? 0));
  setText('ldCollSub', `${usd(Ld.available ?? 0)} free`);
  setText('ldMarkets', String((Ld.lots ?? []).length || 8));
  setText('ldMarketsSub', `${Ld.cities} with a position`);
  statePill($('ldStatus'), { holding, armed: f.armed, dry: c.dry });
  const m0 = (Ld.lots ?? [])[0];
  setText('ldOracle', m0?.valid_until ? `Parcl Labs index · next print in ${until(m0.valid_until)}` : 'Parcl Labs index · daily');
  positions($('ldLots'), Ld.lots ?? []);
  setText('ldSideTitle', holding ? 'marked daily' : 'nothing opened yet');
  setText('ldSideText', holding
    ? `${sqft(Ld.sqft)} square feet across ${Ld.cities} ${Ld.cities === 1 ? 'city' : 'cities'}, worth ${usd(Ld.notional)} at today's index. Every position is long at ${c.leverage}x and marked once a day at the Parcl Labs print; the engine only ever buys.`
    : `No positions yet. When the engine runs a cycle, rewards are converted to USDC, bridged to Parcl, and the first city index positions open here${Ld.on_the_way_usd > 0 ? ` (${usd(Ld.on_the_way_usd)} already on the way)` : ''}.`);
  const A = l.account;
  const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  $('ldLinks').innerHTML =
    row('Engine wallet · Parcl owner key', c.wallet ? `${pill(`https://solscan.io/account/${c.wallet}`, short(c.wallet))}${c.owner_hex ? `<br><code class="mute">0x${esc(c.owner_hex)}</code>` : ''}` : '<span class="mute">not armed yet</span>') +
    row('Parcl account', A ? `#${A.id} · ${pill(c.account_url, 'validator')} · ${esc(A.mode)} margin${A.pending ? ' · pending activation' : ''}` : c.wallet ? '<span class="mute">none yet: created from the first bridge deposit (≥ 5 USDC + 1 USDC activation)</span>' : '<span class="mute">—</span>') +
    row('Collateral', A ? `${usd(A.collateral)} USDC · ${usd(A.available)} free · ${signed(Ld.upnl)} unrealized` : '<span class="mute">—</span>') +
    row('On the way', `${usd(l.wallet_usdc ?? 0)} USDC in the wallet · ${usd(l.bridge?.unclaimed_usdc ?? 0)} unclaimed on the bridge${l.bridge?.deposits_halted ? ' · <span class="mute">deposits halted</span>' : ''}`) +
    row('Bridge program', c.bridge_program ? pill(`https://solscan.io/account/${c.bridge_program}`, short(c.bridge_program)) : '—') +
    row('Target book', c.targets.map(x => `${esc(x.label)} ${Math.round(x.weight * 100)}%`).join(' · ') + ` · ${c.leverage}x · every ${Math.round(c.every_ms / 60000)} min`) +
    row('Chain', `${esc(c.chain)} · ${pill(c.validator + '/v1/markets', 'markets')} · ${pill(c.app, 'trading app')}`);
  const items = [
    ...L.claims.map(x => ({ at: x.at, k: 'claim', what: `${sol(x.lamports)} SOL from the creator vault`, link: tx(x.sig) })),
    ...L.swaps.map(x => ({ at: x.at, k: 'convert', what: `${sol(x.lamports)} SOL → ${usd(x.usdc)} USDC`, link: tx(x.sig) })),
    ...L.bridges.map(x => ({ at: x.at, k: 'bridge', what: `${usd(x.usdc)} USDC → Parcl bridge`, link: tx(x.sig) })),
    ...L.orders.map(x => ({ at: x.at, k: x.kind === 'account' ? 'account' : 'buy', what: x.kind === 'account' ? `Parcl account ${x.account_id ? `#${x.account_id}` : ''} funded with ${usd(x.usd)}` : `${sqft(x.sqft)} sqft of ${esc(x.city ?? x.name)} at ~$${fix2(x.price)}/sqft · ${usd(x.usd)}`, link: `<span class="pill" title="${esc(x.hash ?? '')}">${esc(String(x.hash ?? '').slice(0, 10))}…</span>` })),
    ...L.errors.map(x => ({ at: x.at, k: 'error', what: `${esc(x.step)}: ${esc(x.error)}`, link: '', bad: true })),
  ].sort((a, b) => b.at - a.at).slice(0, 60);
  $('ldLedger').innerHTML = items.map(x => `<div class="it"><span class="t">${time(x.at)}</span><span class="pill" style="flex:none${x.bad ? ';background:#fde8e7;color:#7a1f1b;border-color:#f5c6c3' : ''}">${x.k}</span><span class="what">${x.what}</span>${x.link}</div>`).join('')
    || '<div class="empty">No transactions yet. The first claim starts the loop.</div>';
  setText('ldNote', c.writes
    ? `Armed${c.dry ? ' · dry run (logs only, nothing moves)' : ''}. The Parcl account is owned by the engine wallet's key; its positions are public on the validator, nothing is held by this site.`
    : `Not armed: the server has no engine key, so only the public side (vault, indices${A ? ', the Parcl account' : ''}) is live.`);
  landTimer = setTimeout(loadLand, 20_000);
}

// ---------- analytics ----------
let statsTimer = null;
async function loadStats() {
  clearTimeout(statsTimer);
  if (location.pathname !== '/stats') return;
  let d;
  try { d = await engineState(0); } catch { statsTimer = setTimeout(loadStats, 30_000); return; }
  const { totals: t, land: Ld, marks } = d;
  setText('stSqft', sqft(Ld.sqft));
  setText('stValue', usd(Ld.notional));
  setText('stClaimed', `${sol(t.claimed_lamports)} SOL`);
  setText('stBridged', usd(t.bridged_usdc));
  const m = marks ?? [];
  lineChart($('chSqft'), m.map(x => ({ x: x.at, y: x.sqft })), { fmt: v => `${sqft(v)} sqft`, axis: v => sqft(v), xfmt: hhmm, label: 'square feet', empty: 'No square feet held yet' });
  lineChart($('chValue'), m.map(x => ({ x: x.at, y: x.notional })), { fmt: v => usd(v), axis: v => usd(v), xfmt: hhmm, label: 'position value', empty: 'No position value yet' });
  lineChart($('chIndex'), m.map(x => ({ x: x.at, y: x.index })), { fmt: v => `$${fix2(v)}/sqft`, axis: v => `$${fix2(v)}`, xfmt: hhmm, label: 'USA index', floor: true });
  const lots = Ld.lots ?? [];
  $('stMarkets').innerHTML = '<thead><tr><th>market</th><th class="num">index $/sqft</th><th class="num">1d</th><th class="num">30d</th><th class="num">funding / h</th><th class="num">weight</th><th class="num">held sqft</th><th class="num">pnl</th></tr></thead><tbody>' +
    (lots.map(x => `<tr><td><span class="mk-tbl"><img src="${photo(x.name)}" alt=""><span><span class="n">${esc(x.city)}</span><span class="c">$${esc(x.label)}</span></span></span></td><td class="num">${fix2(x.price)}</td><td class="num ${cls(x.change_1d)}">${pctS(x.change_1d)}</td><td class="num ${cls(x.change_30d)}">${pctS(x.change_30d)}</td><td class="num">${(x.funding_hourly * 100).toFixed(4)}%</td><td class="num">${Math.round(x.weight * 100)}%</td><td class="num">${sqft(x.sqft)}</td><td class="num ${cls(x.upnl)}">${x.sqft ? signed(x.upnl) : '—'}</td></tr>`).join('')
      || '<tr><td colspan="8" class="mute">Reading the markets…</td></tr>') + '</tbody>';
  statsTimer = setTimeout(loadStats, 30_000);
}
addEventListener('resize', () => { if (location.pathname === '/stats') loadStats(); });

// ---------- how it works ----------
async function loadRules() {
  try {
    const { config: c, flow: f, land: Ld } = await engineState();
    setText('ldEvery', `Every ${Math.round(c.every_ms / 60000)} minutes. Target book: ${c.targets.map(x => `${x.label} ${Math.round(x.weight * 100)}%`).join(', ')}. Orders go to the market furthest under its weight first; a deposit needs ${c.min_bridge_usdc} USDC, an order ${c.min_order_usd} USD. Leverage ${c.leverage}x${c.leverage === 1 ? ': notional equals collateral, nothing borrowed' : ''}.`);
    setText('mode', Ld.sqft > 0 ? 'live and holding' : f.armed ? (c.dry ? 'armed, dry run' : 'armed') : 'in standby (not armed yet)');
  } catch {}
}
let creditsLoaded = false;
async function loadCredits() {
  if (creditsLoaded) return;
  try {
    const c = await (await fetch('/cities/credits.json')).json();
    const names = { usa: 'USA', nyc: 'New York City', chicago: 'Chicago', losangeles: 'Los Angeles', miami: 'Miami', austin: 'Austin', washingtondc: 'Washington, DC', sanfrancisco: 'San Francisco' };
    $('credits').innerHTML = Object.entries(c).map(([k, v]) => `<li><b>${esc(names[k] ?? k)}</b> · ${ext(v.page, esc(v.title.replace('File:', '')))} · ${esc(v.artist || 'unknown')} · ${esc(v.license)}</li>`).join('');
    creditsLoaded = true;
  } catch {}
}

// ---------- motion: reveals, stage tilt ----------
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
const heroRv = [...document.querySelectorAll('.hero .rv')];
function armReveals() { document.querySelectorAll('.view[data-view="/"] .rv').forEach(el => { if (!heroRv.includes(el)) io.observe(el); }); }
function revealHero() { heroRv.forEach(el => el.classList.add('in')); }
const frame = $('frame');
function tilt() { const r = frame.getBoundingClientRect(); const t = Math.min(1, Math.max(0, (-r.top) / Math.max(300, r.height * .9))); frame.style.setProperty('--tilt', t.toFixed(3)); }
addEventListener('scroll', tilt, { passive: true }); addEventListener('resize', tilt); tilt();

// ---------- the opening ----------
(function intro() {
  const el = $('intro'); let seen = false; try { seen = sessionStorage.getItem('land-intro') === '1'; } catch {}
  const skipIt = seen || REDUCED || STILL || location.hash || location.pathname !== '/';
  if (skipIt) { el.remove(); document.documentElement.classList.add('no-intro'); revealHero(); armReveals(); return; }
  document.body.classList.add('intro-on'); try { sessionStorage.setItem('land-intro', '1'); } catch {}
  const plane = $('i3-plane'); const ROWS = 5, COLS = 12;
  for (let r = 0; r < ROWS; r++) { const row = document.createElement('div'); row.className = 'i3-row'; for (let c = 0; c < COLS; c++) { const d = document.createElement('div'); d.className = 'i3-c'; d.style.setProperty('--ri', String(r - 2)); d.appendChild(img(KEYS[(r * 3 + c) % KEYS.length])); row.appendChild(d); } plane.appendChild(row); }
  const lc = document.createElement('canvas'); logo(lc, 12); $('i3-coin').appendChild(lc);
  $('i3-nft').appendChild(img('NYC'));
  const sp = $('i3-sparks'); for (let i = 0; i < 14; i++) { const s = document.createElement('i'); s.style.setProperty('--a', `${(i / 14) * 360 + (i % 2) * 11}deg`); s.style.setProperty('--d', `${150 + (i % 4) * 46}px`); s.style.setProperty('--dl', `${(i % 5) * 40}ms`); const im = img(KEYS[i % KEYS.length]); im.loading = 'eager'; im.style.cssText = 'width:100%;height:100%;border-radius:5px;object-fit:cover'; s.appendChild(im); sp.appendChild(s); }
  const du = $('i3-dust'); const cols = ['#5CF2B0', '#f2b53a', '#0e7a50', '#3fd98e']; for (let i = 0; i < 26; i++) { const s = document.createElement('i'); s.style.setProperty('--a', `${(i / 26) * 360}deg`); s.style.setProperty('--d', `${110 + (i % 6) * 34}px`); s.style.setProperty('--dl', `${(i % 7) * 30}ms`); s.style.setProperty('--c', cols[i % cols.length]); du.appendChild(s); }
  const at = (ms, c) => setTimeout(() => el.classList.add(c), ms);
  let done = false;
  const finish = () => { if (done) return; done = true; el.classList.add('i3-leave'); setTimeout(() => { el.classList.add('out'); document.body.classList.remove('intro-on'); revealHero(); armReveals(); }, 420); setTimeout(() => el.remove(), 1500); };
  requestAnimationFrame(() => el.classList.add('i3-go'));
  at(1500, 'i3-focus'); at(2900, 'i3-glint'); at(3350, 'i3-flip-on'); at(3750, 'i3-boom'); at(4300, 'i3-spin');
  setTimeout(finish, 5600);
  $('i3-skip').onclick = finish; el.addEventListener('click', e => { if (e.target === el || e.target.closest('.i3-plane')) finish(); });
})();

route();
engineState().catch(() => {});
