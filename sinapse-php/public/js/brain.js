// ============================================================
// brain.js — cérebro 3D feito de "neurônios" (pontos) girando em um <canvas>.
// Canvas 2D puro, sem bibliotecas. Sinais percorrem as conexões de tempos em tempos.
// Usado no topo da página inicial (#brain) e no painel do usuário (#dash-brain).
// Para quando sai da tela ou a aba fica oculta; com movimento reduzido, mostra um quadro parado.
//
// createBrain(canvas, { points, rate, scale }) devolve:
//   burst(n)      → dispara n sinais de uma vez (ex.: quando o painel aparece)
//   setRate(seg)  → intervalo entre sinais automáticos (menor = cérebro mais "ativo")
// ============================================================
function createBrain(canvas, opts) {
  'use strict';
  if (!canvas || !canvas.getContext) return { burst() {}, setRate() {} };
  const o = Object.assign({ points: innerWidth < 720 ? 700 : 1300, rate: 0.28, scale: 0.56, maxSignals: 7 }, opts);
  const ctx = canvas.getContext('2d');
  const root = document.documentElement;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('a11y-motion');

  // ---------- 1. Geometria: pontos na superfície de um cérebro estilizado ----------
  let seed = 11;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const N = o.points;
  const pts = [];

  // Amostra pontos numa elipsoide com dobras (giros), aceitando só os que passam no filtro.
  function shell(cx, cy, cz, rx, ry, rz, count, keep) {
    for (let made = 0, tries = 0; made < count && tries < count * 20; tries++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const dx = s * Math.cos(th), dy = u, dz = s * Math.sin(th);
      const fold = 1 + 0.06 * Math.sin(dx * 11 + dz * 7) * Math.cos(dy * 9 - dz * 6);
      const px = cx + dx * rx * fold, pz = cz + dz * rz * fold;
      let py = cy + dy * ry * fold;
      if (py < -0.12) py = -0.12 + (py + 0.12) * 0.55; // base achatada
      if (keep && !keep(px, py, pz)) continue;
      pts.push({ x: px, y: py, z: pz });
      made++;
    }
  }
  shell(-0.29, 0.08, 0, 0.36, 0.48, 0.74, N * 0.42, x => x < -0.025);   // hemisfério esquerdo
  shell(0.29, 0.08, 0, 0.36, 0.48, 0.74, N * 0.42, x => x > 0.025);     // hemisfério direito
  shell(0, -0.36, -0.52, 0.4, 0.17, 0.24, N * 0.11, (x, y) => y < -0.22); // cerebelo
  for (let i = 0; i < N * 0.05; i++) {                                   // tronco encefálico
    const t = rnd(), a = rnd() * Math.PI * 2;
    pts.push({ x: Math.cos(a) * 0.07, y: -0.3 - t * 0.45, z: -0.22 - t * 0.12 + Math.sin(a) * 0.07 });
  }

  // Conexões: cada ponto liga-se aos vizinhos mais próximos.
  const adj = pts.map(() => []);
  const edges = [];
  const MAX_D2 = N < 900 ? 0.024 : 0.016;
  for (let i = 0; i < pts.length; i++) {
    const near = [];
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dz = pts[i].z - pts[j].z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < MAX_D2) near.push([d2, j]);
    }
    near.sort((a, b) => a[0] - b[0]);
    near.slice(0, 3).forEach(([, j]) => {
      if (!adj[i].includes(j)) { adj[i].push(j); adj[j].push(i); edges.push([i, j]); }
    });
  }

  // ---------- 2. Cores (seguem o tema claro/escuro) ----------
  let ink = [23, 23, 26], accent = [52, 85, 139];
  function readColors() {
    const cs = getComputedStyle(root);
    const parse = v => { v = v.trim().replace('#', ''); if (v.length === 3) v = v.replace(/./g, '$&$&'); const n = parseInt(v, 16); return isNaN(n) ? null : [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    ink = parse(cs.getPropertyValue('--text')) || ink;
    accent = parse(cs.getPropertyValue('--accent')) || accent;
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // ---------- 3. Tamanho do canvas ----------
  let W = 0, H = 0, scale = 1;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(W, H) * o.scale;
  }

  // ---------- 4. Projeção 3D → 2D ----------
  const proj = new Float32Array(pts.length * 3); // x, y, profundidade (0 = fundo, 1 = frente)
  function project(rotY, rotX) {
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
      const y2 = p.y * cx - z1 * sx, z2 = p.y * sx + z1 * cx;
      const persp = 1 / (1 + z2 * 0.32);
      proj[i * 3] = W / 2 + x1 * scale * persp;
      proj[i * 3 + 1] = H / 2 - y2 * scale * persp;
      proj[i * 3 + 2] = Math.max(0, Math.min(1, 0.5 - z2 * 0.6));
    }
  }

  // ---------- 5. Sinais (disparos) ----------
  const signals = [];
  function spawn() {
    let at = (rnd() * pts.length) | 0;
    const path = [at];
    for (let k = 0; k < 5 + ((rnd() * 4) | 0); k++) {
      const opts = adj[at].filter(n => !path.includes(n));
      if (!opts.length) break;
      at = opts[(rnd() * opts.length) | 0];
      path.push(at);
    }
    if (path.length > 2) signals.push({ path, t: 0, speed: 5 + rnd() * 3 });
  }

  // ---------- 6. Desenho ----------
  const band = d => (d < 0.35 ? 0 : d < 0.65 ? 1 : 2);
  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    // conexões em 3 faixas de profundidade (menos trocas de estilo = mais rápido)
    const bands = [[], [], []];
    for (const [a, b] of edges) bands[band((proj[a * 3 + 2] + proj[b * 3 + 2]) / 2)].push(a, b);
    const edgeAlpha = [0.04, 0.08, 0.14];
    ctx.lineWidth = 0.7;
    bands.forEach((list, bi) => {
      ctx.strokeStyle = rgba(ink, edgeAlpha[bi]);
      ctx.beginPath();
      for (let k = 0; k < list.length; k += 2) {
        const a = list[k] * 3, b = list[k + 1] * 3;
        ctx.moveTo(proj[a], proj[a + 1]); ctx.lineTo(proj[b], proj[b + 1]);
      }
      ctx.stroke();
    });
    // pontos
    for (let bi = 0; bi < 3; bi++) {
      ctx.fillStyle = rgba(ink, [0.16, 0.3, 0.5][bi]);
      const size = [1, 1.4, 1.9][bi];
      for (let i = 0; i < pts.length; i++) {
        if (band(proj[i * 3 + 2]) !== bi) continue;
        ctx.fillRect(proj[i * 3] - size / 2, proj[i * 3 + 1] - size / 2, size, size);
      }
    }
    // sinais: rastro na cor de destaque + ponto na frente
    ctx.lineWidth = 1.4;
    for (let s = signals.length - 1; s >= 0; s--) {
      const sg = signals[s];
      sg.t += dt * sg.speed;
      const last = sg.path.length - 1;
      if (sg.t > last + 2) { signals.splice(s, 1); continue; }
      const head = Math.min(sg.t, last);
      const seg = Math.floor(head), f = head - seg;
      const fade = sg.t > last ? 1 - (sg.t - last) / 2 : 1;
      ctx.strokeStyle = rgba(accent, 0.55 * fade);
      ctx.beginPath();
      const p0 = sg.path[0] * 3;
      ctx.moveTo(proj[p0], proj[p0 + 1]);
      for (let k = 1; k <= seg; k++) { const pk = sg.path[k] * 3; ctx.lineTo(proj[pk], proj[pk + 1]); }
      let hx, hy;
      if (seg < last) {
        const a = sg.path[seg] * 3, b = sg.path[seg + 1] * 3;
        hx = proj[a] + (proj[b] - proj[a]) * f; hy = proj[a + 1] + (proj[b + 1] - proj[a + 1]) * f;
      } else { const e = sg.path[last] * 3; hx = proj[e]; hy = proj[e + 1]; }
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = rgba(accent, 0.18 * fade);
      ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(accent, 0.95 * fade);
      ctx.beginPath(); ctx.arc(hx, hy, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- 7. Laço de animação ----------
  let rotY = 0.7, tiltX = -0.22, targetTilt = -0.22, targetYaw = 0, yaw = 0;
  let running = false, visible = false, last = 0, spawnClock = 0, raf = 0, rate = o.rate, maxSignals = o.maxSignals;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    rotY += dt * 0.16;
    tiltX += (targetTilt - tiltX) * 0.04;
    yaw += (targetYaw - yaw) * 0.04;
    spawnClock += dt;
    if (spawnClock > rate && signals.length < maxSignals) { spawnClock = 0; spawn(); }
    project(rotY + yaw, tiltX);
    draw(dt);
    raf = requestAnimationFrame(frame);
  }
  function renderStill() { signals.length = 0; project(rotY, tiltX); draw(0); }
  function update() {
    const should = visible && !document.hidden && !still();
    if (should && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); }
    if (!should && visible) renderStill();
  }

  // Inclina levemente na direção do mouse (só com mouse de verdade).
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener('pointermove', e => {
      targetYaw = (e.clientX / innerWidth - 0.5) * 0.5;
      targetTilt = -0.22 + (e.clientY / innerHeight - 0.5) * 0.3;
    }, { passive: true });
  }

  readColors(); resize();
  new ResizeObserver(() => { resize(); if (!running) renderStill(); }).observe(canvas);
  new MutationObserver(() => { readColors(); update(); if (!running) renderStill(); })
    .observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }).observe(canvas);
  document.addEventListener('visibilitychange', update);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', update);

  return {
    burst(n) {
      if (still()) return;
      const prev = maxSignals;
      maxSignals = Math.max(prev, signals.length + n);
      for (let i = 0; i < n; i++) spawn();
      setTimeout(() => { maxSignals = prev; }, 2500);
    },
    setRate(sec) { rate = Math.max(0.08, sec); },
  };
}

// Cérebro da página inicial.
createBrain(document.getElementById('brain'));
