// Single AI provider layer. Everything AI-related in the app goes through these functions:
//   chatJSON<T>(system, user, schema)  → validated JSON from OpenAI / Anthropic (retries once)
//   embed(texts)                       → vectors (OpenAI text-embedding-3-small or local TF-IDF)
//   image(prompt)                      → optional flyer art (OpenAI image model) saved under /public/generated
//   runAI({...})                       → chatJSON + deterministic fallback + AiLog entry
import { z } from "zod";
import { chatModel, chatProvider, embeddingsProvider, imagesEnabled, type Provider } from "./config";
import { localEmbed, LOCAL_MODEL } from "./localEmbed";
import { logAi } from "./log";

const TIMEOUT_MS = 25_000;

async function fetchWithTimeout(url: string, init: RequestInit, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Pull the first JSON object/array out of a model reply (handles ```json fences and chatter). */
export function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  try {
    return JSON.parse(body);
  } catch {
    /* fall through */
  }
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in model output");
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return JSON.parse(body.slice(start, i + 1));
    }
  }
  throw new Error("Unterminated JSON in model output");
}

async function callChat(provider: Provider, model: string, system: string, user: string): Promise<string> {
  if (provider === "openai") {
    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? "";
  }
  if (provider === "anthropic") {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        temperature: 0.4,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (json.content ?? []).map((c) => c.text ?? "").join("");
  }
  throw new Error("mock provider has no chat endpoint");
}

/**
 * Ask the configured LLM for JSON and validate it with zod. Retries once on invalid JSON / schema
 * mismatch (feeding the error back), then throws so the caller can fall back.
 */
export async function chatJSON<T>(system: string, user: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const provider = chatProvider();
  if (provider === "mock") throw new Error("AI_PROVIDER=mock (or no API key)");
  const model = chatModel(provider);
  const sys = `${system}\n\nRespond with a single JSON object only. No markdown fences, no commentary.`;
  let lastErr: unknown = null;
  let prompt = user;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callChat(provider, model, sys, prompt);
      const parsed = schema.safeParse(extractJSON(text));
      if (parsed.success) return parsed.data;
      lastErr = new Error("Schema validation failed: " + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && /\b(401|403|404)\b/.test(e.message)) break; // auth/model errors won't fix themselves
    }
    prompt = `${user}\n\nYour previous reply was invalid (${String((lastErr as Error)?.message ?? lastErr).slice(0, 200)}). Return valid JSON exactly matching the requested shape.`;
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export type AIResult<T> = { data: T; usedFallback: boolean; provider: string; model: string; latencyMs: number };

/**
 * Run one AI feature: try the LLM, validate, otherwise use the deterministic fallback. Always logs.
 * The fallback output is validated with the same schema so the UI gets one shape either way.
 */
export async function runAI<T>(opts: {
  feature: string;
  system: string;
  user: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  fallback: () => T;
  inputSummary: string;
  summarize?: (t: T) => string;
}): Promise<AIResult<T>> {
  const t0 = Date.now();
  const provider = chatProvider();
  const model = chatModel(provider);
  let data: T;
  let usedFallback = false;
  let errNote = "";
  try {
    data = await chatJSON(opts.system, opts.user, opts.schema);
  } catch (e) {
    usedFallback = true;
    if (provider !== "mock") {
      errNote = ` [fallback: ${String((e as Error)?.message ?? e).slice(0, 120)}]`;
      console.warn(`[ai:${opts.feature}] falling back to template:`, (e as Error)?.message);
    }
    data = opts.schema.parse(opts.fallback());
  }
  const latencyMs = Date.now() - t0;
  const summary = opts.summarize ? opts.summarize(data) : JSON.stringify(data);
  await logAi({
    feature: opts.feature,
    provider: usedFallback ? "mock" : provider,
    model: usedFallback ? "template-mock" : model,
    inputSummary: opts.inputSummary,
    outputSummary: summary + errNote,
    latencyMs,
    usedFallback,
  });
  return { data, usedFallback, provider: usedFallback ? "mock" : provider, model: usedFallback ? "template-mock" : model, latencyMs };
}

/** Embed texts. OpenAI text-embedding-3-small when available, otherwise local hashed TF-IDF. */
export async function embed(texts: string[], opts: { feature?: string; log?: boolean } = {}): Promise<number[][]> {
  const t0 = Date.now();
  const want = embeddingsProvider();
  let vectors: number[][] | null = null;
  let usedFallback = false;
  let model = LOCAL_MODEL;
  let provider = "local";
  if (want === "openai" && texts.length) {
    try {
      const res = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: "text-embedding-3-small", input: texts.map((t) => t.slice(0, 8000)) }),
      });
      if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
      const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
      vectors = json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
      model = "text-embedding-3-small";
      provider = "openai";
    } catch (e) {
      console.warn("[ai:embed] falling back to local embeddings:", (e as Error)?.message);
      usedFallback = true;
    }
  }
  if (!vectors) vectors = texts.map((t) => localEmbed(t));
  if (opts.log !== false) {
    await logAi({
      feature: opts.feature ?? "embed",
      provider,
      model,
      inputSummary: `${texts.length} text(s): ${texts[0]?.slice(0, 120) ?? ""}`,
      outputSummary: `${vectors.length} vector(s) × ${vectors[0]?.length ?? 0} dims`,
      latencyMs: Date.now() - t0,
      usedFallback: usedFallback || provider === "local",
    });
  }
  return vectors;
}

export async function embedOne(text: string, feature?: string): Promise<number[]> {
  const [v] = await embed([text], { feature });
  return v;
}

/** Optional flyer art. Returns a public URL or null (the UI then renders a CSS gradient flyer). */
export async function image(prompt: string, fileId: string): Promise<string | null> {
  if (!imagesEnabled()) return null;
  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "low", n: 1 }),
      },
      60_000,
    );
    if (!res.ok) throw new Error(`OpenAI images ${res.status}`);
    const json = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
    const item = json.data?.[0];
    let url: string | null = null;
    if (item?.b64_json) {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const path = await import("node:path");
      const dir = path.join(process.cwd(), "public", "generated");
      await mkdir(dir, { recursive: true });
      const name = `${fileId}-${Date.now()}.png`;
      await writeFile(path.join(dir, name), Buffer.from(item.b64_json, "base64"));
      url = `/generated/${name}`;
    } else if (item?.url) url = item.url;
    await logAi({ feature: "flyerImage", provider: "openai", model: "gpt-image-1", inputSummary: prompt, outputSummary: url ?? "none", latencyMs: Date.now() - t0, usedFallback: false });
    return url;
  } catch (e) {
    await logAi({ feature: "flyerImage", provider: "mock", model: "css-gradient", inputSummary: prompt, outputSummary: `fallback to CSS gradient (${(e as Error).message})`, latencyMs: Date.now() - t0, usedFallback: true });
    return null;
  }
}
