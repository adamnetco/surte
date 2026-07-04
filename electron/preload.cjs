const { contextBridge, ipcRenderer } = require("electron");

// Bridge histórico — no romper API vigente.
contextBridge.exposeInMainWorld("surteyaDesktop", {
  isDesktop: true,
  licenseStatus: () => ipcRenderer.invoke("license:status"),
  activateLicense: (key) => ipcRenderer.invoke("license:activate", key),
});

// Bridge de window controls — consumido por src/components/AppDesktopBar.tsx.
contextBridge.exposeInMainWorld("electronWin", {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onMaximizeChange: (cb) => {
    const listener = (_e, val) => cb(!!val);
    ipcRenderer.on("window:maximize-change", listener);
    return () => ipcRenderer.removeListener("window:maximize-change", listener);
  },
});
