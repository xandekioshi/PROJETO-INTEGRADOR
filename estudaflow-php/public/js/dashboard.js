// ============================================================
// dashboard.js — Resumo da página inicial, calculado a partir
// do estado real (metas, eventos, arquivos, livros, atividades)
// ============================================================

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Atividades são gravadas pelo servidor, junto das operações.

function timeAgo(ts) {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `${d} dias`;
}

function eventosDaSemana() {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const a = toISODate(monday), b = toISODate(sunday);
  return eventos.filter(ev => ev.data >= a && ev.data <= b).length;
}

function renderDashboard() {
  const $ = id => document.getElementById(id);
  if (!$('dash-docs')) return;

  // Cards de resumo
  $('dash-docs').textContent = arquivos.length;
  $('dash-metas').textContent = metas.filter(m => m.done).length + '/' + metas.length;
  $('dash-eventos').textContent = eventosDaSemana();
  $('dash-livros').textContent = books.length;

  // Progresso das metas, agrupado por disciplina
  const prog = $('dash-progress');
  if (!metas.length) {
    prog.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🎯</div>
      <div>Nenhuma meta criada ainda</div>
      <button class="btn-sm" onclick="openModal('modal-meta')">Criar primeira meta</button>
    </div>`;
  } else {
    const cores = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', 'var(--accent4)'];
    const grupos = Object.create(null);
    metas.forEach(m => { (grupos[m.disciplina] = grupos[m.disciplina] || []).push(m); });
    prog.innerHTML = Object.entries(grupos).map(([disc, lista], i) => {
      const pct = Math.round(lista.filter(m => m.done).length / lista.length * 100);
      return `<div style="margin-bottom:14px">
        <div class="flex-center" style="justify-content:space-between;margin-bottom:6px"><span style="font-size:.85rem">${escapeHTML(disc)}</span><span style="font-size:.8rem;color:var(--text2)">${pct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${cores[i % cores.length]}"></div></div>
      </div>`;
    }).join('');
  }

  // Atividade recente
  const act = $('dash-activity');
  act.innerHTML = atividades.length
    ? atividades.slice(0, 6).map(a => `
      <div class="activity-item"><div class="activity-dot" style="background:${a.cor}"></div><div class="activity-text">${escapeHTML(a.texto)}</div><div class="activity-time">${timeAgo(a.ts)}</div></div>`).join('')
    : `<div class="empty-state"><div class="empty-icon">🕑</div><div>Nenhuma atividade ainda</div></div>`;
}
