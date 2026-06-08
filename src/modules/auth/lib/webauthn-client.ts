/**
 * WebAuthn / FIDO2 client wrapper using native browser APIs.
 * Edge functions `auth-webauthn-{register,login}-{options,verify}` provide
 * the challenges + verification. Until Lovable Cloud responds, this module
 * exposes typed helpers ready to consume those endpoints.
 */

export const isWebAuthnSupported = (): boolean =>
  typeof window !== "undefined" &&
  !!window.PublicKeyCredential &&
  typeof navigator !== "undefined" &&
  !!navigator.credentials;

export const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

const b64urlToBuffer = (b64url: string): ArrayBuffer => {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
};

const bufferToB64url = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export interface RegisterOptionsJSON {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: Array<{ type: "public-key"; alg: number }>;
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  excludeCredentials?: Array<{ id: string; type: "public-key"; transports?: AuthenticatorTransport[] }>;
}

export const startRegistration = async (opts: RegisterOptionsJSON) => {
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...opts,
    challenge: b64urlToBuffer(opts.challenge),
    user: { ...opts.user, id: b64urlToBuffer(opts.user.id) },
    excludeCredentials: opts.excludeCredentials?.map((c) => ({
      ...c,
      id: b64urlToBuffer(c.id),
    })),
  };
  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("WebAuthn registration cancelled");
  const att = cred.response as AuthenticatorAttestationResponse;
  return {
    id: cred.id,
    rawId: bufferToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToB64url(att.clientDataJSON),
      attestationObject: bufferToB64url(att.attestationObject),
    },
  };
};

export interface AssertionOptionsJSON {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{ id: string; type: "public-key"; transports?: AuthenticatorTransport[] }>;
  userVerification?: UserVerificationRequirement;
}

export const startAuthentication = async (opts: AssertionOptionsJSON) => {
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...opts,
    challenge: b64urlToBuffer(opts.challenge),
    allowCredentials: opts.allowCredentials?.map((c) => ({
      ...c,
      id: b64urlToBuffer(c.id),
    })),
  };
  const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("WebAuthn authentication cancelled");
  const asr = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: bufferToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToB64url(asr.clientDataJSON),
      authenticatorData: bufferToB64url(asr.authenticatorData),
      signature: bufferToB64url(asr.signature),
      userHandle: asr.userHandle ? bufferToB64url(asr.userHandle) : null,
    },
  };
};
