// UI: routing, overview (heatmap + engine), portfolio, analytics, how it works.
import { lineChart } from './charts.js';
import { API } from './config.js';
import { toast } from './fx.js';

const $ = id => document.getElementById(id);
const PAGES = ['/', '/land', '/stats', '/rules'];

if (new URLSearchParams(location.search).has('still')) document.body.classList.add('still');   // ?still=1: no motion, for screenshots

// ---------- formatting ----------
const sol = lamports => (lamports / 1e9).toLocaleString(undefined, { maximumFractionDigits: 6 });
const num = (v, d = 2) => (+Number(v).toFixed(d)).toLocaleString(undefined, { maximumFractionDigits: d });
const sqft = v => { v = Number(v) || 0; return v === 0 ? '0' : v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v < 100 ? v.toFixed(2) : num(v, 0); };
const fix2 = v => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = v => { const a = Math.abs(Number(v) || 0); return `${v < 0 ? '−' : ''}$${a < 100 ? fix2(a) : num(a, 0)}`; };
const signed = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}$${fix2(Math.abs(v))}`;
const pctS = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${(Math.abs(v) * 100).toFixed(2)}%`;
const time = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
function setText(id, v) { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = v; }
const getJson = async path => (await fetch(API + path)).json();
const ago = t => {
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};
const hhmm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const until = t => { const s = Math.max(0, Math.round((t - Date.now()) / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const solLink = sig => `<a href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener" class="mono">${esc(sig.slice(0, 8))}…${esc(sig.slice(-4))}</a>`;
const ext = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`;
const acct = a => ext(`https://solscan.io/account/${a}`, `<code>${esc(a)}</code>`);
const short = a => `${a.slice(0, 4)}…${a.slice(-4)}`;
const cls = v => (v > 0 ? 'up' : v < 0 ? 'down' : '');

// ---------- routing ----------
function route() {
  const path = PAGES.includes(location.pathname) ? location.pathname : '/';
  const kind = path === '/' ? '/' : 'page';
  for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== kind;
  for (const a of document.querySelectorAll('.top nav a')) a.classList.toggle('on', a.getAttribute('href') === path);
  if (kind === 'page') for (const el of document.querySelectorAll('[data-page]')) el.hidden = el.dataset.page !== path;
  scrollTo(0, 0);
  if (path === '/') loadHome();
  if (path === '/land') loadLand();
  if (path === '/stats') loadStats();
  if (path === '/rules') { loadRules(); loadCredits(); }
  const view = document.querySelector(`[data-view="${kind}"]`);
  view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
}
function go(path) {
  history.pushState(null, '', path);
  route();
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-nav]');
  if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  go(a.getAttribute('href'));
});
addEventListener('popstate', route);

// ---------- shared engine state ----------
let engineData = null, engineAt = 0;
async function engineState(maxAge = 10_000) {
  if (engineData && Date.now() - engineAt < maxAge) return engineData;
  try {
    engineData = await getJson('/api/engine'); engineAt = Date.now();
    $('conn').className = 'conn live'; $('conn').title = 'live';
  } catch {
    $('conn').className = 'conn down'; $('conn').title = 'api unreachable';
    throw new Error('api');
  }
  renderCA(engineData.config.token_mint || META_CA);
  return engineData;
}

// Contract address: TOKEN_MINT from the server, else <meta name="land-ca">, else a placeholder.
const META_CA = document.querySelector('meta[name="land-ca"]')?.content?.trim() || '';
let shownMint;
function renderCA(mint) {
  if (mint === shownMint) return;
  shownMint = mint;
  $('ca').classList.toggle('set', !!mint);
  $('caCopy').hidden = $('caLink').hidden = !mint;
  if (mint) { $('caValue').textContent = `${mint.slice(0, 6)}…${mint.slice(-6)}`; $('caValue').title = mint; $('caLink').href = `https://pump.fun/coin/${mint}`; }
  else { $('caValue').textContent = 'Not launched'; $('caValue').title = ''; }
}
$('caCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shownMint);
    toast('Contract address copied', shownMint, 'good');
  } catch {
    toast('Copy failed', 'Select the address and copy it manually.', 'bad');
  }
});

// ---------- heatmap ----------
let range = '1d';
$('hmRange').addEventListener('click', e => {
  const b = e.target.closest('button[data-r]'); if (!b) return;
  range = b.dataset.r;
  for (const x of $('hmRange').children) x.classList.toggle('on', x === b);
  if (engineData) heat(engineData.land.lots ?? []);
});
const thumb = x => `<img class="thumb" src="/cities/${esc(String(x.name).toLowerCase())}.jpg" alt="" loading="lazy">`;
function heat(lots) {
  const el = $('heat');
  const key = range === '30d' ? 'change_30d' : 'change_1d';
  const maxAbs = Math.max(1e-9, ...lots.map(x => Math.abs(Number(x[key]) || 0)));
  if (el.children.length !== lots.length) {
    el.innerHTML = lots.map(x => `<button class="tile empty" data-key="${esc(x.name)}" aria-label="${esc(x.city)}">
      <b class="tkr">${esc(x.label)}</b>${thumb(x)}<span class="city">${esc(x.city)}</span>
      <span class="price">–</span>
      <span class="row"><span class="chg">–</span><span class="held">–</span></span>
      <i class="flash"></i></button>`).join('');
    for (const t of el.querySelectorAll('.tile')) t.addEventListener('click', () => go('/land'));
  }
  for (const x of lots) {
    const t = el.querySelector(`.tile[data-key="${CSS.escape(x.name)}"]`); if (!t) continue;
    const ch = Number(x[key]) || 0;
    const a = Math.min(1, Math.abs(ch) / maxAbs) * 0.22;
    t.style.setProperty('--tint', ch > 0 ? `rgba(52,196,124,${a.toFixed(3)})` : ch < 0 ? `rgba(239,83,80,${a.toFixed(3)})` : 'transparent');
    t.querySelector('.price').innerHTML = x.price != null ? `$${fix2(x.price)}<small>/ sqft</small>` : '–';
    const chg = t.querySelector('.chg'); chg.textContent = x.price != null ? pctS(ch) : '–'; chg.className = `chg ${cls(ch)}`;
    const held = Number(x.sqft) || 0;
    t.querySelector('.held').textContent = held > 0 ? `${sqft(held)} sqft` : 'No position';
    t.classList.toggle('empty', held <= 0);
  }
}
function allocate({ sqft: s = 0, label = null } = {}) {
  const t = [...document.querySelectorAll('#heat .tile')].find(x => x.dataset.key === label || x.querySelector('.tkr').textContent === label);
  if (!t) return;
  t.classList.remove('bought'); void t.offsetWidth; t.classList.add('bought');
  if (!s) return;
  const f = document.createElement('span'); f.className = 'floater'; f.textContent = `+${sqft(s)} sqft`;
  t.appendChild(f); setTimeout(() => f.remove(), 1600);
}

// ---------- positions table ----------
function positions(table, lots, { compact = false } = {}) {
  table.innerHTML = `<thead><tr><th>Market</th><th>Ticker</th><th class="num">Index, $/sqft</th><th class="num">1D</th><th class="num">30D</th><th>Trend</th><th class="num">Target</th><th class="num">Held</th>${compact ? '' : '<th class="num">Value</th><th class="num">PnL</th>'}</tr></thead><tbody>` +
    (lots.map(x => `<tr><td><span class="mk">${thumb(x)}<span><span class="name">${esc(x.city)}</span><span class="city">${x.oracle_status !== 'Active' ? esc(x.oracle_status) : `market ${x.id}`}</span></span></span></td><td><span class="ticker ${x.target ? '' : 'off'}">${esc(x.label)}</span></td><td class="num">${fix2(x.price)}</td><td class="num ${cls(x.change_1d)}">${pctS(x.change_1d)}</td><td class="num ${cls(x.change_30d)}">${pctS(x.change_30d)}</td><td><canvas class="spark" data-spark="${x.spark.join(',')}" width="192" height="52"></canvas></td><td class="num"><span class="wbar"><i style="--w:${Math.round(x.weight * 100)}%"></i>${Math.round(x.weight * 100)}%</span></td><td class="num">${sqft(x.sqft)} sqft</td>${compact ? '' : `<td class="num">${x.sqft ? usd(x.notional) : '–'}</td><td class="num ${cls(x.upnl)}">${x.sqft ? signed(x.upnl) : '–'}</td>`}</tr>`).join('')
      || `<tr><td colspan="${compact ? 8 : 10}" class="empty">Reading the markets…</td></tr>`) + '</tbody>';
  drawSparks(table);
}
function drawSparks(root) {
  for (const c of root.querySelectorAll('canvas[data-spark]')) {
    const v = c.dataset.spark.split(',').map(Number).filter(x => x > 0);
    const ctx = c.getContext('2d'), w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    if (v.length < 2) continue;
    const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
    ctx.beginPath();
    v.forEach((p, i) => { const x = (i / (v.length - 1)) * (w - 6) + 3, y = h - 6 - ((p - min) / span) * (h - 12); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = v.at(-1) >= v[0] ? '#34c47c' : '#ef5350'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  }
}

// ---------- overview ----------
let homeTimer = null, seenOrders = null;
async function loadHome() {
  clearTimeout(homeTimer);
  if (location.pathname !== '/') return;
  try { await engineState(0); renderHome(); } catch {}
  homeTimer = setTimeout(loadHome, 15_000);
}
function progress(fraction) { $('hmRuler').firstElementChild.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`; }
function statusPill(el, { holding, armed, dry }) {
  el.textContent = holding ? 'Live' : armed ? (dry ? 'Armed · dry run' : 'Armed') : 'Standby';
  el.className = `pill ${holding ? 'live' : armed ? 'armed' : ''}`;
}
function renderHome() {
  const d = engineData; if (!d || location.pathname !== '/') return;
  const { config: c, live: l, totals: t, ledger: L, flow: f, land: Ld } = d;
  const now = Date.now();
  const holding = Ld.sqft > 0;
  setText('kpSqft', sqft(Ld.sqft));
  setText('kpSqftSub', holding ? `across ${Ld.cities} ${Ld.cities === 1 ? 'market' : 'markets'}` : 'no positions yet');
  setText('kpValue', usd(Ld.notional));
  const vs = $('kpValueSub'); vs.textContent = holding ? `${signed(Ld.upnl)} unrealized` : 'unrealized –'; vs.className = holding ? cls(Ld.upnl) : '';
  setText('kpColl', usd(Ld.collateral ?? 0));
  setText('kpCollSub', `${usd(Ld.available ?? 0)} free`);
  setText('kpClaimed', `${sol(t.claimed_lamports)} SOL`);
  setText('kpClaimedSub', `${usd(t.bridged_usdc)} bridged`);
  statusPill($('kpStatus'), { holding, armed: f.armed, dry: c.dry });
  if (f.next_run) { setText('hmLeft', until(f.next_run)); progress(1 - Math.max(0, f.next_run - now) / f.cycle_ms); }
  else { setText('hmLeft', `every ${Math.round(f.cycle_ms / 60000)} min`); progress(0); }
  const vault = l.vault;
  setText('vClaimable', vault ? `${vault.claimable_sol.toFixed(4)} SOL` : c.creator ? '…' : 'wallet not set');
  setText('vClaimed', `${sol(t.claimed_lamports)} SOL`);
  setText('vBridged', usd(t.bridged_usdc));
  const swaps = L.swaps ?? [], claims = L.claims ?? [], bridges = L.bridges ?? [], orders = (L.orders ?? []).filter(o => o.kind === 'buy');
  const lastSwap = swaps[0], lastClaim = claims[0], lastBridge = bridges[0], lastBuy = orders[0];
  const A = l.account;
  const ready = vault && vault.claimable_sol >= 0.01;
  const step = (name, text, state) => { const li = document.querySelector(`#hmSteps li[data-step="${name}"]`); li.className = state; li.querySelector('small').textContent = text || 'Waiting'; };
  step('claim', lastClaim ? `${sol(lastClaim.lamports)} SOL · ${ago(lastClaim.at)}` : vault ? `${vault.claimable_sol.toFixed(4)} SOL claimable` : '', ready ? 'wait' : lastClaim ? 'on' : '');
  step('convert', lastSwap ? `${usd(lastSwap.usdc)} · ${ago(lastSwap.at)}` : '', lastSwap ? 'on' : '');
  step('bridge', lastBridge ? `${usd(lastBridge.usdc)} · ${ago(lastBridge.at)}` : (l.wallet_usdc ?? 0) > 0 ? `${usd(l.wallet_usdc)} in the wallet` : '', lastBridge ? 'on' : (l.wallet_usdc ?? 0) >= c.min_bridge_usdc ? 'wait' : '');
  step('buy', lastBuy ? `${sqft(lastBuy.sqft)} sqft ${lastBuy.label ?? lastBuy.name} · ${ago(lastBuy.at)}` : A ? `${usd(A.available)} free collateral` : '', lastBuy ? 'on' : A && A.available >= c.min_order_usd ? 'wait' : '');
  const items = [
    ...claims.map(x => ({ at: x.at, k: 'claim', what: `${sol(x.lamports)} SOL from the creator vault`, link: ext(`https://solscan.io/tx/${x.sig}`, 'tx') })),
    ...swaps.map(x => ({ at: x.at, k: 'convert', what: `${sol(x.lamports)} SOL → ${usd(x.usdc)} USDC`, link: ext(`https://solscan.io/tx/${x.sig}`, 'tx') })),
    ...bridges.map(x => ({ at: x.at, k: 'bridge', what: `${usd(x.usdc)} USDC → Parcl`, link: ext(`https://solscan.io/tx/${x.sig}`, 'tx') })),
    ...orders.map(x => ({ at: x.at, k: 'buy', what: `${sqft(x.sqft)} sqft ${esc(x.city ?? x.name)} · ${usd(x.usd)}`, link: `<span class="mono">${esc(String(x.hash ?? '')).slice(0, 8)}</span>` })),
  ].sort((a, b) => b.at - a.at).slice(0, 8);
  $('hmActivity').innerHTML = items.map(x => `<li><span>${esc(x.k)}</span><em>${x.what}</em><b>${x.link} · ${ago(x.at)}</b></li>`).join('')
    || '<li class="empty"><svg viewBox="0 0 24 24"><path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6"/></svg>No activity yet. The first cycle writes the first line.</li>';
  $('hmAccount').innerHTML = A ? ext(c.account_url, `Parcl account #${A.id}`) : c.wallet ? ext(`https://solscan.io/account/${c.wallet}`, `wallet ${short(c.wallet)}`) : '–';
  const m0 = (Ld.lots ?? [])[0];
  setText('hmOracle', m0?.valid_until ? `Parcl Labs index · next print in ${until(m0.valid_until)}` : 'Parcl Labs index · daily print');
  heat(Ld.lots ?? []);
  positions($('hmSchedule'), Ld.lots ?? [], { compact: true });
  const newest = orders[0]?.at ?? 0;
  if (seenOrders != null && newest > seenOrders) for (const o of orders.filter(o => o.at > seenOrders).slice(0, 3)) allocate({ sqft: o.sqft, label: o.label ?? o.name });
  seenOrders = newest;
}
function tickHome() {
  const d = engineData; if (!d || location.pathname !== '/') return;
  const f = d.flow, now = Date.now();
  if (f.next_run) { setText('hmLeft', until(f.next_run)); progress(1 - Math.max(0, f.next_run - now) / f.cycle_ms); }
}
setInterval(tickHome, 1000);

// ---------- portfolio ----------
let landTimer = null;
async function loadLand() {
  clearTimeout(landTimer);
  if (location.pathname !== '/land') return;
  let d;
  try { d = await engineState(0); } catch { landTimer = setTimeout(loadLand, 20_000); return; }
  const { config: c, live: l, ledger: L, land: Ld, flow: f } = d;
  const row = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  const holding = Ld.sqft > 0;
  setText('ldSqft', sqft(Ld.sqft));
  setText('ldValue', usd(Ld.notional));
  const vs = $('ldValueSub'); vs.textContent = holding ? `${signed(Ld.upnl)} unrealized` : 'unrealized –'; vs.className = holding ? cls(Ld.upnl) : '';
  setText('ldColl', usd(Ld.collateral ?? 0));
  setText('ldCollSub', `${usd(Ld.available ?? 0)} free`);
  setText('ldMarkets', String((Ld.lots ?? []).length || 8));
  setText('ldMarketsSub', `${Ld.cities} with a position`);
  statusPill($('ldStatus'), { holding, armed: f.armed, dry: c.dry });
  const m0 = (Ld.lots ?? [])[0];
  setText('ldOracle', m0?.valid_until ? `Parcl Labs index · next print in ${until(m0.valid_until)}` : 'Parcl Labs index · daily');
  setText('ldSideTitle', holding ? 'marked daily' : 'nothing opened yet');
  setText('ldSideText', holding
    ? `${sqft(Ld.sqft)} square feet across ${Ld.cities} ${Ld.cities === 1 ? 'market' : 'markets'}, worth ${usd(Ld.notional)} at today's index. Every position is long at ${c.leverage}x and marked once a day at the Parcl Labs print; the engine only ever buys.`
    : `No positions yet. When the engine runs a cycle, rewards are converted to USDC, bridged to Parcl, and the first city index positions open here${Ld.on_the_way_usd > 0 ? ` (${usd(Ld.on_the_way_usd)} already on the way)` : ''}.`);
  positions($('ldLots'), Ld.lots ?? []);
  const A = l.account;
  $('ldLinks').innerHTML =
    row('Engine wallet · Parcl owner key', c.wallet ? `${acct(c.wallet)}${c.owner_hex ? `<br><code class="muted">0x${esc(c.owner_hex)}</code>` : ''}` : '<span class="muted">not armed yet</span>') +
    row('Parcl account', A ? `#${A.id} · ${ext(c.account_url, 'validator')} · ${esc(A.mode)} margin${A.pending ? ' · pending activation' : ''}` : c.wallet ? '<span class="muted">none yet: created from the first bridge deposit (≥ 5 USDC + 1 USDC activation)</span>' : '<span class="muted">–</span>') +
    row('Collateral', A ? `${usd(A.collateral)} USDC · ${usd(A.available)} free · ${signed(Ld.upnl)} unrealized` : '<span class="muted">–</span>') +
    row('On the way', `${usd(l.wallet_usdc ?? 0)} USDC in the wallet · ${usd(l.bridge?.unclaimed_usdc ?? 0)} unclaimed on the bridge${l.bridge?.deposits_halted ? ' · <span class="muted">deposits halted</span>' : ''}`) +
    row('Bridge program (Solana)', c.bridge_program ? acct(c.bridge_program) : '<span class="muted">–</span>') +
    row('Target book', c.targets.map(x => `${esc(x.label)} ${Math.round(x.weight * 100)}%`).join(' · ') + ` · ${c.leverage}x · every ${Math.round(c.every_ms / 60000)} min`) +
    row('Chain', `${esc(c.chain)} · ${ext(c.validator + '/v1/markets', 'markets')} · ${ext(c.app, 'trading app')}`);
  const items = [
    ...L.claims.map(x => ({ at: x.at, step: 'claim', what: `${sol(x.lamports)} SOL from the creator vault`, link: solLink(x.sig) })),
    ...L.swaps.map(x => ({ at: x.at, step: 'convert', what: `${sol(x.lamports)} SOL → ${usd(x.usdc)} USDC`, link: solLink(x.sig) })),
    ...L.bridges.map(x => ({ at: x.at, step: 'bridge', what: `${usd(x.usdc)} USDC → Parcl bridge`, link: solLink(x.sig) })),
    ...L.orders.map(x => ({ at: x.at, step: x.kind === 'account' ? 'account' : 'buy', what: x.kind === 'account' ? `Parcl account ${x.account_id ? `#${x.account_id}` : ''} funded with ${usd(x.usd)}` : `${sqft(x.sqft)} sqft of ${esc(x.name)} at ~$${num(x.price, 2)}/sqft · ${usd(x.usd)}`, link: `<span class="mono" title="${esc(x.hash ?? '')}">${esc(String(x.hash ?? '').slice(0, 12))}…</span>` })),
    ...L.errors.map(x => ({ at: x.at, step: 'error', what: `${esc(x.step)}: ${esc(x.error)}`, link: '–', bad: true })),
  ].sort((a, b) => b.at - a.at).slice(0, 80);
  $('ldLedger').innerHTML = '<thead><tr><th>Time</th><th>Step</th><th>Detail</th><th>Receipt</th></tr></thead><tbody>' +
    (items.map(x => `<tr><td class="muted">${time(x.at)}</td><td><span class="st ${x.bad ? 'st-queued' : ''}">${x.step}</span></td><td>${x.what}</td><td>${x.link}</td></tr>`).join('')
      || '<tr><td colspan="4" class="empty">No transactions yet. The first claim starts the loop.</td></tr>') + '</tbody>';
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
  $('stMarkets').innerHTML = '<thead><tr><th>Market</th><th class="num">Index, $/sqft</th><th class="num">1D</th><th class="num">30D</th><th class="num">Funding / h</th><th class="num">Weight</th><th class="num">Held, sqft</th><th class="num">PnL</th></tr></thead><tbody>' +
    (lots.map(x => `<tr><td><span class="mk">${thumb(x)}<span><span class="name">${esc(x.city)}</span><span class="city">${esc(x.label)}</span></span></span></td><td class="num">${fix2(x.price)}</td><td class="num ${cls(x.change_1d)}">${pctS(x.change_1d)}</td><td class="num ${cls(x.change_30d)}">${pctS(x.change_30d)}</td><td class="num">${(x.funding_hourly * 100).toFixed(4)}%</td><td class="num">${Math.round(x.weight * 100)}%</td><td class="num">${sqft(x.sqft)}</td><td class="num ${cls(x.upnl)}">${x.sqft ? signed(x.upnl) : '–'}</td></tr>`).join('')
      || '<tr><td colspan="8" class="empty">Reading the markets…</td></tr>') + '</tbody>';
  statsTimer = setTimeout(loadStats, 30_000);
}
addEventListener('resize', () => { if (location.pathname === '/stats') loadStats(); });

// ---------- how it works ----------
async function loadRules() {
  try {
    const { config: c } = await engineState();
    setText('ldEvery', `Every ${Math.round(c.every_ms / 60000)} minutes. Target book: ${c.targets.map(x => `${x.label} ${Math.round(x.weight * 100)}%`).join(', ')}. Orders go to the market furthest under its weight first; a deposit needs ${c.min_bridge_usdc} USDC, an order ${c.min_order_usd} USD. Leverage ${c.leverage}x${c.leverage === 1 ? ': notional equals collateral, nothing borrowed' : ''}.`);
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

route();
engineState().catch(() => {});
