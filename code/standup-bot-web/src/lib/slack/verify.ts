const MAX_AGE_SECONDS = 60 * 5;

export type SlackSignatureInput = {
  signingSecret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowSeconds?: number;
};

export async function verifySlackSignature(input: SlackSignatureInput): Promise<boolean> {
  const { signingSecret, timestamp, signature, rawBody } = input;
  if (!signingSecret || !timestamp || !signature?.startsWith("v0=")) return false;

  const ts = Number(timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(ts) || Math.abs(now - ts) > MAX_AGE_SECONDS) return false;

  const expected = hexToBytes(signature.slice(3));
  if (!expected) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  // subtle.verify compares in constant time, unlike comparing hex strings.
  return crypto.subtle.verify("HMAC", key, expected, encoder.encode(`v0:${timestamp}:${rawBody}`));
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length !== 64 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
