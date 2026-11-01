import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const encoded = process.env.CONNECTIONS_KEY?.trim();
  if (!encoded) {
    throw new Error("CONNECTIONS_KEY is required and must be a base64-encoded 32-byte key.");
  }
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length !== 32 || decoded.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
    throw new Error("CONNECTIONS_KEY must be valid base64 that decodes to exactly 32 bytes.");
  }
  return decoded;
}

export function encrypt(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Connection secret must be JSON-serializable.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decrypt<T>(encoded: string): T {
  const [version, iv64, tag64, ciphertext64, extra] = encoded.split(":");
  if (version !== "v1" || !iv64 || !tag64 || ciphertext64 === undefined || extra !== undefined) {
    throw new Error("Connection secret has an unsupported or invalid encrypted format.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv64, "base64"));
    decipher.setAuthTag(Buffer.from(tag64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext64, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CONNECTIONS_KEY")) throw error;
    throw new Error("Connection secret could not be decrypted. Check CONNECTIONS_KEY.", { cause: error });
  }
}
