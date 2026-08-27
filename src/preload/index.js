const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  cars: {
    list: () => ipcRenderer.invoke('cars:list'),
    add: (data) => ipcRenderer.invoke('cars:add', data),
    update: (id, patch) => ipcRenderer.invoke('cars:update', id, patch),
    delete: (id) => ipcRenderer.invoke('cars:delete', id)
  },
  rentals: {
    list: () => ipcRenderer.invoke('rentals:list'),
    add: (data) => ipcRenderer.invoke('rentals:add', data),
    update: (id, patch) => ipcRenderer.invoke('rentals:update', id, patch),
    delete: (id) => ipcRenderer.invoke('rentals:delete', id),
    updateRenterPhoto: (renterName, photo) => ipcRenderer.invoke('rentals:updateRenterPhoto', renterName, photo),
    confirmDelivery: (id, note) => ipcRenderer.invoke('rentals:confirmDelivery', id, note),
    confirmReturn: (id, note) => ipcRenderer.invoke('rentals:confirmReturn', id, note),
    undoDelivery: (id) => ipcRenderer.invoke('rentals:undoDelivery', id),
    undoReturn: (id) => ipcRenderer.invoke('rentals:undoReturn', id)
  },
  activation: {
    getStatus: () => ipcRenderer.invoke('activation:getStatus'),
    activate: (code) => ipcRenderer.invoke('activation:activate', code),
    deactivate: () => ipcRenderer.invoke('activation:deactivate')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },
  update: {
    getVersion: () => ipcRenderer.invoke('update:getVersion'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onProgress: (cb) => ipcRenderer.on('update:progress', (e, data) => cb(data))
  },
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import'),
    lastInfo: () => ipcRenderer.invoke('backup:lastInfo')
  },
  archive: {
    list: () => ipcRenderer.invoke('archive:list'),
    restore: (id) => ipcRenderer.invoke('archive:restore', id),
    delete: (id) => ipcRenderer.invoke('archive:delete', id)
  },
  sync: {
    listDevices: () => ipcRenderer.invoke('sync:listDevices'),
    push: () => ipcRenderer.invoke('sync:push'),
    pull: (machineId) => ipcRenderer.invoke('sync:pull', machineId)
  }
});
