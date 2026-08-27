/* ---------- müşteriler ---------- */
function getCustomers(){
  const map = {};
  rentals.forEach(r=>{
    const name = (r.renterName||'').trim();
    if(!name) return;
    const key = name.toLocaleLowerCase('tr');
    if(!map[key]) map[key] = { key, name, photo:null, phone:null, rentals:[] };
    map[key].rentals.push(r);
    if(r.renterPhoto) map[key].photo = r.renterPhoto;
    if(r.renterPhone) map[key].phone = r.renterPhone;
  });
  return Object.values(map);
}

function custRentalRowHtml(r){
  const c = cars.find(x=>x.id===r.carId);
  const days = dayDiff(r.start,r.end)+1;
  return `<div class="rental-row">
    <div class="noavatar" style="background:var(--navy);color:#fff;">🚗</div>
    <div class="rental-info">
      <div class="rental-dates">${c ? escapeHtml(c.name) : t('common.deletedCar')} ${c && c.plate ? `<span class="rental-sub">(${escapeHtml(c.plate)})</span>` : ''}</div>
      <div class="rental-sub">${fmtDateTime(r.start,r.startTime)} — ${fmtDateTime(r.end,r.endTime)} · ${tDays(days)}</div>
    </div>
    <div class="rental-price">${money(r.pricePerDay*days)}</div>
  </div>`;
}

function renderCustomers(){
  const q = (document.getElementById('custSearch').value||'').trim().toLocaleLowerCase('tr');
  const list = getCustomers().filter(c=> !q || c.name.toLocaleLowerCase('tr').includes(q))
    .sort((a,b)=> a.name.localeCompare(b.name, 'tr'));
  const grid = document.getElementById('custGrid');
  if(list.length===0){
    grid.innerHTML = `<div class="empty"><div class="big">${t('cust.noneYet')}</div>${t('cust.noneYetHint')}</div>`;
    return;
  }
  grid.innerHTML = list.map((c,i)=>{
    const totalSpent = c.rentals.reduce((a,r)=> a + r.pricePerDay*(dayDiff(r.start,r.end)+1), 0);
    const initials = c.name.trim().split(' ').map(w=>w[0]).slice(0,2).join('').toLocaleUpperCase('tr');
    const avatar = c.photo
      ? `<img class="cust-avatar" src="${c.photo}">`
      : `<div class="cust-avatar-fallback" style="background:${colorForId(c.name)}">${initials}</div>`;
    return `<div class="cust-card" data-key="${c.key}" style="animation-delay:${Math.min(i,10)*35}ms">
      ${avatar}
      <div class="cust-name">${escapeHtml(c.name)}</div>
      ${c.phone ? `<div class="cust-phone">${escapeHtml(c.phone)}</div>` : ''}
      <div class="cust-stats">${tRentals(c.rentals.length)} · ${money(totalSpent)}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.cust-card').forEach(el=>{
    el.addEventListener('click', ()=> openCustomerDetail(el.dataset.key));
  });
}
document.getElementById('custSearch').addEventListener('input', renderCustomers);

function openCustomerDetail(key){
  const c = getCustomers().find(x=>x.key===key);
  if(!c) return;
  const totalSpent = c.rentals.reduce((a,r)=> a + r.pricePerDay*(dayDiff(r.start,r.end)+1), 0);
  const sorted = [...c.rentals].sort((a,b)=> a.start.localeCompare(b.start));
  const initials = c.name.trim().split(' ').map(w=>w[0]).slice(0,2).join('').toLocaleUpperCase('tr');
  const avatarHtml = c.photo
    ? `<img src="${c.photo}" style="width:84px;height:84px;border-radius:50%;object-fit:cover;">`
    : `<div style="width:84px;height:84px;border-radius:50%;background:${colorForId(c.name)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:24px;margin:0 auto;">${initials}</div>`;
  document.getElementById('custDetailBody').innerHTML = `
    <div style="text-align:center;margin-bottom:18px;">
      <button type="button" id="custAvatarBtn" style="border:none;background:none;padding:0;cursor:pointer;border-radius:50%;" title="${t('cust.photoEnlargeTitle')}">${avatarHtml}</button>
      <div style="font-size:17px;font-weight:600;margin-top:10px;">${escapeHtml(c.name)}</div>
      ${c.phone ? `<div style="font-size:12.5px;color:var(--muted);margin-top:2px;">${escapeHtml(c.phone)}</div>` : ''}
    </div>
    <div class="metrics" style="margin-bottom:20px;">
      <div class="metric" style="--accent:var(--navy)"><div class="lbl">${t('cust.totalRentals')}</div><div class="val">${c.rentals.length}</div></div>
      <div class="metric" style="--accent:var(--amber)"><div class="lbl">${t('cust.totalSpent')}</div><div class="val">${money(totalSpent)}</div></div>
      <div class="metric" style="--accent:var(--purple)"><div class="lbl">${t('cust.firstRental')}</div><div class="val" style="font-size:14px;">${fmtDate(sorted[0].start)}</div></div>
    </div>
    <div class="detail-sub"><h3>${t('cust.rentalHistory')}</h3></div>
    ${sorted.map(custRentalRowHtml).join('')}
  `;
  document.getElementById('custAvatarBtn').addEventListener('click', ()=>{
    openPhotoLightbox(c.photo, async (newPhoto)=>{
      await window.api.rentals.updateRenterPhoto(c.name, newPhoto);
      rentals = rentals.map(r => r.renterName && r.renterName.trim().toLocaleLowerCase('tr')===c.key ? { ...r, renterPhoto:newPhoto } : r);
      openCustomerDetail(key);
      if(document.getElementById('view-musteriler').classList.contains('active')) renderCustomers();
    });
  });
  openModal('modalCustomer');
}

function openHistory(carId){
  const c = cars.find(x=>x.id===carId);
  const list = rentals.filter(r=>r.carId===carId).sort((a,b)=> b.start.localeCompare(a.start));
  document.getElementById('histTitle').textContent = `${c.name} — ${t('cust.rentalHistory')}`;
  const el = document.getElementById('histList');
  el.innerHTML = list.length ? list.map(rentalRowHtml).join('') : `<div class="empty">${t('common.noRecords')}</div>`;
  wireRentalRowActions(el);
  openModal('modalHistory');
}

/* ---------- fotoğraf büyütme / değiştirme (lightbox) ---------- */
let photoLightboxOnChange = null;
function openPhotoLightbox(photoUrl, onChange){
  const img = document.getElementById('photoViewImg');
  const empty = document.getElementById('photoViewEmpty');
  if(photoUrl){ img.style.display='block'; img.src = photoUrl; empty.style.display='none'; }
  else { img.style.display='none'; empty.style.display='block'; }
  photoLightboxOnChange = onChange || null;
  document.getElementById('photoViewChangeBtn').style.display = onChange ? 'inline-block' : 'none';
  openModal('modalPhotoView');
}
document.getElementById('photoViewChangeBtn').addEventListener('click', ()=> document.getElementById('photoViewChangeInput').click());
document.getElementById('photoViewChangeInput').addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const dataUrl = await fileToCompressedDataURL(f, 500, 0.8);
  document.getElementById('photoViewImg').src = dataUrl;
  document.getElementById('photoViewImg').style.display = 'block';
  document.getElementById('photoViewEmpty').style.display = 'none';
  if(photoLightboxOnChange) await photoLightboxOnChange(dataUrl);
  e.target.value = '';
});
