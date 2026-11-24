/* ====================================================================
   RRR GAME CORE  (shared by the website AND by Apps Script Code.gs)
   Every game is a fixed-step (60 ticks per second) simulation.
   The website sends only the player's MOVES (inputs). The server plays
   the same game again from the same seed and calculates the score itself,
   so a faked score can never be accepted.
   Written in plain old JavaScript (ES5) so it runs anywhere.
   ==================================================================== */
var RRRCORE = (function () {
'use strict';

function imul(a, b) { var ah = (a >>> 16) & 0xffff, al = a & 0xffff, bh = (b >>> 16) & 0xffff, bl = b & 0xffff; return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0) | 0); }
function rng(seed) { var s = seed | 0; return function () { s = (s + 0x6D2B79F5) | 0; var t = imul(s ^ (s >>> 15), 1 | s); t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function ri(R, n) { return Math.floor(R() * n); }
function num(v) { if (v === null || v === undefined || v === '' || typeof v === 'boolean') return NaN; var n = Number(v); return isFinite(n) ? Math.floor(n) : NaN; }
function shuffle(R, a) { for (var i = a.length - 1; i > 0; i--) { var j = ri(R, i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function median(a) { if (!a.length) return 9999; var b = a.slice().sort(function (x, y) { return x - y; }); return b[b.length >> 1]; }

var G = {};

/* ---------------------------------------------------------------- RAIL RUSH */
G.rail = {ticks: 3600, gap: 4, maxIn: 700, rhythm: false,
  init: function (seed) {
    var R = rng(seed), items = [], z = 16;
    function add(zz, l, k) { items.push({z: zz, l: l, k: k, d: 0}); }
    while (z < 1100) {
      var r = R(), a = ri(R, 3), b, f;
      if (r < .22) { add(z, a, 0); add(z + 1.6, a, 0); add(z + 3.2, a, 0); add(z + 4.8, a, 0); z += 8; }
      else if (r < .46) { add(z, a, 1); if (R() < .5) add(z + 3, (a + 1 + ri(R, 2)) % 3, 0); z += 7; }
      else if (r < .66) { b = (a + 1 + ri(R, 2)) % 3; f = 3 - a - b; add(z, a, 1); add(z, b, 1); add(z + 1.5, f, 0); add(z + 3, f, 0); z += 8; }
      else if (r < .82) { add(z, a, 2); if (R() < .5) add(z, (a + 1) % 3, 2); z += 6; }
      else { add(z, 0, 2); add(z, 1, 2); add(z, 2, 2); add(z + 4, ri(R, 3), 0); z += 8; }
    }
    return {items: items, z: 0, lane: 1, air: 0, lives: 3, inv: 0, coins: 0, lo: 0, hitN: 0};
  },
  input: function (st, a) { a = num(a); if (a === 0) st.lane = Math.max(0, st.lane - 1); else if (a === 1) st.lane = Math.min(2, st.lane + 1); else if (a === 2 && st.air === 0) st.air = 36; },
  step: function (st) {
    var sp = 6.5 + 5.5 * Math.min(1, st.tick / 3000);
    st.z += sp / 60; if (st.air > 0) st.air--; if (st.inv > 0) st.inv--;
    var it = st.items, i, o;
    for (i = st.lo; i < it.length; i++) {
      o = it[i];
      if (o.z > st.z + 1) break;
      if (o.z < st.z - 1) { if (i === st.lo) st.lo++; continue; }
      if (o.d || o.l !== st.lane) continue;
      if (Math.abs(o.z - st.z) >= .55) continue;
      if (o.k === 0) { o.d = 1; st.coins++; }
      else if (o.k === 1 || !(st.air >= 4 && st.air <= 32)) {
        o.d = 1;
        if (st.inv === 0) { st.lives--; st.inv = 50; st.hitN++; if (st.lives <= 0) st.over = true; }
      }
    }
  },
  score: function (st) { return st.coins * 10 + Math.floor(st.z / 2); },
  check: function () { return null; }
};

/* -------------------------------------------------------------- TARGET TAP */
G.target = {ticks: 2700, gap: 3, maxIn: 700, rhythm: true,
  init: function (seed) {
    var R = rng(seed), T = [], t = 40, i, prog;
    for (i = 0; i < 150; i++) {
      prog = Math.min(1, t / 2400);
      T.push({t0: t, life: Math.floor(78 - prog * 40), x: 36 + Math.floor(R() * 248), y: 40 + Math.floor(R() * 340), r: Math.floor(30 - prog * 14), bomb: (i > 5 && R() < .2) ? 1 : 0, d: 0});
      t += Math.floor(46 - prog * 24) + ri(R, 6);
    }
    return {T: T, score: 0, combo: 0, best: 0, hits: 0, react: [], ev: null, evN: 0};
  },
  input: function (st, a, b) {
    var x = num(a), y = num(b); if (isNaN(x) || isNaN(y)) return;
    var best = null, bd = 1e9, i, o, dx, dy, d2;
    for (i = 0; i < st.T.length; i++) {
      o = st.T[i]; if (o.d || st.tick < o.t0 || st.tick >= o.t0 + o.life) continue;
      dx = o.x - x; dy = o.y - y; d2 = dx * dx + dy * dy;
      if (d2 <= (o.r + 4) * (o.r + 4) && d2 < bd) { bd = d2; best = o; }
    }
    if (best) {
      best.d = 1;
      if (best.bomb) { st.score = Math.max(0, st.score - 15); st.combo = 0; st.ev = {k: 'bomb', x: best.x, y: best.y, p: -15}; }
      else {
        st.combo++; if (st.combo > st.best) st.best = st.combo; st.hits++;
        var p = Math.floor(10 * (1 + Math.min(4, Math.floor(st.combo / 4)) * .5));
        st.score += p; st.react.push(st.tick - best.t0); st.ev = {k: 'hit', x: best.x, y: best.y, p: p};
      }
    } else { st.score = Math.max(0, st.score - 3); st.combo = 0; st.ev = {k: 'miss', x: x, y: y, p: -3}; }
    st.evN++;
  },
  step: function (st) {
    var i, o;
    for (i = 0; i < st.T.length; i++) { o = st.T[i]; if (!o.d && !o.bomb && st.tick === o.t0 + o.life) { st.combo = 0; } }
  },
  score: function (st) { return st.score; },
  check: function (st) { return (st.react.length >= 12 && median(st.react) < 10) ? 'REACT' : null; }
};

/* ------------------------------------------------------------ MEMORY MATCH */
G.memory = {ticks: 4800, gap: 5, maxIn: 400, rhythm: true,
  init: function (seed) {
    var R = rng(seed), c = [], i;
    for (i = 0; i < 10; i++) { c.push(i); c.push(i); }
    shuffle(R, c);
    var ok = []; for (i = 0; i < 20; i++) ok.push(0);
    return {R: R, cards: c, ok: ok, up: [], moves: 0, pairs: 0, lock: 0, nextShuf: 6, shuf: 0, doneAt: -1};
  },
  input: function (st, a) {
    var i = num(a); if (!(i >= 0 && i < 20)) return;
    if (st.lock > 0 || st.ok[i] || st.up.indexOf(i) > -1) return;
    st.up.push(i);
    if (st.up.length === 2) {
      var x = st.up[0], y = st.up[1]; st.moves++;
      if (st.cards[x] === st.cards[y]) { st.ok[x] = 1; st.ok[y] = 1; st.pairs++; st.up = []; if (st.pairs === 10) { st.over = true; st.doneAt = st.tick; } }
      else st.lock = 30;
    }
  },
  step: function (st) {
    if (st.lock > 0) {
      st.lock--;
      if (st.lock === 0) {
        st.up = [];
        if (st.moves >= st.nextShuf) {
          var idx = [], vals = [], i;
          for (i = 0; i < 20; i++) if (!st.ok[i]) { idx.push(i); vals.push(st.cards[i]); }
          shuffle(st.R, vals);
          for (i = 0; i < idx.length; i++) st.cards[idx[i]] = vals[i];
          st.nextShuf += 6; st.shuf = st.tick + 1;
        }
      }
    }
  },
  score: function (st) { return st.pairs * 50 + (st.pairs === 10 ? Math.max(100, 1200 - Math.floor(st.doneAt / 60) * 8 - st.moves * 12) : 0); },
  check: function () { return null; }
};

/* -------------------------------------------------------------- MATH BLITZ */
function mathQ(R, i) {
  var L = Math.min(5, Math.floor(i / 5)), t = ri(R, 2), a, b, c, d, ans, txt;
  function r(lo, hi) { return lo + ri(R, hi - lo + 1); }
  if (L === 0) { if (t) { a = r(10, 99); b = r(10, 99); ans = a + b; txt = a + ' + ' + b; } else { a = r(40, 99); b = r(11, 39); ans = a - b; txt = a + ' - ' + b; } }
  else if (L === 1) { if (t) { a = r(100, 499); b = r(11, 99); ans = a + b; txt = a + ' + ' + b; } else { a = r(3, 12); b = r(6, 12); ans = a * b; txt = a + ' x ' + b; } }
  else if (L === 2) { if (t) { a = r(12, 49); b = r(3, 9); ans = a * b; txt = a + ' x ' + b; } else { a = r(300, 899); b = r(111, 299); ans = a - b; txt = a + ' - ' + b; } }
  else if (L === 3) { if (t) { a = r(5, 30); b = r(5, 30); c = r(2, 9); ans = (a + b) * c; txt = '(' + a + ' + ' + b + ') x ' + c; } else { a = r(12, 30); b = r(3, 9); c = r(5, 60); ans = a * b - c; txt = a + ' x ' + b + ' - ' + c; } }
  else if (L === 4) { if (t) { a = r(11, 29); b = r(11, 19); ans = a * b; txt = a + ' x ' + b; } else { a = r(100, 499); b = r(3, 9); ans = a * b; txt = a + ' x ' + b; } }
  else { if (t) { a = r(6, 15); b = r(6, 15); c = r(6, 15); d = r(6, 15); ans = a * b + c * d; txt = a + ' x ' + b + ' + ' + c + ' x ' + d; } else { a = r(21, 60); b = r(11, 20); c = r(3, 9); ans = (a - b) * c; txt = '(' + a + ' - ' + b + ') x ' + c; } }
  var cand = [ans + 1, ans - 1, ans + 10, ans - 10, ans + 2, ans - 2, ans + 5, ans - 5, ans + 20, ans - 20, ans + 100, ans - 100], pick = [], j;
  shuffle(R, cand);
  for (j = 0; j < cand.length && pick.length < 3; j++) if (cand[j] > 0 && cand[j] !== ans) pick.push(cand[j]);
  var pos = ri(R, 4), o = []; pick.splice(pos, 0, ans); o = pick;
  return {t: txt, ans: ans, o: o, c: pos, L: L, pts: 10 + 5 * L};
}
G.math = {ticks: 2700, gap: 10, maxIn: 200, rhythm: true,
  init: function (seed) {
    var R = rng(seed), Q = [], i;
    for (i = 0; i < 120; i++) Q.push(mathQ(R, i));
    return {Q: Q, q: 0, score: 0, streak: 0, lock: 0, qAt: 0, times: [], ok: 0, bad: 0, evN: 0, ev: 0};
  },
  input: function (st, a) {
    var k = num(a); if (!(k >= 0 && k < 4) || st.lock > 0 || st.q >= st.Q.length) return;
    var q = st.Q[st.q];
    if (k === q.c) { st.score += q.pts + Math.min(10, st.streak * 2); st.streak++; st.ok++; st.ev = 1; }
    else { st.score = Math.max(0, st.score - 10); st.streak = 0; st.lock = 30; st.bad++; st.ev = 2; }
    st.evN++; st.times.push(st.tick - st.qAt); st.q++; st.qAt = st.tick;
  },
  step: function (st) { if (st.lock > 0) st.lock--; },
  score: function (st) { return st.score; },
  check: function (st) { return (st.times.length >= 10 && median(st.times) < 15) ? 'FAST' : null; }
};

/* -------------------------------------------------------------- DODGE FALL */
G.dodge = {ticks: 3600, gap: 2, maxIn: 1500, rhythm: false,
  init: function (seed) {
    var R = rng(seed), items = [], t = 45, prog, v, gem, k, gp, i, waves = [700, 1450, 2150, 2800, 3300];
    while (t < 3500) {
      prog = Math.min(1, t / 3000); v = 3.1 + prog * 2.5; gem = R() < .26;
      items.push({t0: t, x: 16 + Math.floor(R() * 288), v: v, r: gem ? 11 : 10 + ri(R, 7), g: gem ? 1 : 0, d: 0});
      t += Math.floor(30 - prog * 17) + ri(R, 5);
    }
    for (i = 0; i < waves.length; i++) { gp = ri(R, 6); for (k = 0; k < 8; k++) { if (k === gp || k === gp + 1) continue; items.push({t0: waves[i], x: 20 + k * 40, v: 4.4, r: 13, g: 0, d: 0}); } }
    items.sort(function (a, b) { return (a.t0 - b.t0) || (a.x - b.x); });
    return {items: items, px: 160, tx: 160, lives: 3, inv: 0, gems: 0, lo: 0, hitN: 0, gemN: 0};
  },
  input: function (st, a) { var x = num(a); if (isNaN(x)) return; st.tx = Math.max(18, Math.min(302, x)); },
  step: function (st) {
    var d = st.tx - st.px; if (d > 6) d = 6; else if (d < -6) d = -6; st.px += d;
    if (st.inv > 0) st.inv--;
    var it = st.items, i, o, y;
    for (i = st.lo; i < it.length; i++) {
      o = it[i]; if (o.t0 > st.tick) break;
      y = (st.tick - o.t0) * o.v - 20;
      if (y > 460) { if (i === st.lo) st.lo++; continue; }
      if (o.d) continue;
      if (Math.abs(o.x - st.px) < 15 + o.r && Math.abs(y - 392) < 12 + o.r) {
        o.d = 1;
        if (o.g) { st.gems++; st.gemN++; }
        else if (st.inv === 0) { st.lives--; st.inv = 45; st.hitN++; if (st.lives <= 0) st.over = true; }
      }
    }
  },
  score: function (st) { return st.gems * 10 + Math.floor(st.tick / 60); },
  check: function () { return null; }
};

/* ------------------------------------------------------------- COLOR MATCH */
function colorDl(i) { return Math.floor(150 - Math.min(1, i / 40) * 70); }
G.color = {ticks: 2400, gap: 5, maxIn: 300, rhythm: true,
  init: function (seed) {
    var R = rng(seed), Q = [], i, nc, rule, ink, w;
    for (i = 0; i < 140; i++) {
      nc = i < 12 ? 4 : i < 28 ? 5 : 6; rule = Math.floor(i / 8) % 2;
      if (rule === 0) { ink = ri(R, nc); w = ink; if (R() < .8) w = (ink + 1 + ri(R, nc - 1)) % nc; }
      else { w = ri(R, nc); ink = w; if (R() < .8) ink = (w + 1 + ri(R, nc - 1)) % nc; }
      Q.push({w: w, ink: ink, rule: rule, nc: nc, ans: rule === 0 ? ink : w});
    }
    return {Q: Q, q: 0, qAt: 0, dl: colorDl(0), score: 0, streak: 0, times: [], ok: 0, bad: 0, evN: 0, ev: 0};
  },
  input: function (st, a) {
    var k = num(a); if (st.q >= st.Q.length) return; var q = st.Q[st.q]; if (!(k >= 0 && k < q.nc)) return;
    if (k === q.ans) { st.score += 10 + Math.min(10, st.streak); st.streak++; st.ok++; st.ev = 1; }
    else { st.score = Math.max(0, st.score - 5); st.streak = 0; st.bad++; st.ev = 2; }
    st.evN++; st.times.push(st.tick - st.qAt); st.q++; st.qAt = st.tick; st.dl = colorDl(st.q);
  },
  step: function (st) {
    if (st.q < st.Q.length && st.tick - st.qAt >= st.dl) { st.score = Math.max(0, st.score - 5); st.streak = 0; st.bad++; st.ev = 3; st.evN++; st.q++; st.qAt = st.tick; st.dl = colorDl(st.q); }
  },
  score: function (st) { return st.score; },
  check: function (st) { return (st.times.length >= 12 && median(st.times) < 12) ? 'FAST' : null; }
};

/* ------------------------------------------------------------------ SNAKE */
var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
function snakePlace(R, body) {
  var t, x, y, i, occ;
  for (t = 0; t < 300; t++) {
    x = ri(R, 16); y = ri(R, 16); occ = false;
    for (i = 0; i < body.length; i++) if (body[i][0] === x && body[i][1] === y) { occ = true; break; }
    if (!occ) return [x, y];
  }
  for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) { occ = false; for (i = 0; i < body.length; i++) if (body[i][0] === x && body[i][1] === y) { occ = true; break; } if (!occ) return [x, y]; }
  return null;
}
G.snake = {ticks: 3600, gap: 3, maxIn: 500, rhythm: false,
  init: function (seed) {
    var R = rng(seed), body = [[8, 8], [7, 8], [6, 8]];
    return {R: R, body: body, dir: 1, q: [], c: 0, foods: 0, food: snakePlace(R, body), dead: 0, eatN: 0};
  },
  input: function (st, a) {
    var d = num(a); if (!(d >= 0 && d < 4)) return;
    var last = st.q.length ? st.q[st.q.length - 1] : st.dir;
    if (d !== last && d !== (last + 2) % 4 && st.q.length < 2) st.q.push(d);
  },
  step: function (st) {
    var mv = Math.max(5, 9 - Math.floor(st.tick / 600)); st.c++; if (st.c < mv) return; st.c = 0;
    if (st.q.length) st.dir = st.q.shift();
    var h = st.body[0], nx = h[0] + DX[st.dir], ny = h[1] + DY[st.dir], i;
    if (nx < 0 || ny < 0 || nx >= 16 || ny >= 16) { st.over = true; st.dead = 1; return; }
    var eat = !!st.food && nx === st.food[0] && ny === st.food[1], len = st.body.length - (eat ? 0 : 1);
    for (i = 0; i < len; i++) if (st.body[i][0] === nx && st.body[i][1] === ny) { st.over = true; st.dead = 1; return; }
    st.body.unshift([nx, ny]);
    if (eat) { st.foods++; st.eatN++; st.food = snakePlace(st.R, st.body); } else st.body.pop();
  },
  score: function (st) { return st.foods * 15 + Math.floor(st.tick / 60); },
  check: function () { return null; }
};

/* ------------------------------------------------------------ TAP ORDER */
G.order = {ticks: 3600, gap: 5, maxIn: 200, rhythm: true,
  init: function (seed) {
    var R = rng(seed), g = [], i; for (i = 1; i <= 25; i++) g.push(i); shuffle(R, g);
    return {R: R, g: g, next: 1, wrong: 0, lock: 0, doneAt: -1, shuf: 0, times: [], lastAt: 0};
  },
  input: function (st, a) {
    var c = num(a); if (!(c >= 0 && c < 25) || st.lock > 0 || st.next > 25) return;
    if (st.g[c] === st.next) {
      st.times.push(st.tick - st.lastAt); st.lastAt = st.tick; st.next++;
      if (st.next === 13) {
        var idx = [], vals = [], i;
        for (i = 0; i < 25; i++) if (st.g[i] >= 13) { idx.push(i); vals.push(st.g[i]); }
        shuffle(st.R, vals); for (i = 0; i < idx.length; i++) st.g[idx[i]] = vals[i]; st.shuf = st.tick + 1;
      }
      if (st.next === 26) { st.over = true; st.doneAt = st.tick; }
    } else { st.wrong++; st.lock = 20; }
  },
  step: function (st) { if (st.lock > 0) st.lock--; },
  score: function (st) {
    if (st.doneAt >= 0) return Math.max(500, 500 + Math.max(0, 900 - Math.floor(st.doneAt / 60 * 30)) - st.wrong * 40);
    return Math.max(0, (st.next - 1) * 20 - st.wrong * 20);
  },
  check: function (st) { return (st.times.length >= 12 && median(st.times) < 7) ? 'FAST' : null; }
};

/* --------------------------------------------------------------- runner */
function create(id, seed) { var g = G[id], st = g.init(seed | 0); st.tick = 0; st.over = false; return st; }
function input(id, st, a, b) { G[id].input(st, a, b); }
function advance(id, st) { if (st.over) return; G[id].step(st); st.tick++; if (st.tick >= G[id].ticks) st.over = true; }
function score(id, st) { return Math.max(0, Math.floor(G[id].score(st))); }

/** Server: replays the player's moves from the seed and returns the real score. */
function verify(id, seed, inputs) {
  var g = G[id]; if (!g) return {ok: false, reason: 'GAME'};
  if (!Array.isArray(inputs)) return {ok: false, reason: 'NOINPUT'};
  var n = inputs.length, i, e, t, prev = -1000, last = -1, iv = [];
  if (n > g.maxIn) return {ok: false, reason: 'TOOMANY'};
  for (i = 0; i < n; i++) {
    e = inputs[i];
    if (!Array.isArray(e) || e.length < 2 || e.length > 3) return {ok: false, reason: 'FORMAT'};
    t = e[0]; if (typeof t !== 'number' || t !== Math.floor(t) || t < 0 || t >= g.ticks || t < last) return {ok: false, reason: 'TICK'};
    if (i > 0 && t - prev < g.gap) return {ok: false, reason: 'GAP'};
    if (i > 0) iv.push(t - prev);
    prev = t; last = t;
  }
  if (g.rhythm && iv.length >= 25) {
    var sum = 0, sq = 0; for (i = 0; i < iv.length; i++) sum += iv[i];
    var mean = sum / iv.length; for (i = 0; i < iv.length; i++) sq += (iv[i] - mean) * (iv[i] - mean);
    if (Math.sqrt(sq / iv.length) < 1.5) return {ok: false, reason: 'RHYTHM'};
  }
  var st = create(id, seed), k = 0;
  while (!st.over) {
    while (k < n && inputs[k][0] === st.tick) { g.input(st, inputs[k][1], inputs[k][2]); k++; }
    advance(id, st);
  }
  var why = g.check(st); if (why) return {ok: false, reason: why};
  return {ok: true, score: score(id, st), ticks: st.tick};
}

var info = {}, k2; for (k2 in G) info[k2] = {ticks: G[k2].ticks, gap: G[k2].gap, maxIn: G[k2].maxIn};
return {rng: rng, create: create, input: input, advance: advance, score: score, verify: verify, info: info, ids: Object.keys(G)};
})();


/* RRR Tournament - Games section (separate file, old site code is not touched) */
(function () {
'use strict';
const GM = {
  rail: {name:'Rail Rush', icon:'🚆', time:'1 minute', desc:'Drive your train on 3 tracks. Dodge train cars, jump barriers, grab coins. Gets faster!',
    rules:['Everyone drives on the same track (same seed).','Swipe left/right (or tap the left/right side, or use the buttons) to change track. Swipe UP (or the jump button) to jump.','Dodge the red train cars. Jump over the yellow barriers. Coins = 10 points, every 2 distance = 1 point.','You have 3 lives. The train gets faster every second. The run ends after 60 seconds or when all lives are gone.']},
  memory: {name:'Memory Match', icon:'🧠', time:'Up to 80 seconds', desc:'10 pairs, and the cards SHUFFLE while you play. Find all pairs fast.',
    rules:['Everyone gets the same hidden board with 10 pairs (20 cards).','Tap two cards. A wrong pair stays visible for half a second and you cannot tap during that time.','Every 6 moves the cards that are still hidden get SHUFFLED. Remember fast!','Each pair = 50 points. Finish all 10 pairs for a big bonus (faster + fewer moves = more). Time limit 80 seconds.']},
  target: {name:'Target Tap', icon:'🎯', time:'45 seconds', desc:'Targets get smaller and faster. Avoid the bombs. Build a combo.',
    rules:['Everyone gets the same targets in the same places.','Tap a target before its ring runs out: +10 points. Hits in a row build a COMBO that multiplies your points (up to x3).','Tapping a bomb 💣 = -15 points and combo is lost. Tapping empty space = -3 points.','Targets shrink and appear faster over time. The game lasts 45 seconds.']},
  math: {name:'Math Blitz', icon:'➕', time:'45 seconds', desc:'Questions get harder every few answers. Think fast, answer right.',
    rules:['Everyone gets the same questions in the same order.','Tap the correct answer out of 4. Harder questions give more points (10 to 35) and a streak bonus.','Wrong answer = -10 points and you must wait half a second.','Questions start easy and become very hard (big multiplications, brackets). The game lasts 45 seconds.']},
  dodge: {name:'Dodge Fall', icon:'☄️', time:'Up to 60 seconds', desc:'Dodge bombs and bomb walls, collect gems. Everything speeds up.',
    rules:['Everyone gets the same falling gems and bombs.','Drag your finger left/right (or use the buttons / arrow keys) to move your ship. The ship has a maximum speed, so plan ahead.','Every gem = 10 points. Every second you survive = 1 point.','Watch for BOMB WALLS with a gap! A bomb costs 1 of your 3 lives. The game ends after 60 seconds or when all lives are gone.']},
  color: {name:'Color Match', icon:'🎨', time:'40 seconds', desc:'The rule keeps changing: tap the INK color or the color the WORD says.',
    rules:['A color word appears in some ink color. The top banner tells you the rule.','Rule "INK": tap the button with the color the word is WRITTEN in. Rule "WORD": tap the button with the color the word NAMES.','The rule switches every 8 words. More colors appear and the time per word gets shorter.','Correct = 10+ points (streak bonus). Wrong or too slow = -5 points. The game lasts 40 seconds.']},
  snake: {name:'Neon Snake', icon:'🐍', time:'Up to 60 seconds', desc:'Eat apples, grow longer, do not hit the walls or yourself. Gets fast.',
    rules:['Everyone gets the same apples in the same places.','Swipe on the board (or use the buttons / arrow keys) to turn. You cannot turn back on yourself.','Every apple = 15 points and the snake grows. Every second alive = 1 point.','Hitting a wall or your own body ends the run. The snake speeds up every 10 seconds. Maximum 60 seconds.']},
  order: {name:'Tap Order', icon:'🔢', time:'Up to 60 seconds', desc:'Tap the numbers 1 to 25 in order, as fast as you can. Numbers move halfway!',
    rules:['Everyone gets the same board of numbers 1 to 25.','Tap them in order: 1, 2, 3 ... 25. After number 12, the remaining numbers get SHUFFLED.','A wrong tap freezes the board for a third of a second and costs points.','Finish all 25 for at least 500 points. The faster you finish, the higher your score. Time limit 60 seconds.']}
};
let PROFILE = {ign:'', uid:''}, CFG = {commission:.2, minFee:5, maxFee:500, playMin:10, openMin:30, games:{}}, OPEN = [], MINE = [], K = '', cur = null, stopFn = null, joinId = '';
const slots = n => n <= 2 ? 1 : n <= 5 ? 2 : 3, SPL = {1:[1], 2:[.65,.35], 3:[.5,.3,.2]};
const pool = (f, n) => Math.floor(f * n * (1 - CFG.commission) + 1e-9);
const prizes = (f, n) => SPL[slots(n)].map(x => Math.floor(pool(f, n) * x + 1e-9));
const lim = k => (CFG.games && CFG.games[k]) || {min:2, max:8};
const ORD = ['1st', '2nd', '3rd'];
const fail = d => '❌ ' + (MSG[d.status] || d.status) + (d.status === 'ERROR' && d.msg ? ' (' + d.msg + ')' : '');
const mins = ms => Math.max(0, Math.ceil((ms - Date.now()) / 60000)) + ' min';
/* ---------- helpers ---------- */
function loop(fn) { let id, last = performance.now(), stop = false; const f = now => { if (stop) return; const dt = Math.min(.05, (now - last) / 1000); last = now; fn(dt); id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); return () => { stop = true; cancelAnimationFrame(id); }; }
function mkCv(c, W, H, fit) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.cssText = 'width:100%;' + (fit ? 'width:min(100%,360px,max(210px,calc((100vh - 350px) * ' + (W / H) + ')));width:min(100%,360px,max(210px,calc((100dvh - 350px) * ' + (W / H) + ')));' : '') + 'max-width:360px;display:block;margin:0 auto;background:#0e1422;border:1px solid #222c42;border-radius:14px;touch-action:none;user-select:none;-webkit-user-select:none';
  c.el.appendChild(cv); const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {cv, g, pos: e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }};
}
function pad(c, arr) {
  const d = document.createElement('div'); d.className = 'gpad';
  arr.forEach(a => { const b = document.createElement('button'); b.textContent = a[0]; b.onpointerdown = e => { e.preventDefault(); a[1](); }; b.onpointerup = e => { if (a[2]) a[2](); }; b.oncontextmenu = e => e.preventDefault(); d.appendChild(b); });
  c.el.appendChild(d); return d;
}
function kb(down, up) {
  const kd = e => { if (down(e.key)) e.preventDefault(); }, ku = e => { if (up && up(e.key)) e.preventDefault(); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
}
const secs = (st, id) => Math.max(0, Math.ceil((RRRCORE.info[id].ticks - st.tick) / 60));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function txt(g, s, x, y, size, col, al, w) { g.font = (w || '800') + ' ' + size + 'px Arial,Helvetica,sans-serif'; g.textAlign = al || 'left'; g.fillStyle = col; g.fillText(s, x, y); }
function hearts(n) { return '❤'.repeat(Math.max(0, n)) + '🖤'.repeat(Math.max(0, 3 - n)); }

/** Runs a game: fixed 60 ticks/second. Your moves are recorded and sent to the server, which plays the game again to get the real score. */
function sim(id, c, mk) {
  const info = RRRCORE.info[id], st = RRRCORE.create(id, c.seed), inputs = []; let last = -99, acc = 0, ended = false, timer = 0;
  const put = (a, b) => {
    if (ended || st.over) return false;
    if (inputs.length && st.tick - last < info.gap) return false;
    if (inputs.length >= info.maxIn) return false;
    RRRCORE.input(id, st, a, b); inputs.push(b === undefined ? [st.tick, a] : [st.tick, a, b]); last = st.tick; return true;
  };
  const view = mk(c, put, st);
  const stop = loop(dt => {
    if (ended) return;
    acc += dt; while (acc >= 1 / 60 && !st.over) { RRRCORE.advance(id, st); acc -= 1 / 60; }
    view.draw(st, dt); c.hud(view.hud(st));
    if (st.over) { ended = true; timer = setTimeout(() => c.end(RRRCORE.score(id, st), inputs), 800); }
  });
  return () => { ended = true; clearTimeout(timer); stop(); if (view.stop) view.stop(); };
}

/* ================= RAIL RUSH (pseudo 3D train game) ================= */
function railView(c, put, st) {
  const W = 320, H = 480, HZ = 120, BASE = 404, SP = 88, {cv, g} = mkCv(c, W, H, true);
  let vl = 1, shake = 0, lastHit = 0, tm = 0, moved = false, sx = 0, sy = 0;
  const S = d => 1 / (1 + d * .16), Y = s => HZ + (BASE - HZ) * s, X = (l, s) => 160 + (l - 1) * SP * s;
  const city = []; for (let i = 0; i < 16; i++) city.push([i * 22 - 6, 14 + (i * 37 % 19), 18 + (i * 53 % 46)]);
  cv.onpointerdown = e => { sx = e.clientX; sy = e.clientY; moved = false; try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
  cv.onpointermove = e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) { put(dx > 0 ? 1 : 0); sx = e.clientX; sy = e.clientY; moved = true; } else if (dy < -28) { put(2); sx = e.clientX; sy = e.clientY; moved = true; } };
  cv.onpointerup = e => { if (!moved) { const r = cv.getBoundingClientRect(); put(e.clientX < r.left + r.width / 2 ? 0 : 1); } };
  const pd = pad(c, [['◀', () => put(0)], ['⤒ JUMP', () => put(2)], ['▶', () => put(1)]]);
  const off = kb(k => { if (k === 'ArrowLeft' || k === 'a') { put(0); return 1; } if (k === 'ArrowRight' || k === 'd') { put(1); return 1; } if (k === 'ArrowUp' || k === ' ' || k === 'w') { put(2); return 1; } });
  return {
    stop: off,
    hud: s => 'Score ' + RRRCORE.score('rail', s) + '  •  ' + hearts(s.lives) + '  •  ' + secs(s, 'rail') + 's',
    draw(s, dt) {
      tm += dt; vl += (s.lane - vl) * Math.min(1, dt * 14);
      if (s.hitN !== lastHit) { lastHit = s.hitN; shake = .3; }
      g.save(); if (shake > 0) { shake -= dt; g.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8); }
      let gr = g.createLinearGradient(0, 0, 0, HZ + 10); gr.addColorStop(0, '#080b24'); gr.addColorStop(.6, '#3a1c5c'); gr.addColorStop(1, '#ff7a45'); g.fillStyle = gr; g.fillRect(-10, -10, W + 20, HZ + 20);
      g.fillStyle = 'rgba(255,230,180,.9)'; g.beginPath(); g.arc(240 - (vl - 1) * 6, 78, 15, 0, 7); g.fill();
      g.fillStyle = '#0b0f22'; city.forEach(b => { g.fillRect(b[0] - (vl - 1) * 5, HZ - b[2], b[1], b[2] + 2); });
      g.fillStyle = '#ffe9a8'; city.forEach((b, i) => { if (i % 2) g.fillRect(b[0] - (vl - 1) * 5 + 3, HZ - b[2] + 6, 3, 3); });
      gr = g.createLinearGradient(0, HZ, 0, H); gr.addColorStop(0, '#171c30'); gr.addColorStop(1, '#0a0d18'); g.fillStyle = gr; g.fillRect(-10, HZ, W + 20, H);
      const sf = S(34), sn = S(-2.2);
      g.fillStyle = '#242a40'; g.beginPath(); g.moveTo(X(0, sf) - 46 * sf, Y(sf)); g.lineTo(X(2, sf) + 46 * sf, Y(sf)); g.lineTo(X(2, sn) + 46 * sn, Y(sn)); g.lineTo(X(0, sn) - 46 * sn, Y(sn)); g.closePath(); g.fill();
      for (let k = -2; k < 26; k++) { const d = k * 1.4 - (s.z % 1.4), ss = S(d); if (ss > 1.7 || ss < sf) continue; g.fillStyle = 'rgba(94,70,52,.95)'; g.fillRect(X(0, ss) - 46 * ss, Y(ss), (2 * SP + 92) * ss, 5 * ss); }
      g.lineCap = 'round'; for (let l = 0; l < 3; l++) for (const o of [-19, 19]) { g.strokeStyle = '#9aa8c7'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(X(l, sf) + o * sf, Y(sf)); g.lineTo(X(l, sn) + o * sn, Y(sn)); g.stroke(); }
      const vis = []; for (let i = s.lo; i < s.items.length; i++) { const o = s.items[i]; if (o.z - s.z > 34) break; if (!o.d && o.z - s.z > -2.2) vis.push(o); }
      for (let i = vis.length - 1; i >= 0; i--) {
        const o = vis[i], d = o.z - s.z, ss = S(d), x = X(o.l, ss), yb = Y(ss); g.globalAlpha = clamp((34 - d) / 8, 0, 1);
        if (o.k === 0) { const r = 10 * ss, rx = Math.max(2, r * Math.abs(Math.cos(tm * 6 + o.z))); const cg = g.createRadialGradient(x, yb - 16 * ss, 1, x, yb - 16 * ss, r + 4); cg.addColorStop(0, '#fff2a8'); cg.addColorStop(.6, '#ffb400'); cg.addColorStop(1, '#a86a00'); g.fillStyle = cg; g.beginPath(); g.ellipse(x, yb - 16 * ss, rx, r, 0, 0, 7); g.fill(); }
        else if (o.k === 1) {
          const w = 66 * ss, h = 56 * ss, x0 = x - w / 2, top = yb - h; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, yb, w * .6, 6 * ss, 0, 0, 7); g.fill();
          const bg = g.createLinearGradient(0, top, 0, yb); bg.addColorStop(0, '#e23b55'); bg.addColorStop(1, '#7a1022'); g.fillStyle = bg; rr(g, x0, top, w, h, 5 * ss); g.fill();
          g.fillStyle = '#ff8597'; g.beginPath(); g.moveTo(x0, top + 2 * ss); g.lineTo(x0 + w * .1, top - 9 * ss); g.lineTo(x0 + w * .9, top - 9 * ss); g.lineTo(x0 + w, top + 2 * ss); g.closePath(); g.fill();
          g.fillStyle = '#ffe9a8'; g.fillRect(x0 + w * .1, top + 8 * ss, w * .36, 15 * ss); g.fillRect(x0 + w * .54, top + 8 * ss, w * .36, 15 * ss);
          g.fillStyle = '#20253a'; g.fillRect(x0, yb - 16 * ss, w, 7 * ss);
          g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(x0 + w * .2, yb - 24 * ss, 4 * ss, 0, 7); g.arc(x0 + w * .8, yb - 24 * ss, 4 * ss, 0, 7); g.fill();
        } else {
          const w = 76 * ss, x0 = x - w / 2, bh = 14 * ss, by = yb - 32 * ss;
          g.fillStyle = '#d9dff2'; g.fillRect(x0 + 2 * ss, by, 6 * ss, 32 * ss); g.fillRect(x0 + w - 8 * ss, by, 6 * ss, 32 * ss);
          g.fillStyle = '#ffb400'; g.fillRect(x0, by, w, bh); g.save(); g.beginPath(); g.rect(x0, by, w, bh); g.clip(); g.fillStyle = '#15151b';
          for (let q = -2; q < 9; q++) { const sx0 = x0 + q * 12 * ss; g.beginPath(); g.moveTo(sx0, by + bh); g.lineTo(sx0 + 6 * ss, by + bh); g.lineTo(sx0 + 12 * ss, by); g.lineTo(sx0 + 6 * ss, by); g.closePath(); g.fill(); } g.restore();
        }
        g.globalAlpha = 1;
      }
      const px = X(vl, 1), jh = s.air > 0 ? Math.sin(Math.PI * (1 - s.air / 36)) * 64 : 0;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(px, BASE + 3, 30 - jh * .2, 7, 0, 0, 7); g.fill();
      g.globalAlpha = (s.inv > 0 && s.tick % 6 < 3) ? .35 : 1; const by = BASE - 48 - jh;
      const pg = g.createLinearGradient(0, by, 0, by + 48); pg.addColorStop(0, '#32d6f2'); pg.addColorStop(1, '#0a6a86'); g.fillStyle = pg; rr(g, px - 28, by, 56, 48, 8); g.fill();
      g.fillStyle = '#9cf0ff'; rr(g, px - 24, by - 6, 48, 10, 5); g.fill();
      g.fillStyle = '#0b1220'; rr(g, px - 21, by + 8, 42, 16, 4); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(px - 21, by + 8, 21, 6);
      g.fillStyle = '#ffb400'; g.fillRect(px - 28, by + 40, 56, 5);
      const hl = g.createRadialGradient(px, by + 33, 1, px, by + 33, 14); hl.addColorStop(0, 'rgba(255,255,200,.9)'); hl.addColorStop(1, 'rgba(255,255,200,0)'); g.fillStyle = hl; g.fillRect(px - 30, by + 20, 60, 28);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(px - 16, by + 33, 3.5, 0, 7); g.arc(px + 16, by + 33, 3.5, 0, 7); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { const lx = ((i * 71 + s.tick * 9) % 520) - 100; g.beginPath(); g.moveTo(lx, HZ + 30 + i * 50); g.lineTo(lx + 3, HZ + 60 + i * 50); g.stroke(); }
      g.restore();
      txt(g, '🪙 ' + s.coins, 10, 22, 16, '#ffd54a'); txt(g, hearts(s.lives), W - 10, 22, 14, '#ff5470', 'right');
    }
  };
}

/* ================= DODGE FALL ================= */
function dodgeView(c, put, st) {
  const W = 320, H = 420, {cv, g, pos} = mkCv(c, W, H, true); let want = null, tm = 0, lastHit = 0, flash = 0; const stars = []; for (let i = 0; i < 50; i++) stars.push([Math.random() * W, Math.random() * H, .5 + Math.random() * 1.8]);
  const setW = e => { want = clamp(Math.round(pos(e)[0]), 18, 302); };
  cv.onpointerdown = e => { setW(e); try { cv.setPointerCapture(e.pointerId); } catch (x) {} }; cv.onpointermove = e => { if (e.buttons || e.pointerType === 'touch') setW(e); };
  pad(c, [['◀', () => { want = 0; }, () => { want = st.px; }], ['▶', () => { want = 320; }, () => { want = st.px; }]]);
  const off = kb(k => { if (k === 'ArrowLeft' || k === 'a') { want = 0; return 1; } if (k === 'ArrowRight' || k === 'd') { want = 320; return 1; } }, k => { if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(k)) { want = st.px; return 1; } });
  return {
    stop: off,
    hud: s => 'Score ' + RRRCORE.score('dodge', s) + '  •  ' + hearts(s.lives) + '  •  ' + secs(s, 'dodge') + 's',
    draw(s, dt) {
      tm += dt; if (want !== null) { const w = clamp(Math.round(want), 18, 302); if (w !== s.tx) put(w); }
      if (s.hitN !== lastHit) { lastHit = s.hitN; flash = .35; }
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#060818'); bg.addColorStop(1, '#1a1040'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; stars.forEach(t => { t[1] += t[2] * 60 * dt; if (t[1] > H) { t[1] = 0; t[0] = Math.random() * W; } g.globalAlpha = .35 + t[2] * .2; g.fillRect(t[0], t[1], t[2], t[2]); }); g.globalAlpha = 1;
      for (let i = s.lo; i < s.items.length; i++) {
        const o = s.items[i]; if (o.t0 > s.tick) break; const y = (s.tick - o.t0) * o.v - 20; if (o.d || y > H + 30) continue;
        if (o.g) { const gg = g.createRadialGradient(o.x, y, 1, o.x, y, 20); gg.addColorStop(0, 'rgba(80,230,255,.55)'); gg.addColorStop(1, 'rgba(80,230,255,0)'); g.fillStyle = gg; g.fillRect(o.x - 20, y - 20, 40, 40); g.fillStyle = '#35e0ff'; g.beginPath(); g.moveTo(o.x, y - 13); g.lineTo(o.x + 10, y); g.lineTo(o.x, y + 13); g.lineTo(o.x - 10, y); g.closePath(); g.fill(); g.fillStyle = '#d9fbff'; g.beginPath(); g.moveTo(o.x, y - 13); g.lineTo(o.x + 4, y - 2); g.lineTo(o.x - 4, y - 2); g.closePath(); g.fill(); }
        else { const bg2 = g.createRadialGradient(o.x - 3, y - 3, 1, o.x, y, o.r + 2); bg2.addColorStop(0, '#ff7b8f'); bg2.addColorStop(.7, '#c1163a'); bg2.addColorStop(1, '#4a0714'); g.fillStyle = bg2; g.beginPath(); g.arc(o.x, y, o.r, 0, 7); g.fill(); g.strokeStyle = '#ffb400'; g.lineWidth = 2; g.beginPath(); g.moveTo(o.x + 2, y - o.r); g.lineTo(o.x + 7, y - o.r - 7); g.stroke(); g.fillStyle = '#ffd54a'; g.beginPath(); g.arc(o.x + 7, y - o.r - 8 + Math.sin(tm * 20) * 1.5, 2.5, 0, 7); g.fill(); }
      }
      const x = s.px, y = 392; g.globalAlpha = (s.inv > 0 && s.tick % 6 < 3) ? .35 : 1;
      const eg = g.createLinearGradient(0, y, 0, y + 24); eg.addColorStop(0, 'rgba(255,170,0,.9)'); eg.addColorStop(1, 'rgba(255,170,0,0)'); g.fillStyle = eg; g.beginPath(); g.moveTo(x - 7, y + 8); g.lineTo(x + 7, y + 8); g.lineTo(x, y + 24 + Math.sin(tm * 40) * 4); g.closePath(); g.fill();
      const sg = g.createLinearGradient(x - 18, y, x + 18, y); sg.addColorStop(0, '#ff9a1f'); sg.addColorStop(.5, '#ffd54a'); sg.addColorStop(1, '#ff9a1f'); g.fillStyle = sg; g.beginPath(); g.moveTo(x, y - 20); g.lineTo(x + 18, y + 12); g.lineTo(x + 7, y + 8); g.lineTo(x - 7, y + 8); g.lineTo(x - 18, y + 12); g.closePath(); g.fill();
      g.fillStyle = '#0b1220'; g.beginPath(); g.arc(x, y - 3, 5, 0, 7); g.fill(); g.globalAlpha = 1;
      if (flash > 0) { flash -= dt; g.fillStyle = 'rgba(255,40,70,' + (flash * 1.2) + ')'; g.fillRect(0, 0, W, H); }
      txt(g, '💎 ' + s.gems, 10, 22, 16, '#7ee8ff'); txt(g, hearts(s.lives), W - 10, 22, 14, '#ff5470', 'right');
    }
  };
}

/* ================= TARGET TAP ================= */
function targetView(c, put, st) {
  const W = 320, H = 420, {cv, g, pos} = mkCv(c, W, H); let fx = [], evN = 0, tm = 0;
  cv.onpointerdown = e => { const p = pos(e); put(Math.round(p[0]), Math.round(p[1])); };
  return {
    hud: s => 'Score ' + s.score + '  •  Combo ' + s.combo + '  •  ' + secs(s, 'target') + 's',
    draw(s, dt) {
      tm += dt; if (s.evN !== evN) { evN = s.evN; const e = s.ev; fx.push({x: e.x, y: e.y, t: 0, k: e.k, p: e.p}); }
      g.fillStyle = '#0a0f1e'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(80,110,200,.12)'; g.lineWidth = 1;
      for (let x = 0; x <= W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y <= H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (const o of s.T) {
        if (o.d || s.tick < o.t0 || s.tick >= o.t0 + o.life) continue; const k = (s.tick - o.t0) / o.life, pop = Math.min(1, (s.tick - o.t0) / 6), r = o.r * (.4 + .6 * pop);
        if (o.bomb) { const bg = g.createRadialGradient(o.x, o.y, 2, o.x, o.y, r + 8); bg.addColorStop(0, '#3a0a14'); bg.addColorStop(.8, '#1a0509'); bg.addColorStop(1, 'rgba(255,40,70,.5)'); g.fillStyle = bg; g.beginPath(); g.arc(o.x, o.y, r + 6, 0, 7); g.fill(); g.strokeStyle = '#ff3b5c'; g.lineWidth = 2; g.beginPath(); g.arc(o.x, o.y, r, 0, 7); g.stroke(); g.font = Math.round(r * 1.1) + 'px Arial'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('💣', o.x, o.y + r * .38); }
        else { const tg = g.createRadialGradient(o.x, o.y, 1, o.x, o.y, r); tg.addColorStop(0, '#fff'); tg.addColorStop(.25, '#ff3b5c'); tg.addColorStop(.5, '#fff'); tg.addColorStop(.75, '#ff3b5c'); tg.addColorStop(1, '#8a1030'); g.fillStyle = tg; g.beginPath(); g.arc(o.x, o.y, r, 0, 7); g.fill(); g.strokeStyle = k > .7 ? '#ffb400' : '#35e0ff'; g.lineWidth = 3.5; g.beginPath(); g.arc(o.x, o.y, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k)); g.stroke(); }
      }
      fx = fx.filter(f => (f.t += dt) < .6); for (const f of fx) { const a = 1 - f.t / .6; g.globalAlpha = a; if (f.k === 'hit') { g.strokeStyle = '#ffd54a'; g.lineWidth = 3; g.beginPath(); g.arc(f.x, f.y, 10 + f.t * 70, 0, 7); g.stroke(); txt(g, '+' + f.p, f.x, f.y - 14 - f.t * 40, 18, '#ffd54a', 'center'); } else { txt(g, f.p, f.x, f.y - 10 - f.t * 30, 17, '#ff5470', 'center'); } g.globalAlpha = 1; }
      if (s.combo >= 4) { const m = (1 + Math.min(4, Math.floor(s.combo / 4)) * .5).toFixed(1); txt(g, 'COMBO x' + m, W / 2, 26, 20, '#ffb400', 'center'); }
      txt(g, '🎯 ' + s.hits, 10, H - 10, 14, '#9aa6bd');
    }
  };
}

/* ================= MEMORY MATCH ================= */
function memoryView(c, put, st) {
  const EM = ['🍎', '🍌', '🍇', '🍒', '🥝', '🍉', '🍍', '🥭', '🍓', '🥥'];
  const ban = document.createElement('div'); ban.className = 'gban'; c.el.appendChild(ban);
  const grid = document.createElement('div'); grid.className = 'mg5'; c.el.appendChild(grid);
  const cells = []; for (let i = 0; i < 20; i++) { const b = document.createElement('button'); b.className = 'mc'; b.textContent = '❓'; b.onpointerdown = e => { e.preventDefault(); put(i); }; grid.appendChild(b); cells.push(b); }
  let shuf = 0, shufT = 0, cache = [];
  return {
    hud: s => 'Pairs ' + s.pairs + '/10  •  Moves ' + s.moves + '  •  ' + secs(s, 'memory') + 's',
    draw(s, dt) {
      if (s.shuf !== shuf) { shuf = s.shuf; shufT = .6; } if (shufT > 0) shufT -= dt;
      ban.textContent = shufT > 0 ? '🔀 CARDS SHUFFLED!' : s.lock > 0 ? 'Wrong pair...' : 'Next shuffle after move ' + s.nextShuf;
      for (let i = 0; i < 20; i++) {
        const open = s.ok[i] || s.up.indexOf(i) > -1, key = (open ? 'o' + s.cards[i] : 'c') + (s.ok[i] ? 'k' : '') + (shufT > 0 && !s.ok[i] ? 's' : '');
        if (cache[i] === key) continue; cache[i] = key; const b = cells[i];
        b.textContent = open ? EM[s.cards[i]] : '❓'; b.className = 'mc' + (open ? ' up' : '') + (s.ok[i] ? ' ok' : '') + (shufT > 0 && !s.ok[i] ? ' shuf' : '');
      }
    }
  };
}

/* ================= MATH BLITZ ================= */
function mathView(c, put, st) {
  const top = document.createElement('div'); top.className = 'gban'; c.el.appendChild(top);
  const q = document.createElement('div'); q.className = 'mbq'; c.el.appendChild(q);
  const grid = document.createElement('div'); grid.className = 'mbgrid'; c.el.appendChild(grid);
  const bs = [0, 1, 2, 3].map(k => { const b = document.createElement('button'); b.className = 'mbbtn'; b.onpointerdown = e => { e.preventDefault(); put(k); }; grid.appendChild(b); return b; });
  let shown = -1, lockOn = false;
  return {
    hud: s => 'Score ' + s.score + '  •  ' + secs(s, 'math') + 's',
    draw(s) {
      const Q = s.Q[Math.min(s.q, s.Q.length - 1)];
      if (shown !== s.q) { shown = s.q; q.textContent = Q.t.replace(/ x /g, ' × ').replace(/ - /g, ' − ') + ' = ?'; bs.forEach((b, k) => { b.textContent = Q.o[k]; }); top.textContent = 'Level ' + (Q.L + 1) + '  •  +' + Q.pts + ' points  •  Streak ' + s.streak; }
      const l = s.lock > 0; if (l !== lockOn) { lockOn = l; grid.classList.toggle('lock', l); q.style.color = l ? '#ff5470' : '#fff'; }
    }
  };
}

/* ================= COLOR MATCH ================= */
const COL = [['#e11d48', 'RED'], ['#22c55e', 'GREEN'], ['#3b82f6', 'BLUE'], ['#ffb400', 'YELLOW'], ['#a855f7', 'PURPLE'], ['#fb923c', 'ORANGE']];
function colorView(c, put, st) {
  const ban = document.createElement('div'); ban.className = 'cmban'; c.el.appendChild(ban);
  const bar = document.createElement('div'); bar.className = 'cmbar'; bar.innerHTML = '<i></i>'; c.el.appendChild(bar);
  const word = document.createElement('div'); word.className = 'cmword'; c.el.appendChild(word);
  const grid = document.createElement('div'); grid.className = 'cmgrid'; c.el.appendChild(grid);
  let shown = -1, nc = 0; const fill = bar.firstChild;
  return {
    hud: s => 'Score ' + s.score + '  •  Streak ' + s.streak + '  •  ' + secs(s, 'color') + 's',
    draw(s) {
      const Q = s.Q[Math.min(s.q, s.Q.length - 1)];
      if (nc !== Q.nc) { nc = Q.nc; grid.innerHTML = ''; for (let k = 0; k < nc; k++) { const b = document.createElement('button'); b.className = 'cmbtn'; b.style.background = COL[k][0]; b.onpointerdown = e => { e.preventDefault(); put(k); }; grid.appendChild(b); } grid.style.gridTemplateColumns = 'repeat(' + (nc === 4 ? 2 : 3) + ',1fr)'; }
      if (shown !== s.q) { shown = s.q; word.textContent = COL[Q.w][1]; word.style.color = COL[Q.ink][0]; ban.textContent = Q.rule === 0 ? 'TAP THE INK COLOR' : 'TAP THE COLOR THE WORD NAMES'; ban.className = 'cmban r' + Q.rule; }
      fill.style.width = Math.max(0, 100 - (s.tick - s.qAt) / s.dl * 100) + '%';
    }
  };
}

/* ================= NEON SNAKE ================= */
function snakeView(c, put, st) {
  const W = 320, {cv, g} = mkCv(c, W, W, true), CS = 20; let sx = 0, sy = 0, sw = false, tm = 0;
  cv.onpointerdown = e => { sx = e.clientX; sy = e.clientY; sw = false; try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
  cv.onpointermove = e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) { put(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); sx = e.clientX; sy = e.clientY; } };
  pad(c, [['◀', () => put(3)], ['▲', () => put(0)], ['▼', () => put(2)], ['▶', () => put(1)]]);
  const off = kb(k => { const m = {ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3}[k]; if (m !== undefined) { put(m); return 1; } });
  return {
    stop: off,
    hud: s => 'Score ' + RRRCORE.score('snake', s) + '  •  🍎 ' + s.foods + '  •  ' + secs(s, 'snake') + 's',
    draw(s, dt) {
      tm += dt; g.fillStyle = '#080c1a'; g.fillRect(0, 0, W, W);
      g.fillStyle = 'rgba(60,90,180,.14)'; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2) g.fillRect(x * CS, y * CS, CS, CS);
      g.strokeStyle = 'rgba(80,220,255,.5)'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, W - 2);
      if (s.food) { const fx = s.food[0] * CS + 10, fy = s.food[1] * CS + 10, gl = g.createRadialGradient(fx, fy, 1, fx, fy, 16); gl.addColorStop(0, 'rgba(255,80,100,.6)'); gl.addColorStop(1, 'rgba(255,80,100,0)'); g.fillStyle = gl; g.fillRect(fx - 16, fy - 16, 32, 32); g.fillStyle = '#ff3b5c'; g.beginPath(); g.arc(fx, fy, 7 + Math.sin(tm * 6), 0, 7); g.fill(); g.fillStyle = '#6bff9a'; g.fillRect(fx, fy - 11, 3, 5); }
      const n = s.body.length;
      for (let i = n - 1; i >= 0; i--) {
        const b = s.body[i], t = 1 - i / Math.max(n, 1); g.fillStyle = i === 0 ? '#9affc0' : 'rgb(' + Math.round(30 + 40 * t) + ',' + Math.round(130 + 100 * t) + ',' + Math.round(90 + 40 * t) + ')';
        rr(g, b[0] * CS + 1.5, b[1] * CS + 1.5, CS - 3, CS - 3, i === 0 ? 8 : 6); g.fill();
      }
      const h = s.body[0], ex = [[-4, -4, 4, -4], [4, -4, 4, 4], [-4, 4, 4, 4], [-4, -4, -4, 4]][s.dir], hx = h[0] * CS + 10, hy = h[1] * CS + 10; g.fillStyle = '#041018'; g.beginPath(); g.arc(hx + ex[0], hy + ex[1], 2.2, 0, 7); g.arc(hx + ex[2], hy + ex[3], 2.2, 0, 7); g.fill();
      if (s.dead) { g.fillStyle = 'rgba(255,40,70,.3)'; g.fillRect(0, 0, W, W); }
    }
  };
}

/* ================= TAP ORDER ================= */
function orderView(c, put, st) {
  const top = document.createElement('div'); top.className = 'gban'; c.el.appendChild(top);
  const grid = document.createElement('div'); grid.className = 'odgrid'; c.el.appendChild(grid);
  const cells = []; for (let i = 0; i < 25; i++) { const b = document.createElement('button'); b.className = 'odc'; b.onpointerdown = e => { e.preventDefault(); put(i); }; grid.appendChild(b); cells.push(b); }
  let cache = [], shuf = 0, shufT = 0, bad = false;
  return {
    hud: s => 'Find ' + Math.min(25, s.next) + '  •  Wrong ' + s.wrong + '  •  ' + secs(s, 'order') + 's',
    draw(s, dt) {
      if (s.shuf !== shuf) { shuf = s.shuf; shufT = .6; } if (shufT > 0) shufT -= dt;
      top.textContent = shufT > 0 ? '🔀 NUMBERS SHUFFLED!' : s.lock > 0 ? 'Wrong! Wait...' : 'Tap number ' + Math.min(25, s.next);
      for (let i = 0; i < 25; i++) { const v = s.g[i], key = v + '|' + (v < s.next ? 1 : 0) + (s.lock > 0 ? 'b' : ''); if (cache[i] === key) continue; cache[i] = key; cells[i].textContent = v; cells[i].className = 'odc' + (v < s.next ? ' dn' : '') + (s.lock > 0 ? ' bad' : ''); }
    }
  };
}

const V = {rail: railView, memory: memoryView, target: targetView, math: mathView, dodge: dodgeView, color: colorView, snake: snakeView, order: orderView};
const ENG = {}; Object.keys(V).forEach(k => { ENG[k] = c => sim(k, c, V[k]); });
const css2 = `.gpad{display:flex;gap:10px;justify-content:center;margin:10px auto 0;max-width:360px}.gpad button{flex:1;height:54px;font-size:20px;font-weight:800;border-radius:14px;border:1px solid var(--line);background:#1c2438;color:#fff;touch-action:manipulation;user-select:none;-webkit-user-select:none}.gpad button:active{background:#2a3658}
.gban{text-align:center;font-weight:800;color:#ffb400;min-height:24px;margin-bottom:8px;font-size:15px}
.mg5{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:360px;margin:0 auto}.mc{aspect-ratio:1/1.05;font-size:30px;border-radius:12px;border:1px solid var(--line);background:linear-gradient(135deg,#27324f,#1a2138);color:#fff;touch-action:manipulation}.mc.up{background:#0e1422;border-color:#ffb400}.mc.ok{background:#12351f;border-color:#4ade80;opacity:.8}.mc.shuf{animation:gsh .55s}@keyframes gsh{0%{transform:scale(1) rotate(0)}50%{transform:scale(.75) rotate(14deg)}100%{transform:scale(1) rotate(0)}}
.mbq{text-align:center;font-family:Oswald,Arial,sans-serif;font-size:34px;color:#fff;margin:6px 0 16px;min-height:44px}.mbgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:360px;margin:0 auto}.mbbtn{padding:22px 0;font-size:26px;font-weight:800;border-radius:14px;border:1px solid var(--line);background:#1c2438;color:#ffd54a;touch-action:manipulation}.mbbtn:active{background:#2a3658}.mbgrid.lock .mbbtn{opacity:.35}
.cmban{text-align:center;font-weight:800;padding:8px;border-radius:10px;margin-bottom:8px;font-size:14px;letter-spacing:.5px}.cmban.r0{background:#10304a;color:#7ee8ff}.cmban.r1{background:#3a2410;color:#ffb36b}.cmbar{height:8px;background:#1c2438;border-radius:6px;overflow:hidden;max-width:360px;margin:0 auto 6px}.cmbar i{display:block;height:100%;background:#ffb400;width:100%}
.cmword{text-align:center;font-family:Oswald,Arial,sans-serif;font-size:60px;margin:10px 0 18px;letter-spacing:2px;min-height:74px}.cmgrid{display:grid;gap:10px;max-width:360px;margin:0 auto}.cmbtn{height:76px;border-radius:14px;border:3px solid #0a0e17;touch-action:manipulation}.cmbtn:active{opacity:.65}
.odgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;max-width:360px;margin:0 auto}.odc{aspect-ratio:1;font-size:22px;font-weight:800;border-radius:12px;border:1px solid var(--line);background:#1c2438;color:#fff;touch-action:manipulation}.odc.dn{background:#0e1422;color:#33405f}.odc.bad{background:#3a1218;border-color:#ff3b5c}`;

/* ---------- page parts (added to the site by this file) ---------- */
const css = `.gh{display:flex;justify-content:space-between;align-items:center}.gi{width:48px;height:48px;border-radius:14px;background:#1c2438;display:flex;align-items:center;justify-content:center;font-size:26px}
.gtag{font-size:11px;letter-spacing:1px;color:var(--mut);font-weight:700}.gchips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.gb{display:flex;gap:8px;flex-wrap:wrap}.gb .nbtn{flex:1}
.mgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:360px;margin:0 auto}.mcell{aspect-ratio:1;font-size:30px;border-radius:12px;border:1px solid var(--line);background:#1c2438;color:var(--g);cursor:pointer}
.mcell.up{background:#0e1422;color:#fff}.mcell.ok{background:#12351f;border-color:#4ade80}#gpHud{text-align:center;color:var(--g);font-weight:700;margin-bottom:10px;min-height:20px}
.tabbar a{font-size:11px}.gr{padding-left:32px;line-height:1.7;margin:6px 0 14px}.gr li{margin-bottom:6px}.balchip{background:#1c2438;border:1px solid var(--line);color:var(--g);font-weight:700;font-size:13px;border-radius:20px;padding:8px 12px;white-space:nowrap}`;
function build() {
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + css2 + '</style>');
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
    'Scores are verified by the server: it replays your moves and calculates the score itself. Edited, fake or bot-played scores are rejected, the entry fee is not returned, and the account can be banned. Using more than one account in the same room is not allowed.'
  ]) + '</ol>';
  $('gRulesModal').style.display = 'flex';
}

/* ---------- create / join ---------- */
function create(k) {
  if (token && !profOk()) return needProfile(() => create(k));
  if (!token) return needLogin();
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
  if (token && !profOk()) return needProfile(() => join(id));
  if (!token) return needLogin();
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
async function finish(score, inputs) {
  if (!cur || cur.done) return; cur.done = true; if (stopFn) { stopFn(); stopFn = null; } $('gpBack').style.display = '';
  if (!cur.matchId) { $('gpMsg').innerHTML = `<div class="card" style="text-align:center;margin-top:12px"><h3>Your score: ${score}</h3><button class="gbtn" onclick="RRRG.free('${cur.k}')">🔁 Play again</button></div>`; return; }
  cur.score = score; cur.inputs = inputs || []; send();
}
async function send() {
  $('gpMsg').innerHTML = '<p class="empty">Sending your score...</p>';
  for (let i = 0; i < 3; i++) {
    try {
      const d = await api('gameSubmit', {matchId: cur.matchId, score: cur.score, inputs: cur.inputs});
      if (d.newBalance != null) setCoins(d.newBalance);
      const t = d.status !== 'SUCCESS' ? fail(d) : d.flagged ? '⚠️ Your score could not be verified, so it was not counted.' : '✅ Score ' + d.score + ' submitted. Results come when all players finish or time ends. Check Games > My Game Matches.';
      $('gpMsg').innerHTML = `<div class="card" style="text-align:center;margin-top:12px"><p style="color:#fff">${esc(t)}</p><button class="gbtn" onclick="RRRG.leave()">Back to Games</button></div>`; return;
    } catch (e) { await new Promise(r => setTimeout(r, 1500)); }
  }
  $('gpMsg').innerHTML = '<div class="card" style="text-align:center;margin-top:12px"><p>Could not send your score. Check your internet and tap Retry. Do not close this page.</p><button class="gbtn" onclick="RRRG.retry()">Retry</button></div>';
}
function leave() { if (stopFn) { stopFn(); stopFn = null; } $('gArena').innerHTML = ''; show('vGames'); load(); }

function fillProfile() {
  if (!$('pfIgn')) return;
  const lock = PROFILE.lockUntil && PROFILE.lockUntil > Date.now(), has = !!(PROFILE.ign && PROFILE.uid);
  $('pfIgn').value = PROFILE.ign || ''; $('pfUid').value = PROFILE.uid || ''; $('pfIgn').readOnly = !!lock; $('pfUid').readOnly = !!lock; $('pfBtn').disabled = !!lock;
  $('pfNote').innerText = lock ? '🔒 You can change your IGN/UID after ' + new Date(PROFILE.lockUntil).toLocaleString() + '.' : has ? 'You can change your IGN/UID now. After saving a change you must wait 3 days before changing again.' : 'Required. Check your IGN and UID carefully, after saving you can change them only after 3 days.';
  $('pfBtn').innerText = has ? 'Save changes' : 'Save';
}
async function loadProfile() { try { const d = await api('gameProfileGet'); if (d.status === 'SUCCESS') { PROFILE = d.profile; fillProfile(); } } catch (e) {} }
function saveProfile(e) {
  e.preventDefault();
  guarded($('pfBtn'), async () => {
    const gi = $('pfIgn').value.trim(), gu = $('pfUid').value.trim();
    if (gi !== (PROFILE.ign || '') || gu !== (PROFILE.uid || '')) { if (!confirm('Please check:\n\nIGN: ' + gi + '\nUID: ' + gu + '\n\nAfter saving you cannot change these for 3 days. Is this correct?')) return; } else return alert('Nothing changed.');
    const d = await api('gameProfileSave', {ign: gi, uid: gu, scanId: SHOT.id});
    if (shotHandle(d, 'pfUid', 'pfIgn')) return;
    if (d.status === 'PROFILE_WAIT') return alert('🔒 You can change your IGN/UID after ' + new Date(d.until).toLocaleString() + '.');
    if (d.status === 'SUCCESS') { PROFILE = d.profile; fillProfile(); alert('✅ Saved. Your IGN and UID are filled automatically in matches and games.'); } else if (d.status !== 'Banned') alert(fail(d));
  });
}
window.RRRG = {syncProfile: p => { PROFILE = p; fillProfile(); }, saveProfile, rules, list, free, play, go, create, prev, doCreate, join, doJoin, begin, cancel, leave, refresh: load, retry: send};
build();
/* balance next to the bell */
document.querySelector('.top .in-only').insertAdjacentHTML('beforebegin', '<span class="in-only balchip">🪙 <b id="topBal">' + $('coins').innerText + '</b></span>');
{ const o = setCoins; setCoins = c => { o(c); $('topBal').innerText = $('coins').innerText; }; }
/* Game Profile card in Account */
$('vAccount').querySelector('.card').insertAdjacentHTML('afterend', `<div class="card"><h3>🎮 Game Profile <small style="color:var(--mut);font-size:12px">(required)</small></h3><p id="pfNote">Required. Check your UID carefully, it cannot be changed later.</p>
  <form onsubmit="RRRG.saveProfile(event)" style="margin-top:10px"><div class="fg"><label>IGN <small style="color:var(--mut)">(In-Game Name)</small></label><input id="pfIgn" class="fc" required minlength="2" maxlength="40" placeholder="Your name in the game"></div>
  <div class="fg"><label>UID <small style="color:var(--mut)">(User ID)</small></label><input id="pfUid" class="fc" required inputmode="numeric" pattern="[0-9]{6,15}" placeholder="Numbers only"></div>
  <div class="fg"><label>📸 Free Fire profile screenshot <small style="color:var(--mut)">(needed when you set or change your UID)</small></label><input type="file" id="pfShot" accept="image/*" class="fc" onchange="shotPick(this,'pfUid','pfIgn','pfShotMsg')"><p class="lgnote" id="pfShotMsg" style="margin:6px 0 0"></p></div>
  <button class="gbtn" id="pfBtn" type="submit">Save</button></form></div>`);
{ const oa = openAccount; openAccount = function () { oa(); if (token) loadProfile(); }; }
new MutationObserver(() => { if (!document.body.classList.contains('in')) { PROFILE = {ign: '', uid: ''}; fillProfile(); $('topBal').innerText = '0'; MINE = []; } }).observe(document.body, {attributes: true, attributeFilter: ['class']});
setInterval(() => { if (document.visibilityState === 'visible' && ($('vGames').classList.contains('on') || $('vGameList').classList.contains('on'))) load(); }, 20000);
})();
