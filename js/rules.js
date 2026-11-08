// Reglas de bola 8, bola 9 y bola 10 (versión de bar, simplificada)
const Rules = (() => {
  const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
  const STRIPES = [9, 10, 11, 12, 13, 14, 15];
  const groupOf = n => (n >= 1 && n <= 7) ? 'lisas' : (n >= 9 && n <= 15) ? 'rayadas' : null;
  const groupBalls = g => g === 'lisas' ? SOLIDS : STRIPES;

  // Posiciones del rack: filas desde el vértice (el más cercano a la blanca) hacia atrás
  const RACKS = {
    8: [[1], [9, 2], [10, 8, 3], [11, 4, 12, 5], [13, 6, 14, 15, 7]],
    9: [[1], [2, 3], [4, 9, 5], [6, 7], [8]],
    10: [[1], [2, 3], [4, 10, 5], [6, 7, 8, 9]],
  };

  function rack(seed, game) {
    // Pequeño desorden reproducible para que cada saque sea distinto
    let s = seed >>> 0 || 1;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const R = Table.R, gap = 0.6;
    const balls = [{ n: 0, x: 144, y: Table.HEAD_Y, vx: 0, vy: 0, on: true }];
    RACKS[game].forEach((row, r) => {
      row.forEach((n, j) => {
        balls.push({
          n,
          x: Table.FOOT.x + (j - (row.length - 1) / 2) * (2 * R + gap) + (rnd() - 0.5) * 0.05,
          y: Table.FOOT.y - r * (2 * R + gap) * 0.866,
          vx: 0, vy: 0, on: true,
        });
      });
    });
    return balls;
  }

  // np = 2 (uno contra uno) o 4 (dos contra dos). Equipo de cada jugador = índice % 2.
  // game = 8, 9 o 10 (bola 8, bola 9, bola 10)
  function newGame(seed, firstTurn, np, game) {
    game = game === 9 || game === 10 ? game : 8;
    return {
      game,
      balls: rack(seed, game),
      np: np === 4 ? 4 : 2,
      turn: firstTurn || 0,
      groups: [null, null],
      ballInHand: true,
      kitchen: true,
      isBreak: true,
      winner: null,
      msg: 'SAQUE',
      shots: 0,
    };
  }

  const ball = (st, n) => st.balls.find(b => b.n === n);
  const remaining = (st, g) => groupBalls(g).filter(n => ball(st, n).on).length;
  const team = i => i % 2;

  function startShot(st) {
    const g = st.groups[team(st.turn)];
    return { firstHit: null, pocketed: [], clearedBefore: g ? remaining(st, g) === 0 : false, lowestBefore: lowest(st) };
  }

  function canPlaceCue(st, x, y) {
    const R = Table.R;
    if (x < Table.L + R || x > Table.Rt - R || y < Table.T + R || y > Table.B - R) return false;
    if (st.kitchen && y < Table.HEAD_Y) return false;
    for (const b of st.balls) {
      if (!b.on || b.n === 0) continue;
      const dx = b.x - x, dy = b.y - y;
      if (dx * dx + dy * dy < (2 * R + 0.5) * (2 * R + 0.5)) return false;
    }
    return true;
  }

  function respot(st, n) {
    const b = ball(st, n);
    let y = Table.FOOT.y;
    const free = yy => st.balls.every(o => !o.on || o === b || (o.x - 144) * (o.x - 144) + (o.y - yy) * (o.y - yy) >= 4 * Table.R * Table.R);
    while (!free(y) && y > Table.T + Table.R) y -= 1;
    b.x = 144; b.y = y; b.vx = 0; b.vy = 0; b.on = true;
  }

  function placeCueDefault(st) {
    const cue = ball(st, 0);
    cue.on = true; cue.vx = 0; cue.vy = 0;
    const tries = [[144, Table.HEAD_Y]];
    for (let r = 12; r < 200; r += 12) tries.push([144 - r, Table.HEAD_Y], [144 + r, Table.HEAD_Y], [144, Table.HEAD_Y + r / 2], [144, Table.HEAD_Y - r]);
    for (const [x, y] of tries) if (canPlaceCue(st, x, y)) { cue.x = x; cue.y = y; return; }
  }

  // Bola 9 y bola 10: siempre se toca primero la bola más baja; gana quien mete la bola del juego
  const lowest = st => st.balls.filter(b => b.on && b.n !== 0).reduce((m, b) => Math.min(m, b.n), 99);

  function resolveRotation(st, shot) {
    const me = team(st.turn), next = (st.turn + 1) % st.np;
    const target = shot.lowestBefore;
    const cueIn = shot.pocketed.includes(0);
    const objects = shot.pocketed.filter(n => n !== 0);
    let foul = false, why = '';
    if (shot.firstHit === null) { foul = true; why = 'NO TOCÓ NINGUNA BOLA'; }
    else if (shot.firstHit !== target) { foul = true; why = 'HABÍA QUE TOCAR LA ' + target; }
    if (cueIn) { foul = true; why = 'METIÓ LA BLANCA'; }
    st.isBreak = false; st.kitchen = false; st.shots++;

    if (objects.includes(st.game)) {
      if (!foul) { st.winner = me; st.msg = 'METIÓ LA ' + st.game; return st; }
      respot(st, st.game);
    }
    if (cueIn) placeCueDefault(st);
    if (foul) { st.turn = next; st.ballInHand = true; st.msg = 'FALTA: ' + why; }
    else if (objects.length) { st.ballInHand = false; st.msg = 'SIGUE JUGANDO'; }
    else { st.turn = next; st.ballInHand = false; st.msg = ''; }
    return st;
  }

  // Se llama cuando todas las bolas se detienen
  function resolve(st, shot) {
    if (st.game === 9 || st.game === 10) return resolveRotation(st, shot);
    const me = team(st.turn), other = 1 - me;
    const next = (st.turn + 1) % st.np;
    const cueIn = shot.pocketed.includes(0);
    const eightIn = shot.pocketed.includes(8);
    const objects = shot.pocketed.filter(n => n !== 0 && n !== 8);
    let g = st.groups[me];
    let foul = false, why = '';

    if (shot.firstHit === null) { foul = true; why = 'NO TOCÓ NINGUNA BOLA'; }
    else if (g) {
      const target = shot.clearedBefore ? 8 : null;
      if (target === 8 ? shot.firstHit !== 8 : groupOf(shot.firstHit) !== g) { foul = true; why = 'TOCÓ PRIMERO UNA BOLA AJENA'; }
    } else if (shot.firstHit === 8 && !st.isBreak) { foul = true; why = 'NO SE TOCA LA 8 PRIMERO'; }
    if (cueIn) { foul = true; why = 'METIÓ LA BLANCA'; }

    const wasBreak = st.isBreak;
    st.isBreak = false; st.kitchen = false; st.shots++;

    if (eightIn) {
      if (wasBreak) { respot(st, 8); }
      else {
        const ok = g && shot.clearedBefore && !foul;
        st.winner = ok ? me : other;
        st.msg = ok ? 'METIÓ LA 8' : (g && shot.clearedBefore ? 'FALTA CON LA 8' : 'METIÓ LA 8 ANTES DE TIEMPO');
        return st;
      }
    }

    if (!g && !foul && !wasBreak && objects.length) {
      g = groupOf(objects[0]);
      st.groups[me] = g;
      st.groups[other] = g === 'lisas' ? 'rayadas' : 'lisas';
    }

    const scored = g ? objects.some(n => groupOf(n) === g) : objects.length > 0;
    if (cueIn) placeCueDefault(st);

    if (foul) {
      st.turn = next; st.ballInHand = true;
      st.msg = 'FALTA: ' + why;
    } else if (scored) {
      st.ballInHand = false;
      st.msg = 'SIGUE JUGANDO';
    } else {
      st.turn = next; st.ballInHand = false;
      st.msg = '';
    }
    return st;
  }

  return { newGame, team, lowest, startShot, resolve, canPlaceCue, groupOf, groupBalls, remaining, ball };
})();
