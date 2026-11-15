// Student schedules: (simulated) USC registrar class import + student-managed work/personal blocks.
// Free time is DERIVED from busy blocks (8am–10pm window) and cached in Student.freeSlots for ranking.
import type { ScheduleBlock } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../errors";
import { toJSON } from "../json";
import { addDays, dayOfWeek, fmt12, fromMinutes, overlaps, toMinutes, type FreeSlot } from "../time";
import { DAYS } from "../taxonomy";

export const DAY_START = "08:00";
export const DAY_END = "22:00";

type Course = { code: string; title: string; days: number[]; start: string; end: string; location: string };

// Plausible USC sections by area (times follow USC's usual MW / TTh / F patterns).
const CATALOG: Record<string, Course[]> = {
  cs: [
    { code: "CSCI 570", title: "Analysis of Algorithms", days: [2, 4], start: "09:30", end: "11:20", location: "SGM 124" },
    { code: "CSCI 567", title: "Machine Learning", days: [1, 3], start: "14:00", end: "15:50", location: "THH 101" },
    { code: "CSCI 544", title: "Applied Natural Language Processing", days: [2, 4], start: "16:00", end: "17:50", location: "OHE 136" },
    { code: "CSCI 201", title: "Principles of Software Development", days: [1, 3], start: "10:00", end: "11:50", location: "SAL 101" },
    { code: "CSCI 270", title: "Introduction to Algorithms and Theory of Computing", days: [2, 4], start: "12:30", end: "13:50", location: "VKC 152" },
    { code: "CSCI 104", title: "Data Structures and Object Oriented Design", days: [1, 3, 5], start: "11:00", end: "11:50", location: "SGM 101" },
  ],
  business: [
    { code: "BUAD 304", title: "Organizational Behavior and Leadership", days: [1, 3], start: "10:00", end: "11:50", location: "JFF 236" },
    { code: "BUAD 307", title: "Marketing Fundamentals", days: [2, 4], start: "12:00", end: "13:50", location: "JFF 417" },
    { code: "ACCT 410", title: "Foundations of Accounting", days: [1, 3], start: "14:00", end: "15:50", location: "ACC 205" },
    { code: "ECON 351", title: "Microeconomics for Business", days: [2, 4], start: "15:30", end: "16:50", location: "KAP 160" },
  ],
  data: [
    { code: "DSCI 552", title: "Machine Learning for Data Science", days: [2, 4], start: "14:00", end: "15:50", location: "OHE 100C" },
    { code: "DSCI 551", title: "Foundations of Data Management", days: [1, 3], start: "17:00", end: "18:20", location: "SGM 123" },
    { code: "MATH 505A", title: "Applied Probability", days: [2, 4], start: "11:00", end: "12:20", location: "KAP 158" },
    { code: "DSCI 510", title: "Principles of Programming for Data Science", days: [5], start: "10:00", end: "12:50", location: "GFS 106" },
  ],
  ee: [
    { code: "EE 503", title: "Probability for Electrical and Computer Engineers", days: [1, 3], start: "12:00", end: "13:50", location: "OHE 122" },
    { code: "EE 541", title: "A Computational Introduction to Deep Learning", days: [2, 4], start: "17:00", end: "18:50", location: "EEB 132" },
    { code: "EE 510", title: "Linear Algebra for Engineering", days: [2, 4], start: "09:30", end: "10:50", location: "RTH 109" },
  ],
  design: [
    { code: "DES 203", title: "Design Thinking", days: [1, 3], start: "13:00", end: "15:50", location: "WAH 104" },
    { code: "CTIN 190", title: "Introduction to Interactive Entertainment", days: [2], start: "10:00", end: "12:50", location: "SCI 206" },
    { code: "ARTS 110", title: "Introduction to Drawing", days: [4], start: "13:00", end: "15:50", location: "WAH 201" },
  ],
  bio: [
    { code: "BISC 220", title: "General Biology: Cell Biology and Physiology", days: [1, 3, 5], start: "09:00", end: "09:50", location: "ZHS 159" },
    { code: "NEUR 524", title: "Survey of Neuroscience", days: [2, 4], start: "14:00", end: "15:20", location: "HNB 100" },
    { code: "PSYC 326", title: "Behavioral Neuroscience", days: [1, 3], start: "12:00", end: "13:20", location: "SGM 101" },
    { code: "CHEM 322A", title: "Organic Chemistry", days: [2, 4], start: "10:00", end: "11:20", location: "SLH 100" },
  ],
  general: [
    { code: "WRIT 150", title: "Writing and Critical Reasoning", days: [2, 4], start: "08:00", end: "09:20", location: "THH 211" },
    { code: "GESM 110", title: "Seminar in the Arts", days: [3], start: "16:00", end: "17:50", location: "VKC 101" },
    { code: "MATH 225", title: "Linear Algebra and Differential Equations", days: [1, 3, 5], start: "13:00", end: "13:50", location: "KAP 145" },
  ],
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function areaFor(major: string): string {
  const m = major.toLowerCase();
  if (/data/.test(m)) return "data";
  if (/computer|cs\b|software/.test(m)) return "cs";
  if (/business|econ|account|marshall|finance/.test(m)) return "business";
  if (/electrical|ee\b|engineering/.test(m)) return "ee";
  if (/design|art|cinema|film|games/.test(m)) return "design";
  if (/bio|neuro|chem|pre-?med|psych/.test(m)) return "bio";
  return "general";
}

/** Deterministic, plausible course list for a student (stands in for the USC registrar/Workday feed). */
export function plannedCourses(student: { id: string; major: string }, count = 4): Course[] {
  const pool = [...CATALOG[areaFor(student.major)], ...CATALOG.general];
  const out: Course[] = [];
  let h = hash(student.id + student.major);
  while (out.length < count && pool.length) {
    const c = pool.splice(h % pool.length, 1)[0];
    h = hash(String(h));
    // avoid overlapping sections
    if (out.some((o) => o.days.some((d) => c.days.includes(d)) && overlaps(o.start, o.end, c.start, c.end))) continue;
    out.push(c);
  }
  return out;
}

/** Simulated "import from USC" on login/signup: replaces the student's class blocks. */
export async function importUscSchedule(studentId: string) {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  await prisma.scheduleBlock.deleteMany({ where: { studentId, source: "usc-import" } });
  const courses = plannedCourses(student);
  const rows = courses.flatMap((c) =>
    c.days.map((day) => ({ studentId, kind: "class", source: "usc-import", title: `${c.code} · ${c.title}`, location: c.location, day, start: c.start, end: c.end })),
  );
  if (rows.length) await prisma.scheduleBlock.createMany({ data: rows });
  await prisma.student.update({ where: { id: studentId }, data: { scheduleImportedAt: new Date() } });
  await recomputeFreeSlots(studentId);
  return rows.length;
}

/** 8am–10pm minus busy blocks, per weekday; keeps windows ≥ 60 min. */
export function deriveFreeSlots(blocks: Pick<ScheduleBlock, "day" | "start" | "end">[]): FreeSlot[] {
  const out: FreeSlot[] = [];
  for (let day = 0; day < 7; day++) {
    const busy = blocks
      .filter((b) => b.day === day)
      .map((b) => [Math.max(toMinutes(b.start), toMinutes(DAY_START)), Math.min(toMinutes(b.end), toMinutes(DAY_END))] as [number, number])
      .filter(([a, b]) => b > a)
      .sort((a, b) => a[0] - b[0]);
    let cursor = toMinutes(DAY_START);
    for (const [a, b] of busy) {
      if (a - cursor >= 60) out.push({ day, start: fromMinutes(cursor), end: fromMinutes(a) });
      cursor = Math.max(cursor, b);
    }
    if (toMinutes(DAY_END) - cursor >= 60) out.push({ day, start: fromMinutes(cursor), end: DAY_END });
  }
  return out;
}

export async function recomputeFreeSlots(studentId: string) {
  const blocks = await prisma.scheduleBlock.findMany({ where: { studentId } });
  const free = deriveFreeSlots(blocks);
  await prisma.student.update({ where: { id: studentId }, data: { freeSlots: toJSON(free) } });
  return free;
}

export async function getSchedule(studentId: string) {
  const [student, blocks] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { scheduleImportedAt: true, freeSlots: true } }),
    prisma.scheduleBlock.findMany({ where: { studentId }, orderBy: [{ day: "asc" }, { start: "asc" }] }),
  ]);
  return {
    importedAt: student.scheduleImportedAt?.toISOString() ?? null,
    blocks: blocks.map((b) => ({ ...b, createdAt: b.createdAt.toISOString(), editable: b.source !== "usc-import" && b.kind !== "class" })),
    freeSlots: deriveFreeSlots(blocks),
  };
}

export type BlockInput = { kind: string; title: string; location?: string; day: number; start: string; end: string };

function validateBlock(b: BlockInput) {
  if (b.kind === "class") throw new HttpError(400, "Class times come from your USC schedule and can't be added by hand.");
  if (toMinutes(b.end) <= toMinutes(b.start)) throw new HttpError(400, "End time must be after start time.");
}

export async function addBlock(studentId: string, b: BlockInput) {
  validateBlock(b);
  const row = await prisma.scheduleBlock.create({ data: { studentId, kind: b.kind, source: "manual", title: b.title, location: b.location ?? "", day: b.day, start: b.start, end: b.end } });
  await recomputeFreeSlots(studentId);
  return row;
}

async function ownEditable(studentId: string, blockId: string) {
  const row = await prisma.scheduleBlock.findUniqueOrThrow({ where: { id: blockId } });
  if (row.studentId !== studentId) throw new HttpError(403, "That isn't your schedule.");
  if (row.source === "usc-import" || row.kind === "class") throw new HttpError(403, "Imported USC classes can't be edited here.");
  return row;
}

export async function updateBlock(studentId: string, blockId: string, b: Partial<BlockInput>) {
  const row = await ownEditable(studentId, blockId);
  const next = { kind: b.kind ?? row.kind, title: b.title ?? row.title, location: b.location ?? row.location, day: b.day ?? row.day, start: b.start ?? row.start, end: b.end ?? row.end };
  validateBlock(next);
  const updated = await prisma.scheduleBlock.update({ where: { id: blockId }, data: next });
  await recomputeFreeSlots(studentId);
  return updated;
}

export async function deleteBlock(studentId: string, blockId: string) {
  await ownEditable(studentId, blockId);
  await prisma.scheduleBlock.delete({ where: { id: blockId } });
  await recomputeFreeSlots(studentId);
}

// ───────── Event time helpers (multi-day aware) ─────────
export type Segment = { date: string; start: string; end: string };

/** Split an event into per-day segments. Multi-day events occupy start→23:59, full middle days, 00:00→end. */
export function eventSegments(e: { date: string; endDate?: string | null; startTime: string; endTime: string }): Segment[] {
  if (!e.endDate || e.endDate <= e.date) return [{ date: e.date, start: e.startTime, end: e.endTime }];
  const segs: Segment[] = [];
  let d = e.date;
  for (let i = 0; i < 14 && d <= e.endDate; i++) {
    segs.push({ date: d, start: d === e.date ? e.startTime : "00:00", end: d === e.endDate ? e.endTime : "23:59" });
    d = addDays(d, 1);
  }
  return segs;
}

export function segmentsOverlap(a: Segment[], b: Segment[]) {
  return a.some((x) => b.some((y) => x.date === y.date && overlaps(x.start, x.end, y.start, y.end)));
}

/** Weekly blocks that collide with an event (checked on every day the event spans). */
export function blockClashes(blocks: Pick<ScheduleBlock, "id" | "kind" | "title" | "day" | "start" | "end">[], segs: Segment[]) {
  const hits: { id: string; kind: string; title: string; when: string }[] = [];
  for (const s of segs) {
    const dow = dayOfWeek(s.date);
    for (const b of blocks) {
      if (b.day === dow && overlaps(b.start, b.end, s.start, s.end) && !hits.some((h) => h.id === b.id))
        hits.push({ id: b.id, kind: b.kind, title: b.title, when: `${DAYS[b.day]} ${fmt12(b.start)}–${fmt12(b.end)}` });
    }
  }
  return hits;
}
