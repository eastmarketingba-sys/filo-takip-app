/* ---------- date picker component (calendar popup) — reusable, no business logic ---------- */
let AY_ISIMLERI = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
let GUN_ISIMLERI = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
function updateCalendarLocaleArrays(){
  if(currentLang==='en'){
    AY_ISIMLERI = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    GUN_ISIMLERI = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  } else if(currentLang==='bs'){
    AY_ISIMLERI = ['Januar','Februar','Mart','April','Maj','Juni','Juli','Avgust','Septembar','Oktobar','Novembar','Decembar'];
    GUN_ISIMLERI = ['Po','Ut','Sr','Če','Pe','Su','Ne'];
  } else {
    AY_ISIMLERI = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    GUN_ISIMLERI = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
  }
}
const DP_STATE = {};

function parseTRDate(text){
  const m = String(text||'').trim().match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})$/);
  if(!m) return null;
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  if(month<1||month>12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if(day<1||day>daysInMonth) return null;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function formatTypedDateDigits(raw){
  const digits = String(raw||'').replace(/\D/g,'').slice(0,8);
  let out = digits.slice(0,2);
  if(digits.length>2) out += '.' + digits.slice(2,4);
  if(digits.length>4) out += '.' + digits.slice(4,8);
  return out;
}

function openDPPanelOnly(containerId){
  document.querySelectorAll('.dp-panel').forEach(p=>p.classList.add('hidden'));
  document.querySelectorAll('.dp-field').forEach(f=>f.classList.remove('open'));
  const el = document.getElementById(containerId);
  el.querySelector('.dp-panel').classList.remove('hidden');
  el.querySelector('.dp-field').classList.add('open');
  DP_STATE[containerId].view = 'days';
  renderDPPanel(containerId);
  positionDPPanel(containerId);
}

function commitManualDate(containerId){
  const st = DP_STATE[containerId];
  const inputEl = document.getElementById(containerId).querySelector('.dp-field-input');
  const text = inputEl.value.trim();
  if(!text){
    if(st.value){ st.value = null; updateDPFieldText(containerId); if(st.onChange) st.onChange(); }
    return;
  }
  const parsed = parseTRDate(text);
  if(!parsed || (st.disabledFn && st.disabledFn(parsed))){
    updateDPFieldText(containerId);
    return;
  }
  selectDPDate(containerId, parsed);
}

function buildDatePicker(containerId, onChange){
  const el = document.getElementById(containerId);
  const today = new Date();
  DP_STATE[containerId] = { value:null, viewY:today.getFullYear(), viewM:today.getMonth(), view:'days', onChange:onChange||null, disabledFn:null };
  el.innerHTML = `
    <div class="dp-field" data-id="${containerId}">
      <input type="text" class="dp-field-input" placeholder="${t('dp.datePlaceholder')}" autocomplete="off">
      <span class="dp-field-icon">▾</span>
    </div>
    <div class="dp-panel hidden">
      <div class="dp-panel-head">
        <button type="button" class="dp-nav-btn" data-act="prev">‹</button>
        <span class="dp-title zoomable"></span>
        <button type="button" class="dp-nav-btn" data-act="next">›</button>
      </div>
      <div class="dp-today-row"><button type="button" class="dp-today-btn" data-act="today">${t('tabs.bugun')}</button></div>
      <div class="dp-weekdays">${GUN_ISIMLERI.map(g=>`<span>${g}</span>`).join('')}</div>
      <div class="dp-days"></div>
      <div class="dp-grid hidden"></div>
    </div>`;
  renderDPPanel(containerId);
  const inputEl = el.querySelector('.dp-field-input');
  const fieldEl = el.querySelector('.dp-field');
  let skipNextBlurCommit = false;
  fieldEl.addEventListener('click', (e)=>{ if(e.target===fieldEl){ e.stopPropagation(); inputEl.focus(); } });
  el.querySelector('.dp-field-icon').addEventListener('click', (e)=>{ e.stopPropagation(); toggleDPPanel(containerId); });
  inputEl.addEventListener('click', e=> e.stopPropagation());
  inputEl.addEventListener('focus', ()=> openDPPanelOnly(containerId));
  inputEl.addEventListener('input', ()=>{ inputEl.value = formatTypedDateDigits(inputEl.value); });
  inputEl.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){ e.preventDefault(); inputEl.blur(); }
    else if(e.key==='Escape'){ e.preventDefault(); skipNextBlurCommit = true; updateDPFieldText(containerId); inputEl.blur(); }
  });
  el.addEventListener('focusout', (e)=>{
    if(el.contains(e.relatedTarget)) return;
    if(skipNextBlurCommit){ skipNextBlurCommit = false; return; }
    commitManualDate(containerId);
  });
  el.querySelector('.dp-panel').addEventListener('click', e=> e.stopPropagation());
  el.querySelector('.dp-title').addEventListener('click', ()=> zoomInDP(containerId));
  el.querySelector('[data-act="prev"]').addEventListener('click', ()=> navDP(containerId,-1));
  el.querySelector('[data-act="next"]').addEventListener('click', ()=> navDP(containerId,1));
  el.querySelector('[data-act="today"]').addEventListener('click', ()=>{
    DP_STATE[containerId].view = 'days';
    selectDPDate(containerId, todayStr());
  });
}

function zoomInDP(containerId){
  const st = DP_STATE[containerId];
  if(st.view==='days') st.view='months';
  else if(st.view==='months') st.view='years';
  renderDPPanel(containerId);
}

function toggleDPPanel(containerId){
  document.querySelectorAll('.dp-panel').forEach(p=>p.classList.add('hidden'));
  document.querySelectorAll('.dp-field').forEach(f=>f.classList.remove('open'));
  const el = document.getElementById(containerId);
  const nowOpen = el.querySelector('.dp-panel').classList.toggle('hidden') === false;
  el.querySelector('.dp-field').classList.toggle('open');
  if(nowOpen){
    DP_STATE[containerId].view = 'days';
    renderDPPanel(containerId);
  }
  positionDPPanel(containerId);
}

function positionDPPanel(containerId){
  const el = document.getElementById(containerId);
  const panel = el.querySelector('.dp-panel');
  if(panel.classList.contains('hidden')) return;
  panel.style.top = '';
  panel.style.bottom = '';
  panel.style.left = '';
  panel.style.right = '';
  const margin = 8;
  const fieldRect = el.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  if(fieldRect.bottom + panelRect.height + 6 > window.innerHeight - margin && fieldRect.top - panelRect.height - 6 > margin){
    panel.style.top = 'auto';
    panel.style.bottom = 'calc(100% + 6px)';
  }
  const rightOverflow = (fieldRect.left + panelRect.width) - (window.innerWidth - margin);
  if(rightOverflow > 0){
    panel.style.left = `${-rightOverflow}px`;
  }
}
document.addEventListener('click', ()=>{
  document.querySelectorAll('.dp-panel').forEach(p=>p.classList.add('hidden'));
  document.querySelectorAll('.dp-field').forEach(f=>f.classList.remove('open'));
});

function navDP(containerId, delta){
  const st = DP_STATE[containerId];
  if(st.view==='days'){
    st.viewM += delta;
    if(st.viewM<0){ st.viewM=11; st.viewY--; }
    if(st.viewM>11){ st.viewM=0; st.viewY++; }
  } else if(st.view==='months'){
    st.viewY += delta;
  } else {
    st.viewY += delta*12;
  }
  renderDPPanel(containerId);
}

function renderDPPanel(containerId){
  const st = DP_STATE[containerId];
  const el = document.getElementById(containerId);
  const panel = el.querySelector('.dp-panel');
  const daysEl = panel.querySelector('.dp-days');
  const gridEl = panel.querySelector('.dp-grid');
  const weekdaysEl = panel.querySelector('.dp-weekdays');
  const titleEl = panel.querySelector('.dp-title');
  if(st.view==='days'){
    daysEl.classList.remove('hidden');
    gridEl.classList.add('hidden');
    weekdaysEl.classList.remove('hidden');
    titleEl.classList.add('zoomable');
    titleEl.textContent = `${AY_ISIMLERI[st.viewM]} ${st.viewY}`;
    renderDPDays(containerId);
  } else if(st.view==='months'){
    daysEl.classList.add('hidden');
    gridEl.classList.remove('hidden');
    weekdaysEl.classList.add('hidden');
    titleEl.classList.add('zoomable');
    titleEl.textContent = `${st.viewY}`;
    renderDPMonths(containerId);
  } else {
    daysEl.classList.add('hidden');
    gridEl.classList.remove('hidden');
    weekdaysEl.classList.add('hidden');
    titleEl.classList.remove('zoomable');
    const base = Math.floor(st.viewY/12)*12;
    titleEl.textContent = `${base} - ${base+9}`;
    renderDPYears(containerId);
  }
}

function renderDPMonths(containerId){
  const st = DP_STATE[containerId];
  const el = document.getElementById(containerId);
  const gridEl = el.querySelector('.dp-panel .dp-grid');
  const today = new Date();
  gridEl.innerHTML = AY_ISIMLERI.map((name,m)=>{
    const cls = ['dp-cell'];
    if(st.viewY===today.getFullYear() && m===today.getMonth()) cls.push('today');
    if(st.value){ const [vy,vm] = st.value.split('-').map(Number); if(vy===st.viewY && vm-1===m) cls.push('selected'); }
    return `<button type="button" class="${cls.join(' ')}" data-m="${m}">${name.slice(0,3)}</button>`;
  }).join('');
  gridEl.querySelectorAll('.dp-cell').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      st.viewM = Number(btn.dataset.m);
      st.view = 'days';
      renderDPPanel(containerId);
    });
  });
}

function renderDPYears(containerId){
  const st = DP_STATE[containerId];
  const el = document.getElementById(containerId);
  const gridEl = el.querySelector('.dp-panel .dp-grid');
  const base = Math.floor(st.viewY/12)*12;
  const today = new Date();
  const years = [];
  for(let i=-1;i<11;i++) years.push(base+i);
  gridEl.innerHTML = years.map(y=>{
    const cls = ['dp-cell'];
    if(y<base || y>base+9) cls.push('muted');
    if(y===today.getFullYear()) cls.push('today');
    if(st.value){ const vy = Number(st.value.split('-')[0]); if(vy===y) cls.push('selected'); }
    return `<button type="button" class="${cls.join(' ')}" data-y="${y}">${y}</button>`;
  }).join('');
  gridEl.querySelectorAll('.dp-cell').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      st.viewY = Number(btn.dataset.y);
      st.view = 'months';
      renderDPPanel(containerId);
    });
  });
}

function renderDPDays(containerId){
  const st = DP_STATE[containerId];
  const el = document.getElementById(containerId);
  const panel = el.querySelector('.dp-panel');
  const firstDow = (new Date(st.viewY, st.viewM, 1).getDay()+6)%7;
  const daysInMonth = new Date(st.viewY, st.viewM+1, 0).getDate();
  const daysInPrevMonth = new Date(st.viewY, st.viewM, 0).getDate();
  const tStr = todayStr();
  const cells = [];
  for(let i=0;i<firstDow;i++) cells.push({ d: daysInPrevMonth-firstDow+1+i, off:-1 });
  for(let d=1; d<=daysInMonth; d++) cells.push({ d, off:0 });
  let nextD = 1;
  while(cells.length < 42) cells.push({ d: nextD++, off:1 });
  const daysEl = panel.querySelector('.dp-days');
  daysEl.innerHTML = cells.map(c=>{
    let y=st.viewY, m=st.viewM;
    if(c.off===1){ m++; if(m>11){ m=0; y++; } }
    else if(c.off===-1){ m--; if(m<0){ m=11; y--; } }
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(c.d).padStart(2,'0')}`;
    const cls = ['dp-day'];
    if(c.off!==0) cls.push('muted');
    if(dateStr===tStr) cls.push('today');
    if(st.value===dateStr) cls.push('selected');
    const isDisabled = !!(st.disabledFn && st.disabledFn(dateStr));
    if(isDisabled) cls.push('disabled');
    return `<button type="button" class="${cls.join(' ')}" data-date="${dateStr}" ${isDisabled?`disabled title="${t('dp.dayOccupied')}"`:''}>${c.d}</button>`;
  }).join('');
  daysEl.querySelectorAll('.dp-day').forEach(btn=>{
    btn.addEventListener('click', ()=> selectDPDate(containerId, btn.dataset.date));
  });
}

function selectDPDate(containerId, dateStr){
  const st = DP_STATE[containerId];
  if(st.disabledFn && st.disabledFn(dateStr)) return;
  st.value = dateStr;
  const [y,m] = dateStr.split('-').map(Number);
  st.viewY = y; st.viewM = m-1;
  updateDPFieldText(containerId);
  renderDPPanel(containerId);
  const el = document.getElementById(containerId);
  el.querySelector('.dp-panel').classList.add('hidden');
  el.querySelector('.dp-field').classList.remove('open');
  if(st.onChange) st.onChange();
}

function updateDPFieldText(containerId){
  const st = DP_STATE[containerId];
  const input = document.getElementById(containerId).querySelector('.dp-field-input');
  input.value = st.value ? fmtDate(st.value) : '';
}

function setDPDisabledFn(containerId, fn){
  const st = DP_STATE[containerId];
  if(!st) return;
  st.disabledFn = fn || null;
  renderDPPanel(containerId);
}

function getDPValue(containerId){ return DP_STATE[containerId] ? DP_STATE[containerId].value : null; }
function setDPValue(containerId, dateStr){
  const st = DP_STATE[containerId];
  if(!st) return;
  st.value = dateStr || null;
  st.view = 'days';
  const today = new Date();
  if(dateStr){ const [y,m] = dateStr.split('-').map(Number); st.viewY=y; st.viewM=m-1; }
  else { st.viewY = today.getFullYear(); st.viewM = today.getMonth(); }
  updateDPFieldText(containerId);
  renderDPPanel(containerId);
}
