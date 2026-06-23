// AES-GCM encrypt/decrypt using AUTH_ENCRYPTION_KEY (32-byte base64).
// Plus TOTP (RFC 6238) and recovery code helpers.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("AUTH_ENCRYPTION_KEY");
  if (!raw) throw new Error("AUTH_ENCRYPTION_KEY missing");
  let keyBytes = b64ToBytes(raw);
  if (keyBytes.length !== 32) {
    // Derive deterministic 32 bytes via SHA-256 fallback
    const h = await crypto.subtle.digest("SHA-256", enc.encode(raw));
    keyBytes = new Uint8Array(h);
  }
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return "v1:" + bytesToB64(out);
}

export async function decryptSecret(packed: string): Promise<string> {
  if (!packed.startsWith("v1:")) throw new Error("bad_secret_format");
  const buf = b64ToBytes(packed.slice(3));
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const key = await getKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}

// ----- TOTP RFC 6238 -----
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function generateTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

export async function totpCode(secretB32: string, step = 30, digits = 6, t = Date.now()): Promise<string> {
  const counter = Math.floor(t / 1000 / step);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(4, counter, false);
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secretB32),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const offset = sig[sig.length - 1] & 0xf;
  const bin =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export async function totpVerify(secretB32: string, code: string, window = 1): Promise<boolean> {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const now = Date.now();
  for (let w = -window; w <= window; w++) {
    const candidate = await totpCode(secretB32, 30, 6, now + w * 30_000);
    if (candidate === clean) return true;
  }
  return false;
}

export function otpauthUri(label: string, secretB32: string, issuer = "SistecPOS"): string {
  const enc = encodeURIComponent;
  return `otpauth://totp/${enc(issuer)}:${enc(label)}?secret=${secretB32}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ----- Recovery codes -----
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < count; i++) {
    const buf = crypto.getRandomValues(new Uint8Array(10));
    let s = "";
    for (const b of buf) s += alphabet[b % alphabet.length];
    codes.push(`${s.slice(0, 5)}-${s.slice(5)}`);
  }
  return codes;
}

export async function hashRecovery(code: string): Promise<string> {
  const norm = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const h = await crypto.subtle.digest("SHA-256", enc.encode(norm));
  return bytesToB64(new Uint8Array(h));
}

// ----- Signed challenge tokens (stateless, HMAC-SHA256) -----
async function hmacKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("AUTH_ENCRYPTION_KEY") ?? "fallback-key";
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(raw + "|hmac"));
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function b64urlFromBytes(b: Uint8Array): string {
  return bytesToB64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signChallenge(payload: { challenge: string; email: string; type: "register" | "login"; ttlSec?: number }): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + (payload.ttlSec ?? 300);
  const body = `${payload.challenge}.${payload.email.toLowerCase()}.${payload.type}.${exp}`;
  const key = await hmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return body + "." + b64urlFromBytes(sig);
}

export async function verifyChallenge(token: string, email: string, type: "register" | "login"): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [challenge, em, ty, expStr, sig] = parts;
  if (em !== email.toLowerCase() || ty !== type) return null;
  if (Number(expStr) * 1000 < Date.now()) return null;
  const body = `${challenge}.${em}.${ty}.${expStr}`;
  const key = await hmacKey();
  const ok = await crypto.subtle.verify("HMAC", key, b64ToBytes(sig.replace(/-/g, "+").replace(/_/g, "/") + "==="), enc.encode(body));
  return ok ? challenge : null;
}
