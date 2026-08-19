import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const KEY = Buffer.from(process.env.EMAIL_ENC_KEY ?? "", "base64");

function assertKey() {
  if (!process.env.EMAIL_ENC_KEY || KEY.length !== 32) {
    throw new Error("EMAIL_ENC_KEY is missing or invalid (expected a 32-byte base64 key)");
  }
}

export function encryptSecret(plaintext: string): string {
  assertKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  assertKey();
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}