// Único ponto de comunicação com PHP. Cookies mantêm a sessão; o token protege POSTs.
let csrfToken = '';
let uiBusy = false;
let pastas = [], dashboardResumo = null, dashboardProgresso = [];
let editingFileId = null, plData = {}, bibFilter = 'todos', metaFilter = 'todas';
const field = id => document.getElementById(id).value;
async function api(action, payload = null, params = {}) {
  const qs = new URLSearchParams({action, ...params});
  const response = await fetch('api.php?' + qs, {
    method: payload === null ? 'GET' : 'POST', credentials: 'same-origin',
    headers: payload === null ? {} : {'Content-Type':'application/json', 'X-CSRF-Token':csrfToken},
    body: payload === null ? undefined : JSON.stringify(payload)
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('Resposta inválida do servidor. Inicie pelo PHP e consulte o terminal.'); }
  if (!response.ok) {
    if (response.status === 401 && currentUser) showAuth();
    throw new Error(data.error || 'Não foi possível completar a operação.');
  }
  if (data.csrf) csrfToken = data.csrf;
  return data;
}
async function runUI(fn) {
  if (uiBusy) return;
  uiBusy = true;
  const disabled = [...document.querySelectorAll('button:not(:disabled)')];
  disabled.forEach(b=>b.disabled=true);
  try { await fn(); } catch (e) { showToast(e.message || 'Falha de comunicação.'); }
  finally { uiBusy=false; disabled.forEach(b=>b.disabled=false); }
}
function applyState(s) {
  currentUser=s.user; metas=s.metas; eventos=s.eventos; arquivos=s.arquivos;
  books=s.books; pastas=s.pastas; revisoes=s.revisoes||[]; dashboardResumo=s.resumo; dashboardProgresso=s.progresso;
  atividades=s.atividades.map(a=>({...a,ts:Number(a.ts),cor:'var(--'+a.cor+')'}));
  arquivos=arquivos.map(f=>({...f,id:Number(f.id),tamanho:(Number(f.tamanho_bytes)/1024).toFixed(1)+' KB',data:new Date(f.atualizado_em).toLocaleDateString('pt-BR')}));
  eventos=eventos.map(e=>({...e,id:Number(e.id)}));
}
function renderAll() {
  renderMetas(metaFilter); renderCronograma(); renderArquivos(); renderBiblioteca(); renderDashboard();
}
async function mutate(action, data) { applyState(await api(action,data)); renderAll(); }
