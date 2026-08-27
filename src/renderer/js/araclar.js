function carStatus(carId){
  const n = nowDT();
  return rentals.find(r => r.carId===carId && rentalStartDT(r)<=n && rentalEndDT(r)>=n) || null;
}

const CAR_ACCENTS = ['#16324F','#1D9E75','#D85A30','#7F77DD','#D4537E','#378ADD'];
function colorForId(id){
  let h = 0;
  for(let i=0;i<id.length;i++) h = (h*31 + id.charCodeAt(i)) >>> 0;
  return CAR_ACCENTS[h % CAR_ACCENTS.length];
}

function carCardHtml(c, active, i){
  const delay = i!=null ? `animation-delay:${Math.min(i,10)*35}ms;` : '';
  return `<div class="car-card" data-id="${c.id}" style="${delay}">
    <div class="car-photo" style="--accent:${colorForId(c.id)}">
      ${c.photo ? `<img src="${c.photo}">` : `<span class="ph">🚗</span>`}
      <span class="status-pill ${active?'status-dolu':'status-bosta'}">${active?t('car.dolu'):t('car.bosta')}</span>
    </div>
    <div class="car-info">
      <h3>${escapeHtml(c.name)}</h3>
      <span class="plate">${escapeHtml(c.plate||'-')}</span>
      ${c.note ? `<div class="car-note">${escapeHtml(c.note)}</div>` : ''}
    </div>
  </div>`;
}

function computeBusyDaysForCar(carId, excludeRentalId){
  const set = new Set();
  rentals.filter(r=>r.carId===carId && r.id!==excludeRentalId).forEach(r=>{
    // sadece iç günler tamamen kapalı gösterilir; alış/teslim günlerinde kısmi müsaitlik olabileceği için
    // o günler takvimde seçilebilir kalır - kesin kontrol kayıt anındaki datetime çakışma kontrolüdür.
    let d = new Date(r.start+'T00:00:00'); d.setDate(d.getDate()+1);
    const end = new Date(r.end+'T00:00:00'); end.setDate(end.getDate()-1);
    while(d<=end){
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      set.add(dateStr);
      d.setDate(d.getDate()+1);
    }
  });
  return set;
}

buildDatePicker('dp_rStart');
buildDatePicker('dp_rEnd');

/* ---------- araçlar: sol panel + detay + takvim ---------- */
let selectedCarId = null;
let calState = { y: null, m: null, view: 'days' };

function goToCarDetail(carId){
  switchTab('araclar');
  selectCar(carId);
}

function renderCarSidebar(){
  const q = (document.getElementById('carSearch').value||'').trim().toLocaleLowerCase('tr');
  const filtered = sortCarsForSidebar(cars.filter(c => !q || c.name.toLocaleLowerCase('tr').includes(q) || (c.plate||'').toLocaleLowerCase('tr').includes(q)));
  const list = document.getElementById('carSidebarList');
  if(cars.length===0){
    list.innerHTML = `<div class="empty small" style="padding:26px 14px;">${t('car.noneYet')}<br>${t('car.noneYetHint')}</div>`;
  } else if(filtered.length===0){
    list.innerHTML = `<div class="empty small" style="padding:26px 14px;">${t('common.noResults')}</div>`;
  } else {
    list.innerHTML = filtered.map(c=>{
      const busy = !!carStatus(c.id);
      const thumb = c.photo ? `<img class="thumb" src="${c.photo}">` : `<div class="thumb-ph">🚗</div>`;
      return `<div class="car-sidebar-row ${c.id===selectedCarId?'active':''}" data-id="${c.id}">
        ${thumb}
        <div class="info">
          <div class="name">${escapeHtml(c.name)}</div>
          <div class="plate-sm">${escapeHtml(c.plate||'-')}</div>
        </div>
        <button type="button" class="fav-star ${c.favorite?'active':''}" data-id="${c.id}" title="${c.favorite?t('car.favoriteRemove'):t('car.favoriteAdd')}">★</button>
        <span class="status-dot ${busy?'busy':'free'}" title="${busy?t('car.dolu'):t('car.bosta')}"></span>
      </div>`;
    }).join('');
  }
  list.querySelectorAll('.fav-star').forEach(btn=>{
    btn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleCarFavorite(btn.dataset.id); });
  });
  list.querySelectorAll('.car-sidebar-row').forEach(el=>{
    el.addEventListener('click', ()=> selectCar(el.dataset.id));
  });
}
document.getElementById('carSearch').addEventListener('input', renderCarSidebar);

function selectCar(carId){
  const c = cars.find(x=>x.id===carId);
  if(!c) return;
  selectedCarId = carId;
  currentCarId = carId;
  document.getElementById('carDetailEmpty').style.display = 'none';
  document.getElementById('carDetailContent').style.display = 'flex';
  renderCarDetailTop(c);
  const today = new Date();
  calState = { y: today.getFullYear(), m: today.getMonth(), view: 'days' };
  document.getElementById('calWeekdays').innerHTML = GUN_ISIMLERI.map(g=>`<span>${g}</span>`).join('');
  renderCarCalendar();
  renderCarSidebar();
}

function showEmptyCarDetail(){
  selectedCarId = null;
  currentCarId = null;
  document.getElementById('carDetailEmpty').style.display = 'block';
  document.getElementById('carDetailContent').style.display = 'none';
}

function renderCarDetailTop(c){
  document.getElementById('carDetailTop').innerHTML = `
    ${c.photo ? `<img src="${c.photo}">` : `<div class="noimg">🚗</div>`}
    <div class="detail-meta" style="flex:1;">
      <h2 style="font-size:20px;">${escapeHtml(c.name)}</h2>
      <span class="plate">${escapeHtml(c.plate||'-')}</span>
      ${c.avgPrice ? `<div class="note">${t('car.avgDailyNote',{price:money(c.avgPrice)})}</div>` : ''}
      ${c.note ? `<div class="note">${escapeHtml(c.note)}</div>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm" id="btnCarHistoryPane">${t('car.historyBtn')}</button>
        <button class="btn btn-primary" id="btnAddRentalPane">${t('car.addRentalBtn')}</button>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm" id="btnEditCarPane">${t('car.editBtn')}</button>
      </div>
    </div>`;
  document.getElementById('btnCarHistoryPane').addEventListener('click', ()=> openHistory(c.id));
  document.getElementById('btnAddRentalPane').addEventListener('click', ()=> openAddRentalModal());
  document.getElementById('btnEditCarPane').addEventListener('click', openEditCarModal);
}

function dayColorFor(carId, dateStr){
  const touching = rentals.filter(r=>r.carId===carId && r.start<=dateStr && r.end>=dateStr);
  if(touching.length===0) return 'white';
  const endingIds = new Set(touching.filter(r=>r.end===dateStr).map(r=>r.id));
  const startingIds = new Set(touching.filter(r=>r.start===dateStr).map(r=>r.id));
  const touchedIds = new Set([...endingIds, ...startingIds]);
  if(endingIds.size && startingIds.size && touchedIds.size>1) return 'blue';
  return dateStr <= todayStr() ? 'red' : 'yellow';
}

function zoomInCal(){
  if(calState.view==='days') calState.view='months';
  else if(calState.view==='months') calState.view='years';
  renderCarCalendar();
}
document.getElementById('calTitle').addEventListener('click', zoomInCal);

function renderCarCalendar(){
  if(!selectedCarId) return;
  const dayEls = [document.getElementById('calWeekdays'), document.getElementById('calGrid')];
  const altEl = document.getElementById('calGridAlt');
  const titleEl = document.getElementById('calTitle');
  if(calState.view==='days'){
    dayEls.forEach(el=>el.classList.remove('hidden'));
    altEl.classList.add('hidden');
    titleEl.classList.add('zoomable');
    renderCarCalendarDays();
  } else if(calState.view==='months'){
    dayEls.forEach(el=>el.classList.add('hidden'));
    altEl.classList.remove('hidden');
    titleEl.classList.add('zoomable');
    titleEl.textContent = `${calState.y}`;
    renderCarCalendarMonths();
  } else {
    dayEls.forEach(el=>el.classList.add('hidden'));
    altEl.classList.remove('hidden');
    titleEl.classList.remove('zoomable');
    const base = Math.floor(calState.y/12)*12;
    titleEl.textContent = `${base} - ${base+9}`;
    renderCarCalendarYears();
  }
}

function renderCarCalendarMonths(){
  const altEl = document.getElementById('calGridAlt');
  const today = new Date();
  altEl.innerHTML = AY_ISIMLERI.map((name,m)=>{
    const cls = ['dp-cell'];
    if(calState.y===today.getFullYear() && m===today.getMonth()) cls.push('today');
    return `<button type="button" class="${cls.join(' ')}" data-m="${m}">${name.slice(0,3)}</button>`;
  }).join('');
  altEl.querySelectorAll('.dp-cell').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      calState.m = Number(btn.dataset.m);
      calState.view = 'days';
      renderCarCalendar();
    });
  });
}

function renderCarCalendarYears(){
  const altEl = document.getElementById('calGridAlt');
  const base = Math.floor(calState.y/12)*12;
  const today = new Date();
  const years = [];
  for(let i=-1;i<11;i++) years.push(base+i);
  altEl.innerHTML = years.map(yr=>{
    const cls = ['dp-cell'];
    if(yr<base || yr>base+9) cls.push('muted');
    if(yr===today.getFullYear()) cls.push('today');
    return `<button type="button" class="${cls.join(' ')}" data-y="${yr}">${yr}</button>`;
  }).join('');
  altEl.querySelectorAll('.dp-cell').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      calState.y = Number(btn.dataset.y);
      calState.view = 'months';
      renderCarCalendar();
    });
  });
}

function renderCarCalendarDays(){
  const { y, m } = calState;
  document.getElementById('calTitle').textContent = `${AY_ISIMLERI[m]} ${y}`;
  const firstDow = (new Date(y,m,1).getDay()+6)%7;
  const daysInMonth = new Date(y,m+1,0).getDate();
  const daysInPrevMonth = new Date(y,m,0).getDate();
  const tStr = todayStr();
  const cells = [];
  for(let i=0;i<firstDow;i++) cells.push({ d: daysInPrevMonth-firstDow+1+i, off:-1 });
  for(let d=1; d<=daysInMonth; d++) cells.push({ d, off:0 });
  let nextD = 1;
  while(cells.length < 42) cells.push({ d: nextD++, off:1 });
  const grid = document.getElementById('calGrid');
  grid.innerHTML = cells.map(c=>{
    let yy=y, mm=m;
    if(c.off===1){ mm++; if(mm>11){ mm=0; yy++; } }
    else if(c.off===-1){ mm--; if(mm<0){ mm=11; yy--; } }
    const dateStr = `${yy}-${String(mm+1).padStart(2,'0')}-${String(c.d).padStart(2,'0')}`;
    const cls = ['cal-day'];
    if(c.off!==0) cls.push('muted');
    if(dateStr===tStr) cls.push('today');
    let badges = '';
    if(c.off===0){
      cls.push(dayColorFor(selectedCarId, dateStr));
      const touching = rentals.filter(r=>r.carId===selectedCarId && r.start<=dateStr && r.end>=dateStr);
      const isStart = touching.some(r=>r.start===dateStr);
      const isEnd = touching.some(r=>r.end===dateStr);
      if(isStart) badges += `<span class="cal-day-badge start" title="${t('cal.deliveryDayTitle')}">→</span>`;
      if(isEnd) badges += `<span class="cal-day-badge end" title="${t('cal.pickupDayTitle')}">←</span>`;
    }
    return `<div class="${cls.join(' ')}" data-date="${dateStr}">${c.d}${badges}</div>`;
  }).join('');
  grid.querySelectorAll('.cal-day.red, .cal-day.yellow, .cal-day.blue').forEach(el=>{
    el.addEventListener('click', ()=> openDayRentals(el.dataset.date));
  });
  grid.querySelectorAll('.cal-day.white:not(.muted)').forEach(el=>{
    el.addEventListener('click', ()=> openAddRentalModal(el.dataset.date));
  });
}

document.getElementById('calPrevBtn').addEventListener('click', ()=>{
  if(calState.view==='days'){ calState.m--; if(calState.m<0){ calState.m=11; calState.y--; } }
  else if(calState.view==='months'){ calState.y--; }
  else { calState.y -= 12; }
  renderCarCalendar();
});
document.getElementById('calNextBtn').addEventListener('click', ()=>{
  if(calState.view==='days'){ calState.m++; if(calState.m>11){ calState.m=0; calState.y++; } }
  else if(calState.view==='months'){ calState.y++; }
  else { calState.y += 12; }
  renderCarCalendar();
});

function rentalRowHtml(r){
  const days = dayDiff(r.start,r.end)+1;
  const initials = (r.renterName||'?').trim().split(' ').map(w=>w[0]).slice(0,2).join('').toLocaleUpperCase('tr');
  const nameHtml = r.renterName
    ? `<button type="button" class="cust-link" data-cname="${escapeHtml(r.renterName)}">${escapeHtml(r.renterName)}</button>`
    : t('common.unnamed');
  return `<div class="rental-row" data-rid="${r.id}">
    ${r.renterPhoto ? `<img src="${r.renterPhoto}">` : `<div class="noavatar">${initials}</div>`}
    <div class="rental-info">
      <div class="rental-dates">${fmtDateTime(r.start,r.startTime)} — ${fmtDateTime(r.end,r.endTime)} <span class="rental-sub">(${tDays(days)})</span></div>
      <div class="rental-sub">${nameHtml}${r.renterPhone ? ' · '+escapeHtml(r.renterPhone) : ''} · ${money(r.pricePerDay)}${t('rental.perDaySuffix')}</div>
      ${r.note ? `<div class="rental-sub" style="font-style:italic;">📝 ${escapeHtml(r.note)}</div>` : ''}
      ${r.deliveredAt ? `<div class="rental-sub" style="color:var(--green);">${t('handover.deliveredNoteLine',{time:new Date(r.deliveredAt).toLocaleString(localeForLang())})}${r.deliveredNote ? ' — '+escapeHtml(r.deliveredNote) : ''}</div>` : ''}
      ${r.returnedAt ? `<div class="rental-sub" style="color:var(--green);">${t('handover.returnedNoteLine',{time:new Date(r.returnedAt).toLocaleString(localeForLang())})}${r.returnedNote ? ' — '+escapeHtml(r.returnedNote) : ''}</div>` : ''}
    </div>
    <div class="rental-price">${money(r.pricePerDay*days)}</div>
    <button class="rental-edit" data-rid="${r.id}" title="${t('common.edit')}">✎</button>
    <button class="rental-del" data-rid="${r.id}" title="${t('common.delete')}">✕</button>
  </div>`;
}

function wireRentalRowActions(container){
  container.querySelectorAll('.rental-del').forEach(b=>{
    b.addEventListener('click', async (e)=>{
      e.stopPropagation();
      if(!confirm(t('rental.confirmDelete'))) return;
      await window.api.rentals.delete(b.dataset.rid);
      rentals = rentals.filter(r=>r.id!==b.dataset.rid);
      closeModal('modalDayRentals');
      closeModal('modalHistory');
      renderCarCalendar();
      renderCarSidebar();
      showToast(t('rental.deletedToast'));
    });
  });
  container.querySelectorAll('.rental-edit').forEach(b=>{
    b.addEventListener('click', (e)=>{
      e.stopPropagation();
      closeModal('modalDayRentals');
      closeModal('modalHistory');
      openEditRental(b.dataset.rid);
    });
  });
  container.querySelectorAll('.rental-row').forEach(row=>{
    row.addEventListener('click', (e)=>{
      if(e.target.closest('.cust-link')) return;
      closeModal('modalDayRentals');
      closeModal('modalHistory');
      openEditRental(row.dataset.rid);
    });
  });
}

function openDayRentals(dateStr){
  const touching = rentals.filter(r=>r.carId===selectedCarId && r.start<=dateStr && r.end>=dateStr)
    .sort((a,b)=> a.start.localeCompare(b.start));
  document.getElementById('dayRentalsTitle').textContent = fmtDate(dateStr);
  const el = document.getElementById('dayRentalsList');
  el.innerHTML = touching.length ? touching.map(rentalRowHtml).join('') : `<div class="empty">${t('common.noRecords')}</div>`;
  wireRentalRowActions(el);
  document.getElementById('dayRentalsAddBtn').onclick = ()=>{
    closeModal('modalDayRentals');
    openAddRentalModal(dateStr);
  };
  openModal('modalDayRentals');
}

let rentalPriceMode = 'daily';
function setPriceMode(mode){
  rentalPriceMode = mode;
  document.querySelectorAll('#priceModeToggle .btn').forEach(b=> b.classList.toggle('active', b.dataset.mode===mode));
  document.getElementById('rPriceLabel').textContent = mode==='total' ? t('rental.priceLabelTotal') : t('rental.priceLabelDaily');
}
document.querySelectorAll('#priceModeToggle .btn').forEach(b=>{
  b.addEventListener('click', ()=> setPriceMode(b.dataset.mode));
});

function openEditRental(rentalId){
  const r = rentals.find(x=>x.id===rentalId);
  if(!r) return;
  editingRentalId = r.id;
  newRenterPhoto = r.renterPhoto || null;
  document.getElementById('rentalModalTitle').textContent = t('rental.modalEditTitle');
  setDPValue('dp_rStart', r.start);
  setDPValue('dp_rEnd', r.end);
  const busyDays = computeBusyDaysForCar(currentCarId, r.id);
  setDPDisabledFn('dp_rStart', d => busyDays.has(d));
  setDPDisabledFn('dp_rEnd', d => busyDays.has(d));
  setPriceMode(r.priceMode || 'daily');
  document.getElementById('rPrice').value = r.priceMode==='total' ? r.priceTotal : r.pricePerDay;
  document.getElementById('rName').value = r.renterName || '';
  document.getElementById('rPhone').value = r.renterPhone || '';
  document.getElementById('rStartTime').value = r.startTime || '';
  document.getElementById('rEndTime').value = r.endTime || '';
  document.getElementById('rNote').value = r.note || '';
  document.getElementById('rDestination').value = r.destination || '';
  document.getElementById('dzRenter').innerHTML = r.renterPhoto
    ? `<img src="${r.renterPhoto}">`
    : `<div class="dz-label">${t('car.photoClickHint')}</div>`;
  openModal('modalRental');
}

document.getElementById('btnAddCar').addEventListener('click', ()=>{
  editingCarId = null;
  newCarPhoto = null;
  document.getElementById('carModalTitle').textContent = t('car.modalAddTitle');
  document.getElementById('carName').value='';
  document.getElementById('carPlate').value='';
  document.getElementById('carAvgPrice').value='';
  document.getElementById('carNote').value='';
  document.getElementById('dzCar').innerHTML = `<div class="dz-label">${t('car.photoClickHint')}</div>`;
  document.getElementById('carDeleteBtn').style.display = 'none';
  openModal('modalCar');
});
document.getElementById('carDeleteBtn').addEventListener('click', async ()=>{
  if(!editingCarId) return;
  if(!confirm(t('car.confirmDelete'))) return;
  const id = editingCarId;
  await window.api.cars.delete(id);
  cars = cars.filter(c=>c.id!==id);
  rentals = rentals.filter(r=>r.carId!==id);
  closeModal('modalCar');
  showEmptyCarDetail();
  renderCarSidebar();
  renderDokCarList();
  showToast(t('car.deletedToast'));
});
document.getElementById('dzCar').addEventListener('click', ()=> document.getElementById('carPhotoInput').click());
document.getElementById('carPhotoInput').addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  newCarPhoto = await fileToCompressedDataURL(f, 600, 0.75);
  document.getElementById('dzCar').innerHTML = `<img src="${newCarPhoto}">`;
});
document.getElementById('carSaveBtn').addEventListener('click', async ()=>{
  const name = document.getElementById('carName').value.trim();
  const plate = document.getElementById('carPlate').value.trim();
  const avgPrice = parseFloat(document.getElementById('carAvgPrice').value) || null;
  const note = document.getElementById('carNote').value.trim();
  if(!name){ alert(t('car.nameRequiredAlert')); return; }
  if(editingCarId){
    const wasEditingId = editingCarId;
    const updated = await window.api.cars.update(editingCarId, { name, plate, photo: newCarPhoto, avgPrice, note });
    cars = cars.map(c => c.id===editingCarId ? updated : c);
    closeModal('modalCar');
    selectCar(wasEditingId);
    showToast(t('car.updatedToast'));
  } else {
    const newCar = await window.api.cars.add({ name, plate, photo: newCarPhoto, avgPrice, note });
    cars.push(newCar);
    closeModal('modalCar');
    selectCar(newCar.id);
    showToast(t('car.addedToast'));
  }
});

function openEditCarModal(){
  const c = cars.find(x=>x.id===currentCarId);
  if(!c) return;
  editingCarId = c.id;
  newCarPhoto = c.photo || null;
  document.getElementById('carModalTitle').textContent = t('car.modalEditTitle');
  document.getElementById('carName').value = c.name || '';
  document.getElementById('carPlate').value = c.plate || '';
  document.getElementById('carAvgPrice').value = c.avgPrice || '';
  document.getElementById('carNote').value = c.note || '';
  document.getElementById('dzCar').innerHTML = c.photo
    ? `<img src="${c.photo}">`
    : `<div class="dz-label">${t('car.photoClickHint')}</div>`;
  document.getElementById('carDeleteBtn').style.display = 'inline-block';
  openModal('modalCar');
}

function openAddRentalModal(presetStartDate){
  editingRentalId = null;
  newRenterPhoto = null;
  document.getElementById('rentalModalTitle').textContent = t('rental.modalAddTitle');
  setDPValue('dp_rStart', presetStartDate || null);
  setDPValue('dp_rEnd', null);
  document.getElementById('rStartTime').value = '';
  document.getElementById('rEndTime').value = '';
  const busyDays = computeBusyDaysForCar(currentCarId);
  setDPDisabledFn('dp_rStart', d => busyDays.has(d));
  setDPDisabledFn('dp_rEnd', d => busyDays.has(d));
  setPriceMode('daily');
  const c = cars.find(x=>x.id===currentCarId);
  document.getElementById('rPrice').value = c && c.avgPrice ? c.avgPrice : '';
  document.getElementById('rName').value='';
  document.getElementById('rPhone').value='';
  document.getElementById('rNote').value='';
  document.getElementById('rDestination').value='';
  document.getElementById('dzRenter').innerHTML = `<div class="dz-label">${t('car.photoClickHint')}</div>`;
  openModal('modalRental');
}
document.getElementById('dzRenter').addEventListener('click', ()=> document.getElementById('renterPhotoInput').click());
document.getElementById('renterPhotoInput').addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  newRenterPhoto = await fileToCompressedDataURL(f, 400, 0.75);
  document.getElementById('dzRenter').innerHTML = `<img src="${newRenterPhoto}">`;
});
document.getElementById('rentalSaveBtn').addEventListener('click', async ()=>{
  const start = getDPValue('dp_rStart');
  const end = getDPValue('dp_rEnd');
  const startTime = document.getElementById('rStartTime').value;
  const endTime = document.getElementById('rEndTime').value;
  const priceRaw = parseFloat(document.getElementById('rPrice').value);
  const name = document.getElementById('rName').value.trim();
  const phone = document.getElementById('rPhone').value.trim();
  const note = document.getElementById('rNote').value.trim();
  const destination = document.getElementById('rDestination').value.trim();
  if(!start || !end){ alert(t('rental.dateRangeAlert')); return; }
  if(!startTime || !endTime){ alert(t('randevu.timeRequiredAlert')); return; }
  if(!priceRaw || priceRaw<=0){ alert(t('rental.priceRequiredAlert')); return; }
  const newStartDT = combineDT(start, startTime);
  const newEndDT = combineDT(end, endTime);
  if(newEndDT <= newStartDT){ alert(t('rental.pickupAfterHandoverAlert')); return; }
  const overlap = rentals.some(r=> r.carId===currentCarId && r.id!==editingRentalId && !(newEndDT <= rentalStartDT(r) || newStartDT >= rentalEndDT(r)));
  if(overlap){ alert(t('rental.overlapAlert')); return; }
  const days = dayDiff(start,end)+1;
  const pricePerDay = rentalPriceMode==='total' ? priceRaw/days : priceRaw;
  const priceTotal = rentalPriceMode==='total' ? priceRaw : null;
  const wasEditing = !!editingRentalId;
  if(editingRentalId){
    const updated = await window.api.rentals.update(editingRentalId, { start, end, startTime, endTime, pricePerDay, priceMode: rentalPriceMode, priceTotal, renterName: name, renterPhone: phone, renterPhoto: newRenterPhoto, note, destination });
    rentals = rentals.map(r => r.id===editingRentalId ? updated : r);
  } else {
    const newRental = await window.api.rentals.add({ carId: currentCarId, start, end, startTime, endTime, pricePerDay, priceMode: rentalPriceMode, priceTotal, renterName: name, renterPhone: phone, renterPhoto: newRenterPhoto, note, destination });
    rentals.push(newRental);
  }
  closeModal('modalRental');
  renderCarCalendar();
  renderCarSidebar();
  showToast(wasEditing ? t('rental.updatedToast') : t('rental.savedToast'));
});
