const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kiln', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  exportExcel: (buffer, defaultName) =>
    ipcRenderer.invoke('data:save-excel', buffer, defaultName),
  exportJson: (jsonString, defaultName) =>
    ipcRenderer.invoke('data:export-json', jsonString, defaultName),
  importJson: () => ipcRenderer.invoke('data:import-json'),
  backupCurrent: () => ipcRenderer.invoke('data:backup-current')
});
