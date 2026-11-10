function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (tab==='login'&&i===0)||(tab==='register'&&i===1)));
  document.getElementById('login-form').style.display=tab==='login'?'block':'none';
  document.getElementById('register-form').style.display=tab==='register'?'block':'none';
}
async function doLogin() {
  await runUI(async () => { applyState(await api('login',{email:field('login-email').trim(),senha:field('login-pass')})); launchApp(currentUser); document.getElementById('login-pass').value=''; });
}
async function doRegister() {
  await runUI(async () => { applyState(await api('register',{nome:field('reg-name').trim(),email:field('reg-email').trim(),curso:field('reg-curso').trim(),senha:field('reg-pass')})); launchApp(currentUser); document.getElementById('reg-pass').value=''; });
}
function launchApp(user) {
  currentUser=user;
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='block';
  const first=user.nome.split(' ')[0];
  document.getElementById('sidebar-name').textContent=first;
  document.getElementById('sidebar-avatar').textContent=first[0].toUpperCase();
  document.getElementById('dash-name').textContent=first;
  renderAll();
}
function showAuth() {
  currentUser=null; metas=[]; eventos=[]; arquivos=[]; books=[]; atividades=[]; pastas=[]; dashboardResumo=null; dashboardProgresso=[];
  currentWeekOffset=0; editingFileId=null; mindmapNodes=[]; slides=[]; plData={};
  document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('open'));
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('app').style.display='none';
  goPage('dashboard'); renderAll();
}
async function doLogout() {
  await runUI(async () => { const result=await api('logout',{}); csrfToken=result.csrf; showAuth(); });
}
