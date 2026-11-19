/* RRR Tournament - Games section (separate file, old site code is not touched) */
(function () {
'use strict';
const GM = {
  rail: {name:'Rail Rush', icon:'🚆', time:'1 minute', desc:'Same track for everyone. Collect coins, dodge the blocks. Highest score wins.',
    rules:['Everyone in the match runs the same track.','Swipe left/right (or tap the left/right side of the game) to change lane.','Every coin = 10 points. Hitting a block costs 1 of your 3 lives.','The run ends after 60 seconds or when all 3 lives are gone.']},
  memory: {name:'Memory Match', icon:'🧠', time:'Up to 90 seconds', desc:'Same card board for everyone. Find all pairs with fewest moves.',
    rules:['Everyone gets the same hidden card board.','Tap two cards to flip them. Matching cards stay open.','Find all 8 pairs. Faster time and fewer moves = higher score (max 1000).','If 90 seconds pass, you get 20 points for every pair found.']},
  target: {name:'Target Tap', icon:'🎯', time:'45 seconds', desc:'Same targets for everyone. Tap fast and do not miss.',
    rules:['Everyone gets the same targets in the same places.','Tap a target before it disappears: +10 points.','Tapping empty space: -2 points.','The game lasts 45 seconds.']},
  math: {name:'Math Blitz', icon:'➕', time:'45 seconds', desc:'Same questions for everyone. Solve as many as you can.',
    rules:['Everyone gets the same questions in the same order.','Tap the correct answer out of 4 options.','Correct answer = +10 points. Wrong answer = -5 points (score never goes below 0).','The game lasts 45 seconds.']},
  dodge: {name:'Dodge Fall', icon:'☄️', time:'Up to 60 seconds', desc:'Same falling objects for everyone. Collect gems, dodge bombs.',
    rules:['Everyone gets the same falling gems and bombs.','Drag your finger left/right (or use the arrow keys) to move.','Every gem = 10 points. Every second you survive = 1 point.','Hitting a bomb costs 1 of your 3 lives. The game ends after 60 seconds or when all lives are gone.']},
  color: {name:'Color Match', icon:'🎨', time:'30 seconds', desc:'Same words for everyone. Tap the COLOR of the word, not what it says.',
    rules:['A color word is shown in some ink color. Example: the word RED may be written in blue.','Tap the button that matches the INK COLOR of the word, not the word itself.','Correct = +10 points. Wrong = -5 points (score never goes below 0).','The game lasts 30 seconds. Everyone gets the same words in the same order.']}
};
let PROFILE = {ign:'', uid:''}, CFG = {commission:.2, minFee:5, maxFee:500, playMin:10, openMin:30, games:{}}, OPEN = [], MINE = [], K = '', cur = null, stopFn = null, joinId = '';
const slots = n => n <= 2 ? 1 : n <= 5 ? 2 : 3, SPL = {1:[1], 2:[.65,.35], 3:[.5,.3,.2]};
const pool = (f, n) => Math.floor(f * n * (1 - CFG.commission) + 1e-9);
const prizes = (f, n) => SPL[slots(n)].map(x => Math.floor(pool(f, n) * x + 1e-9));
const lim = k => (CFG.games && CFG.games[k]) || {min:2, max:8};
const ORD = ['1st', '2nd', '3rd'];
const fail = d => '❌ ' + (MSG[d.status] || d.status) + (d.status === 'ERROR' && d.msg ? ' (' + d.msg + ')' : '');
const mins = ms => Math.max(0, Math.ceil((ms - Date.now()) / 60000)) + ' min';

/* ---------- random numbers (same seed = same game for everyone) ---------- */
const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function mkCanvas(c, w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.style.cssText = 'width:100%;max-width:360px;display:block;margin:0 auto;background:#0e1422;border:1px solid #222c42;border-radius:14px;touch-action:none;user-select:none'; c.el.appendChild(cv); return cv; }
function loop(fn) { let id, last = performance.now(), stop = false; const f = now => { if (stop) return; const dt = Math.min(.05, (now - last) / 1000); last = now; fn(dt); id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); return () => { stop = true; cancelAnimationFrame(id); }; }

/* ---------- GAME 1: Rail Rush ---------- */
function rail(c) {
  const W = 320, H = 480, PY = 400, cv = mkCanvas(c, W, H), g = cv.getContext('2d'), R = rng(c.seed), rows = [];
  for (let i = 0; i < 150; i++) {
    const x = R(); let coin = -1; const ob = [];
    if (x < .45) coin = Math.floor(R() * 3);
    else if (x < .8) { const a = Math.floor(R() * 3); ob.push(a); if (R() < .3) ob.push((a + 1 + Math.floor(R() * 2)) % 3); }
    rows.push({coin, ob, t: i * .4 + 1.5, d: false, got: false});
  }
  let lane = 1, lives = 3, score = 0, t = 0, flash = 0, over = false, sx = 0;
  const move = d => { lane = Math.max(0, Math.min(2, lane + d)); }, X = l => 53 + l * 107;
  cv.onpointerdown = e => { sx = e.clientX; };
  cv.onpointerup = e => { const dx = e.clientX - sx; if (Math.abs(dx) > 25) move(dx > 0 ? 1 : -1); else { const r = cv.getBoundingClientRect(); move(e.clientX < r.left + r.width / 2 ? -1 : 1); } };
  const key = e => { if (e.key === 'ArrowLeft') move(-1); if (e.key === 'ArrowRight') move(1); };
  window.addEventListener('keydown', key);
  const stop = loop(dt => {
    if (over) return;
    t += dt; flash = Math.max(0, flash - dt);
    rows.forEach(r => { if (!r.d && r.t <= t) { r.d = true; if (r.coin === lane) { score += 10; r.got = true; } if (r.ob.indexOf(lane) > -1) { lives--; flash = .3; } } });
    g.fillStyle = flash > 0 ? '#3a1218' : '#0e1422'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#222c42'; for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(i * W / 3, 0); g.lineTo(i * W / 3, H); g.stroke(); }
    rows.forEach(r => {
      const y = PY - (r.t - t) * 200; if (y < -30 || y > H + 30) return;
      if (r.coin > -1 && !r.got) { g.fillStyle = '#ffb400'; g.beginPath(); g.arc(X(r.coin), y, 11, 0, 7); g.fill(); }
      r.ob.forEach(l => { g.fillStyle = '#e11d48'; g.fillRect(X(l) - 24, y - 14, 48, 28); });
    });
    g.fillStyle = '#22d3ee'; g.fillRect(X(lane) - 18, PY - 16, 36, 32);
    c.hud('Score ' + score + '  •  ' + '❤'.repeat(Math.max(lives, 0)) + '  •  ' + Math.max(0, Math.ceil(60 - t)) + 's');
    if (t >= 60 || lives <= 0) { over = true; c.end(score); }
  });
  return () => { stop(); window.removeEventListener('keydown', key); };
}

/* ---------- GAME 2: Memory Match ---------- */
function memory(c) {
  const E = ['🍎', '🍌', '🍇', '🍒', '🥝', '🍉', '🍍', '🥭'], R = rng(c.seed), a = E.concat(E);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const box = document.createElement('div'); box.className = 'mgrid'; c.el.appendChild(box);
  let open = [], pairs = 0, moves = 0, lock = false, over = false; const t0 = performance.now(), tm = [], sec = () => (performance.now() - t0) / 1000;
  const btn = a.map((v, i) => { const b = document.createElement('button'); b.className = 'mcell'; b.textContent = '?'; b.onclick = () => flip(i); box.appendChild(b); return b; });
  function fin() { if (over) return; over = true; c.end(pairs === 8 ? Math.max(100, Math.round(1000 - sec() * 6 - moves * 12)) : pairs * 20); }
  function flip(i) {
    if (over || lock || open.indexOf(i) > -1 || btn[i].classList.contains('ok')) return;
    btn[i].textContent = a[i]; btn[i].classList.add('up'); open.push(i);
    if (open.length === 2) {
      moves++; const [x, y] = open; open = [];
      if (a[x] === a[y]) { btn[x].classList.add('ok'); btn[y].classList.add('ok'); pairs++; if (pairs === 8) fin(); }
      else { lock = true; tm.push(setTimeout(() => { [x, y].forEach(k => { btn[k].textContent = '?'; btn[k].classList.remove('up'); }); lock = false; }, 700)); }
    }
  }
  const iv = setInterval(() => { c.hud('Pairs ' + pairs + '/8  •  Moves ' + moves + '  •  ' + Math.max(0, 90 - Math.floor(sec())) + 's'); if (sec() >= 90) fin(); }, 250);
  return () => { clearInterval(iv); tm.forEach(clearTimeout); over = true; };
}

/* ---------- GAME 3: Target Tap ---------- */
function target(c) {
  const W = 320, H = 420, cv = mkCanvas(c, W, H), g = cv.getContext('2d'), R = rng(c.seed), T = [];
  for (let i = 0; i < 56; i++) T.push({x: 34 + R() * 252, y: 34 + R() * 352, r: 22 + R() * 8, t: i * .8, h: false});
  let t = 0, score = 0, over = false;
  cv.onpointerdown = e => {
    if (over) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height; let hit = null;
    T.forEach(o => { if (!o.h && t >= o.t && t < o.t + 1.3 && Math.hypot(o.x - x, o.y - y) <= o.r + 4) hit = o; });
    if (hit) { hit.h = true; score += 10; } else score = Math.max(0, score - 2);
  };
  const stop = loop(dt => {
    if (over) return; t += dt;
    g.fillStyle = '#0e1422'; g.fillRect(0, 0, W, H);
    T.forEach(o => { if (o.h || t < o.t || t >= o.t + 1.3) return; const k = (t - o.t) / 1.3;
      g.fillStyle = '#e11d48'; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
      g.fillStyle = '#ffb400'; g.beginPath(); g.arc(o.x, o.y, o.r * (1 - k) * .8, 0, 7); g.fill(); });
    c.hud('Score ' + score + '  •  ' + Math.max(0, Math.ceil(45 - t)) + 's');
    if (t >= 45) { over = true; c.end(score); }
  });
  return () => { stop(); over = true; };
}
/* ---------- GAME 4: Math Blitz ---------- */
function math(c) {
  const R = rng(c.seed), Q = [];
  for (let i = 0; i < 150; i++) {
    const t = Math.floor(R() * 3); let a, b, ans, txt;
    if (t === 0) { a = 3 + Math.floor(R() * 40); b = 3 + Math.floor(R() * 40); ans = a + b; txt = a + ' + ' + b; }
    else if (t === 1) { a = 20 + Math.floor(R() * 60); b = 3 + Math.floor(R() * 17); ans = a - b; txt = a + ' − ' + b; }
    else { a = 2 + Math.floor(R() * 9); b = 2 + Math.floor(R() * 9); ans = a * b; txt = a + ' × ' + b; }
    const o = [ans]; let guard = 0;
    while (o.length < 4 && guard++ < 50) { const d = (1 + Math.floor(R() * 9)) * (R() < .5 ? -1 : 1), v = ans + d; if (v >= 0 && o.indexOf(v) < 0) o.push(v); }
    while (o.length < 4) o.push(ans + o.length + 10);
    for (let k = o.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [o[k], o[j]] = [o[j], o[k]]; }
    Q.push({txt, ans, o});
  }
  const q = document.createElement('div'); q.className = 'mbq'; c.el.appendChild(q);
  const box = document.createElement('div'); box.className = 'mbgrid'; c.el.appendChild(box);
  let i = 0, score = 0, over = false; const t0 = performance.now(), sec = () => (performance.now() - t0) / 1000;
  const btn = [0, 1, 2, 3].map(k => { const b = document.createElement('button'); b.className = 'mbbtn'; b.onclick = () => pick(k); box.appendChild(b); return b; });
  function show() { const x = Q[i]; q.textContent = x.txt + ' = ?'; btn.forEach((b, k) => { b.textContent = x.o[k]; }); }
  function pick(k) { if (over) return; if (Q[i].o[k] === Q[i].ans) score += 10; else score = Math.max(0, score - 5); i++; if (i >= Q.length) return fin(); show(); }
  function fin() { if (over) return; over = true; c.end(score); }
  show();
  const iv = setInterval(() => { c.hud('Score ' + score + '  •  ' + Math.max(0, Math.ceil(45 - sec())) + 's'); if (sec() >= 45) fin(); }, 200);
  return () => { clearInterval(iv); over = true; };
}

/* ---------- GAME 5: Dodge Fall ---------- */
function dodge(c) {
  const W = 320, H = 420, PY = 380, cv = mkCanvas(c, W, H), g = cv.getContext('2d'), R = rng(c.seed), items = [];
  for (let i = 0; i < 130; i++) items.push({x: 22 + R() * 276, t: 1 + i * .5, v: 190 + R() * 70, gem: R() < .3, d: false});
  let px = W / 2, lives = 3, gems = 0, t = 0, flash = 0, over = false, dir = 0;
  const setX = e => { const r = cv.getBoundingClientRect(); px = Math.max(18, Math.min(W - 18, (e.clientX - r.left) * W / r.width)); };
  cv.onpointerdown = e => { setX(e); try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
  cv.onpointermove = e => { if (e.buttons || e.pointerType === 'touch') setX(e); };
  const kd = e => { if (e.key === 'ArrowLeft') dir = -1; if (e.key === 'ArrowRight') dir = 1; }, ku = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') dir = 0; };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  const stop = loop(dt => {
    if (over) return;
    t += dt; flash = Math.max(0, flash - dt); px = Math.max(18, Math.min(W - 18, px + dir * 260 * dt));
    g.fillStyle = flash > 0 ? '#3a1218' : '#0e1422'; g.fillRect(0, 0, W, H);
    items.forEach(o => {
      if (o.d || t < o.t) return; const y = (t - o.t) * o.v - 20;
      if (y > H + 20) { o.d = true; return; }
      if (Math.abs(o.x - px) < 26 && Math.abs(y - PY) < 24) { o.d = true; if (o.gem) gems++; else { lives--; flash = .3; } return; }
      if (o.gem) { g.fillStyle = '#22d3ee'; g.beginPath(); g.moveTo(o.x, y - 12); g.lineTo(o.x + 10, y); g.lineTo(o.x, y + 12); g.lineTo(o.x - 10, y); g.closePath(); g.fill(); }
      else { g.fillStyle = '#e11d48'; g.beginPath(); g.arc(o.x, y, 12, 0, 7); g.fill(); g.fillStyle = '#ffb400'; g.fillRect(o.x - 2, y - 18, 4, 7); }
    });
    g.fillStyle = '#ffb400'; g.fillRect(px - 20, PY - 12, 40, 24);
    const score = gems * 10 + Math.floor(t);
    c.hud('Score ' + score + '  •  ' + '❤'.repeat(Math.max(lives, 0)) + '  •  ' + Math.max(0, Math.ceil(60 - t)) + 's');
    if (t >= 60 || lives <= 0) { over = true; c.end(score); }
  });
  return () => { stop(); over = true; window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
}

/* ---------- GAME 6: Color Match ---------- */
function color(c) {
  const N = ['RED', 'GREEN', 'BLUE', 'YELLOW'], H = ['#e11d48', '#22c55e', '#3b82f6', '#ffb400'], R = rng(c.seed), Q = [];
  for (let i = 0; i < 200; i++) { const ink = Math.floor(R() * 4); let w = ink; if (R() < .7) w = (ink + 1 + Math.floor(R() * 3)) % 4; Q.push({w, ink}); }
  const q = document.createElement('div'); q.className = 'cmword'; c.el.appendChild(q);
  const box = document.createElement('div'); box.className = 'cmgrid'; c.el.appendChild(box);
  let i = 0, score = 0, over = false; const t0 = performance.now(), sec = () => (performance.now() - t0) / 1000;
  H.forEach((h, k) => { const b = document.createElement('button'); b.className = 'cmbtn'; b.style.background = h; b.onclick = () => pick(k); box.appendChild(b); });
  function show() { q.textContent = N[Q[i].w]; q.style.color = H[Q[i].ink]; }
  function pick(k) { if (over) return; if (k === Q[i].ink) score += 10; else score = Math.max(0, score - 5); i++; if (i >= Q.length) return fin(); show(); }
  function fin() { if (over) return; over = true; c.end(score); }
  show();
  const iv = setInterval(() => { c.hud('Score ' + score + '  •  ' + Math.max(0, Math.ceil(30 - sec())) + 's'); if (sec() >= 30) fin(); }, 200);
  return () => { clearInterval(iv); over = true; };
}
const ENG = {rail, memory, target, math, dodge, color};

/* ---------- page parts (added to the site by this file) ---------- */
const css = `.gh{display:flex;justify-content:space-between;align-items:center}.gi{width:48px;height:48px;border-radius:14px;background:#1c2438;display:flex;align-items:center;justify-content:center;font-size:26px}
.gtag{font-size:11px;letter-spacing:1px;color:var(--mut);font-weight:700}.gchips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.gb{display:flex;gap:8px;flex-wrap:wrap}.gb .nbtn{flex:1}
.mgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:360px;margin:0 auto}.mcell{aspect-ratio:1;font-size:30px;border-radius:12px;border:1px solid var(--line);background:#1c2438;color:var(--g);cursor:pointer}
.mcell.up{background:#0e1422;color:#fff}.mcell.ok{background:#12351f;border-color:#4ade80}#gpHud{text-align:center;color:var(--g);font-weight:700;margin-bottom:10px;min-height:20px}
.tabbar a{font-size:11px}.gr{padding-left:32px;line-height:1.7;margin:6px 0 14px}.gr li{margin-bottom:6px}.balchip{background:#1c2438;border:1px solid var(--line);color:var(--g);font-weight:700;font-size:13px;border-radius:20px;padding:8px 12px;white-space:nowrap}
.mbq{text-align:center;font-family:Oswald,sans-serif;font-size:38px;color:#fff;margin:10px 0 16px}.mbgrid,.cmgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:360px;margin:0 auto}.mbbtn{padding:18px 0;font-size:26px;font-weight:700;border-radius:12px;border:1px solid var(--line);background:#1c2438;color:var(--g);cursor:pointer}.mbbtn:active{background:#0e1422}
.cmword{text-align:center;font-family:Oswald,sans-serif;font-size:56px;margin:14px 0 20px;letter-spacing:2px}.cmbtn{height:84px;border-radius:14px;border:3px solid #0a0e17;cursor:pointer}.cmbtn:active{opacity:.7}`;
function build() {
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
  const tab = document.createElement('a'); tab.id = 'nGames'; tab.innerHTML = '<span>🕹️</span>Games'; tab.onclick = openGames;
  document.querySelector('.tabbar').insertBefore(tab, $('nWal'));
  document.querySelector('footer').insertAdjacentHTML('beforebegin', `
<section class="view" id="vGames"><h2 class="stitle">🕹️ Games</h2>
  <div class="card"><h3>My Game Matches</h3><p>Rooms you created or joined.</p><div id="gMine"></div><button class="gbtn" style="margin-top:10px" onclick="RRRG.refresh()">Refresh</button></div>
  <div id="gCards"></div></section>
<section class="view" id="vGameList"><button class="back" onclick="show('vGames')">← Back</button><h2 class="stitle" id="glTitle"></h2>
  <button class="gbtn" style="margin:0 0 14px" onclick="RRRG.create()">➕ Create Match</button><div id="glRows"></div></section>
<section class="view" id="vGamePlay"><button class="back" id="gpBack" onclick="RRRG.leave()">← Back</button><h2 class="stitle" id="gpTitle"></h2><div id="gpHud"></div><div id="gArena"></div><div id="gpMsg"></div></section>`);
  document.body.insertAdjacentHTML('beforeend', `
<div class="modal" id="gRulesModal"><div class="modal-c"><span class="x" onclick="closeModals()">&times;</span><div class="nbar"><button class="nbtn" onclick="closeModals()">← Back</button></div><h2 id="grTitle" style="margin-bottom:10px"></h2><div id="grList"></div></div></div>
<div class="modal" id="gCreateModal"><div class="modal-c"><span class="x" onclick="closeModals()">&times;</span><div class="nbar"><button class="nbtn" onclick="closeModals()">← Back</button></div><h2 style="margin-bottom:12px">Create Match</h2>
  <form onsubmit="RRRG.doCreate(event)">
  <div class="fg"><label>Game</label><select id="gcGame" class="fc" onchange="RRRG.prev(true)"></select></div>
  <div class="fg"><label>Entry fee per player (coins)</label><input id="gcFee" type="number" class="fc" required oninput="RRRG.prev()"></div>
  <div class="fg"><label>Max players in the room</label><select id="gcMax" class="fc" onchange="RRRG.prev()"></select></div>
  <div class="fg"><label>IGN <small style="color:var(--mut)">(In-Game Name)</small></label><input id="gcIgn" class="fc" required maxlength="40"></div>
  <div class="card" id="gcPrev" style="font-size:13px"></div>
  <button class="gbtn" id="gcBtn" type="submit">Create and pay entry fee</button></form></div></div>
<div class="modal" id="gJoinModal"><div class="modal-c"><span class="x" onclick="closeModals()">&times;</span><div class="nbar"><button class="nbtn" onclick="closeModals()">← Back</button></div><h2 id="gjTitle" style="margin-bottom:6px"></h2><p id="gjInfo" style="margin-bottom:12px;font-size:13px"></p>
  <form onsubmit="RRRG.doJoin(event)"><div class="fg"><label>IGN <small style="color:var(--mut)">(In-Game Name)</small></label><input id="gjIgn" class="fc" required maxlength="40"></div>
  <button class="gbtn" id="gjBtn" type="submit">Join and pay entry fee</button></form></div></div>`);
  NAVOF.vGames = NAVOF.vGameList = NAVOF.vGamePlay = 'nGames';
}

/* ---------- data + lists ---------- */
async function load() {
  try { const d = await (await fetch(WEB_APP_URL + '?action=getGameMatches')).json(); if (d.cfg) CFG = d.cfg; OPEN = d.matches || []; } catch (e) {}
  MSG.BAD_FEE = 'Entry fee must be between ' + CFG.minFee + ' and ' + CFG.maxFee + ' coins';
  if (token) { try { const d = await api('gameMine'); if (d.status === 'SUCCESS') { MINE = d.mine; if (d.profile) { PROFILE = d.profile; fillProfile(); } } } catch (e) {} } else MINE = [];
  renderCards(); renderMine(); if ($('vGameList').classList.contains('on')) renderList();
}
function openGames() { show('vGames'); load(); }
function renderCards() {
  $('gCards').innerHTML = Object.keys(GM).map(k => { const g = GM[k], c = OPEN.filter(m => m.game === k).length, l = lim(k);
    return `<div class="card"><div class="gh"><div class="gi">${g.icon}</div><span class="gtag">PLAY &amp; PRACTICE</span></div><h3 style="margin-top:10px">${g.name}</h3><p>${g.desc}</p>
    <div class="gchips"><span class="chip">👥 ${l.min} to ${l.max} players</span><span class="chip">⏱ ${g.time}</span></div>
    <div class="gb"><button class="nbtn" onclick="RRRG.rules('${k}')">📖 Rules</button><button class="nbtn" onclick="RRRG.list('${k}')">👥 Contests (${c})</button></div>
    <div class="gb" style="margin-top:8px"><button class="gbtn" style="margin:0;flex:1" onclick="RRRG.free('${k}')">▶ Free Play</button><button class="nbtn" onclick="RRRG.create('${k}')">➕ Create Match</button></div></div>`; }).join('');
}
function mineRow(m) {
  const g = GM[m.game] || {name: m.game, icon: '🎮'}; let st = '', act = '';
  if (m.status === 'Open') {
    st = 'Waiting for players ' + m.n + '/' + m.max + ' • room closes in ' + mins(m.expires);
    if (m.creator) act = (m.n >= lim(m.game).min ? `<button class="nbtn" onclick="RRRG.begin('${m.id}',this)">▶ Start now</button> ` : '') + `<button class="nbtn red" onclick="RRRG.cancel('${m.id}',this)">Cancel room</button>`;
  } else if (m.status === 'Live') {
    if (m.played) st = 'Your score: ' + m.score + ' • waiting for other players';
    else if (m.started) st = 'You started this match but your score was not received.';
    else { st = 'LIVE • ' + mins(m.endsAt) + ' left to start your try'; act = `<button class="gbtn" style="margin:8px 0 0" onclick="RRRG.play('${m.id}','${m.game}')">▶ Play now</button>`; }
  } else if (m.status === 'Done') {
    const w = /Paid\s+(\d+)/.exec(m.reward || ''); st = w ? '🏆 You won ' + w[1] + ' coins (rank #' + m.rank + ')' : 'Finished • ' + (m.rank ? 'rank #' + m.rank + ' • ' : '') + (m.reward || 'no reward');
  } else st = 'Cancelled • entry fee refunded';
  return `<div class="room"><b>${g.icon} ${esc(g.name)}</b> <small>• Entry ${m.fee} • Prize ${m.pool} coins</small><p style="font-size:13px;margin-top:4px">${esc(st)}</p>${act}</div>`;
}
function renderMine() {
  $('gMine').innerHTML = !token ? '<p class="empty">Sign in to join or create matches.</p>' : MINE.length ? MINE.map(mineRow).join('') : '<p class="empty">Join or create a match to see it here.</p>';
}
function renderList() {
  $('glTitle').innerText = GM[K].name + ' Contests';
  const l = OPEN.filter(m => m.game === K);
  $('glRows').innerHTML = l.length ? l.map(m => { const full = m.n >= m.max;
    return `<div class="rc ${full ? 'full' : ''}" ${full ? '' : `onclick="RRRG.join('${m.id}')"`}><div class="rt"><span class="chip">ENTRY ${m.fee} COINS</span><span class="st ${full ? 'f' : 'o'}">${full ? 'FULL' : 'OPEN'}</span></div>
    <div class="rm"><div><h4>${esc(m.by)}'s room</h4><small>${m.n}/${m.max} players • closes in ${mins(m.expires)}</small></div><div class="pz"><b>${pool(m.fee, m.max)} Coins</b><small>prize if room fills</small></div></div>
    <div class="pbar"><i style="width:${Math.min(100, m.n / m.max * 100)}%"></i></div></div>`; }).join('') : '<p class="empty">No open rooms. Create one and invite your friends!</p>';
}
function list(k) { K = k; show('vGameList'); renderList(); load(); }

/* ---------- rules ---------- */
function rules(k) {
  const g = GM[k], l = lim(k), pc = Math.round(CFG.commission * 100), li = a => a.map(x => '<li>' + esc(x) + '</li>').join('');
  $('grTitle').innerText = g.icon + ' ' + g.name + ' - Rules';
  $('grList').innerHTML = '<h4 style="margin-top:4px">How to play</h4><ol class="gr">' + li(g.rules) + '</ol><h4>Contest rules</h4><ol class="gr">' + li([
    'FREE PLAY is for practice. It is solo and no coins are used.',
    'CREATE MATCH: the creator chooses the entry fee and the max players (' + l.min + ' to ' + l.max + '). The entry fee is taken from your wallet when you create or join.',
    'The room starts when it is full, or when the creator taps Start now (at least ' + l.min + ' players). If it is not full after ' + CFG.openMin + ' minutes, it starts if ' + l.min + '+ players joined, otherwise it is cancelled and everybody is refunded.',
    'Prize pool = all entry fees minus ' + pc + '% service fee. 2 players: winner takes all. 3 to 5 players: 1st 65%, 2nd 35%. 6 to 8 players: 1st 50%, 2nd 30%, 3rd 20%.',
    'After the room starts you have ' + CFG.playMin + ' minutes to press Play. You get only ONE try. If you do not play, you lose your entry fee.',
    'Do not leave or close the game while playing. A try that is not finished is lost.',
    'Highest score wins. Same score: the player who finished first wins.',
    'Scores are checked automatically. Impossible scores are rejected, the entry fee is not returned, and the account can be banned. Using more than one account in the same room is not allowed.'
  ]) + '</ol>';
  $('gRulesModal').style.display = 'flex';
}

/* ---------- create / join ---------- */
function create(k) {
  if (!token) return loginWithGoogle();
  k = k || K || 'rail';
  $('gcGame').innerHTML = Object.keys(GM).map(x => `<option value="${x}">${GM[x].name}</option>`).join(''); $('gcGame').value = k;
  $('gcFee').min = CFG.minFee; $('gcFee').max = CFG.maxFee; $('gcFee').value = Math.max(CFG.minFee, 10);
  $('gcIgn').value = PROFILE.ign || ''; if (!$('gcIgn').value) { try { $('gcIgn').value = localStorage.getItem('rrr_game_ign') || ''; } catch (e) {} }
  prev(true); $('gCreateModal').style.display = 'flex';
}
function prev(newGame) {
  const k = $('gcGame').value, l = lim(k);
  if (newGame) { let o = ''; for (let i = l.min; i <= l.max; i++) o += `<option>${i}</option>`; $('gcMax').innerHTML = o; $('gcMax').value = l.min === 2 && l.max >= 4 ? 4 : l.max; }
  const f = Math.floor(Number($('gcFee').value)), n = Number($('gcMax').value);
  $('gcPrev').innerHTML = !(f >= CFG.minFee && f <= CFG.maxFee) ? 'Enter an entry fee between ' + CFG.minFee + ' and ' + CFG.maxFee + ' coins.'
    : 'If the room fills (' + n + ' players): prize pool <b style="color:var(--g)">' + pool(f, n) + ' coins</b><br>' + prizes(f, n).map((p, i) => ORD[i] + ' place: <b style="color:#fff">' + p + ' coins</b>').join(' • ') + '<br><small>You pay ' + f + ' coins now. It is refunded if the room is cancelled.</small>';
}
function doCreate(e) {
  e.preventDefault(); const ign = $('gcIgn').value.trim();
  guarded($('gcBtn'), async () => {
    const d = await api('gameCreate', {game: $('gcGame').value, fee: $('gcFee').value, max: $('gcMax').value, ign});
    if (d.status === 'SUCCESS') { try { localStorage.setItem('rrr_game_ign', ign); } catch (x) {} setCoins(d.newBalance); closeModals(); K = $('gcGame').value; alert('✅ Room created! Share the game with friends so they can join.'); load(); list(K); }
    else if (d.status !== 'Banned') alert(fail(d));
  });
}
function join(id) {
  if (!token) return loginWithGoogle();
  const m = OPEN.find(x => x.id === id); if (!m) return; joinId = id;
  $('gjTitle').innerText = GM[m.game].name + ' - ' + m.fee + ' coins';
  $('gjInfo').innerHTML = esc(m.by) + "'s room • " + m.n + '/' + m.max + ' players • prize if room fills: <b style="color:var(--g)">' + pool(m.fee, m.max) + ' coins</b>';
  $('gjIgn').value = PROFILE.ign || ''; if (!$('gjIgn').value) { try { $('gjIgn').value = localStorage.getItem('rrr_game_ign') || ''; } catch (e) {} }
  $('gJoinModal').style.display = 'flex';
}
function doJoin(e) {
  e.preventDefault(); const ign = $('gjIgn').value.trim();
  guarded($('gjBtn'), async () => {
    const d = await api('gameJoin', {matchId: joinId, ign});
    if (d.status === 'SUCCESS') { try { localStorage.setItem('rrr_game_ign', ign); } catch (x) {} setCoins(d.newBalance); closeModals(); alert(d.live ? '🎉 Joined! The room is full and the match is LIVE. Go to Games > My Game Matches and tap Play now.' : '✅ Joined! Wait for the room to fill.'); load(); }
    else if (d.status !== 'Banned') { alert(fail(d)); load(); }
  });
}
function simple(btn, name, id, ok) {
  guarded(btn, async () => {
    const d = await api(name, {matchId: id});
    if (d.status === 'SUCCESS') { if (d.newBalance != null) setCoins(d.newBalance); alert(ok); } else if (d.status !== 'Banned') alert(fail(d));
    load();
  });
}
const begin = (id, b) => simple(b, 'gameBegin', id, '✅ Match started! Everyone was notified.');
const cancel = (id, b) => { if (confirm('Cancel this room? Everybody gets their entry fee back.')) simple(b, 'gameCancel', id, '✅ Room cancelled and fees refunded.'); };

/* ---------- playing ---------- */
function prep(k, matchId) {
  cur = {k, matchId, done: false}; $('gpTitle').innerText = GM[k].name + (matchId ? ' • Match' : ' • Free Play'); $('gpHud').innerText = ''; $('gpMsg').innerHTML = ''; $('gpBack').style.display = '';
  $('gArena').innerHTML = `<div class="card" style="text-align:center"><p style="color:#fff;font-size:15px;margin-bottom:6px">${matchId ? '⚠️ You get only ONE try. Do not close or leave this screen.' : 'Practice mode. No coins are used.'}</p><button class="gbtn" onclick="RRRG.go(this)">▶ Start</button></div>`;
  show('vGamePlay');
}
const free = k => { if (stopFn) { stopFn(); stopFn = null; } prep(k, ''); };
const play = (id, k) => prep(k, id);
async function go(btn) {
  btn.disabled = true; let seed = Math.floor(Math.random() * 2e9);
  if (cur.matchId) {
    let d; try { d = await api('gamePlay', {matchId: cur.matchId}); } catch (e) { btn.disabled = false; return alert('Network error. Please try again.'); }
    if (d.status !== 'SUCCESS') { if (d.status !== 'Banned') alert(fail(d)); return leave(); }
    seed = d.seed; $('gpBack').style.display = 'none';
  }
  $('gArena').innerHTML = ''; stopFn = ENG[cur.k]({el: $('gArena'), seed, hud: t => { $('gpHud').innerText = t; }, end: finish});
}
async function finish(score) {
  if (!cur || cur.done) return; cur.done = true; if (stopFn) { stopFn(); stopFn = null; } $('gpBack').style.display = '';
  if (!cur.matchId) { $('gpMsg').innerHTML = `<div class="card" style="text-align:center;margin-top:12px"><h3>Your score: ${score}</h3><button class="gbtn" onclick="RRRG.free('${cur.k}')">🔁 Play again</button></div>`; return; }
  cur.score = score; send();
}
async function send() {
  $('gpMsg').innerHTML = '<p class="empty">Sending your score...</p>';
  for (let i = 0; i < 3; i++) {
    try {
      const d = await api('gameSubmit', {matchId: cur.matchId, score: cur.score});
      if (d.newBalance != null) setCoins(d.newBalance);
      const t = d.status !== 'SUCCESS' ? fail(d) : d.flagged ? '⚠️ Your score could not be verified, so it was not counted.' : '✅ Score ' + d.score + ' submitted. Results come when all players finish or time ends. Check Games > My Game Matches.';
      $('gpMsg').innerHTML = `<div class="card" style="text-align:center;margin-top:12px"><p style="color:#fff">${esc(t)}</p><button class="gbtn" onclick="RRRG.leave()">Back to Games</button></div>`; return;
    } catch (e) { await new Promise(r => setTimeout(r, 1500)); }
  }
  $('gpMsg').innerHTML = '<div class="card" style="text-align:center;margin-top:12px"><p>Could not send your score. Check your internet and tap Retry. Do not close this page.</p><button class="gbtn" onclick="RRRG.retry()">Retry</button></div>';
}
function leave() { if (stopFn) { stopFn(); stopFn = null; } $('gArena').innerHTML = ''; show('vGames'); load(); }

function fillProfile() { if ($('pfIgn')) { $('pfIgn').value = PROFILE.ign || ''; $('pfUid').value = PROFILE.uid || ''; $('pfBtn').innerText = PROFILE.ign || PROFILE.uid ? 'Save changes' : 'Save'; } }
async function loadProfile() { try { const d = await api('gameProfileGet'); if (d.status === 'SUCCESS') { PROFILE = d.profile; fillProfile(); } } catch (e) {} }
function saveProfile(e) {
  e.preventDefault();
  guarded($('pfBtn'), async () => {
    const d = await api('gameProfileSave', {ign: $('pfIgn').value.trim(), uid: $('pfUid').value.trim()});
    if (d.status === 'SUCCESS') { PROFILE = d.profile; fillProfile(); alert('✅ Saved. Your IGN will fill automatically in the Games section.'); } else if (d.status !== 'Banned') alert(fail(d));
  });
}
window.RRRG = {saveProfile, rules, list, free, play, go, create, prev, doCreate, join, doJoin, begin, cancel, leave, refresh: load, retry: send};
build();
/* balance next to the bell */
document.querySelector('.top .in-only').insertAdjacentHTML('beforebegin', '<span class="in-only balchip">🪙 <b id="topBal">' + $('coins').innerText + '</b></span>');
{ const o = setCoins; setCoins = c => { o(c); $('topBal').innerText = $('coins').innerText; }; }
/* Game Profile card in Account */
$('vAccount').querySelector('.card').insertAdjacentHTML('afterend', `<div class="card"><h3>🎮 Game Profile <small style="color:var(--mut);font-size:12px">(optional)</small></h3><p>Only for the new Games section. Your IGN fills automatically there.</p>
  <form onsubmit="RRRG.saveProfile(event)" style="margin-top:10px"><div class="fg"><label>IGN <small style="color:var(--mut)">(In-Game Name)</small></label><input id="pfIgn" class="fc" maxlength="40" placeholder="Your name in the game"></div>
  <div class="fg"><label>UID <small style="color:var(--mut)">(User ID)</small></label><input id="pfUid" class="fc" inputmode="numeric" pattern="[0-9]{6,15}" placeholder="Numbers only (optional)"></div>
  <button class="gbtn" id="pfBtn" type="submit">Save</button></form></div>`);
{ const oa = openAccount; openAccount = function () { oa(); if (token) loadProfile(); }; }
new MutationObserver(() => { if (!document.body.classList.contains('in')) { PROFILE = {ign: '', uid: ''}; fillProfile(); $('topBal').innerText = '0'; MINE = []; } }).observe(document.body, {attributes: true, attributeFilter: ['class']});
setInterval(() => { if (document.visibilityState === 'visible' && ($('vGames').classList.contains('on') || $('vGameList').classList.contains('on'))) load(); }, 20000);
})();
