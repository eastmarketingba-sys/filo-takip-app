buildDatePicker('dp_rvStart');
buildDatePicker('dp_rvEnd');

/* ---------- randevu / müsaitlik ---------- */
document.getElementById('rvSearchBtn').addEventListener('click', ()=>{
  const start = getDPValue('dp_rvStart');
  const end = getDPValue('dp_rvEnd');
  const startTime = document.getElementById('rvStartTime').value;
  const endTime = document.getElementById('rvEndTime').value;
  const box = document.getElementById('rvResults');
  if(!start || !end){ alert(t('randevu.dateRangeAlert')); return; }
  if(!startTime || !endTime){ alert(t('randevu.timeRequiredAlert')); return; }
  const searchStartDT = combineDT(start, startTime);
  const searchEndDT = combineDT(end, endTime);
  if(searchEndDT <= searchStartDT){ alert(t('randevu.pickupAfterAlert')); return; }
  const busyIds = new Set(rentals.filter(r => !(searchEndDT <= rentalStartDT(r) || searchStartDT >= rentalEndDT(r))).map(r=>r.carId));
  const available = cars.filter(c=>!busyIds.has(c.id));
  const busy = cars.filter(c=>busyIds.has(c.id));
  let html = `<div class="avail-summary">${t('randevu.summary',{start:fmtDateTime(start,startTime), end:fmtDateTime(end,endTime), avail:`<b>${available.length}</b>`, busy:`<b>${busy.length}</b>`})}</div>`;
  html += `<div class="avail-head ok">${t('randevu.availableCarsTitle')} <span class="avail-count">${available.length}</span></div>`;
  html += `<div class="grid-cars">${available.length ? available.map((c,i)=>carCardHtml(c,false,i)).join('') : `<div class="empty">${t('randevu.noAvailable')}</div>`}</div>`;
  html += `<div class="avail-head bad">${t('randevu.busyCarsTitle')} <span class="avail-count">${busy.length}</span></div>`;
  html += `<div class="grid-cars">${busy.length ? busy.map((c,i)=>carCardHtml(c,true,i)).join('') : `<div class="empty">${t('randevu.noBusy')}</div>`}</div>`;
  box.innerHTML = html;
  box.querySelectorAll('.car-card').forEach(el=>{
    el.addEventListener('click', ()=> goToCarDetail(el.dataset.id));
  });
});
