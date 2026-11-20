// ============================================================
// navigation.js — Troca de páginas, modais e notificações toast
// O menu lateral é um "axônio": cada página é um nó. Ao trocar de página,
// um sinal corre do nó antigo até o novo (css/app.css).
// ============================================================

function goPage(page) {
  const prev = document.querySelector('.sidebar .nav-item.active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  let next = null;
  document.querySelectorAll('.sidebar .nav-item').forEach(n => {
    const on = n.dataset.page === page;
    n.classList.toggle('active', on);
    if (on) { n.setAttribute('aria-current', 'page'); next = n; } else n.removeAttribute('aria-current');
  });
  navAxon();
  navSignal(prev, next);
  if (page === 'cronograma') renderCronograma();
  if (page === 'dashboard') { renderDashboard(); if (typeof playDashboard === 'function') playDashboard(); }
  if (page === 'admin') loadAdmin(true);
}

// Posiciona a linha do axônio entre o primeiro e o último nó visível do menu.
function navAxon() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  const items = [...nav.querySelectorAll('.nav-item')].filter(n => !n.hidden && n.offsetParent !== null);
  if (items.length < 2) return;
  const mid = n => n.offsetTop + n.offsetHeight / 2;
  const top = mid(items[0]), bottom = mid(items[items.length - 1]);
  nav.style.setProperty('--axon-top', top + 'px');
  nav.style.setProperty('--axon-h', (bottom - top) + 'px');
}
addEventListener('resize', navAxon);

// Sinal que corre de um item do menu ao outro (só quando a página muda de verdade).
function navSignal(from, to) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('a11y-motion');
  if (!from || !to || from === to || reduce || !to.offsetParent) return;
  const seg = document.querySelector('.nn-seg'), pulse = document.querySelector('.nn-pulse');
  if (!seg || !pulse || !seg.animate) return;
  const y1 = from.offsetTop + from.offsetHeight / 2, y2 = to.offsetTop + to.offsetHeight / 2;
  const down = y2 > y1;
  const ease = 'cubic-bezier(.76, 0, .24, 1)';
  seg.style.top = Math.min(y1, y2) + 'px';
  seg.style.height = Math.abs(y2 - y1) + 'px';
  seg.animate([
    { transform: 'scaleY(0)', opacity: 1, transformOrigin: down ? 'top' : 'bottom' },
    { transform: 'scaleY(1)', opacity: 1, transformOrigin: down ? 'top' : 'bottom', offset: 0.65 },
    { transform: 'scaleY(1)', opacity: 0, transformOrigin: down ? 'top' : 'bottom' },
  ], { duration: 620, easing: ease });
  pulse.animate([
    { transform: `translateY(${y1}px)`, opacity: 1 },
    { transform: `translateY(${y2}px)`, opacity: 1, offset: 0.65 },
    { transform: `translateY(${y2}px) scale(2.2)`, opacity: 0 },
  ], { duration: 620, easing: ease });
  to.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(3px)', offset: 0.75 }, { transform: 'translateX(0)' }], { duration: 620, easing: 'ease-out' });
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
