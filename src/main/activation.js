const fs = require('fs');
const path = require('path');
const { app, safeStorage, dialog } = require('electron');
const { machineIdSync } = require('node-machine-id');
const { getSupabaseClient } = require('./supabaseClient');

function licenseFilePath() {
  return path.join(app.getPath('userData'), 'license.dat');
}

function getActivationStatus() {
  const file = licenseFilePath();
  if (!fs.existsSync(file)) return { activated: false };
  if (!safeStorage.isEncryptionAvailable()) return { activated: false };
  try {
    const encrypted = fs.readFileSync(file);
    const json = JSON.parse(safeStorage.decryptString(encrypted));
    const currentMachineId = machineIdSync(true);
    if (json.machineId !== currentMachineId) return { activated: false };
    return { activated: true };
  } catch (e) {
    return { activated: false };
  }
}

// Aktif lisansın kod + machineId bilgisini döner (sync.js gibi diğer modüller için).
// Aktivasyon yoksa null döner.
function getStoredLicense() {
  const file = licenseFilePath();
  if (!fs.existsSync(file)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = fs.readFileSync(file);
    const json = JSON.parse(safeStorage.decryptString(encrypted));
    const currentMachineId = machineIdSync(true);
    if (json.machineId !== currentMachineId) return null;
    return { code: json.code, machineId: json.machineId };
  } catch (e) {
    return null;
  }
}

async function activateWithCode(code) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'network' };
  }

  let machineId;
  try {
    machineId = machineIdSync(true);
  } catch (idErr) {
    return { ok: false, error: 'network' };
  }

  let data, error;
  try {
    ({ data, error } = await supabase.rpc('activate_code', {
      p_code: String(code || '').trim(),
      p_machine_id: machineId
    }));
  } catch (networkErr) {
    return { ok: false, error: 'network' };
  }

  if (error) return { ok: false, error: 'network' };
  if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'invalid' };

  const payload = JSON.stringify({
    machineId,
    code: String(code).trim(),
    activatedAt: new Date().toISOString()
  });

  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'network' };
  }
  const encrypted = safeStorage.encryptString(payload);
  fs.writeFileSync(licenseFilePath(), encrypted);

  try {
    const os = require('os');
    await supabase.rpc('register_device', { p_code: String(code).trim(), p_machine_id: machineId, p_label: os.hostname() });
  } catch (e) {
    // cihaz kaydı ikincil bir işlem; başarısız olsa da aktivasyonu engellemesin
  }

  return { ok: true };
}

// Bu cihazdaki yerel aktivasyonu kaldırır (license.dat silinir), böylece
// uygulama tekrar başlatıldığında/ekran yenilendiğinde yeni bir kod girilebilir.
// NOT: Sunucu tarafında kodu machine_id'den ayırmaz — eski kod bu cihaza bağlı
// kalır. Kodu başka bir cihazda kullanmak için satıcının
// "node scripts/manage-codes.js reset <KOD>" komutunu çalıştırması gerekir.
async function deactivate(win) {
  const confirm = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Vazgeç', 'Aktivasyonu Kaldır'],
    defaultId: 0,
    cancelId: 0,
    title: 'Aktivasyonu Kaldır',
    message: 'Bu cihazdaki aktivasyon kaldırılacak ve yeniden bir aktivasyon kodu girmeniz istenecek. Devam etmek istiyor musunuz?'
  });
  if (confirm.response !== 1) return { ok: false, error: 'canceled' };

  const file = licenseFilePath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return { ok: true };
}

module.exports = { getActivationStatus, activateWithCode, getStoredLicense, deactivate };
