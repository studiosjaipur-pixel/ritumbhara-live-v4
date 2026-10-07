// Minimal TwiML responses for Twilio webhooks (Week 5 stretch). No business logic.
// Every piece of dynamic text goes through escapeXml(), so the output is always well-formed XML.

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

// Escapes the five XML special characters and removes characters that are not allowed in XML 1.0
// (control characters other than tab/newline/carriage return, unpaired surrogates, U+FFFE/U+FFFF).
function stripInvalidXmlChars(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { out += text.charAt(i) + text.charAt(i + 1); i++; }
      continue; // unpaired high surrogate
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue; // unpaired low surrogate
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0xfffe || c === 0xffff) continue;
    out += text.charAt(i);
  }
  return out;
}

export function escapeXml(text: string): string {
  return stripInvalidXmlChars(String(text == null ? "" : text))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// TwiML string with exactly one reply message.
export function twimlMessageXml(text: string): string {
  return XML_HEADER + "<Response><Message>" + escapeXml(text) + "</Message></Response>";
}

// TwiML string with no reply (Twilio sends nothing back to the sender).
export function twimlEmptyXml(): string {
  return XML_HEADER + "<Response></Response>";
}

// Response for a Next.js route handler: one WhatsApp reply message.
export function twimlMessage(text: string): Response {
  return twimlResponse(twimlMessageXml(text));
}

// Response for a Next.js route handler: acknowledge the webhook without replying.
export function twimlEmpty(): Response {
  return twimlResponse(twimlEmptyXml());
}
