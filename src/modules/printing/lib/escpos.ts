// Builder ESC/POS para impresoras térmicas 58/80mm.
// Genera Uint8Array con los bytes a enviar por WebUSB / Web Serial / TCP 9100.
//
// Referencias: Epson ESC/POS Command Reference, comandos universales soportados por
// Xprinter, Bixolon, Star, 3nStar y la mayoría de clones chinos.

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export type Align = "left" | "center" | "right";
export type Width = 32 | 42 | 48; // 58mm=32, 80mm normal=48, 80mm condensado=42

export interface EscPosBuilderOptions {
  width?: Width;
  codepage?: "CP858" | "CP437" | "LATIN1";
}

/**
 * Convierte texto UTF-8 a CP858 (incluye ñ, tildes, €).
 * Mapeo mínimo de los caracteres latinos más usados en español-CO.
 */
function utf8ToCp858(s: string): Uint8Array {
  const map: Record<string, number> = {
    "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85,
    "ç": 0x87, "ê": 0x88, "ë": 0x89, "è": 0x8a, "ï": 0x8b, "î": 0x8c, "ì": 0x8d,
    "Ä": 0x8e, "É": 0x90, "ô": 0x93, "ö": 0x94, "ò": 0x95, "û": 0x96, "ù": 0x97,
    "Ö": 0x99, "Ü": 0x9a, "ø": 0x9b, "£": 0x9c, "Ø": 0x9d, "×": 0x9e,
    "á": 0xa0, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5,
    "¿": 0xa8, "¡": 0xad, "«": 0xae, "»": 0xaf, "€": 0xd5,
    "Á": 0xb5, "Â": 0xb6, "À": 0xb7, "Ã": 0xc6, "ã": 0xc7,
    "Ê": 0xd2, "Ë": 0xd3, "È": 0xd4, "Í": 0xd6, "Î": 0xd7, "Ï": 0xd8,
    "Ó": 0xe0, "ß": 0xe1, "Ô": 0xe2, "Ò": 0xe3, "õ": 0xe4, "Õ": 0xe5,
    "µ": 0xe6, "Ú": 0xe9, "Û": 0xea, "Ù": 0xeb, "ý": 0xec, "Ý": 0xed,
  };
  const out: number[] = [];
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) { out.push(code); continue; }
    if (map[ch] != null) { out.push(map[ch]); continue; }
    out.push(0x3f); // '?' para caracteres no representables
  }
  return new Uint8Array(out);
}

export class EscPosBuilder {
  private chunks: Uint8Array[] = [];
  readonly width: Width;
  readonly codepage: string;

  constructor(opts: EscPosBuilderOptions = {}) {
    this.width = opts.width ?? 48;
    this.codepage = opts.codepage ?? "CP858";
  }

  private push(...bytes: number[]) { this.chunks.push(new Uint8Array(bytes)); return this; }
  private pushBuf(buf: Uint8Array) { this.chunks.push(buf); return this; }

  init() {
    this.push(ESC, 0x40);            // ESC @ - Initialize
    this.push(ESC, 0x74, 0x13);      // ESC t 19 - CP858 (PC858 Multilingual Latin1 + €)
    return this;
  }

  align(a: Align) {
    const n = a === "left" ? 0 : a === "center" ? 1 : 2;
    return this.push(ESC, 0x61, n);
  }

  bold(on: boolean) { return this.push(ESC, 0x45, on ? 1 : 0); }
  underline(on: boolean) { return this.push(ESC, 0x2d, on ? 1 : 0); }
  invert(on: boolean) { return this.push(GS, 0x42, on ? 1 : 0); }

  /** size: 1=normal, 2=doble, 3=triple */
  size(w: 1 | 2 | 3, h: 1 | 2 | 3 = w) {
    const n = ((w - 1) << 4) | (h - 1);
    return this.push(GS, 0x21, n);
  }

  text(s: string) { return this.pushBuf(utf8ToCp858(s)); }
  line(s = "") { return this.text(s).push(LF); }

  /** Línea de dos columnas: izquierda + derecha alineadas al ancho. */
  twoCol(left: string, right: string) {
    const total = this.width;
    const r = right.slice(0, total);
    const space = Math.max(1, total - left.length - r.length);
    const l = space < 1 ? left.slice(0, total - r.length - 1) : left;
    return this.line(l + " ".repeat(Math.max(1, total - l.length - r.length)) + r);
  }

  separator(ch = "-") { return this.line(ch.repeat(this.width)); }

  feed(n = 1) { return this.push(ESC, 0x64, n); }

  /** Apertura cajón monedero. pin: 2 o 5. */
  openDrawer(pin: 2 | 5 = 2) {
    return this.push(ESC, 0x70, pin === 5 ? 1 : 0, 50, 250);
  }

  /** Corte de papel (parcial). */
  cut(partial = true) {
    this.feed(3);
    return this.push(GS, 0x56, partial ? 1 : 0);
  }

  /** QR code (modelo 2). */
  qr(data: string, size = 6) {
    const bytes = utf8ToCp858(data);
    // Modelo
    this.push(GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00);
    // Tamaño
    this.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, size);
    // Corrección de error
    this.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x30);
    // Almacenar datos
    const len = bytes.length + 3;
    this.push(GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30);
    this.pushBuf(bytes);
    // Imprimir
    this.push(GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30);
    return this;
  }

  /** Ensambla todos los chunks en un único Uint8Array. */
  build(): Uint8Array {
    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of this.chunks) { out.set(c, off); off += c.length; }
    return out;
  }

  /** Codifica el buffer en base64 (para guardar en print_jobs.escpos_b64). */
  toBase64(): string {
    const u8 = this.build();
    let bin = "";
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return typeof btoa === "function" ? btoa(bin) : Buffer.from(u8).toString("base64");
  }
}

export function charsForWidth(mm: number): Width {
  if (mm <= 48) return 32;
  if (mm <= 58) return 32;
  return 48;
}
