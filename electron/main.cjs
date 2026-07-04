// SURTÉ YA Desktop — entry principal Electron
// Fingerprint de máquina + activación de licencia + heartbeat cada 30 min.
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

const SUPA_URL = process.env.SURTEYA_SUPA_URL || "https://dimyhjzcwlgfczimqhet.supabase.co";
const SUPA_ANON = process.env.SURTEYA_SUPA_ANON || "";
const APP_VERSION = app.getVersion();
const USER_DIR = app.getPath("userData");
const LIC_FILE = path.join(USER_DIR, "license.dat");
const TOKEN_FILE = path.join(USER_DIR, "activation.token");

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
function encFile(filePath, plaintext) {
  const key = crypto.createHash("sha256").update(machineFingerprint() + "::surteya").digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  fs.writeFileSync(filePath, Buffer.concat([iv, tag, ct]));
}
function decFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const key = crypto.createHash("sha256").update(machineFingerprint() + "::surteya").digest();
  const buf = fs.readFileSync(filePath);
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  try { return Buffer.concat([d.update(ct), d.final()]).toString("utf8"); } catch { return null; }
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
  return out;
}

async function heartbeat() {
  const key = decFile(LIC_FILE); if (!key) return;
  try { await callFn("license-heartbeat", { license_key: key, fingerprint: machineFingerprint() }); }
  catch (e) {
    if (String(e.message).match(/revoked|expired|cap|invalid/)) {
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
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  // Menú nativo oculto en producción — la app tiene su propia barra global.
  if (app.isPackaged) Menu.setApplicationMenu(null);
}

ipcMain.handle("license:status", () => ({ fingerprint: machineFingerprint(), hasLicense: !!decFile(LIC_FILE) }));
ipcMain.handle("license:activate", async (_e, key) => activate(key));

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
      message: "Esta es la primera vez que abres SURTÉ YA Desktop.",
      detail: `Huella de equipo:\n${machineFingerprint()}\n\nEn la app, ingresa la clave de licencia entregada por SURTÉ YA.`,
    });
  } else {
    heartbeat();
  }
  setInterval(heartbeat, 30 * 60 * 1000);
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
