const { ipcMain } = require('electron');
const { getSupabaseClient } = require('../supabaseClient');
const { setCurrentProfile, getCurrentProfile, clearCurrentProfile } = require('../session');

async function loadProfileForUser(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, org_id, role, display_name, email')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  const profile = {
    id: data.id,
    orgId: data.org_id,
    role: data.role,
    displayName: data.display_name,
    email: data.email
  };
  setCurrentProfile(profile);
  return profile;
}

function registerAuthIpc() {
  ipcMain.handle('auth:getSession', async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return { loggedIn: false };
    try {
      const { data } = await supabase.auth.getSession();
      if (!data || !data.session) {
        clearCurrentProfile();
        return { loggedIn: false };
      }
      const profile = await loadProfileForUser(supabase, data.session.user.id);
      if (!profile) {
        clearCurrentProfile();
        return { loggedIn: false };
      }
      return { loggedIn: true, profile };
    } catch (e) {
      return { loggedIn: false };
    }
  });

  ipcMain.handle('auth:signIn', async (event, email, password) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'network' };
    let data, error;
    try {
      ({ data, error } = await supabase.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(password || '')
      }));
    } catch (networkErr) {
      return { ok: false, error: 'network' };
    }
    if (error) {
      return { ok: false, error: 'invalid_credentials' };
    }
    const profile = await loadProfileForUser(supabase, data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { ok: false, error: 'no_profile' };
    }
    return { ok: true, profile };
  });

  ipcMain.handle('auth:signOut', async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try { await supabase.auth.signOut(); } catch (e) { /* yerel oturumu yine de temizle */ }
    }
    clearCurrentProfile();
    return { ok: true };
  });

  ipcMain.handle('auth:getProfile', () => getCurrentProfile());
}

module.exports = { registerAuthIpc, loadProfileForUser };
