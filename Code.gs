/** RRR TOURNAMENT ENGINE v4: token check, bans, notifications, positions, per-mode sheets */
var CLIENT_ID = '199209878392-1saa86hi59blkatcgrpn9dra3s0jgucr.apps.googleusercontent.com';
var COIN_RATE = 1;        // 1 NPR = 1 coin
var EMAIL_NOTIFY = true;  // also email players about payments, bans and prizes

function SS() { return SpreadsheetApp.getActiveSpreadsheet(); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean(v) { v = String(v || '').slice(0, 300); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function same(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }
function rewardFor(p) { return p === 1 ? 100 : p === 2 ? 80 : p === 3 ? 60 : p <= 15 ? 50 : 0; }
function modeKey(m) { return m.type === 'CS' ? 'CS' : m.mode; }

function verify(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var k = 't' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  var hit = cache.get(k); if (hit) return hit;
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), {muteHttpExceptions: true});
  if (r.getResponseCode() !== 200) return null;
  var t = JSON.parse(r.getContentText());
  if (t.aud !== CLIENT_ID || String(t.email_verified) !== 'true' || !t.email) return null;
  cache.put(k, t.email, 300); return t.email;
}

function readMatches() {
  var d = SS().getSheetByName('Matches').getDataRange().getValues(), r = [];
  for (var i = 1; i < d.length; i++) {
    if (!d[i][0]) continue;
    var t = d[i][6]; if (t instanceof Date) t = Utilities.formatDate(t, Session.getScriptTimeZone(), 'hh:mm a');
    r.push({name: String(d[i][0]).trim(), type: d[i][1], mode: d[i][2], fee: Number(d[i][3]), max: Number(d[i][4]), prize: d[i][5], time: String(t),
            sheet: d[i][1] === 'CS' ? 'CSEntries' : d[i][2] + 'Entries'});
  }
  return r;
}
function getMatch(n) { var a = readMatches(); for (var i = 0; i < a.length; i++) if (a[i].name === n) return a[i]; return null; }

/** Returns {reason} if this email/UID is banned (site-wide, from the match's mode, or from this match) */
function banFor(email, uid, m, extra) {
  var s = SS().getSheetByName('Bans'); if (!s) return null;
  var d = s.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) {
    var r = d[i];
    if (String(r[5] || 'Active') !== 'Active') continue;
    var bu = String(r[1] || '').trim();
    var hit = (r[0] && same(r[0], email)) || (bu && (bu === String(uid) || (extra && extra.indexOf(bu) > -1)));
    if (!hit) continue;
    var sc = String(r[2]).toUpperCase(), tg = String(r[3]).trim();
    if (sc === 'SITE' || (m && sc === 'MODE' && same(tg, modeKey(m))) || (m && sc === 'MATCH' && same(tg, m.name))) return {reason: String(r[4] || '')};
  }
  return null;
}

function notify(email, title, msg) {
  SS().getSheetByName('Notifications').appendRow([email, title, msg, new Date(), '']);
  if (EMAIL_NOTIFY) { try { MailApp.sendEmail(email, 'RRR Tournament: ' + title, msg + '\n\nOpen the site to see more.'); } catch (e) {} }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = JSON.parse(e.postData.contents), email = verify(p.token);
    if (!email) return out({status: 'AUTH_ERROR'});
    var ss = SS(), ps = ss.getSheetByName('Players'), pd = ps.getDataRange().getValues(), row = -1;
    for (var i = 1; i < pd.length; i++) { if (same(pd[i][0], email)) { row = i; break; } }

    if (p.action === 'checkPlayer' && row < 0) { ps.appendRow([email, clean(p.name), 25, 'Active', new Date()]); return out({status: 'Active', coins: 25}); }
    if (row < 0) return out({status: 'AUTH_ERROR'});
    var sb = banFor(email, '', null, '');
    if (pd[row][3] === 'Banned' || sb) return out({status: 'Banned', reason: sb ? sb.reason : ''});
    var bal = Number(pd[row][2]) || 0;

    if (p.action === 'checkPlayer') return out({status: 'Active', coins: bal});

    if (p.action === 'getNotifications') {
      var nd = ss.getSheetByName('Notifications').getDataRange().getValues(), list = [], unread = 0;
      for (var q = nd.length - 1; q >= 1 && list.length < 20; q--) {
        if (!same(nd[q][0], email)) continue;
        var rd = nd[q][4] === 'Y'; if (!rd) unread++;
        list.push({title: nd[q][1], msg: nd[q][2], time: Utilities.formatDate(new Date(nd[q][3]), Session.getScriptTimeZone(), 'dd MMM, hh:mm a'), read: rd});
      }
      return out({status: 'SUCCESS', list: list, unread: unread});
    }
    if (p.action === 'markRead') {
      var ns = ss.getSheetByName('Notifications'), md = ns.getDataRange().getValues();
      for (var z = 1; z < md.length; z++) { if (same(md[z][0], email) && md[z][4] !== 'Y') ns.getRange(z + 1, 5).setValue('Y'); }
      return out({status: 'SUCCESS'});
    }

    if (p.action === 'submitPayment') {
      var amt = Number(p.amount), utr = clean(p.utr);
      if (!utr) return out({status: 'INVALID'});
      if (!(amt >= 25)) return out({status: 'MIN_DEPOSIT'});
      var ts = ss.getSheetByName('Transactions'), td = ts.getDataRange().getValues();
      for (var a = 1; a < td.length; a++) { if (String(td[a][0]) === utr) return out({status: 'DUPLICATE_UTR'}); }
      ts.appendRow([utr, amt, email, clean(p.ign), 'Pending', new Date(), '']);
      notify(email, 'Payment received', 'We received your payment request of ' + amt + ' NPR. Your coins will be added to your wallet within 6-8 hours.');
      return out({status: 'SUCCESS'});
    }

    if (p.action === 'submitWithdrawal') {
      var w = Math.floor(Number(p.amount));
      if (!(w >= 100)) return out({status: 'MIN_LIMIT_ERROR'});
      if (bal < w) return out({status: 'INSUFFICIENT_BALANCE'});
      ps.getRange(row + 1, 3).setValue(bal - w);
      ss.getSheetByName('Withdrawals').appendRow([email, clean(p.esewaId), w, 'Pending', new Date()]);
      notify(email, 'Withdrawal request received', 'Your withdrawal request for ' + w + ' coins was received. It will be sent to your e-Sewa within 6-8 hours.');
      return out({status: 'SUCCESS', newBalance: bal - w});
    }

    if (p.action === 'joinMatch') {
      var m = getMatch(p.matchName);
      if (!m) return out({status: 'INVALID'});
      if (m.type === 'CS' && String(p.teamDetails || '').length < 10) return out({status: 'TEAM_REQUIRED'});
      var uid = clean(p.uid), b = banFor(email, uid, m, String(p.teamDetails || ''));
      if (b) return out({status: 'MATCH_BANNED', msg: b.reason});
      var es = ss.getSheetByName(m.sheet), ed = es.getDataRange().getValues(), count = 0;
      for (var k = 1; k < ed.length; k++) {
        if (ed[k][0] === p.matchName) { count++; if (same(ed[k][4], email)) return out({status: 'ALREADY_JOINED'}); }
      }
      if (count >= m.max) return out({status: 'ROOM_FULL'});
      if (bal < m.fee) return out({status: 'LOW_BALANCE'});
      ps.getRange(row + 1, 3).setValue(bal - m.fee);
      es.appendRow([p.matchName, uid, clean(p.ign), clean(p.teamDetails), email, new Date()]);
      return out({status: 'SUCCESS', newBalance: bal - m.fee});
    }
    return out({status: 'INVALID'});
  } catch (err) {
    return out({status: 'ERROR', msg: err.toString()});
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  var ss = SS(), act = e.parameter.action;
  if (act === 'getSlots') {
    var counts = {};
    ['SoloEntries', 'DuoEntries', 'SquadEntries', 'CSEntries'].forEach(function (n) {
      var s = ss.getSheetByName(n); if (!s) return;
      var d = s.getDataRange().getValues();
      for (var i = 1; i < d.length; i++) counts[d[i][0]] = (counts[d[i][0]] || 0) + 1;
    });
    return out(counts);
  }
  if (act === 'getConfig') {
    var rw = []; for (var i = 1; i <= 15; i++) rw.push(rewardFor(i));
    return out({matches: readMatches(), rewards: rw});
  }
  if (act === 'getWinners') {
    var res = [];
    ['SoloEntries', 'DuoEntries', 'SquadEntries'].forEach(function (n) {
      var s = ss.getSheetByName(n); if (!s) return;
      var d = s.getDataRange().getValues();
      for (var j = 1; j < d.length; j++) {
        var pos = Number(d[j][6]);
        if (pos > 0 && rewardFor(pos) > 0) res.push({match: d[j][0], pos: pos, ign: d[j][2], uid: '****' + String(d[j][1]).slice(-4), reward: rewardFor(pos)});
      }
    });
    res.sort(function (a, b) { return a.match === b.match ? a.pos - b.pos : (a.match < b.match ? -1 : 1); });
    return out(res);
  }
  return ContentService.createTextOutput('Secure Portal Core Pipeline Active.');
}

/* ---------------- Admin menu ---------------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Elite Admin')
    .addItem('Approve payments', 'approvePayments')
    .addItem('Refund rejected withdrawals', 'refundRejected')
    .addItem('Give Full Map rewards (Position column)', 'giveMapRewards')
    .addItem('Give CS prize (Results sheet)', 'giveRewards')
    .addItem('Notify new bans / lifted bans', 'processBans')
    .addItem('Reset match slots', 'resetMatch')
    .addToUi();
}

function addCoins(ps, pd, email, amt) {
  for (var j = 1; j < pd.length; j++) {
    if (same(pd[j][0], email)) { var nb = (Number(pd[j][2]) || 0) + amt; ps.getRange(j + 1, 3).setValue(nb); pd[j][2] = nb; return true; }
  }
  return false;
}

function approvePayments() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SS(), t = ss.getSheetByName('Transactions'), ps = ss.getSheetByName('Players');
    var td = t.getDataRange().getValues(), pd = ps.getDataRange().getValues(), n = 0;
    for (var i = 1; i < td.length; i++) {
      if (td[i][4] !== 'Approved' || td[i][6] === 'Credited') continue;
      var amt = Math.floor(Number(td[i][1]) * COIN_RATE);
      if (addCoins(ps, pd, td[i][2], amt)) {
        t.getRange(i + 1, 7).setValue('Credited'); n++;
        notify(td[i][2], 'Payment approved', amt + ' coins have been added to your wallet.');
      }
    }
    SpreadsheetApp.getUi().alert(n + ' payment(s) credited.');
  } finally { lock.releaseLock(); }
}

function refundRejected() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SS(), w = ss.getSheetByName('Withdrawals'), ps = ss.getSheetByName('Players');
    var wd = w.getDataRange().getValues(), pd = ps.getDataRange().getValues(), n = 0;
    for (var i = 1; i < wd.length; i++) {
      if (wd[i][3] !== 'Rejected' || wd[i][5] === 'Refunded') continue;
      if (addCoins(ps, pd, wd[i][0], Number(wd[i][2]))) {
        w.getRange(i + 1, 6).setValue('Refunded'); n++;
        notify(wd[i][0], 'Withdrawal rejected', 'Your withdrawal of ' + wd[i][2] + ' coins was rejected and the coins were returned to your wallet.');
      }
    }
    SpreadsheetApp.getUi().alert(n + ' withdrawal(s) refunded.');
  } finally { lock.releaseLock(); }
}

/** Full Map: type the finishing position (1, 2, 3...) in column G of SoloEntries / DuoEntries / SquadEntries, then run this */
function giveMapRewards() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SS(), ps = ss.getSheetByName('Players'), pd = ps.getDataRange().getValues(), n = 0;
    ['SoloEntries', 'DuoEntries', 'SquadEntries'].forEach(function (nm) {
      var s = ss.getSheetByName(nm); if (!s) return;
      var d = s.getDataRange().getValues();
      for (var i = 1; i < d.length; i++) {
        var pos = Number(d[i][6]);
        if (!(pos > 0) || String(d[i][7]).indexOf('Paid') === 0) continue;
        var amt = rewardFor(pos), st;
        if (amt === 0) st = 'No reward (position ' + pos + ')';
        else if (addCoins(ps, pd, d[i][4], amt)) {
          st = 'Paid ' + amt; n++;
          notify(d[i][4], 'You won a prize!', 'Position #' + pos + ' in ' + d[i][0] + ': ' + amt + ' coins were added to your wallet.');
        } else st = 'Email not found';
        s.getRange(i + 1, 8).setValue(st);
      }
    });
    SpreadsheetApp.getUi().alert(n + ' reward(s) given.');
  } finally { lock.releaseLock(); }
}

/** Clash Squad: Results sheet (Match Name, Position, Email). Position 1 gets the match Prize Pool */
function giveRewards() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var ss = SS(), rs = ss.getSheetByName('Results'), ps = ss.getSheetByName('Players');
    var rd = rs.getDataRange().getValues(), pd = ps.getDataRange().getValues(), n = 0;
    for (var i = 1; i < rd.length; i++) {
      if (!rd[i][0] || String(rd[i][3]).indexOf('Paid') === 0) continue;
      var m = getMatch(String(rd[i][0]).trim()), pos = Number(rd[i][1]), st = 'Match/Email not found';
      if (m && pos > 0) {
        var amt = m.type === 'MAP' ? rewardFor(pos) : (pos === 1 ? Number(m.prize) : 0);
        if (addCoins(ps, pd, rd[i][2], amt)) { st = 'Paid ' + amt; n++; notify(rd[i][2], 'You won a prize!', 'Position #' + pos + ' in ' + m.name + ': ' + amt + ' coins were added to your wallet.'); }
      }
      rs.getRange(i + 1, 4).setValue(st);
    }
    SpreadsheetApp.getUi().alert(n + ' reward(s) given.');
  } finally { lock.releaseLock(); }
}

/** Bans sheet: Email | UID | Scope (SITE/MODE/MATCH) | Target | Reason | Status (Active/Lifted) */
function processBans() {
  var s = SS().getSheetByName('Bans'), d = s.getDataRange().getValues(), n = 0;
  for (var i = 1; i < d.length; i++) {
    var r = d[i]; if (!r[0] && !r[1]) continue;
    var st = String(r[5] || 'Active'), nt = String(r[7] || ''), sc = String(r[2]).toUpperCase();
    var where = sc === 'SITE' ? 'the whole site' : (sc === 'MODE' ? 'the ' + r[3] + ' mode' : 'the match "' + r[3] + '"');
    if (!r[6]) s.getRange(i + 1, 7).setValue(new Date());
    if (st === 'Active' && nt !== 'Notified' && nt !== 'No email') {
      if (r[0]) notify(r[0], 'You have been banned', 'You are banned from ' + where + '.' + (r[4] ? ' Reason: ' + r[4] : ''));
      s.getRange(i + 1, 8).setValue(r[0] ? 'Notified' : 'No email'); n++;
    } else if (st === 'Lifted' && nt !== 'Lift-notified') {
      if (r[0]) notify(r[0], 'Ban lifted', 'Your ban from ' + where + ' has been lifted.');
      s.getRange(i + 1, 8).setValue('Lift-notified'); n++;
    }
  }
  SpreadsheetApp.getUi().alert(n + ' ban update(s) processed.');
}

function resetMatch() {
  var ui = SpreadsheetApp.getUi(), r = ui.prompt('Which match should be reset? (type the exact Match Name)');
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var name = r.getResponseText().trim(), m = getMatch(name);
  if (!m) return ui.alert('No match with this name.');
  var ss = SS(), s = ss.getSheetByName(m.sheet);
  var a = ss.getSheetByName('EntriesArchive') || ss.insertSheet('EntriesArchive'), d = s.getDataRange().getValues(), n = 0;
  for (var i = d.length - 1; i >= 1; i--) { if (d[i][0] === name) { a.appendRow(d[i]); s.deleteRow(i + 1); n++; } }
  ui.alert(n + ' entries moved to EntriesArchive. Slots are free again.');
}

/** Run once (safe to run again): creates any missing sheet, never deletes data */
function setupAll() {
  var ss = SS(), E = ['Match Name', 'Leader UID', 'Leader IGN', 'Teammates', 'Account Email', 'Entry Timestamp', 'Position (admin types 1,2,3...)', 'Reward Status (auto)'];
  var cfg = {
    'Players': ['Player Email ID', 'Google User Name', 'Coins Balance', 'Status (Active/Banned)', 'Registration Date'],
    'Transactions': ['e-Sewa Ref ID', 'Amount Paid (NPR)', 'Registered Email', 'IGN', 'Status (Pending/Approved)', 'Submission Date', 'Credited?'],
    'Withdrawals': ['Player Email ID', 'e-Sewa ID', 'Coins Requested', 'Status (Pending/Settled/Rejected)', 'Timestamp', 'Refund (auto)'],
    'SoloEntries': E, 'DuoEntries': E, 'SquadEntries': E,
    'CSEntries': E.slice(0, 6),
    'Bans': ['Email', 'Player UID', 'Scope (SITE/MODE/MATCH)', 'Target (Solo/Duo/Squad/CS or exact Match Name)', 'Reason', 'Status (Active/Lifted)', 'Date (auto)', 'Notified (auto)'],
    'Notifications': ['Email', 'Title', 'Message', 'Time', 'Read'],
    'Results': ['Match Name', 'Position', 'Player Email', 'Reward Status (auto)'],
    'Matches': ['Match Name', 'Type (MAP/CS)', 'Mode (Solo/Duo/Squad)', 'Entry Fee', 'Max Slots/Teams', 'Prize Pool', 'Match Time']
  };
  for (var name in cfg) {
    var s = ss.getSheetByName(name) || ss.insertSheet(name);
    if (s.getLastRow() === 0) {
      if (name === 'Matches') s.getRange('G:G').setNumberFormat('@');
      s.appendRow(cfg[name]);
      s.getRange(1, 1, 1, cfg[name].length).setFontWeight('bold').setBackground('#fff2cc');
      if (name === 'Matches') s.getRange(2, 1, 5, 7).setValues([
        ['Solo Warriors (Full Map)', 'MAP', 'Solo', 25, 48, 840, '07:00 PM'],
        ['Duo Assault (Full Map)', 'MAP', 'Duo', 50, 24, 840, '08:00 PM'],
        ['Squad Clan Wars (Full Map)', 'MAP', 'Squad', 100, 12, 840, '09:00 PM'],
        ['CS Squad Alpha', 'CS', 'Squad', 100, 2, 160, '07:00 PM'],
        ['CS Squad Omega', 'CS', 'Squad', 100, 2, 160, '09:30 PM']]);
    }
  }
}
