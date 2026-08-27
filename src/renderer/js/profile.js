/* ---------- profil menüsü / ayarlar / güncelleme ---------- */
function applyProfileDisplay(settings){
  const initials = (settings.displayName||'').trim()
    ? settings.displayName.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toLocaleUpperCase('tr')
    : '?';
  ['profileBtnImg','profileMenuImg'].forEach(id=>{
    const img = document.getElementById(id);
    if(settings.profilePhoto){ img.src = settings.profilePhoto; img.style.display='block'; }
    else { img.style.display='none'; img.removeAttribute('src'); }
  });
  document.getElementById('profileBtnInitials').style.display = settings.profilePhoto ? 'none':'flex';
  document.getElementById('profileBtnInitials').textContent = initials;
  document.getElementById('profileMenuInitials').style.display = settings.profilePhoto ? 'none':'flex';
  document.getElementById('profileMenuInitials').textContent = initials;
}

document.getElementById('langBtn').addEventListener('click', (e)=>{
  e.stopPropagation();
  document.getElementById('langMenu').classList.toggle('hidden');
});
document.getElementById('langMenu').addEventListener('click', e=> e.stopPropagation());
document.addEventListener('click', ()=> document.getElementById('langMenu').classList.add('hidden'));
document.querySelectorAll('.lang-opt').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    document.getElementById('langMenu').classList.add('hidden');
    await window.api.settings.set({ language: btn.dataset.lang });
    location.reload();
  });
});

async function initProfileMenu(){
  const settings = await window.api.settings.get();
  setLang(settings.language || 'tr');
  updateCalendarLocaleArrays();
  applyStaticTranslations();
  applyProfileDisplay(settings);
  document.getElementById('displayNameInput').value = settings.displayName || '';

  document.getElementById('profileBtn').addEventListener('click', (e)=>{
    e.stopPropagation();
    document.getElementById('profileMenu').classList.toggle('hidden');
  });
  document.getElementById('profileMenu').addEventListener('click', e=> e.stopPropagation());
  document.addEventListener('click', ()=> document.getElementById('profileMenu').classList.add('hidden'));

  document.getElementById('profilePhotoWrap').addEventListener('click', ()=> document.getElementById('profilePhotoInput').click());
  document.getElementById('profilePhotoInput').addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const dataUrl = await fileToCompressedDataURL(f, 300, 0.8);
    const updated = await window.api.settings.set({ profilePhoto: dataUrl });
    applyProfileDisplay(updated);
    e.target.value = '';
  });

  let nameDebounce;
  let nameSaveDirty = false;
  async function flushNameSave(){
    clearTimeout(nameDebounce);
    if(!nameSaveDirty) return;
    nameSaveDirty = false;
    const updated = await window.api.settings.set({ displayName: document.getElementById('displayNameInput').value });
    applyProfileDisplay(updated);
  }
  document.getElementById('displayNameInput').addEventListener('input', ()=>{
    clearTimeout(nameDebounce);
    nameSaveDirty = true;
    nameDebounce = setTimeout(flushNameSave, 400);
  });
  document.getElementById('displayNameInput').addEventListener('blur', flushNameSave);

  try{
    const version = await window.api.update.getVersion();
    document.getElementById('appVersionText').textContent = version;
  }catch(e){}

  let updateMode = 'check';
  const updateBtn = document.getElementById('checkUpdateBtn');
  const updateStatusEl = document.getElementById('updateStatusText');
  updateBtn.addEventListener('click', async ()=>{
    if(updateMode === 'install'){ await flushNameSave(); window.api.update.install(); return; }
    updateStatusEl.textContent = t('update.checking');
    await window.api.update.check();
  });
  window.api.update.onProgress((status)=>{
    if(status.state==='checking'){
      updateStatusEl.textContent = t('update.checking'); updateMode='check'; updateBtn.textContent=t('profile.updateBtn'); updateBtn.disabled=false;
    } else if(status.state==='not-available'){
      updateStatusEl.textContent = t('update.upToDate'); updateMode='check'; updateBtn.textContent=t('profile.updateBtn'); updateBtn.disabled=false;
    } else if(status.state==='downloading'){
      updateStatusEl.textContent = t('update.downloading',{pct:status.percent||0}); updateMode='check'; updateBtn.textContent=t('update.downloadingBtn'); updateBtn.disabled=true;
    } else if(status.state==='downloaded'){
      updateStatusEl.textContent = t('update.downloaded',{version:status.version}); updateMode='install'; updateBtn.textContent=t('update.restartInstallBtn'); updateBtn.disabled=false;
    } else if(status.state==='error'){
      updateStatusEl.textContent = t('update.error',{msg:status.message}); updateMode='check'; updateBtn.textContent=t('profile.updateBtn'); updateBtn.disabled=false;
    } else if(status.state==='dev-mode'){
      updateStatusEl.textContent = t('update.devModeOnly'); updateMode='check'; updateBtn.disabled=false;
    }
  });

  try{
    const info = await window.api.backup.lastInfo();
    document.getElementById('autoBackupStatusText').textContent = info ? new Date(info.date).toLocaleDateString(localeForLang()) : t('backup.none');
  }catch(e){ document.getElementById('autoBackupStatusText').textContent = t('backup.none'); }

  const backupStatusEl = document.getElementById('backupStatusText');
  document.getElementById('backupExportBtn').addEventListener('click', async ()=>{
    backupStatusEl.textContent = t('backup.exporting');
    const res = await window.api.backup.export();
    if(res.ok) backupStatusEl.textContent = t('backup.savedTo',{path:res.filePath});
    else if(res.error === 'canceled') backupStatusEl.textContent = '';
    else backupStatusEl.textContent = t('backup.error',{msg:res.error});
  });
  document.getElementById('backupImportBtn').addEventListener('click', async ()=>{
    backupStatusEl.textContent = t('backup.importing');
    const res = await window.api.backup.import();
    if(res.error === 'canceled'){ backupStatusEl.textContent = ''; return; }
    if(res.error === 'invalid_file'){ backupStatusEl.textContent = t('backup.invalidFile'); return; }
    if(!res.ok){ backupStatusEl.textContent = t('backup.error',{msg:res.error}); return; }
    backupStatusEl.textContent = t('backup.restoredRestarting');
  });

  const activationStatusEl = document.getElementById('activationChangeStatusText');
  document.getElementById('activationChangeBtn').addEventListener('click', async ()=>{
    const res = await window.api.activation.deactivate();
    if(res.error === 'canceled'){ activationStatusEl.textContent = ''; return; }
    if(!res.ok){ activationStatusEl.textContent = t('backup.error',{msg:res.error}); return; }
    location.reload();
  });
}
