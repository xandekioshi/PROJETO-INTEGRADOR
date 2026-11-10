// Recupera a sessão e, se já houver login, os dados persistidos.
(async function(){
  renderAll();
  await runUI(async()=>{
    const session=await api('session');
    if(session.user){applyState(await api('state'));launchApp(currentUser);}
  });
})();
