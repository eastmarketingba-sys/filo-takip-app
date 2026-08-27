const { ipcMain, BrowserWindow } = require('electron');
const { getActivationStatus, activateWithCode, deactivate } = require('../activation');

function currentWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
}

function registerActivationIpc() {
  ipcMain.handle('activation:getStatus', () => getActivationStatus());
  ipcMain.handle('activation:activate', (event, code) => activateWithCode(code));
  ipcMain.handle('activation:deactivate', () => deactivate(currentWindow()));
}

module.exports = { registerActivationIpc };
