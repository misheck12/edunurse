import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const SCRYPT_PREFIX = "scrypt";
const KEY_LENGTH = 64;

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const digest = derived.toString("base64url");
  return `${SCRYPT_PREFIX}$${salt}$${digest}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const parts = passwordHash.split("$");
  if (parts.length === 3 && parts[0] === SCRYPT_PREFIX) {
    const [, salt, digest] = parts;
    const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    const candidateDigest = derived.toString("base64url");
    return safeCompare(candidateDigest, digest);
  }

  // Backward-compatible fallback for legacy seeded users.
  return safeCompare(password, passwordHash);
}
