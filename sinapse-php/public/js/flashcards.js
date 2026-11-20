// ============================================================
// flashcards.js — Baralhos de flashcards com repetição espaçada
// (caixas de Leitner). Editor, importação em lote e modo estudo.
// O agendamento das revisões é calculado no servidor (card_review).
// ============================================================

const FC_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
let fcCards = [];
let revisoes = [];
let study = null;

// ---------- Editor ----------
function fcInit(cards) {
  fcCards = (cards || []).map(c => ({
    frente: c.frente || '', verso: c.verso || '', caixa: Number(c.caixa) || 1,
    proxima: c.proxima || '', acertos: Number(c.acertos) || 0, erros: Number(c.erros) || 0,
  }));
  if (!fcCards.length) fcCards.push({ frente: '', verso: '', caixa: 1, proxima: '', acertos: 0, erros: 0 });
  fcRender();
}
function fcRender(focusIndex) {
  const list = document.getElementById('fc-list'); if (!list) return;
  list.innerHTML = fcCards.map((c, i) => `
    <div class="fc-row">
      <span class="fc-num" aria-hidden="true">${i + 1}</span>
      <div class="fc-fields">
        <label class="sr-only" for="fc-f-${i}">Frente do cartão ${i + 1}</label>
        <textarea id="fc-f-${i}" class="fc-front" rows="2" maxlength="500" placeholder="Frente: pergunta ou termo" oninput="fcCards[${i}].frente=this.value">${escapeHTML(c.frente)}</textarea>
        <label class="sr-only" for="fc-v-${i}">Verso do cartão ${i + 1}</label>
        <textarea id="fc-v-${i}" class="fc-back" rows="2" maxlength="5000" placeholder="Verso: resposta ou definição" oninput="fcCards[${i}].verso=this.value" onkeydown="fcBackKey(event,${i})">${escapeHTML(c.verso)}</textarea>
      </div>
      <div class="fc-side">
        ${c.proxima ? `<span class="fc-box" title="Caixa ${c.caixa} de 5 · próxima revisão ${formatDate(c.proxima)}">Caixa ${c.caixa}</span>` : '<span class="fc-box fc-new">Novo</span>'}
        <button type="button" class="btn-sm btn-icon" aria-label="Excluir cartão ${i + 1}" onclick="fcRemove(${i})"><svg class="icon"><use href="#i-trash"/></svg></button>
      </div>
    </div>`).join('');
  document.getElementById('fc-count').textContent = fcCards.length + (fcCards.length === 1 ? ' cartão' : ' cartões');
  if (focusIndex != null) document.getElementById('fc-f-' + focusIndex)?.focus();
}
function fcAdd() {
  if (fcCards.length >= 1000) { showToast('Limite de 1000 cartões por baralho.'); return; }
  fcCards.push({ frente: '', verso: '', caixa: 1, proxima: '', acertos: 0, erros: 0 });
  fcRender(fcCards.length - 1);
}
function fcRemove(i) {
  fcCards.splice(i, 1);
  if (!fcCards.length) fcCards.push({ frente: '', verso: '', caixa: 1, proxima: '', acertos: 0, erros: 0 });
  fcRender();
}
// Ctrl+Enter no verso cria o próximo cartão
function fcBackKey(e, i) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (i === fcCards.length - 1) fcAdd(); else document.getElementById('fc-f-' + (i + 1))?.focus(); }
}
// Importação: uma linha por cartão, frente e verso separados por Tab, ";" ou " - "
function fcImport() {
  const area = document.getElementById('fc-bulk');
  const novos = area.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const sep = l.includes('\t') ? '\t' : l.includes(';') ? ';' : l.includes(' - ') ? ' - ' : null;
    const [f, ...rest] = sep ? l.split(sep) : [l];
    return { frente: f.trim().slice(0, 500), verso: rest.join(sep || '').trim().slice(0, 5000), caixa: 1, proxima: '', acertos: 0, erros: 0 };
  }).filter(c => c.frente);
  if (!novos.length) { showToast('Nada para importar. Use uma linha por cartão.'); return; }
  fcCards = fcCards.filter(c => c.frente.trim() || c.verso.trim()).concat(novos).slice(0, 1000);
  area.value = '';
  fcRender();
  showToast(novos.length + (novos.length === 1 ? ' cartão importado.' : ' cartões importados.'));
}
function fcSerialize() {
  return fcCards.map(c => ({ frente: c.frente, verso: c.verso, caixa: c.caixa, proxima: c.proxima, acertos: c.acertos, erros: c.erros }));
}

// ---------- Modo estudo ----------
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

async function startStudy(fileId, all = false) {
  await runUI(async () => {
    const { file, content } = await api('file_get', null, { id: fileId });
    const today = getTodayPlus(0);
    const cards = content.cards.map(c => ({ ...c, id: Number(c.id), caixa: Number(c.caixa) }));
    const pool = all ? cards.slice() : cards.filter(c => c.proxima <= today);
    const queue = shuffle(pool).sort((a, b) => a.caixa - b.caixa);
    study = {
      fileId, all, nome: file.nome.replace(/\.[^.]+$/, ''), cards, queue, pos: 0, flipped: false,
      stats: { acertei: 0, dificil: 0, errei: 0 }, answered: new Set(), retries: {},
    };
    document.getElementById('study-title').textContent = study.nome;
    openModal('modal-study');
    renderStudy();
  });
}
function renderStudy() {
  const body = document.getElementById('study-body'); if (!body || !study) return;
  const s = study, total = s.queue.length;

  if (!total) {
    const next = s.cards.map(c => c.proxima).sort()[0];
    body.innerHTML = `<div class="study-done">
      <div class="empty-icon"><svg class="icon"><use href="#i-check"/></svg></div>
      <h3>Tudo em dia</h3>
      <p>Nenhum cartão deste baralho precisa de revisão hoje.${next ? ` Próxima revisão em <b>${formatDate(next)}</b>.` : ''}</p>
      <div class="flex gap-8" style="justify-content:center;flex-wrap:wrap">
        <button class="btn-sm" onclick="startStudy(${s.fileId}, true)">Estudar todos mesmo assim</button>
        <button class="btn-add" onclick="closeModal('modal-study')">Fechar</button>
      </div></div>`;
    return;
  }

  if (s.pos >= total) {
    const done = s.answered.size;
    const pct = done ? Math.round((s.stats.acertei + s.stats.dificil) / done * 100) : 0;
    body.innerHTML = `<div class="study-done">
      <h3>Sessão concluída</h3>
      <p>Você revisou ${done} ${done === 1 ? 'cartão' : 'cartões'} e lembrou de ${pct}% na primeira tentativa.</p>
      <div class="study-stats">
        <div class="ok"><b>${s.stats.acertei}</b><span>Acertei</span></div>
        <div class="mid"><b>${s.stats.dificil}</b><span>Difícil</span></div>
        <div class="bad"><b>${s.stats.errei}</b><span>Errei</span></div>
      </div>
      <p class="study-note">Os cartões voltam automaticamente quando for a hora de revisar: quanto mais você acerta, maior o intervalo.</p>
      <div class="flex gap-8" style="justify-content:center;flex-wrap:wrap">
        <button class="btn-sm" onclick="startStudy(${s.fileId}, true)">Estudar todos novamente</button>
        <button class="btn-add" onclick="closeModal('modal-study')">Concluir</button>
      </div></div>`;
    body.querySelector('.btn-add').focus();
    return;
  }

  const c = s.queue[s.pos];
  const next = Math.min(5, c.caixa + 1);
  body.innerHTML = `
    <div class="study-top"><span>Cartão ${s.pos + 1} de ${total}</span><span class="fc-box" title="Quanto maior a caixa, mais memorizado">Caixa ${c.caixa} de 5</span></div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(s.pos / total * 100)}%;animation:none"></div></div>
    <button type="button" class="flashcard" id="study-card" aria-describedby="study-tip" onclick="flipCard()">
      <span class="flashcard-inner">
        <span class="flashcard-face front"><small>Pergunta</small><span class="fc-text">${escapeHTML(c.frente)}</span></span>
        <span class="flashcard-face back" aria-hidden="true"><small>Resposta</small><span class="fc-text">${escapeHTML(c.verso || '(sem resposta)')}</span></span>
      </span>
    </button>
    <p class="study-tip" id="study-tip">Pense na resposta e clique no cartão (ou <kbd>Espaço</kbd>) para conferir.</p>
    <div class="study-actions" id="study-actions" hidden>
      <button type="button" class="rate rate-bad" onclick="answerCard('errei')"><b>Errei</b><small>rever hoje</small><kbd>1</kbd></button>
      <button type="button" class="rate rate-mid" onclick="answerCard('dificil')"><b>Difícil</b><small>amanhã</small><kbd>2</kbd></button>
      <button type="button" class="rate rate-good" onclick="answerCard('acertei')"><b>Acertei</b><small>em ${FC_INTERVALS[next]} ${FC_INTERVALS[next] === 1 ? 'dia' : 'dias'}</small><kbd>3</kbd></button>
    </div>`;
  document.getElementById('study-card').focus({ preventScroll: true });
}
function flipCard() {
  if (!study) return;
  const card = document.getElementById('study-card'); if (!card) return;
  study.flipped = !study.flipped;
  card.classList.toggle('flipped', study.flipped);
  card.querySelector('.front').setAttribute('aria-hidden', String(study.flipped));
  card.querySelector('.back').setAttribute('aria-hidden', String(!study.flipped));
  if (study.flipped) {
    document.getElementById('study-actions').hidden = false;
    document.getElementById('study-tip').textContent = 'Como foi? Seja honesto: isso define quando o cartão volta.';
  }
}
function answerCard(resp) {
  const s = study; if (!s || !s.flipped) return;
  const c = s.queue[s.pos];
  if (!s.answered.has(c.id)) { s.answered.add(c.id); s.stats[resp]++; }
  // Errou: o cartão volta ao fim da fila desta sessão (até 3 vezes).
  if (resp === 'errei' && (s.retries[c.id] || 0) < 3) { s.retries[c.id] = (s.retries[c.id] || 0) + 1; s.queue.push({ ...c, caixa: 1 }); }
  api('card_review', { id: c.id, resposta: resp }).catch(e => showToast(e.message || 'Não foi possível salvar a revisão.'));
  s.pos++; s.flipped = false;
  renderStudy();
}
// Atalhos do modo estudo
document.addEventListener('keydown', e => {
  if (!study || !document.getElementById('modal-study').classList.contains('open')) return;
  if (e.target.matches('input, textarea')) return;
  if (['1', '2', '3'].includes(e.key) && study.flipped) {
    e.preventDefault(); answerCard({ 1: 'errei', 2: 'dificil', 3: 'acertei' }[e.key]);
  }
});
// Ao fechar o estudo, atualiza o painel (cartões pendentes).
(function () {
  const orig = window.closeModal;
  window.closeModal = function (id) {
    orig(id);
    if (id === 'modal-study' && study) {
      study = null;
      api('state').then(s => { applyState(s); renderAll(); }).catch(() => {});
    }
  };
})();

// ---------- Painel: revisões de hoje ----------
function renderRevisoes() {
  const box = document.getElementById('dash-reviews'); if (!box) return;
  if (!revisoes.length) {
    box.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg class="icon"><use href="#i-cards"/></svg></div>
      <div>Crie um baralho de flashcards para revisar com repetição espaçada.</div>
      <button class="btn-sm" onclick="goPage('ferramentas');openTool('flashcards')">Criar baralho</button></div>`;
    return;
  }
  const pend = revisoes.reduce((s, r) => s + r.pendentes, 0);
  box.innerHTML = `<div class="review-sum">${pend ? `<b>${pend}</b> ${pend === 1 ? 'cartão para revisar hoje' : 'cartões para revisar hoje'}` : 'Tudo revisado por hoje.'}</div>` +
    revisoes.slice(0, 5).map(r => `
    <div class="review-row">
      <div class="file-icon-big"><svg class="icon"><use href="#i-cards"/></svg></div>
      <div class="review-info"><div class="file-name">${escapeHTML(r.nome)}</div><div class="file-meta">${r.total} ${r.total === 1 ? 'cartão' : 'cartões'} · ${r.pendentes ? r.pendentes + ' pendentes' : 'em dia'}</div></div>
      <button class="${r.pendentes ? 'btn-add' : 'btn-sm'}" onclick="startStudy(${r.id})"><svg class="icon"><use href="#i-play"/></svg>${r.pendentes ? 'Revisar' : 'Estudar'}</button>
    </div>`).join('');
}
