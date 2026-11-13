// ============================================================
// arquivos.js — Pastas da página "Arquivos": cada pasta abre um
// painel com os arquivos daquele tipo (busca, ordenação e ações).
// A grade de "Arquivos Recentes" é desenhada em integration.js.
// ============================================================

const FOLDER_INFO = {
  mapa:       { nome: 'Mapas Mentais', novo: 'Novo mapa mental', vazio: 'Nenhum mapa mental salvo ainda.' },
  documento:  { nome: 'Documentos',    novo: 'Novo documento',    vazio: 'Nenhum documento salvo ainda.' },
  planilha:   { nome: 'Planilhas',     novo: 'Nova planilha',     vazio: 'Nenhuma planilha salva ainda.' },
  flashcards: { nome: 'Flashcards',    novo: 'Novo baralho',      vazio: 'Nenhum baralho de flashcards salvo ainda.' },
};
let openFolderKey = null;
const folderQuery = {};   // texto da busca de cada pasta
const folderSort = {};    // 'recentes' | 'nome' | 'tamanho'

function toggleFolder(key) {
  openFolderKey = openFolderKey === key ? null : key;
  renderFolders();
  if (openFolderKey) document.querySelector(`#fv-${key} .fv-search`)?.focus({ preventScroll: true });
}

function folderFiles(key) {
  const q = (folderQuery[key] || '').trim().toLowerCase();
  const list = arquivos.filter(f => f.codigo === key && (!q || f.nome.toLowerCase().includes(q)));
  const sort = folderSort[key] || 'recentes';
  if (sort === 'nome') list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  if (sort === 'tamanho') list.sort((a, b) => Number(b.tamanho_bytes) - Number(a.tamanho_bytes));
  return list; // 'recentes' já vem ordenado pela API
}

function folderItemHTML(f) {
  const cards = f.codigo === 'flashcards' ? revisoes.find(r => r.id === f.id) : null;
  const extra = cards ? ` · ${cards.total} ${cards.total === 1 ? 'cartão' : 'cartões'}${cards.pendentes ? ` · <strong>${cards.pendentes} para revisar</strong>` : ''}` : '';
  return `<li class="fv-item">
    <button type="button" class="fv-open" onclick="openFile(${f.id})" title="Abrir ${escapeHTML(f.nome)}">
      <span class="fv-icon">${FILE_ICONS[f.codigo] || FILE_ICONS.documento}</span>
      <span class="fv-text"><span class="fv-name">${escapeHTML(f.nome)}</span><span class="fv-meta">${escapeHTML(f.tamanho)} · atualizado em ${escapeHTML(f.data)}${extra}</span></span>
    </button>
    <div class="fv-actions">
      ${f.codigo === 'flashcards' ? `<button class="btn-add" onclick="startStudy(${f.id})"><svg class="icon"><use href="#i-play"/></svg>Estudar</button>` : ''}
      <button class="btn-sm" onclick="openFile(${f.id})">${f.codigo === 'flashcards' ? 'Editar' : 'Abrir'}</button>
      <button class="btn-sm btn-icon" onclick="deleteFile(${f.id})" aria-label="Excluir ${escapeHTML(f.nome)}" title="Excluir"><svg class="icon"><use href="#i-trash"/></svg></button>
    </div>
  </li>`;
}

function renderFolderList(key) {
  const box = document.getElementById('fv-list-' + key);
  if (!box) return;
  const total = arquivos.filter(f => f.codigo === key).length;
  const list = folderFiles(key);
  if (!total) {
    box.innerHTML = `<div class="fv-empty">${FOLDER_INFO[key].vazio}<button class="btn-sm" onclick="openTool('${key}')"><svg class="icon"><use href="#i-plus"/></svg>${FOLDER_INFO[key].novo}</button></div>`;
  } else if (!list.length) {
    box.innerHTML = `<div class="fv-empty">Nada encontrado para “${escapeHTML(folderQuery[key])}”.</div>`;
  } else {
    box.innerHTML = `<ul class="fv-items">${list.map(folderItemHTML).join('')}</ul>`;
  }
}

function renderFolders() {
  Object.keys(FOLDER_INFO).forEach(key => {
    const count = arquivos.filter(f => f.codigo === key).length;
    document.getElementById('folder-' + key).textContent = count + (count === 1 ? ' item' : ' itens');
    const row = document.querySelector(`.folder-row[data-folder="${key}"]`);
    const panel = document.getElementById('fv-' + key);
    const open = openFolderKey === key;
    row.classList.toggle('open', open);
    row.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    if (!open) { panel.innerHTML = ''; return; }
    // Mantém a busca digitada ao redesenhar (por exemplo, depois de salvar ou excluir).
    if (!panel.firstChild) {
      const sort = folderSort[key] || 'recentes';
      panel.innerHTML = `
        <div class="fv-toolbar">
          <label class="sr-only" for="fv-q-${key}">Buscar em ${FOLDER_INFO[key].nome}</label>
          <input id="fv-q-${key}" class="search-input fv-search" type="search" placeholder="Buscar em ${FOLDER_INFO[key].nome.toLowerCase()}…" value="${escapeHTML(folderQuery[key] || '')}" oninput="folderQuery['${key}']=this.value;renderFolderList('${key}')">
          <label class="sr-only" for="fv-s-${key}">Ordenar</label>
          <select id="fv-s-${key}" class="fv-sort" onchange="folderSort['${key}']=this.value;renderFolderList('${key}')">
            <option value="recentes"${sort === 'recentes' ? ' selected' : ''}>Mais recentes</option>
            <option value="nome"${sort === 'nome' ? ' selected' : ''}>Nome (A–Z)</option>
            <option value="tamanho"${sort === 'tamanho' ? ' selected' : ''}>Maior tamanho</option>
          </select>
          <button class="btn-add" onclick="openTool('${key}')"><svg class="icon"><use href="#i-plus"/></svg>${FOLDER_INFO[key].novo}</button>
        </div>
        <div id="fv-list-${key}" aria-live="polite"></div>`;
    }
    renderFolderList(key);
  });
}
