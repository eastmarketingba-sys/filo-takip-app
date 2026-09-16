const path = require('path');
const { app, BrowserWindow, shell, session } = require('electron');

// Native form kontrolleri (örn. <input type=time>) işletim sistemi locale'ine göre
// 12/24 saat formatı seçebiliyor. Uygulama tamamen Türkçe olduğu için locale'i
// sabitleyip her zaman 24 saat formatı (AM/PM'siz) göstermesini garanti ediyoruz.
app.commandLine.appendSwitch('lang', 'tr');
const { registerCarsIpc } = require('./ipc/cars');
const { registerRentalsIpc } = require('./ipc/rentals');
const { registerActivationIpc } = require('./ipc/activation');
const { registerAuthIpc } = require('./ipc/auth');
const { registerTeamIpc } = require('./ipc/team');
const { registerSettingsIpc } = require('./ipc/settings');
const { registerUpdateIpc } = require('./ipc/update');
const { registerBackupIpc } = require('./ipc/backup');
const { registerArchiveIpc } = require('./ipc/archive');
const { initUpdater } = require('./updater');
const { runDailyBackupIfNeeded } = require('./autoBackup');
// NOT: cihaz-eşleştirme ("Cihaz Eşleştirme" / push-pull snapshot) özelliği kasıtlı
// olarak burada kayıtlı değil - cars/rentals artık Supabase'de canlı ve paylaşımlı
// olduğu için o özelliğin amacı (yerel SQLite dosyalarını manuel birleştirmek)
// ortadan kalktı. src/main/sync.js ve src/main/ipc/sync.js dosyaları referans
// için repoda duruyor ama artık hiçbir yerden çağrılmıyor.

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  initUpdater(win);

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('mailto:') || url.startsWith('http')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('mailto:') || url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  // <a download> ile tetiklenen CSV vb. indirmeler: handler kayıtlı olmazsa
  // Electron varsayılan olarak native "Farklı Kaydet" diyaloğu açar. Kullanıcı
  // deneyimi olarak sessizce Downloads klasörüne kaydetmesini istiyoruz.
  session.defaultSession.on('will-download', (event, item) => {
    item.setSavePath(path.join(app.getPath('downloads'), item.getFilename()));
  });

  registerCarsIpc();
  registerRentalsIpc();
  registerActivationIpc();
  registerAuthIpc();
  registerTeamIpc();
  registerSettingsIpc();
  registerUpdateIpc();
  registerBackupIpc();
  registerArchiveIpc();
  createWindow();
  runDailyBackupIfNeeded();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
