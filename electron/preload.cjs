const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("surteyaDesktop", {
  isDesktop: true,
  licenseStatus: () => ipcRenderer.invoke("license:status"),
  activateLicense: (key) => ipcRenderer.invoke("license:activate", key),
});
