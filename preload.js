const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  getDuration: (p) => ipcRenderer.invoke('get-duration', p),
  convert: (config) => ipcRenderer.invoke('convert', config),
  onProgress: (cb) => ipcRenderer.on('progress', (_, val) => cb(val))
});
