// Cálculo del dígito de verificación (DV) del NIT según algoritmo DIAN.
// Pesos oficiales (de izquierda a derecha sobre NIT alineado a 15 dígitos).
const WEIGHTS = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];

export function calculateNitDv(nit: string): number | null {
  const digits = (nit ?? "").replace(/\D/g, "");
  if (digits.length === 0 || digits.length > 15) return null;
  const padded = digits.padStart(15, "0");
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    sum += parseInt(padded[i], 10) * WEIGHTS[i];
  }
  const mod = sum % 11;
  return mod < 2 ? mod : 11 - mod;
}

export function isValidNitDv(nit: string, dv: string | number): boolean {
  const expected = calculateNitDv(nit);
  if (expected === null) return false;
  return String(expected) === String(dv).trim();
}
