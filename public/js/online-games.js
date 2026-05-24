// ═══════ ONLINE MULTIPLAYER GAMES ═══════
var socket = null;
var onlineState = { inQueue: false, inGame: false, inLobby: false, lobbyCode: null, roomId: null, gameType: null, mode: null, myId: null, mapId: 'default', buyMenuOpen: false };
var onlineKeys = {};
var onlineTouchAngle = null;
var onlineTouchShoot = false;
var onlineJoystick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
var onlineAimJoystick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
var onlineMyPos = { x: 400, y: 300 };
var onlineInputInterval = null;
var myWeapon = 'pistol';
var myMoney = 800;

var GAME_MAPS = {
  shooter: [
    { id: 'default', name: 'Oddiy', icon: '🏙️' },
    { id: 'city', name: 'Shahar', icon: '🌆' },
    { id: 'desert', name: 'Cho\'l', icon: '🏜️' },
    { id: 'maze', name: 'Labirint', icon: '🏗️' }
  ],
  tanks: [
    { id: 'default', name: 'Oddiy', icon: '🏙️' },
    { id: 'fortress', name: 'Qal\'a', icon: '🏰' },
    { id: 'open', name: 'Ochiq maydon', icon: '🌾' },
    { id: 'ruins', name: 'Xarobalar', icon: '🏚️' }
  ],
  arena: [
    { id: 'default', name: 'Oddiy', icon: '⚔️' },
    { id: 'colosseum', name: 'Kolizey', icon: '🏛️' },
    { id: 'ice', name: 'Muz', icon: '❄️' }
  ]
};

var WEAPONS_INFO = {
  pistol: { name: 'Pistolet', icon: '🔫', price: 0 },
  smg: { name: 'SMG', icon: '⚡', price: 1200 },
  rifle: { name: 'Vintovka', icon: '🎯', price: 2700 },
  shotgun: { name: 'Shotgan', icon: '💥', price: 1800 },
  sniper: { name: 'Snayper', icon: '🔭', price: 4750 }
};

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
    onlineState.inLobby = false;
    onlineState.inGame = true;
    myWeapon = 'pistol';
    myMoney = 800;
    startOnlineGame(data);
  });

  socket.on('game_state', function (data) { renderOnlineGame(data); });
  socket.on('game_over', function (data) { onlineState.inGame = false; showOnlineResult(data); });
  socket.on('player_disconnected', function () {
    var hud = document.getElementById('onlineHUD');
    if (hud) hud.innerHTML += '<span style="color:#ef4444;margin-left:12px">O\'yinchi chiqib ketdi!</span>';
  });

  socket.on('lobby_created', function (data) {
    onlineState.inLobby = true;
    onlineState.lobbyCode = data.code;
    renderLobbyView(data.lobby);
  });
  socket.on('lobby_update', function (data) { renderLobbyView(data.lobby); });
  socket.on('lobby_error', function (data) { alert(data.error); });
  socket.on('buy_ok', function (data) {
    if (data.weapon) myWeapon = data.weapon;
    if (data.money !== undefined) myMoney = data.money;
  });
  socket.on('buy_error', function (data) { alert(data.error); });
}

// ═══ ONLINE LOBBY (MAIN PAGE) ═══
function openOnlineGame(gameType, mode) {
  if (!currentUser) { alert('Avval tizimga kiring!'); return; }
  onlineState.myId = currentUser.id;
  onlineState.gameType = gameType;
  onlineState.mode = mode;
  onlineState.mapId = 'default';

  var s = getSocket();
  // Create lobby directly like CS2
  s.emit('create_lobby', {
    gameType: gameType,
    mode: mode,
    mapId: 'default',
    player: { id: currentUser.id, name: currentUser.name, grade: currentUser.grade }
  });
}

function showJoinLobbyDirect() {
  if (!currentUser) { alert('Avval tizimga kiring!'); return; }
  onlineState.myId = currentUser.id;
  document.getElementById('onlineLobby').style.display = 'none';
  var mm = document.getElementById('onlineMatchmaking');
  mm.style.display = 'block';
  mm.innerHTML =
    '<div style="max-width:400px;margin:0 auto;padding:30px 20px;text-align:center">' +
    '<h2 style="font-size:1.2rem;margin-bottom:16px">🔑 Lobby kodini kiriting</h2>' +
    '<input type="text" id="joinCodeInput" placeholder="RF9CA" maxlength="5" style="font-size:2rem;text-align:center;letter-spacing:8px;font-weight:900;text-transform:uppercase;width:220px;padding:14px;border:2px solid var(--border);border-radius:12px;background:var(--card);color:var(--text)">' +
    '<div style="margin-top:16px;display:flex;gap:10px;justify-content:center">' +
    '<button class="btn btn-sm btn-primary" onclick="joinLobbyByCode()">Kirish</button>' +
    '<button class="btn btn-sm btn-outline" onclick="backToOnlineLobby()">← Orqaga</button>' +
    '</div></div>';
  var s = getSocket();
  setTimeout(function () { var inp = document.getElementById('joinCodeInput'); if (inp) inp.focus(); }, 100);
}

function joinLobbyByCode() {
  var code = (document.getElementById('joinCodeInput').value || '').trim().toUpperCase();
  if (code.length < 3) { alert('Kodni kiriting!'); return; }
  var s = getSocket();
  s.emit('join_lobby', { code: code, player: { id: currentUser.id, name: currentUser.name, grade: currentUser.grade } });
}

// ═══ LOBBY VIEW (CS2 STYLE) ═══
function renderLobbyView(lobby) {
  var mm = document.getElementById('onlineMatchmaking');
  mm.style.display = 'block';
  document.getElementById('onlineLobby').style.display = 'none';
  document.getElementById('onlineGameArea').style.display = 'none';

  var isHost = lobby.host === currentUser.id;
  var maps = GAME_MAPS[lobby.gameType] || [];
  var curMap = maps.find(function (m) { return m.id === lobby.mapId; }) || maps[0] || {};

  var html = '<div class="lobby-container">';

  // header
  html += '<div class="lobby-header">';
  html += '<div class="lobby-code-box">';
  html += '<div class="lobby-code-label">LOBBY KODI</div>';
  html += '<div class="lobby-code-value" id="lobbyCodeVal">' + lobby.code + '</div>';
  html += '<button class="btn-copy" onclick="copyLobbyCode(\'' + lobby.code + '\')">📋 Nusxalash</button>';
  html += '</div>';
  html += '<div style="text-align:center">';
  html += '<div style="font-size:1.1rem;font-weight:800">' + getGameTitle(lobby.gameType) + '</div>';
  html += '<div style="color:var(--muted);font-size:.8rem">' + lobby.mode.toUpperCase() + ' | ' + curMap.icon + ' ' + curMap.name + '</div>';
  html += '</div></div>';

  // players grid
  html += '<div class="lobby-players">';
  html += '<div class="lobby-section-title">O\'yinchilar (' + lobby.players.length + '/' + lobby.needed + ')</div>';
  html += '<div class="lobby-player-grid">';
  for (var i = 0; i < lobby.needed; i++) {
    var p = lobby.players[i];
    if (p) {
      var isMe = p.id === currentUser.id;
      var isHostP = p.id === lobby.host;
      html += '<div class="lobby-player-card' + (isMe ? ' lp-me' : '') + (p.isBot ? ' lp-bot' : '') + '">';
      html += '<div class="lp-avatar">' + (p.isBot ? '🤖' : (isHostP ? '👑' : '👤')) + '</div>';
      html += '<div class="lp-name">' + p.name + '</div>';
      html += '<div class="lp-grade">' + (p.isBot ? 'BOT' : (p.grade || '')) + '</div>';
      if (isHost && !isMe) {
        html += '<button class="lp-kick" onclick="lobbyKick(\'' + lobby.code + '\',\'' + p.id + '\')">✕</button>';
      }
      html += '</div>';
    } else {
      html += '<div class="lobby-player-card lp-empty">';
      html += '<div class="lp-avatar">❓</div>';
      html += '<div class="lp-name" style="color:var(--muted)">Bo\'sh joy</div>';
      html += '</div>';
    }
  }
  html += '</div></div>';

  // host controls
  if (isHost) {
    html += '<div class="lobby-controls">';
    // game type
    html += '<div class="lobby-ctrl-row"><span class="ctrl-label">O\'yin:</span>';
    html += '<div class="ctrl-btns">';
    ['shooter', 'tanks', 'arena'].forEach(function (g) {
      html += '<button class="ctrl-btn' + (lobby.gameType === g ? ' ctrl-active' : '') + '" onclick="lobbyChangeGame(\'' + lobby.code + '\',\'' + g + '\')">' + getGameTitle(g) + '</button>';
    });
    html += '</div></div>';

    // mode
    html += '<div class="lobby-ctrl-row"><span class="ctrl-label">Rejim:</span>';
    html += '<div class="ctrl-btns">';
    ['1v1', '2v2'].forEach(function (m) {
      html += '<button class="ctrl-btn' + (lobby.mode === m ? ' ctrl-active' : '') + '" onclick="lobbyChangeMode(\'' + lobby.code + '\',\'' + m + '\')">' + m.toUpperCase() + '</button>';
    });
    html += '</div></div>';

    // map
    html += '<div class="lobby-ctrl-row"><span class="ctrl-label">Xarita:</span>';
    html += '<div class="ctrl-btns">';
    maps.forEach(function (m) {
      html += '<button class="ctrl-btn' + (m.id === lobby.mapId ? ' ctrl-active' : '') + '" onclick="lobbyChangeMap(\'' + lobby.code + '\',\'' + m.id + '\')">' + m.icon + ' ' + m.name + '</button>';
    });
    html += '</div></div>';
    html += '</div>';
  }

  // action buttons
  html += '<div class="lobby-actions">';
  if (isHost) {
    html += '<button class="btn btn-lg btn-green lobby-start-btn" onclick="lobbyStart(\'' + lobby.code + '\')">▶ O\'YINNI BOSHLASH</button>';
    if (lobby.players.length < lobby.needed) {
      html += '<button class="btn btn-sm btn-outline" onclick="lobbyAddBot(\'' + lobby.code + '\')">🤖 Bot qo\'shish</button>';
    }
  } else {
    html += '<div style="color:var(--muted);font-size:.85rem;text-align:center">Host boshlashini kuting...</div>';
  }
  html += '<button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="leaveLobby(\'' + lobby.code + '\')">🚪 Chiqish</button>';
  html += '</div>';

  // invite section
  html += '<div class="lobby-invite">';
  html += '<div class="lobby-section-title">📨 Do\'stlarni taklif qilish</div>';
  html += '<div style="display:flex;gap:6px;margin-bottom:8px"><input type="text" id="inviteFriendCode" placeholder="Do\'st kodi (RF9CA)" maxlength="5" style="flex:1;padding:8px 12px;border:2px solid var(--border);border-radius:8px;font-size:.85rem;text-transform:uppercase;background:var(--card);color:var(--text)">';
  html += '<button class="btn btn-sm btn-primary" onclick="inviteFriendToLobby(\'' + lobby.code + '\')">Taklif</button></div>';
  html += '<div id="lobbyFriendsList"></div>';
  html += '</div>';

  html += '</div>';
  mm.innerHTML = html;

  // load friends into lobby invite
  loadLobbyFriends(lobby.code);
}

function loadLobbyFriends(lobbyCode) {
  if (!currentUser) return;
  fetch('/api/auth/friends/' + currentUser.id)
    .then(function (r) { return r.json(); })
    .then(function (friends) {
      var el = document.getElementById('lobbyFriendsList');
      if (!el) return;
      if (!friends || friends.length === 0) { el.innerHTML = '<p style="color:var(--muted);font-size:.8rem">Do\'stlar yo\'q. Kodni ulashing!</p>'; return; }
      var html = '';
      friends.forEach(function (f) {
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:var(--bg);margin-bottom:3px">';
        html += '<span style="font-weight:600;font-size:.8rem">' + f.name + ' <span style="color:var(--muted);font-size:.7rem">(' + (f.friendCode || '') + ')</span></span>';
        html += '</div>';
      });
      el.innerHTML = html;
    }).catch(function () { });
}

function inviteFriendToLobby(code) {
  var friendCode = (document.getElementById('inviteFriendCode').value || '').trim().toUpperCase();
  if (!friendCode) return;
  copyLobbyCode(code);
  alert('Lobby kodi nusxalandi: ' + code + '\nDo\'stingizga yuboring!');
}

function copyLobbyCode(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
    var el = document.getElementById('lobbyCodeVal');
    if (el) { var orig = el.textContent; el.textContent = '✓ Nusxalandi!'; setTimeout(function () { el.textContent = orig; }, 1500); }
  }
}

function lobbyAddBot(code) { getSocket().emit('lobby_add_bot', { code: code, playerId: currentUser.id }); }
function lobbyKick(code, targetId) { getSocket().emit('lobby_remove_player', { code: code, playerId: currentUser.id, targetId: targetId }); }
function lobbyStart(code) { getSocket().emit('lobby_start', { code: code, playerId: currentUser.id }); }
function lobbyChangeMap(code, mapId) { getSocket().emit('lobby_change_map', { code: code, mapId: mapId, playerId: currentUser.id }); }
function lobbyChangeMode(code, mode) { getSocket().emit('lobby_change_mode', { code: code, mode: mode, playerId: currentUser.id }); }
function lobbyChangeGame(code, gameType) { getSocket().emit('lobby_change_game', { code: code, gameType: gameType, playerId: currentUser.id }); }

function leaveLobby(code) {
  if (socket) socket.emit('leave_lobby', { code: code, playerId: currentUser.id });
  onlineState.inLobby = false;
  onlineState.lobbyCode = null;
  backToOnlineLobby();
}

// ═══ FRIENDS PANEL ═══
function showFriendsPanel() {
  var panel = document.getElementById('friendsPanel');
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  loadFriends();
}

function loadFriends() {
  if (!currentUser) return;
  fetch('/api/auth/friends/' + currentUser.id)
    .then(function (r) { return r.json(); })
    .then(function (friends) {
      var html = '<div style="margin-bottom:12px">';
      html += '<div style="font-weight:700;font-size:.85rem;margin-bottom:6px">Sizning kodingiz:</div>';
      html += '<div style="font-size:1.4rem;font-weight:900;letter-spacing:5px;color:var(--primary);background:var(--bg);padding:8px 16px;border-radius:8px;display:inline-block">' + (currentUser.friendCode || '...') + '</div>';
      html += '</div>';
      html += '<div style="margin-bottom:12px"><div style="display:flex;gap:6px">';
      html += '<input type="text" id="addFriendCode" placeholder="Kod kiriting" maxlength="5" style="flex:1;padding:8px;border:2px solid var(--border);border-radius:8px;font-size:.85rem;text-transform:uppercase;background:var(--card);color:var(--text)">';
      html += '<button class="btn btn-sm btn-primary" onclick="addFriend()">Qo\'shish</button></div>';
      html += '<div id="addFriendMsg" style="font-size:.75rem;margin-top:4px"></div></div>';

      if (friends && friends.length > 0) {
        html += '<div style="font-weight:700;font-size:.85rem;margin-bottom:6px">Do\'stlar (' + friends.length + '):</div>';
        friends.forEach(function (f) {
          html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;background:var(--bg);margin-bottom:4px">';
          html += '<div><span style="font-weight:700">' + f.name + '</span> <span style="font-size:.7rem;color:var(--muted)">' + (f.grade || '') + ' | ' + (f.friendCode || '') + ' | ' + (f.gamePoints || 0) + ' ball</span></div>';
          html += '<button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:.65rem" onclick="removeFriend(\'' + f.id + '\')">✕</button></div>';
        });
      } else {
        html += '<p style="color:var(--muted);font-size:.8rem;text-align:center">Hali do\'stlar yo\'q</p>';
      }
      document.getElementById('friendsList').innerHTML = html;
    }).catch(function () {
      document.getElementById('friendsList').innerHTML = '<p style="color:var(--muted)">Yuklanmadi</p>';
    });
}

function addFriend() {
  var code = (document.getElementById('addFriendCode').value || '').trim().toUpperCase();
  if (!code) return;
  fetch('/api/auth/friend/add', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id, friendCode: code })
  }).then(function (r) { return r.json(); }).then(function (data) {
    var msg = document.getElementById('addFriendMsg');
    if (data.error) { msg.innerHTML = '<span style="color:#ef4444">' + data.error + '</span>'; }
    else { msg.innerHTML = '<span style="color:#22c55e">' + data.friend.name + ' qo\'shildi!</span>'; document.getElementById('addFriendCode').value = ''; loadFriends(); }
  }).catch(function () { });
}

function removeFriend(friendId) {
  fetch('/api/auth/friend/remove', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id, friendId: friendId })
  }).then(function () { loadFriends(); });
}

// ═══ COMMON ═══
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
  onlineState.inLobby = false;
  onlineState.roomId = null;
  onlineState.lobbyCode = null;
  onlineState.buyMenuOpen = false;
  if (onlineInputInterval) { clearInterval(onlineInputInterval); onlineInputInterval = null; }
  document.getElementById('onlineLobby').style.display = 'block';
  document.getElementById('onlineMatchmaking').style.display = 'none';
  document.getElementById('onlineGameArea').style.display = 'none';
  document.getElementById('onlineMobileControls').style.display = 'none';
  var buyEl = document.getElementById('buyMenu');
  if (buyEl) buyEl.style.display = 'none';
  document.removeEventListener('keydown', onlineKeyDown);
  document.removeEventListener('keyup', onlineKeyUp);
  onlineKeys = {};
  onlineTouchShoot = false;
  onlineTouchAngle = null;
}

// ═══ GAME START ═══
function startOnlineGame(data) {
  document.getElementById('onlineMatchmaking').style.display = 'none';
  document.getElementById('onlineGameArea').style.display = 'block';

  var canvas = document.getElementById('onlineCanvas');
  resizeOnlineCanvas(canvas);
  setupOnlineControls(canvas);

  if (isMobile()) showMobileControls();
}

function resizeOnlineCanvas(canvas) {
  var container = canvas.parentElement;
  var maxW = Math.min(800, container.clientWidth - 4);
  var scale = maxW / 800;
  canvas.style.width = maxW + 'px';
  canvas.style.height = (600 * scale) + 'px';
}

function isMobile() { return window.innerWidth <= 768 || 'ontouchstart' in window; }

// ═══ BUY MENU (CS2) ═══
function toggleBuyMenu() {
  onlineState.buyMenuOpen = !onlineState.buyMenuOpen;
  var el = document.getElementById('buyMenu');
  if (!el) return;
  if (onlineState.buyMenuOpen) {
    var html = '<div class="buy-menu-inner">';
    html += '<div class="buy-title">🛒 Do\'kon | 💰 $' + myMoney + '</div>';
    html += '<div class="buy-grid">';
    Object.keys(WEAPONS_INFO).forEach(function (wId) {
      var w = WEAPONS_INFO[wId];
      var canBuy = myMoney >= w.price;
      var active = myWeapon === wId;
      html += '<div class="buy-item' + (active ? ' buy-active' : '') + (canBuy ? '' : ' buy-disabled') + '" onclick="buyWeapon(\'' + wId + '\')">';
      html += '<div class="buy-icon">' + w.icon + '</div>';
      html += '<div class="buy-name">' + w.name + '</div>';
      html += '<div class="buy-price">' + (w.price === 0 ? 'Bepul' : '$' + w.price) + '</div>';
      html += '</div>';
    });
    // armor
    html += '<div class="buy-item' + (myMoney >= 650 ? '' : ' buy-disabled') + '" onclick="buyArmor()">';
    html += '<div class="buy-icon">🛡️</div>';
    html += '<div class="buy-name">Bronjilet</div>';
    html += '<div class="buy-price">$650</div>';
    html += '</div>';
    html += '</div>';
    html += '<div class="buy-hint">B tugmasi — yopish</div>';
    html += '</div>';
    el.innerHTML = html;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function buyWeapon(wId) {
  if (!socket || !onlineState.inGame) return;
  socket.emit('buy_weapon', { roomId: onlineState.roomId, playerId: onlineState.myId, weaponId: wId });
}
function buyArmor() {
  if (!socket || !onlineState.inGame) return;
  socket.emit('buy_armor', { roomId: onlineState.roomId, playerId: onlineState.myId });
}

// ═══ CONTROLS ═══
function onlineKeyDown(e) {
  var k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) !== -1) {
    e.preventDefault();
    onlineKeys[k] = true;
  }
  if (k === 'b' && onlineState.inGame && onlineState.gameType === 'shooter') {
    e.preventDefault();
    toggleBuyMenu();
  }
}
function onlineKeyUp(e) { onlineKeys[e.key.toLowerCase()] = false; }

function setupOnlineControls(canvas) {
  document.addEventListener('keydown', onlineKeyDown);
  document.addEventListener('keyup', onlineKeyUp);

  canvas.addEventListener('mousemove', function (e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = 800 / rect.width, scaleY = 600 / rect.height;
    var mx = (e.clientX - rect.left) * scaleX, my = (e.clientY - rect.top) * scaleY;
    onlineTouchAngle = Math.atan2(my - onlineMyPos.y, mx - onlineMyPos.x);
  });
  canvas.addEventListener('mousedown', function () { onlineTouchShoot = true; });
  canvas.addEventListener('mouseup', function () { onlineTouchShoot = false; });

  if (onlineInputInterval) clearInterval(onlineInputInterval);
  onlineInputInterval = setInterval(sendOnlineInput, 1000 / 30);
}

function showMobileControls() {
  var mc = document.getElementById('onlineMobileControls');
  mc.style.display = 'block';
  mc.innerHTML =
    '<div style="display:flex;justify-content:space-between;padding:8px 12px;gap:12px;align-items:center">' +
    '<div id="moveJoystick" style="width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);position:relative;touch-action:none">' +
    '<div id="moveJoystickKnob" style="width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.5);position:absolute;top:40px;left:40px;pointer-events:none"></div></div>' +
    (onlineState.gameType === 'shooter' ? '<button class="btn btn-sm btn-outline" style="font-size:.7rem" onclick="toggleBuyMenu()">🛒</button>' : '') +
    '<div id="aimJoystick" style="width:130px;height:130px;border-radius:50%;background:rgba(255,50,50,0.15);border:2px solid rgba(255,50,50,0.3);position:relative;touch-action:none">' +
    '<div id="aimJoystickKnob" style="width:50px;height:50px;border-radius:50%;background:rgba(255,50,50,0.5);position:absolute;top:40px;left:40px;pointer-events:none"></div></div></div>';
  setupJoystick(document.getElementById('moveJoystick'), 'moveJoystickKnob', onlineJoystick);
  setupJoystick(document.getElementById('aimJoystick'), 'aimJoystickKnob', onlineAimJoystick);
}

function setupJoystick(el, knobId, state) {
  var knob = document.getElementById(knobId);
  el.addEventListener('touchstart', function (e) {
    e.preventDefault(); var t = e.touches[0]; var rect = el.getBoundingClientRect();
    state.active = true; state.startX = rect.left + rect.width / 2; state.startY = rect.top + rect.height / 2;
    state.dx = t.clientX - state.startX; state.dy = t.clientY - state.startY;
    updateKnob(knob, state, el);
  }, { passive: false });
  el.addEventListener('touchmove', function (e) {
    e.preventDefault(); if (!state.active) return; var t = e.touches[0];
    state.dx = t.clientX - state.startX; state.dy = t.clientY - state.startY;
    var dist = Math.sqrt(state.dx * state.dx + state.dy * state.dy);
    if (dist > 50) { state.dx = state.dx / dist * 50; state.dy = state.dy / dist * 50; }
    updateKnob(knob, state, el);
  }, { passive: false });
  el.addEventListener('touchend', function (e) {
    e.preventDefault(); state.active = false; state.dx = 0; state.dy = 0; updateKnob(knob, state, el);
  }, { passive: false });
}
function updateKnob(knob, state, el) { var hw = el.clientWidth / 2 - 25; knob.style.left = (hw + state.dx) + 'px'; knob.style.top = (hw + state.dy) + 'px'; }

function sendOnlineInput() {
  if (!onlineState.inGame || !socket) return;
  var input = { up: false, down: false, left: false, right: false, shoot: false, attack: false };
  if (isMobile() && onlineJoystick.active) {
    if (onlineJoystick.dy < -15) input.up = true; if (onlineJoystick.dy > 15) input.down = true;
    if (onlineJoystick.dx < -15) input.left = true; if (onlineJoystick.dx > 15) input.right = true;
  } else {
    input.up = onlineKeys['w'] || onlineKeys['arrowup'] || false;
    input.down = onlineKeys['s'] || onlineKeys['arrowdown'] || false;
    input.left = onlineKeys['a'] || onlineKeys['arrowleft'] || false;
    input.right = onlineKeys['d'] || onlineKeys['arrowright'] || false;
  }
  if (isMobile() && onlineAimJoystick.active) {
    input.angle = Math.atan2(onlineAimJoystick.dy, onlineAimJoystick.dx);
    input.shoot = true; input.attack = true;
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
  bg: '#1a1a2e', wall: '#374151', wallStroke: '#4b5563',
  player0: '#3b82f6', player1: '#ef4444', player2: '#22c55e', player3: '#f59e0b',
  bullet: '#fbbf24', hp: '#22c55e', hpBg: '#374151', text: '#ffffff'
};

function renderOnlineGame(data) {
  var canvas = document.getElementById('onlineCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = 800, H = 600;

  var me = null;
  data.players.forEach(function (p) {
    if (p.id === onlineState.myId) { onlineMyPos.x = p.x; onlineMyPos.y = p.y; me = p; }
  });
  if (me) { myMoney = me.money || 0; myWeapon = me.weapon || 'pistol'; }

  ctx.fillStyle = data.state.mapColor || GAME_COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx, W, H);

  if (onlineState.gameType === 'shooter') renderShooter(ctx, data, W, H);
  else if (onlineState.gameType === 'tanks') renderTanks(ctx, data, W, H);
  else if (onlineState.gameType === 'arena') renderArena(ctx, data, W, H);

  // kill feed (shooter)
  if (onlineState.gameType === 'shooter' && data.state.killFeed) {
    ctx.save();
    ctx.font = 'bold 11px Inter,sans-serif';
    ctx.textAlign = 'right';
    var feeds = data.state.killFeed.slice(-5);
    feeds.forEach(function (kf, ki) {
      var y = 20 + ki * 16;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W - 210, y - 10, 200, 14);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(kf.killer + ' 🔫 ' + kf.victim, W - 14, y);
    });
    ctx.restore();
  }

  updateHUD(data);
}

function drawGrid(ctx, W, H) {
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  for (var x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (var y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}
function getPlayerColor(idx) { return [GAME_COLORS.player0, GAME_COLORS.player1, GAME_COLORS.player2, GAME_COLORS.player3][idx % 4]; }

function drawWalls(ctx, walls) {
  walls.forEach(function (w) {
    // 3d effect
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(w.x + 3, w.y + 3, w.w, w.h);
    ctx.fillStyle = GAME_COLORS.wall;
    ctx.strokeStyle = GAME_COLORS.wallStroke;
    ctx.lineWidth = 2;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeRect(w.x, w.y, w.w, w.h);
    // detail lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w.x, w.y + w.h / 2); ctx.lineTo(w.x + w.w, w.y + w.h / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w.x + w.w / 2, w.y); ctx.lineTo(w.x + w.w / 2, w.y + w.h); ctx.stroke();
  });
}

function drawHP(ctx, x, y, hp, maxHp, armor) {
  var bw = 44, bh = 5, startY = y - 30;
  ctx.fillStyle = GAME_COLORS.hpBg;
  ctx.fillRect(x - bw / 2, startY, bw, bh);
  ctx.fillStyle = hp > 60 ? GAME_COLORS.hp : hp > 30 ? '#f59e0b' : '#ef4444';
  ctx.fillRect(x - bw / 2, startY, bw * (hp / maxHp), bh);
  if (armor > 0) {
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x - bw / 2, startY + bh, bw * (armor / 100), 2);
  }
}

function drawName(ctx, x, y, name, isMe) {
  ctx.fillStyle = isMe ? '#fbbf24' : '#ffffff';
  ctx.font = 'bold 11px Inter,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(name, x, y - 37);
}

function drawBullets(ctx, bullets) {
  bullets.forEach(function (b) {
    ctx.fillStyle = GAME_COLORS.bullet; ctx.shadowColor = GAME_COLORS.bullet; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    // trail
    ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 2, b.y - b.vy * 2); ctx.stroke();
  });
  ctx.shadowBlur = 0;
}

// ═══ SHOOTER RENDERER (CS2 STYLE) ═══
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

    // body shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(2, 2, 15, 0, Math.PI * 2); ctx.fill();

    // body
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // weapon indicator
    var wepColors = { pistol: '#9ca3af', smg: '#60a5fa', rifle: '#34d399', shotgun: '#f59e0b', sniper: '#a78bfa' };
    ctx.fillStyle = wepColors[p.weapon] || '#d1d5db';
    ctx.fillRect(10, -3, 14, 6);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(22, -1, 3, 2);

    // visor
    ctx.fillStyle = isMe ? '#fbbf24' : '#e5e7eb';
    ctx.beginPath(); ctx.arc(5, 0, 4, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    drawHP(ctx, p.x, p.y, p.hp, 100, p.armor);
    drawName(ctx, p.x, p.y, (p.isBot ? '🤖 ' : '') + (p.name || 'Player'), isMe);

    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  });

  // crosshair for my player
  var me = data.players.find(function (p) { return p.id === onlineState.myId; });
  if (me && !isMobile()) {
    var cx = me.x + Math.cos(me.angle || 0) * 50;
    var cy = me.y + Math.sin(me.angle || 0) * 50;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.stroke();
  }
}

// ═══ TANKS RENDERER ═══
function renderTanks(ctx, data, W, H) {
  drawWalls(ctx, data.state.walls || []);
  drawBullets(ctx, data.state.bullets || []);
  data.players.forEach(function (p, i) {
    if (p.disconnected) return;
    var isMe = p.id === onlineState.myId;
    var color = getPlayerColor(p.team != null ? p.team : i);
    ctx.save(); ctx.translate(p.x, p.y);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.save(); ctx.rotate(p.angle || 0); ctx.fillRect(-14, -10, 32, 24); ctx.restore();
    var bodyAngle = p.angle || 0;
    ctx.save(); ctx.rotate(bodyAngle);
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.fillRect(-16, -12, 32, 24); ctx.shadowBlur = 0;
    ctx.fillStyle = shadeColor(color, -30);
    ctx.fillRect(-18, -14, 6, 28); ctx.fillRect(12, -14, 6, 28);
    ctx.restore();
    var tAngle = p.turretAngle || bodyAngle;
    ctx.save(); ctx.rotate(tAngle);
    ctx.fillStyle = shadeColor(color, 20);
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d1d5db'; ctx.fillRect(6, -2.5, 18, 5);
    ctx.restore(); ctx.restore();
    drawHP(ctx, p.x, p.y, p.hp, 100, 0);
    drawName(ctx, p.x, p.y, (p.isBot ? '🤖 ' : '') + (p.name || 'Tank'), isMe);
  });
}

// ═══ ARENA RENDERER ═══
function renderArena(ctx, data, W, H) {
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 200, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 100, 0, Math.PI * 2); ctx.stroke();
  (data.state.projectiles || []).forEach(function (p) {
    ctx.fillStyle = '#f97316'; ctx.shadowColor = '#f97316'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
  }); ctx.shadowBlur = 0;
  data.players.forEach(function (p, i) {
    if (p.disconnected) return;
    var isMe = p.id === onlineState.myId; var color = getPlayerColor(i);
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.rotate(p.angle || 0);
    ctx.fillStyle = '#e5e7eb'; ctx.fillRect(14, -2, 14, 4);
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(26, -4, 4, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-6, -10, 4, 20);
    ctx.restore();
    if (p.attackCooldown > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2 * (1 - p.attackCooldown / 0.6)); ctx.stroke();
    }
    drawHP(ctx, p.x, p.y, p.hp, 100, 0);
    drawName(ctx, p.x, p.y, (p.isBot ? '🤖 ' : '') + (p.name || 'Jangchi'), isMe);
  });
}

function updateHUD(data) {
  var hud = document.getElementById('onlineHUD');
  if (!hud) return;
  var time = data.state.time || 0;
  var min = Math.floor(time / 60); var sec = time % 60;
  var timeStr = min + ':' + (sec < 10 ? '0' : '') + sec;

  var html = '<span style="color:var(--muted)">⏱ ' + timeStr + '</span>';

  // money for shooter
  var me = data.players.find(function (p) { return p.id === onlineState.myId; });
  if (onlineState.gameType === 'shooter' && me) {
    var wInfo = WEAPONS_INFO[me.weapon] || {};
    html += '<span style="color:#22c55e;font-size:.8rem">💰 $' + (me.money || 0) + '</span>';
    html += '<span style="font-size:.8rem">' + (wInfo.icon || '🔫') + ' ' + (wInfo.name || 'Pistolet') + '</span>';
    if (me.armor > 0) html += '<span style="color:#3b82f6;font-size:.75rem">🛡️' + me.armor + '</span>';
  }

  data.players.forEach(function (p, i) {
    var color = getPlayerColor(p.team != null ? p.team : i);
    var isMe = p.id === onlineState.myId;
    html += '<span style="color:' + color + ';' + (isMe ? 'text-decoration:underline;' : '') + 'font-size:.85rem">' + p.name + ': ' + p.score + (p.deaths > 0 ? '/' + p.deaths : '') + '</span>';
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
  var buyEl = document.getElementById('buyMenu');
  if (buyEl) buyEl.style.display = 'none';
  var mm = document.getElementById('onlineMatchmaking');
  mm.style.display = 'block';

  var me = data.players.find(function (p) { return p.id === onlineState.myId; });
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
  html += '<button class="btn btn-sm btn-primary" onclick="backToOnlineLobby()">🏠 Bosh sahifa</button> ';
  html += '</div>';
  mm.innerHTML = html;
}

function shadeColor(color, percent) {
  var num = parseInt(color.replace('#', ''), 16);
  var r = Math.min(255, Math.max(0, (num >> 16) + percent));
  var g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  var b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}
