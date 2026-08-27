/* ---------- silinenler: silinen araç/kiralama kayıtlarını görüntüle ve geri yükle ---------- */
function silinenRowHtml(item){
  const dt = item.deletedAt ? new Date(item.deletedAt).toLocaleString(localeForLang()) : '-';
  const typeLabel = item.type === 'car' ? t('common.carWord') : t('common.rentalWord');
  const label = item.label || (item.type==='car' ? t('common.unnamedCar') : t('common.unnamedRental'));
  const idAttr = encodeURIComponent(item.id);
  return `<div class="silinen-row" data-id="${idAttr}">
    <div class="silinen-info">
      <div class="silinen-label"><span class="silinen-type">${typeLabel}</span> ${escapeHtml(label)}</div>
      <div class="silinen-sub">${t('silinenler.deletedAtPrefix',{date:dt})}</div>
    </div>
    <div class="silinen-actions">
      <button type="button" class="btn btn-sm silinen-restore" data-id="${idAttr}">${t('silinenler.restoreBtn')}</button>
      <button type="button" class="rental-del silinen-del" data-id="${idAttr}" title="${t('silinenler.permDeleteTitle')}">✕</button>
    </div>
  </div>`;
}

async function renderSilinenler(){
  const el = document.getElementById('silinenlerList');
  el.innerHTML = `<div class="empty small" style="padding:24px 4px;">${t('common.loading')}</div>`;
  const items = await window.api.archive.list();
  el.innerHTML = items.length
    ? items.map(silinenRowHtml).join('')
    : `<div class="empty small" style="padding:24px 4px;">${t('silinenler.none')}</div>`;

  el.querySelectorAll('.silinen-restore').forEach(b=>{
    b.addEventListener('click', async ()=>{
      const id = decodeURIComponent(b.dataset.id);
      b.disabled = true;
      const res = await window.api.archive.restore(id);
      if(!res.ok){
        const msg = res.error==='car_missing' ? t('silinenler.carMissingError') : t('silinenler.restoreFailedError');
        showToast('✕ ' + msg);
        b.disabled = false;
        return;
      }
      if(res.type==='car'){ cars.push(res.car); }
      else { rentals.push(res.rental); }
      await renderSilinenler();
      renderCarSidebar();
      if(document.getElementById('view-dokuman').classList.contains('active')) renderDokCarList();
      showToast(t('silinenler.restoredToast'));
    });
  });
  el.querySelectorAll('.silinen-del').forEach(b=>{
    b.addEventListener('click', async ()=>{
      if(!confirm(t('silinenler.confirmPermDelete'))) return;
      const id = decodeURIComponent(b.dataset.id);
      await window.api.archive.delete(id);
      await renderSilinenler();
      showToast(t('silinenler.permDeletedToast'));
    });
  });
}

document.getElementById('silinenlerBtn').addEventListener('click', async ()=>{
  document.getElementById('profileMenu').classList.add('hidden');
  openModal('modalSilinenler');
  await renderSilinenler();
});
