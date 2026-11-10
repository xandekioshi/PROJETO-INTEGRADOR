// Integra as telas originais ao banco, mantendo os nomes usados pelos onclicks.
const originalRenderDashboard = renderDashboard;
renderDashboard = function () {
  originalRenderDashboard();
  if (!dashboardResumo) return;
  const r=dashboardResumo;
  document.getElementById('dash-docs').textContent=r.documentos_criados;
  document.getElementById('dash-metas').textContent=r.metas_concluidas+'/'+r.metas_total;
  document.getElementById('dash-eventos').textContent=r.eventos_semana;
  document.getElementById('dash-livros').textContent=r.livros_biblioteca;
  if (dashboardProgresso.length) document.getElementById('dash-progress').innerHTML=dashboardProgresso.map(p=>`<div style="margin-bottom:14px"><div class="flex-center" style="justify-content:space-between;margin-bottom:6px"><span>${escapeHTML(p.disciplina)}</span><span>${Number(p.percentual)}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${Number(p.percentual)}%;background:var(--accent)"></div></div></div>`).join('');
};
function filterMetas(f,btn) { metaFilter=f; document.querySelectorAll('#page-metas .mm-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderMetas(f); };
async function addMeta() { await runUI(async()=>{
  await mutate('meta_add',{nome:field('meta-nome'),disciplina:field('meta-disciplina'),prazo:field('meta-prazo'),prioridade:field('meta-prioridade')});
  closeModal('modal-meta'); ['meta-nome','meta-disciplina','meta-prazo'].forEach(id=>document.getElementById(id).value=''); showToast('Meta salva.');
}); };
async function toggleMeta(id) { await runUI(()=>mutate('meta_toggle',{id})); }
async function delMeta(id) { await runUI(()=>mutate('meta_delete',{id})); }
async function addEvento() { await runUI(async()=>{
  await mutate('event_add',{titulo:field('ev-titulo'),data:field('ev-data'),hora:field('ev-hora'),tipo:field('ev-tipo')});
  closeModal('modal-evento'); ['ev-titulo','ev-data','ev-hora'].forEach(id=>document.getElementById(id).value=''); showToast('Evento salvo.');
}); };
async function delEvento(id) { if (confirm('Excluir este evento?')) await runUI(()=>mutate('event_delete',{id})); }
const originalCronograma=renderCronograma;
renderCronograma=function(){
  originalCronograma();
  const chips=document.querySelectorAll('#week-grid .event-chip');
  const today=new Date(), monday=new Date(today); monday.setDate(today.getDate()-((today.getDay()+6)%7)+currentWeekOffset*7);
  let index=0;
  for(let day=0;day<7;day++){
    const d=new Date(monday);d.setDate(monday.getDate()+day);
    eventos.filter(e=>e.data===toISODate(d)).forEach(e=>{
      const chip=chips[index++]; if(chip){ chip.title=e.hora+' — clique para excluir'; chip.style.cursor='pointer'; chip.onclick=()=>delEvento(e.id); }
    });
  }
};
function renderArquivos() {
  const map={mapa:'Mapas Mentais',documento:'Documentos',planilha:'Planilhas',apresentacao:'Apresentações'};
  Object.entries(map).forEach(([k,nome])=>{
    const p=pastas.find(p=>p.nome===nome), count=Number(p?.qtd_itens||0);
    document.getElementById('folder-'+k).textContent=count+(count===1?' item':' itens');
  });
  document.getElementById('files-grid').innerHTML=arquivos.length?arquivos.map(f=>`<div class="file-card"><div class="file-icon-big">${escapeHTML(f.tipo)}</div><div class="file-name">${escapeHTML(f.nome)}</div><div class="file-meta">${escapeHTML(f.tamanho)} · ${escapeHTML(f.data)}</div><div class="flex gap-8" style="margin-top:12px"><button class="btn-sm" onclick="openFile(${f.id})">Abrir</button><button class="btn-sm" onclick="deleteFile(${f.id})">Excluir</button></div></div>`).join(''):'<div class="empty-state" style="grid-column:1/-1">Nenhum arquivo salvo ainda.</div>';
  renderDashboard();
};
async function deleteFile(id){ if(confirm('Excluir este arquivo e seu conteúdo?')) await runUI(()=>mutate('file_delete',{id})); }
function renderBiblioteca() {
  const q=field('bib-search').trim().toLowerCase();
  const filtered=books.filter(b=>(bibFilter==='todos'||(bibFilter==='lista'?b.na_lista:b.area===bibFilter))&&[b.titulo,b.autor,...b.tags].some(v=>v.toLowerCase().includes(q)));
  document.getElementById('books-list').innerHTML=filtered.length?filtered.map(b=>`<div class="book-card"><div class="book-cover" style="background:var(--surface2)">${escapeHTML(b.icon)}</div><div class="book-info"><div class="book-title">${escapeHTML(b.titulo)}</div><div class="book-author">${escapeHTML(b.autor)}</div><div class="book-tags">${b.tags.map(t=>`<span class="tag">${escapeHTML(t)}</span>`).join('')}</div></div><button class="btn-sm" onclick="toggleReading(${b.id})">${b.na_lista?'Remover da lista':'+ Lista'}</button></div>`).join(''):'<div class="empty-state">Nenhum livro encontrado. Cadastre um material para começar.</div>';
  renderDashboard();
};
function filterBib(f,btn){ bibFilter=f; document.querySelectorAll('#page-biblioteca .mm-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderBiblioteca(); };
function buscarLivros(){ renderBiblioteca(); }
async function toggleReading(id){ await runUI(()=>mutate('reading_toggle',{id})); }
async function addBook(){await runUI(async()=>{
  await mutate('book_add',{titulo:field('livro-titulo'),autor:field('livro-autor'),area:field('livro-area'),tags:field('livro-tags')});
  closeModal('modal-livro'); ['livro-titulo','livro-autor','livro-tags'].forEach(id=>document.getElementById(id).value=''); showToast('Livro cadastrado no catálogo.');
});}
const originalOpenTool=openTool;
openTool=function(tipo){
  editingFileId=null; plData={}; plRows=5; plCols=5; slides=[]; mindmapNodes=[]; selectedNode=null;
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
  if(tipo==='apresentacao'){
    // Captura inclusive o campo ainda focado, antes de seu evento change.
    document.querySelectorAll('#slides-list > div').forEach((row,i)=>{slides[i].titulo=row.querySelector('input').value;slides[i].corpo=row.querySelector('textarea').value;});
    titulo=field('ap-title')||'Apresentação';content={slides};
  }
  if(tipo==='mapa'){titulo=field('mm-title')||'Mapa Mental';content={nodes:mindmapNodes};}
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
  if(file.codigo==='apresentacao'){document.getElementById('ap-title').value=title;slides=content.slides;renderSlides();}
  if(file.codigo==='planilha'){
    document.getElementById('pl-title').value=title;plRows=Number(content.rows);plCols=Number(content.cols);plData={};content.cells.forEach(c=>plData[c.linha+','+c.coluna]=c.valor);renderPlanilha();
  }
  if(file.codigo==='mapa'){
    document.getElementById('mm-title').value=title;
    mindmapNodes=content.nodes.map(n=>({...n,id:Number(n.id),parent:n.parent===null?null:Number(n.parent),x:Number(n.x),y:Number(n.y)}));
    setTimeout(drawMM,120);
  }
});}
// Ao excluir um nó, remove também os descendentes, como a FK do SQL.
const originalMMClick=mmClick;
mmClick=function(e){
  if(mmMode_state==='del'){
    const rect=document.getElementById('mindmap-canvas').getBoundingClientRect();
    const hit=mindmapNodes.find(n=>Math.hypot(n.x-(e.clientX-rect.left),n.y-(e.clientY-rect.top))<36);
    if(hit){const ids=new Set([hit.id]);let count;do{count=ids.size;mindmapNodes.forEach(n=>{if(ids.has(n.parent))ids.add(n.id);});}while(ids.size!==count);mindmapNodes=mindmapNodes.filter(n=>!ids.has(n.id));selectedNode=null;drawMM();}return;
  }
  originalMMClick(e);
};
// Preserva os nós ao reabrir; o modo Mover desloca o nó selecionado no próximo clique vazio.
initMindmap=function(){
  selectedNode=null;mmMode_state='add';
  setTimeout(()=>{const canvas=document.getElementById('mindmap-canvas');if(!canvas)return;canvas.width=canvas.offsetWidth;canvas.height=canvas.offsetHeight||420;canvas.onclick=e=>{
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    if(mmMode_state==='move'&&selectedNode&&!mindmapNodes.some(n=>Math.hypot(n.x-x,n.y-y)<36)){selectedNode.x=x;selectedNode.y=y;drawMM();return;}
    mmClick(e);
  };drawMM();},100);
};
