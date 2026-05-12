const API = '';

let DB = {};
let currentUser = null;
let selectedSinf = null;
let selectedTestIdx = null;
let questions = [];
let qIndex = 0;
let score = 0;
let answered = false;
let userAnswers = [];

// Load questions from API on startup
(async function init() {
  try {
    const res = await fetch(API + '/api/quiz/questions');
    DB = await res.json();
  } catch (err) {
    console.error('Failed to load questions:', err);
  }
})();

// Navigation
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (s) {
    s.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
}

// Auth helpers
function showErr(id, msg) {
  var el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function () {
    el.classList.remove('show');
  }, 4000);
}

async function register() {
  var name = document.getElementById('regName').value.trim();
  var email = document.getElementById('regEmail').value.trim().toLowerCase();
  var pass = document.getElementById('regPass').value;

  if (!name) return showErr('regErr', 'Ismingizni kiriting.');
  if (!email.includes('@')) return showErr('regErr', "To'g'ri email kiriting.");
  if (pass.length < 6)
    return showErr('regErr', "Parol kamida 6 ta belgi bo'lishi kerak.");

  try {
    var res = await fetch(API + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, password: pass }),
    });
    var data = await res.json();
    if (!res.ok) return showErr('regErr', data.error);

    currentUser = data;
    buildSinfGrid();
    showScreen('sinfScreen');
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
    buildSinfGrid();
    showScreen('sinfScreen');
  } catch (err) {
    showErr('loginErr', 'Server bilan aloqa xatosi.');
  }
}

function logout() {
  currentUser = null;
  showScreen('welcomeScreen');
}

// Sinf grid
function buildSinfGrid() {
  document.getElementById('sinfGreet').textContent =
    'Salom, ' + currentUser.name + '! \uD83D\uDC4B';
  var grid = document.getElementById('sinfGrid');
  grid.innerHTML = '';
  Object.keys(DB).forEach(function (key) {
    var div = document.createElement('div');
    div.className = 'sinf-card';
    div.innerHTML =
      '<div class="sinf-num">' +
      key.replace('-sinf', '') +
      '</div><div class="sinf-lbl">sinf</div>';
    div.onclick = function () {
      selectSinf(key);
    };
    grid.appendChild(div);
  });
}

// Nazorat selection
function selectSinf(sinfKey) {
  selectedSinf = sinfKey;
  var sinf = DB[sinfKey];
  document.getElementById('bc1').textContent = sinf.label;
  document.getElementById('nazTitle').textContent =
    sinf.label + ' — nazorat ishini tanlang';

  var grid = document.getElementById('nazGrid');
  grid.innerHTML = '';
  sinf.tests.forEach(function (t, i) {
    var btn = document.createElement('div');
    btn.className = 'naz-btn';
    var key = sinfKey + '_' + i;
    var prev = currentUser.results[key];
    var prevHtml = '';
    if (prev != null) {
      prevHtml =
        '<div style="font-size:.72rem;margin-top:4px;color:' +
        (prev >= 70 ? '#027a5c' : '#9d0208') +
        ';font-weight:700">' +
        prev +
        '% — ' +
        (prev >= 70 ? "\u2713 O'tgan" : "\u2717 O'tmagan") +
        '</div>';
    }
    btn.innerHTML =
      '<div class="naz-n">' +
      t.title +
      '</div><div class="naz-t">' +
      t.topic +
      '</div>' +
      prevHtml;
    btn.onclick = function () {
      selectTest(i);
    };
    grid.appendChild(btn);
  });
  showScreen('nazScreen');
}

// Intro
function selectTest(idx) {
  selectedTestIdx = idx;
  var t = DB[selectedSinf].tests[idx];
  var total = t.questions.length;
  document.getElementById('introTitle').textContent =
    t.title + ' — Testga tayyormisiz?';
  document.getElementById('introDesc').textContent =
    'Jami ' +
    total +
    " ta savol. Savollar tasodifiy tartibda beriladi. Orqaga qaytib bo'lmaydi.\n\nSertifikat olish uchun 70% yoki undan yuqori natija kerak.";

  var key = selectedSinf + '_' + idx;
  var prev = currentUser.results[key];
  var prevEl = document.getElementById('introPrev');
  if (prev != null) {
    prevEl.innerHTML =
      '<div class="prev-box ' +
      (prev >= 70 ? 'pass' : 'fail') +
      '">Oldingi natijangiz: <strong>' +
      prev +
      '%</strong> — ' +
      (prev >= 70 ? "\u2713 Test o'tilgan" : "\u2717 Test o'tilmagan") +
      '</div>';
  } else {
    prevEl.innerHTML = '';
  }

  showScreen('introScreen');
}

// Quiz
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
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

  qIndex = 0;
  score = 0;
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
  document.getElementById('progressFill').style.width =
    (qIndex / total) * 100 + '%';
  document.getElementById('questionText').textContent = q.q;
  document.getElementById('nextBtn').classList.remove('show');

  var letters = ['A', 'B', 'C', 'D'];
  var cont = document.getElementById('optionsContainer');
  cont.innerHTML = '';
  q.opts.forEach(function (opt, i) {
    var btn = document.createElement('button');
    btn.className = 'option';
    btn.innerHTML = '<span class="opt-letter">' + letters[i] + '</span>' + opt;
    btn.onclick = function () {
      selectAnswer(i, cont);
    };
    cont.appendChild(btn);
  });
}

function selectAnswer(chosen, cont) {
  if (answered) return;
  answered = true;

  var q = questions[qIndex];
  userAnswers[q.origIdx] = chosen;

  var btns = cont.querySelectorAll('.option');
  btns.forEach(function (b) {
    b.disabled = true;
  });

  // We don't know the correct answer on client side, so just highlight selection
  btns[chosen].classList.add('selected');
  btns[chosen].style.borderColor = 'var(--primary)';
  btns[chosen].style.background = 'rgba(67,97,238,0.1)';
  btns[chosen].querySelector('.opt-letter').style.background = 'var(--primary)';
  btns[chosen].querySelector('.opt-letter').style.color = '#fff';

  var nb = document.getElementById('nextBtn');
  nb.textContent =
    qIndex + 1 < questions.length ? 'Keyingi savol →' : 'Testni yakunlash →';
  nb.classList.add('show');
}

function nextQuestion() {
  qIndex++;
  if (qIndex < questions.length) {
    renderQuestion();
  } else {
    submitQuiz();
  }
}

async function submitQuiz() {
  try {
    var res = await fetch(API + '/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        sinf: selectedSinf,
        testIdx: selectedTestIdx,
        answers: userAnswers,
      }),
    });
    var data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Xatolik yuz berdi');
      return;
    }

    score = data.score;
    var total = data.total;
    var pct = data.pct;
    currentUser.results[data.key] = pct;

    showResult(score, total, pct);
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
  document.getElementById('resultRing').className =
    'result-ring ' + (pass ? 'pass' : 'fail');
  document.getElementById('verdictTitle').textContent = pass
    ? '\uD83C\uDF89 Test muvaffaqiyatli topshirildi!'
    : '\uD83D\uDE14 Test topshirilmadi';
  document.getElementById('verdictText').textContent = pass
    ? "Ajoyib natija! " + total + " ta savoldan " + sc + " tasiga to'g'ri javob berdingiz."
    : "70% kerak, sizda " + pct + "% bo'ldi. Yana bir bor urinib ko'ring!";

  var cs = document.getElementById('certSection');
  if (pass) {
    cs.style.display = 'block';
    var t = DB[selectedSinf].tests[selectedTestIdx];
    generateCertificate(currentUser.name, pct, selectedSinf, t.title, t.topic);
  } else {
    cs.style.display = 'none';
  }

  showScreen('resultScreen');
}

function goToNaz() {
  showScreen('nazScreen');
  selectSinf(selectedSinf);
}

// Certificate
function generateCertificate(name, pct, sinf, testTitle, topic) {
  var canvas = document.getElementById('certCanvas');
  var W = 1100,
    H = 750;
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff9f0';
  ctx.fillRect(0, 0, W, H);

  var bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 600);
  bg.addColorStop(0, 'rgba(67,97,238,0.04)');
  bg.addColorStop(1, 'rgba(247,37,133,0.04)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  var bGrad = ctx.createLinearGradient(0, 0, W, H);
  bGrad.addColorStop(0, '#4361ee');
  bGrad.addColorStop(0.5, '#f72585');
  bGrad.addColorStop(1, '#4361ee');
  ctx.strokeStyle = bGrad;
  ctx.lineWidth = 8;
  roundRect(ctx, 16, 16, W - 32, H - 32, 24);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(67,97,238,0.2)';
  ctx.lineWidth = 2;
  roundRect(ctx, 30, 30, W - 60, H - 60, 18);
  ctx.stroke();

  ['tl', 'tr', 'bl', 'br'].forEach(function (pos) {
    var x = pos.includes('r') ? W - 55 : 55;
    var y = pos.includes('b') ? H - 55 : 55;
    var fx = pos.includes('r') ? -1 : 1;
    var fy = pos.includes('b') ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(fx, fy);
    ctx.strokeStyle = 'rgba(67,97,238,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 25);
    ctx.lineTo(0, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();
    ctx.restore();
  });

  ctx.fillStyle = 'rgba(67,97,238,0.05)';
  for (var x = 60; x < W; x += 44)
    for (var y = 60; y < H; y += 44) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

  ctx.font = '60px serif';
  ctx.textAlign = 'center';
  ctx.fillText('\uD83C\uDFC6', W / 2, 110);

  ctx.fillStyle = 'rgba(107,125,179,0.8)';
  ctx.font = 'bold 13px Nunito, sans-serif';
  ctx.letterSpacing = '5px';
  ctx.fillText('SERTIFIKAT', W / 2, 150);

  var tGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  tGrad.addColorStop(0, '#4361ee');
  tGrad.addColorStop(1, '#f72585');
  ctx.fillStyle = tGrad;
  ctx.font = 'bold 30px Georgia,serif';
  ctx.letterSpacing = '0px';
  ctx.fillText(
    "INFORMATIKA BO'YICHA TESTNI TOPSHIRGANLIK HAQIDA",
    W / 2,
    190
  );

  ctx.strokeStyle = 'rgba(67,97,238,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 260, 210);
  ctx.lineTo(W / 2 + 260, 210);
  ctx.stroke();

  ctx.fillStyle = 'rgba(107,125,179,0.8)';
  ctx.font = '18px Nunito,sans-serif';
  ctx.fillText('Ushbu sertifikat', W / 2, 252);

  var nGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  nGrad.addColorStop(0, '#1a1a2e');
  nGrad.addColorStop(1, '#4361ee');
  ctx.fillStyle = nGrad;
  ctx.font = 'bold 56px Georgia,serif';
  ctx.fillText(name, W / 2, 322);

  var nW = ctx.measureText(name).width;
  var ulG = ctx.createLinearGradient(W / 2 - nW / 2, 0, W / 2 + nW / 2, 0);
  ulG.addColorStop(0, 'transparent');
  ulG.addColorStop(0.5, '#4361ee');
  ulG.addColorStop(1, 'transparent');
  ctx.strokeStyle = ulG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - nW / 2, 334);
  ctx.lineTo(W / 2 + nW / 2, 334);
  ctx.stroke();

  ctx.fillStyle = 'rgba(107,125,179,0.8)';
  ctx.font = '18px Nunito,sans-serif';
  ctx.fillText('ga topshirildi', W / 2, 368);

  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 20px Nunito,sans-serif';
  ctx.fillText(sinf.toUpperCase() + ' — ' + testTitle, W / 2, 408);
  ctx.fillStyle = 'rgba(107,125,179,0.9)';
  ctx.font = '16px Nunito,sans-serif';
  ctx.fillText(topic, W / 2, 434);

  var bx = W / 2 - 90,
    by = 458,
    bw = 180,
    bh = 56;
  var badgeGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  badgeGrad.addColorStop(0, 'rgba(6,214,160,0.2)');
  badgeGrad.addColorStop(1, 'rgba(67,97,238,0.2)');
  ctx.fillStyle = badgeGrad;
  roundRect(ctx, bx, by, bw, bh, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(6,214,160,0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, bx, by, bw, bh, 28);
  ctx.stroke();
  ctx.fillStyle = '#06d6a0';
  ctx.font = 'bold 28px Nunito,sans-serif';
  ctx.fillText('Natija: ' + pct + '%', W / 2, 494);

  ctx.strokeStyle = 'rgba(67,97,238,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 534);
  ctx.lineTo(W - 80, 534);
  ctx.stroke();

  var today = new Date();
  var dateStr = today.toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  ctx.textAlign = 'left';
  ctx.font = '13px Nunito,sans-serif';
  ctx.fillStyle = 'rgba(107,125,179,0.8)';
  ctx.fillText('Berilgan sana:', 100, 570);
  ctx.font = 'bold 16px Nunito,sans-serif';
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText(dateStr, 100, 592);

  ctx.textAlign = 'right';
  ctx.font = '13px Nunito,sans-serif';
  ctx.fillStyle = 'rgba(107,125,179,0.8)';
  ctx.fillText('Platforma:', W - 100, 570);
  ctx.font = 'bold 16px Nunito,sans-serif';
  ctx.fillStyle = '#1a1a2e';
  ctx.fillText('InforTest — Informatika testi', W - 100, 592);

  ctx.textAlign = 'center';
  ctx.font = '12px Nunito,sans-serif';
  ctx.fillStyle = 'rgba(107,125,179,0.5)';
  ctx.fillText(
    'ID: CERT-' + Math.random().toString(36).substr(2, 10).toUpperCase(),
    W / 2,
    636
  );

  var img = new Image();
  img.src = canvas.toDataURL('image/png');
  img.style.borderRadius = '8px';
  var box = document.getElementById('certPreviewBox');
  box.innerHTML = '';
  box.appendChild(img);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function downloadCert() {
  var canvas = document.getElementById('certCanvas');
  var t = DB[selectedSinf].tests[selectedTestIdx];
  var link = document.createElement('a');
  link.download =
    'Sertifikat_' +
    currentUser.name.replace(/\s+/g, '_') +
    '_' +
    selectedSinf +
    '_' +
    t.title.replace(/\s+/g, '_') +
    '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Enter key support
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var a = document.querySelector('.screen.active');
  if (a.id === 'registerScreen') register();
  else if (a.id === 'loginScreen') login();
});
