// Integra as telas originais ao banco, mantendo os nomes usados pelos onclicks.
function filterMetas(f,btn) { metaFilter=f; document.querySelectorAll('#page-metas .page-filters .mm-btn').forEach(b=>{const on=b===btn; b.classList.toggle('active',on); b.setAttribute('aria-pressed',String(on));}); renderMetas(f); };
async function addMeta() { await runUI(async()=>{
  await mutate('meta_add',{nome:field('meta-nome'),disciplina:field('meta-disciplina'),prazo:field('meta-prazo'),prioridade:field('meta-prioridade')});
  closeModal('modal-meta'); ['meta-nome','meta-disciplina','meta-prazo'].forEach(id=>document.getElementById(id).value=''); showToast('Meta salva.');
}); };
async function toggleMeta(id) { metaJustToggled=id; await runUI(()=>mutate('meta_toggle',{id})); }
async function delMeta(id) { await runUI(()=>mutate('meta_delete',{id})); }
async function addEvento() { await runUI(async()=>{
  await mutate('event_add',{titulo:field('ev-titulo'),data:field('ev-data'),hora:field('ev-hora'),tipo:field('ev-tipo')});
  closeModal('modal-evento'); ['ev-titulo','ev-data','ev-hora'].forEach(id=>document.getElementById(id).value=''); showToast('Evento salvo.');
}); };
async function delEvento(id) { if (confirm('Excluir este evento?')) await runUI(()=>mutate('event_delete',{id})); }
const FILE_ICONS={mapa:'<svg class="icon"><use href="#i-network"/></svg>',planilha:'<svg class="icon"><use href="#i-table"/></svg>',documento:'<svg class="icon"><use href="#i-text"/></svg>',flashcards:'<svg class="icon"><use href="#i-cards"/></svg>'};
function renderArquivos() {
  renderFolders(); // pastas clicáveis: arquivos.js
  document.getElementById('files-grid').innerHTML=arquivos.length?arquivos.slice(0,8).map(f=>`<div class="file-card"><div class="file-icon-big">${FILE_ICONS[f.codigo]||FILE_ICONS.documento}</div><div class="file-name">${escapeHTML(f.nome)}</div><div class="file-meta">${escapeHTML(f.tamanho)} · ${escapeHTML(f.data)}</div><div class="flex gap-8" style="margin-top:12px;flex-wrap:wrap">${f.codigo==='flashcards'?`<button class="btn-add" onclick="startStudy(${f.id})">Estudar</button>`:''}<button class="btn-sm" onclick="openFile(${f.id})">${f.codigo==='flashcards'?'Editar':'Abrir'}</button><button class="btn-sm" onclick="deleteFile(${f.id})">Excluir</button></div></div>`).join(''):'<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon"><svg class="icon"><use href="#i-folder"/></svg></div><div>Nenhum arquivo salvo ainda.</div></div>';
  renderDashboard();
};
async function deleteFile(id){ if(confirm('Excluir este arquivo e seu conteúdo?')) await runUI(()=>mutate('file_delete',{id})); }
const originalOpenTool=openTool;
openTool=function(tipo){
  editingFileId=null; plData={}; plRows=5; plCols=5; fcCards=[];
  originalOpenTool(tipo);
};
function captureCells(){
  document.querySelectorAll('#pl-table input').forEach(input=>plData[input.dataset.cell]=input.value);
}
renderPlanilha=function(){
  const t=document.getElementById('pl-table');if(!t)return;
  let h='<tr><th></th>'+Array.from({length:plCols},(_,c)=>`<th>${'ABCDEFGH'[c]}</th>`).join('')+'</tr>';
  for(let r=1;r<=plRows;r++){
    h+=`<tr><th>${r}</th>`;
    for(let c=1;c<=plCols;c++){const key=r+','+c;h+=`<td><input data-cell="${key}" value="${escapeHTML(plData[key]||'')}" oninput="plData[this.dataset.cell]=this.value" style="min-width:60px;width:100%"></td>`;}
    h+='</tr>';
  }
  t.innerHTML=h;
};
plAddRow=function(){captureCells();if(plRows<500){plRows++;renderPlanilha();}else showToast('Limite de 500 linhas.');};
plAddCol=function(){captureCells();if(plCols<8){plCols++;renderPlanilha();}};
async function saveTool(tipo){await runUI(async()=>{
  let titulo='',content={};
  if(tipo==='documento'){titulo=field('doc-title')||'Documento';content={conteudo:field('doc-body')};}
  if(tipo==='flashcards'){titulo=field('fc-title')||'Flashcards';content={cards:fcSerialize()};}
  if(tipo==='mapa'){titulo=field('mm-title')||'Mapa Mental';content={nodes:MM.serialize()};}
  if(tipo==='planilha'){
    captureCells();titulo=field('pl-title')||'Planilha';content={rows:plRows,cols:plCols,cells:Object.entries(plData).filter(([,v])=>v!=='').map(([k,valor])=>{const[linha,coluna]=k.split(',').map(Number);return{linha,coluna,valor};})};
  }
  await mutate('file_save',{id:editingFileId,tipo,titulo,content});closeModal('modal-tool');editingFileId=null;showToast('Conteúdo salvo no banco.');
});};
async function openFile(id){await runUI(async()=>{
  const{file,content}=await api('file_get',null,{id});
  openTool(file.codigo);editingFileId=Number(file.id);
  const title=file.nome.replace(/\.[^.]+$/,'');
  if(file.codigo==='documento'){document.getElementById('doc-title').value=title;document.getElementById('doc-body').value=content.conteudo;}
  if(file.codigo==='flashcards'){document.getElementById('fc-title').value=title;fcInit(content.cards);}
  if(file.codigo==='planilha'){
    document.getElementById('pl-title').value=title;plRows=Number(content.rows);plCols=Number(content.cols);plData={};content.cells.forEach(c=>plData[c.linha+','+c.coluna]=c.valor);renderPlanilha();
  }
  if(file.codigo==='mapa'){
    document.getElementById('mm-title').value=title;
    MM.init(content.nodes);
  }
});}
