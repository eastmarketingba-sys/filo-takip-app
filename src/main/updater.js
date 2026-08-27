const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

let mainWindow = null;
let latestStatus = { state: 'idle' };

function sendStatus(status) {
  latestStatus = status;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:progress', status);
  }
}

function initUpdater(win) {
  mainWindow = win;

  autoUpdater.on('checking-for-update', () => sendStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => sendStatus({ state: 'downloading', percent: 0, version: info.version }));
  autoUpdater.on('update-not-available', () => sendStatus({ state: 'not-available' }));
  autoUpdater.on('download-progress', (p) => sendStatus({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => sendStatus({ state: 'downloaded', version: info.version }));
  autoUpdater.on('error', (err) => sendStatus({ state: 'error', message: err && err.message ? err.message : String(err) }));
}

async function checkForUpdate() {
  if (!app.isPackaged) {
    const status = { state: 'dev-mode' };
    sendStatus(status);
    return status;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (e) {
    sendStatus({ state: 'error', message: e.message });
  }
  return latestStatus;
}

function installUpdate() {
  autoUpdater.quitAndInstall(true, true);
}

module.exports = { initUpdater, checkForUpdate, installUpdate };
