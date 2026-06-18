// POS-tenant-keypair-parity
// Shared helper: generate + persist an Ed25519 keypair for a tenant organization.
// Private key is stored encrypted with AUTH_ENCRYPTION_KEY (same AES-GCM packed
// format as supabase/functions/_shared/auth-crypto.ts → encryptSecret).
//
// Usage from an edge function (must use the service-role client):
//   import { ensureTenantKeypair } from "../_shared/tenant-keys.ts";
//   await ensureTenantKeypair(admin, organization_id);

import { encryptSecret, decryptSecret } from "./auth-crypto.ts";

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type TenantKeypair = {
  signing_key_id: string;
  public_key_b64: string;          // raw Ed25519 public key, base64
  private_key_encrypted: string;   // PKCS8 private key, base64 → encrypted with AUTH_ENCRYPTION_KEY
};

/**
 * Generate a fresh Ed25519 keypair and return the public key + encrypted private key.
 * Does NOT touch the database. Caller persists the result.
 */
export async function generateTenantKeypair(): Promise<TenantKeypair> {
  const kp = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;

  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const privatePkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));

  const public_key_b64 = bytesToB64(publicRaw);
  const private_key_encrypted = await encryptSecret(bytesToB64(privatePkcs8));
  const signing_key_id = crypto.randomUUID();

  return { signing_key_id, public_key_b64, private_key_encrypted };
}

/**
 * Ensure the given organization has a signing keypair. If one already exists
 * (signing_public_key is set), returns { created: false }. Otherwise generates,
 * persists and returns { created: true, ... }.
 *
 * Requires a Supabase client with service-role privileges.
 */
export async function ensureTenantKeypair(
  admin: any,
  organization_id: string,
): Promise<{ created: boolean; signing_key_id: string | null; error?: string }> {
  const { data: org, error: readErr } = await admin
    .from("organizations")
    .select("id, signing_public_key, signing_key_id")
    .eq("id", organization_id)
    .maybeSingle();

  if (readErr) return { created: false, signing_key_id: null, error: readErr.message };
  if (!org) return { created: false, signing_key_id: null, error: "org_not_found" };
  if (org.signing_public_key) {
    return { created: false, signing_key_id: org.signing_key_id ?? null };
  }

  const kp = await generateTenantKeypair();
  const { error: updErr } = await admin
    .from("organizations")
    .update({
      signing_public_key: kp.public_key_b64,
      signing_private_key_encrypted: kp.private_key_encrypted,
      signing_key_id: kp.signing_key_id,
      signing_key_created_at: new Date().toISOString(),
    })
    .eq("id", organization_id);

  if (updErr) return { created: false, signing_key_id: null, error: updErr.message };
  return { created: true, signing_key_id: kp.signing_key_id };
}

/**
 * Load the tenant's private signing key as a usable CryptoKey for signing.
 * Returns null if the org has no keypair yet (callers should fall back or fail explicitly).
 */
export async function loadTenantSigningKey(
  admin: any,
  organization_id: string,
): Promise<{ signing_key_id: string; privateKey: CryptoKey; publicKeyB64: string } | null> {
  const { data: org } = await admin
    .from("organizations")
    .select("signing_public_key, signing_private_key_encrypted, signing_key_id")
    .eq("id", organization_id)
    .maybeSingle();

  if (!org?.signing_public_key || !org?.signing_private_key_encrypted) return null;

  const pkcs8B64 = await decryptSecret(org.signing_private_key_encrypted);
  const pkcs8 = b64ToBytes(pkcs8B64);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  return {
    signing_key_id: org.signing_key_id,
    privateKey,
    publicKeyB64: org.signing_public_key,
  };
}
