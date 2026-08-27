/* ---------- aktivasyon ---------- */
function showActivationGate(){
  const gate = document.getElementById('activationGate');
  gate.classList.remove('hidden');
  document.getElementById('actSubmitBtn').addEventListener('click', onActivateSubmit);
  document.getElementById('actCodeInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter') onActivateSubmit(); });
}

async function onActivateSubmit(){
  const codeInput = document.getElementById('actCodeInput');
  const errEl = document.getElementById('actError');
  const btn = document.getElementById('actSubmitBtn');
  const code = codeInput.value.trim();
  errEl.style.display = 'none';
  if(!code){ errEl.textContent = t('activation.codeRequiredError'); errEl.style.display='block'; return; }
  btn.disabled = true;
  btn.textContent = t('activation.verifying');
  let res;
  try{
    res = await window.api.activation.activate(code);
  }catch(e){
    res = { ok:false, error:'network' };
  }
  btn.disabled = false;
  btn.textContent = t('activation.submitBtn');
  if(res.ok){
    document.getElementById('activationGate').classList.add('hidden');
    await startApp();
  } else {
    const messages = {
      network: t('activation.err.network'),
      already_used: t('activation.err.alreadyUsed'),
      revoked: t('activation.err.revoked'),
      not_found: t('activation.err.invalid'),
      invalid_input: t('activation.err.invalid'),
      invalid: t('activation.err.invalid')
    };
    errEl.textContent = messages[res.error] || t('activation.err.invalid');
    errEl.style.display = 'block';
  }
}

async function startApp(){
  await loadAll();
  setRangeDays(365);
  renderCarSidebar();
}

(async function init(){
  await initProfileMenu();
  const status = await window.api.activation.getStatus();
  if(!status.activated){
    showActivationGate();
    return;
  }
  await startApp();
})();
