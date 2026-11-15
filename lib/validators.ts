// zod schemas for API inputs.
import { z } from "zod";
import { AUDIENCES, CAMPUSES, EVENT_TYPES, FEEDBACK_TAGS, FOOD_TYPES, FORMATS, GOALS, normalizeTags, RESTRICTIONS, SCHEDULE_KINDS, SWIPE_REASONS, VISIBILITIES } from "./taxonomy";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const EventInputSchema = z.object({
  orgId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").max(140),
  description: z.string().max(4000).default(""),
  foodType: z.enum(FOOD_TYPES).default("none"),
  goodies: z.string().max(300).default(""),
  date: ymd,
  endDate: ymd.nullable().optional().or(z.literal("").transform(() => null)),
  startTime: hhmm,
  endTime: hhmm,
  campus: z.enum(CAMPUSES).default("UPC"),
  format: z.enum(FORMATS).default("in-person"),
  virtualUrl: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  registrationUrl: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  visibility: z.enum(VISIBILITIES).default("public"),
  restrictions: z.array(z.enum(RESTRICTIONS)).default([]),
  coHosts: z.array(z.string().trim().min(1).max(80)).max(6).default([]),
  agenda: z.array(z.object({ time: hhmm, title: z.string().trim().min(1).max(120), day: z.string().max(20).optional() })).max(20).default([]),
  waitlistEnabled: z.boolean().default(true),
  budget: z.coerce.number().min(0).default(0),
  capacity: z.coerce.number().int().min(1).default(50),
  venueId: z.string().nullable().optional(),
  location: z.string().max(200).default(""),
  websiteUrl: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  eventType: z.enum(EVENT_TYPES).default("other"),
  audience: z.enum(AUDIENCES).default("all"),
  ticketCost: z.coerce.number().min(0).default(0),
  tags: z.array(z.string()).default([]).transform(normalizeTags),
  accessibilityNotes: z.string().max(1000).default(""),
  flyerHeadline: z.string().max(80).default(""),
  flyerTagline: z.string().max(120).default(""),
  flyerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#990000"),
  flyerImageUrl: z.string().nullable().optional(),
  cardBlurb: z.string().max(200).default(""),
});
export type EventInput = z.infer<typeof EventInputSchema>;
export const EventPatchSchema = EventInputSchema.partial().extend({ status: z.enum(["draft", "published", "live", "closed"]).optional() });

export const SessionSchema = z.object({ role: z.literal("org"), id: z.string().min(1) });

export const SetupSchema = z.object({
  interests: z.array(z.string()).min(1).transform(normalizeTags),
  goals: z.array(z.enum(GOALS)).default([]),
  // Free time is now derived from the imported class schedule + the student's own busy blocks.
  freeSlots: z.array(z.object({ day: z.number().int().min(0).max(6), start: hhmm, end: hhmm })).optional(),
});
export const BlockSchema = z.object({
  kind: z.enum(SCHEDULE_KINDS).refine((k) => k !== "class", "Class times come from your USC schedule"),
  title: z.string().trim().min(1, "Give it a name").max(80),
  location: z.string().max(120).default(""),
  day: z.number().int().min(0).max(6),
  start: hhmm,
  end: hhmm,
});
export const BlockPatchSchema = BlockSchema.partial();
export const RegisterSchema = z.object({ force: z.boolean().default(false) });
export const AvailabilitySchema = z.object({
  orgId: z.string().min(1),
  date: ymd,
  endDate: ymd.nullable().optional(),
  startTime: hhmm,
  endTime: hhmm,
  venueId: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  excludeEventId: z.string().nullable().optional(),
});

export const SwipeSchema = z.object({
  studentId: z.string().min(1),
  eventId: z.string().min(1),
  direction: z.enum(["right", "left"]),
  reason: z.enum(SWIPE_REASONS).nullable().optional(),
  matchPct: z.number().int().min(0).max(100).nullable().optional(),
  rankPos: z.number().int().min(0).nullable().optional(),
  dwellMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
  source: z.enum(["feed", "search", "detail"]).nullable().optional(),
});

export const CheckInSchema = z.object({ eventId: z.string().min(1) });
export const FeedbackSchema = z.object({
  eventId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  // Multi-select: pick 1–4 tags. (`tag` alone is still accepted for older clients.)
  tags: z.array(z.enum(FEEDBACK_TAGS)).min(1).max(4).optional(),
  tag: z.enum(FEEDBACK_TAGS).optional(),
  comment: z.string().max(500).optional().nullable(),
}).refine((f) => (f.tags && f.tags.length) || f.tag, { message: "Pick at least one tag", path: ["tags"] });
export const ImportSchema = z.object({ text: z.string().min(10, "Paste at least a few lines").max(50_000) });
export const ImportRowSchema = z.object({
  title: z.string().min(1),
  date: ymd,
  startTime: hhmm,
  endTime: hhmm,
  eventType: z.enum(EVENT_TYPES).catch("other"),
  description: z.string().default(""),
  location: z.string().default(""),
  foodType: z.enum(FOOD_TYPES).catch("none"),
  budget: z.coerce.number().min(0).catch(0),
  capacity: z.coerce.number().int().min(1).catch(50),
  attendance: z.coerce.number().int().min(0).catch(0),
  rating: z.coerce.number().min(0).max(5).catch(0),
  tags: z.array(z.string()).default([]).transform(normalizeTags),
  notes: z.string().default(""),
});
export const ImportConfirmSchema = z.object({ rows: z.array(ImportRowSchema).min(1).max(50) });
export const VenueSuggestSchema = z.object({
  budget: z.coerce.number().min(0),
  capacity: z.coerce.number().int().min(0).optional().nullable(),
  hours: z.coerce.number().min(0.5).max(12).default(2),
});
export const DraftSchema = EventInputSchema.partial().extend({ title: z.string().default(""), orgId: z.string().optional() });
export const PrefillSchema = z.object({ orgId: z.string().min(1), draft: DraftSchema });
export const SimulateSchema = z.object({ n: z.coerce.number().int().min(1).max(100).default(20) });
export const RecordPatchSchema = z.object({ markdown: z.string().min(1).max(50_000) });

export const LoginSchema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password"), remember: z.boolean().default(true) });
export const SignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .refine((e) => /@usc\.edu$/i.test(e), "Use your @usc.edu email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  major: z.string().trim().min(1, "Enter your major").max(80),
  year: z.string().trim().min(1).max(40),
});
export const ChatSchema = z.object({ message: z.string().trim().min(1, "Ask a question").max(1000) });
