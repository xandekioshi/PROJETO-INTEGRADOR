// Inicialização: consulta a sessão enquanto a introdução toca e,
// ao final dela, mostra o app (se já houver login) ou a página inicial.
(async function () {
  renderAll();
  let user = null, error = null;
  try {
    const session = await api('session');
    if (session.user) { applyState(await api('state')); user = currentUser; }
  } catch (e) { error = e; }
  await window.introDone;
  document.documentElement.classList.remove('booting');
  if (user) launchApp(user);
  else playHero();
  if (error) showToast(error.message || 'Falha de comunicação com o servidor.');
})();
