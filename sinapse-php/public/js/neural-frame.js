// ============================================================
// neural-frame.js — "Moldura neural" dos botões (página inicial e app).
// Cada botão fica entre dois mini neurônios (corpo, núcleo e dendritos). No hover/foco
// (e em abas/itens selecionados), A dispara, o sinal corre por cima e por baixo da moldura
// e B dispara, espalhando o azul pelos dendritos dele. Estilos: fim de css/landing.css.
// Botões criados depois (listas, painéis) também ganham moldura (MutationObserver).
// ============================================================
(function () {
  const SEL = [
    // página inicial
    '.lp-btn-dark', '.lp-btn-outline', '.lp-btn-light', '.lp-btn-ghost', '#auth-panel .btn-primary',
    '.lp-links a', '.lp-nav .theme-toggle', '.stage-tabs [role="tab"]',
    // app
    '#app .btn-add', '#app .btn-quick', '.modal .btn-primary', '.modal .btn-add',
    '#app .page-filters .mm-btn', '.tool-card', '.folder-card',
    '#modal-profile .pf-tabs [role="tab"]', '#modal-profile .btn-sm', '#modal-profile .pf-theme button', '#modal-profile .btn-danger',
  ].join(', ');
  const QUIET = '.lp-links a, .lp-nav .theme-toggle, .btn-quick, .page-filters .mm-btn, .tool-card, .folder-card, #modal-profile .pf-tabs [role="tab"], #modal-profile .btn-sm, #modal-profile .pf-theme button'; // moldura mais clara; dendritos só no hover
  const GAP = 4; // distância entre o botão e a moldura (px)
  const NS = 'http://www.w3.org/2000/svg';


  // Dendritos de um mini neurônio com corpo em (cx, m); dir = -1 cresce para a esquerda, 1 para a direita.
  // Cada item: [classe de espessura, caminho]. O primeiro nível é mais grosso (t1).
  function twigs(cx, m, dir) {
    const X = v => (cx + dir * v).toFixed(1);
    return [
      ['t1', `M${X(2)} ${m - 2}C${X(4)} ${m - 4} ${X(6)} ${m - 5.5} ${X(8)} ${m - 8}`],
      ['', `M${X(8)} ${m - 8}C${X(8.6)} ${m - 9.6} ${X(9)} ${m - 10.6} ${X(9.4)} ${m - 12}`],
      ['', `M${X(8)} ${m - 8}C${X(9.6)} ${m - 8.4} ${X(11)} ${m - 8.2} ${X(12.4)} ${m - 7.4}`],
      ['t1', `M${X(3)} ${m + 0.5}C${X(6)} ${m + 0.5} ${X(8)} ${m - 0.5} ${X(10.5)} ${m + 0.5}`],
      ['', `M${X(7.6)} ${m - 0.2}C${X(9)} ${m - 2.4} ${X(10.4)} ${m - 3.2} ${X(12)} ${m - 3.4}`],
      ['t1', `M${X(2)} ${m + 2}C${X(4)} ${m + 4.5} ${X(5.5)} ${m + 6.5} ${X(7)} ${m + 9}`],
      ['', `M${X(5.8)} ${m + 7}C${X(7.6)} ${m + 7.2} ${X(9.4)} ${m + 8.6} ${X(10.6)} ${m + 10.4}`],
    ];
  }
  // Corpo celular: forma levemente irregular (como na introdução) com um núcleo claro.
  const soma = (cx, m, dir, cls) => {
    const X = v => (cx + dir * v).toFixed(1);
    return `<path class="bf-soma ${cls}" d="M${X(-3)} ${m - 1.5}C${X(-2.4)} ${m - 4} ${X(1.6)} ${m - 4.4} ${X(3.2)} ${m - 2}C${X(4.4)} ${m - 0.2} ${X(4)} ${m + 2.6} ${X(2)} ${m + 3.6}C${X(0)} ${m + 4.6} ${X(-2.8)} ${m + 3.6} ${X(-3.4)} ${m + 1.4}C${X(-3.7)} ${m + 0.4} ${X(-3.5)} ${m - 0.6} ${X(-3)} ${m - 1.5}Z"/>` +
      `<circle class="bf-nuc" cx="${X(0.2)}" cy="${m}" r="1.3"/>`;
  };

  function draw(btn, svg) {
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    const radius = parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 0;
    const W = w + GAP * 2, H = h + GAP * 2, m = H / 2;
    const R = Math.min(radius + GAP, m);
    const top = `M0 ${m}V${R}A${R} ${R} 0 0 1 ${R} 0H${W - R}A${R} ${R} 0 0 1 ${W} ${R}V${m}`;
    const bottom = `M0 ${m}V${H - R}A${R} ${R} 0 0 0 ${R} ${H}H${W - R}A${R} ${R} 0 0 0 ${W} ${H - R}V${m}`;
    const tA = twigs(0, m, -1), tB = twigs(W, m, 1);
    const paths = (list, cls) => list.map(([t, d]) => `<path class="${cls} ${t}" pathLength="1" d="${d}"/>`).join('');
    svg.innerHTML =
      `<path class="bf-base" d="${top}"/><path class="bf-base" d="${bottom}"/>` +
      paths(tA, 'bf-twig') + paths(tB, 'bf-twig') +
      `<path class="bf-sig" pathLength="1" d="${top}"/><path class="bf-sig" pathLength="1" d="${bottom}"/>` +
      paths(tA, 'bf-tsig bf-ta') + paths(tB, 'bf-tsig bf-tb') +
      soma(0, m, -1, 'a') + soma(W, m, 1, 'b');
  }

  const ro = 'ResizeObserver' in window ? new ResizeObserver(entries => entries.forEach(e => draw(e.target, e.target._frame))) : null;
  function attach(btn) {
    if (btn._frame) return;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', btn.matches(QUIET) ? 'btn-frame quiet' : 'btn-frame');
    svg.setAttribute('aria-hidden', 'true');
    btn.classList.add('has-frame');
    btn.append(svg);
    btn._frame = svg;
    draw(btn, svg);
    if (ro) ro.observe(btn);
  }
  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches(SEL)) attach(root);
    root.querySelectorAll(SEL).forEach(attach);
  }
  scan(document.body);
  new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(scan)))
    .observe(document.body, { childList: true, subtree: true });
})();
