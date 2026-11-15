// Minimal, dependency-free auth for students: scrypt password hashes + HMAC-signed session cookie.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SECRET = () => process.env.AUTH_SECRET || "trojanengage-dev-secret-change-me";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sign(value: string): string {
  return createHmac("sha256", SECRET()).update(value).digest("base64url");
}

export function verifySigned(value: string, sig: string): boolean {
  const expected = Buffer.from(sign(value));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
