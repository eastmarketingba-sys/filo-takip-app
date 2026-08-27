const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');
const { getSupabaseClient } = require('./supabaseClient');
const { getStoredLicense } = require('./activation');
const { getDb, getDbPath, closeDb } = require('./db');

function tempSnapshotPath() {
  return path.join(app.getPath('temp'), `filo-takip-snapshot-${Date.now()}.db`);
}

function isValidDbFile(filePath) {
  try {
    const Database = require('better-sqlite3');
    const testDb = new Database(filePath, { readonly: true, fileMustExist: true });
    const row = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('cars','rentals')").all();
    testDb.close();
    return row.length === 2;
  } catch (e) {
    return false;
  }
}

// license + supabase hazırsa cihazı (yeniden) kaydeder; idempotent, kayıt zaten
// varsa sadece last_seen günceller. push/list çağrılarından önce de kullanılır
// ki açılışta kayıt bir sebeple başarısız olduysa kendi kendini onarsın.
async function ensureRegistered(license, supabase) {
  try {
    const { data, error } = await supabase.rpc('register_device', { p_code: license.code, p_machine_id: license.machineId, p_label: os.hostname() });
    if (error) return { ok: false, error: 'network', detail: error.message };
    if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'network' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'network', detail: e.message };
  }
}

async function registerThisDevice() {
  const license = getStoredLicense();
  if (!license) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const res = await ensureRegistered(license, supabase);
  if (!res.ok) console.error('[sync] registerThisDevice failed:', JSON.stringify(res));
}

async function listSiblingDevices() {
  const license = getStoredLicense();
  if (!license) return { ok: false, error: 'not_activated' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'network' };
  const reg = await ensureRegistered(license, supabase);
  if (!reg.ok) return reg;
  try {
    const { data, error } = await supabase.rpc('list_sibling_devices', { p_code: license.code, p_machine_id: license.machineId });
    if (error) return { ok: false, error: 'network' };
    if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'network' };
    return { ok: true, devices: data.devices || [] };
  } catch (e) {
    return { ok: false, error: 'network' };
  }
}

async function pushSnapshot() {
  const license = getStoredLicense();
  if (!license) return { ok: false, error: 'not_activated' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'network' };
  const reg = await ensureRegistered(license, supabase);
  if (!reg.ok) return reg;

  const tmp = tempSnapshotPath();
  try {
    await getDb().backup(tmp);
    const base64 = fs.readFileSync(tmp).toString('base64');
    const { data, error } = await supabase.rpc('push_snapshot', { p_code: license.code, p_machine_id: license.machineId, p_data: base64 });
    if (error) return { ok: false, error: 'network' };
    if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'network' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
  }
}

async function pullSnapshot(sourceMachineId) {
  const license = getStoredLicense();
  if (!license) return { ok: false, error: 'not_activated' };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'network' };
  const reg = await ensureRegistered(license, supabase);
  if (!reg.ok) return reg;

  let data, error;
  try {
    ({ data, error } = await supabase.rpc('pull_snapshot', { p_code: license.code, p_machine_id: license.machineId, p_source_machine_id: sourceMachineId }));
  } catch (e) {
    return { ok: false, error: 'network' };
  }
  if (error) return { ok: false, error: 'network' };
  if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'network' };

  const tmp = tempSnapshotPath();
  try {
    fs.writeFileSync(tmp, Buffer.from(data.data, 'base64'));
    if (!isValidDbFile(tmp)) return { ok: false, error: 'invalid_file' };

    const liveDbPath = getDbPath();
    closeDb();
    fs.copyFileSync(tmp, liveDbPath);
    for (const ext of ['-wal', '-shm']) {
      const sidecar = liveDbPath + ext;
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }
  } catch (e) {
    getDb();
    return { ok: false, error: e.message };
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) {}
  }

  app.relaunch();
  app.exit(0);
  return { ok: true };
}

module.exports = { registerThisDevice, listSiblingDevices, pushSnapshot, pullSnapshot };
