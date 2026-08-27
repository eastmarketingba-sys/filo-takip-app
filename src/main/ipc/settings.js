const { ipcMain } = require('electron');
const { getSettings, setSettings } = require('../settings');

function registerSettingsIpc() {
  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:set', (event, patch) => setSettings(patch));
}

module.exports = { registerSettingsIpc };
