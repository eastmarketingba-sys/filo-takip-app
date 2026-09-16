/* ---------- ekip yönetimi: kurumdaki çalışanları davet et / kaldır (sadece admin) ---------- */
function teamMemberRowHtml(m){
  const isSelf = currentProfile && m.id === currentProfile.id;
  const label = m.displayName || m.email || m.id;
  const roleLabel = m.role === 'admin' ? t('team.roleAdmin') : t('team.roleUser');
  const removeBtn = isSelf
    ? ''
    : `<button type="button" class="btn btn-sm team-remove-btn" data-id="${m.id}" data-name="${escapeHtml(label)}" style="color:var(--red);">${t('team.removeBtn')}</button>`;
  return `<div class="silinen-row">
    <div class="silinen-info">
      <div class="silinen-label">${escapeHtml(label)}${isSelf ? ' ' + t('team.you') : ''}</div>
      <div class="silinen-sub">${escapeHtml(m.email || '')} · ${escapeHtml(roleLabel)}</div>
    </div>
    <div class="silinen-actions">${removeBtn}</div>
  </div>`;
}

async function renderTeamMemberList(){
  const el = document.getElementById('teamMemberList');
  el.innerHTML = `<div class="empty small" style="padding:16px 4px;">${t('common.loading')}</div>`;
  const res = await window.api.team.list();
  if(!res.ok){
    el.innerHTML = `<div class="empty small" style="padding:16px 4px;">${t('team.listError')}</div>`;
    return;
  }
  el.innerHTML = res.members.length
    ? res.members.map(teamMemberRowHtml).join('')
    : `<div class="empty small" style="padding:16px 4px;">${t('common.noRecords')}</div>`;
  el.querySelectorAll('.team-remove-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm(t('team.removeConfirm',{name:btn.dataset.name}))) return;
      btn.disabled = true;
      const res = await window.api.team.remove(btn.dataset.id);
      if(!res.ok){
        showToast('✕ ' + t('team.removeFailed'));
        btn.disabled = false;
        return;
      }
      showToast(t('team.removedToast'));
      await renderTeamMemberList();
    });
  });
}

document.getElementById('teamBtn').addEventListener('click', async ()=>{
  document.getElementById('profileMenu').classList.add('hidden');
  document.getElementById('teamInviteEmail').value = '';
  document.getElementById('teamInviteRole').value = 'user';
  document.getElementById('teamInviteStatus').textContent = '';
  openModal('modalTeam');
  await renderTeamMemberList();
});

document.getElementById('teamInviteBtn').addEventListener('click', async ()=>{
  const emailInput = document.getElementById('teamInviteEmail');
  const roleSelect = document.getElementById('teamInviteRole');
  const statusEl = document.getElementById('teamInviteStatus');
  const email = emailInput.value.trim();
  if(!email || !email.includes('@')) return;
  const btn = document.getElementById('teamInviteBtn');
  btn.disabled = true;
  statusEl.textContent = t('team.inviting');
  const res = await window.api.team.invite({ email, role: roleSelect.value });
  btn.disabled = false;
  if(!res.ok){
    statusEl.textContent = '✕ ' + t('team.inviteFailed');
    return;
  }
  statusEl.textContent = t('team.inviteSentToast');
  emailInput.value = '';
  await renderTeamMemberList();
});
