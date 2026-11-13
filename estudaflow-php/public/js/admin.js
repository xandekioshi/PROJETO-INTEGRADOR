// ============================================================
// admin.js — Painel de administração (somente contas 'admin').
// O menu só aparece para administradores, mas quem decide é a
// API: toda ação admin_* é conferida no servidor (requireAdmin).
// ============================================================

const ADM_ACTIONS = { geral: 'admin_overview', usuarios: 'admin_users', acessos: 'admin_access', conteudos: 'admin_contents', auditoria: 'admin_audit' };
const ADM_TIPOS = { mapa: 'Mapa mental', documento: 'Documento', planilha: 'Planilha', flashcards: 'Flashcards' };
const ADM_EVENTOS = {
  cadastro:  ['Cadastro', 'badge-green'],
  login:     ['Login', 'badge-blue'],
  retorno:   ['Retorno', 'badge-blue'],
  logout:    ['Saída', ''],
  falha:     ['Senha incorreta', 'badge-yellow'],
  bloqueada: ['Conta desativada', 'badge-red'],
};
const ADM_ACOES = {
  promoveu_admin: 'Tornou administrador',
  removeu_admin: 'Removeu administrador',
  desativou_conta: 'Desativou conta',
  reativou_conta: 'Reativou conta',
  redefiniu_senha: 'Redefiniu senha',
  excluiu_conta: 'Excluiu conta',
  excluiu_arquivo: 'Excluiu conteúdo',
};
let admTabAtual = 'geral';
let admData = {};
const admFiltro = { usuarios: 'todos', acessos: 'todos', conteudos: 'todos' };
const admBusca = { usuarios: '', acessos: '', conteudos: '' };

// ---------- integração com o restante do app ----------
const admOriginalUpdateUserUI = updateUserUI;
updateUserUI = function () {
  admOriginalUpdateUserUI();
  const isAdmin = currentUser?.papel === 'admin';
  document.getElementById('nav-admin').hidden = !isAdmin;
  const role = document.querySelector('.user-chip .user-role');
  if (role) role.textContent = isAdmin ? 'Administrador' : 'Ver perfil';
};
const admOriginalShowAuth = showAuth;
showAuth = function () {
  admData = {}; admTabAtual = 'geral'; openFolderKey = null;
  document.getElementById('nav-admin').hidden = true;
  admOriginalShowAuth();
};

// ---------- utilitários ----------
const admNum = n => Number(n || 0).toLocaleString('pt-BR');
function admDate(iso, withTime = true) {
  if (!iso) return '—';
  const d = new Date(iso);
  return withTime ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString('pt-BR');
}
function admAgo(iso) {
  if (!iso) return 'Nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return 'Agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d < 31 ? `há ${d} ${d === 1 ? 'dia' : 'dias'}` : admDate(iso, false);
}
function admSize(bytes) {
  const b = Number(bytes || 0);
  return b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
}
function admBrowser(ua) {
  if (!ua) return '—';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl|PowerShell|python/i.test(ua) ? 'Script' : 'Outro';
  const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return so ? `${nav} · ${so}` : nav;
}
const admInitial = nome => escapeHTML((nome || '?').trim().charAt(0).toUpperCase());
const admEmpty = msg => `<div class="empty-state"><div>${msg}</div></div>`;
function admChips(tab, options) {
  return `<div class="adm-chips">${options.map(([v, label]) => `<button class="mm-btn${admFiltro[tab] === v ? ' active' : ''}" onclick="admFiltro['${tab}']='${v}';renderAdmin()">${label}</button>`).join('')}</div>`;
}
function admSearch(tab, placeholder) {
  return `<label class="sr-only" for="adm-q-${tab}">${placeholder}</label><input id="adm-q-${tab}" class="search-input" type="search" placeholder="${placeholder}" value="${escapeHTML(admBusca[tab])}" oninput="admBusca['${tab}']=this.value;admRenderRows('${tab}')">`;
}

// ---------- carregamento ----------
async function loadAdmin(force = false) {
  if (force) admData = {};
  await admTab(admTabAtual);
}
async function admTab(tab) {
  admTabAtual = tab;
  document.querySelectorAll('.adm-tabs .mm-btn').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on));
  });
  const body = document.getElementById('adm-body');
  if (!admData[tab]) {
    body.innerHTML = '<div class="adm-loading">Carregando…</div>';
    try { admData[tab] = await api(ADM_ACTIONS[tab]); }
    catch (e) { body.innerHTML = admEmpty(escapeHTML(e.message)); return; }
    if (admTabAtual !== tab) return; // o usuário trocou de aba enquanto carregava
  }
  renderAdmin();
}
function renderAdmin() {
  const body = document.getElementById('adm-body');
  const tab = admTabAtual, d = admData[tab];
  if (!d) return;
  if (tab === 'geral') body.innerHTML = admGeralHTML(d);
  if (tab === 'usuarios') {
    body.innerHTML = `<div class="adm-toolbar">${admSearch('usuarios', 'Buscar por nome, e-mail ou curso')}${admChips('usuarios', [['todos', 'Todos'], ['admin', 'Administradores'], ['desativados', 'Desativados']])}</div><div id="adm-rows-usuarios"></div>`;
  }
  if (tab === 'acessos') {
    body.innerHTML = `<div class="adm-toolbar">${admSearch('acessos', 'Buscar por e-mail, nome ou IP')}${admChips('acessos', [['todos', 'Todos'], ['entradas', 'Entradas'], ['falhas', 'Falhas'], ['logout', 'Saídas']])}</div><div id="adm-rows-acessos"></div>`;
  }
  if (tab === 'conteudos') {
    body.innerHTML = `<div class="adm-toolbar">${admSearch('conteudos', 'Buscar por nome do arquivo ou dono')}${admChips('conteudos', [['todos', 'Todos'], ...Object.entries(ADM_TIPOS)])}</div><div id="adm-rows-conteudos"></div>`;
  }
  if (tab === 'auditoria') body.innerHTML = admAuditoriaHTML(d);
  if (['usuarios', 'acessos', 'conteudos'].includes(tab)) admRenderRows(tab);
}

// ---------- visão geral ----------
function admGeralHTML(d) {
  const u = d.usuarios, totalConteudos = d.conteudos.reduce((s, c) => s + c.qtd, 0);
  const stat = (cls, icon, value, label, sub) => `<div class="stat-card ${cls}"><div class="stat-icon"><svg class="icon"><use href="#${icon}"/></svg></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div><div class="adm-stat-sub">${sub}</div></div>`;
  const maxTipo = Math.max(1, ...d.conteudos.map(c => c.qtd));
  return `
    <div class="grid-4" style="margin-bottom:16px">
      ${stat('blue', 'i-users', admNum(u.total), 'Usuários cadastrados', `${admNum(u.ativos)} ativos · ${admNum(u.desativados)} desativados · ${admNum(u.admins)} admin`)}
      ${stat('green', 'i-clock', admNum(u.ativos_7d), 'Ativos nos últimos 7 dias', `${admNum(u.ativos_24h)} nas últimas 24 h`)}
      ${stat('purple', 'i-user', admNum(u.novos_7d), 'Novos cadastros (7 dias)', 'Contas criadas na última semana')}
      ${stat('yellow', 'i-file', admNum(totalConteudos), 'Conteúdos criados', `${admNum(d.outros.cartoes)} cartões ·${admNum(d.outros.metas)} metas · ${admNum(d.outros.eventos)} eventos`)}
    </div>
    ${d.outros.falhas_24h ? `<div class="adm-alert" role="status"><svg class="icon"><use href="#i-shield"/></svg>${admNum(d.outros.falhas_24h)} tentativa(s) de login sem sucesso nas últimas 24 h. <button class="adm-link" onclick="admFiltro.acessos='falhas';admTab('acessos')">Ver tentativas</button></div>` : ''}
    <div class="card" style="margin-bottom:16px">${admChartHTML(d.acessos)}</div>
    <div class="grid-2">
      <div class="card">
        <div class="section-title">Conteúdos por tipo</div>
        ${d.conteudos.map(c => `<div class="adm-hbar"><span class="adm-hbar-label">${FILE_ICONS[c.codigo] || ''}${escapeHTML(c.nome)}</span><span class="adm-hbar-track"><span style="width:${(c.qtd / maxTipo) * 100}%"></span></span><span class="adm-hbar-value">${admNum(c.qtd)}<small>${admSize(c.bytes)}</small></span></div>`).join('')}
      </div>
      <div class="card">
        <div class="section-title">Quem mais cria conteúdo</div>
        ${d.top.length ? d.top.map(t => `<div class="adm-person"><span class="avatar">${admInitial(t.nome)}</span><span class="adm-person-text"><span>${escapeHTML(t.nome)}</span><small>${escapeHTML(t.email)}</small></span><strong>${admNum(t.arquivos)}</strong></div>`).join('') : '<div class="adm-muted">Ninguém criou conteúdo ainda.</div>'}
      </div>
    </div>
    <div class="card mt-16">
      <div class="section-title">Cadastros recentes</div>
      ${d.recentes.map(r => `<div class="adm-person"><span class="avatar">${admInitial(r.nome)}</span><span class="adm-person-text"><span>${escapeHTML(r.nome)}</span><small>${escapeHTML(r.email)}</small></span><span class="adm-muted">${admAgo(r.criado_em)}</span></div>`).join('')}
    </div>`;
}

// Gráfico de barras com uma série (entradas por dia). Sem legenda: o título nomeia a série.
function admChartHTML(dias) {
  const total = dias.reduce((s, x) => s + x.entradas, 0);
  const pessoas = dias.reduce((s, x) => s + x.usuarios, 0);
  const max = Math.max(...dias.map(x => x.entradas));
  const top = max <= 4 ? 4 : Math.ceil(max / 5) * 5; // topo do eixo arredondado
  const label = iso => { const [, m, dd] = iso.split('-'); return `${dd}/${m}`; };
  const bars = dias.map((x, i) => {
    const tip = `${label(x.dia)} · ${x.entradas} ${x.entradas === 1 ? 'entrada' : 'entradas'} · ${x.usuarios} ${x.usuarios === 1 ? 'usuário' : 'usuários'}${x.falhas ? ` · ${x.falhas} ${x.falhas === 1 ? 'falha' : 'falhas'}` : ''}`;
    return `<div class="adm-col" tabindex="0" aria-label="${tip}">
      <div class="adm-bar" style="height:${(x.entradas / top) * 100}%"></div>
      <div class="adm-tip" role="tooltip">${tip}</div>
      <div class="adm-xlabel">${i % 2 === dias.length % 2 ? '' : label(x.dia)}</div>
    </div>`;
  }).join('');
  return `
    <div class="adm-chart-head">
      <div><div class="section-title" style="margin-bottom:4px">Acessos nos últimos 14 dias</div>
      <div class="adm-chart-sum"><strong>${admNum(total)}</strong> entradas · média de ${(pessoas / dias.length).toFixed(1).replace('.', ',')} usuários por dia</div></div>
    </div>
    <div class="adm-chart" role="group" aria-label="Entradas por dia nos últimos 14 dias">
      <div class="adm-yaxis"><span>${top}</span><span>${top / 2}</span><span>0</span></div>
      <div class="adm-plot">${bars}</div>
    </div>
    <details class="adm-table-toggle"><summary>Ver como tabela</summary>
      <div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Dia</th><th>Entradas</th><th>Usuários</th><th>Falhas de login</th></tr></thead>
      <tbody>${dias.slice().reverse().map(x => `<tr><td>${label(x.dia)}</td><td>${x.entradas}</td><td>${x.usuarios}</td><td>${x.falhas}</td></tr>`).join('')}</tbody></table></div>
    </details>`;
}

// ---------- tabelas filtráveis ----------
function admRenderRows(tab) {
  const box = document.getElementById('adm-rows-' + tab);
  if (!box) return;
  const q = admBusca[tab].trim().toLowerCase();
  const has = (...vals) => !q || vals.some(v => String(v || '').toLowerCase().includes(q));

  if (tab === 'usuarios') {
    const eu = admData.usuarios.eu, f = admFiltro.usuarios;
    const list = admData.usuarios.usuarios.filter(u =>
      (f === 'todos' || (f === 'admin' && u.papel === 'admin') || (f === 'desativados' && !u.ativo)) && has(u.nome, u.email, u.curso));
    box.innerHTML = `<div class="adm-count">${list.length} ${list.length === 1 ? 'usuário' : 'usuários'}</div>` + (list.length ? `
      <div class="adm-table-wrap"><table class="adm-table">
        <thead><tr><th>Usuário</th><th>Curso</th><th>Papel</th><th>Situação</th><th class="num">Arquivos</th><th>Último acesso</th><th><span class="sr-only">Ações</span></th></tr></thead>
        <tbody>${list.map(u => {
          const self = u.id === eu;
          return `<tr class="${u.ativo ? '' : 'adm-off'}">
            <td><div class="adm-person"><span class="avatar">${admInitial(u.nome)}</span><span class="adm-person-text"><span>${escapeHTML(u.nome)}${self ? ' <span class="tag">você</span>' : ''}</span><small>${escapeHTML(u.email)}</small></span></div></td>
            <td>${escapeHTML(u.curso) || '<span class="adm-muted">—</span>'}</td>
            <td>${u.papel === 'admin' ? '<span class="meta-badge badge-blue">Admin</span>' : '<span class="meta-badge adm-badge-plain">Estudante</span>'}</td>
            <td>${u.ativo ? '<span class="meta-badge badge-green">Ativa</span>' : '<span class="meta-badge badge-red">Desativada</span>'}</td>
            <td class="num">${admNum(u.arquivos)}</td>
            <td title="${admDate(u.ultimo_acesso)}">${admAgo(u.ultimo_acesso)}<br><small class="adm-muted">desde ${admDate(u.criado_em, false)}</small></td>
            <td class="adm-actions">${self ? '<span class="adm-muted">Use o perfil</span>' : `
              <button class="btn-sm" onclick="admSetRole(${u.id},'${u.papel === 'admin' ? 'estudante' : 'admin'}')">${u.papel === 'admin' ? 'Remover admin' : 'Tornar admin'}</button>
              <button class="btn-sm" onclick="admSetActive(${u.id},${!u.ativo})">${u.ativo ? 'Desativar' : 'Reativar'}</button>
              <button class="btn-sm btn-icon" onclick="admResetPassword(${u.id})" aria-label="Redefinir senha de ${escapeHTML(u.nome)}" title="Redefinir senha"><svg class="icon"><use href="#i-key"/></svg></button>
              <button class="btn-sm btn-icon adm-danger" onclick="admDeleteUser(${u.id})" aria-label="Excluir conta de ${escapeHTML(u.nome)}" title="Excluir conta"><svg class="icon"><use href="#i-trash"/></svg></button>`}
            </td></tr>`;
        }).join('')}</tbody></table></div>` : admEmpty('Nenhum usuário encontrado.'));
  }

  if (tab === 'acessos') {
    const f = admFiltro.acessos;
    const grupo = { entradas: ['cadastro', 'login', 'retorno'], falhas: ['falha', 'bloqueada'], logout: ['logout'] };
    const list = admData.acessos.acessos.filter(a => (f === 'todos' || grupo[f].includes(a.tipo)) && has(a.email, a.nome, a.ip));
    box.innerHTML = `<div class="adm-count">${list.length} ${list.length === 1 ? 'registro' : 'registros'} (últimos 300)</div>` + (list.length ? `
      <div class="adm-table-wrap"><table class="adm-table">
        <thead><tr><th>Quando</th><th>Evento</th><th>Usuário</th><th>IP</th><th>Navegador</th></tr></thead>
        <tbody>${list.map(a => {
          const [txt, cls] = ADM_EVENTOS[a.tipo] || [a.tipo, ''];
          return `<tr><td>${admDate(a.criado_em)}</td><td><span class="meta-badge ${cls || 'adm-badge-plain'}">${txt}</span></td>
            <td>${a.nome ? `${escapeHTML(a.nome)}<br><small class="adm-muted">${escapeHTML(a.email || '')}</small>` : `<span class="adm-muted">${escapeHTML(a.email || '—')}</span>`}</td>
            <td><code>${escapeHTML(a.ip || '—')}</code></td><td title="${escapeHTML(a.navegador || '')}">${escapeHTML(admBrowser(a.navegador))}</td></tr>`;
        }).join('')}</tbody></table></div>` : admEmpty('Nenhum acesso registrado com esse filtro.'));
  }

  if (tab === 'conteudos') {
    const f = admFiltro.conteudos;
    const list = admData.conteudos.arquivos.filter(a => (f === 'todos' || a.codigo === f) && has(a.nome, a.dono, a.email));
    box.innerHTML = `<div class="adm-count">${list.length} ${list.length === 1 ? 'arquivo' : 'arquivos'}</div>` + (list.length ? `
      <div class="adm-table-wrap"><table class="adm-table">
        <thead><tr><th>Arquivo</th><th>Tipo</th><th>Dono</th><th class="num">Tamanho</th><th>Atualizado</th><th><span class="sr-only">Ações</span></th></tr></thead>
        <tbody>${list.map(a => `<tr>
          <td><span class="adm-file">${FILE_ICONS[a.codigo] || FILE_ICONS.documento}${escapeHTML(a.nome)}</span></td>
          <td>${ADM_TIPOS[a.codigo] || escapeHTML(a.codigo)}</td>
          <td>${escapeHTML(a.dono)}<br><small class="adm-muted">${escapeHTML(a.email)}</small></td>
          <td class="num">${admSize(a.tamanho_bytes)}</td><td>${admDate(a.atualizado_em)}</td>
          <td class="adm-actions"><button class="btn-sm btn-icon adm-danger" onclick="admDeleteFile(${a.id})" aria-label="Excluir ${escapeHTML(a.nome)}" title="Excluir conteúdo"><svg class="icon"><use href="#i-trash"/></svg></button></td>
        </tr>`).join('')}</tbody></table></div>` : admEmpty('Nenhum conteúdo encontrado.'));
  }
}

function admAuditoriaHTML(d) {
  if (!d.registros.length) return admEmpty('Nenhuma ação administrativa registrada ainda.');
  return `<p class="adm-note">Toda ação feita neste painel fica registrada aqui e não pode ser apagada pela interface.</p>
    <div class="card">${d.registros.map(r => `<div class="activity-item">
      <div class="activity-dot" style="background:var(--${/exclu|desativ/.test(r.acao) ? 'danger' : 'accent'})"></div>
      <div class="activity-text"><strong>${escapeHTML(r.admin_nome)}</strong> · ${ADM_ACOES[r.acao] || escapeHTML(r.acao)}: ${escapeHTML(r.alvo || '')}${r.detalhes ? ` <span class="adm-muted">(${escapeHTML(r.detalhes)})</span>` : ''}</div>
      <div class="activity-time">${admDate(r.criado_em)}</div></div>`).join('')}</div>`;
}

// ---------- ações ----------
function admUser(id) { return admData.usuarios?.usuarios.find(u => u.id === id); }
async function admRun(action, payload, msg) {
  let result;
  await runUI(async () => {
    result = await api(action, payload);
    const keep = admTabAtual;
    admData = {};             // tudo pode ter mudado (contagens, auditoria...)
    await admTab(keep);
    if (msg) showToast(msg);
  });
  return result;
}
async function admSetRole(id, papel) {
  const u = admUser(id); if (!u) return;
  const q = papel === 'admin' ? `Dar acesso de administrador a ${u.nome}? Essa pessoa poderá gerenciar todos os usuários.` : `Remover o acesso de administrador de ${u.nome}?`;
  if (confirm(q)) await admRun('admin_user_update', { id, papel }, 'Papel atualizado.');
}
async function admSetActive(id, ativo) {
  const u = admUser(id); if (!u) return;
  const q = ativo ? `Reativar a conta de ${u.nome}?` : `Desativar a conta de ${u.nome}? A pessoa sai do sistema na hora e não consegue mais entrar. Os dados são mantidos.`;
  if (confirm(q)) await admRun('admin_user_update', { id, ativo }, ativo ? 'Conta reativada.' : 'Conta desativada.');
}
async function admResetPassword(id) {
  const u = admUser(id); if (!u) return;
  if (!confirm(`Gerar uma senha temporária para ${u.nome}? A senha atual deixará de funcionar.`)) return;
  const r = await admRun('admin_user_password', { id });
  if (!r) return;
  document.getElementById('adm-senha-nome').textContent = `${r.nome} (${r.email})`;
  document.getElementById('adm-senha-valor').textContent = r.senha;
  openModal('modal-adm-senha');
}
async function copyTempPassword() {
  try { await navigator.clipboard.writeText(document.getElementById('adm-senha-valor').textContent); showToast('Senha copiada.'); }
  catch { showToast('Não foi possível copiar. Selecione a senha e copie manualmente.'); }
}
async function admDeleteUser(id) {
  const u = admUser(id); if (!u) return;
  const typed = prompt(`Excluir a conta de ${u.nome} e TODOS os dados dela (${u.arquivos} arquivo(s), metas, eventos)? Isso não pode ser desfeito.\n\nPara confirmar, digite o e-mail: ${u.email}`);
  if (typed === null) return;
  if (typed.trim().toLowerCase() !== u.email.toLowerCase()) { showToast('E-mail não confere. Nada foi excluído.'); return; }
  await admRun('admin_user_delete', { id, confirmacao: typed.trim() }, 'Conta excluída.');
}
async function admDeleteFile(id) {
  const a = admData.conteudos?.arquivos.find(x => Number(x.id) === id); if (!a) return;
  if (!confirm(`Excluir "${a.nome}" de ${a.dono}? Isso não pode ser desfeito.`)) return;
  await admRun('admin_file_delete', { id }, 'Conteúdo excluído.');
  // Se o arquivo era do próprio administrador, atualiza as telas dele também.
  try { applyState(await api('state')); renderAll(); } catch {}
}
