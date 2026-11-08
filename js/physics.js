// Física de la mesa. Coordenadas en píxeles del sprite de la mesa (288 x 512).
// Solo usa + - * / y Math.sqrt para que dos celulares simulen igual.
const Table = (() => {
  const R = 5;                 // radio de bola
  const L = 28, Rt = 260;      // bandas izquierda y derecha (borde de la goma)
  const T = 30, B = 482;       // bandas superior e inferior
  const MIDY = 249;            // altura de las troneras del medio
  const GAP_C = 14, GAP_M = 11;
  const pockets = [
    { x: 25, y: 26, r: 11 }, { x: 263, y: 26, r: 11 },
    { x: 18, y: MIDY, r: 11 }, { x: 270, y: MIDY, r: 11 },
    { x: 25, y: 486, r: 11 }, { x: 263, y: 486, r: 11 },
  ];
  // Segmentos de banda: eje, coordenada fija, desde, hasta, sentido de la normal
  const walls = [
    { axis: 'x', c: L, a: T + GAP_C, b: MIDY - GAP_M, n: 1 },
    { axis: 'x', c: L, a: MIDY + GAP_M, b: B - GAP_C, n: 1 },
    { axis: 'x', c: Rt, a: T + GAP_C, b: MIDY - GAP_M, n: -1 },
    { axis: 'x', c: Rt, a: MIDY + GAP_M, b: B - GAP_C, n: -1 },
    { axis: 'y', c: T, a: L + GAP_C, b: Rt - GAP_C, n: 1 },
    { axis: 'y', c: B, a: L + GAP_C, b: Rt - GAP_C, n: -1 },
  ];
  const jaws = [];
  for (const w of walls) {
    if (w.axis === 'x') { jaws.push({ x: w.c, y: w.a }, { x: w.c, y: w.b }); }
    else { jaws.push({ x: w.a, y: w.c }, { x: w.b, y: w.c }); }
  }
  const FOOT = { x: 144, y: T + (B - T) * 0.25 };
  const HEAD_Y = T + (B - T) * 0.75;
  return { R, L, Rt, T, B, MIDY, pockets, walls, jaws, FOOT, HEAD_Y };
})();

const Physics = (() => {
  const { R } = Table;
  const SUB = 8, SLOP = 0;
  const BALL_E = 0.96, WALL_E = 0.72, JAW_E = 0.6;

  // Avanza un paso (1/60 s). Devuelve eventos para sonido y reglas.
  function step(balls, shot) {
    const events = [];
    for (let s = 0; s < SUB; s++) {
      for (const b of balls) {
        if (!b.on) continue;
        b.x += b.vx / SUB; b.y += b.vy / SUB;
      }
      // Choques entre bolas (varias pasadas para que el impacto se reparta en el triángulo)
      for (let pass = 0; pass < 1; pass++)
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i]; if (!a.on) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j]; if (!b.on) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= (2 * R + SLOP) * (2 * R + SLOP) || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          const over = d < 2 * R ? (2 * R - d) / 2 : 0;
          a.x -= nx * over; a.y -= ny * over; b.x += nx * over; b.y += ny * over;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0.0001) {
            const imp = rel * (1 + BALL_E) / 2;
            a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
            events.push({ type: 'ball', a: a.n, b: b.n, speed: rel });
            if (shot && shot.firstHit === null) {
              if (a.n === 0) shot.firstHit = b.n; else if (b.n === 0) shot.firstHit = a.n;
            }
          }
        }
      }
      // Bandas, troneras
      for (const b of balls) {
        if (!b.on) continue;
        for (const w of Table.walls) {
          if (w.axis === 'x') {
            if (b.y < w.a || b.y > w.b) continue;
            const pen = w.n > 0 ? (w.c + R) - b.x : b.x - (w.c - R);
            if (pen > 0 && pen < 3 * R) {
              b.x = w.c + w.n * R;
              if (b.vx * w.n < 0) { events.push({ type: 'wall', speed: Math.abs(b.vx) }); b.vx = -b.vx * WALL_E; b.vy *= 0.97; }
            }
          } else {
            if (b.x < w.a || b.x > w.b) continue;
            const pen = w.n > 0 ? (w.c + R) - b.y : b.y - (w.c - R);
            if (pen > 0 && pen < 3 * R) {
              b.y = w.c + w.n * R;
              if (b.vy * w.n < 0) { events.push({ type: 'wall', speed: Math.abs(b.vy) }); b.vy = -b.vy * WALL_E; b.vx *= 0.97; }
            }
          }
        }
        for (const j of Table.jaws) {
          const dx = b.x - j.x, dy = b.y - j.y, d2 = dx * dx + dy * dy;
          if (d2 >= R * R || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          b.x = j.x + nx * R; b.y = j.y + ny * R;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) { b.vx -= (1 + JAW_E) * vn * nx; b.vy -= (1 + JAW_E) * vn * ny; events.push({ type: 'wall', speed: -vn }); }
        }
        let pocketed = false;
        for (const p of Table.pockets) {
          const dx = b.x - p.x, dy = b.y - p.y;
          if (dx * dx + dy * dy < p.r * p.r) { pocketed = true; break; }
        }
        if (!pocketed && (b.x < Table.L - R - 1 || b.x > Table.Rt + R + 1 || b.y < Table.T - R - 1 || b.y > Table.B + R + 1)) pocketed = true;
        if (pocketed) {
          b.on = false; b.vx = 0; b.vy = 0;
          events.push({ type: 'pocket', n: b.n });
          if (shot) shot.pocketed.push(b.n);
        }
      }
    }
    // Roce del paño
    let moving = false;
    for (const b of balls) {
      if (!b.on) continue;
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 === 0) continue;
      const sp = Math.sqrt(sp2);
      const ns = sp * 0.991 - 0.01;
      if (ns <= 0.02) { b.vx = 0; b.vy = 0; continue; }
      b.vx *= ns / sp; b.vy *= ns / sp;
      moving = true;
    }
    return { events, moving };
  }

  // Dónde choca la bola blanca si sale en dirección (dx, dy) unitaria
  function castRay(balls, cue, dx, dy) {
    let best = Infinity, hit = null;
    for (const b of balls) {
      if (!b.on || b.n === 0) continue;
      const ox = cue.x - b.x, oy = cue.y - b.y;
      const bq = ox * dx + oy * dy;
      const c = ox * ox + oy * oy - 4 * R * R;
      const disc = bq * bq - c;
      if (disc < 0) continue;
      const t = -bq - Math.sqrt(disc);
      if (t > 0 && t < best) { best = t; hit = b; }
    }
    // Bandas
    const lim = [];
    if (dx < 0) lim.push((Table.L + R - cue.x) / dx);
    if (dx > 0) lim.push((Table.Rt - R - cue.x) / dx);
    if (dy < 0) lim.push((Table.T + R - cue.y) / dy);
    if (dy > 0) lim.push((Table.B - R - cue.y) / dy);
    const tw = Math.min(...lim);
    if (tw < best) { best = tw; hit = null; }
    return { t: best, ball: hit, x: cue.x + dx * best, y: cue.y + dy * best };
  }

  return { step, castRay };
})();
