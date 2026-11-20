// ============================================================
// a11y.js — Assistente de acessibilidade, tema claro/escuro e
// melhorias de navegação por teclado.
// As preferências ficam em localStorage ('ef_a11y'); o <head>
// do index.html aplica as classes antes da primeira pintura.
// ============================================================

const A11Y_KEY = 'ef_a11y';
const A11Y_CLASSES = ['contrast', 'font', 'spacing', 'links', 'motion', 'cursor'];
const FS_STEPS = [0.875, 1, 1.125, 1.25, 1.375, 1.5];
const root = document.documentElement;
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

let a11y = loadPrefs();

function loadPrefs() {
  try { return Object.assign({ theme: 'system', fs: 1, libras: true }, JSON.parse(localStorage.getItem(A11Y_KEY) || '{}')); }
  catch (e) { return { theme: 'system', fs: 1, libras: true }; }
}
function savePrefs() {
  try { localStorage.setItem(A11Y_KEY, JSON.stringify(a11y)); } catch (e) { /* navegação privada: segue sem salvar */ }
}
function announce(msg) {
  const live = document.getElementById('a11y-live');
  live.textContent = '';
  setTimeout(() => { live.textContent = msg; }, 30);
}

// ---------- Tema ----------
function resolvedTheme() {
  return a11y.theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : a11y.theme;
}
function applyTheme(animate) {
  if (animate && !a11y.motion) {
    root.classList.add('theme-fade');
    setTimeout(() => root.classList.remove('theme-fade'), 400);
  }
  root.setAttribute('data-theme', resolvedTheme());
  document.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeSet === a11y.theme)));
  const dark = resolvedTheme() === 'dark';
  document.querySelectorAll('.theme-toggle').forEach(b => b.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro'));
}
function setTheme(theme) {
  a11y.theme = theme; savePrefs(); applyTheme(true);
  announce(theme === 'system' ? 'Tema do sistema' : theme === 'dark' ? 'Modo escuro ativado' : 'Modo claro ativado');
}
function toggleTheme() { setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark'); }
darkQuery.addEventListener('change', () => { if (a11y.theme === 'system') applyTheme(true); });

// ---------- Tamanho do texto ----------
function applyFontSize() {
  root.style.setProperty('--fs', a11y.fs);
  document.getElementById('a11y-fs-value').textContent = Math.round(a11y.fs * 100) + '%';
  document.querySelector('[data-fs="-1"]').disabled = a11y.fs <= FS_STEPS[0];
  document.querySelector('[data-fs="1"]').disabled = a11y.fs >= FS_STEPS[FS_STEPS.length - 1];
}
function stepFontSize(dir) {
  let i = FS_STEPS.indexOf(a11y.fs); if (i < 0) i = 1;
  a11y.fs = FS_STEPS[Math.min(FS_STEPS.length - 1, Math.max(0, i + dir))];
  savePrefs(); applyFontSize();
}

// ---------- Recursos liga/desliga ----------
const OPT_NAMES = {
  contrast: 'Alto contraste', font: 'Fonte legível', spacing: 'Espaçamento de texto', links: 'Destaque de links',
  motion: 'Pausa de animações', guide: 'Guia de leitura', cursor: 'Cursor ampliado', tts: 'Leitura em voz alta', libras: 'Tradutor de Libras',
};
function applyOptions() {
  A11Y_CLASSES.forEach(k => root.classList.toggle('a11y-' + k, !!a11y[k]));
  root.classList.toggle('a11y-libras', a11y.libras !== false);
  document.querySelectorAll('.a11y-opt').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.opt === 'libras' ? a11y.libras !== false : !!a11y[b.dataset.opt])));
  document.getElementById('a11y-guide').hidden = !a11y.guide;
  if (!a11y.tts) stopSpeaking();
}
function toggleOption(key) {
  a11y[key] = key === 'libras' ? a11y.libras === false : !a11y[key];
  savePrefs(); applyOptions();
  const on = key === 'libras' ? a11y.libras !== false : a11y[key];
  announce(OPT_NAMES[key] + (on ? ' ativado' : ' desativado'));
  if (key === 'tts' && on) speak('Leitura em voz alta ativada. Clique ou navegue com Tab para ouvir cada item.');
}
function resetA11y() {
  stopSpeaking();
  a11y = { theme: 'system', fs: 1, libras: true };
  savePrefs(); applyTheme(true); applyFontSize(); applyOptions();
  announce('Preferências de acessibilidade redefinidas');
}

// ---------- Guia de leitura ----------
const guide = document.getElementById('a11y-guide');
addEventListener('pointermove', e => {
  if (!a11y.guide) return;
  guide.style.transform = `translateY(${e.clientY - guide.offsetHeight / 2}px)`;
}, { passive: true });

// ---------- Leitura em voz alta (Web Speech API) ----------
const ttsSupported = 'speechSynthesis' in window;
let speakingEl = null;
function stopSpeaking() {
  if (ttsSupported) speechSynthesis.cancel();
  if (speakingEl) speakingEl.classList.remove('a11y-speaking');
  speakingEl = null;
}
function speak(text, el) {
  if (!ttsSupported || !text) return;
  stopSpeaking();
  const u = new SpeechSynthesisUtterance(text.slice(0, 600));
  u.lang = 'pt-BR';
  const voice = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('pt'));
  if (voice) u.voice = voice;
  if (el) { speakingEl = el; el.classList.add('a11y-speaking'); }
  u.onend = () => { if (el) el.classList.remove('a11y-speaking'); };
  speechSynthesis.speak(u);
}
const READABLE = 'button, a, label, input, select, textarea, [role="button"], [role="tab"], h1, h2, h3, p, li, .stat-card, .meta-item, .book-card, .file-card, .activity-item, .event-chip, .tool-card, .lp-feature, .page-sub, .lp-eyebrow, .section-title';
function textOf(el) {
  if (el.matches('input, select, textarea')) {
    const label = el.id && document.querySelector(`label[for="${el.id}"]`);
    const value = el.type === 'password' ? '' : (el.value || '');
    return [label ? label.textContent : el.getAttribute('aria-label') || el.placeholder, value].filter(Boolean).join(': ');
  }
  return (el.getAttribute('aria-label') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
}
function readTarget(target) {
  if (!a11y.tts || !(target instanceof Element) || target.closest('.a11y-panel, .a11y-fab')) return;
  const el = target.closest(READABLE);
  if (el) speak(textOf(el), el);
}
document.addEventListener('click', e => readTarget(e.target), true);
document.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) readTarget(e.target); });

// ---------- Painel ----------
const fab = document.getElementById('a11y-fab');
const panel = document.getElementById('a11y-panel');
let lastFocus = null;
function openA11y() {
  lastFocus = document.activeElement;
  panel.hidden = false; fab.setAttribute('aria-expanded', 'true');
  panel.querySelector('[aria-checked="true"], button').focus();
}
function closeA11y(returnFocus = true) {
  if (panel.hidden) return;
  panel.hidden = true; fab.setAttribute('aria-expanded', 'false');
  if (returnFocus) (lastFocus && lastFocus.isConnected ? lastFocus : fab).focus();
}
fab.addEventListener('click', () => (panel.hidden ? openA11y() : closeA11y()));
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.themeSet) setTheme(b.dataset.themeSet);
  else if (b.dataset.fs) stepFontSize(Number(b.dataset.fs));
  else if (b.dataset.opt) toggleOption(b.dataset.opt);
  else if (b.hasAttribute('data-a11y-reset')) resetA11y();
  else if (b.hasAttribute('data-a11y-close')) closeA11y();
});
// Setas navegam entre as opções de tema (padrão de radiogroup).
panel.querySelector('.a11y-seg').addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const items = [...e.currentTarget.querySelectorAll('button')];
  const i = items.indexOf(document.activeElement);
  const next = items[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
  next.focus(); setTheme(next.dataset.themeSet);
});
document.addEventListener('pointerdown', e => {
  if (!panel.hidden && !panel.contains(e.target) && !fab.contains(e.target)) closeA11y(false);
});
if (!ttsSupported) {
  const b = panel.querySelector('[data-opt="tts"]');
  b.disabled = true; b.querySelector('small').textContent = 'Não suportado neste navegador';
}

// ---------- Teclado em todo o site ----------
// Elementos clicáveis que não são <button>/<a> ganham papel de botão e foco por Tab.
const NATIVE = 'button, a, input, select, textarea, summary, label';
function enhance(scope) {
  scope.querySelectorAll('[onclick]').forEach(el => {
    if (el.matches(NATIVE) || el.tagName === 'CANVAS' || el.classList.contains('modal-overlay') || el.id === 'auth-overlay') return;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
  });
  scope.querySelectorAll('.modal').forEach(m => {
    if (m.hasAttribute('role')) return;
    const title = m.querySelector('.modal-title');
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    if (title) { title.id = title.id || m.parentElement.id + '-title'; m.setAttribute('aria-labelledby', title.id); }
  });
  scope.querySelectorAll('svg.icon').forEach(svg => svg.setAttribute('aria-hidden', 'true'));
}
let enhanceQueued = false;
new MutationObserver(() => {
  if (enhanceQueued) return;
  enhanceQueued = true;
  requestAnimationFrame(() => { enhanceQueued = false; enhance(document.body); });
}).observe(document.body, { childList: true, subtree: true });
enhance(document.body);

document.addEventListener('keydown', e => {
  // Enter/Espaço ativam elementos com role="button"
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t instanceof Element && t.matches('[role="button"], [role="tab"]') && !t.matches(NATIVE)) {
    e.preventDefault(); t.click(); return;
  }
  // Alt + A abre/fecha o painel
  if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault(); panel.hidden ? openA11y() : closeA11y(); return;
  }
  if (e.key === 'Escape') {
    if (!panel.hidden) { closeA11y(); return; }
    const open = [...document.querySelectorAll('.modal-overlay.open')].pop();
    if (open) { closeModal(open.id); return; }
    stopSpeaking();
  }
});

// Fecha modal ao clicar no fundo escurecido.
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); }));

// Ao abrir um modal, o foco vai para o primeiro campo; ao fechar, volta para onde estava.
(function () {
  const origOpen = window.openModal, origClose = window.closeModal;
  const returnTo = {};
  window.openModal = function (id) {
    returnTo[id] = document.activeElement;
    origOpen(id);
    setTimeout(() => {
      const f = document.querySelector(`#${id} input, #${id} select, #${id} textarea, #${id} button`);
      if (f) f.focus({ preventScroll: true });
    }, 60);
  };
  window.closeModal = function (id) {
    origClose(id);
    const el = returnTo[id];
    if (el && el.isConnected && el.offsetParent !== null) el.focus({ preventScroll: true });
  };
})();

// "Pular para o conteúdo": foca o conteúdo da tela visível.
function skipToContent() {
  const app = document.getElementById('app');
  const target = app.style.display === 'block' ? document.getElementById('conteudo') : document.getElementById('topo');
  target.focus(); target.scrollIntoView();
  return false;
}

// Inicialização
applyTheme(false);
applyFontSize();
applyOptions();
