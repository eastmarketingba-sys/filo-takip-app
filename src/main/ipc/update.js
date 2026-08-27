const { ipcMain, app } = require('electron');
const { checkForUpdate, installUpdate } = require('../updater');

function registerUpdateIpc() {
  ipcMain.handle('update:getVersion', () => app.getVersion());
  ipcMain.handle('update:check', () => checkForUpdate());
  ipcMain.handle('update:install', () => installUpdate());
}

module.exports = { registerUpdateIpc };
