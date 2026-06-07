// Driver Web Bluetooth para impresoras térmicas ESC/POS (Bixolon SPP, Xprinter, MTP, Goojprt).
// Requiere HTTPS + acción del usuario para requestDevice(). Soportado en Chrome/Edge desktop y Android.
//
// La mayoría de térmicas BLE exponen un servicio "Serial Port" propietario:
//   - Servicio genérico Nordic UART:  6e400001-b5a3-f393-e0a9-e50e24dcca9e
//                    rx (write):     6e400002-b5a3-f393-e0a9-e50e24dcca9e
//   - Servicio Xprinter / 18f0:      000018f0-0000-1000-8000-00805f9b34fb
//                    write:          00002af1-0000-1000-8000-00805f9b34fb
// Probamos en orden y caemos al primero que responda.

const CANDIDATE_SERVICES: Array<{ service: BluetoothServiceUUID; write: BluetoothCharacteristicUUID }> = [
  { service: "000018f0-0000-1000-8000-00805f9b34fb", write: "00002af1-0000-1000-8000-00805f9b34fb" },
  { service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", write: "6e400002-b5a3-f393-e0a9-e50e24dcca9e" },
  { service: "e7810a71-73ae-499d-8c15-faa9aef0c3f2", write: "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f" }, // BlueBamboo
];

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).bluetooth;
}

export interface BtPrinterHandle {
  device: any;
  send: (data: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
}

export async function requestBluetoothPrinter(): Promise<any> {
  if (!isWebBluetoothSupported()) throw new Error("Web Bluetooth no disponible en este navegador. Usa Chrome o Edge.");
  // @ts-expect-error - tipos Web Bluetooth no incluidos por defecto
  const device: any = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: CANDIDATE_SERVICES.map((s) => s.service),
  });
  return device;
}

export async function openBluetoothPrinter(device: any): Promise<BtPrinterHandle> {
  const server = await device.gatt!.connect();
  let writeChar: any = null;
  let lastErr: any = null;

  for (const cand of CANDIDATE_SERVICES) {
    try {
      const svc = await server.getPrimaryService(cand.service);
      writeChar = await svc.getCharacteristic(cand.write);
      if (writeChar) break;
    } catch (e) { lastErr = e; }
  }
  if (!writeChar) {
    try { device.gatt?.disconnect(); } catch {}
    throw new Error(`No se encontró servicio compatible ESC/POS BLE en "${device.name ?? "dispositivo"}". ${lastErr?.message ?? ""}`);
  }

  const CHUNK = 180; // BLE MTU típico ~ 185
  return {
    device,
    send: async (data: Uint8Array) => {
      for (let i = 0; i < data.length; i += CHUNK) {
        const chunk = data.slice(i, i + CHUNK);
        // writeValueWithoutResponse acelera significativamente la impresión
        if (writeChar.writeValueWithoutResponse) {
          await writeChar.writeValueWithoutResponse(chunk);
        } else {
          await writeChar.writeValue(chunk);
        }
      }
    },
    close: async () => {
      try { device.gatt?.disconnect(); } catch {}
    },
  };
}

export async function printOnceBluetooth(device: any, data: Uint8Array) {
  const h = await openBluetoothPrinter(device);
  try { await h.send(data); } finally { await h.close(); }
}
