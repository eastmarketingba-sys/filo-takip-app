/* ---------- çalışan girişi (Supabase Auth) ---------- */
let currentProfile = null;

function applyRoleVisibility(){
  document.getElementById('teamMenuSection').classList.toggle('hidden', !currentProfile || currentProfile.role !== 'admin');
}

function showAuthGate(){
  const gate = document.getElementById('authGate');
  gate.classList.remove('hidden');
  document.getElementById('authSubmitBtn').addEventListener('click', onAuthSubmit);
  ['authEmailInput','authPasswordInput'].forEach(id=>{
    document.getElementById(id).addEventListener('keydown', (e)=>{ if(e.key==='Enter') onAuthSubmit(); });
  });
}

async function onAuthSubmit(){
  const emailInput = document.getElementById('authEmailInput');
  const passwordInput = document.getElementById('authPasswordInput');
  const errEl = document.getElementById('authError');
  const btn = document.getElementById('authSubmitBtn');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  errEl.style.display = 'none';
  if(!email || !password){ errEl.textContent = t('auth.emailRequiredError'); errEl.style.display='block'; return; }
  btn.disabled = true;
  btn.textContent = t('auth.loggingIn');
  let res;
  try{
    res = await window.api.auth.signIn(email, password);
  }catch(e){
    res = { ok:false, error:'network' };
  }
  btn.disabled = false;
  btn.textContent = t('auth.loginBtn');
  if(res.ok){
    currentProfile = res.profile;
    applyRoleVisibility();
    document.getElementById('authGate').classList.add('hidden');
    await startApp();
  } else {
    const messages = {
      network: t('auth.err.network'),
      invalid_credentials: t('auth.err.invalidCredentials'),
      no_profile: t('auth.err.invalidCredentials')
    };
    errEl.textContent = messages[res.error] || t('auth.err.generic');
    errEl.style.display = 'block';
  }
}

document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  document.getElementById('profileMenu').classList.add('hidden');
  await window.api.auth.signOut();
  location.reload();
});
