function renderAnalyticsSafe(){ if(typeof renderAnalytics==='function') renderAnalytics(); }
buildDatePicker('dp_anzStart', renderAnalyticsSafe);
buildDatePicker('dp_anzEnd', renderAnalyticsSafe);

/* ---------- analiz ---------- */
function overlapDays(rStart,rEnd,fStart,fEnd){
  const s = rStart > fStart ? rStart : fStart;
  const e = rEnd < fEnd ? rEnd : fEnd;
  if(s>e) return 0;
  return dayDiff(s,e)+1;
}

function renderAnalytics(){
  const start = getDPValue('dp_anzStart');
  const end = getDPValue('dp_anzEnd');
  if(!start || !end) return;
  const rangeDays = dayDiff(start,end)+1;
  const q = (document.getElementById('anzSearch').value||'').trim().toLocaleLowerCase('tr');

  let perCar = cars.map(c=>{
    const carRentals = rentals.filter(r=>r.carId===c.id);
    let days=0, count=0, revenue=0;
    carRentals.forEach(r=>{
      const ov = overlapDays(r.start,r.end,start,end);
      if(ov>0){
        days += ov;
        count++;
        revenue += r.pricePerDay * ov;
      }
    });
    return { car:c, days, count, revenue, usage: rangeDays>0 ? (days/rangeDays*100) : 0 };
  });

  const totalRevenue = perCar.reduce((a,b)=>a+b.revenue,0);
  const avgUsage = perCar.length ? perCar.reduce((a,b)=>a+b.usage,0)/perCar.length : 0;
  const idleCars = perCar.filter(p=>p.days===0);
  const topCars = [...perCar].filter(p=>p.days>0).sort((a,b)=>b.days-a.days).slice(0,3);

  document.getElementById('anzMetrics').innerHTML = `
    <div class="metric" style="--accent:var(--amber)"><div class="lbl">${t('analiz.totalRevenue')}</div><div class="val">${money(totalRevenue)}</div></div>
    <div class="metric" style="--accent:var(--navy)"><div class="lbl">${t('analiz.avgUsage')}</div><div class="val">%${avgUsage.toFixed(0)}</div></div>
    <div class="metric" style="--accent:var(--purple)"><div class="lbl">${t('analiz.totalCars')}</div><div class="val">${cars.length}</div></div>
    <div class="metric" style="--accent:var(--red)"><div class="lbl">${t('analiz.idleCars')}</div><div class="val">${idleCars.length}</div></div>`;

  document.getElementById('anzTop').innerHTML = topCars.length
    ? topCars.map(p=>`<button class="tag" data-cid="${p.car.id}">${escapeHtml(p.car.name)} — ${tDays(p.days)}</button>`).join('')
    : `<span style="color:var(--muted);font-size:13px;">${t('analiz.noRentalsInRange')}</span>`;

  document.getElementById('anzIdle').innerHTML = idleCars.length
    ? idleCars.map(p=>`<span class="tag idle">${escapeHtml(p.car.name)}</span>`).join('')
    : `<span style="color:var(--muted);font-size:13px;">${t('analiz.allRentedAtLeastOnce')}</span>`;

  if(q) perCar = perCar.filter(p => p.car.name.toLocaleLowerCase('tr').includes(q) || (p.car.plate||'').toLocaleLowerCase('tr').includes(q));

  document.getElementById('anzTable').innerHTML = perCar.length ? perCar
    .sort((a,b)=>b.days-a.days)
    .map(p=>`<tr class="clickable" data-cid="${p.car.id}">
      <td>${escapeHtml(p.car.name)}</td>
      <td><span class="plate" style="font-size:11px;padding:1px 6px;">${escapeHtml(p.car.plate||'-')}</span></td>
      <td>${p.count}</td>
      <td>${p.days}</td>
      <td style="min-width:110px;">%${p.usage.toFixed(0)}<div class="usage-bar"><div style="width:${Math.min(p.usage,100)}%;"></div></div></td>
      <td>${money(p.revenue)}</td>
    </tr>`).join('')
    : `<tr><td colspan="6" style="color:var(--muted);">${t('common.noResults')}</td></tr>`;

  document.querySelectorAll('#anzTable tr[data-cid]').forEach(tr=>{
    tr.addEventListener('click', ()=> openHistory(tr.dataset.cid));
  });
  document.querySelectorAll('#anzTop .tag[data-cid]').forEach(t=>{
    t.addEventListener('click', ()=> openHistory(t.dataset.cid));
  });
}
document.getElementById('anzSearch').addEventListener('input', renderAnalytics);

document.querySelectorAll('.btn-chip').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.btn-chip').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    setRangeDays(parseInt(btn.dataset.range,10));
    renderAnalytics();
  });
});
function setRangeDays(n){
  const end = todayStr();
  const d = new Date(); d.setDate(d.getDate()-n);
  const start = d.toISOString().slice(0,10);
  setDPValue('dp_anzStart', start);
  setDPValue('dp_anzEnd', end);
}
