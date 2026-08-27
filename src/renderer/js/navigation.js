function switchTab(tab){
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('view-'+tab).classList.add('active');
  if(tab==='bugun') renderBugun();
  if(tab==='araclar') renderCarSidebar();
  if(tab==='dokuman') renderDokCarList();
  if(tab==='analiz') renderAnalytics();
  if(tab==='musteriler') renderCustomers();
}

document.querySelectorAll('.tab-btn').forEach(b=>{
  b.addEventListener('click', ()=> switchTab(b.dataset.tab));
});
document.getElementById('brandHome').addEventListener('click', ()=> switchTab('araclar'));

document.addEventListener('click', (e)=>{
  const link = e.target.closest('.cust-link');
  if(!link) return;
  e.stopPropagation();
  closeModal('modalDayRentals');
  closeModal('modalHistory');
  switchTab('musteriler');
  openCustomerDetail(link.dataset.cname.trim().toLocaleLowerCase('tr'));
});
