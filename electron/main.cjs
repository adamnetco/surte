// SistecPOS Core Desktop — entry principal Electron (runtime GENÉRICO).
// No contiene datos de ningún tenant: la identidad (branding, módulos, fiscal,
// impresora) llega en el tenant_manifest devuelto al activar la licencia.
const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");
const printAgent = require("./print-agent.cjs");

// Activar aceleración por hardware explícitamente (Chromium ya lo hace por defecto,
// pero lo confirmamos y desactivamos software rendering fallback en Linux para GPUs
// sin driver conocido — evita degradación silenciosa a canvas 2D CPU).
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
if (process.platform === "linux") app.commandLine.appendSwitch("ignore-gpu-blocklist");

// Config del backend: env genéricas SISTECPOS_*, con fallback a las legacy.
const SUPA_URL =
  process.env.SISTECPOS_SUPA_URL || process.env.SURTEYA_SUPA_URL || "";
const SUPA_ANON =
  process.env.SISTECPOS_SUPA_ANON || process.env.SURTEYA_SUPA_ANON || "";
const APP_VERSION = app.getVersion();
const USER_DIR = app.getPath("userData");
const LIC_FILE = path.join(USER_DIR, "license.dat");
const TOKEN_FILE = path.join(USER_DIR, "activation.token");
const MANIFEST_FILE = path.join(USER_DIR, "tenant_manifest.dat");

// --- Fingerprint de máquina (reforzado) ---
function machineFingerprint() {
  const ifs = os.networkInterfaces();
  const mac = Object.values(ifs).flat().map(i => i && i.mac).filter(Boolean).filter(m => m !== "00:00:00:00:00:00").sort()[0] || "";
  const cpus = os.cpus().map(c => c.model).join("|");
  const hostname = os.hostname();
  const platform = `${os.platform()}-${os.arch()}`;
  return crypto.createHash("sha256").update([mac, cpus, hostname, platform].join("::")).digest("hex");
}

// --- Persistencia cifrada simple (AES-256-GCM, key derivada del fingerprint) ---
// `salt` legacy conservado para poder leer instalaciones previas sin reactivar.
const SALTS = ["::sistecpos", "::surteya"];
function derive(salt) {
  return crypto.createHash("sha256").update(machineFingerprint() + salt).digest();
}
function encFile(filePath, plaintext) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", derive(SALTS[0]), iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  fs.writeFileSync(filePath, Buffer.concat([iv, tag, ct]));
}
function decFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
  for (const salt of SALTS) {
    try {
      const d = crypto.createDecipheriv("aes-256-gcm", derive(salt), iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
    } catch { /* prueba el siguiente salt */ }
  }
  return null;
}
function readManifest() {
  const raw = decFile(MANIFEST_FILE);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function wipeTenantData() {
  for (const f of [LIC_FILE, TOKEN_FILE, MANIFEST_FILE]) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* noop */ }
  }
}


async function callFn(fnName, body) {
  const res = await fetch(`${SUPA_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPA_ANON, "Authorization": `Bearer ${SUPA_ANON}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `http_${res.status}`);
  return json;
}

async function activate(licenseKey) {
  const out = await callFn("license-activate", {
    license_key: licenseKey, fingerprint: machineFingerprint(),
    hostname: os.hostname(), platform: process.platform, app_version: APP_VERSION,
  });
  encFile(LIC_FILE, licenseKey);
  encFile(TOKEN_FILE, JSON.stringify(out));
  if (out && out.tenant_manifest) encFile(MANIFEST_FILE, JSON.stringify(out.tenant_manifest));
  else await refreshManifest(licenseKey);
  return out;
}

/** Descarga (o refresca) el tenant manifest de la licencia activa. */
async function refreshManifest(licenseKey) {
  const key = licenseKey || decFile(LIC_FILE);
  if (!key) return null;
  try {
    const out = await callFn("desktop-tenant-bootstrap", {
      license_key: key, fingerprint: machineFingerprint(),
    });
    if (out && out.tenant_manifest) {
      encFile(MANIFEST_FILE, JSON.stringify(out.tenant_manifest));
      if (win) win.webContents.send("tenant:manifest-change", out.tenant_manifest);
      return out.tenant_manifest;
    }
  } catch (e) {
    console.warn("[tenant] manifest refresh failed:", e.message);
  }
  return readManifest();
}

async function heartbeat() {
  const key = decFile(LIC_FILE); if (!key) return;
  try {
    await callFn("license-heartbeat", { license_key: key, fingerprint: machineFingerprint() });
    await refreshManifest(key);
  } catch (e) {
    if (String(e.message).match(/revoked|expired|cap|invalid|suspended/)) {
      // Aislamiento: si el seat deja de ser válido, se borra todo rastro del tenant.
      wipeTenantData();
      dialog.showErrorBox("Licencia inválida", `La licencia fue ${e.message}. Contacta soporte.`);
      app.quit();
    }
  }
}


let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 600,
    title: "SistecPOS Desktop",
    backgroundColor: "#0F172A", // evita flash blanco al abrir
    frame: false,               // usamos AppDesktopBar como titlebar propia
    titleBarStyle: "hidden",
    show: false,                // se muestra tras 'ready-to-show' para evitar parpadeo
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // POS no puede pausar timers al perder foco
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.once("ready-to-show", () => win.show());
  win.on("maximize", () => win.webContents.send("window:maximize-change", true));
  win.on("unmaximize", () => win.webContents.send("window:maximize-change", false));
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  if (!fs.existsSync(indexPath)) {
    win.show();
    dialog.showErrorBox(
      "Falta el build web",
      `No existe ${indexPath}.\n\nEjecuta "npm run build" en la raíz del proyecto antes de abrir el cliente de escritorio.`,
    );
    return;
  }

  // Diagnóstico: si el renderer no carga (assets con rutas absolutas, JS roto),
  // la ventana quedaría en negro sin explicación. Mostramos el error real.
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    win.show();
    dialog.showErrorBox("No se pudo cargar la interfaz", `${desc} (${code})\n${url}`);
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    dialog.showErrorBox("La interfaz se cerró inesperadamente", JSON.stringify(details));
  });

  win.loadFile(indexPath);

  // Menú nativo oculto en producción — la app tiene su propia barra global.
  if (app.isPackaged) Menu.setApplicationMenu(null);
}

ipcMain.handle("license:status", () => {
  const manifest = readManifest();
  return {
    fingerprint: machineFingerprint(),
    hasLicense: !!decFile(LIC_FILE),
    organizationId: manifest ? manifest.organization_id : null,
  };
});
ipcMain.handle("license:activate", async (_e, key) => activate(key));
ipcMain.handle("tenant:manifest", () => readManifest());
ipcMain.handle("tenant:refresh-manifest", async () => refreshManifest());
ipcMain.handle("tenant:reset", () => { wipeTenantData(); return true; });


// Window controls — llamados desde AppDesktopBar (renderer) vía preload bridge.
ipcMain.handle("window:minimize", () => { if (win) win.minimize(); });
ipcMain.handle("window:maximize", () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize(); else win.maximize();
});
ipcMain.handle("window:close", () => { if (win) win.close(); });
ipcMain.handle("window:is-maximized", () => !!(win && win.isMaximized()));

app.whenReady().then(async () => {
  try { printAgent.start(); } catch (e) { console.error("[print-agent] failed to start:", e); }
  createWindow();
  const key = decFile(LIC_FILE);
  if (!key) {
    dialog.showMessageBox({
      type: "info",
      title: "Activación requerida",
      message: "Este equipo aún no está activado en SistecPOS Core.",
      detail: `Huella de equipo:\n${machineFingerprint()}\n\nIngresa en la app la clave de licencia entregada por tu proveedor.`,
    });

  } else {
    heartbeat();
  }
  setInterval(heartbeat, 30 * 60 * 1000);
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
