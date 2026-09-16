const { ipcMain } = require('electron');
const { getSupabaseClient } = require('../supabaseClient');

function registerTeamIpc() {
  ipcMain.handle('team:list', async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'network' };
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name, email, created_at')
      .order('created_at', { ascending: true });
    if (error) return { ok: false, error: 'network' };
    return {
      ok: true,
      members: (data || []).map(row => ({
        id: row.id,
        role: row.role,
        displayName: row.display_name,
        email: row.email,
        createdAt: row.created_at
      }))
    };
  });

  ipcMain.handle('team:invite', async (event, { email, role, displayName } = {}) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'network' };
    const { data, error } = await supabase.functions.invoke('invite-employee', {
      body: { email, role, displayName }
    });
    if (error) return { ok: false, error: 'invite_failed' };
    if (data && data.ok === false) return { ok: false, error: data.error || 'invite_failed' };
    return { ok: true };
  });

  ipcMain.handle('team:remove', async (event, userId) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'network' };
    const { data, error } = await supabase.functions.invoke('remove-employee', {
      body: { userId }
    });
    if (error) return { ok: false, error: 'remove_failed' };
    if (data && data.ok === false) return { ok: false, error: data.error || 'remove_failed' };
    return { ok: true };
  });
}

module.exports = { registerTeamIpc };
