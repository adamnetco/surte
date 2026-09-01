const { contextBridge, ipcRenderer } = require("electron");

// Bridge genérico del runtime desktop (sin identidad de tenant).
const desktopApi = {
  isDesktop: true,
  licenseStatus: () => ipcRenderer.invoke("license:status"),
  activateLicense: (key) => ipcRenderer.invoke("license:activate", key),
  getTenantManifest: () => ipcRenderer.invoke("tenant:manifest"),
  refreshTenantManifest: () => ipcRenderer.invoke("tenant:refresh-manifest"),
  resetTenant: () => ipcRenderer.invoke("tenant:reset"),
  onTenantManifestChange: (cb) => {
    const listener = (_e, manifest) => cb(manifest);
    ipcRenderer.on("tenant:manifest-change", listener);
    return () => ipcRenderer.removeListener("tenant:manifest-change", listener);
  },
};

contextBridge.exposeInMainWorld("sistecposDesktop", desktopApi);
// Alias legacy DEPRECADO — mantiene compatibilidad con instalaciones previas.
contextBridge.exposeInMainWorld("surteyaDesktop", desktopApi);

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
