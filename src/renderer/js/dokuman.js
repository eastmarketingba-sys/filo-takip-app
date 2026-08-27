/* ---------- doküman: araç bazlı kiralama dökümü (tablo) ---------- */
let dokSelectedCarId = null;

function renderDokCarList(){
  const q = (document.getElementById('dokSearch').value||'').trim().toLocaleLowerCase('tr');
  const filtered = sortCarsForSidebar(cars.filter(c => !q || c.name.toLocaleLowerCase('tr').includes(q) || (c.plate||'').toLocaleLowerCase('tr').includes(q)));
  const list = document.getElementById('dokCarList');
  if(cars.length===0){
    list.innerHTML = `<div class="empty small" style="padding:26px 14px;">${t('car.noneYet')}</div>`;
  } else if(filtered.length===0){
    list.innerHTML = `<div class="empty small" style="padding:26px 14px;">${t('common.noResults')}</div>`;
  } else {
    list.innerHTML = filtered.map(c=>{
      const thumb = c.photo ? `<img class="thumb" src="${c.photo}">` : `<div class="thumb-ph">🚗</div>`;
      return `<div class="car-sidebar-row ${c.id===dokSelectedCarId?'active':''}" data-id="${c.id}">
        ${thumb}
        <div class="info">
          <div class="name">${escapeHtml(c.name)}</div>
          <div class="plate-sm">${escapeHtml(c.plate||'-')}</div>
        </div>
        <button type="button" class="fav-star ${c.favorite?'active':''}" data-id="${c.id}" title="${c.favorite?t('car.favoriteRemove'):t('car.favoriteAdd')}">★</button>
      </div>`;
    }).join('');
  }
  list.querySelectorAll('.fav-star').forEach(btn=>{
    btn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleCarFavorite(btn.dataset.id); });
  });
  list.querySelectorAll('.car-sidebar-row').forEach(el=>{
    el.addEventListener('click', ()=> selectDokCar(el.dataset.id));
  });
}
document.getElementById('dokSearch').addEventListener('input', renderDokCarList);

function selectDokCar(carId){
  const c = cars.find(x=>x.id===carId);
  if(!c) return;
  dokSelectedCarId = carId;
  document.getElementById('dokEmpty').style.display = 'none';
  document.getElementById('dokContent').style.display = 'flex';
  document.getElementById('dokTop').innerHTML = `
    ${c.photo ? `<img src="${c.photo}">` : `<div class="noimg">🚗</div>`}
    <div class="detail-meta" style="flex:1;">
      <h2 style="font-size:20px;">${escapeHtml(c.name)}</h2>
      <span class="plate">${escapeHtml(c.plate||'-')}</span>
    </div>`;
  renderDokTable(carId);
  renderDokCarList();
}

function handoverNotesText(r){
  const parts = [];
  if(r.deliveredAt) parts.push(t('dok.notesDelivery',{note: r.deliveredNote ? r.deliveredNote : t('dok.noNote')}));
  if(r.returnedAt) parts.push(t('dok.notesReturn',{note: r.returnedNote ? r.returnedNote : t('dok.noNote')}));
  return parts.join(' / ');
}

function renderDokTable(carId){
  const c = cars.find(x=>x.id===carId);
  const list = rentals.filter(r=>r.carId===carId)
    .sort((a,b)=> b.start.localeCompare(a.start) || (b.startTime||'').localeCompare(a.startTime||''));
  const wrap = document.getElementById('dokTableWrap');
  if(list.length===0){
    wrap.innerHTML = `<div class="empty" style="padding:30px;">${t('dok.noRecordsForCar')}</div>`;
    return;
  }
  const rows = list.map(r=>{
    const days = dayDiff(r.start,r.end)+1;
    const notes = handoverNotesText(r);
    return `<tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${fmtDateTime(r.start,r.startTime)}</td>
      <td>${r.destination ? escapeHtml(r.destination) : '-'}</td>
      <td>${days}</td>
      <td>${money(r.pricePerDay)}</td>
      <td>${r.renterName ? escapeHtml(r.renterName) : t('common.unnamed')}</td>
      <td>${fmtDateTime(r.end,r.endTime)}</td>
      <td>${notes ? escapeHtml(notes) : '-'}</td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table class="dok-table">
    <thead><tr>
      <th>${t('dok.col.car')}</th><th>${t('dok.col.deliveryDT')}</th><th>${t('dok.col.destination')}</th><th>${t('dok.col.days')}</th><th>${t('dok.col.dailyPrice')}</th><th>${t('dok.col.customer')}</th><th>${t('dok.col.returnDT')}</th><th>${t('dok.col.notes')}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function csvEscape(v){
  const s = String(v==null ? '' : v);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}

function exportDokCsv(){
  const c = cars.find(x=>x.id===dokSelectedCarId);
  if(!c) return;
  const list = rentals.filter(r=>r.carId===dokSelectedCarId)
    .sort((a,b)=> b.start.localeCompare(a.start) || (b.startTime||'').localeCompare(a.startTime||''));
  const header = [t('dok.col.car'), t('dok.col.deliveryDT'), t('dok.col.destination'), t('dok.col.days'), t('dok.col.dailyPrice'), t('dok.col.customer'), t('dok.col.returnDT'), t('dok.col.notes')];
  const rows = list.map(r=>{
    const days = dayDiff(r.start,r.end)+1;
    return [c.name, fmtDateTime(r.start,r.startTime), r.destination||'-', days, Math.round(r.pricePerDay), r.renterName||t('common.unnamed'), fmtDateTime(r.end,r.endTime), handoverNotesText(r)];
  });
  const csv = [header, ...rows].map(row=>row.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(c.name)}-dokum.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 2000);
  showToast(t('dok.csvDownloadedToast'));
}
document.getElementById('dokCsvBtn').addEventListener('click', exportDokCsv);
document.getElementById('dokPrintBtn').addEventListener('click', ()=> window.print());
