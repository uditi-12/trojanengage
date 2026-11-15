import { DAYS, DAYS_LONG } from "./taxonomy";

export type FreeSlot = { day: number; start: string; end: string };

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Day of week (0=Sun) for a YYYY-MM-DD string, timezone-safe. */
export function dayOfWeek(date: string): number {
  const [y, mo, d] = date.split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, n: number): string {
  const [y, mo, d] = date.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function isPast(date: string, endTime: string, now = new Date()): boolean {
  const today = todayISO(now);
  if (date < today) return true;
  if (date > today) return false;
  return toMinutes(endTime) < now.getHours() * 60 + now.getMinutes();
}

export function fmt12(hhmm: string): string {
  const min = toMinutes(hhmm);
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, "0")}${ap}` : `${h}${ap}`;
}

export function formatDate(date: string): string {
  const [y, mo, d] = date.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const month = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${DAYS[dt.getUTCDay()]}, ${month} ${d}`;
}

export function formatWhen(date: string, start: string, end: string): string {
  return `${formatDate(date)} · ${fmt12(start)}–${fmt12(end)}`;
}

export function slotLabel(date: string, start: string): string {
  const day = DAYS_LONG[dayOfWeek(date)];
  const h = Math.floor(toMinutes(start) / 60);
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `${day} ${part}`;
}

export function timeBucket(start: string): string {
  const h = Math.floor(toMinutes(start) / 60);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 20) return "evening";
  return "late";
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

/** 1 if event fully inside a free slot on its day, 0.5 if partial overlap, 0 otherwise. */
export function freeSlotFit(slots: FreeSlot[], date: string, start: string, end: string): number {
  const day = dayOfWeek(date);
  const s = toMinutes(start);
  const e = toMinutes(end);
  let best = 0;
  for (const slot of slots) {
    if (slot.day !== day) continue;
    const ss = toMinutes(slot.start);
    const se = toMinutes(slot.end);
    if (s >= ss && e <= se) return 1;
    if (s < se && ss < e) best = Math.max(best, 0.5);
  }
  return best;
}

/** Merge contiguous hourly cells into slots. cells = ["2-18", "2-19"] (day-hour). */
export function cellsToSlots(cells: string[]): FreeSlot[] {
  const byDay = new Map<number, number[]>();
  for (const c of cells) {
    const [d, h] = c.split("-").map((x) => parseInt(x, 10));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(h);
  }
  const out: FreeSlot[] = [];
  for (const [day, hours] of Array.from(byDay.entries())) {
    hours.sort((a, b) => a - b);
    let start = hours[0];
    let prev = hours[0];
    for (let i = 1; i <= hours.length; i++) {
      const h = hours[i];
      if (h === prev + 1) {
        prev = h;
        continue;
      }
      out.push({ day, start: fromMinutes(start * 60), end: fromMinutes((prev + 1) * 60) });
      start = h;
      prev = h;
    }
  }
  return out.sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start));
}

export function slotsToCells(slots: FreeSlot[]): string[] {
  const cells: string[] = [];
  for (const s of slots) {
    for (let h = Math.floor(toMinutes(s.start) / 60); h < Math.ceil(toMinutes(s.end) / 60); h++) cells.push(`${s.day}-${h}`);
  }
  return cells;
}
