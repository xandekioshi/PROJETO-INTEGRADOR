// ============================================================
// mindmap.js — Editor de mapa mental
// Nós em HTML (texto nítido e editável) + conexões em SVG,
// dentro de uma área com arrastar, zoom, desfazer/refazer,
// organização automática, atalhos de teclado e exportação.
// API usada pelo restante do app:
//   MM.init(nodes)     carrega um mapa (vazio cria o tema central)
//   MM.serialize()     devolve os nós no formato salvo pela API
// ============================================================

const MM = (function () {
  const COLORS = [
    ['#34558b', 'Azul'], ['#4d7a5e', 'Verde'], ['#b07d2e', 'Ocre'],
    ['#8a4f7d', 'Ameixa'], ['#b0473a', 'Terracota'], ['#5b6b7f', 'Grafite'],
  ];
  const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  const MAX_NODES = 500, MAX_LABEL = 100, H_GAP = 230, V_GAP = 58, GRID = 22;

  let nodes = [], sel = null, editing = null, editIsNew = false;
  let view = { x: 0, y: 0, k: 1 };
  let hist = [], fut = [], drag = null, els = {};
  const nodeEls = new Map();

  // ---------- utilidades ----------
  const byId = id => nodes.find(n => n.id === id);
  const kids = id => nodes.filter(n => n.parent === id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function descendants(id) {
    const out = [], stack = [id];
    while (stack.length) { const c = stack.pop(); nodes.forEach(n => { if (n.parent === c) { out.push(n); stack.push(n.id); } }); }
    return out;
  }
  function depth(n) { let d = 0, p = n; while (p && p.parent != null && d < 600) { p = byId(p.parent); d++; } return d; }
  const nextId = () => nodes.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  const toast = msg => (typeof showToast === 'function' ? showToast(msg) : null);
  function announce(msg) { if (els.live) { els.live.textContent = ''; setTimeout(() => { els.live.textContent = msg; }, 20); } }

  // ---------- histórico ----------
  function snapshot() { hist.push(JSON.stringify(nodes)); if (hist.length > 100) hist.shift(); fut = []; updateToolbar(); }
  function restore(json) { nodes = JSON.parse(json); if (sel != null && !byId(sel)) sel = null; render(); }
  function undo() { if (!hist.length) return; commitEdit(); fut.push(JSON.stringify(nodes)); restore(hist.pop()); announce('Desfeito'); }
  function redo() { if (!fut.length) return; commitEdit(); hist.push(JSON.stringify(nodes)); restore(fut.pop()); announce('Refeito'); }

  // ---------- inicialização ----------
  function init(list) {
    els = {
      editor: document.getElementById('mm-editor'), vp: document.getElementById('mm-viewport'),
      world: document.getElementById('mm-world'), svg: document.getElementById('mm-edges'),
      live: document.getElementById('mm-live'), zoom: document.getElementById('mm-zoom'),
      toolbar: document.getElementById('mm-toolbar'),
    };
    if (!els.vp) return;
    nodeEls.forEach(el => el.remove()); nodeEls.clear();
    nodes = (list || []).map(n => ({
      id: Number(n.id), parent: n.parent == null ? null : Number(n.parent),
      label: String(n.label || '').slice(0, MAX_LABEL) || 'Tópico',
      x: Math.round(Number(n.x) || 0), y: Math.round(Number(n.y) || 0),
      color: HEX.test(n.color || '') ? n.color : COLORS[0][0],
    }));
    sel = null; editing = null; hist = []; fut = []; drag = null;
    if (!nodes.length) { nodes.push({ id: 1, parent: null, label: 'Tema central', x: 0, y: 0, color: COLORS[0][0] }); sel = 1; }
    bind();
    render();
    requestAnimationFrame(() => fit(false));
    setTimeout(() => fit(false), 380); // após a animação de abertura do modal
  }

  function serialize() {
    commitEdit();
    return nodes.map(n => ({ id: n.id, parent: n.parent, label: n.label, x: Math.round(n.x), y: Math.round(n.y), color: n.color }));
  }

  // ---------- desenho ----------
  function render() {
    const seen = new Set();
    nodes.forEach(n => {
      let el = nodeEls.get(n.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'mm-node'; el.id = 'mm-n-' + n.id; el.dataset.id = n.id; el.setAttribute('role', 'treeitem');
        el.innerHTML = '<span class="mm-label"></span>';
        els.world.appendChild(el); nodeEls.set(n.id, el);
      }
      seen.add(n.id);
      const d = depth(n);
      el.classList.toggle('is-root', n.parent == null);
      el.classList.toggle('is-d1', d === 1);
      el.classList.toggle('selected', n.id === sel);
      el.style.setProperty('--c', n.color);
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      el.setAttribute('aria-level', d + 1);
      el.setAttribute('aria-selected', String(n.id === sel));
      if (editing !== n.id) el.firstChild.textContent = n.label;
    });
    nodeEls.forEach((el, id) => { if (!seen.has(id)) { el.remove(); nodeEls.delete(id); } });
    drawEdges();
    if (sel != null) els.vp.setAttribute('aria-activedescendant', 'mm-n-' + sel); else els.vp.removeAttribute('aria-activedescendant');
    updateToolbar();
  }
  function edgePath(p, c) {
    const mx = p.x + (c.x - p.x) / 2;
    return `M${p.x},${p.y} C${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
  }
  function drawEdges() {
    let h = '';
    nodes.forEach(n => {
      const p = n.parent == null ? null : byId(n.parent);
      if (p) h += `<path d="${edgePath(p, n)}" stroke="${HEX.test(n.color) ? n.color : '#888888'}"/>`;
    });
    els.svg.innerHTML = h;
  }
  function placeNodeEl(n) { const el = nodeEls.get(n.id); if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; } }
  function applyView() {
    els.world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
    els.vp.style.backgroundSize = `${GRID * view.k}px ${GRID * view.k}px`;
    els.vp.style.backgroundPosition = `${view.x}px ${view.y}px`;
    els.zoom.textContent = Math.round(view.k * 100) + '%';
  }
  function updateToolbar() {
    if (!els.toolbar) return;
    const has = sel != null;
    els.toolbar.querySelectorAll('[data-need-sel]').forEach(b => { b.disabled = !has; });
    els.toolbar.querySelector('[data-mm="undo"]').disabled = !hist.length;
    els.toolbar.querySelector('[data-mm="redo"]').disabled = !fut.length;
    const color = has ? byId(sel).color : null;
    els.toolbar.querySelectorAll('.mm-swatch').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === color)));
  }

  // ---------- seleção ----------
  function select(id, speak = true) {
    sel = id; render();
    if (id == null || !speak) return;
    const n = byId(id), k = kids(id).length;
    announce(`${n.label}. Nível ${depth(n) + 1}. ${k ? k + (k === 1 ? ' subtópico' : ' subtópicos') : 'Sem subtópicos'}.`);
  }
  function ensureVisible(n) {
    const r = els.vp.getBoundingClientRect(), m = 60;
    const sx = n.x * view.k + view.x, sy = n.y * view.k + view.y;
    if (sx < m) view.x += m - sx; else if (sx > r.width - m) view.x -= sx - (r.width - m);
    if (sy < m) view.y += m - sy; else if (sy > r.height - m) view.y -= sy - (r.height - m);
    applyView();
  }

  // ---------- edição de texto ----------
  function startEdit(id, isNew = false) {
    commitEdit();
    const n = byId(id), el = nodeEls.get(id); if (!n || !el) return;
    editing = id; editIsNew = isNew; sel = id;
    const span = el.firstChild;
    try { span.contentEditable = 'plaintext-only'; } catch (e) { span.contentEditable = 'true'; }
    if (span.contentEditable !== 'plaintext-only') span.contentEditable = 'true';
    span.setAttribute('role', 'textbox'); span.setAttribute('aria-label', 'Texto do tópico');
    el.classList.add('editing');
    span.focus();
    const range = document.createRange(); range.selectNodeContents(span);
    const s = getSelection(); s.removeAllRanges(); s.addRange(range);
    span.onkeydown = e => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); els.vp.focus({ preventScroll: true }); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const pid = editing; commitEdit(); addChild(pid); }
    };
    span.oninput = () => {
      if (span.textContent.length > MAX_LABEL) { span.textContent = span.textContent.slice(0, MAX_LABEL); placeCaretEnd(span); }
      drawEdges();
    };
    span.onblur = () => commitEdit();
    updateToolbar();
  }
  function placeCaretEnd(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function finishEditEl(el) {
    const span = el.firstChild;
    span.onkeydown = span.oninput = span.onblur = null;
    span.contentEditable = 'false'; span.removeAttribute('role'); span.removeAttribute('aria-label');
    el.classList.remove('editing');
  }
  function commitEdit() {
    if (editing == null) return;
    const n = byId(editing), el = nodeEls.get(editing);
    editing = null;
    if (!n || !el) return;
    const text = el.firstChild.textContent.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL) || n.label || 'Tópico';
    finishEditEl(el);
    if (text !== n.label) { if (!editIsNew) snapshot(); n.label = text; }
    render();
  }
  function cancelEdit() {
    if (editing == null) return;
    const el = nodeEls.get(editing); editing = null;
    if (el) finishEditEl(el);
    render(); els.vp.focus({ preventScroll: true });
  }

  // ---------- criar / excluir / cor ----------
  function freeSpot(x, y) {
    let tries = 0;
    while (tries++ < 200 && nodes.some(o => Math.abs(o.x - x) < 170 && Math.abs(o.y - y) < 46)) y += V_GAP / 2;
    return y;
  }
  function addChild(parentId) {
    const p = byId(parentId); if (!p) return;
    if (nodes.length >= MAX_NODES) { toast(`Limite de ${MAX_NODES} tópicos por mapa.`); return; }
    let dir;
    if (p.parent == null) {
      const ch = kids(p.id), right = ch.filter(c => c.x >= p.x).length;
      dir = right <= ch.length - right ? 1 : -1;
    } else {
      const gp = byId(p.parent); dir = Math.sign(p.x - gp.x) || 1;
    }
    const side = kids(p.id).filter(c => Math.sign(c.x - p.x) === dir);
    const x = p.x + dir * H_GAP;
    const y = freeSpot(x, side.length ? Math.max(...side.map(c => c.y)) + V_GAP : p.y);
    let color = p.color;
    if (p.parent == null) { const used = kids(p.id).length; color = COLORS[(used % (COLORS.length - 1)) + 1][0]; }
    snapshot();
    const n = { id: nextId(), parent: p.id, label: 'Novo tópico', x, y, color };
    nodes.push(n); sel = n.id; render(); ensureVisible(n);
    startEdit(n.id, true);
  }
  function addSibling(id) {
    const n = byId(id); if (!n) return;
    if (n.parent == null) { addChild(id); return; }
    addChild(n.parent);
  }
  function addRootAt(x, y) {
    if (nodes.length >= MAX_NODES) { toast(`Limite de ${MAX_NODES} tópicos por mapa.`); return; }
    snapshot();
    const n = { id: nextId(), parent: null, label: 'Novo tema', x: Math.round(x), y: Math.round(y), color: COLORS[0][0] };
    nodes.push(n); sel = n.id; render(); startEdit(n.id, true);
  }
  function removeNode(id) {
    const n = byId(id); if (!n) return;
    const gone = new Set([id, ...descendants(id).map(d => d.id)]);
    snapshot();
    nodes = nodes.filter(x => !gone.has(x.id));
    sel = n.parent != null && byId(n.parent) ? n.parent : null;
    render();
    toast(gone.size > 1 ? `${gone.size} tópicos excluídos. Ctrl+Z desfaz.` : 'Tópico excluído. Ctrl+Z desfaz.');
  }
  function setColor(color) {
    if (sel == null) return;
    snapshot();
    [byId(sel), ...descendants(sel)].forEach(n => { n.color = color; });
    render();
  }

  // ---------- organização automática ----------
  function subtreeH(n, guard = 0) {
    const ch = kids(n.id);
    if (!ch.length || guard > 500) return V_GAP;
    return Math.max(V_GAP, ch.reduce((s, c) => s + subtreeH(c, guard + 1), 0));
  }
  function place(list, px, cy, dir, target) {
    let y = cy - list.reduce((s, c) => s + subtreeH(c), 0) / 2;
    list.forEach(c => {
      const h = subtreeH(c), t = { x: px + dir * H_GAP, y: y + h / 2 };
      target.set(c.id, t);
      place(kids(c.id).sort((a, b) => a.y - b.y), t.x, t.y, dir, target);
      y += h;
    });
  }
  function organize() {
    commitEdit();
    if (!nodes.length) return;
    snapshot();
    const target = new Map();
    const roots = nodes.filter(n => n.parent == null).sort((a, b) => a.y - b.y);
    let top = Math.min(...roots.map(r => r.y));
    roots.forEach(r => {
      const ch = kids(r.id).sort((a, b) => a.y - b.y);
      let right = ch.filter(c => c.x >= r.x), left = ch.filter(c => c.x < r.x);
      if (!left.length && right.length > 3) { left = right.filter((_, i) => i % 2); right = right.filter((_, i) => !(i % 2)); }
      if (!right.length && left.length > 3) { right = left.filter((_, i) => i % 2); left = left.filter((_, i) => !(i % 2)); }
      const hs = l => l.reduce((s, c) => s + subtreeH(c), 0);
      const h = Math.max(hs(right), hs(left), V_GAP);
      const cy = top + h / 2;
      target.set(r.id, { x: r.x, y: cy });
      place(right, r.x, cy, 1, target);
      place(left, r.x, cy, -1, target);
      top += h + V_GAP * 2;
    });
    animateTo(target, () => fit(true));
    announce('Mapa organizado');
  }
  function animateTo(target, done) {
    const from = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }]));
    const reduce = document.documentElement.classList.contains('a11y-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : 450;
    let t0 = null, finished = false;
    const apply = e => {
      nodes.forEach(n => {
        const a = from.get(n.id), b = target.get(n.id); if (!a || !b) return;
        n.x = Math.round(a.x + (b.x - a.x) * e); n.y = Math.round(a.y + (b.y - a.y) * e); placeNodeEl(n);
      });
      drawEdges();
    };
    const finish = () => { if (finished) return; finished = true; apply(1); if (done) done(); };
    const step = now => {
      if (finished) return;
      if (t0 === null) t0 = now; // usa o relógio do próprio quadro de animação
      const p = dur ? clamp((now - t0) / dur, 0, 1) : 1;
      apply(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(step); else finish();
    };
    requestAnimationFrame(step);
    setTimeout(finish, dur + 150); // garante o estado final mesmo se a aba ficar em segundo plano
  }

  // ---------- visão (zoom / centralizar) ----------
  function zoomAt(factor, sx, sy) {
    const k2 = clamp(view.k * factor, 0.3, 2.5);
    view.x = sx - (sx - view.x) * (k2 / view.k);
    view.y = sy - (sy - view.y) * (k2 / view.k);
    view.k = k2; applyView();
  }
  function zoomCenter(factor) { const r = els.vp.getBoundingClientRect(); zoomAt(factor, r.width / 2, r.height / 2); }
  function bounds() {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    nodes.forEach(n => {
      const el = nodeEls.get(n.id), w = (el ? el.offsetWidth : 120) / 2, h = (el ? el.offsetHeight : 36) / 2;
      x1 = Math.min(x1, n.x - w); y1 = Math.min(y1, n.y - h); x2 = Math.max(x2, n.x + w); y2 = Math.max(y2, n.y + h);
    });
    return { x1, y1, x2, y2 };
  }
  function fit(animate) {
    if (!els.vp || !nodes.length) return;
    const r = els.vp.getBoundingClientRect(); if (!r.width) return;
    const b = bounds(), bw = b.x2 - b.x1, bh = b.y2 - b.y1;
    view.k = clamp(Math.min((r.width - 100) / bw, (r.height - 100) / bh), 0.3, 1.2);
    view.x = r.width / 2 - (b.x1 + bw / 2) * view.k;
    view.y = r.height / 2 - (b.y1 + bh / 2) * view.k;
    if (animate) { els.world.classList.add('mm-anim'); setTimeout(() => els.world && els.world.classList.remove('mm-anim'), 380); }
    applyView();
  }

  // ---------- navegação pelo teclado (espacial) ----------
  function navigate(key) {
    if (sel == null) { const r = nodes.find(n => n.parent == null) || nodes[0]; if (r) { select(r.id); ensureVisible(r); } return; }
    const c = byId(sel);
    const v = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    let best = null, bestScore = Infinity;
    nodes.forEach(n => {
      if (n.id === sel) return;
      const dx = n.x - c.x, dy = n.y - c.y, along = dx * v[0] + dy * v[1];
      if (along <= 4) return;
      const across = Math.abs(dx * v[1] + dy * v[0]);
      const score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = n; }
    });
    if (best) { select(best.id); ensureVisible(best); }
  }

  // ---------- exportação ----------
  function outline() {
    const lines = [];
    const walk = (n, d) => { lines.push('  '.repeat(d) + '- ' + n.label); kids(n.id).sort((a, b) => a.y - b.y).forEach(c => walk(c, d + 1)); };
    nodes.filter(n => n.parent == null).sort((a, b) => a.y - b.y).forEach(r => walk(r, 0));
    return lines.join('\n');
  }
  function copyOutline() {
    commitEdit();
    const text = outline();
    if (!navigator.clipboard) { toast('Copiar não é suportado neste navegador.'); return; }
    navigator.clipboard.writeText(text).then(() => toast('Tópicos copiados. Cole em um documento ou anotação.'), () => toast('Não foi possível copiar.'));
  }
  function wrapText(ctx, text, maxW) {
    const words = text.split(' '), lines = []; let line = '';
    words.forEach(w => {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }
  function exportPNG() {
    commitEdit();
    if (!nodes.length) return;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const font = getComputedStyle(els.vp).fontFamily;
    const b = bounds(), pad = 48, scale = 2;
    const W = b.x2 - b.x1 + pad * 2, H = b.y2 - b.y1 + pad * 2;
    const cv = document.createElement('canvas'); cv.width = W * scale; cv.height = H * scale;
    const ctx = cv.getContext('2d'); ctx.scale(scale, scale); ctx.translate(pad - b.x1, pad - b.y1);
    ctx.fillStyle = v('--bg'); ctx.fillRect(b.x1 - pad, b.y1 - pad, W, H);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.globalAlpha = 0.55;
    nodes.forEach(n => {
      const p = n.parent == null ? null : byId(n.parent); if (!p) return;
      const mx = p.x + (n.x - p.x) / 2;
      ctx.strokeStyle = n.color; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.bezierCurveTo(mx, p.y, mx, n.y, n.x, n.y); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    nodes.forEach(n => {
      const el = nodeEls.get(n.id); if (!el) return;
      const w = el.offsetWidth, h = el.offsetHeight, x = n.x - w / 2, y = n.y - h / 2, cs = getComputedStyle(el);
      ctx.fillStyle = cs.backgroundColor; ctx.strokeStyle = cs.borderTopColor; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, parseFloat(cs.borderTopLeftRadius) || 10) : ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
      const fs = parseFloat(cs.fontSize);
      ctx.fillStyle = cs.color; ctx.font = `${cs.fontWeight} ${fs}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lines = wrapText(ctx, n.label, w - parseFloat(cs.paddingLeft) * 2 + 2), lh = fs * 1.35;
      lines.forEach((l, i) => ctx.fillText(l, n.x, n.y + (i - (lines.length - 1) / 2) * lh));
    });
    const title = (document.getElementById('mm-title')?.value || 'mapa-mental').trim().replace(/[^\p{L}\p{N}\- ]/gu, '').replace(/\s+/g, '-') || 'mapa-mental';
    cv.toBlob(blob => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = title + '.png';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Imagem do mapa baixada.');
    });
  }
  function toggleMax() {
    const on = els.editor.classList.toggle('mm-max');
    const btn = els.toolbar.querySelector('[data-mm="max"]');
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('use').setAttribute('href', on ? '#i-minimize' : '#i-maximize');
    btn.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Tela cheia');
    requestAnimationFrame(() => fit(true));
    els.vp.focus({ preventScroll: true });
  }

  // ---------- eventos ----------
  function localPoint(e) { const r = els.vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function toWorld(p) { return { x: (p.x - view.x) / view.k, y: (p.y - view.y) / view.k }; }

  function bind() {
    const vp = els.vp;
    if (vp.dataset.bound) return;
    vp.dataset.bound = '1';

    vp.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const nodeEl = e.target.closest('.mm-node');
      if (editing != null && nodeEl && Number(nodeEl.dataset.id) === editing) return; // seleção de texto durante a edição
      if (editing != null) commitEdit();
      e.preventDefault();
      vp.focus({ preventScroll: true });
      const start = { x: e.clientX, y: e.clientY };
      if (nodeEl) {
        const id = Number(nodeEl.dataset.id);
        select(id);
        const moving = [byId(id), ...(e.altKey ? [] : descendants(id))];
        drag = { type: 'node', id, start, moved: false, orig: moving.map(n => ({ n, x: n.x, y: n.y })) };
      } else {
        drag = { type: 'pan', start, vx: view.x, vy: view.y, moved: false };
      }
      vp.setPointerCapture(e.pointerId);
    });
    vp.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.start.x, dy = e.clientY - drag.start.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        if (drag.type === 'node') { snapshot(); nodeEls.get(drag.id)?.classList.add('dragging'); } else vp.classList.add('panning');
      }
      if (drag.type === 'node') {
        drag.orig.forEach(o => { o.n.x = Math.round(o.x + dx / view.k); o.n.y = Math.round(o.y + dy / view.k); placeNodeEl(o.n); });
        drawEdges();
      } else { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); }
    });
    const endDrag = () => {
      if (!drag) return;
      if (drag.type === 'pan' && !drag.moved) select(null, false);
      nodeEls.get(drag.id)?.classList.remove('dragging');
      vp.classList.remove('panning');
      drag = null;
    };
    vp.addEventListener('pointerup', endDrag);
    vp.addEventListener('pointercancel', endDrag);

    vp.addEventListener('dblclick', e => {
      const nodeEl = e.target.closest('.mm-node');
      if (nodeEl) { startEdit(Number(nodeEl.dataset.id)); return; }
      const w = toWorld(localPoint(e)); addRootAt(w.x, w.y);
    });
    vp.addEventListener('wheel', e => {
      e.preventDefault();
      const p = localPoint(e);
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
    }, { passive: false });

    vp.addEventListener('keydown', e => {
      if (editing != null) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (mod) return;
      switch (e.key) {
        case 'Tab': if (sel != null && !e.shiftKey) { e.preventDefault(); addChild(sel); } break;
        case 'Enter': if (sel != null) { e.preventDefault(); addSibling(sel); } break;
        case 'F2': if (sel != null) { e.preventDefault(); startEdit(sel); } break;
        case 'Delete': case 'Backspace': if (sel != null) { e.preventDefault(); removeNode(sel); } break;
        case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': e.preventDefault(); navigate(e.key); break;
        case '+': case '=': e.preventDefault(); zoomCenter(1.2); break;
        case '-': case '_': e.preventDefault(); zoomCenter(1 / 1.2); break;
        case '0': e.preventDefault(); fit(true); break;
        case 'Escape':
          if (sel != null) { e.stopPropagation(); select(null, false); announce('Nenhum tópico selecionado'); }
          else if (els.editor.classList.contains('mm-max')) { e.stopPropagation(); toggleMax(); }
          break;
      }
    });

    els.toolbar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.color) { setColor(b.dataset.color); return; }
      const actions = {
        child: () => addChild(sel), sibling: () => addSibling(sel), edit: () => startEdit(sel), del: () => removeNode(sel),
        undo, redo, organize, fit: () => fit(true), zin: () => zoomCenter(1.2), zout: () => zoomCenter(1 / 1.2),
        copy: copyOutline, png: exportPNG, max: toggleMax,
      };
      const fn = actions[b.dataset.mm]; if (fn) fn();
      if (!['edit', 'child', 'sibling'].includes(b.dataset.mm)) els.vp.focus({ preventScroll: true });
    });
    // Mantém o enquadramento quando a janela muda de tamanho.
    new ResizeObserver(() => applyView()).observe(vp);
  }

  // Barra de ferramentas e área do editor (usado por tools.js)
  function markup() {
    const t = (mm, icon, label, extra = '') => `<button type="button" class="mm-tool" data-mm="${mm}" aria-label="${label}" title="${label}" ${extra}><svg class="icon"><use href="#i-${icon}"/></svg></button>`;
    const swatches = COLORS.map(([c, n]) => `<button type="button" class="mm-swatch" data-color="${c}" data-need-sel style="--c:${c}" aria-label="Cor ${n}" title="Cor ${n}" aria-pressed="false"></button>`).join('');
    return `
    <div class="mm-editor" id="mm-editor">
      <div class="mm-toolbar" id="mm-toolbar" role="toolbar" aria-label="Ferramentas do mapa mental">
        <div class="mm-group">
          ${t('child', 'branch', 'Adicionar subtópico (Tab)', 'data-need-sel')}
          ${t('sibling', 'plus', 'Adicionar tópico irmão (Enter)', 'data-need-sel')}
          ${t('edit', 'pencil', 'Editar texto (F2 ou duplo clique)', 'data-need-sel')}
          ${t('del', 'trash', 'Excluir tópico (Delete)', 'data-need-sel')}
        </div>
        <span class="mm-sep"></span>
        <div class="mm-group mm-colors" role="group" aria-label="Cor do tópico">${swatches}</div>
        <span class="mm-sep"></span>
        <div class="mm-group">
          ${t('undo', 'undo', 'Desfazer (Ctrl+Z)')}
          ${t('redo', 'redo', 'Refazer (Ctrl+Y)')}
          <button type="button" class="mm-tool mm-text" data-mm="organize" title="Organizar automaticamente"><svg class="icon"><use href="#i-network"/></svg>Organizar</button>
        </div>
        <span class="mm-spacer"></span>
        <div class="mm-group">
          ${t('zout', 'minus', 'Diminuir zoom (−)')}
          <span class="mm-zoom" id="mm-zoom" aria-live="polite">100%</span>
          ${t('zin', 'plus', 'Aumentar zoom (+)')}
          ${t('fit', 'focus', 'Centralizar mapa (0)')}
          ${t('max', 'maximize', 'Tela cheia', 'aria-pressed="false"')}
        </div>
        <span class="mm-sep"></span>
        <div class="mm-group">
          ${t('copy', 'list', 'Copiar como tópicos')}
          ${t('png', 'download', 'Baixar imagem (PNG)')}
        </div>
      </div>
      <div class="mm-viewport" id="mm-viewport" tabindex="0" role="tree" aria-roledescription="mapa mental"
           aria-label="Mapa mental. Setas navegam, Tab cria subtópico, Enter cria tópico irmão, F2 edita, Delete exclui.">
        <div class="mm-world" id="mm-world"><svg class="mm-edges" id="mm-edges" aria-hidden="true"></svg></div>
      </div>
      <div class="mm-hint" aria-hidden="true">
        <span><kbd>Tab</kbd> subtópico</span><span><kbd>Enter</kbd> irmão</span><span><kbd>F2</kbd> / duplo clique editar</span>
        <span><kbd>Del</kbd> excluir</span><span>Arraste para mover (com <kbd>Alt</kbd> só o tópico)</span>
        <span>Duplo clique no fundo cria um novo tema</span><span>Roda do mouse: zoom</span>
      </div>
      <div class="sr-only" id="mm-live" aria-live="polite"></div>
    </div>`;
  }

  return { init, serialize, markup, fit: () => fit(false) };
})();

// Compatibilidade com tools.js
function initMindmap() { MM.init([]); }
