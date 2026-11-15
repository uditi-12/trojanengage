// Local, dependency-free embedding: a hashed TF-IDF / bag-of-words vectorizer.
// - tokens: lowercase words (stopwords removed) + bigrams, hashed into DIM buckets
// - sublinear TF (1 + log tf), with a static IDF-like weight (longer / rarer-looking tokens weigh more)
// - taxonomy expansion: keywords that imply a tag add a strong "tag:<x>" feature, so
//   "PyTorch hands-on night" and "ML workshop" land near each other
// - L2-normalised so cosine similarity == dot product
import { keywordTags } from "../taxonomy";

export const LOCAL_DIM = 384;
export const LOCAL_MODEL = "local-tfidf-384";

const STOP = new Set(
  "a an and are as at be by for from has have in into is it its of on or our that the their this to was we were will with you your us join come all any can get more about what who how out up".split(
    " ",
  ),
);

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#\- ]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function stem(t: string): string {
  if (t.length > 5 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

export function localEmbed(text: string, dim = LOCAL_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  const toks = tokenize(text).map(stem);
  const tf = new Map<string, number>();
  const add = (k: string, w = 1) => tf.set(k, (tf.get(k) ?? 0) + w);
  toks.forEach((t, i) => {
    add(t);
    if (i > 0) add(toks[i - 1] + "_" + t, 0.5);
  });
  for (const tag of keywordTags(text, 8)) add("tag:" + tag, 2.5);
  for (const [k, count] of Array.from(tf.entries())) {
    const idf = k.startsWith("tag:") ? 1.5 : 1 + Math.min(k.length, 12) / 12;
    const w = (1 + Math.log(count)) * idf;
    const h = fnv1a(k);
    const sign = h & 1 ? 1 : -1;
    vec[h % dim] += sign * w;
    vec[(h >>> 8) % dim] += sign * w * 0.5; // second hash reduces collision damage
  }
  return normalize(vec);
}

export function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (!n) return v.map(() => 0);
  return v.map((x) => x / n);
}

export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

/**
 * Similarity that survives a vector-space mismatch (e.g. data seeded with local vectors,
 * then an OpenAI key was added). If sizes differ, re-embed both texts locally.
 */
export function similarity(a: number[], b: number[], aText: string, bText: string): number {
  if (a?.length && b?.length && a.length === b.length) return cosine(a, b);
  return cosine(localEmbed(aText), localEmbed(bText));
}
