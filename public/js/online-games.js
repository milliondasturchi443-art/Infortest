// ═══════ ONLINE MULTIPLAYER GAMES ═══════
var socket = null;
var onlineState = { inQueue: false, inGame: false, roomId: null, gameType: null, mode: null, myId: null };
var onlineKeys = {};
var onlineTouchAngle = null;
var onlineTouchShoot = false;
var onlineJoystick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
var onlineAimJoystick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };

function getSocket() {
  if (!socket || !socket.connected) {
    socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
    setupSocketEvents();
  }
  return socket;
}

function setupSocketEvents() {
  socket.on('queue_update', function (data) {
    var el = document.getElementById('queueCount');
    if (el) el.textContent = data.count;
  });

  socket.on('match_found', function (data) {
    onlineState.roomId = data.roomId;
    onlineState.gameType = data.gameType;
    onlineState.mode = data.mode;
    onlineState.inQueue = false;
    onlineState.inGame = true;
    startOnlineGame(data);
  });

  socket.on('game_state', function (data) {
    renderOnlineGame(data);
  });

  socket.on('game_over', function (data) {
    onlineState.inGame = false;
    showOnlineResult(data);
  });

  socket.on('player_disconnected', function (data) {
    var hud = document.getElementById('onlineHUD');
    if (hud) hud.innerHTML += '<span style="color:var(--red);margin-left:12px">O\'yinchi chiqib ketdi!</span>';
  });
}

function openOnlineGame(gameType, mode) {
  if (!currentUser) { alert('Avval tizimga kiring!'); return; }
  onlineState.myId = currentUser.id;
  var s = getSocket();

  document.getElementById('onlineLobby').style.display = 'none';
  var mm = document.getElementById('onlineMatchmaking');
  mm.style.display = 'block';
  mm.innerHTML =
    '<div class="game-area" style="text-align:center;padding:40px 20px">' +
    '<div class="matchmaking-spinner"></div>' +
    '<h2 style="font-size:1.3rem;margin:20px 0 8px">' + getGameTitle(gameType) + ' — ' + mode.toUpperCase() + '</h2>' +
    '<p style="color:var(--muted);margin-bottom:12px">Raqib qidirilmoqda...</p>' +
    '<p style="font-size:1.5rem;font-weight:900;color:var(--primary)" id="queueCount">1</p>' +
    '<p style="color:var(--muted);font-size:.8rem;margin-bottom:20px">o\'yinchi navbatda</p>' +
    '<p style="color:var(--muted);font-size:.75rem;margin-bottom:20px" id="matchTip">Boshqa brauzer oynasida ham kiring!</p>' +
    '<button class="btn btn-sm btn-outline" onclick="leaveOnlineQueue()">Bekor qilish</button></div>';

  onlineState.inQueue = true;
  onlineState.gameType = gameType;
  onlineState.mode = mode;

  s.emit('join_queue', {
    gameType: gameType,
    mode: mode,
    player: { id: currentUser.id, name: currentUser.name, grade: currentUser.grade }
  });
}

function getGameTitle(type) {
  if (type === 'shooter') return '🔫 2D Shooter';
  if (type === 'tanks') return '🔵 2D Tanklar';
  if (type === 'arena') return '⚔️ 2D Arena';
  return type;
}

function leaveOnlineQueue() {
  if (socket && onlineState.inQueue) {
    socket.emit('leave_queue', { gameType: onlineState.gameType, mode: onlineState.mode, playerId: currentUser.id });
  }
  onlineState.inQueue = false;
  backToOnlineLobby();
}

function backToOnlineLobby() {
  onlineState.inGame = false;
  onlineState.inQueue = false;
  onlineState.roomId = null;
  document.getElementById('onlineLobby').style.display = 'block';
  document.getElementById('onlineMatchmaking').style.display = 'none';
  document.getElementById('onlineGameArea').style.display = 'none';
  document.getElementById('onlineMobileControls').style.display = 'none';
  document.removeEventListener('keydown', onlineKeyDown);
  document.removeEventListener('keyup', onlineKeyUp);
  onlineKeys = {};
}

// ═══ GAME START ═══
function startOnlineGame(data) {
  document.getElementById('onlineMatchmaking').style.display = 'none';
  document.getElementById('onlineGameArea').style.display = 'block';

  var canvas = document.getElementById('onlineCanvas');
  resizeOnlineCanvas(canvas);

  setupOnlineControls(canvas);

  if (isMobile()) {
    showMobileControls();
  }
}

function resizeOnlineCanvas(canvas) {
  var container = canvas.parentElement;
  var maxW = Math.min(800, container.clientWidth - 4);
  var scale = maxW / 800;
  canvas.style.width = maxW + 'px';
  canvas.style.height = (600 * scale) + 'px';
}

function isMobile() {
  return window.innerWidth <= 768 || 'ontouchstart' in window;
}

// ═══ CONTROLS ═══
function onlineKeyDown(e) {
  var k = e.key.toLowerCase();
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].indexOf(k) !== -1) {
    e.preventDefault();
    onlineKeys[k] = true;
  }
}
function onlineKeyUp(e) {
  var k = e.key.toLowerCase();
  onlineKeys[k] = false;
}

function setupOnlineControls(canvas) {
  document.addEventListener('keydown', onlineKeyDown);
  document.addEventListener('keyup', onlineKeyUp);

  canvas.addEventListener('mousemove', function (e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = 800 / rect.width;
    var scaleY = 600 / rect.height;
    var mx = (e.clientX - rect.left) * scaleX;
    var my = (e.clientY - rect.top) * scaleY;
    onlineTouchAngle = Math.atan2(my - 300, mx - 400);
  });

  canvas.addEventListener('mousedown', function () { onlineTouchShoot = true; });
  canvas.addEventListener('mouseup', function () { onlineTouchShoot = false; });

  setInterval(sendOnlineInput, 1000 / 30);
}

function showMobileControls() {
  var mc = document.getElementById('onlineMobileControls');
  mc.style.display = 'block';
  mc.innerHTML =
    '<div style="display:flex;justify-content:space-between;padding:8px 12px;gap:12px">' +
    '<div id="moveJoystick" style="width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);position:relative;touch-action:none">' +
    '<div id="moveJoystickKnob" style="width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.5);position:absolute;top:45px;left:45px;pointer-events:none"></div></div>' +
    '<div id="aimJoystick" style="width:140px;height:140px;border-radius:50%;background:rgba(255,50,50,0.15);border:2px solid rgba(255,50,50,0.3);position:relative;touch-action:none">' +
    '<div id="aimJoystickKnob" style="width:50px;height:50px;border-radius:50%;background:rgba(255,50,50,0.5);position:absolute;top:45px;left:45px;pointer-events:none"></div></div></div>';

  var moveEl = document.getElementById('moveJoystick');
  var aimEl = document.getElementById('aimJoystick');

  setupJoystick(moveEl, 'moveJoystickKnob', onlineJoystick);
  setupJoystick(aimEl, 'aimJoystickKnob', onlineAimJoystick);
}

function setupJoystick(el, knobId, state) {
  var knob = document.getElementById(knobId);
  el.addEventListener('touchstart', function (e) {
    e.preventDefault();
    var t = e.touches[0];
    var rect = el.getBoundingClientRect();
    state.active = true;
    state.startX = rect.left + rect.width / 2;
    state.startY = rect.top + rect.height / 2;
    state.dx = t.clientX - state.startX;
    state.dy = t.clientY - state.startY;
    updateKnob(knob, state, el);
  }, { passive: false });

  el.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (!state.active) return;
    var t = e.touches[0];
    state.dx = t.clientX - state.startX;
    state.dy = t.clientY - state.startY;
    var dist = Math.sqrt(state.dx * state.dx + state.dy * state.dy);
    if (dist > 50) { state.dx = state.dx / dist * 50; state.dy = state.dy / dist * 50; }
    updateKnob(knob, state, el);
  }, { passive: false });

  el.addEventListener('touchend', function (e) {
    e.preventDefault();
    state.active = false;
    state.dx = 0;
    state.dy = 0;
    updateKnob(knob, state, el);
  }, { passive: false });
}

function updateKnob(knob, state, el) {
  var hw = el.clientWidth / 2 - 25;
  knob.style.left = (hw + state.dx) + 'px';
  knob.style.top = (hw + state.dy) + 'px';
}

function sendOnlineInput() {
  if (!onlineState.inGame || !socket) return;

  var input = { up: false, down: false, left: false, right: false, shoot: false, attack: false };

  if (isMobile() && onlineJoystick.active) {
    if (onlineJoystick.dy < -15) input.up = true;
    if (onlineJoystick.dy > 15) input.down = true;
    if (onlineJoystick.dx < -15) input.left = true;
    if (onlineJoystick.dx > 15) input.right = true;
  } else {
    input.up = onlineKeys['w'] || onlineKeys['arrowup'] || false;
    input.down = onlineKeys['s'] || onlineKeys['arrowdown'] || false;
    input.left = onlineKeys['a'] || onlineKeys['arrowleft'] || false;
    input.right = onlineKeys['d'] || onlineKeys['arrowright'] || false;
  }

  if (isMobile() && onlineAimJoystick.active) {
    input.angle = Math.atan2(onlineAimJoystick.dy, onlineAimJoystick.dx);
    input.shoot = true;
    input.attack = true;
    if (onlineState.gameType === 'tanks') input.turretAngle = input.angle;
  } else {
    if (onlineTouchAngle !== null) input.angle = onlineTouchAngle;
    input.shoot = onlineTouchShoot || onlineKeys[' '] || false;
    input.attack = onlineTouchShoot || onlineKeys[' '] || false;
    if (onlineState.gameType === 'tanks' && onlineTouchAngle !== null) input.turretAngle = onlineTouchAngle;
  }

  socket.emit('game_input', { roomId: onlineState.roomId, playerId: onlineState.myId, input: input });
}

// ═══ RENDERING ═══
var GAME_COLORS = {
  bg: '#1a1a2e',
  wall: '#374151',
  wallStroke: '#4b5563',
  player0: '#3b82f6',
  player1: '#ef4444',
  player2: '#22c55e',
  player3: '#f59e0b',
  bullet: '#fbbf24',
  hp: '#22c55e',
  hpBg: '#374151',
  text: '#ffffff'
};

function renderOnlineGame(data) {
  var canvas = document.getElementById('onlineCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = 800, H = 600;

  ctx.fillStyle = GAME_COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, W, H);

  if (onlineState.gameType === 'shooter') renderShooter(ctx, data, W, H);
  else if (onlineState.gameType === 'tanks') renderTanks(ctx, data, W, H);
  else if (onlineState.gameType === 'arena') renderArena(ctx, data, W, H);

  updateHUD(data);
}

function drawGrid(ctx, W, H) {
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (var x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (var y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function getPlayerColor(idx) {
  var colors = [GAME_COLORS.player0, GAME_COLORS.player1, GAME_COLORS.player2, GAME_COLORS.player3];
  return colors[idx % colors.length];
}

function drawWalls(ctx, walls) {
  walls.forEach(function (w) {
    ctx.fillStyle = GAME_COLORS.wall;
    ctx.strokeStyle = GAME_COLORS.wallStroke;
    ctx.lineWidth = 2;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  });
}

function drawHP(ctx, x, y, hp, maxHp) {
  var bw = 40, bh = 5;
  ctx.fillStyle = GAME_COLORS.hpBg;
  ctx.fillRect(x - bw / 2, y - 28, bw, bh);
  ctx.fillStyle = hp > 60 ? GAME_COLORS.hp : hp > 30 ? '#f59e0b' : '#ef4444';
  ctx.fillRect(x - bw / 2, y - 28, bw * (hp / maxHp), bh);
}

function drawName(ctx, x, y, name, isMe) {
  ctx.fillStyle = isMe ? '#fbbf24' : '#ffffff';
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, x, y - 33);
}

function drawBullets(ctx, bullets) {
  bullets.forEach(function (b) {
    ctx.fillStyle = GAME_COLORS.bullet;
    ctx.shadowColor = GAME_COLORS.bullet;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

// ═══ SHOOTER RENDERER ═══
function renderShooter(ctx, data, W, H) {
  var walls = data.state.items ? data.state.items.filter(function (i) { return i.type === 'wall'; }) : [];
  drawWalls(ctx, walls);
  drawBullets(ctx, data.state.bullets || []);

  data.players.forEach(function (p, i) {
    if (p.disconnected) return;
    var isMe = p.id === onlineState.myId;
    var color = getPlayerColor(i);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle || 0);

    // body
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // gun
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(10, -3, 12, 6);

    // visor
    ctx.fillStyle = isMe ? '#fbbf24' : '#e5e7eb';
    ctx.beginPath();
    ctx.arc(4, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    drawHP(ctx, p.x, p.y, p.hp, 100);
    drawName(ctx, p.x, p.y, p.name || 'Player', isMe);

    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

// ═══ TANKS RENDERER ═══
function renderTanks(ctx, data, W, H) {
  drawWalls(ctx, data.state.walls || []);
  drawBullets(ctx, data.state.bullets || []);

  data.players.forEach(function (p, i) {
    if (p.disconnected) return;
    var isMe = p.id === onlineState.myId;
    var color = getPlayerColor(p.team != null ? p.team : i);

    ctx.save();
    ctx.translate(p.x, p.y);

    // tank body
    var bodyAngle = p.angle || 0;
    ctx.save();
    ctx.rotate(bodyAngle);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillRect(-16, -12, 32, 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = shadeColor(color, -30);
    ctx.fillRect(-18, -14, 6, 28);
    ctx.fillRect(12, -14, 6, 28);
    ctx.restore();

    // turret
    var tAngle = p.turretAngle || bodyAngle;
    ctx.save();
    ctx.rotate(tAngle);
    ctx.fillStyle = shadeColor(color, 20);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(6, -2.5, 18, 5);
    ctx.restore();

    ctx.restore();

    drawHP(ctx, p.x, p.y, p.hp, 100);
    drawName(ctx, p.x, p.y, p.name || 'Tank', isMe);
  });
}

// ═══ ARENA RENDERER ═══
function renderArena(ctx, data, W, H) {
  // arena circle decoration
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 200, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 100, 0, Math.PI * 2);
  ctx.stroke();

  // projectiles
  (data.state.projectiles || []).forEach(function (p) {
    ctx.fillStyle = '#f97316';
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  data.players.forEach(function (p, i) {
    if (p.disconnected) return;
    var isMe = p.id === onlineState.myId;
    var color = getPlayerColor(i);

    ctx.save();
    ctx.translate(p.x, p.y);

    // body
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // sword direction
    ctx.rotate(p.angle || 0);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(14, -2, 14, 4);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(26, -4, 4, 8);

    // shield
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(-6, -10, 4, 20);

    ctx.restore();

    // cooldown ring
    if (p.attackCooldown > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2 * (1 - p.attackCooldown / 0.6));
      ctx.stroke();
    }

    drawHP(ctx, p.x, p.y, p.hp, 100);
    drawName(ctx, p.x, p.y, p.name || 'Jangchi', isMe);
  });
}

function updateHUD(data) {
  var hud = document.getElementById('onlineHUD');
  if (!hud) return;
  var time = data.state.time || 0;
  var min = Math.floor(time / 60);
  var sec = time % 60;
  var timeStr = min + ':' + (sec < 10 ? '0' : '') + sec;

  var html = '<span style="color:var(--muted)">⏱ ' + timeStr + '</span>';
  data.players.forEach(function (p, i) {
    var color = getPlayerColor(p.team != null ? p.team : i);
    var isMe = p.id === onlineState.myId;
    html += '<span style="color:' + color + ';' + (isMe ? 'text-decoration:underline;' : '') + '">' + p.name + ': ' + p.score + '</span>';
  });
  html += '<button class="btn btn-sm btn-outline" style="padding:4px 10px;font-size:.75rem" onclick="leaveOnlineGame()">Chiqish</button>';
  hud.innerHTML = html;
}

function leaveOnlineGame() {
  if (socket) socket.disconnect();
  socket = null;
  backToOnlineLobby();
}

function showOnlineResult(data) {
  onlineState.inGame = false;
  document.getElementById('onlineGameArea').style.display = 'none';
  document.getElementById('onlineMobileControls').style.display = 'none';
  var mm = document.getElementById('onlineMatchmaking');
  mm.style.display = 'block';

  var me = data.players.find(function (p) { return p.id === onlineState.myId; });
  var myScore = me ? me.score : 0;
  var isWinner = data.winner === (me ? me.name : '');

  var html = '<div class="game-area" style="text-align:center;padding:30px 20px">';
  html += '<h2 style="font-size:1.8rem;margin-bottom:12px">' + (isWinner ? '🏆 Siz yutdingiz!' : data.winner === 'Durrang' ? '🤝 Durrang!' : '😤 Yutqazdingiz') + '</h2>';
  html += '<p style="font-size:1.1rem;color:var(--muted);margin-bottom:16px">G\'olib: <strong>' + data.winner + '</strong></p>';
  html += '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:20px">';
  data.players.forEach(function (p, i) {
    var color = getPlayerColor(p.team != null ? p.team : i);
    html += '<div class="stat-card" style="padding:12px 20px;text-align:center;min-width:100px;border-top:3px solid ' + color + '">';
    html += '<div style="font-weight:700">' + p.name + '</div>';
    html += '<div style="font-size:1.5rem;font-weight:900;color:' + color + '">' + p.score + '</div>';
    html += '<div style="font-size:.75rem;color:var(--muted)">+' + (p.score * 10) + ' ochko</div></div>';
  });
  html += '</div>';
  html += '<button class="btn btn-sm btn-primary" onclick="openOnlineGame(\'' + onlineState.gameType + '\',\'' + onlineState.mode + '\')">Qayta o\'ynash</button> ';
  html += '<button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="backToOnlineLobby()">← Orqaga</button></div>';
  mm.innerHTML = html;
}

function shadeColor(color, percent) {
  var num = parseInt(color.replace('#', ''), 16);
  var r = Math.min(255, Math.max(0, (num >> 16) + percent));
  var g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  var b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}
