// ============================================================
// profile.js — Tela "Meu perfil": foto, nome e curso, senha,
// preferências, estatísticas, exportação e exclusão da conta.
// ============================================================

// Avatar: foto (se houver) ou a inicial do nome.
function renderAvatar(el, user) {
  if (!el || !user) return;
  if (user.foto) el.innerHTML = `<img src="${user.foto}" alt="">`;
  else el.textContent = (user.nome || '?').trim().charAt(0).toUpperCase();
}
// Atualiza nome/foto em todos os lugares da interface.
function updateUserUI() {
  const u = currentUser; if (!u) return;
  const first = u.nome.split(' ')[0];
  document.getElementById('sidebar-name').textContent = first;
  document.getElementById('dash-name').textContent = first;
  renderAvatar(document.getElementById('sidebar-avatar'), u);
  renderAvatar(document.getElementById('pf-avatar'), u);
  document.getElementById('pf-name').textContent = u.nome;
  document.getElementById('pf-meta').textContent = [u.email, u.curso].filter(Boolean).join(' · ');
  const since = u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '';
  document.getElementById('pf-since').textContent = since ? 'Membro desde ' + since : '';
  document.getElementById('pf-remove').hidden = !u.foto;
}

// ---------- abrir / abas ----------
function openProfile() {
  if (!currentUser) return;
  document.getElementById('pf-nome').value = currentUser.nome;
  document.getElementById('pf-curso').value = currentUser.curso || '';
  document.getElementById('pf-email').value = currentUser.email;
  ['pf-atual', 'pf-nova', 'pf-confirma', 'pf-del-senha', 'pf-del-confirma'].forEach(id => { document.getElementById(id).value = ''; });
  updatePwMeter(); updateDeleteBtn(); resetPasswordFields();
  updateUserUI();
  profileTab('perfil', false);
  openModal('modal-profile');
  loadProfileStats();
}
function profileTab(name, focus = true) {
  document.querySelectorAll('#modal-profile [role="tab"]').forEach(t => {
    const on = t.dataset.tab === name;
    t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  document.querySelectorAll('#modal-profile [role="tabpanel"]').forEach(p => { p.hidden = p.id !== 'pf-tab-' + name; });
}
document.querySelector('#modal-profile .pf-tabs').addEventListener('click', e => {
  const t = e.target.closest('[role="tab"]'); if (t) profileTab(t.dataset.tab);
});
document.querySelector('#modal-profile .pf-tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')];
  const i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
  profileTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].dataset.tab);
});

// ---------- estatísticas ----------
async function loadProfileStats() {
  const box = document.getElementById('pf-stats');
  box.setAttribute('aria-busy', 'true');
  try {
    const { stats: s } = await api('profile_stats');
    const plural = (n, a, b) => n === 1 ? a : b;
    box.innerHTML = `
      <div class="pf-stat"><b>${s.sequencia}</b><span>${plural(s.sequencia, 'dia seguido', 'dias seguidos')}</span></div>
      <div class="pf-stat"><b>${s.arquivos}</b><span>${plural(s.arquivos, 'arquivo criado', 'arquivos criados')}</span></div>
      <div class="pf-stat"><b>${s.metas_concluidas}<small>/${s.metas}</small></b><span>metas concluídas</span></div>
      <div class="pf-stat"><b>${s.revisoes}</b><span>${plural(s.revisoes, 'cartão revisado', 'cartões revisados')}${s.dominados ? ` · ${s.dominados} ${plural(s.dominados, 'dominado', 'dominados')}` : ''}</span></div>`;
  } catch (e) { box.innerHTML = '<div class="pf-stat-error">Não foi possível carregar as estatísticas.</div>'; }
  box.removeAttribute('aria-busy');
}

// ---------- foto ----------
function pickPhoto() { document.getElementById('pf-file').click(); }
async function processPhoto(file) {
  if (!file) return;
  if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type)) { showToast('Escolha uma imagem PNG, JPG, WEBP ou GIF.'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('A imagem deve ter no máximo 10 MB.'); return; }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    // Recorte quadrado central, reduzido para 256x256.
    const w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h);
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 256, 256);
    let data = c.toDataURL('image/webp', 0.85);
    if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', 0.86);
    await runUI(async () => {
      applyState(await api('avatar_set', { foto: data }));
      updateUserUI(); showToast('Foto atualizada.');
    });
  } catch (e) { showToast('Não foi possível ler esta imagem.'); }
  finally { URL.revokeObjectURL(url); document.getElementById('pf-file').value = ''; }
}
async function removePhoto() {
  await runUI(async () => { applyState(await api('avatar_set', { foto: null })); updateUserUI(); showToast('Foto removida.'); });
}
document.getElementById('pf-file').addEventListener('change', e => processPhoto(e.target.files[0]));
(function () {
  const drop = document.getElementById('pf-drop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); processPhoto(e.dataTransfer.files[0]); });
})();

// ---------- perfil ----------
async function saveProfile() {
  const nome = field('pf-nome').trim();
  if (!nome) { showToast('Informe seu nome.'); document.getElementById('pf-nome').focus(); return; }
  await runUI(async () => {
    applyState(await api('profile_update', { nome, curso: field('pf-curso').trim() }));
    updateUserUI(); showToast('Perfil atualizado.');
  });
}

// ---------- senha ----------
function passwordScore(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 6) s++;
  if (p.length >= 10) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.max(1, Math.min(4, s));
}
function updatePwMeter() {
  const p = document.getElementById('pf-nova').value, score = passwordScore(p);
  const meter = document.getElementById('pf-meter');
  meter.dataset.score = score;
  document.getElementById('pf-meter-label').textContent = p ? ['', 'Fraca', 'Razoável', 'Boa', 'Forte'][score] : 'Use pelo menos 6 caracteres. Misture letras, números e símbolos.';
}
async function changePassword() {
  const atual = field('pf-atual'), nova = field('pf-nova'), conf = field('pf-confirma');
  if (!atual) { showToast('Informe a senha atual.'); return; }
  if (nova.length < 6) { showToast('A nova senha precisa ter pelo menos 6 caracteres.'); return; }
  if (nova !== conf) { showToast('A confirmação não corresponde à nova senha.'); document.getElementById('pf-confirma').focus(); return; }
  await runUI(async () => {
    await api('password_change', { atual, nova });
    ['pf-atual', 'pf-nova', 'pf-confirma'].forEach(id => { document.getElementById(id).value = ''; });
    updatePwMeter(); resetPasswordFields();
    showToast('Senha alterada com sucesso.');
  });
}
document.getElementById('pf-nova').addEventListener('input', updatePwMeter);

// ---------- preferências ----------
function replayIntro() {
  try { sessionStorage.removeItem('ef_intro'); } catch (e) {}
  location.reload();
}
function openA11yFromProfile() {
  closeModal('modal-profile');
  setTimeout(() => document.getElementById('a11y-fab').click(), 250);
}

// ---------- dados ----------
async function exportData() {
  await runUI(async () => {
    const data = await api('export');
    delete data.csrf;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `estudaflow-meus-dados-${getTodayPlus(0)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast('Arquivo com seus dados baixado.');
  });
}
function updateDeleteBtn() {
  document.getElementById('pf-del-btn').disabled = !(field('pf-del-senha') && field('pf-del-confirma') === 'EXCLUIR');
}
['pf-del-senha', 'pf-del-confirma'].forEach(id => document.getElementById(id).addEventListener('input', updateDeleteBtn));
async function deleteAccount() {
  await runUI(async () => {
    await api('account_delete', { senha: field('pf-del-senha'), confirmacao: field('pf-del-confirma') });
    closeModal('modal-profile');
    showAuth();
    showToast('Sua conta e todos os seus dados foram excluídos.');
  });
}
