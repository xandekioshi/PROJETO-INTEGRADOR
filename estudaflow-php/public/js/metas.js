// ============================================================
// metas.js — Página "Metas de Estudo": listar, filtrar, criar,
// concluir e remover metas
// ============================================================

function renderMetas(filter = 'todas') {
  const list = document.getElementById('metas-list'); if (!list) return;
  const filtered = filter === 'todas' ? metas
    : filter === 'concluida' ? metas.filter(m => m.done)
    : filter === 'pendente' ? metas.filter(m => !m.done)
    : metas.filter(m => m.prioridade === 'urgente' && !m.done);
  const badges = { normal: 'badge-blue', urgente: 'badge-red', baixa: 'badge-green' };
  const badgeLabel = { normal: 'Normal', urgente: 'Urgente', baixa: 'Baixa' };
  list.innerHTML = filtered.length ? filtered.map(m => `
    <div class="meta-item">
      <div class="meta-check ${m.done ? 'done' : ''}" onclick="toggleMeta(${m.id})">${m.done ? '✓' : ''}</div>
      <div class="meta-info">
        <div class="meta-name ${m.done ? 'done' : ''}">${escapeHTML(m.nome)}</div>
        <div class="meta-detail">${escapeHTML(m.disciplina)} · prazo: ${formatDate(m.prazo)}</div>
      </div>
      <span class="meta-badge ${badges[m.prioridade]}">${badgeLabel[m.prioridade]}</span>
      <button class="btn-sm" style="padding:5px 10px;font-size:.75rem" onclick="delMeta(${m.id})">✕</button>
    </div>`).join('') : `<div class="empty-state"><div class="empty-icon">🎯</div><div>${metas.length ? 'Nenhuma meta neste filtro' : 'Você ainda não tem metas'}</div>${metas.length ? '' : '<button class="btn-sm" onclick="openModal(\'modal-meta\')">+ Criar primeira meta</button>'}</div>`;
  renderDashboard();
}

// As ações de escrita e os filtros são implementados em integration.js.

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
