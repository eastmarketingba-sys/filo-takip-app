/* ---------- bugün: tüm araçlarda bugünkü çıkış/dönüşler ---------- */
function bugunRowHtml(r, c, isDeparture){
  const time = isDeparture ? r.startTime : r.endTime;
  const carName = c ? escapeHtml(c.name) : t('common.deletedCar');
  const plate = c && c.plate ? `<span class="plate-sm">${escapeHtml(c.plate)}</span>` : '';
  const thumb = c && c.photo ? `<img src="${c.photo}">` : `<div class="thumb-ph">🚗</div>`;
  const nameHtml = r.renterName
    ? `<button type="button" class="cust-link" data-cname="${escapeHtml(r.renterName)}">${escapeHtml(r.renterName)}</button>`
    : t('common.unnamed');
  const confirmedAt = isDeparture ? r.deliveredAt : r.returnedAt;
  const kind = isDeparture ? 'delivery' : 'return';
  const actionHtml = confirmedAt
    ? `<button type="button" class="bugun-confirmed" data-rid="${r.id}" data-kind="${kind}" title="${t('bugun.editNoteTitle')}">✓ ${new Date(confirmedAt).toLocaleTimeString(localeForLang(),{hour:'2-digit',minute:'2-digit'})}</button>`
    : `<button type="button" class="btn btn-sm bugun-action" data-rid="${r.id}" data-kind="${kind}">${isDeparture ? t('bugun.deliveredBtn') : t('bugun.returnedBtn')}</button>`;
  return `<div class="bugun-row" data-carid="${c ? c.id : ''}">
    ${thumb}
    <div class="bugun-info">
      <div class="bugun-car">${carName} ${plate}</div>
      <div class="bugun-sub">${nameHtml}${r.destination ? ' · '+escapeHtml(r.destination) : ''}</div>
    </div>
    <div class="bugun-time">${time || '-'}</div>
    ${actionHtml}
  </div>`;
}

let handoverContext = null;
function openHandoverModal(rentalId, kind){
  const r = rentals.find(x=>x.id===rentalId);
  if(!r) return;
  const c = cars.find(x=>x.id===r.carId);
  handoverContext = { rentalId, kind };
  const isDelivery = kind==='delivery';
  const already = isDelivery ? r.deliveredAt : r.returnedAt;
  document.getElementById('handoverTitle').textContent = isDelivery ? t('bugun.deliveredBtn') : t('bugun.returnedBtn');
  document.getElementById('handoverInfo').textContent = `${c ? c.name : t('common.deletedCar')}${r.renterName ? ' · '+r.renterName : ''}`;
  document.getElementById('handoverNote').value = (isDelivery ? r.deliveredNote : r.returnedNote) || '';
  document.getElementById('handoverConfirmBtn').textContent = isDelivery ? t('bugun.deliveredBtn') : t('bugun.returnedBtn');
  document.getElementById('handoverUndoBtn').style.display = already ? 'inline-block' : 'none';
  openModal('modalHandover');
}

document.getElementById('handoverConfirmBtn').addEventListener('click', async ()=>{
  if(!handoverContext) return;
  const { rentalId, kind } = handoverContext;
  const note = document.getElementById('handoverNote').value.trim();
  const updated = kind==='delivery'
    ? await window.api.rentals.confirmDelivery(rentalId, note)
    : await window.api.rentals.confirmReturn(rentalId, note);
  rentals = rentals.map(r=> r.id===rentalId ? updated : r);
  closeModal('modalHandover');
  renderBugun();
  showToast(kind==='delivery' ? t('handover.deliveredToast') : t('handover.returnedToast'));
});

document.getElementById('handoverUndoBtn').addEventListener('click', async ()=>{
  if(!handoverContext) return;
  const { rentalId, kind } = handoverContext;
  const updated = kind==='delivery'
    ? await window.api.rentals.undoDelivery(rentalId)
    : await window.api.rentals.undoReturn(rentalId);
  rentals = rentals.map(r=> r.id===rentalId ? updated : r);
  closeModal('modalHandover');
  renderBugun();
  showToast(t('handover.undoneToast'));
});

function renderBugun(){
  const todayD = todayStr();
  const departures = rentals.filter(r=>r.start===todayD).sort((a,b)=> (a.startTime||'').localeCompare(b.startTime||''));
  const returns = rentals.filter(r=>r.end===todayD).sort((a,b)=> (a.endTime||'').localeCompare(b.endTime||''));

  document.getElementById('bugunSummary').textContent =
    t('bugun.summary', { dep: departures.length, ret: returns.length });

  const depEl = document.getElementById('bugunDepartures');
  depEl.innerHTML = departures.length
    ? departures.map(r=> bugunRowHtml(r, cars.find(c=>c.id===r.carId), true)).join('')
    : `<div class="empty small" style="padding:16px 4px;">${t('bugun.noDepartures')}</div>`;

  const retEl = document.getElementById('bugunReturns');
  retEl.innerHTML = returns.length
    ? returns.map(r=> bugunRowHtml(r, cars.find(c=>c.id===r.carId), false)).join('')
    : `<div class="empty small" style="padding:16px 4px;">${t('bugun.noReturns')}</div>`;

  [depEl, retEl].forEach(el=>{
    el.querySelectorAll('.bugun-row').forEach(row=>{
      row.addEventListener('click', (e)=>{
        if(e.target.closest('.cust-link')) return;
        if(e.target.closest('.bugun-action, .bugun-confirmed')) return;
        if(row.dataset.carid) goToCarDetail(row.dataset.carid);
      });
    });
    el.querySelectorAll('.bugun-action, .bugun-confirmed').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.stopPropagation();
        openHandoverModal(btn.dataset.rid, btn.dataset.kind);
      });
    });
  });
}
