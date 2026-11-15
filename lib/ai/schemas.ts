// zod schemas for every AI output (and shared input shapes).
import { z } from "zod";
import { EVENT_TYPES, FOOD_TYPES, normalizeTags, TAGS } from "../taxonomy";
import { truncate } from "../utils";

const trimTo = (n: number) => z.string().transform((s) => truncate(s.trim(), n));
const hex = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => /^#[0-9a-fA-F]{6}$/.test(s), "color must be #RRGGBB");
const anyType = z
  .string()
  .transform((s) => ((EVENT_TYPES as readonly string[]).includes(s) ? s : "other"));
const anyFood = z
  .string()
  .transform((s) => ((FOOD_TYPES as readonly string[]).includes(s) ? s : "none"));
const time = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => /^\d{1,2}:\d{2}$/.test(s), "time must be HH:mm")
  .transform((s) => s.padStart(5, "0"));

// A. extractPastEvents
export const ExtractedEventSchema = z.object({
  title: trimTo(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: time.catch("18:00"),
  endTime: time.catch("20:00"),
  eventType: anyType.catch("other"),
  description: z.string().catch(""),
  location: z.string().catch(""),
  foodType: anyFood.catch("none"),
  budget: z.coerce.number().catch(0),
  capacity: z.coerce.number().int().catch(50),
  attendance: z.coerce.number().int().catch(0),
  rating: z.coerce.number().min(0).max(5).catch(0),
  tags: z.array(z.string()).catch([]).transform(normalizeTags),
  notes: z.string().catch(""),
});
export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;
export const ExtractSchema = z.object({ events: z.array(ExtractedEventSchema).max(50) });

// B. generateCard
export const CardSchema = z.object({
  headline: trimTo(50),
  tagline: trimTo(80),
  blurb: trimTo(140),
  tags: z
    .array(z.string())
    .transform(normalizeTags)
    .refine((t) => t.length >= 3, "need at least 3 taxonomy tags")
    .transform((t) => t.slice(0, 6)),
  color: hex,
  imagePrompt: z.string().catch(""),
});
export type Card = z.infer<typeof CardSchema>;

// C. qualityCheck
export const QualitySchema = z.object({
  issues: z
    .array(
      z.object({
        field: z.string(),
        issue: z.string(),
        fix: z.string(),
        suggestedValue: z.string().optional().nullable(),
        severity: z.enum(["high", "medium", "low"]).catch("medium"),
      }),
    )
    .max(10),
});
export type QualityIssue = z.infer<typeof QualitySchema>["issues"][number];

// G. explainProfile
export const ProfileSentenceSchema = z.object({ sentence: trimTo(200) });

// H. suggestPlan
export const PlanSchema = z.object({
  prefill: z.object({
    budget: z.coerce.number().nonnegative(),
    capacity: z.coerce.number().int().positive(),
    venue: z.string(),
    venueId: z.string().optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    startTime: time,
    endTime: time,
    time: z.string(),
    food: anyFood,
    goodies: z.string(),
  }),
  suggestions: z
    .array(z.object({ title: trimTo(90), detail: trimTo(260), source: z.string() }))
    .min(1)
    .max(6),
});
export type Plan = z.infer<typeof PlanSchema>;

// I. orgInsights
export const TipsSchema = z.object({
  tips: z.array(z.object({ eventTitle: z.string().optional().nullable(), tip: trimTo(220) })).min(1).max(6),
});

// J. clusterFeedback
export const ThemesSchema = z.object({
  themes: z
    .array(
      z.object({
        theme: trimTo(60),
        count: z.coerce.number().int().nonnegative(),
        sentiment: z.enum(["positive", "neutral", "negative"]).catch("neutral"),
        quote: z.string().catch(""),
      }),
    )
    .max(5),
});
export type Theme = z.infer<typeof ThemesSchema>["themes"][number];

// K. generateRecord
export const RecordSchema = z.object({
  markdown: z.string().min(80),
  keep: z.array(z.string()).max(6),
  change: z.array(z.string()).max(6),
});

export const TAG_LIST_TEXT = TAGS.join(", ");

// M. summarizeEvent (student-facing detailed summary)
export const SummarySchema = z.object({
  overview: z.string().min(20),
  whatYoullDo: z.array(z.string()).min(1).max(6),
  goodToKnow: z.array(z.string()).max(8),
  whoItsFor: z.string(),
});
export type EventSummary = z.infer<typeof SummarySchema>;
