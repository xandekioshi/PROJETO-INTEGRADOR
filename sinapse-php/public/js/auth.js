const AUTH_TEXT = {
  login: ['Bem-vindo de volta', 'Entre para continuar de onde parou.'],
  register: ['Crie sua conta', 'Organize metas, cronograma e materiais em um só lugar.'],
};
function switchAuthTab(tab) {
  const card=document.getElementById('auth-panel');
  card.classList.remove('is-forgot');
  document.getElementById('forgot-form').style.display='none';
  document.querySelectorAll('.auth-tab').forEach((t,i) => {
    const on=(tab==='login'&&i===0)||(tab==='register'&&i===1);
    t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); t.tabIndex=on?0:-1;
  });
  document.querySelector('.auth-tabs').classList.toggle('is-register', tab==='register');
  document.getElementById('login-form').style.display=tab==='login'?'block':'none';
  document.getElementById('register-form').style.display=tab==='register'?'block':'none';
  document.getElementById('auth-heading').textContent=AUTH_TEXT[tab][0];
  document.getElementById('auth-sub').textContent=AUTH_TEXT[tab][1];
  resetPasswordFields();
}
// Mostrar/ocultar senha
function togglePassword(id, btn, keepFocus) {
  const input=document.getElementById(id), show=input.type==='password';
  input.type=show?'text':'password';
  btn.setAttribute('aria-pressed', String(show));
  btn.setAttribute('aria-label', show?'Ocultar senha':'Mostrar senha');
  btn.querySelector('use').setAttribute('href', show?'#i-eye-off':'#i-eye');
  if (!keepFocus) input.focus();
}
function resetPasswordFields() {
  document.querySelectorAll('.pw-toggle[aria-pressed="true"]').forEach(b=>togglePassword(b.getAttribute('aria-controls'), b, true));
}
// Recuperação de senha (somente interface por enquanto; ainda não envia e-mail)
function showForgot() {
  document.getElementById('auth-panel').classList.add('is-forgot');
  document.getElementById('login-form').style.display='none';
  document.getElementById('register-form').style.display='none';
  document.getElementById('forgot-form').style.display='block';
  document.getElementById('auth-heading').textContent='Recuperar senha';
  document.getElementById('auth-sub').textContent='Informe o e-mail da sua conta e enviaremos as instruções para criar uma nova senha.';
  const email=document.getElementById('forgot-email');
  email.value=document.getElementById('login-email').value;
  email.focus();
}
function sendRecovery() {
  showToast('A recuperação de senha estará disponível em breve.');
}
async function doLogin() {
  await runUI(async () => { applyState(await api('login',{email:field('login-email').trim(),senha:field('login-pass')})); launchApp(currentUser); document.getElementById('login-pass').value=''; });
}
async function doRegister() {
  await runUI(async () => { applyState(await api('register',{nome:field('reg-name').trim(),email:field('reg-email').trim(),curso:field('reg-curso').trim(),senha:field('reg-pass')})); launchApp(currentUser); document.getElementById('reg-pass').value=''; });
}
function launchApp(user) {
  currentUser=user;
  closeAuth(); resetPasswordFields();
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='block';
  scrollTo(0,0);
  updateUserUI();
  renderAll();
  goPage('dashboard');
}
function showAuth() {
  currentUser=null; metas=[]; eventos=[]; arquivos=[]; books=[]; atividades=[]; pastas=[]; dashboardResumo=null; dashboardProgresso=[];
  currentWeekOffset=0; editingFileId=null; fcCards=[]; revisoes=[]; plData={};
  document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('open'));
  document.getElementById('auth-screen').style.display='block';
  document.getElementById('app').style.display='none';
  scrollTo(0,0);
  goPage('dashboard'); renderAll();
  playHero();
}
async function doLogout() {
  await runUI(async () => { const result=await api('logout',{}); csrfToken=result.csrf; showAuth(); });
}
// A inicialização (sessão + introdução) fica em main.js.
