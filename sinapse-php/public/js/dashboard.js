// ============================================================
// dashboard.js — Painel inicial do usuário.
// Desenha o resumo a partir do estado real (metas, eventos, arquivos, revisões, atividades)
// e toca a sequência de entrada: cada bloco "dispara" como uma sinapse (css/app.css).
// ============================================================

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function timeAgo(ts) {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

function eventosDaSemana() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const a = toISODate(monday), b = toISODate(sunday);
  return eventos.filter(ev => ev.data >= a && ev.data <= b).length;
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const motionOff = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('a11y-motion');

function saudacao() {
  const h = new Date().getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

// Números do resumo (usa a view do banco quando disponível).
function dashNumbers() {
  const r = dashboardResumo;
  return {
    docs: r ? Number(r.documentos_criados) : arquivos.length,
    metasDone: r ? Number(r.metas_concluidas) : metas.filter(m => m.done).length,
    metasTotal: r ? Number(r.metas_total) : metas.length,
    eventos: r ? Number(r.eventos_semana) : eventosDaSemana(),
    pend: revisoes.reduce((s, x) => s + x.pendentes, 0),
    hoje: atividades.filter(a => new Date(a.ts).toDateString() === new Date().toDateString()).length,
  };
}

function renderDashboard() {
  const $ = id => document.getElementById(id);
  if (!$('dash-docs')) return;
  const n = dashNumbers();

  // Cabeçalho
  $('dash-greet').textContent = saudacao();
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('dash-date').textContent = date.charAt(0).toUpperCase() + date.slice(1);
  const parts = [];
  if (n.pend) parts.push(`<b>${plural(n.pend, 'cartão', 'cartões')}</b> para revisar`);
  if (n.eventos) parts.push(`<b>${plural(n.eventos, 'evento', 'eventos')}</b> nesta semana`);
  const abertas = n.metasTotal - n.metasDone;
  if (abertas) parts.push(`<b>${plural(abertas, 'meta aberta', 'metas abertas')}</b>`);
  $('dash-summary').innerHTML = parts.length
    ? 'Hoje você tem ' + parts.join(parts.length > 2 ? ', ' : ' e ').replace(/, ([^,]*)$/, ' e $1') + '.'
    : 'Tudo em dia por aqui. Que tal criar uma meta ou um baralho novo?';
  $('dash-brain-note').innerHTML = n.hoje
    ? `<b>${n.hoje}</b> ${n.hoje === 1 ? 'conexão feita hoje' : 'conexões feitas hoje'}`
    : 'Nenhuma conexão hoje ainda';
  if (DASH.brain) DASH.brain.setRate(0.7 - Math.min(n.hoje, 10) * 0.05);

  // Números
  $('dash-docs').textContent = n.docs;
  $('dash-metas').textContent = n.metasDone + '/' + n.metasTotal;
  $('dash-eventos').textContent = n.eventos;
  $('dash-pend').textContent = n.pend;
  $('dash-pend').closest('.dstat').classList.toggle('hot', n.pend > 0);

  renderRevisoes();
  renderGoals();
  renderActivity();
}

// ---------- Revisões de hoje ----------
function renderRevisoes() {
  const box = document.getElementById('dash-reviews'); if (!box) return;
  if (!revisoes.length) {
    box.innerHTML = `<div class="dash-empty"><span class="mini-neuron" aria-hidden="true"></span>
      <p>Crie um baralho de flashcards e o Sinapse avisa aqui quando for hora de revisar.</p>
      <button class="btn-add" onclick="goPage('ferramentas');openTool('flashcards')"><svg class="icon"><use href="#i-cards"/></svg>Criar baralho</button></div>`;
    return;
  }
  const pend = revisoes.reduce((s, r) => s + r.pendentes, 0);
  const head = pend
    ? `<div class="rv-total"><b>${pend}</b><span>${pend === 1 ? 'cartão esperando<br>por você hoje' : 'cartões esperando<br>por você hoje'}</span></div>`
    : `<div class="rv-total rv-ok"><b><svg class="icon"><use href="#i-check"/></svg></b><span>Tudo revisado por hoje.<br>Sua memória agradece.</span></div>`;
  box.innerHTML = head + '<ul class="rv-list">' + revisoes.slice(0, 4).map((r, i) => {
    const done = r.total ? Math.round((r.total - r.pendentes) / r.total * 100) : 100;
    return `<li class="rv-row syn-item" style="--t:${1.7 + i * 0.1}">
      <div class="rv-info"><span class="rv-name">${escapeHTML(r.nome)}</span>
        <span class="rv-meta">${plural(r.total, 'cartão', 'cartões')} · ${r.pendentes ? r.pendentes + (r.pendentes === 1 ? ' pendente' : ' pendentes') : 'em dia'}</span>
        <span class="rv-bar" style="--w:${done / 100}"><i></i></span></div>
      <button class="${r.pendentes ? 'btn-add' : 'btn-sm'}" onclick="startStudy(${r.id})"><svg class="icon"><use href="#i-play"/></svg>${r.pendentes ? 'Revisar' : 'Estudar'}</button>
    </li>`;
  }).join('') + '</ul>';
}

// ---------- Progresso das metas: um anel por assunto ----------
function renderGoals() {
  const box = document.getElementById('dash-progress'); if (!box) return;
  if (!metas.length) {
    box.innerHTML = `<div class="dash-empty"><span class="mini-neuron" aria-hidden="true"></span>
      <p>Defina metas por assunto e acompanhe aqui o quanto já avançou.</p>
      <button class="btn-add" onclick="openModal('modal-meta')"><svg class="icon"><use href="#i-target"/></svg>Criar meta</button></div>`;
    return;
  }
  const grupos = new Map();
  metas.forEach(m => {
    const g = grupos.get(m.disciplina) || { total: 0, done: 0 };
    g.total++; if (m.done) g.done++;
    grupos.set(m.disciplina, g);
  });
  // faíscas em volta do anel quando o assunto está 100% concluído
  const sparks = Array.from({ length: 8 }, (_, k) => {
    const a = k / 8 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    return `<line class="ring-spark" x1="${(40 + c * 37).toFixed(1)}" y1="${(40 + s * 37).toFixed(1)}" x2="${(40 + c * 42).toFixed(1)}" y2="${(40 + s * 42).toFixed(1)}"/>`;
  }).join('');
  box.innerHTML = '<div class="rings">' + [...grupos].slice(0, 8).map(([disc, g], i) => {
    const pct = Math.round(g.done / g.total * 100);
    return `<div class="ring syn-item${pct === 100 ? ' done' : ''}" style="--p:${pct};--t:${1.85 + i * 0.09}">
      <svg viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-track" cx="40" cy="40" r="31"/><circle class="ring-fill" cx="40" cy="40" r="31" pathLength="100"/>${pct === 100 ? sparks : ''}</svg>
      <b class="ring-pct">${pct}%</b>
      <span class="ring-name" title="${escapeHTML(disc)}">${escapeHTML(disc)}</span>
      <small>${g.done} de ${g.total}</small>
    </div>`;
  }).join('') + '</div>';
}

// ---------- Atividade recente: linha do tempo em forma de axônio ----------
function renderActivity() {
  const box = document.getElementById('dash-activity'); if (!box) return;
  if (!atividades.length) {
    box.innerHTML = `<div class="dash-empty dash-empty-row"><span class="mini-neuron" aria-hidden="true"></span><p>Suas atividades aparecem aqui conforme você usa o Sinapse.</p></div>`;
    return;
  }
  const list = atividades.slice(0, 6);
  box.innerHTML = `<ol class="tl syn-item" style="--n:${list.length};--t:2.05">` + list.map((a, i) => `
    <li class="tl-item syn-item${i === 0 ? ' latest' : ''}" style="--c:${a.cor};--t:${2.15 + i * 0.12}">
      <p>${escapeHTML(a.texto)}</p><time>${timeAgo(a.ts)}</time>
    </li>`).join('') + '</ol>';
}

// ---------- Sequência de entrada ----------
const DASH = { user: null, brain: null, timer: 0 };

// Faz o número "contar" até o valor final (ex.: "3/8").
function countUp(el, delay) {
  const final = el.textContent.trim();
  if (!/\d/.test(final)) return;
  el.textContent = final.replace(/\d+/g, '0');
  setTimeout(() => {
    let t0 = 0; const dur = 700;
    const tick = now => {
      if (!t0) t0 = now; // começa a contar no primeiro quadro (evita progresso negativo)
      const p = Math.min(Math.max((now - t0) / dur, 0), 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? final.replace(/\d+/g, m => Math.round(Number(m) * e)) : final;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, delay);
}

function playDashboard() {
  const page = document.getElementById('page-dashboard');
  if (!page || !currentUser) return;
  // Sequência completa na primeira vez após entrar; nas visitas seguintes, uma versão curta.
  const full = DASH.user !== currentUser.id;
  DASH.user = currentUser.id;
  const k = full ? 1 : 0.4;
  page.style.setProperty('--k', k);
  page.classList.remove('dash-play', 'dash-settled');
  clearTimeout(DASH.timer);

  if (!DASH.brain && typeof createBrain === 'function') {
    DASH.brain = createBrain(document.getElementById('dash-brain'), { points: innerWidth < 720 ? 500 : 820, scale: 0.5, rate: 0.6 });
    renderDashboard();
  }
  if (motionOff()) { page.classList.add('dash-settled'); return; }

  void page.offsetWidth; // reinicia as animações CSS
  page.classList.add('dash-play');
  if (DASH.brain) setTimeout(() => DASH.brain.burst(full ? 10 : 4), 150);
  page.querySelectorAll('.dstat-value').forEach(el => {
    const t = parseFloat(el.closest('.dstat').style.getPropertyValue('--t')) || 0;
    countUp(el, t * 1000 * k + 120);
  });
  DASH.timer = setTimeout(() => page.classList.add('dash-settled'), (full ? 3600 : 1600));
}
