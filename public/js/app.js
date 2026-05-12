var API = '';

var DB = {};
var currentUser = null;
var selectedSinf = null;
var selectedTestIdx = null;
var questions = [];
var qIndex = 0;
var score = 0;
var answered = false;
var userAnswers = [];

(async function init() {
  try {
    var res = await fetch(API + '/api/quiz/questions');
    DB = await res.json();
  } catch (err) {
    console.error('Failed to load questions:', err);
  }
})();

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (s) {
    s.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
  if (id === 'dashboardScreen') refreshDashboard();
}

function showErr(id, msg) {
  var el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function () { el.classList.remove('show'); }, 4000);
}

// ═══════ AUTH ═══════
async function register() {
  var name = document.getElementById('regName').value.trim();
  var email = document.getElementById('regEmail').value.trim().toLowerCase();
  var pass = document.getElementById('regPass').value;
  var school = document.getElementById('regSchool').value.trim();
  var region = document.getElementById('regRegion').value;
  var grade = document.getElementById('regGrade').value;

  if (!name) return showErr('regErr', 'Ismingizni kiriting.');
  if (!email.includes('@')) return showErr('regErr', "To'g'ri email kiriting.");
  if (pass.length < 6) return showErr('regErr', "Parol kamida 6 ta belgi bo'lishi kerak.");

  try {
    var res = await fetch(API + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, password: pass, school: school, region: region, grade: grade }),
    });
    var data = await res.json();
    if (!res.ok) return showErr('regErr', data.error);
    currentUser = data;
    showScreen('dashboardScreen');
  } catch (err) {
    showErr('regErr', 'Server bilan aloqa xatosi.');
  }
}

async function login() {
  var email = document.getElementById('loginEmail').value.trim().toLowerCase();
  var pass = document.getElementById('loginPass').value;
  try {
    var res = await fetch(API + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass }),
    });
    var data = await res.json();
    if (!res.ok) return showErr('loginErr', data.error);
    currentUser = data;
    showScreen('dashboardScreen');
  } catch (err) {
    showErr('loginErr', 'Server bilan aloqa xatosi.');
  }
}

function logout() {
  currentUser = null;
  showScreen('welcomeScreen');
}

// ═══════ DASHBOARD ═══════
function refreshDashboard() {
  if (!currentUser) return;
  document.getElementById('dashGreet').textContent = 'Salom, ' + currentUser.name + '! \uD83D\uDC4B';
  var adminTab = document.getElementById('adminTab');
  if (currentUser.role === 'admin') {
    adminTab.style.display = '';
  } else {
    adminTab.style.display = 'none';
  }
  updateProfileTab();
  updateStatsTab();
}

function showDashTab(tab) {
  var tabs = document.querySelectorAll('.dash-tab');
  tabs.forEach(function (t) { t.style.display = 'none'; });
  document.getElementById('tab-' + tab).style.display = 'block';

  var navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach(function (t) { t.classList.remove('active'); });
  event.target.closest('.nav-tab').classList.add('active');

  if (tab === 'leaderboard') loadLeaderboard();
  if (tab === 'admin') loadAdmin();
  if (tab === 'stats') updateStatsTab();
  if (tab === 'profile') updateProfileTab();
}

function selectSubject(subject) {
  if (subject === 'informatika') {
    buildSinfGrid();
    showScreen('sinfScreen');
  }
}

// ═══════ PROFILE ═══════
function updateProfileTab() {
  if (!currentUser) return;
  var initials = currentUser.name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().substring(0, 2);
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileEmail').textContent = currentUser.email;
  document.getElementById('profileSchool').textContent = currentUser.school ? '🏫 ' + currentUser.school : '';
  document.getElementById('profileRegion').textContent = currentUser.region ? '📍 ' + currentUser.region : '';
  document.getElementById('profileGrade').textContent = currentUser.grade ? '📚 ' + currentUser.grade : '';
  document.getElementById('profTests').textContent = currentUser.totalTests || 0;
  document.getElementById('profCorrect').textContent = currentUser.totalCorrect || 0;
  var avg = currentUser.totalQuestions > 0 ? Math.round((currentUser.totalCorrect / currentUser.totalQuestions) * 100) : 0;
  document.getElementById('profAvg').textContent = avg + '%';
}

// ═══════ STATS ═══════
function updateStatsTab() {
  if (!currentUser) return;
  document.getElementById('myTests').textContent = currentUser.totalTests || 0;
  document.getElementById('myCorrect').textContent = currentUser.totalCorrect || 0;
  var avg = currentUser.totalQuestions > 0 ? Math.round((currentUser.totalCorrect / currentUser.totalQuestions) * 100) : 0;
  document.getElementById('myAvg').textContent = avg + '%';

  var list = document.getElementById('myResultsList');
  list.innerHTML = '';
  if (currentUser.results) {
    var keys = Object.keys(currentUser.results);
    if (keys.length === 0) {
      list.innerHTML = '<p style="color:var(--muted);font-size:.88rem;text-align:center;margin-top:16px">Hali test topshirmadingiz</p>';
      return;
    }
    keys.forEach(function (key) {
      var pct = currentUser.results[key];
      var parts = key.split('_');
      var sinf = parts[0];
      var testIdx = parseInt(parts[1]);
      var testInfo = DB[sinf] && DB[sinf].tests[testIdx];
      var title = testInfo ? sinf + ' — ' + testInfo.title : key;
      var pass = pct >= 70;
      var div = document.createElement('div');
      div.className = 'prev-box ' + (pass ? 'pass' : 'fail');
      div.innerHTML = '<strong>' + title + '</strong>: ' + pct + '% — ' + (pass ? "\u2713 O'tgan" : "\u2717 O'tmagan");
      list.appendChild(div);
    });
  }
}

// ═══════ LEADERBOARD ═══════
async function loadLeaderboard() {
  var container = document.getElementById('leaderboardContent');
  container.innerHTML = '<p style="text-align:center;color:var(--muted)">Yuklanmoqda...</p>';
  try {
    var res = await fetch(API + '/api/quiz/leaderboard');
    var data = await res.json();
    if (data.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--muted)">Hali hech kim test topshirmadi</p>';
      return;
    }
    var html = '<table class="lb-table"><thead><tr><th>#</th><th>Ism</th><th>Maktab</th><th>Testlar</th><th>Natija</th></tr></thead><tbody>';
    data.forEach(function (u) {
      var rankClass = u.rank === 1 ? 'gold' : u.rank === 2 ? 'silver' : u.rank === 3 ? 'bronze' : '';
      var medal = u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : u.rank;
      html += '<tr class="lb-row">';
      html += '<td><span class="lb-rank ' + rankClass + '">' + medal + '</span></td>';
      html += '<td>' + u.name + '</td>';
      html += '<td><span class="lb-school">' + (u.school || '—') + '</span></td>';
      html += '<td>' + u.totalTests + '</td>';
      html += '<td><strong>' + u.avgPct + '%</strong></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:var(--red)">Xatolik yuz berdi</p>';
  }
}

// ═══════ ADMIN ═══════
async function loadAdmin() {
  if (!currentUser || currentUser.role !== 'admin') return;

  var dashEl = document.getElementById('adminDashboard');
  dashEl.innerHTML = '<p style="text-align:center;color:var(--muted)">Yuklanmoqda...</p>';

  try {
    var res = await fetch(API + '/api/admin/dashboard', {
      headers: { 'X-Admin-Id': currentUser.id },
    });
    var data = await res.json();

    var html = '<div class="stats-grid">';
    html += '<div class="stat-box"><span class="val">' + data.totalUsers + '</span><span class="lbl">Foydalanuvchilar</span></div>';
    html += '<div class="stat-box"><span class="val">' + data.activeUsers + '</span><span class="lbl">Aktiv</span></div>';
    html += '<div class="stat-box"><span class="val">' + (data.schoolStats ? data.schoolStats.length : 0) + '</span><span class="lbl">Maktablar</span></div>';
    html += '</div>';

    if (data.schoolStats && data.schoolStats.length > 0) {
      html += '<div class="admin-card"><h3>Maktablar bo\'yicha</h3>';
      data.schoolStats.forEach(function (s) {
        html += '<div class="admin-user-row"><span class="name">' + s.school + '</span><span class="meta">' + s.count + ' ta foydalanuvchi, ' + s.totalTests + ' test, ' + s.avgPct + '% o\'rtacha</span></div>';
      });
      html += '</div>';
    }

    if (data.recentUsers && data.recentUsers.length > 0) {
      html += '<div class="admin-card"><h3>So\'nggi ro\'yxatdan o\'tganlar</h3>';
      data.recentUsers.forEach(function (u) {
        var d = new Date(u.createdAt);
        html += '<div class="admin-user-row"><span class="name">' + u.name + '</span><span class="meta">' + (u.school || '—') + ' | ' + d.toLocaleDateString() + '</span></div>';
      });
      html += '</div>';
    }

    dashEl.innerHTML = html;
  } catch (err) {
    dashEl.innerHTML = '<p style="color:var(--red)">Xatolik</p>';
  }

  loadAdminUsers();
}

async function loadAdminUsers() {
  var listEl = document.getElementById('adminUsersList');
  try {
    var res = await fetch(API + '/api/admin/users', {
      headers: { 'X-Admin-Id': currentUser.id },
    });
    var data = await res.json();

    var html = '';
    data.users.forEach(function (u) {
      html += '<div class="admin-user-row">';
      html += '<div><span class="name">' + u.name + '</span><br><span class="meta">' + u.email + ' | ' + (u.school || '—') + ' | ' + (u.grade || '—') + ' | Tests: ' + u.totalTests + ' | Avg: ' + u.avgPct + '%</span></div>';
      if (u.role !== 'admin') {
        html += '<button class="btn-danger" onclick="deleteUser(\'' + u.id + '\')">O\'chirish</button>';
      } else {
        html += '<span style="color:var(--primary);font-size:.78rem;font-weight:700">ADMIN</span>';
      }
      html += '</div>';
    });
    listEl.innerHTML = html || '<p style="color:var(--muted)">Foydalanuvchilar topilmadi</p>';
  } catch (err) {
    listEl.innerHTML = '<p style="color:var(--red)">Xatolik</p>';
  }
}

async function deleteUser(userId) {
  if (!confirm("Rostdan ham bu foydalanuvchini o'chirmoqchimisiz?")) return;
  try {
    await fetch(API + '/api/admin/users/' + userId, {
      method: 'DELETE',
      headers: { 'X-Admin-Id': currentUser.id },
    });
    loadAdminUsers();
  } catch (err) {
    alert('Xatolik yuz berdi');
  }
}

// ═══════ SINF GRID ═══════
function buildSinfGrid() {
  document.getElementById('sinfGreet').textContent = 'Salom, ' + currentUser.name + '!';
  var grid = document.getElementById('sinfGrid');
  grid.innerHTML = '';
  Object.keys(DB).forEach(function (key) {
    var div = document.createElement('div');
    div.className = 'sinf-card';
    div.innerHTML = '<div class="sinf-num">' + key.replace('-sinf', '') + '</div><div class="sinf-lbl">sinf</div>';
    div.onclick = function () { selectSinf(key); };
    grid.appendChild(div);
  });
}

function selectSinf(sinfKey) {
  selectedSinf = sinfKey;
  var sinf = DB[sinfKey];
  document.getElementById('bc1').textContent = sinf.label;
  document.getElementById('nazTitle').textContent = sinf.label + ' — nazorat ishini tanlang';

  var grid = document.getElementById('nazGrid');
  grid.innerHTML = '';
  sinf.tests.forEach(function (t, i) {
    var btn = document.createElement('div');
    btn.className = 'naz-btn';
    var key = sinfKey + '_' + i;
    var prev = currentUser.results[key];
    var prevHtml = '';
    if (prev != null) {
      prevHtml = '<div style="font-size:.72rem;margin-top:4px;color:' + (prev >= 70 ? '#027a5c' : '#9d0208') + ';font-weight:700">' + prev + '% — ' + (prev >= 70 ? "\u2713 O'tgan" : "\u2717 O'tmagan") + '</div>';
    }
    btn.innerHTML = '<div class="naz-n">' + t.title + '</div><div class="naz-t">' + t.topic + '</div>' + prevHtml;
    btn.onclick = function () { selectTest(i); };
    grid.appendChild(btn);
  });
  showScreen('nazScreen');
}

function selectTest(idx) {
  selectedTestIdx = idx;
  var t = DB[selectedSinf].tests[idx];
  var total = t.questions.length;
  document.getElementById('introTitle').textContent = t.title + ' — Testga tayyormisiz?';
  document.getElementById('introDesc').textContent = 'Jami ' + total + " ta savol. Savollar tasodifiy tartibda beriladi. Orqaga qaytib bo'lmaydi.\n\nSertifikat olish uchun 70% yoki undan yuqori natija kerak.";

  var key = selectedSinf + '_' + idx;
  var prev = currentUser.results[key];
  var prevEl = document.getElementById('introPrev');
  if (prev != null) {
    prevEl.innerHTML = '<div class="prev-box ' + (prev >= 70 ? 'pass' : 'fail') + '">Oldingi natijangiz: <strong>' + prev + '%</strong> — ' + (prev >= 70 ? "\u2713 Test o'tilgan" : "\u2717 Test o'tilmagan") + '</div>';
  } else {
    prevEl.innerHTML = '';
  }
  showScreen('introScreen');
}

// ═══════ QUIZ ═══════
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function startQuiz() {
  var t = DB[selectedSinf].tests[selectedTestIdx];
  var originalQuestions = t.questions;
  var indices = [];
  for (var i = 0; i < originalQuestions.length; i++) indices.push(i);
  indices = shuffle(indices);
  questions = indices.map(function (idx) {
    return { q: originalQuestions[idx].q, opts: originalQuestions[idx].opts, origIdx: idx };
  });
  qIndex = 0; score = 0;
  userAnswers = new Array(originalQuestions.length);
  for (var j = 0; j < userAnswers.length; j++) userAnswers[j] = -1;
  document.getElementById('qTotal').textContent = questions.length;
  document.getElementById('userBadge').textContent = currentUser.name;
  showScreen('quizScreen');
  renderQuestion();
}

function renderQuestion() {
  answered = false;
  var q = questions[qIndex];
  var total = questions.length;
  document.getElementById('qNum').textContent = qIndex + 1;
  document.getElementById('progressFill').style.width = (qIndex / total) * 100 + '%';
  document.getElementById('questionText').textContent = q.q;
  document.getElementById('nextBtn').classList.remove('show');

  var letters = ['A', 'B', 'C', 'D'];
  var cont = document.getElementById('optionsContainer');
  cont.innerHTML = '';
  q.opts.forEach(function (opt, i) {
    var btn = document.createElement('button');
    btn.className = 'option';
    btn.innerHTML = '<span class="opt-letter">' + letters[i] + '</span>' + opt;
    btn.onclick = function () { selectAnswer(i, cont); };
    cont.appendChild(btn);
  });
}

function selectAnswer(chosen, cont) {
  if (answered) return;
  answered = true;
  var q = questions[qIndex];
  userAnswers[q.origIdx] = chosen;
  var btns = cont.querySelectorAll('.option');
  btns.forEach(function (b) { b.disabled = true; });
  btns[chosen].style.borderColor = 'var(--primary)';
  btns[chosen].style.background = 'rgba(67,97,238,0.1)';
  btns[chosen].querySelector('.opt-letter').style.background = 'var(--primary)';
  btns[chosen].querySelector('.opt-letter').style.color = '#fff';
  var nb = document.getElementById('nextBtn');
  nb.textContent = qIndex + 1 < questions.length ? 'Keyingi savol →' : 'Testni yakunlash →';
  nb.classList.add('show');
}

function nextQuestion() {
  qIndex++;
  if (qIndex < questions.length) { renderQuestion(); }
  else { submitQuiz(); }
}

async function submitQuiz() {
  try {
    var res = await fetch(API + '/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, sinf: selectedSinf, testIdx: selectedTestIdx, answers: userAnswers }),
    });
    var data = await res.json();
    if (!res.ok) { alert(data.error || 'Xatolik yuz berdi'); return; }
    score = data.score;
    currentUser.results[data.key] = data.pct;
    currentUser.totalTests = (currentUser.totalTests || 0) + 1;
    currentUser.totalCorrect = (currentUser.totalCorrect || 0) + data.score;
    currentUser.totalQuestions = (currentUser.totalQuestions || 0) + data.total;
    showResult(data.score, data.total, data.pct);
  } catch (err) {
    alert('Server bilan aloqa xatosi.');
  }
}

function showResult(sc, total, pct) {
  var pass = pct >= 70;
  document.getElementById('resultPct').textContent = pct + '%';
  document.getElementById('statC').textContent = sc;
  document.getElementById('statW').textContent = total - sc;
  document.getElementById('statT').textContent = total;
  document.getElementById('resultRing').className = 'result-ring ' + (pass ? 'pass' : 'fail');
  document.getElementById('verdictTitle').textContent = pass ? '\uD83C\uDF89 Test muvaffaqiyatli topshirildi!' : '\uD83D\uDE14 Test topshirilmadi';
  document.getElementById('verdictText').textContent = pass
    ? "Ajoyib natija! " + total + " ta savoldan " + sc + " tasiga to'g'ri javob berdingiz."
    : "70% kerak, sizda " + pct + "% bo'ldi. Yana bir bor urinib ko'ring!";

  var cs = document.getElementById('certSection');
  if (pass) {
    cs.style.display = 'block';
    var t = DB[selectedSinf].tests[selectedTestIdx];
    generateCertificate(currentUser.name, pct, selectedSinf, t.title, t.topic);
  } else { cs.style.display = 'none'; }
  showScreen('resultScreen');
}

function goToNaz() { showScreen('nazScreen'); selectSinf(selectedSinf); }

// ═══════ CERTIFICATE ═══════
function generateCertificate(name, pct, sinf, testTitle, topic) {
  var canvas = document.getElementById('certCanvas');
  var W = 1100, H = 750;
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff9f0'; ctx.fillRect(0, 0, W, H);
  var bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 600);
  bg.addColorStop(0, 'rgba(67,97,238,0.04)'); bg.addColorStop(1, 'rgba(247,37,133,0.04)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  var bGrad = ctx.createLinearGradient(0, 0, W, H);
  bGrad.addColorStop(0, '#4361ee'); bGrad.addColorStop(0.5, '#f72585'); bGrad.addColorStop(1, '#4361ee');
  ctx.strokeStyle = bGrad; ctx.lineWidth = 8;
  roundRect(ctx, 16, 16, W - 32, H - 32, 24); ctx.stroke();

  ctx.strokeStyle = 'rgba(67,97,238,0.2)'; ctx.lineWidth = 2;
  roundRect(ctx, 30, 30, W - 60, H - 60, 18); ctx.stroke();

  ['tl', 'tr', 'bl', 'br'].forEach(function (pos) {
    var x = pos.includes('r') ? W - 55 : 55;
    var y = pos.includes('b') ? H - 55 : 55;
    var fx = pos.includes('r') ? -1 : 1;
    var fy = pos.includes('b') ? -1 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(fx, fy);
    ctx.strokeStyle = 'rgba(67,97,238,0.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 25); ctx.lineTo(0, 0); ctx.lineTo(25, 0); ctx.stroke();
    ctx.restore();
  });

  ctx.fillStyle = 'rgba(67,97,238,0.05)';
  for (var x = 60; x < W; x += 44) for (var y = 60; y < H; y += 44) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }

  ctx.font = '60px serif'; ctx.textAlign = 'center'; ctx.fillText('\uD83C\uDFC6', W / 2, 110);
  ctx.fillStyle = 'rgba(107,125,179,0.8)'; ctx.font = 'bold 13px Nunito, sans-serif'; ctx.letterSpacing = '5px'; ctx.fillText('SERTIFIKAT', W / 2, 150);

  var tGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  tGrad.addColorStop(0, '#4361ee'); tGrad.addColorStop(1, '#f72585');
  ctx.fillStyle = tGrad; ctx.font = 'bold 30px Georgia,serif'; ctx.letterSpacing = '0px';
  ctx.fillText("INFORMATIKA BO'YICHA TESTNI TOPSHIRGANLIK HAQIDA", W / 2, 190);

  ctx.strokeStyle = 'rgba(67,97,238,0.3)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W / 2 - 260, 210); ctx.lineTo(W / 2 + 260, 210); ctx.stroke();

  ctx.fillStyle = 'rgba(107,125,179,0.8)'; ctx.font = '18px Nunito,sans-serif'; ctx.fillText('Ushbu sertifikat', W / 2, 252);

  var nGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  nGrad.addColorStop(0, '#1a1a2e'); nGrad.addColorStop(1, '#4361ee');
  ctx.fillStyle = nGrad; ctx.font = 'bold 56px Georgia,serif'; ctx.fillText(name, W / 2, 322);

  var nW = ctx.measureText(name).width;
  var ulG = ctx.createLinearGradient(W / 2 - nW / 2, 0, W / 2 + nW / 2, 0);
  ulG.addColorStop(0, 'transparent'); ulG.addColorStop(0.5, '#4361ee'); ulG.addColorStop(1, 'transparent');
  ctx.strokeStyle = ulG; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2 - nW / 2, 334); ctx.lineTo(W / 2 + nW / 2, 334); ctx.stroke();

  ctx.fillStyle = 'rgba(107,125,179,0.8)'; ctx.font = '18px Nunito,sans-serif'; ctx.fillText('ga topshirildi', W / 2, 368);
  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 20px Nunito,sans-serif';
  ctx.fillText(sinf.toUpperCase() + ' — ' + testTitle, W / 2, 408);
  ctx.fillStyle = 'rgba(107,125,179,0.9)'; ctx.font = '16px Nunito,sans-serif'; ctx.fillText(topic, W / 2, 434);

  var bx = W / 2 - 90, by = 458, bw = 180, bh = 56;
  var badgeGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  badgeGrad.addColorStop(0, 'rgba(6,214,160,0.2)'); badgeGrad.addColorStop(1, 'rgba(67,97,238,0.2)');
  ctx.fillStyle = badgeGrad; roundRect(ctx, bx, by, bw, bh, 28); ctx.fill();
  ctx.strokeStyle = 'rgba(6,214,160,0.5)'; ctx.lineWidth = 2;
  roundRect(ctx, bx, by, bw, bh, 28); ctx.stroke();
  ctx.fillStyle = '#06d6a0'; ctx.font = 'bold 28px Nunito,sans-serif'; ctx.fillText('Natija: ' + pct + '%', W / 2, 494);

  ctx.strokeStyle = 'rgba(67,97,238,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 534); ctx.lineTo(W - 80, 534); ctx.stroke();

  var today = new Date();
  var dateStr = today.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.textAlign = 'left'; ctx.font = '13px Nunito,sans-serif'; ctx.fillStyle = 'rgba(107,125,179,0.8)';
  ctx.fillText('Berilgan sana:', 100, 570);
  ctx.font = 'bold 16px Nunito,sans-serif'; ctx.fillStyle = '#1a1a2e'; ctx.fillText(dateStr, 100, 592);

  ctx.textAlign = 'right'; ctx.font = '13px Nunito,sans-serif'; ctx.fillStyle = 'rgba(107,125,179,0.8)';
  ctx.fillText('Platforma:', W - 100, 570);
  ctx.font = 'bold 16px Nunito,sans-serif'; ctx.fillStyle = '#1a1a2e';
  ctx.fillText('InforTest — Informatika testi', W - 100, 592);

  // Location
  ctx.textAlign = 'center'; ctx.font = '11px Nunito,sans-serif'; ctx.fillStyle = 'rgba(107,125,179,0.6)';
  ctx.fillText("O'zbekiston, Namangan viloyati, Chortoq tumani, 6-maktab", W / 2, 620);

  ctx.font = '12px Nunito,sans-serif'; ctx.fillStyle = 'rgba(107,125,179,0.5)';
  ctx.fillText('ID: CERT-' + Math.random().toString(36).substr(2, 10).toUpperCase(), W / 2, 648);

  var img = new Image();
  img.src = canvas.toDataURL('image/png');
  img.style.borderRadius = '8px';
  var box = document.getElementById('certPreviewBox');
  box.innerHTML = ''; box.appendChild(img);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function downloadCert() {
  var canvas = document.getElementById('certCanvas');
  var t = DB[selectedSinf].tests[selectedTestIdx];
  var link = document.createElement('a');
  link.download = 'Sertifikat_' + currentUser.name.replace(/\s+/g, '_') + '_' + selectedSinf + '_' + t.title.replace(/\s+/g, '_') + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var a = document.querySelector('.screen.active');
  if (a.id === 'registerScreen') register();
  else if (a.id === 'loginScreen') login();
});
