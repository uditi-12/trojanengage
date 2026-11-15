// API client for the TrojanEngage backend. Auth uses the same signed session token as the web app, sent as
// `Authorization: Bearer <token>` and kept in the device keychain so students stay signed in.
import * as SecureStore from "expo-secure-store";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
const TOKEN_KEY = "trojanengage_token";
let token: string | null = null;

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}
export async function saveToken(t: string | null) {
  token = t;
  if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public data: unknown) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(API_URL + path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) throw new ApiError(res.status, data?.issues?.[0]?.message || data?.error || `Request failed (${res.status})`, data);
  return data as T;
}

export type Me = { id: string; name: string; email?: string; avatarUrl: string; major: string; year: string; onboarded: boolean };
export type Conflict = { kind: string; title: string; when: string };
export type Event = {
  id: string;
  title: string;
  description: string;
  flyerHeadline: string;
  flyerTagline: string;
  cardBlurb: string;
  flyerColor: string;
  date: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  location: string;
  campus: string;
  format: string;
  foodType: string;
  ticketCost: number;
  capacity: number;
  eventType: string;
  status: string;
  tags: string[];
  restrictions: string[];
  agenda: { time: string; title: string; day?: string }[];
  org?: { name: string } | null;
};
export type Ranked = Event & { matchPct: number; rankPos: number; why: string; conflicts: Conflict[]; friendsGoing: { id: string; name: string }[]; isNew: boolean };
export type Block = { id: string; kind: string; source: string; title: string; location: string; day: number; start: string; end: string; editable: boolean };
