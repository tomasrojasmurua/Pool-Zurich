// Pool Zurich: pantalla, controles y flujo del juego
(() => {
  const W = 360, H = 640;
  const TX = 36, TY = 84;              // posición de la mesa en pantalla
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---------- Recursos ----------
  const IMG = {};
  const files = {
    fondo: 'assets/fondo-bar.png', mesa: 'assets/mesa.png', bolas: 'assets/bolas-10.png',
    bolasG: 'assets/bolas-32.png', logo: 'assets/logo.png', inicio: 'assets/inicio.png',
    taco0: 'assets/tacos/taco-clasico.png', taco1: 'assets/tacos/taco-negro.png',
    taco2: 'assets/tacos/taco-llamas.png', taco3: 'assets/tacos/taco-negro.png',
    av0: 'assets/personajes/avatar-campeona.png', av1: 'assets/personajes/avatar-tiburon.png',
    av2: 'assets/personajes/avatar-dueno.png', av3: 'assets/personajes/avatar-novata.png',
    btn: 'assets/ui/boton-normal.png', btnP: 'assets/ui/boton-presionado.png', btnD: 'assets/ui/boton-desactivado.png',
    pizarra: 'assets/ui/pizarra.png', barra: 'assets/ui/barra-potencia.png', tri: 'assets/ui/triangulo.png',
    casa: 'assets/ui/icono-inicio.png', son: 'assets/ui/icono-sonido.png', sil: 'assets/ui/icono-silencio.png',
    ficha: 'assets/ui/ficha-turno.png', tiza: 'assets/ui/tiza.png', trofeo: 'assets/ui/icono-trofeo.png',
  };
  const load = Object.entries(files).map(([k, src]) => new Promise(res => {
    const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = res; im.src = src;
  }));
  const NAMES = ['CAMPEONA', 'TIBURON', 'DUEÑO', 'NOVATA'];   // jugadores pares = equipo A, impares = equipo B

  // ---------- Sonido (sintetizado) ----------
  let actx = null, muted = false, lastSnd = 0;
  function sfx(kind, vol) {
    if (!actx || muted) return;
    const now = actx.currentTime;
    if (kind !== 'pocket' && now - lastSnd < 0.03) return;
    lastSnd = now;
    const o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    const v = Math.min(0.5, 0.05 + vol * 0.05);
    if (kind === 'ball') { o.type = 'triangle'; o.frequency.setValueAtTime(1800, now); o.frequency.exponentialRampToValueAtTime(900, now + 0.04); g.gain.setValueAtTime(v, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06); o.start(now); o.stop(now + 0.07); }
    else if (kind === 'wall') { o.type = 'sine'; o.frequency.setValueAtTime(180, now); g.gain.setValueAtTime(v * 0.8, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08); o.start(now); o.stop(now + 0.09); }
    else if (kind === 'pocket') { o.type = 'sine'; o.frequency.setValueAtTime(240, now); o.frequency.exponentialRampToValueAtTime(70, now + 0.25); g.gain.setValueAtTime(0.35, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.3); o.start(now); o.stop(now + 0.32); }
    else if (kind === 'cue') { o.type = 'square'; o.frequency.setValueAtTime(500, now); o.frequency.exponentialRampToValueAtTime(200, now + 0.03); g.gain.setValueAtTime(v * 0.5, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.05); o.start(now); o.stop(now + 0.06); }
  }

  // ---------- Estado ----------
  let screen = 'menu';        // menu | lobby | game
  let mode = 'local';         // local | online
  let me = 0;                 // en online, qué jugador soy
  let st = null;              // estado del juego (reglas)
  let phase = 'aim';          // aim | moving | wait
  let shot = null, pendingSync = null, iShot = false;
  let aim = { x: 0, y: -1 }, pull = 0;
  let remoteAim = null;
  let lobby = { text: '', code: '', players: 1 };
  let toast = '', toastT = 0;
  let tick = 0;

  const unaccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const canControl = () => screen === 'game' && phase === 'aim' && st && st.winner === null && (mode === 'local' || st.turn === me);
  const cue = () => Rules.ball(st, 0);

  let gameType = 8;           // juego elegido en el menú: 8, 9 o 10
  const GAMES = [8, 9, 10, 'orden'];
  const gameName = g => g === 'orden' ? 'POOL 61' : 'BOLA ' + g;
  function startGame(seed, first, np, game) {
    st = Rules.newGame(seed, first, np, game || gameType);
    phase = 'aim'; shot = null; pendingSync = null; pull = 0; aim = { x: 0, y: -1 }; remoteAim = null;
    screen = 'game';
  }

  function shoot(power) {
    const c = cue();
    const speed = 0.6 + power * power * 6 + power * 14;
    const data = { t: 'shot', cx: c.x, cy: c.y, dx: aim.x, dy: aim.y, sp: speed };
    if (mode === 'online') Net.send(data);
    iShot = true;
    applyShot(data);
  }

  function applyShot(d) {
    const c = cue();
    c.x = d.cx; c.y = d.cy; c.on = true;
    shot = Rules.startShot(st);
    c.vx = d.dx * d.sp; c.vy = d.dy * d.sp;
    st.ballInHand = false;
    phase = 'moving'; pull = 0; remoteAim = null;
    sfx('cue', d.sp);
  }

  function finishShot() {
    if (mode === 'online' && !iShot) {
      if (pendingSync) { applySync(pendingSync); pendingSync = null; } else phase = 'wait';
      return;
    }
    Rules.resolve(st, shot);
    shot = null; phase = 'aim'; iShot = false;
    if (mode === 'online') Net.send({ t: 'sync', st });
    afterResolve();
  }

  function applySync(s) {
    st = s; shot = null; phase = 'aim'; iShot = false;
    afterResolve();
  }

  function afterResolve() {
    if (st.msg) { toast = st.msg; toastT = 150; }
    if (st.winner === null) aim = defaultAim();
  }

  function defaultAim() {
    const c = cue();
    const dx = 144 - c.x, dy = Table.FOOT.y - c.y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  // ---------- Red ----------
  const netHandlers = {
    room: code => { lobby.code = code; lobby.text = 'COMPARTE ESTE CODIGO'; },
    players: n => { lobby.players = n; },
    locked: () => screen === 'game',
    left: n => {
      lobby.players = n;
      if (screen === 'game') { Net.send({ t: 'bye' }); Net.leave(); screen = 'menu'; st = null; toast = 'UN JUGADOR SE DESCONECTO'; toastT = 200; }
    },
    open: () => { lobby.text = 'CONECTADO'; },
    data: d => {
      if (d.t === 'start') { if (d.me !== undefined) me = d.me; startGame(d.seed, d.first, d.np, d.game); }
      else if (d.t === 'bye') netHandlers.close();
      else if (d.t === 'shot') { iShot = false; applyShot(d); }
      else if (d.t === 'sync') { if (phase === 'moving') pendingSync = d.st; else applySync(d.st); }
      else if (d.t === 'aim') remoteAim = d;
    },
    close: () => {
      if (screen !== 'menu') { Net.leave(); screen = 'menu'; st = null; toast = 'UN JUGADOR SE DESCONECTO'; toastT = 200; }
    },
    error: e => {
      Net.leave(); screen = 'menu';
      toast = e && e.type === 'peer-unavailable' ? 'NO EXISTE ESA SALA' : 'ERROR DE CONEXION'; toastT = 200;
    },
  };

  function hostOnline() { mode = 'online'; me = 0; screen = 'lobby'; lobby = { text: 'CREANDO SALA...', code: '', players: 1 }; Net.host(netHandlers); }
  // El anfitrión empieza la partida (con 2 o 4 jugadores conectados)
  function startOnline() {
    const np = Net.count();
    if (np !== 2 && np !== 4) return;
    const seed = (Math.random() * 1e9) | 0;
    Net.sendEach(i => ({ t: 'start', seed, first: 0, np, me: i + 1, game: gameType }));
    me = 0;
    startGame(seed, 0, np, gameType);
  }
  function joinOnline() {
    const c = (prompt('Código de la sala (4 letras):') || '').trim().toUpperCase();
    if (c.length !== 4) return;
    mode = 'online'; me = 1; screen = 'lobby'; lobby = { text: 'CONECTANDO...', code: c, players: 0 };
    Net.join(c, netHandlers);
  }
  function toMenu() { if (mode === 'online') Net.leave(); screen = 'menu'; st = null; }

  // ---------- Bucle principal ----------
  let acc = 0, last = performance.now();
  function loop(t) {
    acc += Math.min(100, t - last); last = t;
    while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
    draw();
    requestAnimationFrame(loop);
  }

  function update() {
    tick++;
    if (toastT > 0) toastT--;
    if (screen === 'game' && phase === 'moving') {
      const r = Physics.step(st.balls, shot);
      for (const e of r.events) sfx(e.type, e.speed || 1);
      if (!r.moving) finishShot();
    }
  }

  // ---------- Dibujo ----------
  function txt(s, x, y, color = '#fff', align = 'left', size = 8) {
    s = unaccent(String(s));
    ctx.font = size + 'px "Press Start 2P", monospace';
    ctx.textAlign = align; ctx.textBaseline = 'top';
    ctx.fillStyle = '#000'; ctx.fillText(s, x + 1, y + 1);
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }

  let buttons = [], pressed = null;
  function button(label, x, y, cb, disabled) {
    const img = disabled ? IMG.btnD : (pressed && pressed.label === label ? IMG.btnP : IMG.btn);
    if (img) ctx.drawImage(img, x, y, 208, 60);
    txt(label, x + 104, y + 22, disabled ? '#999' : '#fff', 'center', 16);
    if (!disabled) buttons.push({ label, x, y, w: 208, h: 60, cb });
  }

  function drawBall(n, x, y, alpha = 1) {
    if (!IMG.bolas) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(IMG.bolas, n * 10, 0, 10, 10, Math.round(x - 5), Math.round(y - 5), 10, 10);
    ctx.globalAlpha = 1;
  }

  function draw() {
    buttons = [];
    ctx.imageSmoothingEnabled = false;
    if (screen === 'menu' || screen === 'lobby') drawMenu();
    else drawGame();
    if (toastT > 0 && screen !== 'game') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 300, W, 30);
      txt(toast, W / 2, 311, '#ff6fb5', 'center');
    }
  }

  function drawMenu() {
    if (IMG.inicio) ctx.drawImage(IMG.inicio, 0, 0);
    if (IMG.logo) ctx.drawImage(IMG.logo, 20, 16);
    txt('POOL ZURICH', 180, 72, '#ffe9a8', 'center', 16);
    if (screen === 'menu') {
      button('< ' + gameName(gameType) + ' >', 76, 280, () => { gameType = GAMES[(GAMES.indexOf(gameType) + 1) % GAMES.length]; });
      txt(gameType === 8 ? 'LISAS CONTRA RAYADAS' : gameType === 'orden' ? 'BOLAS EN LOS DIAMANTES, EN ORDEN' : 'TOCA SIEMPRE LA MAS BAJA', 180, 342, '#ffe9a8', 'center');
      button('2 JUGADORES', 76, 356, () => { mode = 'local'; startGame((Math.random() * 1e9) | 0, 0, 2); });
      button('4 JUGADORES', 76, 422, () => { mode = 'local'; startGame((Math.random() * 1e9) | 0, 0, 4); });
      button('CREAR SALA', 76, 488, hostOnline);
      button('UNIRSE', 76, 554, joinOnline);
      txt('4 JUGADORES = 2 CONTRA 2', 180, 622, '#ccc', 'center');
      txt('V' + VERSION, 356, 4, '#aaa', 'right');
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
      const px = (W - 226) / 2, py = 190;
      if (IMG.pizarra) ctx.drawImage(IMG.pizarra, px, py, 226, 194);
      txt('SALA ONLINE', 180, py + 50, '#ffe9a8', 'center');
      if (lobby.code) txt(lobby.code, 180, py + 82, '#fff', 'center', 32);
      txt(lobby.text, 180, py + 124, '#cfe', 'center');
      if (me === 0 && lobby.code) {
        const n = lobby.players;
        txt('JUGADORES: ' + n + '/4', 180, py + 142, '#fff', 'center');
        txt(n === 3 ? 'FALTA 1 PARA EL 2 VS 2' : n === 1 ? 'ESPERANDO JUGADORES...' : 'LISTOS PARA JUGAR', 180, py + 158, '#cfe', 'center');
        button('EMPEZAR', 76, 400, startOnline, n !== 2 && n !== 4);
      } else if (me !== 0 && lobby.text === 'CONECTADO') {
        txt('ESPERANDO AL ANFITRION', 180, py + 142, '#cfe', 'center');
      }
      button('CANCELAR', 76, 470, toMenu);
    }
  }

  function drawGame() {
    if (IMG.fondo) ctx.drawImage(IMG.fondo, 0, 0);
    if (IMG.mesa) ctx.drawImage(IMG.mesa, TX, TY);

    // Triángulo antes del saque
    if (st.game === 8 && st.isBreak && phase === 'aim' && IMG.tri) {
      ctx.save(); ctx.translate(TX + 144, TY + Table.FOOT.y - 17); ctx.scale(1, -1);
      ctx.drawImage(IMG.tri, -33, -28); ctx.restore();
    }

    for (const b of st.balls) if (b.on) drawBall(b.n, TX + b.x, TY + b.y);

    // Mira y taco
    const c = cue();
    let a = null, p = 0;
    if (canControl()) { a = aim; p = pull; }
    else if (remoteAim && phase === 'aim') { a = { x: remoteAim.dx, y: remoteAim.dy }; p = remoteAim.p; c.x = remoteAim.cx; c.y = remoteAim.cy; }
    if (a && c.on) {
      if (canControl() && st.ballInHand) {
        const ok = Rules.canPlaceCue(st, c.x, c.y);
        ctx.strokeStyle = ok ? 'rgba(120,255,200,0.9)' : 'rgba(255,80,80,0.9)';
        ctx.beginPath(); ctx.arc(TX + c.x, TY + c.y, 8 + (tick >> 3) % 2, 0, Math.PI * 2); ctx.stroke();
      }
      const hit = Physics.castRay(st.balls, c, a.x, a.y);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let d = 7; d < hit.t; d += 4) ctx.fillRect(Math.round(TX + c.x + a.x * d), Math.round(TY + c.y + a.y * d), 1, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(Math.round(TX + hit.x) + 0.5, Math.round(TY + hit.y) + 0.5, 4.5, 0, Math.PI * 2); ctx.stroke();
      if (hit.ball) {
        const nx = hit.ball.x - hit.x, ny = hit.ball.y - hit.y, nd = Math.hypot(nx, ny) || 1;
        ctx.fillStyle = 'rgba(255,240,120,0.9)';
        for (let d = 6; d < 26; d += 3) ctx.fillRect(Math.round(TX + hit.ball.x + nx / nd * d), Math.round(TY + hit.ball.y + ny / nd * d), 1, 1);
      }
      const taco = IMG['taco' + st.turn];
      if (taco) {
        ctx.save(); ctx.translate(TX + c.x, TY + c.y); ctx.rotate(Math.atan2(a.y, a.x));
        ctx.drawImage(taco, -(Table.R + 3 + p * 30) - taco.width, -Math.floor(taco.height / 2));
        ctx.restore();
      }
    }

    drawHud();
  }

  function drawHud() {
    // Jugadores / equipos
    const pulse = (tick >> 4) % 2 ? '#ff4fb0' : '#3ff0d8';
    for (let t = 0; t < 2; t++) {
      const nx = t === 0 ? 76 : 284, al = t === 0 ? 'left' : 'right';
      const g = st.groups[t];
      let ballX0, ballY;
      if (st.np === 2) {
        const ax = t === 0 ? 6 : 290;
        if (IMG['av' + t]) ctx.drawImage(IMG['av' + t], ax, 10);
        if (st.turn === t && st.winner === null) { ctx.strokeStyle = pulse; ctx.lineWidth = 2; ctx.strokeRect(ax - 1, 9, 66, 66); ctx.lineWidth = 1; }
        txt(NAMES[t] + (mode === 'online' && t === me ? ' (TU)' : ''), nx, 12, st.turn === t ? '#ffe9a8' : '#bbb', al);
        if (g) txt(g.toUpperCase(), nx, 26, '#9fd', al);
        ballX0 = t === 0 ? 81 : 279; ballY = 46;
      } else {
        [t, t + 2].forEach((i, k) => {
          const ax = t === 0 ? 6 + k * 36 : 322 - k * 36;
          if (IMG['av' + i]) ctx.drawImage(IMG['av' + i], ax, 6, 32, 32);
          if (st.turn === i && st.winner === null) { ctx.strokeStyle = pulse; ctx.lineWidth = 2; ctx.strokeRect(ax - 1, 5, 34, 34); ctx.lineWidth = 1; }
          if (mode === 'online' && i === me) txt('TU', ax + 16, 40, '#ffe9a8', 'center');
        });
        const tx = t === 0 ? 82 : 278;
        txt('EQUIPO ' + (t === 0 ? 'A' : 'B'), tx, 8, Rules.team(st.turn) === t ? '#ffe9a8' : '#bbb', al);
        if (g) txt(g.toUpperCase(), tx, 22, '#9fd', al);
        ballX0 = t === 0 ? 11 : 349; ballY = 60;
      }
      if (g) {
        const balls = Rules.remaining(st, g) === 0 ? [8] : Rules.groupBalls(g);
        balls.forEach((n, k) => {
          const bx = t === 0 ? ballX0 + k * 11 : ballX0 - (balls.length - 1 - k) * 11;
          drawBall(n, bx, ballY, Rules.ball(st, n).on ? 1 : 0.25);
        });
      }
    }

    // Bola 9 / bola 10 / en orden: bola objetivo y bolas que quedan
    if (st.game !== 8) {
      const target = Rules.lowest(st);
      const last = st.game === 'orden' ? 15 : st.game;
      if (IMG.bolasG && target < 99) ctx.drawImage(IMG.bolasG, target * 32, 0, 32, 32, 164, 26, 32, 32);
      for (let n = 1; n <= last; n++) drawBall(n, 180 + (n - (last + 1) / 2) * 11, 68, Rules.ball(st, n).on ? 1 : 0.25);
    }
    if (st.game === 'orden') {
      for (let t = 0; t < 2; t++) {
        const x = st.np === 2 ? (t === 0 ? 76 : 284) : (t === 0 ? 82 : 278);
        txt(st.points[t] + ' PTS', x, st.np === 2 ? 26 : 22, '#9fd', t === 0 ? 'left' : 'right');
      }
    }

    // Botones laterales
    if (IMG.casa) ctx.drawImage(IMG.casa, 2, 92);
    const s = muted ? IMG.sil : IMG.son;
    if (s) ctx.drawImage(s, 2, 128);
    if (IMG.tiza) ctx.drawImage(IMG.tiza, 2, 168);

    // Barra de potencia
    const bx = 330, by = 300;
    if (IMG.barra) ctx.drawImage(IMG.barra, bx, by);
    const showP = canControl() ? pull : (remoteAim ? remoteAim.p : 0);
    if (showP > 0) {
      const h = Math.round(97 * showP);
      ctx.fillStyle = showP > 0.75 ? '#ff4040' : showP > 0.4 ? '#ffb030' : '#50e070';
      ctx.fillRect(bx + 7, by + 9, 9, h);
    }
    txt('TIRA', bx + 12, by + 120, '#ffe9a8', 'center');

    // Mensajes abajo
    let line1, line2 = '';
    if (st.winner !== null) line1 = '';
    else if (mode === 'online') line1 = st.turn === me ? 'TU TURNO' : 'TURNO: ' + NAMES[st.turn];
    else line1 = 'TURNO: ' + NAMES[st.turn];
    if (st.winner === null && st.game !== 8) line1 = gameName(st.game) + ' - ' + line1;
    if (phase === 'wait') line2 = 'SINCRONIZANDO...';
    else if (toastT > 0) line2 = toast;
    else if (canControl() && st.ballInHand) line2 = 'BOLA EN MANO: MUEVE LA BLANCA';
    else if (canControl()) line2 = 'APUNTA EN LA MESA, TIRA LA BARRA';
    txt(line1, 180, 604, '#ffe9a8', 'center');
    txt(line2, 180, 620, toastT > 0 && line2.startsWith('FALTA') ? '#ff6f6f' : '#fff', 'center');

    if (st.winner !== null) drawGameOver();
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    const px = (W - 226) / 2, py = 150;
    if (IMG.pizarra) ctx.drawImage(IMG.pizarra, px, py, 226, 194);
    if (IMG.trofeo) ctx.drawImage(IMG.trofeo, 164, py + 46);
    const who = mode === 'online' ? (st.winner === Rules.team(me) ? 'GANASTE!' : 'PERDISTE')
      : st.np === 4 ? 'GANA EQUIPO ' + (st.winner === 0 ? 'A' : 'B') : 'GANA ' + NAMES[st.winner];
    txt(who, 180, py + 82, '#ffe9a8', 'center', 16);
    if (st.np === 4) txt(NAMES[st.winner] + ' Y ' + NAMES[st.winner + 2], 180, py + 106, '#fff', 'center');
    txt(st.msg, 180, py + 128, '#cfe', 'center');
    button('REVANCHA', 76, 370, () => {
      const seed = (Math.random() * 1e9) | 0, first = 1 - st.winner;
      if (mode === 'online') Net.send({ t: 'start', seed, first, np: st.np, game: st.game });
      startGame(seed, first, st.np, st.game);
    }, mode === 'online' && me !== 0);
    button('MENU', 76, 440, toMenu);
  }

  // ---------- Controles ----------
  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  let drag = null, lastAimSend = 0;
  function sendAim(force) {
    if (mode !== 'online' || !canControl()) return;
    const now = performance.now();
    if (!force && now - lastAimSend < 80) return;
    lastAimSend = now;
    const c = cue();
    Net.send({ t: 'aim', dx: aim.x, dy: aim.y, p: pull, cx: c.x, cy: c.y });
  }
  function setAimTo(p) {
    const c = cue();
    const dx = p.x - TX - c.x, dy = p.y - TY - c.y, d = Math.hypot(dx, dy);
    if (d > 3) aim = { x: dx / d, y: dy / d };
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (er) {} }
    if (actx && actx.state === 'suspended') actx.resume();
    canvas.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    for (const b of buttons) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { pressed = b; drag = { mode: 'button' }; return; }
    if (screen !== 'game' || !st || st.winner !== null) return;
    if (p.x < 36 && p.y >= 92 && p.y < 124) { if (confirm('¿Salir al menú?')) toMenu(); return; }
    if (p.x < 36 && p.y >= 128 && p.y < 160) { muted = !muted; return; }
    if (!canControl()) return;
    const c = cue();
    if (p.x >= 322 && p.y > 250 && p.y < 450) { drag = { mode: 'power', y0: p.y }; return; }
    if (st.ballInHand && Math.hypot(p.x - TX - c.x, p.y - TY - c.y) < 16) { drag = { mode: 'place', ox: c.x - (p.x - TX), oy: c.y - (p.y - TY), sx: c.x, sy: c.y }; return; }
    if (p.y > TY - 10 && p.y < TY + 522) { drag = { mode: 'aim' }; setAimTo(p); sendAim(); }
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = toCanvas(e);
    if (drag.mode === 'aim') { setAimTo(p); sendAim(); }
    else if (drag.mode === 'power') { pull = Math.max(0, Math.min(1, (p.y - drag.y0) / 110)); sendAim(); }
    else if (drag.mode === 'place') {
      const c = cue();
      const nx = p.x - TX + drag.ox, ny = p.y - TY + drag.oy;
      if (Rules.canPlaceCue(st, nx, ny)) { c.x = nx; c.y = ny; }
      sendAim();
    }
  });
  const end = e => {
    if (!drag) return;
    const p = toCanvas(e);
    if (drag.mode === 'button' && pressed) {
      const b = pressed; pressed = null;
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) b.cb();
    } else if (drag.mode === 'power') {
      if (pull > 0.04 && canControl()) shoot(pull); else { pull = 0; sendAim(true); }
    } else if (drag.mode === 'place') {
      sendAim(true);
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', () => { drag = null; pressed = null; pull = 0; });

  function resize() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    canvas.style.width = Math.floor(W * s) + 'px';
    canvas.style.height = Math.floor(H * s) + 'px';
  }
  addEventListener('resize', resize); resize();

  // Para pruebas automáticas
  window.__pool = { get st() { return st; }, startGame, shoot: p => shoot(p), setAim: (x, y) => { const d = Math.hypot(x, y); aim = { x: x / d, y: y / d }; }, get phase() { return phase; }, get lobby() { return lobby; }, get me() { return me; } };

  const fontReady = (document.fonts ? document.fonts.load('8px "Press Start 2P"') : Promise.resolve()).catch(() => {});
  Promise.all([...load, fontReady]).then(() => requestAnimationFrame(loop));
})();
