let cars = [];
let rentals = [];
let currentCarId = null;
let newCarPhoto = null;
let newRenterPhoto = null;
let editingCarId = null;
let editingRentalId = null;

async function loadAll(){
  try{ cars = await window.api.cars.list(); }catch(e){ console.error(e); cars = []; }
  try{ rentals = await window.api.rentals.list(); }catch(e){ console.error(e); rentals = []; }
}

function todayStr(){ return new Date().toISOString().slice(0,10); }
function fmtDate(s){ const d=new Date(s+'T00:00:00'); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; }
function dayDiff(a,b){ return Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00'))/86400000); }
function money(n){ return Math.round(n).toLocaleString(localeForLang()) + ' €'; }

function combineDT(dateStr, timeStr){ return `${dateStr}T${timeStr || '00:00'}`; }
function rentalStartDT(r){ return `${r.start}T${r.startTime || '00:00'}`; }
function rentalEndDT(r){ return `${r.end}T${r.endTime || '23:59'}`; }
function fmtDateTime(dateStr, timeStr){ return timeStr ? `${fmtDate(dateStr)} ${timeStr}` : fmtDate(dateStr); }
function nowDT(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function sanitizeFilename(s){ return String(s||'').replace(/[\\/:*?"<>|]/g,'_').trim().slice(0,60) || 'kayit'; }
function sortCarsForSidebar(list){ return [...list].sort((a,b)=> (b.favorite?1:0)-(a.favorite?1:0) || a.name.localeCompare(b.name,localeForLang())); }

async function toggleCarFavorite(carId){
  const c = cars.find(x=>x.id===carId);
  if(!c) return;
  const updated = await window.api.cars.update(carId, { favorite: !c.favorite });
  cars = cars.map(x=>x.id===carId?updated:x);
  renderCarSidebar();
  renderDokCarList();
}
