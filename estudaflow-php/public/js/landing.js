// ============================================================
// landing.js — Introdução animada, página inicial e painel de acesso
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
    if (e.target === intro && (e.animationName === 'introLift' || e.animationName === 'fadeOut')) finish();
  });
  intro.addEventListener('click', skip);
  addEventListener('keydown', skip);
  setTimeout(finish, 4000); // segurança, caso algum evento de animação não dispare
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
    el.style.setProperty('--rd', (siblings.indexOf(el) % 3) * 0.09 + 's');
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
