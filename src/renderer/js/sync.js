/* ---------- cihaz eşleştirme: aynı aktivasyon kodundaki diğer bilgisayarlarla veri getir/paylaş ---------- */
function syncDeviceRowHtml(d){
  const label = d.label || d.machineId.slice(0,8);
  const lastSeen = new Date(d.lastSeen).toLocaleString(localeForLang());
  const pullBtn = d.hasSnapshot
    ? `<button type="button" class="btn btn-sm sync-pull-btn" data-mid="${d.machineId}">${t('sync.pullBtn')}</button>`
    : `<button type="button" class="btn btn-sm" disabled title="${t('sync.noSnapshotTitle')}">${t('sync.pullBtn')}</button>`;
  return `<div class="silinen-row">
    <div class="silinen-info">
      <div class="silinen-label">${escapeHtml(label)}</div>
      <div class="silinen-sub">${t('sync.lastSeen',{date:lastSeen})}</div>
    </div>
    <div class="silinen-actions">${pullBtn}</div>
  </div>`;
}

async function renderSyncDeviceList(){
  const el = document.getElementById('syncDeviceList');
  el.innerHTML = `<div class="empty small" style="padding:16px 4px;">${t('common.loading')}</div>`;
  const res = await window.api.sync.listDevices();
  if(!res.ok){
    el.innerHTML = `<div class="empty small" style="padding:16px 4px;">${t('sync.listError')}</div>`;
    return;
  }
  el.innerHTML = res.devices.length
    ? res.devices.map(syncDeviceRowHtml).join('')
    : `<div class="empty small" style="padding:16px 4px;">${t('sync.noOtherDevices')}</div>`;
  el.querySelectorAll('.sync-pull-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm(t('sync.confirmPull'))) return;
      btn.disabled = true;
      const res = await window.api.sync.pull(btn.dataset.mid);
      if(!res.ok){
        showToast('✕ ' + t('sync.pullFailed'));
        btn.disabled = false;
        return;
      }
      showToast(t('sync.pullMergedToast',{cars:res.addedCars,rentals:res.addedRentals}));
      setTimeout(()=> location.reload(), 900);
    });
  });
}

document.getElementById('syncBtn').addEventListener('click', async ()=>{
  document.getElementById('profileMenu').classList.add('hidden');
  openModal('modalSync');
  await renderSyncDeviceList();
});

document.getElementById('syncPushBtn').addEventListener('click', async ()=>{
  const btn = document.getElementById('syncPushBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('sync.pushing');
  const res = await window.api.sync.push();
  btn.disabled = false;
  btn.textContent = originalText;
  if(res.ok) showToast(t('sync.pushedToast'));
  else showToast('✕ ' + t('sync.pushFailed'));
});
