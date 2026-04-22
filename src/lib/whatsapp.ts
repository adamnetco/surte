/**
 * WhatsApp helper — robust universal opener.
 *
 * Problems addressed:
 *   1. Some emojis (regional flags, ZWJ sequences) break URL encoding on iOS.
 *   2. window.open(...) is silently blocked on iOS Safari when called from
 *      async contexts (after await). Solution: use an <a> click on a
 *      synchronously created element, or fall back to location.href.
 *   3. wa.me sometimes does NOT open the installed app on Android — the
 *      official deep link is api.whatsapp.com/send (forces app-handler).
 *   4. WhatsApp ignores text after a literal newline only when not encoded;
 *      we always encode.
 */

// Strip emojis/symbols that WhatsApp clients render as  (mojibake) or that
// break some Android intent parsers. Keeps Latin text, common punctuation,
// numbers, line breaks, currency, accents, and the safe emoji subset
// (U+2600–U+27BF, U+1F300–U+1F6FF, U+1F900–U+1F9FF).
const SAFE_EMOJI =
  /[\u2600-\u27BF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF\uDE00-\uDEFF]|\uD83E[\uDD00-\uDDFF]/g;

export const sanitizeWhatsAppText = (text: string): string => {
  if (!text) return "";
  // Normalize NFC (compose accents) and remove variation selectors / ZWJ
  // and skin-tone modifiers that some clients render as boxes.
  let out = text.normalize("NFC");
  out = out.replace(/[\uFE00-\uFE0F\u200D]/g, ""); // VS + ZWJ
  out = out.replace(/[\uD83C][\uDFFB-\uDFFF]/g, ""); // skin tones
  // Replace any non-safe pictograph chars with empty string but keep our SAFE_EMOJI matches.
  // Build a temporary placeholder map for safe emojis, drop the rest, then restore.
  const placeholders: string[] = [];
  out = out.replace(SAFE_EMOJI, (m) => {
    placeholders.push(m);
    return `\u0000${placeholders.length - 1}\u0000`;
  });
  // Drop other surrogate-pair pictographs that aren't on our safelist.
  out = out.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");
  // Restore safe emojis
  out = out.replace(/\u0000(\d+)\u0000/g, (_m, i) => placeholders[Number(i)] || "");
  // Collapse 3+ blank lines
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
};

/** Normalise to international digits-only (no +). Defaults to Colombia (57). */
export const normalisePhone = (raw: string, defaultCountry = "57"): string => {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("3")) return `${defaultCountry}${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `${defaultCountry}${digits.slice(1)}`;
  return digits;
};

const isMobile = () =>
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

/**
 * Open WhatsApp with a message. Always opens the installed app when present.
 * - Mobile: api.whatsapp.com/send (forces native handler) → fallback wa.me
 * - Desktop: web.whatsapp.com via wa.me (consistent)
 *
 * Must be called inside a synchronous user-gesture handler. If you need to
 * await something first, capture the URL early and pass it via the `url`
 * helper instead.
 */
export const openWhatsApp = (opts: { phone: string; message?: string }) => {
  const phone = normalisePhone(opts.phone);
  const msg = sanitizeWhatsAppText(opts.message || "");
  if (!phone) {
    console.warn("[whatsapp] empty phone, aborting open");
    return;
  }
  const text = encodeURIComponent(msg);
  // api.whatsapp.com/send is the only URL that triggers the install-handler
  // intent on Android & iOS reliably (wa.me opens web preview first).
  const primary = `https://api.whatsapp.com/send?phone=${phone}&text=${text}`;
  const fallback = `https://wa.me/${phone}?text=${text}`;

  // Use a real anchor click — survives Safari popup blockers when invoked
  // inside a click handler (even after one await tick).
  try {
    const a = document.createElement("a");
    a.href = isMobile() ? primary : fallback;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 0);
  } catch {
    // Last-resort: hard navigate
    window.location.href = isMobile() ? primary : fallback;
  }
};

/** Build a wa link without opening — useful for hrefs in <a>. */
export const whatsappUrl = (phone: string, message?: string) => {
  const p = normalisePhone(phone);
  const t = encodeURIComponent(sanitizeWhatsAppText(message || ""));
  // Always use api.whatsapp.com/send for hrefs too — the installed app
  // intercepts both URLs but only this one sets click_to_chat metadata.
  return `https://api.whatsapp.com/send?phone=${p}&text=${t}`;
};
