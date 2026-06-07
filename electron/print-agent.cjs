// SURTÉ YA Print Agent — agente local embebido en Electron.
// Expone http://127.0.0.1:9101 para que el navegador delegue impresión LAN/USB,
// y opcionalmente se suscribe a print_jobs vía Supabase Realtime para procesar la cola.
//
// MVP: enrutamiento LAN (TCP 9100) usando node:net (sin dependencias nativas).
// USB nativo y Bluetooth quedan disponibles vía WebUSB/WebBluetooth desde el navegador.

const http = require("node:http");
const net = require("node:net");
const os = require("node:os");

const PORT = Number(process.env.SURTEYA_PRINT_AGENT_PORT || 9101);
const SUPA_URL = process.env.SURTEYA_SUPA_URL || "";
const SUPA_ANON = process.env.SURTEYA_SUPA_ANON || "";

function b64ToBuf(b64) { return Buffer.from(b64, "base64"); }

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
        // Pequeña espera para vaciar buffer antes de cerrar
        setTimeout(() => finish(null), 200);
      });
    });
  });
}

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

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  try {
    if (req.url === "/health") return sendJson(res, 200, { ok: true, version: 1, host: os.hostname() });

    if (req.url === "/print" && req.method === "POST") {
      const body = await readBody(req);
      const { connection, ip_address, port, escpos_b64, open_drawer } = body || {};
      if (!escpos_b64) return sendJson(res, 400, { error: "missing escpos_b64" });
      const bytes = b64ToBuf(escpos_b64);
      if (connection === "lan") {
        if (!ip_address) return sendJson(res, 400, { error: "missing ip_address" });
        await sendToLan(ip_address, Number(port || 9100), bytes);
        return sendJson(res, 200, { ok: true, bytes: bytes.length });
      }
      if (connection === "usb") {
        // USB nativo no implementado en el agente (mantiene cero deps nativas).
        // El navegador debe imprimir directamente por WebUSB.
        return sendJson(res, 501, { error: "usb_native_not_supported_use_webusb" });
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
  });
}

module.exports = { start };

if (require.main === module) start();
