// ============================================================
// metas.js — Página "Metas de Estudo": listar, filtrar, criar,
// concluir e remover metas
// ============================================================

let metaJustToggled = null; // id da meta recém-marcada: só ela toca a animação de "disparo"

// Quantos dias faltam para a data (negativo = já passou).
function diasAte(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - hoje) / 86400000);
}
function prazoTexto(iso, done) {
  const n = diasAte(iso);
  if (n === null) return { txt: 'sem prazo', cls: '' };
  if (done) return { txt: 'prazo ' + formatDate(iso), cls: '' };
  if (n < 0) return { txt: `atrasada há ${-n} ${n === -1 ? 'dia' : 'dias'}`, cls: 'late' };
  if (n === 0) return { txt: 'vence hoje', cls: 'soon' };
  if (n === 1) return { txt: 'vence amanhã', cls: 'soon' };
  return { txt: `em ${n} dias · ${formatDate(iso)}`, cls: n <= 3 ? 'soon' : '' };
}

function renderMetas(filter = 'todas') {
  const list = document.getElementById('metas-list'); if (!list) return;
  renderMetasSummary();
  const filtered = filter === 'todas' ? metas
    : filter === 'concluida' ? metas.filter(m => m.done)
    : filter === 'pendente' ? metas.filter(m => !m.done)
    : metas.filter(m => m.prioridade === 'urgente' && !m.done);
  const badges = { normal: 'badge-blue', urgente: 'badge-red', baixa: 'badge-green' };
  const badgeLabel = { normal: 'Normal', urgente: 'Urgente', baixa: 'Baixa' };
  list.innerHTML = filtered.length ? filtered.map(m => {
    const p = prazoTexto(m.prazo, m.done);
    const just = m.id === metaJustToggled ? ' just' : '';
    return `
    <div class="meta-item${m.done ? ' is-done' : ''}${just}">
      <button type="button" class="meta-check${m.done ? ' done' : ''}" onclick="toggleMeta(${m.id})" aria-pressed="${m.done}" aria-label="${m.done ? 'Desmarcar' : 'Concluir'}: ${escapeHTML(m.nome)}"><svg class="icon"><use href="#i-check"/></svg></button>
      <div class="meta-info">
        <div class="meta-name${m.done ? ' done' : ''}">${escapeHTML(m.nome)}</div>
        <div class="meta-detail"><span class="meta-disc">${escapeHTML(m.disciplina)}</span><span class="meta-due ${p.cls}">${p.txt}</span></div>
      </div>
      <span class="meta-badge ${badges[m.prioridade]}">${badgeLabel[m.prioridade]}</span>
      <button class="btn-sm btn-icon" aria-label="Excluir meta ${escapeHTML(m.nome)}" onclick="delMeta(${m.id})"><svg class="icon"><use href="#i-x"/></svg></button>
    </div>`;
  }).join('') : `<div class="dash-empty"><span class="mini-neuron" aria-hidden="true"></span><p>${metas.length ? 'Nenhuma meta neste filtro.' : 'Você ainda não tem metas. Comece por algo pequeno, como “revisar o capítulo 1”.'}</p>${metas.length ? '' : '<button class="btn-add" onclick="openModal(\'modal-meta\')"><svg class="icon"><use href="#i-plus"/></svg>Criar primeira meta</button>'}</div>`;
  metaJustToggled = null;
  renderDashboard();
}

// Resumo no topo: barra em forma de axônio com um nó no ponto do progresso.
function renderMetasSummary() {
  const box = document.getElementById('metas-summary'); if (!box) return;
  if (!metas.length) { box.innerHTML = ''; return; }
  const done = metas.filter(m => m.done).length, pct = Math.round(done / metas.length * 100);
  const late = metas.filter(m => !m.done && diasAte(m.prazo) < 0).length;
  const soon = metas.filter(m => !m.done && diasAte(m.prazo) >= 0 && diasAte(m.prazo) <= 3).length;
  box.innerHTML = `
    <div class="ms-text"><b>${done}</b> de ${metas.length} concluídas <span>${pct}%</span></div>
    <div class="ms-axon" style="--p:${pct / 100}"><i></i><b></b></div>
    <div class="ms-flags">${soon ? `<span class="soon">${soon} ${soon === 1 ? 'vence' : 'vencem'} em até 3 dias</span>` : ''}${late ? `<span class="late">${late} ${late === 1 ? 'atrasada' : 'atrasadas'}</span>` : ''}</div>`;
}

// As ações de escrita e os filtros são implementados em integration.js.

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
