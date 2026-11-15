// SQLite stores JSON as stringified text. These helpers parse safely with a fallback.
export function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (value == null || value === "") return fallback;
  try {
    const v = JSON.parse(value);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function toJSON(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export const parseStrings = (v: string | null | undefined) => parseJSON<string[]>(v, []);
export const parseNumbers = (v: string | null | undefined) => parseJSON<number[]>(v, []);
export const parseWeights = (v: string | null | undefined) => parseJSON<Record<string, number>>(v, {});
