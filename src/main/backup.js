const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const { getDb, getDbPath, closeDb } = require('./db');

function todayTag() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function exportBackup(win) {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Yedek Konumu Seç',
    defaultPath: `filo-takip-yedek-${todayTag()}.db`,
    filters: [{ name: 'Filo Takip Yedek Dosyası', extensions: ['db'] }]
  });
  if (canceled || !filePath) return { ok: false, error: 'canceled' };

  try {
    await getDb().backup(filePath);
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function isValidBackupFile(filePath) {
  try {
    const Database = require('better-sqlite3');
    const testDb = new Database(filePath, { readonly: true, fileMustExist: true });
    const row = testDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('cars','rentals')")
      .all();
    testDb.close();
    return row.length === 2;
  } catch (e) {
    return false;
  }
}

async function importBackup(win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Yedek Dosyası Seç',
    properties: ['openFile'],
    filters: [{ name: 'Filo Takip Yedek Dosyası', extensions: ['db'] }]
  });
  if (canceled || !filePaths || !filePaths[0]) return { ok: false, error: 'canceled' };

  const sourcePath = filePaths[0];
  if (!isValidBackupFile(sourcePath)) {
    return { ok: false, error: 'invalid_file' };
  }

  const confirm = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Vazgeç', 'Geri Yükle'],
    defaultId: 0,
    cancelId: 0,
    title: 'Yedeği Geri Yükle',
    message: 'Bu işlem mevcut tüm araç ve kiralama verilerinin üzerine yazacak. Devam etmek istiyor musunuz?'
  });
  if (confirm.response !== 1) return { ok: false, error: 'canceled' };

  const liveDbPath = getDbPath();
  closeDb();

  try {
    fs.copyFileSync(sourcePath, liveDbPath);
    for (const ext of ['-wal', '-shm']) {
      const sidecar = liveDbPath + ext;
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }
  } catch (e) {
    getDb(); // reopen whatever is there so app doesn't stay dead
    return { ok: false, error: e.message };
  }

  app.relaunch();
  app.exit(0);
  return { ok: true };
}

module.exports = { exportBackup, importBackup };
