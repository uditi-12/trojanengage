import { cookies, headers } from "next/headers";
import { sign, verifySigned } from "./auth";
import { HttpError } from "./errors";

export const SESSION_COOKIE = "trojanengage_session";
export type Session = { role: "student" | "org"; id: string } | null;

/**
 * Cookie formats:
 *   student:<id>.<hmac>  — set only by /api/auth/login or /api/auth/signup (signed, cannot be forged)
 *   org:<id>             — demo org switcher (orgs have no login in this hackathon build)
 */
export function parseSession(raw: string | undefined | null): Session {
  if (!raw) return null;
  const value = decodeURIComponent(raw);
  const idx = value.indexOf(":");
  if (idx < 0) return null;
  const role = value.slice(0, idx);
  const rest = value.slice(idx + 1);
  if (role === "org" && rest) return { role, id: rest };
  if (role === "student") {
    const dot = rest.lastIndexOf(".");
    if (dot < 0) return null;
    const id = rest.slice(0, dot);
    const sig = rest.slice(dot + 1);
    if (id && verifySigned(`student:${id}`, sig)) return { role, id };
  }
  return null;
}

/** Cookie (web/PWA) or `Authorization: Bearer <token>` (Expo mobile app). */
export function getSession(): Session {
  let auth: string | null = null;
  try {
    auth = headers().get("authorization");
  } catch {
    auth = null;
  }
  if (auth?.startsWith("Bearer ")) {
    const s = parseSession(auth.slice(7).trim());
    if (s) return s;
  }
  return parseSession(cookies().get(SESSION_COOKIE)?.value);
}

export function encodeSession(s: { role: "student" | "org"; id: string }) {
  if (s.role === "student") return `student:${s.id}.${sign(`student:${s.id}`)}`;
  return `org:${s.id}`;
}

export const ONE_YEAR = 60 * 60 * 24 * 365;
/** Stay signed in for a year by default (refreshed on every visit by middleware). */
export function setSessionCookie(s: { role: "student" | "org"; id: string }, remember = true) {
  cookies().set(SESSION_COOKIE, encodeSession(s), { path: "/", httpOnly: true, sameSite: "lax", ...(remember ? { maxAge: ONE_YEAR } : {}) });
  return encodeSession(s);
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
}

/** Throws 401 unless a logged-in student is present (and, if given, matches `id`). */
export function requireStudent(id?: string): string {
  const s = getSession();
  if (s?.role !== "student") throw new HttpError(401, "Please log in as a student.");
  if (id && s.id !== id) throw new HttpError(403, "You can only access your own account.");
  return s.id;
}

/** Throws 401 unless the current role is the given org. */
export function requireOrg(id?: string): string {
  const s = getSession();
  if (s?.role !== "org") throw new HttpError(401, "Switch to an org to use this.");
  if (id && s.id !== id) throw new HttpError(403, "That belongs to another org.");
  return s.id;
}
