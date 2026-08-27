const { ipcMain, BrowserWindow } = require('electron');
const { exportBackup, importBackup } = require('../backup');
const { getLastBackupInfo } = require('../autoBackup');

function currentWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
}

function registerBackupIpc() {
  ipcMain.handle('backup:export', () => exportBackup(currentWindow()));
  ipcMain.handle('backup:import', () => importBackup(currentWindow()));
  ipcMain.handle('backup:lastInfo', () => getLastBackupInfo());
}

module.exports = { registerBackupIpc };
