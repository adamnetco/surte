// SURTÉ YA Print Agent — agente local embebido en Electron.
// Expone http://127.0.0.1:9101 para que el navegador delegue impresión.
//
// Conexiones soportadas:
//   - LAN   (TCP 9100) ........................ siempre, sin deps nativas.
//   - USB   (libusb)   ........................ require('usb') opcional.
//   - USB   (spooler SO RAW) .................. fallback si libusb no encontró device.
//   - BT    (@abandonware/noble) .............. require opcional; pairing persistente en disco.
//
// Las dependencias nativas son opcionales: si no están instaladas, el endpoint
// responde 501 con un mensaje accionable para que el navegador caiga a WebUSB / WebBluetooth.

const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PORT = Number(process.env.SURTEYA_PRINT_AGENT_PORT || 9101);

// ---------- carga perezosa de deps nativas ----------
let usbLib = null;
let usbError = null;
try { usbLib = require("usb"); } catch (e) { usbError = e.message; }

let nobleLib = null;
let nobleError = null;
try { nobleLib = require("@abandonware/noble"); } catch (e) { nobleError = e.message; }

// ---------- persistencia de pairing BLE ----------
const STATE_DIR = process.env.SURTEYA_AGENT_STATE_DIR
  || path.join(os.homedir(), ".surteya-print-agent");
try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
const BLE_PAIRINGS_FILE = path.join(STATE_DIR, "ble-pairings.json");

function loadBlePairings() {
  try { return JSON.parse(fs.readFileSync(BLE_PAIRINGS_FILE, "utf8")); } catch { return {}; }
}
function saveBlePairings(map) {
  try { fs.writeFileSync(BLE_PAIRINGS_FILE, JSON.stringify(map, null, 2)); } catch {}
}

// ---------- helpers ----------
function b64ToBuf(b64) { return Buffer.from(b64, "base64"); }

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

// ---------- LAN (TCP 9100) ----------
function sendToLan(ip, port, bytes, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (err) => { if (done) return; done = true; try { sock.destroy(); } catch {} err ? reject(err) : resolve(); };
    sock.setTimeout(timeoutMs, () => finish(new Error(`timeout ${ip}:${port}`)));
    sock.on("error", finish);
    sock.connect(port, ip, () => {
      sock.write(bytes, (err) => {
        if (err) return finish(err);
        setTimeout(() => finish(null), 200);
      });
    });
  });
}

// ---------- USB nativo (libusb) ----------
function findUsbDevice(vendorId, productId) {
  if (!usbLib) return null;
  const list = usbLib.getDeviceList ? usbLib.getDeviceList() : [];
  return list.find((d) => {
    const desc = d.deviceDescriptor || {};
    if (vendorId && desc.idVendor !== Number(vendorId)) return false;
    if (productId && desc.idProduct !== Number(productId)) return false;
    return true;
  }) || null;
}

async function sendToUsbNative(vendorId, productId, bytes) {
  if (!usbLib) throw new Error("usb_lib_not_installed");
  const dev = findUsbDevice(vendorId, productId);
  if (!dev) throw new Error("usb_device_not_found");
  dev.open();
  try {
    const iface = dev.interfaces[0];
    if (!iface) throw new Error("usb_no_interface");
    // Linux: kernel driver
    try { if (iface.isKernelDriverActive && iface.isKernelDriverActive()) iface.detachKernelDriver(); } catch {}
    iface.claim();
    try {
      const out = iface.endpoints.find((e) => e.direction === "out");
      if (!out) throw new Error("usb_no_endpoint_out");
      await new Promise((resolve, reject) => {
        out.transfer(bytes, (err) => err ? reject(err) : resolve());
      });
    } finally {
      try { iface.release(true, () => {}); } catch {}
    }
  } finally {
    try { dev.close(); } catch {}
  }
}

// ---------- USB fallback: spooler RAW del SO ----------
function sendToSpoolerRaw(printerName, bytes) {
  return new Promise((resolve, reject) => {
    if (!printerName) return reject(new Error("missing printer_name for spooler fallback"));
    if (process.platform === "win32") {
      // PowerShell + Out-Printer no soporta RAW; usamos lpr.exe (presente en Windows con LPR Port Monitor)
      // Alternativa: copy /B file \\<host>\<printer>. Aquí usamos un tmp + lpr.
      const tmp = path.join(os.tmpdir(), `surteya-print-${Date.now()}.bin`);
      fs.writeFileSync(tmp, bytes);
      const p = spawn("powershell.exe", ["-NoProfile", "-Command",
        `Get-Content -Path '${tmp}' -Encoding Byte -ReadCount 0 | Out-Printer -Name '${printerName.replace(/'/g, "''")}'`]);
      p.on("error", reject);
      p.on("exit", (code) => { try { fs.unlinkSync(tmp); } catch {} ; code === 0 ? resolve() : reject(new Error(`spooler exit ${code}`)); });
    } else {
      // macOS / Linux: lp -d <printer> -o raw
      const p = spawn("lp", ["-d", printerName, "-o", "raw"]);
      p.on("error", reject);
      p.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`lp exit ${code}`)));
      p.stdin.end(bytes);
    }
  });
}

// ---------- Bluetooth (noble) ----------
const KNOWN_BLE_SERVICES = [
  { service: "000018f0000010008000-00805f9b34fb".replace(/-/g, ""), write: "00002af100001000800000805f9b34fb" },
  { service: "6e400001b5a3f393e0a9e50e24dcca9e", write: "6e400002b5a3f393e0a9e50e24dcca9e" },
];

let nobleReady = false;
function ensureNobleReady() {
  if (!nobleLib) throw new Error("noble_not_installed");
  if (nobleReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (nobleLib.state === "poweredOn") { nobleReady = true; return resolve(); }
    const t = setTimeout(() => reject(new Error("ble_adapter_not_ready")), 5000);
    nobleLib.once("stateChange", (s) => {
      clearTimeout(t);
      if (s === "poweredOn") { nobleReady = true; resolve(); } else reject(new Error(`ble_state_${s}`));
    });
  });
}

async function discoverBleDevice(addressOrName, timeoutMs = 10000) {
  await ensureNobleReady();
  return new Promise((resolve, reject) => {
    const found = new Map();
    const onDiscover = (p) => {
      found.set(p.address, p);
      if (
        (addressOrName && (p.address?.toLowerCase() === addressOrName.toLowerCase()
          || p.advertisement?.localName === addressOrName))
      ) {
        cleanup();
        resolve(p);
      }
    };
    const cleanup = () => {
      try { nobleLib.removeListener("discover", onDiscover); } catch {}
      try { nobleLib.stopScanning(); } catch {}
      clearTimeout(t);
    };
    const t = setTimeout(() => {
      cleanup();
      if (!addressOrName && found.size) return resolve(Array.from(found.values())[0]);
      reject(new Error("ble_device_not_found"));
    }, timeoutMs);
    nobleLib.on("discover", onDiscover);
    nobleLib.startScanning([], true);
  });
}

async function sendToBluetooth(addressOrName, bytes) {
  const peripheral = await discoverBleDevice(addressOrName);
  await new Promise((resolve, reject) => peripheral.connect((err) => err ? reject(err) : resolve()));
  try {
    const chars = await new Promise((resolve, reject) => {
      peripheral.discoverAllServicesAndCharacteristics((err, services, characteristics) => {
        err ? reject(err) : resolve(characteristics || []);
      });
    });
    const writeChar = chars.find((c) => (c.properties || []).some((p) => p === "write" || p === "writeWithoutResponse"));
    if (!writeChar) throw new Error("ble_no_write_characteristic");
    const CHUNK = 180;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.slice(i, i + CHUNK);
      await new Promise((resolve, reject) => writeChar.write(slice, true, (err) => err ? reject(err) : resolve()));
    }
    // persistir pairing
    const map = loadBlePairings();
    map[peripheral.address || peripheral.id] = {
      address: peripheral.address, id: peripheral.id, name: peripheral.advertisement?.localName,
      last_used_at: new Date().toISOString(),
    };
    saveBlePairings(map);
  } finally {
    try { peripheral.disconnect(); } catch {}
  }
}

// ---------- HTTP ----------
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  try {
    if (req.url === "/health") {
      return sendJson(res, 200, {
        ok: true, version: 2, host: os.hostname(),
        capabilities: {
          lan: true,
          usb_native: !!usbLib,
          usb_native_error: usbError,
          usb_spooler: true,
          bluetooth: !!nobleLib,
          bluetooth_error: nobleError,
        },
      });
    }

    if (req.url === "/ble/pairings" && req.method === "GET") {
      return sendJson(res, 200, { pairings: loadBlePairings() });
    }

    if (req.url === "/print" && req.method === "POST") {
      const body = await readBody(req);
      const {
        connection, ip_address, port, escpos_b64,
        vendor_id, product_id, printer_name,
        bluetooth_address,
      } = body || {};
      if (!escpos_b64) return sendJson(res, 400, { error: "missing escpos_b64" });
      const bytes = b64ToBuf(escpos_b64);

      if (connection === "lan") {
        if (!ip_address) return sendJson(res, 400, { error: "missing ip_address" });
        await sendToLan(ip_address, Number(port || 9100), bytes);
        return sendJson(res, 200, { ok: true, bytes: bytes.length, route: "lan" });
      }

      if (connection === "usb") {
        // 1) libusb nativo
        if (usbLib) {
          try {
            await sendToUsbNative(vendor_id, product_id, bytes);
            return sendJson(res, 200, { ok: true, bytes: bytes.length, route: "usb_native" });
          } catch (e) {
            // 2) fallback spooler si hay printer_name
            if (printer_name) {
              try {
                await sendToSpoolerRaw(printer_name, bytes);
                return sendJson(res, 200, { ok: true, bytes: bytes.length, route: "usb_spooler", note: `usb_native_failed: ${e.message}` });
              } catch (e2) {
                return sendJson(res, 502, { error: `usb_native_and_spooler_failed: ${e.message} | ${e2.message}` });
              }
            }
            return sendJson(res, 502, { error: `usb_native_failed: ${e.message}`, hint: "set printer_name for spooler fallback" });
          }
        }
        // libusb no instalado → solo spooler
        if (printer_name) {
          try {
            await sendToSpoolerRaw(printer_name, bytes);
            return sendJson(res, 200, { ok: true, bytes: bytes.length, route: "usb_spooler" });
          } catch (e) {
            return sendJson(res, 502, { error: `spooler_failed: ${e.message}` });
          }
        }
        return sendJson(res, 501, { error: "usb_native_not_installed_and_no_printer_name", install: "npm i usb" });
      }

      if (connection === "bluetooth") {
        if (!nobleLib) return sendJson(res, 501, { error: "noble_not_installed", install: "npm i @abandonware/noble" });
        try {
          await sendToBluetooth(bluetooth_address, bytes);
          return sendJson(res, 200, { ok: true, bytes: bytes.length, route: "bluetooth" });
        } catch (e) {
          return sendJson(res, 502, { error: `bluetooth_failed: ${e.message}` });
        }
      }

      return sendJson(res, 400, { error: `unsupported connection: ${connection}` });
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (e) {
    sendJson(res, 500, { error: String(e && e.message || e) });
  }
});

function start() {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[print-agent] listening on http://127.0.0.1:${PORT}`);
    console.log(`[print-agent] caps: usb=${!!usbLib} ble=${!!nobleLib}`);
  });
}

module.exports = { start };

if (require.main === module) start();
