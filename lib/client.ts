"use client";
// Browser-side fetch helper: JSON in/out, throws with the API's error message.
export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const d = data as { error?: string; issues?: { path: (string | number)[]; message: string }[] } | null;
    const issue = d?.issues?.[0];
    throw new Error(issue ? `${issue.path.join(".")}: ${issue.message}` : d?.error || `Request failed (${res.status})`);
  }
  return data as T;
}
