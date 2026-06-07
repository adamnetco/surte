// Driver WebUSB para impresoras térmicas ESC/POS.
// Requiere HTTPS + acción del usuario (botón) para llamar requestDevice().

const KNOWN_VENDORS = [
  0x04b8, // Epson
  0x0519, // Star Micronics
  0x0483, // STMicro / Xprinter
  0x1504, // Bixolon
  0x0fe6, // ICS Advent / 3nStar
  0x154f, // 4nStar
  0x067b, // Prolific (cable serie a térmica)
  0x28e9, // GD32 / clones
  0x1fc9, // NXP
  0x0dd4, // Custom Engineering
];

export interface UsbPrinterHandle {
  device: USBDevice;
  endpointOut: number;
  send: (data: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as any).usb;
}

export async function requestUsbPrinter(): Promise<USBDevice> {
  if (!isWebUsbSupported()) throw new Error("WebUSB no disponible en este navegador. Usa Chrome o Edge.");
  // @ts-expect-error - tipos WebUSB no incluidos por defecto
  const device: USBDevice = await navigator.usb.requestDevice({
    filters: KNOWN_VENDORS.map((vendorId) => ({ vendorId })),
  });
  return device;
}

export async function openUsbPrinter(device: USBDevice): Promise<UsbPrinterHandle> {
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  const iface = device.configuration!.interfaces[0];
  await device.claimInterface(iface.interfaceNumber);

  // Buscar primer endpoint OUT
  const alt = iface.alternates[0];
  const out = alt.endpoints.find((e) => e.direction === "out");
  if (!out) throw new Error("La impresora no tiene endpoint OUT");
  const endpointOut = out.endpointNumber;

  return {
    device,
    endpointOut,
    send: async (data: Uint8Array) => {
      // Chunked para impresoras con buffer pequeño
      const chunkSize = 4096;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await device.transferOut(endpointOut, chunk);
      }
    },
    close: async () => {
      try { await device.releaseInterface(iface.interfaceNumber); } catch { /* */ }
      try { await device.close(); } catch { /* */ }
    },
  };
}

export async function listAuthorizedUsbPrinters(): Promise<USBDevice[]> {
  if (!isWebUsbSupported()) return [];
  // @ts-expect-error - WebUSB
  return await navigator.usb.getDevices();
}

/** Imprime un buffer y cierra la conexión. */
export async function printOnceUsb(device: USBDevice, data: Uint8Array) {
  const handle = await openUsbPrinter(device);
  try {
    await handle.send(data);
  } finally {
    await handle.close();
  }
}
