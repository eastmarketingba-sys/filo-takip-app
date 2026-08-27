const { ipcMain } = require('electron');
const { listSiblingDevices, pushSnapshot, pullSnapshot } = require('../sync');

function registerSyncIpc() {
  ipcMain.handle('sync:listDevices', () => listSiblingDevices());
  ipcMain.handle('sync:push', () => pushSnapshot());
  ipcMain.handle('sync:pull', (event, sourceMachineId) => pullSnapshot(sourceMachineId));
}

module.exports = { registerSyncIpc };
