var API = '';

var DB = {};
var currentUser = null;
var selectedSinf = null;
var selectedTestIdx = null;
var selectedSubject = 'informatika';
var questions = [];
var qIndex = 0;
var score = 0;
var answered = false;
var userAnswers = [];
var quizTimer = null;
var quizTimeLeft = 0;
var quizTotalTime = 0;
var leaderboardInterval = null;

var SUBJECT_NAMES = {
  informatika: 'Informatika',
  matematika: 'Matematika',
  fizika: 'Fizika',
  kimyo: 'Kimyo',
};

var SUBJECT_ICONS = {
  informatika: '💻',
  matematika: '📐',
  fizika: '🔬',
  kimyo: '🧪',
};

var ACCENT_COLORS = [
  { name: 'Ko\'k', value: '#4361ee' },
  { name: 'Binafsha', value: '#7209b7' },
  { name: 'Pushti', value: '#f72585' },
  { name: 'Yashil', value: '#06d6a0' },
  { name: 'To\'q sariq', value: '#f8961e' },
  { name: 'Qizil', value: '#ef233c' },
  { name: 'Ko\'k-yashil', value: '#00b4d8' },
  { name: 'Qovoq', value: '#e76f51' },
];

var ALL_ACHIEVEMENTS = [
  { id: 'first_test', icon: '🎯', name: 'Birinchi qadam', desc: 'Birinchi testni topshirish' },
  { id: 'test_5', icon: '📝', name: 'Faol o\'quvchi', desc: '5 ta test topshirish' },
  { id: 'test_10', icon: '🔥', name: 'Yonib turuvchi', desc: '10 ta test topshirish' },
  { id: 'test_25', icon: '💪', name: 'Chidamli', desc: '25 ta test topshirish' },
  { id: 'pass_5', icon: '⭐', name: 'Yulduz', desc: '5 ta testdan o\'tish (70%+)' },
  { id: 'pass_10', icon: '🌟', name: 'Super yulduz', desc: '10 ta testdan o\'tish (70%+)' },
  { id: 'genius', icon: '🧠', name: 'Daho', desc: 'O\'rtacha 90%+ natija' },
  { id: 'perfect', icon: '👑', name: 'Mukammal', desc: '100% natija olish' },
  { id: 'master', icon: '🏅', name: 'Usta', desc: 'Barcha testlardan o\'tish' },
  { id: 'streak_3', icon: '🔥', name: '3 kunlik streak', desc: '3 kun ketma-ket test topshirish' },
  { id: 'streak_7', icon: '💎', name: 'Haftalik streak', desc: '7 kun ketma-ket test topshirish' },
  { id: 'multi_subject', icon: '🌈', name: 'Ko\'p fanli', desc: '3 xil fandan test topshirish' },
  { id: 'level_5', icon: '🚀', name: 'Tajribali', desc: '5-darajaga yetish' },
  { id: 'level_10', icon: '🏆', name: 'Professori', desc: '10-darajaga yetish' },
];

async function loadSubjectQuestions(subject) {
  try {
    var res = await fetch(API + '/api/quiz/questions?subject=' + subject);
    return await res.json();
  } catch (err) {
    console.error('Failed to load questions for ' + subject + ':', err);
    return {};
  }
}

(async function init() {
  try {
    DB = await loadSubjectQuestions('informatika');
  } catch (err) {
    console.error('Failed to load questions:', err);
  }
  applyStoredSettings();
})();

function applyStoredSettings() {
  var theme = localStorage.getItem('theme');
  var accent = localStorage.getItem('accentColor');
  var fontSize = localStorage.getItem('fontSize');
  if (theme === 'dark') document.body.classList.add('dark');
  if (accent) document.documentElement.style.setProperty('--primary', accent);
  if (fontSize) {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add('font-' + fontSize);
  }
}

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

function showSuccess(id, msg) {
  var el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function () { el.classList.remove('show'); }, 4000);
}

function getGrade(pct) {
  if (pct >= 75) return 5;
  if (pct >= 60) return 4;
  if (pct >= 50) return 3;
  return 2;
}

function getGradeLabel(grade) {
  if (grade === 5) return 'A\'lo';
  if (grade === 4) return 'Yaxshi';
  if (grade === 3) return 'Qoniqarli';
  return 'Qoniqarsiz';
}

function getGradeColor(grade) {
  if (grade === 5) return '#06d6a0';
  if (grade === 4) return '#4361ee';
  if (grade === 3) return '#f8961e';
  return '#ef233c';
}

// ═══════ AUTH ═══════
async function register() {
  var name = document.getElementById('regName').value.trim();
  var login = document.getElementById('regLogin').value.trim().toLowerCase();
  var pass = document.getElementById('regPass').value;
  var school = document.getElementById('regSchool').value;
  var region = document.getElementById('regRegion').value;
  var grade = document.getElementById('regGrade').value;

  if (!name) return showErr('regErr', 'Ismingizni kiriting.');
  if (login.length < 3) return showErr('regErr', 'Login kamida 3 ta belgi.');
  if (pass.length < 6) return showErr('regErr', "Parol kamida 6 ta belgi bo'lishi kerak.");

  try {
    var res = await fetch(API + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, login: login, password: pass, school: school, region: region, grade: grade }),
    });
    var data = await res.json();
    if (!res.ok) return showErr('regErr', data.error);
    currentUser = data;
    applyUserSettings();
    showScreen('dashboardScreen');
  } catch (err) {
    showErr('regErr', 'Server bilan aloqa xatosi.');
  }
}

async function login() {
  var login = document.getElementById('loginLogin').value.trim().toLowerCase();
  var pass = document.getElementById('loginPass').value;
  try {
    var res = await fetch(API + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: login, password: pass }),
    });
    var data = await res.json();
    if (!res.ok) return showErr('loginErr', data.error);
    currentUser = data;
    applyUserSettings();
    showScreen('dashboardScreen');
  } catch (err) {
    showErr('loginErr', 'Server bilan aloqa xatosi.');
  }
}

function logout() {
  currentUser = null;
  document.body.classList.remove('dark');
  document.body.classList.remove('font-small', 'font-medium', 'font-large');
  document.documentElement.style.setProperty('--primary', '#4361ee');
  localStorage.removeItem('theme');
  localStorage.removeItem('accentColor');
  localStorage.removeItem('fontSize');
  showScreen('welcomeScreen');
}

function applyUserSettings() {
  if (!currentUser) return;
  if (currentUser.theme === 'dark') {
    document.body.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
  if (currentUser.accentColor) {
    document.documentElement.style.setProperty('--primary', currentUser.accentColor);
    localStorage.setItem('accentColor', currentUser.accentColor);
  }
  if (currentUser.fontSize) {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add('font-' + currentUser.fontSize);
    localStorage.setItem('fontSize', currentUser.fontSize);
  }
}

// ═══════ DASHBOARD ═══════
var TAB_TITLES = {
  subjects: '\uD83D\uDCDA Fanlar',
  stats: '\uD83D\uDCCA Statistika',
  history: '\uD83D\uDCCB Test tarixi',
  leaderboard: '\uD83C\uDFC5 Reyting',
  profile: '\uD83D\uDC64 Profil',
  settings: '\uD83C\uDFA8 Sozlamalar',
  achievements: '\uD83C\uDFC6 Yutuqlar',
  daily: '\uD83C\uDF1F Kunlik vazifa',
  games: '\uD83C\uDFAE Mini o\'yinlar',
  admin: '\u2699\uFE0F Admin',
};

function refreshDashboard() {
  if (!currentUser) return;
  document.getElementById('dashGreet').textContent = 'Salom, ' + currentUser.name + '! \uD83D\uDC4B';

  document.getElementById('sidebarName').textContent = currentUser.name;
  document.getElementById('sidebarLogin').textContent = '@' + (currentUser.login || '');

  var initials = currentUser.name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().substring(0, 2);
  document.getElementById('topbarAvatar').textContent = initials;

  var adminTab = document.getElementById('adminTab');
  if (currentUser.role === 'admin') {
    adminTab.style.display = '';
  } else {
    adminTab.style.display = 'none';
  }

  // Update XP/Level/Streak display
  var xpEl = document.getElementById('sidebarXP');
  if (xpEl) {
    var level = currentUser.level || 1;
    var xp = currentUser.xp || 0;
    var nextLevelXP = level * 100;
    var currentLevelXP = xp - ((level - 1) * 100);
    xpEl.innerHTML = '<div class="xp-badge">' +
      '<span class="xp-level">Lv.' + level + '</span>' +
      '<div class="xp-bar"><div class="xp-fill" style="width:' + Math.min((currentLevelXP / 100) * 100, 100) + '%"></div></div>' +
      '<span class="xp-text">' + xp + ' XP</span>' +
      '</div>';
  }
  var streakEl = document.getElementById('sidebarStreak');
  if (streakEl) {
    var streak = currentUser.streak || 0;
    streakEl.innerHTML = streak > 0 ? '<span class="streak-badge">\uD83D\uDD25 ' + streak + ' kun streak</span>' : '';
  }

  updateSubjectCards();
  updateProfileTab();
  updateStatsTab();
  initSettingsTab();
  loadDailyChallenge();
}

async function updateSubjectCards() {
  try {
    var res = await fetch(API + '/api/quiz/subjects');
    var data = await res.json();
    var grid = document.getElementById('subjectGrid');
    if (!grid) return;
    grid.innerHTML = '';

    var subjects = [
      { key: 'informatika', icon: '\uD83D\uDCBB', color: '#4361ee' },
      { key: 'matematika', icon: '\uD83D\uDCD0', color: '#7209b7' },
      { key: 'fizika', icon: '\uD83D\uDD2C', color: '#f72585' },
      { key: 'kimyo', icon: '\uD83E\uDDEA', color: '#06d6a0' },
    ];

    subjects.forEach(function (s) {
      var info = data[s.key];
      var div = document.createElement('div');
      div.className = 'subject-card';
      div.style.borderColor = s.color;
      div.innerHTML = '<div class="subj-icon">' + s.icon + '</div>' +
        '<div class="subj-name">' + SUBJECT_NAMES[s.key] + '</div>' +
        '<div class="subj-desc">' + (info ? info.grades.join(', ') + ' | ' + info.totalTests + ' ta test' : '') + '</div>';
      div.onclick = function () { selectSubject(s.key); };
      grid.appendChild(div);
    });
  } catch (err) {
    console.error('Subject cards error:', err);
  }
}

function showDashTab(tab, el) {
  var tabs = document.querySelectorAll('.dash-tab');
  tabs.forEach(function (t) { t.classList.remove('active-tab'); });
  document.getElementById('tab-' + tab).classList.add('active-tab');

  var navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(function (n) { n.classList.remove('active'); });
  if (el) el.classList.add('active');

  document.getElementById('topbarTitle').textContent = TAB_TITLES[tab] || tab;

  if (tab === 'leaderboard') { loadLeaderboard(); startLeaderboardAutoUpdate(); }
  if (tab === 'admin') loadAdmin();
  if (tab === 'stats') updateStatsTab();
  if (tab === 'profile') updateProfileTab();
  if (tab === 'settings') initSettingsTab();
  if (tab === 'achievements') renderAchievements();
  if (tab === 'history') renderHistory();
  if (tab === 'daily') loadDailyChallenge();

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

async function selectSubject(subject) {
  selectedSubject = subject;
  DB = await loadSubjectQuestions(subject);
  document.getElementById('sinfScreenTitle').textContent = SUBJECT_NAMES[subject] + ' — sinfingizni tanlang';
  buildSinfGrid();
  showScreen('sinfScreen');
}

// ═══════ DAILY CHALLENGE ═══════
async function loadDailyChallenge() {
  var container = document.getElementById('dailyChallengeContent');
  if (!container) return;
  try {
    var res = await fetch(API + '/api/quiz/daily-challenge');
    var data = await res.json();
    container.innerHTML = '<div class="daily-card">' +
      '<div class="daily-icon">\uD83C\uDF1F</div>' +
      '<h3>Bugungi vazifa</h3>' +
      '<div class="daily-info">' +
      '<div class="daily-subject"><span class="daily-label">Fan:</span> ' + SUBJECT_NAMES[data.subject] + ' ' + SUBJECT_ICONS[data.subject] + '</div>' +
      '<div class="daily-sinf"><span class="daily-label">Sinf:</span> ' + data.sinf + '</div>' +
      '<div class="daily-topic"><span class="daily-label">Mavzu:</span> ' + data.topic + '</div>' +
      '<div class="daily-questions"><span class="daily-label">Savollar:</span> ' + data.totalQuestions + ' ta</div>' +
      '<div class="daily-bonus">\uD83C\uDF81 Bonus: +' + data.bonusXP + ' XP</div>' +
      '</div>' +
      '<button class="btn btn-primary" onclick="startDailyChallenge(\'' + data.subject + '\',\'' + data.sinf + '\',' + data.testIdx + ')">Vazifani boshlash \u2192</button>' +
      '</div>';
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:var(--muted)">Yuklanmadi</p>';
  }
}

async function startDailyChallenge(subject, sinf, testIdx) {
  selectedSubject = subject;
  DB = await loadSubjectQuestions(subject);
  selectedSinf = sinf;
  selectedTestIdx = testIdx;
  var t = DB[sinf].tests[testIdx];
  document.getElementById('introTitle').textContent = '\uD83C\uDF1F Kunlik vazifa — ' + t.title;
  document.getElementById('introDesc').textContent = SUBJECT_NAMES[subject] + ' | ' + sinf + '\nJami ' + t.questions.length + " ta savol.\n\nBonus: +25 XP!";
  var prevEl = document.getElementById('introPrev');
  prevEl.innerHTML = '';
  showScreen('introScreen');
}

// ═══════ PROFILE ═══════
function updateProfileTab() {
  if (!currentUser) return;
  var initials = currentUser.name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().substring(0, 2);
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileLogin').textContent = '@' + (currentUser.login || '');
  document.getElementById('profileSchool').textContent = currentUser.school ? '\uD83C\uDFEB ' + currentUser.school : '';
  document.getElementById('profileRegion').textContent = currentUser.region ? '\uD83D\uDCCD ' + currentUser.region : '';
  document.getElementById('profileGrade').textContent = currentUser.grade ? '\uD83D\uDCDA ' + currentUser.grade : '';
  if (currentUser.createdAt) {
    var d = new Date(currentUser.createdAt);
    document.getElementById('profileJoined').textContent = '\uD83D\uDCC5 Qo\'shilgan: ' + d.toLocaleDateString();
  }
  document.getElementById('profTests').textContent = currentUser.totalTests || 0;
  document.getElementById('profCorrect').textContent = currentUser.totalCorrect || 0;
  var avg = currentUser.totalQuestions > 0 ? Math.round((currentUser.totalCorrect / currentUser.totalQuestions) * 100) : 0;
  document.getElementById('profAvg').textContent = avg + '%';

  // XP & Level in profile
  var profLevel = document.getElementById('profLevel');
  var profXP = document.getElementById('profXP');
  var profStreak = document.getElementById('profStreak');
  if (profLevel) profLevel.textContent = currentUser.level || 1;
  if (profXP) profXP.textContent = (currentUser.xp || 0) + ' XP';
  if (profStreak) profStreak.textContent = (currentUser.streak || 0) + ' kun';
}

function toggleEditProfile() {
  var form = document.getElementById('editProfileForm');
  if (form.style.display === 'none') {
    form.style.display = 'block';
    document.getElementById('editName').value = currentUser.name || '';
    document.getElementById('editSchool').value = currentUser.school || '';
    document.getElementById('editRegion').value = currentUser.region || '';
    document.getElementById('editGrade').value = currentUser.grade || '';
  } else {
    form.style.display = 'none';
  }
}

async function saveProfile() {
  var name = document.getElementById('editName').value.trim();
  var school = document.getElementById('editSchool').value.trim();
  var region = document.getElementById('editRegion').value;
  var grade = document.getElementById('editGrade').value;

  if (!name) return showErr('editErr', 'Ismingizni kiriting.');

  try {
    var res = await fetch(API + '/api/auth/profile/' + currentUser.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, school: school, region: region, grade: grade }),
    });
    var data = await res.json();
    if (!res.ok) return showErr('editErr', data.error);
    currentUser = data;
    updateProfileTab();
    showSuccess('editMsg', "Profil muvaffaqiyatli yangilandi!");
  } catch (err) {
    showErr('editErr', 'Server bilan aloqa xatosi.');
  }
}

function toggleChangePassword() {
  var form = document.getElementById('changePasswordForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function changePassword() {
  var cur = document.getElementById('curPass').value;
  var newP = document.getElementById('newPass').value;

  if (!cur) return showErr('passErr', 'Joriy parolni kiriting.');
  if (newP.length < 6) return showErr('passErr', "Yangi parol kamida 6 ta belgi bo'lishi kerak.");

  try {
    var res = await fetch(API + '/api/auth/password/' + currentUser.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: cur, newPassword: newP }),
    });
    var data = await res.json();
    if (!res.ok) return showErr('passErr', data.error);
    showSuccess('passMsg', data.message);
    document.getElementById('curPass').value = '';
    document.getElementById('newPass').value = '';
  } catch (err) {
    showErr('passErr', 'Server bilan aloqa xatosi.');
  }
}

// ═══════ SETTINGS ═══════
function initSettingsTab() {
  if (!currentUser) return;

  var toggle = document.getElementById('themeToggle');
  if (document.body.classList.contains('dark')) {
    toggle.classList.add('on');
  } else {
    toggle.classList.remove('on');
  }

  var picker = document.getElementById('colorPicker');
  picker.innerHTML = '';
  var currentAccent = currentUser.accentColor || '#4361ee';
  ACCENT_COLORS.forEach(function (c) {
    var swatch = document.createElement('div');
    swatch.className = 'color-swatch' + (c.value === currentAccent ? ' active' : '');
    swatch.style.background = c.value;
    swatch.title = c.name;
    swatch.onclick = function () { setAccentColor(c.value); };
    picker.appendChild(swatch);
  });

  var fsBtns = document.querySelectorAll('.font-size-btn');
  var currentFS = currentUser.fontSize || 'medium';
  fsBtns.forEach(function (btn) {
    btn.classList.remove('active');
    var size = btn.textContent === 'Kichik' ? 'small' : btn.textContent === 'Katta' ? 'large' : 'medium';
    if (size === currentFS) btn.classList.add('active');
  });
}

function toggleTheme() {
  var isDark = document.body.classList.toggle('dark');
  document.getElementById('themeToggle').classList.toggle('on');
  var theme = isDark ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
  if (currentUser) {
    currentUser.theme = theme;
    saveSettings({ theme: theme });
  }
}

function setAccentColor(color) {
  document.documentElement.style.setProperty('--primary', color);
  localStorage.setItem('accentColor', color);
  if (currentUser) {
    currentUser.accentColor = color;
    saveSettings({ accentColor: color });
  }
  initSettingsTab();
}

function setFontSize(size) {
  document.body.classList.remove('font-small', 'font-medium', 'font-large');
  document.body.classList.add('font-' + size);
  localStorage.setItem('fontSize', size);
  if (currentUser) {
    currentUser.fontSize = size;
    saveSettings({ fontSize: size });
  }
  var fsBtns = document.querySelectorAll('.font-size-btn');
  fsBtns.forEach(function (btn) {
    btn.classList.remove('active');
    var s = btn.textContent === 'Kichik' ? 'small' : btn.textContent === 'Katta' ? 'large' : 'medium';
    if (s === size) btn.classList.add('active');
  });
}

async function saveSettings(settings) {
  try {
    await fetch(API + '/api/auth/settings/' + currentUser.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  } catch (err) {
    console.error('Settings save error:', err);
  }
}

// ═══════ ACHIEVEMENTS ═══════
function renderAchievements() {
  if (!currentUser) return;
  var grid = document.getElementById('achGrid');
  grid.innerHTML = '';
  var earned = currentUser.achievements || [];

  ALL_ACHIEVEMENTS.forEach(function (a) {
    var isEarned = earned.indexOf(a.id) >= 0;
    var div = document.createElement('div');
    div.className = 'ach-card ' + (isEarned ? 'earned' : 'locked');
    div.innerHTML = '<div class="ach-icon">' + a.icon + '</div>' +
      '<div class="ach-name">' + a.name + '</div>' +
      '<div class="ach-desc">' + a.desc + '</div>';
    grid.appendChild(div);
  });
}

// ═══════ HISTORY ═══════
function renderHistory() {
  if (!currentUser) return;
  var list = document.getElementById('historyList');
  list.innerHTML = '';
  var history = currentUser.testHistory || [];

  if (history.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);font-size:.88rem;text-align:center;margin-top:16px">Hali test topshirmadingiz</p>';
    return;
  }

  var sorted = history.slice().reverse();
  sorted.forEach(function (h) {
    var pass = h.pct >= 70;
    var d = new Date(h.date);
    var dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var subjectName = SUBJECT_NAMES[h.subject] || SUBJECT_NAMES.informatika;
    var subjectIcon = SUBJECT_ICONS[h.subject] || SUBJECT_ICONS.informatika;
    var div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = '<div class="hi-info">' +
      '<div class="hi-title">' + subjectIcon + ' ' + subjectName + ' | ' + h.sinf + ' — ' + h.testTitle + '</div>' +
      '<div class="hi-meta">' + h.topic + ' | ' + dateStr + '</div>' +
      '</div>' +
      '<div class="hi-pct ' + (pass ? 'pass' : 'fail') + '">' + h.pct + '%</div>';
    list.appendChild(div);
  });
}

// ═══════ STATS ═══════
function updateStatsTab() {
  if (!currentUser) return;
  document.getElementById('myTests').textContent = currentUser.totalTests || 0;
  document.getElementById('myCorrect').textContent = currentUser.totalCorrect || 0;
  var avg = currentUser.totalQuestions > 0 ? Math.round((currentUser.totalCorrect / currentUser.totalQuestions) * 100) : 0;
  document.getElementById('myAvg').textContent = avg + '%';

  // Subject-specific stats
  var subjectStats = {};
  var history = currentUser.testHistory || [];
  history.forEach(function (h) {
    var subj = h.subject || 'informatika';
    if (!subjectStats[subj]) subjectStats[subj] = { tests: 0, correct: 0, total: 0 };
    subjectStats[subj].tests++;
    subjectStats[subj].correct += h.score;
    subjectStats[subj].total += h.total;
  });

  var subjStatsEl = document.getElementById('subjectStatsGrid');
  if (subjStatsEl) {
    var html = '';
    Object.keys(SUBJECT_NAMES).forEach(function (key) {
      var s = subjectStats[key] || { tests: 0, correct: 0, total: 0 };
      var pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      html += '<div class="stat-card subject-stat">' +
        '<span class="stat-icon">' + SUBJECT_ICONS[key] + '</span>' +
        '<span class="val">' + pct + '%</span>' +
        '<span class="lbl">' + SUBJECT_NAMES[key] + ' (' + s.tests + ' test)</span>' +
        '</div>';
    });
    subjStatsEl.innerHTML = html;
  }

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
      var pass = pct >= 70;
      var div = document.createElement('div');
      div.className = 'prev-box ' + (pass ? 'pass' : 'fail');
      div.innerHTML = '<strong>' + key + '</strong>: ' + pct + '% \u2014 ' + (pass ? "\u2713 O'tgan" : "\u2717 O'tmagan");
      list.appendChild(div);
    });
  }
}

// ═══════ LEADERBOARD ═══════
async function loadLeaderboard() {
  var container = document.getElementById('leaderboardContent');
  if (!container) return;
  try {
    var res = await fetch(API + '/api/quiz/leaderboard');
    var data = await res.json();

    // Apply student grade filter
    var filterEl = document.getElementById('leaderboardGradeFilter');
    var filterVal = filterEl ? filterEl.value : '';
    if (filterVal) {
      data = data.filter(function (u) {
        if (!u.grade) return false;
        var gradeNum = u.grade.replace(/\D/g, '').replace(/-.*/, '');
        if (!gradeNum) gradeNum = u.grade.split('-')[0];
        return gradeNum === filterVal || u.grade === filterVal || u.grade.indexOf(filterVal + '-') === 0;
      });
    }

    // Apply test sinf filter (which class's tests they solved)
    var testSinfEl = document.getElementById('leaderboardTestSinfFilter');
    var testSinfVal = testSinfEl ? testSinfEl.value : '';
    if (testSinfVal) {
      data = data.filter(function (u) {
        return u.sinfs && u.sinfs[testSinfVal] && u.sinfs[testSinfVal].count > 0;
      });
    }

    // Apply subject filter
    var subjectEl = document.getElementById('leaderboardSubjectFilter');
    var subjectVal = subjectEl ? subjectEl.value : '';
    if (subjectVal) {
      data = data.filter(function (u) {
        return u.subjects && u.subjects[subjectVal] && u.subjects[subjectVal].count > 0;
      });
    }

    // Apply nazorat ishi filter
    var testEl = document.getElementById('leaderboardTestFilter');
    var testVal = testEl ? testEl.value : '';
    if (testVal) {
      data = data.filter(function (u) {
        return u.tests && u.tests[testVal] && u.tests[testVal].count > 0;
      });
    }

    // Re-sort and re-rank after filtering
    data.sort(function (a, b) { return b.avgPct - a.avgPct; });
    data.forEach(function (u, i) { u.rank = i + 1; });

    var hasFilter = filterVal || testSinfVal || subjectVal || testVal;
    if (data.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--muted)">' + (hasFilter ? 'Filtr bo\'yicha natijalar topilmadi' : 'Hali hech kim test topshirmadi') + '</p>';
      return;
    }

    var subjectNames = {informatika:'Inf',matematika:'Mat',fizika:'Fiz',kimyo:'Kim'};
    var subjectIcons = {informatika:'\uD83D\uDCBB',matematika:'\uD83D\uDCD0',fizika:'\uD83D\uDD2C',kimyo:'\uD83E\uDDEA'};

    var html = '<div style="overflow-x:auto"><table class="lb-table"><thead><tr><th>#</th><th>Ism</th><th>Sinf</th><th>Testlar</th>';
    html += '<th>\uD83D\uDCBB Inf</th><th>\uD83D\uDCD0 Mat</th><th>\uD83D\uDD2C Fiz</th><th>\uD83E\uDDEA Kim</th>';
    if (testSinfVal) html += '<th>' + testSinfVal + '-sinf</th>';
    if (testVal) html += '<th>' + testVal + '-NI</th>';
    html += '<th>Natija</th><th>Baho</th></tr></thead><tbody>';

    data.forEach(function (u) {
      var rankClass = u.rank === 1 ? 'gold' : u.rank === 2 ? 'silver' : u.rank === 3 ? 'bronze' : '';
      var medal = u.rank === 1 ? '\uD83E\uDD47' : u.rank === 2 ? '\uD83E\uDD48' : u.rank === 3 ? '\uD83E\uDD49' : u.rank;
      var grade = getGrade(u.avgPct);
      var gradeColor = getGradeColor(grade);

      var infC = u.subjects && u.subjects.informatika ? u.subjects.informatika.count : 0;
      var matC = u.subjects && u.subjects.matematika ? u.subjects.matematika.count : 0;
      var fizC = u.subjects && u.subjects.fizika ? u.subjects.fizika.count : 0;
      var kimC = u.subjects && u.subjects.kimyo ? u.subjects.kimyo.count : 0;

      html += '<tr class="lb-row">';
      html += '<td><span class="lb-rank ' + rankClass + '">' + medal + '</span></td>';
      html += '<td>' + u.name + '</td>';
      html += '<td><span style="font-weight:700;color:var(--primary)">' + (u.grade || '\u2014') + '</span></td>';
      html += '<td><strong>' + u.totalTests + '</strong></td>';
      html += '<td>' + (infC > 0 ? infC : '\u2014') + '</td>';
      html += '<td>' + (matC > 0 ? matC : '\u2014') + '</td>';
      html += '<td>' + (fizC > 0 ? fizC : '\u2014') + '</td>';
      html += '<td>' + (kimC > 0 ? kimC : '\u2014') + '</td>';
      if (testSinfVal) {
        var sinfInfo = u.sinfs && u.sinfs[testSinfVal] ? u.sinfs[testSinfVal] : null;
        html += '<td>' + (sinfInfo ? sinfInfo.count + ' (' + sinfInfo.avg + '%)' : '\u2014') + '</td>';
      }
      if (testVal) {
        var testInfo = u.tests && u.tests[testVal] ? u.tests[testVal] : null;
        html += '<td>' + (testInfo ? testInfo.count + ' (' + testInfo.avg + '%)' : '\u2014') + '</td>';
      }
      html += '<td><strong>' + u.avgPct + '%</strong></td>';
      html += '<td><span style="display:inline-block;padding:4px 12px;border-radius:8px;font-weight:800;color:#fff;background:' + gradeColor + '">' + grade + '</span></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:var(--red)">Xatolik yuz berdi</p>';
  }
}

function startLeaderboardAutoUpdate() {
  if (leaderboardInterval) clearInterval(leaderboardInterval);
  leaderboardInterval = setInterval(function () {
    var lbTab = document.getElementById('tab-leaderboard');
    if (lbTab && lbTab.classList.contains('active-tab')) {
      loadLeaderboard();
    } else {
      clearInterval(leaderboardInterval);
      leaderboardInterval = null;
    }
  }, 10000);
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
        html += '<div class="admin-user-row"><span class="name">' + u.name + '</span><span class="meta">' + (u.school || '\u2014') + ' | ' + d.toLocaleDateString() + '</span></div>';
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
      html += '<div><span class="name">' + u.name + '</span><br><span class="meta">' + (u.login || '\u2014') + ' | ' + (u.school || '\u2014') + ' | ' + (u.grade || '\u2014') + ' | Tests: ' + u.totalTests + ' | Avg: ' + u.avgPct + '%</span></div>';
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
  document.getElementById('sinfGreet').textContent = SUBJECT_ICONS[selectedSubject] + ' ' + SUBJECT_NAMES[selectedSubject];
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
  document.getElementById('bc1').textContent = SUBJECT_NAMES[selectedSubject] + ' > ' + sinf.label;
  document.getElementById('nazTitle').textContent = sinf.label + ' \u2014 nazorat ishini tanlang';

  var grid = document.getElementById('nazGrid');
  grid.innerHTML = '';
  sinf.tests.forEach(function (t, i) {
    var btn = document.createElement('div');
    btn.className = 'naz-btn';
    var key = selectedSubject + '_' + sinfKey + '_' + i;
    var prev = currentUser.results[key];
    var prevHtml = '';
    if (prev != null) {
      prevHtml = '<div style="font-size:.72rem;margin-top:4px;color:' + (prev >= 70 ? '#027a5c' : '#9d0208') + ';font-weight:700">' + prev + '% \u2014 ' + (prev >= 70 ? "\u2713 O'tgan" : "\u2717 O'tmagan") + '</div>';
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
  document.getElementById('introTitle').textContent = SUBJECT_NAMES[selectedSubject] + ' | ' + t.title + ' \u2014 Testga tayyormisiz?';
  document.getElementById('introDesc').textContent = 'Jami ' + total + " ta savol. Har savol uchun 30 soniya vaqt beriladi.\n\nSertifikat olish uchun 70% yoki undan yuqori natija kerak.";

  var key = selectedSubject + '_' + selectedSinf + '_' + idx;
  var prev = currentUser.results[key];
  var prevEl = document.getElementById('introPrev');
  if (prev != null) {
    prevEl.innerHTML = '<div class="prev-box ' + (prev >= 70 ? 'pass' : 'fail') + '">Oldingi natijangiz: <strong>' + prev + '%</strong> \u2014 ' + (prev >= 70 ? "\u2713 Test o'tilgan" : "\u2717 Test o'tilmagan") + '</div>';
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
  document.getElementById('quizSubjectBadge').textContent = SUBJECT_ICONS[selectedSubject] + ' ' + SUBJECT_NAMES[selectedSubject];
  showScreen('quizScreen');
  renderQuestion();
}

function startTimer() {
  if (quizTimer) clearInterval(quizTimer);
  quizTimeLeft = 30;
  quizTotalTime = 30;
  updateTimerDisplay();
  quizTimer = setInterval(function () {
    quizTimeLeft--;
    updateTimerDisplay();
    if (quizTimeLeft <= 0) {
      clearInterval(quizTimer);
      if (!answered) {
        autoSkip();
      }
    }
  }, 1000);
}

function updateTimerDisplay() {
  var timerEl = document.getElementById('quizTimer');
  if (timerEl) {
    var pct = (quizTimeLeft / quizTotalTime) * 100;
    var color = quizTimeLeft <= 5 ? '#ef233c' : quizTimeLeft <= 10 ? '#f8961e' : '#06d6a0';
    timerEl.innerHTML = '<div class="timer-ring" style="--pct:' + pct + '%;--timer-color:' + color + '">' +
      '<span class="timer-num">' + quizTimeLeft + '</span>' +
      '</div>';
  }
}

function autoSkip() {
  answered = true;
  var q = questions[qIndex];
  userAnswers[q.origIdx] = -1;
  var cont = document.getElementById('optionsContainer');
  var btns = cont.querySelectorAll('.option');
  btns.forEach(function (b) { b.disabled = true; });
  var nb = document.getElementById('nextBtn');
  nb.textContent = qIndex + 1 < questions.length ? 'Keyingi savol \u2192' : 'Testni yakunlash \u2192';
  nb.style.display = 'block';
}

function renderQuestion() {
  answered = false;
  var q = questions[qIndex];
  var total = questions.length;
  document.getElementById('qNum').textContent = qIndex + 1;
  document.getElementById('progressFill').style.width = (qIndex / total) * 100 + '%';
  document.getElementById('questionText').textContent = q.q;
  document.getElementById('nextBtn').style.display = 'none';

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

  startTimer();
}

function selectAnswer(chosen, cont) {
  if (answered) return;
  answered = true;
  if (quizTimer) clearInterval(quizTimer);
  quizTimer = null;
  // Show timer stopped visually
  var timerEl = document.getElementById('quizTimer');
  if (timerEl) {
    timerEl.innerHTML = '<div class="timer-ring timer-stopped" style="--pct:100%;--timer-color:#4361ee"><span class="timer-num">\u2713</span></div>';
  }
  var q = questions[qIndex];
  userAnswers[q.origIdx] = chosen;
  var btns = cont.querySelectorAll('.option');
  btns.forEach(function (b) { b.disabled = true; });
  btns[chosen].style.borderColor = 'var(--primary)';
  btns[chosen].style.background = 'rgba(67,97,238,0.1)';
  btns[chosen].querySelector('.opt-letter').style.background = 'var(--primary)';
  btns[chosen].querySelector('.opt-letter').style.color = '#fff';
  var nb = document.getElementById('nextBtn');
  nb.textContent = qIndex + 1 < questions.length ? 'Keyingi savol \u2192' : 'Testni yakunlash \u2192';
  nb.style.display = 'block';
}

function nextQuestion() {
  qIndex++;
  if (qIndex < questions.length) { renderQuestion(); }
  else { submitQuiz(); }
}

async function submitQuiz() {
  if (quizTimer) clearInterval(quizTimer);
  try {
    var res = await fetch(API + '/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, sinf: selectedSinf, testIdx: selectedTestIdx, answers: userAnswers, subject: selectedSubject }),
    });
    var data = await res.json();
    if (!res.ok) { alert(data.error || 'Xatolik yuz berdi'); return; }
    score = data.score;
    currentUser.results[data.key] = data.pct;
    currentUser.totalTests = (currentUser.totalTests || 0) + 1;
    currentUser.totalCorrect = (currentUser.totalCorrect || 0) + data.score;
    currentUser.totalQuestions = (currentUser.totalQuestions || 0) + data.total;
    currentUser.xp = data.xp || currentUser.xp;
    currentUser.level = data.level || currentUser.level;
    currentUser.streak = data.streak || currentUser.streak;
    var t = DB[selectedSinf].tests[selectedTestIdx];
    if (!currentUser.testHistory) currentUser.testHistory = [];
    currentUser.testHistory.push({ sinf: selectedSinf, testIdx: selectedTestIdx, testTitle: t.title, topic: t.topic, subject: selectedSubject, score: data.score, total: data.total, pct: data.pct, date: new Date().toISOString() });
    try {
      var pRes = await fetch(API + '/api/auth/profile/' + currentUser.id);
      var pData = await pRes.json();
      if (pRes.ok) currentUser = pData;
    } catch (e) {}
    showResult(data.score, data.total, data.pct, data.xpEarned, data.streak);
  } catch (err) {
    alert('Server bilan aloqa xatosi.');
  }
}

function showResult(sc, total, pct, xpEarned, streak) {
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

  // XP & streak info
  var xpInfo = document.getElementById('resultXPInfo');
  if (xpInfo) {
    xpInfo.innerHTML = '<div class="result-badges">' +
      '<span class="result-xp">+' + (xpEarned || 0) + ' XP</span>' +
      '<span class="result-level">Lv.' + (currentUser.level || 1) + '</span>' +
      (streak > 1 ? '<span class="result-streak">\uD83D\uDD25 ' + streak + ' kun streak!</span>' : '') +
      '</div>';
  }

  // Grade badge
  var gradeBadge = document.getElementById('resultGradeBadge');
  if (gradeBadge) {
    var rGrade = getGrade(pct);
    var rColor = getGradeColor(rGrade);
    var rLabel = getGradeLabel(rGrade);
    gradeBadge.innerHTML = '<span style="display:inline-block;padding:8px 24px;border-radius:12px;font-weight:900;font-size:1.3rem;color:#fff;background:' + rColor + ';box-shadow:0 4px 15px ' + rColor + '40">' + rLabel + ' (' + rGrade + ')</span>';
  }

  var cs = document.getElementById('certSection');
  if (pass) {
    cs.style.display = 'block';
    var t = DB[selectedSinf].tests[selectedTestIdx];
    generateCertificate(currentUser.name, pct, selectedSinf, t.title, t.topic);
    // Confetti effect
    launchConfetti();
  } else { cs.style.display = 'none'; }
  showScreen('resultScreen');
}

// ═══════ CONFETTI ═══════
function launchConfetti() {
  var colors = ['#4361ee', '#f72585', '#7209b7', '#06d6a0', '#f8961e', '#ef233c'];
  var container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  for (var i = 0; i < 50; i++) {
    var piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 2 + 's';
    piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
    container.appendChild(piece);
  }

  setTimeout(function () {
    container.remove();
  }, 5000);
}

function goToNaz() { showScreen('nazScreen'); selectSinf(selectedSinf); }

// ═══════ CERTIFICATE ═══════
function generateCertificate(name, pct, sinf, testTitle, topic) {
  var canvas = document.getElementById('certCanvas');
  var W = 1100, H = 800;
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d');

  var grade = getGrade(pct);
  var gradeLabel = getGradeLabel(grade);
  var gradeColor = getGradeColor(grade);

  // Grade-based color themes
  var themes = {
    5: { bg1: '#f0fdf4', bg2: 'rgba(6,214,160,0.06)', border1: '#06d6a0', border2: '#10b981', accent: '#059669', star: 5 },
    4: { bg1: '#eff6ff', bg2: 'rgba(67,97,238,0.06)', border1: '#4361ee', border2: '#3a0ca3', accent: '#4361ee', star: 3 },
    3: { bg1: '#fffbeb', bg2: 'rgba(248,150,30,0.06)', border1: '#f8961e', border2: '#e67e22', accent: '#d97706', star: 2 },
    2: { bg1: '#fef2f2', bg2: 'rgba(239,35,60,0.06)', border1: '#ef233c', border2: '#dc2626', accent: '#dc2626', star: 0 },
  };
  var th = themes[grade];

  ctx.fillStyle = th.bg1; ctx.fillRect(0, 0, W, H);
  var bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 600);
  bg.addColorStop(0, th.bg2); bg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  var bGrad = ctx.createLinearGradient(0, 0, W, H);
  bGrad.addColorStop(0, th.border1); bGrad.addColorStop(0.5, th.border2); bGrad.addColorStop(1, th.border1);
  ctx.strokeStyle = bGrad; ctx.lineWidth = 10;
  roundRect(ctx, 12, 12, W - 24, H - 24, 28); ctx.stroke();

  ctx.strokeStyle = th.border1 + '33'; ctx.lineWidth = 2;
  roundRect(ctx, 28, 28, W - 56, H - 56, 20); ctx.stroke();

  ['tl', 'tr', 'bl', 'br'].forEach(function (pos) {
    var x = pos.includes('r') ? W - 55 : 55;
    var y = pos.includes('b') ? H - 55 : 55;
    var fx = pos.includes('r') ? -1 : 1;
    var fy = pos.includes('b') ? -1 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(fx, fy);
    ctx.strokeStyle = th.border1 + '99'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 0); ctx.lineTo(30, 0); ctx.stroke();
    ctx.restore();
  });

  ctx.fillStyle = th.border1 + '0D';
  for (var xx = 60; xx < W; xx += 44) for (var yy = 60; yy < H; yy += 44) { ctx.beginPath(); ctx.arc(xx, yy, 2, 0, Math.PI * 2); ctx.fill(); }

  // Stars based on grade
  var stars = '';
  for (var s = 0; s < th.star; s++) stars += '\u2B50';
  if (stars) {
    ctx.font = '36px serif'; ctx.textAlign = 'center'; ctx.fillText(stars, W / 2, 85);
  }

  ctx.font = '48px serif'; ctx.textAlign = 'center'; ctx.fillText('\uD83C\uDFC6', W / 2, 130);

  ctx.fillStyle = th.accent; ctx.font = 'bold 14px Nunito, sans-serif'; ctx.fillText('SERTIFIKAT', W / 2, 165);

  var subjectName = SUBJECT_NAMES[selectedSubject] || 'Informatika';
  var tGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  tGrad.addColorStop(0, th.border1); tGrad.addColorStop(1, th.border2);
  ctx.fillStyle = tGrad; ctx.font = 'bold 26px Georgia,serif';
  ctx.fillText(subjectName.toUpperCase() + " BO'YICHA TESTNI TOPSHIRGANLIK HAQIDA", W / 2, 205);

  ctx.strokeStyle = th.border1 + '4D'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W / 2 - 260, 225); ctx.lineTo(W / 2 + 260, 225); ctx.stroke();

  ctx.fillStyle = 'rgba(107,125,179,0.8)'; ctx.font = '18px Nunito,sans-serif'; ctx.fillText('Ushbu sertifikat', W / 2, 265);

  var nGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  nGrad.addColorStop(0, '#1a1a2e'); nGrad.addColorStop(1, th.accent);
  ctx.fillStyle = nGrad; ctx.font = 'bold 52px Georgia,serif'; ctx.fillText(name, W / 2, 330);

  var nW = ctx.measureText(name).width;
  var ulG = ctx.createLinearGradient(W / 2 - nW / 2, 0, W / 2 + nW / 2, 0);
  ulG.addColorStop(0, 'transparent'); ulG.addColorStop(0.5, th.accent); ulG.addColorStop(1, 'transparent');
  ctx.strokeStyle = ulG; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2 - nW / 2, 342); ctx.lineTo(W / 2 + nW / 2, 342); ctx.stroke();

  ctx.fillStyle = 'rgba(107,125,179,0.8)'; ctx.font = '18px Nunito,sans-serif'; ctx.fillText('ga topshirildi', W / 2, 375);
  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 20px Nunito,sans-serif';
  ctx.fillText(sinf.toUpperCase() + ' \u2014 ' + testTitle, W / 2, 415);
  ctx.fillStyle = 'rgba(107,125,179,0.9)'; ctx.font = '16px Nunito,sans-serif'; ctx.fillText(topic, W / 2, 442);

  // Grade badge - big and beautiful
  var gbW = 280, gbH = 64;
  var gbX = W / 2 - gbW / 2, gbY = 466;
  var gbGrad = ctx.createLinearGradient(gbX, 0, gbX + gbW, 0);
  gbGrad.addColorStop(0, gradeColor); gbGrad.addColorStop(1, th.border2);
  ctx.fillStyle = gbGrad; roundRect(ctx, gbX, gbY, gbW, gbH, 32); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px Nunito,sans-serif';
  ctx.fillText(gradeLabel + ' (' + grade + ') \u2014 ' + pct + '%', W / 2, 506);

  ctx.strokeStyle = th.border1 + '33'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 556); ctx.lineTo(W - 80, 556); ctx.stroke();

  var today = new Date();
  var dateStr = today.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.textAlign = 'left'; ctx.font = '13px Nunito,sans-serif'; ctx.fillStyle = 'rgba(107,125,179,0.8)';
  ctx.fillText('Berilgan sana:', 100, 590);
  ctx.font = 'bold 16px Nunito,sans-serif'; ctx.fillStyle = '#1a1a2e'; ctx.fillText(dateStr, 100, 612);

  ctx.textAlign = 'right'; ctx.font = '13px Nunito,sans-serif'; ctx.fillStyle = 'rgba(107,125,179,0.8)';
  ctx.fillText('Platforma:', W - 100, 590);
  ctx.font = 'bold 16px Nunito,sans-serif'; ctx.fillStyle = '#1a1a2e';
  ctx.fillText('InforTest \u2014 ' + subjectName + ' testi', W - 100, 612);

  ctx.textAlign = 'center'; ctx.font = '13px Nunito,sans-serif'; ctx.fillStyle = 'rgba(107,125,179,0.7)';
  ctx.fillText("O'zbekiston, Namangan viloyati, Chortoq tumani, 6-maktab", W / 2, 660);

  ctx.font = '12px Nunito,sans-serif'; ctx.fillStyle = 'rgba(107,125,179,0.5)';
  ctx.fillText('ID: CERT-' + Math.random().toString(36).substr(2, 10).toUpperCase(), W / 2, 690);

  // School seal watermark
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.font = 'bold 120px Georgia,serif'; ctx.fillStyle = th.accent;
  ctx.fillText('6', W / 2 - 350, 500);
  ctx.fillText('6', W / 2 + 350, 500);
  ctx.restore();

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
  link.download = 'Sertifikat_' + currentUser.name.replace(/\s+/g, '_') + '_' + selectedSubject + '_' + selectedSinf + '_' + t.title.replace(/\s+/g, '_') + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var a = document.querySelector('.screen.active');
  if (a.id === 'registerScreen') register();
  else if (a.id === 'loginScreen') login();
});

// ═══════ MINI GAMES ═══════
var gameTimer = null;
var gameScore = 0;
var gameRound = 0;

function startGame(type) {
  var gc = document.getElementById('gamesContent');
  var ga = document.getElementById('gameArea');
  gc.style.display = 'none';
  ga.style.display = 'block';
  gameScore = 0; gameRound = 0;
  if (gameTimer) { clearInterval(gameTimer); clearTimeout(gameTimer); }
  if (type === 'memory') startMemoryGame();
  else if (type === 'math') startMathGame();
  else if (type === 'typing') startTypingGame();
  else if (type === 'quiz') startQuizGame();
}

function exitGame() {
  if (gameTimer) { clearInterval(gameTimer); clearTimeout(gameTimer); }
  var gc = document.getElementById('gamesContent');
  var ga = document.getElementById('gameArea');
  gc.style.display = 'block';
  ga.style.display = 'none';
  ga.innerHTML = '';
}

// ─── MEMORY GAME ───
function startMemoryGame() {
  var icons = ['📐','🔬','💻','🧪','📊','📚','🎯','⚡'];
  var cards = icons.concat(icons);
  cards.sort(function () { return Math.random() - 0.5; });
  var flipped = []; var matched = 0; var moves = 0;
  var ga = document.getElementById('gameArea');
  var html = '<div class="game-area"><div class="game-score-bar"><span>Xotira o\'yini</span><span id="memMoves">Urinishlar: 0</span><button class="btn btn-sm btn-outline" onclick="exitGame()">← Orqaga</button></div>';
  html += '<div class="game-board" style="grid-template-columns:repeat(4,1fr);max-width:400px;margin:0 auto">';
  for (var i = 0; i < cards.length; i++) {
    html += '<div class="game-cell" data-idx="' + i + '" data-icon="' + cards[i] + '" onclick="flipCard(this)" style="font-size:1.8rem;min-height:70px">?</div>';
  }
  html += '</div></div>';
  ga.innerHTML = html;

  window.memFlipped = []; window.memMatched = 0; window.memMoves = 0; window.memLocked = false;
}
function flipCard(el) {
  if (window.memLocked) return;
  if (el.classList.contains('matched') || el.classList.contains('flipped')) return;
  el.classList.add('flipped');
  el.textContent = el.dataset.icon;
  window.memFlipped.push(el);
  if (window.memFlipped.length === 2) {
    window.memMoves++;
    document.getElementById('memMoves').textContent = 'Urinishlar: ' + window.memMoves;
    var a = window.memFlipped[0], b = window.memFlipped[1];
    if (a.dataset.icon === b.dataset.icon) {
      a.classList.add('matched'); b.classList.add('matched');
      window.memFlipped = [];
      window.memMatched += 2;
      if (window.memMatched >= 16) {
        setTimeout(function () { alert('Tabriklaymiz! ' + window.memMoves + ' urinishda tamomladingiz!'); }, 300);
      }
    } else {
      window.memLocked = true;
      setTimeout(function () {
        a.classList.remove('flipped'); a.textContent = '?';
        b.classList.remove('flipped'); b.textContent = '?';
        window.memFlipped = []; window.memLocked = false;
      }, 800);
    }
  }
}

// ─── MATH GAME ───
function startMathGame() {
  window.mathScore = 0; window.mathRound = 0; window.mathTotal = 10;
  window.mathTimeLeft = 0;
  nextMathRound();
}
function nextMathRound() {
  if (window.mathRound >= window.mathTotal) {
    var ga = document.getElementById('gameArea');
    ga.innerHTML = '<div class="game-area" style="text-align:center"><h2 style="font-size:1.5rem;margin-bottom:16px">Natija: ' + window.mathScore + '/' + window.mathTotal + '</h2><p style="font-size:1.1rem;color:var(--muted);margin-bottom:20px">' + (window.mathScore >= 7 ? 'Ajoyib natija!' : window.mathScore >= 5 ? 'Yaxshi!' : 'Mashq qiling!') + '</p><button class="btn btn-sm btn-primary" onclick="startGame(\'math\')">Qayta o\'ynash</button> <button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="exitGame()">← Orqaga</button></div>';
    return;
  }
  window.mathRound++;
  var ops = ['+', '-', '*'];
  var op = ops[Math.floor(Math.random() * ops.length)];
  var a, b, answer;
  if (op === '*') { a = Math.floor(Math.random() * 12) + 2; b = Math.floor(Math.random() * 12) + 2; }
  else { a = Math.floor(Math.random() * 50) + 10; b = Math.floor(Math.random() * 30) + 5; }
  if (op === '+') answer = a + b;
  else if (op === '-') { if (a < b) { var tmp = a; a = b; b = tmp; } answer = a - b; }
  else answer = a * b;
  var options = [answer];
  while (options.length < 4) {
    var wrong = answer + (Math.floor(Math.random() * 20) - 10);
    if (wrong !== answer && options.indexOf(wrong) === -1 && wrong >= 0) options.push(wrong);
  }
  options.sort(function () { return Math.random() - 0.5; });
  window.mathTimeLeft = 10;
  var ga = document.getElementById('gameArea');
  var html = '<div class="game-area"><div class="game-score-bar"><span>Savol ' + window.mathRound + '/' + window.mathTotal + '</span><span>Ball: ' + window.mathScore + '</span><span id="mathTimer">⏱ 10s</span><button class="btn btn-sm btn-outline" onclick="exitGame()">← Orqaga</button></div>';
  html += '<div class="math-problem">' + a + ' ' + op + ' ' + b + ' = ?</div>';
  html += '<div class="math-options">';
  for (var i = 0; i < options.length; i++) {
    html += '<div class="math-opt" data-val="' + options[i] + '" data-answer="' + answer + '" onclick="checkMathAnswer(this)">' + options[i] + '</div>';
  }
  html += '</div></div>';
  ga.innerHTML = html;
  if (gameTimer) clearInterval(gameTimer);
  gameTimer = setInterval(function () {
    window.mathTimeLeft--;
    var te = document.getElementById('mathTimer');
    if (te) te.textContent = '⏱ ' + window.mathTimeLeft + 's';
    if (window.mathTimeLeft <= 0) { clearInterval(gameTimer); nextMathRound(); }
  }, 1000);
}
function checkMathAnswer(el) {
  clearInterval(gameTimer);
  var val = parseInt(el.dataset.val);
  var ans = parseInt(el.dataset.answer);
  var allOpts = document.querySelectorAll('.math-opt');
  allOpts.forEach(function (o) { o.style.pointerEvents = 'none'; });
  if (val === ans) { el.classList.add('correct'); window.mathScore++; }
  else {
    el.classList.add('wrong');
    allOpts.forEach(function (o) { if (parseInt(o.dataset.val) === ans) o.classList.add('correct'); });
  }
  setTimeout(nextMathRound, 800);
}

// ─── TYPING GAME ───
function startTypingGame() {
  window.typingWords = ['algoritm','kompyuter','dasturlash','funksiya','tarmoq','server','brauzer','internet','xotira','protsessor','monitor','klaviatura','fayl','papka','dastur','kod','sayt','parol','tizim','malumot'];
  window.typingWords.sort(function () { return Math.random() - 0.5; });
  window.typingScore = 0; window.typingRound = 0; window.typingTotal = 10;
  window.typingStart = Date.now();
  nextTypingRound();
}
function nextTypingRound() {
  if (window.typingRound >= window.typingTotal) {
    var elapsed = Math.round((Date.now() - window.typingStart) / 1000);
    var ga = document.getElementById('gameArea');
    ga.innerHTML = '<div class="game-area" style="text-align:center"><h2 style="font-size:1.5rem;margin-bottom:16px">Natija: ' + window.typingScore + '/' + window.typingTotal + '</h2><p style="color:var(--muted);margin-bottom:20px">Vaqt: ' + elapsed + ' soniya</p><button class="btn btn-sm btn-primary" onclick="startGame(\'typing\')">Qayta o\'ynash</button> <button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="exitGame()">← Orqaga</button></div>';
    return;
  }
  var word = window.typingWords[window.typingRound];
  window.typingRound++;
  var ga = document.getElementById('gameArea');
  ga.innerHTML = '<div class="game-area"><div class="game-score-bar"><span>So\'z ' + window.typingRound + '/' + window.typingTotal + '</span><span>Ball: ' + window.typingScore + '</span><button class="btn btn-sm btn-outline" onclick="exitGame()">← Orqaga</button></div><div class="typing-word">' + word + '</div><input class="typing-input" id="typingInput" placeholder="So\'zni yozing..." autocomplete="off" oninput="checkTyping(this,\'' + word + '\')"><p id="typingHint" style="text-align:center;margin-top:12px;font-size:.85rem;color:var(--muted)">So\'zni to\'g\'ri yozing va Enter bosing</p></div>';
  setTimeout(function () { var inp = document.getElementById('typingInput'); if (inp) inp.focus(); }, 100);
}
function checkTyping(inp, word) {
  var val = inp.value.trim().toLowerCase();
  if (val === word.toLowerCase()) {
    window.typingScore++;
    inp.style.borderColor = 'var(--green)';
    inp.disabled = true;
    setTimeout(nextTypingRound, 400);
  }
}

// ─── QUIZ GAME (general knowledge) ───
var quizGameQuestions = [
  {q:"Kompyuter ixtiro qilingan yil?",opts:["1936","1945","1950","1960"],a:1},
  {q:"1 kilobayt necha bayt?",opts:["100","512","1024","2048"],a:2},
  {q:"HTML ning to'liq nomi?",opts:["Hyper Text Markup Language","High Tech Modern Language","Hyper Transfer Markup Language","Home Tool Markup Language"],a:0},
  {q:"Eng kichik ma'lumot birligi?",opts:["Bayt","Bit","Kilobayt","Megabayt"],a:1},
  {q:"CPU ning vazifasi?",opts:["Ma'lumotlarni saqlash","Buyruqlarni bajarish","Internet ulash","Ekranga chiqarish"],a:1},
  {q:"WWW kim tomonidan yaratilgan?",opts:["Bill Gates","Tim Berners-Lee","Steve Jobs","Mark Zuckerberg"],a:1},
  {q:"Python dasturlash tili qachon yaratilgan?",opts:["1985","1991","2000","1995"],a:1},
  {q:"RAM nima?",opts:["Doimiy xotira","Operativ xotira","Grafik karta","Protsessor"],a:1},
  {q:"1 megabayt necha kilobayt?",opts:["100","512","1024","2048"],a:2},
  {q:"Birinchi dasturchi kim?",opts:["Alan Turing","Ada Lovelace","Charles Babbage","John von Neumann"],a:1},
  {q:"IP manzil nima?",opts:["Internet parol","Qurilma identifikatori tarmoqda","Dastur nomi","Fayl kengaytmasi"],a:1},
  {q:"CSS nima uchun ishlatiladi?",opts:["Dasturlash","Veb sahifa dizayni","Ma'lumotlar bazasi","Tarmoq xavfsizligi"],a:1},
  {q:"USB ning to'liq nomi?",opts:["Universal Serial Bus","United System Board","Ultra Speed Byte","Uniform Signal Base"],a:0},
  {q:"SSD va HDD farqi?",opts:["SSD tezroq, HDD sekinroq","SSD kattaroq","HDD yangi texnologiya","Farqi yo'q"],a:0},
  {q:"Linux nima?",opts:["Brauzer","Operatsion tizim","Dasturlash tili","Ofis dasturi"],a:1}
];
function startQuizGame() {
  window.quizGScore = 0; window.quizGRound = 0;
  window.quizGQuestions = quizGameQuestions.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 10);
  nextQuizGRound();
}
function nextQuizGRound() {
  if (window.quizGRound >= window.quizGQuestions.length) {
    var ga = document.getElementById('gameArea');
    ga.innerHTML = '<div class="game-area" style="text-align:center"><h2 style="font-size:1.5rem;margin-bottom:16px">Natija: ' + window.quizGScore + '/' + window.quizGQuestions.length + '</h2><p style="color:var(--muted);margin-bottom:20px">' + (window.quizGScore >= 7 ? 'Zo\'r bilim!' : window.quizGScore >= 5 ? 'Yaxshi!' : 'Ko\'proq o\'qing!') + '</p><button class="btn btn-sm btn-primary" onclick="startGame(\'quiz\')">Qayta o\'ynash</button> <button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="exitGame()">← Orqaga</button></div>';
    return;
  }
  var q = window.quizGQuestions[window.quizGRound];
  window.quizGRound++;
  var ga = document.getElementById('gameArea');
  var html = '<div class="game-area"><div class="game-score-bar"><span>Savol ' + window.quizGRound + '/' + window.quizGQuestions.length + '</span><span>Ball: ' + window.quizGScore + '</span><button class="btn btn-sm btn-outline" onclick="exitGame()">← Orqaga</button></div>';
  html += '<h3 style="font-size:1.1rem;font-weight:700;margin:20px 0;line-height:1.6">' + q.q + '</h3>';
  html += '<div class="math-options" style="max-width:100%;grid-template-columns:1fr">';
  for (var i = 0; i < q.opts.length; i++) {
    html += '<div class="math-opt" style="text-align:left;font-family:Inter,sans-serif;font-size:.9rem;font-weight:600" data-idx="' + i + '" data-answer="' + q.a + '" onclick="checkQuizGAnswer(this)">' + String.fromCharCode(65 + i) + ') ' + q.opts[i] + '</div>';
  }
  html += '</div></div>';
  ga.innerHTML = html;
}
function checkQuizGAnswer(el) {
  var idx = parseInt(el.dataset.idx);
  var ans = parseInt(el.dataset.answer);
  var allOpts = document.querySelectorAll('.math-opt');
  allOpts.forEach(function (o) { o.style.pointerEvents = 'none'; });
  if (idx === ans) { el.classList.add('correct'); window.quizGScore++; }
  else {
    el.classList.add('wrong');
    allOpts.forEach(function (o) { if (parseInt(o.dataset.idx) === ans) o.classList.add('correct'); });
  }
  setTimeout(nextQuizGRound, 800);
}
