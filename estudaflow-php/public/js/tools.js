// ============================================================
// tools.js — Painel "Criar Conteúdo": abrir ferramenta, montar
// o corpo do modal e salvar o resultado em Arquivos
// ============================================================

function openTool(tipo) {
  const titles = { mapa: '🗺️ Mapa Mental', planilha: '📊 Planilha', documento: '📝 Documento', apresentacao: '🖼️ Apresentação' };
  document.getElementById('tool-modal-title').textContent = titles[tipo];
  document.getElementById('tool-modal-body').innerHTML = buildTool(tipo);
  openModal('modal-tool');
  if (tipo === 'mapa') initMindmap();
  if (tipo === 'planilha') initPlanilha();
}

function buildTool(tipo) {
  if (tipo === 'mapa') return `
    <div class="form-group"><label>Título do Mapa</label><input type="text" id="mm-title" placeholder="Ex: Redes de Computadores" /></div>
    <div class="mm-toolbar">
      <button class="mm-btn active" id="btn-add-node" onclick="mmMode('add')">+ Nó</button>
      <button class="mm-btn" id="btn-move-node" onclick="mmMode('move')">✥ Mover</button>
      <button class="mm-btn" id="btn-del-node" onclick="mmMode('del')">🗑 Deletar</button>
      <button class="mm-btn" onclick="mmClear()">Limpar</button>
      <button class="mm-btn" onclick="saveTool('mapa')">💾 Salvar</button>
    </div>
    <canvas id="mindmap-canvas"></canvas>
    <div style="font-size:.75rem;color:var(--text3);margin-top:8px">Clique no canvas para adicionar nós. Clique em um nó para selecioná-lo e conectar ao próximo.</div>`;

  if (tipo === 'planilha') return `
    <div class="form-group"><label>Título da Planilha</label><input type="text" id="pl-title" placeholder="Ex: Controle de Notas" /></div>
    <div style="overflow-x:auto;margin-bottom:12px"><table id="pl-table" style="width:100%;border-collapse:collapse;font-size:.82rem"></table></div>
    <div class="flex gap-8">
      <button class="btn-sm" onclick="plAddRow()">+ Linha</button>
      <button class="btn-sm" onclick="plAddCol()">+ Coluna</button>
      <button class="btn-add" onclick="saveTool('planilha')">💾 Salvar</button>
    </div>`;

  if (tipo === 'documento') return `
    <div class="form-group"><label>Título</label><input type="text" id="doc-title" placeholder="Ex: Relatório de Algoritmos" /></div>
    <div class="form-group"><label>Conteúdo</label><textarea id="doc-body" rows="10" placeholder="Comece a escrever seu documento aqui...

Dicas:
• Use # para títulos
• Use - para listas
• Use **texto** para negrito"></textarea></div>
    <button class="btn-add" onclick="saveTool('documento')">💾 Salvar Documento</button>`;

  if (tipo === 'apresentacao') return `
    <div class="form-group"><label>Título da Apresentação</label><input type="text" id="ap-title" placeholder="Ex: Sistemas Operacionais" /></div>
    <div id="slides-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px"></div>
    <div class="flex gap-8">
      <button class="btn-sm" onclick="apAddSlide()">+ Slide</button>
      <button class="btn-add" onclick="saveTool('apresentacao')">💾 Salvar</button>
    </div>`;
}

// saveTool() em integration.js envia o conteúdo completo para a API PHP.
