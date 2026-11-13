// ============================================================
// tools.js — Painel "Criar Conteúdo": abrir ferramenta, montar
// o corpo do modal e salvar o resultado em Arquivos
// ============================================================

function openTool(tipo) {
  const titles = { mapa: 'Mapa mental', planilha: 'Planilha', documento: 'Documento', flashcards: 'Flashcards' };
  document.getElementById('tool-modal-title').textContent = titles[tipo];
  document.getElementById('tool-modal-body').innerHTML = buildTool(tipo);
  // O mapa mental usa uma janela maior.
  document.querySelector('#modal-tool .modal').style.width = tipo === 'mapa' ? 'min(1180px, 96vw)' : tipo === 'flashcards' ? '780px' : '700px';
  openModal('modal-tool');
  if (tipo === 'mapa') initMindmap();
  if (tipo === 'planilha') initPlanilha();
  if (tipo === 'flashcards') fcInit([]);
}

function buildTool(tipo) {
  if (tipo === 'mapa') return `
    <div class="mm-titlebar">
      <div class="form-group"><label for="mm-title">Título do mapa</label><input type="text" id="mm-title" maxlength="180" placeholder="Ex: Redes de Computadores" /></div>
      <button class="btn-add" onclick="saveTool('mapa')"><svg class="icon"><use href="#i-save"/></svg>Salvar mapa</button>
    </div>
    ${MM.markup()}`;

  if (tipo === 'flashcards') return `
    <div class="form-group"><label for="fc-title">Nome do baralho</label><input type="text" id="fc-title" maxlength="180" placeholder="Ex: Anatomia: sistema nervoso" /></div>
    <div class="fc-head"><span class="section-title" style="margin:0">Cartões</span><span class="fc-count" id="fc-count"></span></div>
    <div id="fc-list" class="fc-list"></div>
    <div class="flex gap-8" style="flex-wrap:wrap;margin-top:12px">
      <button class="btn-sm" onclick="fcAdd()"><svg class="icon"><use href="#i-plus"/></svg>Cartão</button>
    </div>
    <details class="fc-import">
      <summary>Importar vários cartões de uma vez</summary>
      <label class="sr-only" for="fc-bulk">Cartões para importar</label>
      <textarea id="fc-bulk" rows="5" placeholder="Uma linha por cartão. Separe frente e verso com ; ou Tab (colado do Excel/Planilhas)&#10;Ex.: Capital da França ; Paris&#10;Fórmula da água ; H₂O"></textarea>
      <button class="btn-sm" style="margin-top:8px" onclick="fcImport()">Adicionar à lista</button>
    </details>
    <p class="fc-help">Dica: <kbd>Ctrl</kbd> + <kbd>Enter</kbd> no verso cria o próximo cartão. Ao estudar, cada acerto aumenta o intervalo até a próxima revisão (1, 3, 7, 14 e 30 dias).</p>
    <div class="flex gap-8 mt-16" style="justify-content:flex-end"><button class="btn-add" onclick="saveTool('flashcards')"><svg class="icon"><use href="#i-save"/></svg>Salvar baralho</button></div>`;

  if (tipo === 'planilha') return `
    <div class="form-group"><label>Título da Planilha</label><input type="text" id="pl-title" placeholder="Ex: Controle de Notas" /></div>
    <div style="overflow-x:auto;margin-bottom:12px"><table id="pl-table" style="width:100%;border-collapse:collapse;font-size:.82rem"></table></div>
    <div class="flex gap-8">
      <button class="btn-sm" onclick="plAddRow()"><svg class="icon"><use href="#i-plus"/></svg>Linha</button>
      <button class="btn-sm" onclick="plAddCol()"><svg class="icon"><use href="#i-plus"/></svg>Coluna</button>
      <button class="btn-add" onclick="saveTool('planilha')"><svg class="icon"><use href="#i-save"/></svg>Salvar</button>
    </div>`;

  if (tipo === 'documento') return `
    <div class="form-group"><label>Título</label><input type="text" id="doc-title" placeholder="Ex: Relatório de Algoritmos" /></div>
    <div class="form-group"><label>Conteúdo</label><textarea id="doc-body" rows="10" placeholder="Comece a escrever seu documento aqui...

Dicas:
• Use # para títulos
• Use - para listas
• Use **texto** para negrito"></textarea></div>
    <button class="btn-add" onclick="saveTool('documento')"><svg class="icon"><use href="#i-save"/></svg>Salvar documento</button>`;
}

// saveTool() em integration.js envia o conteúdo completo para a API PHP.
