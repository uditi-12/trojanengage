import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

export function round(n: number, digits = 2) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}
