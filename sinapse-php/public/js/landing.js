// ============================================================
// landing.js — Introdução (sinapse), página inicial e painel de acesso
// ============================================================

// Promessa resolvida quando a introdução termina (main.js espera por ela).
window.introDone = new Promise(resolve => {
  const intro = document.getElementById('intro');
  const root = document.documentElement;
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    intro.classList.add('done');
    removeEventListener('keydown', skip);
    resolve();
  }
  // Clique ou tecla durante a introdução: encerra com um fade curto.
  function skip() {
    if (finished || root.classList.contains('intro-quick')) return;
    root.classList.add('intro-quick');
  }

  intro.addEventListener('animationend', e => {
    if (e.target === intro && (e.animationName === 'introExit' || e.animationName === 'fadeOut')) finish();
  });
  intro.addEventListener('click', skip);
  addEventListener('keydown', skip);
  setTimeout(finish, 4500); // segurança, caso algum evento de animação não dispare
});

// Dispara a sequência de entrada do topo da página inicial.
function playHero() {
  document.body.classList.remove('hero-go');
  void document.body.offsetWidth; // reinicia as animações (ex.: após sair da conta)
  document.body.classList.add('hero-go');
}

// Revelação suave dos blocos ao rolar, com pequeno escalonamento entre irmãos.
(function () {
  const items = document.querySelectorAll('[data-reveal]');
  items.forEach(el => {
    const siblings = [...el.parentElement.children].filter(c => c.hasAttribute('data-reveal'));
    el.style.setProperty('--rd', (siblings.indexOf(el) % 4) * 0.08 + 's');
  });
  if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  items.forEach(el => io.observe(el));

  const nav = document.getElementById('lp-nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('lp-year').textContent = new Date().getFullYear();
})();

// Gráfico da curva do esquecimento (ilustrativo), desenhado a partir de uma fórmula.
(function () {
  const fig = document.getElementById('curve');
  if (!fig) return;
  const svg = fig.querySelector('svg');
  const X0 = 44, X1 = 984, YT = 18, YB = 262, DAYS = 30;
  const x = d => X0 + (d / DAYS) * (X1 - X0);
  const y = r => YB - (r / 100) * (YB - YT);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text) n.textContent = text;
    return n;
  };

  // grade
  const grid = svg.querySelector('.curve-grid');
  [0, 50, 100].forEach(r => {
    grid.append(el('line', { x1: X0, x2: X1, y1: y(r), y2: y(r) }));
    grid.append(el('text', { x: 0, y: y(r) + 4 }, r + '%'));
  });
  [0, 7, 14, 21, 30].forEach(d => grid.append(el('text', { x: x(d), y: YB + 22, 'text-anchor': 'middle' }, d === 0 ? 'hoje' : 'dia ' + d)));

  // sem revisão: cai rápido e estabiliza baixo
  let p = '';
  for (let t = 0; t <= DAYS + 0.001; t += 0.25) p += (t ? 'L' : 'M') + x(t).toFixed(1) + ' ' + y(20 + 80 * Math.exp(-t / 1.6)).toFixed(1);
  svg.querySelector('.curve-plain').setAttribute('d', p);

  // com revisões: cada revisão devolve a lembrança a 100% e a queda seguinte é mais lenta
  const reviews = [1, 3, 7, 15], strength = [1.2, 2.6, 5, 10, 22];
  const starts = [0, ...reviews];
  p = 'M' + x(0) + ' ' + y(100);
  starts.forEach((s, k) => {
    const end = k < reviews.length ? reviews[k] : DAYS;
    for (let t = s + 0.25; t <= end + 0.001; t += 0.25) p += 'L' + x(t).toFixed(1) + ' ' + y(18 + 82 * Math.exp(-(t - s) / strength[k])).toFixed(1);
    if (k < reviews.length) p += 'L' + x(end).toFixed(1) + ' ' + y(100);
  });
  svg.querySelector('.curve-spaced').setAttribute('d', p);

  // marcadores das revisões e rótulos
  const marks = svg.querySelector('.curve-marks');
  reviews.forEach((d, i) => {
    const g = el('g', { style: '--md:' + (0.9 + i * 0.35) + 's' });
    g.append(el('circle', { cx: x(d), cy: y(100), r: 4 }));
    if (i === 0) g.append(el('text', { x: x(d) + 10, y: y(100) - 8 }, 'revisões'));
    marks.append(g);
  });
  const endLabels = el('g', { style: '--md:2.4s' });
  endLabels.append(el('text', { x: X1, y: y(20 + 80 * Math.exp(-DAYS / 1.6)) - 10, 'text-anchor': 'end' }, 'sem revisão'));
  endLabels.append(el('text', { x: X1, y: y(18 + 82 * Math.exp(-(DAYS - 15) / 22)) + 24, 'text-anchor': 'end', class: 'lbl-spaced' }, 'com revisões espaçadas'));
  marks.append(endLabels);
})();

// Abas "Planejar / Estudar / Revisar / Guardar" (clique ou setas do teclado).
(function () {
  const tabs = [...document.querySelectorAll('.stage-tabs [role="tab"]')];
  if (!tabs.length) return;
  function select(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      select(tabs[(i + step + tabs.length) % tabs.length], true);
    });
  });
})();

// Painel lateral de login/cadastro.
let authReturnFocus = null;
function openAuth(tab) {
  authReturnFocus = document.activeElement;
  switchAuthTab(tab || 'login');
  document.body.classList.add('auth-open');
  document.getElementById('auth-panel').setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    const first = document.getElementById(tab === 'register' ? 'reg-name' : 'login-email');
    if (first) first.focus({ preventScroll: true });
  }, 450);
}
function closeAuth() {
  document.body.classList.remove('auth-open');
  document.getElementById('auth-panel').setAttribute('aria-hidden', 'true');
  if (authReturnFocus && authReturnFocus.isConnected && authReturnFocus.offsetParent !== null) authReturnFocus.focus({ preventScroll: true });
  authReturnFocus = null;
}
addEventListener('keydown', e => {
  if (!document.body.classList.contains('auth-open')) return;
  if (e.key === 'Escape') { closeAuth(); return; }
  if (e.key !== 'Tab') return;
  // Mantém o foco do teclado dentro do painel enquanto ele está aberto.
  const items = [...document.querySelectorAll('#auth-panel button, #auth-panel input, #auth-panel [tabindex="0"]')].filter(el => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
// Enter nos campos envia o formulário correspondente.
document.querySelectorAll('#login-form input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));
document.querySelectorAll('#register-form input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); }));
document.getElementById('forgot-email').addEventListener('keydown', e => { if (e.key === 'Enter') sendRecovery(); });
