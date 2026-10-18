import crypto from "crypto";

// HMAC-SHA256 over the raw request body, keyed with your Nomba client
// secret. Header name per Nomba's SDK documentation -- confirm against
// your actual sandbox webhook delivery before trusting this in production.
export function verifyNombaSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  const secret = process.env.NOMBA_CLIENT_SECRET as string;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}