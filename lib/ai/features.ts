// The AI features (A–K). Each one: prompt → chatJSON (zod-validated) → deterministic mock fallback,
// all through runAI() so every call is logged to AiLog for the "AI under the hood" panel.
import { runAI } from "./client";
import {
  CardSchema,
  ExtractSchema,
  PlanSchema,
  ProfileSentenceSchema,
  QualitySchema,
  RecordSchema,
  TAG_LIST_TEXT,
  ThemesSchema,
  TipsSchema,
  SummarySchema,
  type EventSummary,
  type Card,
  type ExtractedEvent,
  type Plan,
  type QualityIssue,
  type Theme,
} from "./schemas";
import { FEEDBACK_LABELS, keywordTags, REASON_LABELS, TAG_LABELS, normalizeTags } from "../taxonomy";
import { DAYS, DAYS_LONG } from "../taxonomy";
import { dayOfWeek, fmt12, formatDate, toMinutes, todayISO, addDays, fromMinutes } from "../time";
import { pct, truncate } from "../utils";

export type EventDraft = {
  title: string;
  description: string;
  foodType: string;
  goodies?: string;
  date: string;
  startTime: string;
  endTime: string;
  budget: number;
  capacity: number;
  location?: string;
  venueName?: string | null;
  venueAccessible?: boolean | null;
  eventType: string;
  audience?: string;
  ticketCost?: number;
  tags?: string[];
  accessibilityNotes?: string;
  websiteUrl?: string | null;
};

export const TYPE_COLORS: Record<string, string> = {
  workshop: "#990000",
  social: "#D97706",
  cultural: "#C2185B",
  career: "#1E3A8A",
  talk: "#4C1D95",
  sports: "#047857",
  performance: "#9D174D",
  exhibition: "#6D28D9",
  screening: "#1F2937",
  hackathon: "#7A0000",
  competition: "#B45309",
  "info-session": "#1D4ED8",
  fair: "#0E7490",
  conference: "#312E81",
  volunteering: "#0F766E",
  wellness: "#047857",
  faith: "#92400E",
  fundraiser: "#A21CAF",
  "general-meeting": "#475569",
  "watch-party": "#990000",
  trip: "#0369A1",
  academic: "#3F6212",
  other: "#374151",
};

const TYPE_TAGS: Record<string, string[]> = {
  workshop: ["hands-on", "coding"],
  social: ["social", "networking"],
  cultural: ["culture", "festival"],
  career: ["career", "networking"],
  talk: ["talk", "research"],
  sports: ["sports", "outdoors"],
  performance: ["arts", "music"],
  exhibition: ["arts", "design"],
  screening: ["film", "social"],
  hackathon: ["coding", "hands-on", "entrepreneurship"],
  competition: ["entrepreneurship", "hands-on"],
  "info-session": ["career", "talk"],
  fair: ["career", "networking"],
  conference: ["talk", "networking", "research"],
  volunteering: ["volunteering", "diversity"],
  wellness: ["wellness"],
  faith: ["faith", "culture"],
  fundraiser: ["social", "advocacy"],
  "general-meeting": ["social", "networking"],
  "watch-party": ["sports", "social"],
  trip: ["outdoors", "social"],
  academic: ["research", "hands-on"],
  other: ["social"],
};

function draftText(d: EventDraft) {
  return [
    `Title: ${d.title}`,
    `Type: ${d.eventType} | Audience: ${d.audience ?? "all"}`,
    `When: ${d.date} ${d.startTime}-${d.endTime}`,
    `Where: ${d.location || d.venueName || "TBD"}`,
    `Food: ${d.foodType}${d.goodies ? ` | Goodies: ${d.goodies}` : ""}`,
    `Budget: $${d.budget} | Capacity: ${d.capacity} | Ticket: $${d.ticketCost ?? 0}`,
    `Tags: ${(d.tags ?? []).join(", ")}`,
    `Accessibility: ${d.accessibilityNotes || "(none)"}`,
    `Description: ${d.description || "(empty)"}`,
  ].join("\n");
}

// ───────────────────────── A. extractPastEvents ─────────────────────────
function mockExtract(input: string): ExtractedEvent[] {
  let text = input;
  const out: ExtractedEvent[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const isCsv = lines.length > 1 && lines[0].includes(",") && /title|event|name/i.test(lines[0]);
  const parseDate = (s: string): string | null => {
    const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const us = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (us) {
      const y = us[3].length === 2 ? "20" + us[3] : us[3];
      return `${y}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
    }
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const m = s.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/);
    if (m) {
      const y = m[3] ?? String(new Date().getFullYear() - 1);
      return `${y}-${String(months.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    }
    return null;
  };
  const stripDates = (s: string) =>
    s
      .replace(/\d{4}-\d{1,2}-\d{1,2}/g, " ")
      .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, " ")
      .replace(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?,?\s*(\d{4})?/gi, " ");
  const parseTime = (raw: string): [string, string] => {
    const s = stripDates(raw).toLowerCase();
    const conv = (h: string, mm: string | undefined, ap: string | undefined, fallbackAp?: string) => {
      let hr = parseInt(h, 10);
      const a = ap ?? fallbackAp;
      if (a === "pm" && hr < 12) hr += 12;
      if (a === "am" && hr === 12) hr = 0;
      if (!a && hr < 9) hr += 12;
      return fromMinutes(Math.min(hr, 23) * 60 + (mm ? parseInt(mm, 10) : 0));
    };
    const re = /(?<![\d$])(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?!\d)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      const hasMarker = m[3] || m[6] || m[2] || m[5];
      if (!hasMarker || parseInt(m[1], 10) > 23 || parseInt(m[4], 10) > 23) continue;
      return [conv(m[1], m[2], m[3], m[6]), conv(m[4], m[5], m[6])];
    }
    const single = s.match(/(?<![\d$])(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
    if (single) {
      const st = conv(single[1], single[2], single[3]);
      return [st, fromMinutes(Math.min(toMinutes(st) + 120, 23 * 60 + 59))];
    }
    return ["18:00", "20:00"];
  };
  const num = (s: string | undefined, re: RegExp) => {
    if (!s) return 0;
    const m = s.match(re);
    return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
  };
  const guessType = (t: string) => {
    const l = t.toLowerCase();
    if (/hackathon|buildathon|hack night|hack day/.test(l)) return "hackathon";
    if (/career fair|job fair|involvement fair|expo\b|\bfair\b/.test(l)) return "fair";
    if (/info session|information session|infosession/.test(l)) return "info-session";
    if (/general (body )?meeting|\bgbm\b/.test(l)) return "general-meeting";
    if (/conference|summit|symposium/.test(l)) return "conference";
    if (/screening|film night|movie night/.test(l)) return "screening";
    if (/concert|recital|showcase|theat(er|re)|comedy|improv|open mic|performance/.test(l)) return "performance";
    if (/pitch|competition|case comp|tournament of/.test(l)) return "competition";
    if (/workshop|hands-on|lab|bootcamp/.test(l)) return "workshop";
    if (/career|resume|recruit|interview|internship/.test(l)) return "career";
    if (/diwali|holi|cultural|garba|festival|navratri|lunar new year/.test(l)) return "cultural";
    if (/panel|talk|speaker|fireside|lecture/.test(l)) return "talk";
    if (/watch party|tailgate/.test(l)) return "watch-party";
    if (/cricket|soccer|sports|tournament|5k|intramural/.test(l)) return "sports";
    if (/volunteer|service day|cleanup|outreach/.test(l)) return "volunteering";
    if (/gala|fundrais|benefit|charity/.test(l)) return "fundraiser";
    if (/yoga|meditation|wellness|mental health/.test(l)) return "wellness";
    if (/prayer|worship|interfaith|bible|iftar/.test(l)) return "faith";
    if (/trip|hike|excursion|retreat/.test(l)) return "trip";
    if (/study session|study hall|review session|tutoring/.test(l)) return "academic";
    if (/mixer|social|game night|party|hangout/.test(l)) return "social";
    return "other";
  };
  const build = (title: string, blob: string, cols?: Record<string, string>): ExtractedEvent | null => {
    const date = parseDate(cols?.date ?? blob);
    if (!title || !date) return null;
    const [startTime, endTime] = cols?.time ? parseTime(cols.time) : parseTime(blob);
    const lower = blob.toLowerCase();
    return {
      title: truncate(title.replace(/^[-*#\d.\s]+/, "").trim(), 120),
      date,
      startTime,
      endTime,
      eventType: cols?.type && cols.type in TYPE_COLORS ? cols.type : guessType(title + " " + blob),
      description: truncate(cols?.description ?? blob.replace(title, "").trim(), 400),
      location:
        cols?.location ??
        (blob.match(/(?:\bat|@|location:)\s+([A-Z][\w\s'&-]{3,40}?)(?=[.,;]|$)/)?.[1]?.trim() ||
          blob.match(/\d(?:am|pm)\s*,\s*([A-Z][\w\s'&-]{3,40}?)(?=[.,;]|$)/i)?.[1]?.trim() ||
          ""),
      foodType: /free (food|pizza|dinner|snacks|boba)|food provided|catered/.test(lower) ? "free" : /\$\d+.*(food|dinner)|paid/.test(lower) ? "paid" : "none",
      budget: cols?.budget ? parseFloat(cols.budget.replace(/[$,]/g, "")) || 0 : num(blob, /budget[:\s]*\$?([\d,]+)/i) || num(blob, /\$([\d,]{3,})/),
      capacity: cols?.capacity ? parseInt(cols.capacity, 10) || 50 : num(blob, /capacity[:\s]*(\d+)/i) || 50,
      attendance: cols?.attendance ? parseInt(cols.attendance, 10) || 0 : num(blob, /(\d+)\s*(?:attendees|attended|people came|showed up|checked in)/i),
      rating: cols?.rating ? parseFloat(cols.rating) || 0 : num(blob, /rating[:\s]*([\d.]+)/i),
      tags: keywordTags(title + " " + blob, 5),
      notes: truncate(cols?.notes ?? (blob.match(/(?:notes?|feedback|learned)[:\-]\s*(.+)/i)?.[1] ?? ""), 300),
    };
  };
  // CSV sections can appear anywhere (e.g. a doc with notes + a pasted spreadsheet export).
  const isHeader = (l: string) => (l.match(/,/g) ?? []).length >= 2 && /\b(title|event|name)\b/i.test(l) && /\bdate\b/i.test(l);
  const csvLines = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (!isHeader(lines[i])) continue;
    const header = lines[i].split(",").map((h) => h.trim().toLowerCase());
    const find = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
    const idx = {
      title: find("title", "event", "name"),
      date: find("date"),
      time: find("time"),
      type: find("type"),
      location: find("location", "venue"),
      budget: find("budget", "cost", "spent"),
      capacity: find("capacity"),
      attendance: find("attend", "turnout", "count"),
      rating: find("rating"),
      notes: find("notes", "feedback", "comment"),
      description: find("description"),
    };
    csvLines.add(i);
    for (let j = i + 1; j < lines.length && (lines[j].match(/,/g) ?? []).length >= 2 && !isHeader(lines[j]); j++) {
      csvLines.add(j);
      const cells = lines[j].match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
      const cols: Record<string, string> = {};
      for (const [k, ci] of Object.entries(idx)) {
        const v = ci >= 0 ? cells[ci] : undefined;
        if (v) cols[k] = v;
      }
      const ev = build(cols.title ?? "", lines[j], cols);
      if (ev) out.push(ev);
    }
  }
  if (isCsv && csvLines.size) return out;
  text = text
    .split(/\r?\n/)
    .filter((l) => !csvLines.has(lines.indexOf(l.trim())))
    .join("\n");
  // Free text: split into blocks by blank lines / bullets / headings, one event per block with a date.
  const blocks = text.split(/\n\s*\n|\n(?=[-*#]\s)|\n(?=\d+[.)]\s)/).map((b) => b.trim()).filter(Boolean);
  for (const b of blocks) {
    const first = b.split(/\n/)[0].replace(/[–—]/g, "-");
    const title = first.split(/\s[-|:(]\s?|,\s*(?=\w+\s+\d)/)[0].trim();
    const ev = build(title, b.replace(/\n/g, " "));
    if (ev) out.push(ev);
  }
  return out;
}

export async function extractPastEvents(text: string) {
  return runAI({
    feature: "extractPastEvents",
    system:
      "You extract past student-org events from messy notes, docs or CSV. For each event return: title, date (YYYY-MM-DD), startTime/endTime (HH:mm 24h), eventType (workshop|social|cultural|career|talk|sports|other), description, location, foodType (none|free|paid), budget (USD number), capacity, attendance, rating (0-5, 0 if unknown), tags (from the taxonomy), notes (what went well / badly). Never invent events that are not in the text.",
    user: `Tag taxonomy: ${TAG_LIST_TEXT}\n\nReturn {"events":[...]}.\n\nTEXT:\n${text.slice(0, 12000)}`,
    schema: ExtractSchema,
    fallback: () => ({ events: mockExtract(text) }),
    inputSummary: `${text.length} chars: ${text.slice(0, 120)}`,
    summarize: (d) => `${d.events.length} events: ${d.events.map((e) => e.title).slice(0, 4).join(", ")}`,
  });
}

// ───────────────────────── B. generateCard ─────────────────────────
export function mockCard(d: EventDraft): Card {
  const kw = keywordTags(`${d.title} ${d.description} ${d.goodies ?? ""}`, 6);
  const base = normalizeTags([...(d.tags ?? []), ...kw, ...(TYPE_TAGS[d.eventType] ?? []), ...(d.foodType === "free" ? ["food"] : [])]);
  const fillers = ["social", "networking", "beginner-friendly"];
  for (const f of fillers) if (base.length < 3 && !base.includes(f)) base.push(f);
  const when = `${DAYS[dayOfWeek(d.date)]} ${fmt12(d.startTime)}`;
  const perks = [d.foodType === "free" ? "free food" : d.foodType === "paid" ? "food for sale" : null, d.goodies ? d.goodies.split(/[,;]/)[0].trim().toLowerCase() : null, (d.ticketCost ?? 0) > 0 ? `$${d.ticketCost}` : "free entry"]
    .filter(Boolean)
    .join(" · ");
  const firstSentence = (d.description || "").split(/(?<=[.!?])\s/)[0] || `A ${d.eventType} for Trojans.`;
  const headline = d.title.length <= 50 ? d.title : d.title.split(/[:\-–|]/)[0].trim();
  return {
    headline: truncate(headline, 50),
    tagline: truncate(`${when} · ${perks}`, 80),
    blurb: truncate(firstSentence, 140),
    tags: base.slice(0, 6),
    color: TYPE_COLORS[d.eventType] ?? "#990000",
    imagePrompt: `Bold, modern flat-illustration flyer art for a USC student ${d.eventType} called "${d.title}", cardinal red and gold palette, no text`,
  };
}

export async function generateCard(d: EventDraft) {
  return runAI({
    feature: "generateCard",
    system:
      "You write swipe cards and flyers for USC student-org events. Be concrete and student-friendly: say what attendees do or get. headline ≤50 chars, tagline ≤80 chars (when + perks), blurb ≤140 chars, 3–6 tags ONLY from the taxonomy, color = a bold hex that suits the vibe (USC cardinal #990000 and gold #FFCC00 are on-brand), imagePrompt = flyer art description with no text in the image.",
    user: `Taxonomy: ${TAG_LIST_TEXT}\n\nReturn {"headline","tagline","blurb","tags":[],"color","imagePrompt"}.\n\nEVENT:\n${draftText(d)}`,
    schema: CardSchema,
    fallback: () => mockCard(d),
    inputSummary: `${d.title} (${d.eventType}, ${d.date})`,
    summarize: (c) => `"${c.headline}" — ${c.tagline} [${c.tags.join(", ")}]`,
  });
}

// ───────────────────────── C. qualityCheck ─────────────────────────
export function mockQuality(d: EventDraft): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const desc = (d.description || "").trim();
  const lower = desc.toLowerCase();
  const verbs = /(build|learn|meet|hear|eat|dance|practice|network|walk away|bring|try|make|create|ask|watch|play|compete)/i;
  if (desc.length < 80 || !verbs.test(desc)) {
    const typeLine: Record<string, string> = {
      workshop: "You'll build a working project step by step with mentors in the room — bring a laptop, no experience needed.",
      career: "You'll meet recruiters, get your resume reviewed and practice a quick pitch.",
      cultural: "Expect performances, music, food and a chance to celebrate with the community.",
      social: "Come meet new people over games and snacks — no prep needed.",
      talk: "Hear from the speaker, then bring your questions to an open Q&A.",
      sports: "Teams are formed on the spot, all skill levels welcome.",
      other: "Here's what you'll do and walk away with.",
    };
    issues.push({
      field: "description",
      issue: "Description is vague — say what attendees will actually do or walk away with.",
      fix: "Add one concrete sentence about the activity and the takeaway.",
      suggestedValue: (desc ? desc.replace(/\.?$/, ". ") : "") + (typeLine[d.eventType] ?? typeLine.other),
      severity: "high",
    });
  }
  if (d.foodType !== "none" && !/(vegan|vegetarian|veg|gluten|halal|kosher|dietary|allerg)/i.test(desc + " " + (d.accessibilityNotes ?? ""))) {
    issues.push({
      field: "accessibilityNotes",
      issue: "Food is offered but dietary options aren't mentioned.",
      fix: "Mention dietary options and label food at the event.",
      suggestedValue: "Vegetarian, vegan and gluten-free options available; all food labeled with ingredients.",
      severity: "medium",
    });
  }
  const acc = (d.accessibilityNotes ?? "").toLowerCase();
  if (!/(step-free|wheelchair|accessible|elevator|ramp)/.test(acc)) {
    issues.push({
      field: "accessibilityNotes",
      issue: d.venueAccessible === false ? "The selected venue is not marked step-free accessible." : "Venue accessibility is not stated.",
      fix: d.venueAccessible === false ? "Pick a step-free venue or describe the accessible entrance." : "State that the venue is step-free and how to request accommodations.",
      suggestedValue: "Step-free venue with elevator access. Request accommodations (captions, ASL, quiet space) by emailing the org 5 days ahead.",
      severity: d.venueAccessible === false ? "high" : "medium",
    });
  }
  if (!d.location && !d.venueName) {
    issues.push({ field: "location", issue: "No location yet.", fix: "Add a building and room so students can find you.", suggestedValue: null, severity: "high" });
  }
  if (/^(meeting|event|gbm|general meeting|session)\b/i.test(d.title.trim()) || d.title.trim().split(/\s+/).length < 2) {
    issues.push({
      field: "title",
      issue: "Title doesn't tell students what they'll get.",
      fix: "Put the activity and the hook in the title.",
      suggestedValue: `${d.title.trim()}${d.foodType === "free" ? " + Free Food" : ""}${/beginner|intro/i.test(lower) ? "" : " (Beginner-Friendly)"}`,
      severity: "medium",
    });
  }
  if (toMinutes(d.endTime) - toMinutes(d.startTime) > 180) {
    issues.push({ field: "endTime", issue: "Event runs over 3 hours — feedback on long events often says 'too long'.", fix: "Trim to 2 hours or publish an agenda so people can drop in.", suggestedValue: fromMinutes(toMinutes(d.startTime) + 120), severity: "low" });
  }
  if ((d.ticketCost ?? 0) > 0 && !/(\$|ticket|cost|price)/i.test(desc)) {
    issues.push({ field: "description", issue: "There is a ticket cost but the description doesn't explain what it covers.", fix: "Say what the ticket includes (food, merch…).", suggestedValue: (desc ? desc.replace(/\.?$/, ". ") : "") + `Your $${d.ticketCost} ticket covers food and goodies.`, severity: "low" });
  }
  return issues.slice(0, 6);
}

export async function qualityCheck(d: EventDraft) {
  return runAI({
    feature: "qualityCheck",
    system:
      "You review event listings for USC student orgs before publishing. Flag: vague descriptions (say what attendees will build/do), missing info (location, time, cost), food without dietary info, missing venue accessibility (step-free, captions, quiet space — per USC event-accessibility guidance), unclear titles. For each issue give field (one of title, description, location, accessibilityNotes, endTime, goodies), issue, fix and a ready-to-use suggestedValue for that field (full replacement text). Max 6 issues; return an empty list if it's great.",
    user: `Return {"issues":[{"field","issue","fix","suggestedValue","severity":"high|medium|low"}]}.\n\nEVENT:\n${draftText(d)}`,
    schema: QualitySchema,
    fallback: () => ({ issues: mockQuality(d) }),
    inputSummary: `${d.title}: ${d.description.slice(0, 100)}`,
    summarize: (q) => `${q.issues.length} issue(s): ${q.issues.map((i) => i.field).join(", ")}`,
  });
}

// ───────────────────────── G. explainProfile ─────────────────────────
export type ProfileContext = {
  tagWeights: Record<string, number>;
  goals: string[];
  rightSwipes: { title: string; date: string; startTime: string; foodType: string; eventType: string; capacity: number }[];
  reasons: Record<string, number>;
};

export function mockProfileSentence(c: ProfileContext): string {
  const NON_TOPIC = new Set(["food", "hands-on", "beginner-friendly", "social", "talk", "festival"]);
  const top = Object.entries(c.tagWeights)
    .filter(([t, w]) => w > 0 && TAG_LABELS[t] && !NON_TOPIC.has(t))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => (t === "ai-ml" ? "AI / ML" : TAG_LABELS[t].toLowerCase()));
  const rs = c.rightSwipes;
  const typeCounts: Record<string, number> = {};
  const dayCounts: Record<number, number> = {};
  let evening = 0,
    food = 0,
    small = 0;
  for (const e of rs) {
    typeCounts[e.eventType] = (typeCounts[e.eventType] ?? 0) + 1;
    const d = dayOfWeek(e.date);
    dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    if (toMinutes(e.startTime) >= 17 * 60) evening++;
    if (e.foodType === "free") food++;
    if (e.capacity <= 60) small++;
  }
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const weekday = Object.entries(dayCounts).filter(([d]) => +d >= 1 && +d <= 5).reduce((s, [, n]) => s + n, 0);
  const size = rs.length && small / rs.length > 0.5 ? "small, " : "";
  const style = topType === "workshop" ? "hands-on " : "";
  const typeWord = topType ? (topType === "other" ? "events" : `${topType}s`) : "events";
  const topics = top.length ? `${top.slice(0, 2).join(" and ")} ` : "";
  const when = rs.length && evening / rs.length > 0.5 ? (weekday / rs.length > 0.6 ? " on weekday evenings" : " in the evenings") : "";
  const foodBit = rs.length && food / rs.length >= 0.4 ? ", especially with free food" : c.goals.includes("free-food") ? ", and free food never hurts" : "";
  const timeNote = (c.reasons.time ?? 0) >= 2 ? " Timing matters to you, so we favor events that fit your free slots." : "";
  if (!rs.length && !top.length) return "Swipe on a few events and we'll learn what you like.";
  return `You like ${size}${style}${topics}${typeWord}${when}${foodBit}.${timeNote}`.replace(/\s+/g, " ");
}

export async function explainProfile(c: ProfileContext) {
  const top = Object.entries(c.tagWeights).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return runAI({
    feature: "explainProfile",
    system:
      "You describe a student's event taste in ONE friendly second-person sentence (max 30 words), e.g. 'You like small, hands-on ML workshops on weekday evenings, especially with free food.' Base it only on the data.",
    user: `Return {"sentence":"..."}.\nTop tag weights: ${JSON.stringify(top)}\nGoals: ${c.goals.join(", ")}\nRecent right swipes: ${c.rightSwipes
      .slice(0, 10)
      .map((e) => `${e.title} (${e.eventType}, ${DAYS[dayOfWeek(e.date)]} ${e.startTime}, food=${e.foodType}, cap=${e.capacity})`)
      .join("; ")}\nLeft-swipe reasons: ${JSON.stringify(c.reasons)}`,
    schema: ProfileSentenceSchema,
    fallback: () => ({ sentence: mockProfileSentence(c) }),
    inputSummary: `top tags ${top.slice(0, 4).map(([t]) => t).join(", ")}; ${c.rightSwipes.length} right swipes`,
    summarize: (d) => d.sentence,
  });
}

// ───────────────────────── H. suggestPlan (RAG) ─────────────────────────
export type RetrievedRecord = {
  id: string;
  eventId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  eventType: string;
  budget: number;
  capacity: number;
  venueName: string;
  foodType: string;
  goodies: string;
  checkedIn: number;
  rightSwipes: number;
  leftSwipes: number;
  leftReasons: Record<string, number>;
  avgRating: number;
  keep: string[];
  change: string[];
  themes: Theme[];
  similarity: number;
};
export type OrgSwipeInsights = {
  bestSlot: { day: number; startTime: string; label: string; rightRate: number } | null;
  reasonTotals: Record<string, number>;
};
export type VenueOption = { id: string; name: string; capacity: number; accessible: boolean; costPerHour: number };

function nextDateForDay(day: number, minDaysOut = 7): string {
  let d = addDays(todayISO(), minDaysOut);
  for (let i = 0; i < 7 && dayOfWeek(d) !== day; i++) d = addDays(d, 1);
  return d;
}

export function mockPlan(draft: EventDraft, records: RetrievedRecord[], insights: OrgSwipeInsights, venues: VenueOption[]): Plan {
  const withData = records.filter((r) => r.checkedIn > 0);
  const avgCheckedIn = withData.length ? withData.reduce((s, r) => s + r.checkedIn, 0) / withData.length : draft.capacity || 40;
  const capacity = Math.max(20, Math.round((avgCheckedIn * 1.25) / 5) * 5);
  const budgets = records.map((r) => r.budget).filter((b) => b > 0);
  const budget = draft.budget > 0 ? draft.budget : budgets.length ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length / 10) * 10 : 300;
  const venue =
    venues.filter((v) => v.capacity >= capacity && v.accessible).sort((a, b) => a.capacity - b.capacity)[0] ??
    venues.sort((a, b) => b.capacity - a.capacity)[0];
  const lovedFood = records.some((r) => r.themes.some((t) => /food/i.test(t.theme) && t.sentiment === "positive") || r.keep.some((k) => /food|pizza|boba/i.test(k)));
  const goodiesFromKeep = records.flatMap((r) => r.keep).find((k) => /sticker|swag|raffle|merch|t-shirt|prize/i.test(k));
  const slot = insights.bestSlot;
  const startTime = slot?.startTime ?? draft.startTime ?? "18:00";
  const dur = Math.max(60, Math.min(120, toMinutes(draft.endTime || "20:00") - toMinutes(draft.startTime || "18:00") || 120));
  const endTime = fromMinutes(toMinutes(startTime) + dur);
  const date = slot ? nextDateForDay(slot.day) : draft.date;
  const suggestions: Plan["suggestions"] = [];

  // 1) The strongest "time" signal among retrieved records.
  const timeRec = [...records]
    .map((r) => ({ r, share: pct(r.leftReasons.time ?? 0, r.leftSwipes) }))
    .filter((x) => x.r.leftSwipes >= 5)
    .sort((a, b) => b.share - a.share)[0];
  if (timeRec && timeRec.share >= 30 && slot) {
    suggestions.push({
      title: `${timeRec.share}% swiped left because of the time — try ${slot.label}`,
      detail: `"${timeRec.r.title}" ran ${DAYS_LONG[dayOfWeek(timeRec.r.date)]} at ${fmt12(timeRec.r.startTime)} and ${timeRec.share}% of left swipes said "Bad time". Your best-performing slot is ${slot.label} (${slot.rightRate}% right-swipe rate).`,
      source: timeRec.r.id,
    });
  }
  // 2) Capacity from real attendance.
  const capRec = withData.sort((a, b) => b.similarity - a.similarity)[0];
  if (capRec) {
    suggestions.push({
      title: `Plan for ~${capacity} people`,
      detail: `"${capRec.title}" had ${capRec.checkedIn} check-ins against a capacity of ${capRec.capacity} (${pct(capRec.checkedIn, capRec.capacity)}% full). Similar past events averaged ${Math.round(avgCheckedIn)}.`,
      source: capRec.id,
    });
  }
  // 3) Keep / change lessons from the most similar records.
  for (const r of records.slice(0, 3)) {
    const ch = r.change[0];
    const kp = r.keep[0];
    if (ch && suggestions.length < 5) suggestions.push({ title: `Change: ${truncate(ch, 70)}`, detail: `Lesson from "${r.title}" (${formatDate(r.date)}, rated ${r.avgRating.toFixed(1)}★).`, source: r.id });
    if (kp && suggestions.length < 5) suggestions.push({ title: truncate(/^keep\b/i.test(kp) ? kp : `Keep: ${kp}`, 80), detail: `It worked at "${r.title}" — attendees called it out in feedback.`, source: r.id });
  }
  if (!suggestions.length && records[0]) {
    suggestions.push({ title: "Reuse what worked last time", detail: `Start from "${records[0].title}" — ${records[0].checkedIn} checked in.`, source: records[0].id });
  }
  if (!suggestions.length) suggestions.push({ title: "No past records yet", detail: "Import past events on the Setup page to unlock history-based suggestions.", source: "none" });
  return {
    prefill: {
      budget,
      capacity,
      venue: venue?.name ?? draft.venueName ?? "",
      venueId: venue?.id ?? null,
      date,
      startTime,
      endTime,
      time: slot ? `${slot.label}, ${fmt12(startTime)}–${fmt12(endTime)}` : `${fmt12(startTime)}–${fmt12(endTime)}`,
      food: lovedFood ? "free" : draft.foodType || "none",
      goodies: draft.goodies || (goodiesFromKeep ? "Stickers + raffle" : lovedFood ? "Boba and stickers" : ""),
    },
    suggestions: suggestions.slice(0, 5),
  };
}

export async function suggestPlan(draft: EventDraft, orgName: string, records: RetrievedRecord[], insights: OrgSwipeInsights, venues: VenueOption[]) {
  const ids = new Set(records.map((r) => r.id));
  const fallback = () => mockPlan(draft, records, insights, venues);
  const res = await runAI({
    feature: "suggestPlan",
    system:
      "You are an event-planning copilot for a USC student org. Use ONLY the retrieved past event records and swipe insights. Pre-fill budget, capacity, venue (choose from the venue list; return its id as venueId), date (YYYY-MM-DD, at least a week out), startTime/endTime (HH:mm), a human 'time' label, food (none|free|paid) and goodies. Then give 2–5 concrete suggestions, each citing exactly one record id in 'source'. Quote real numbers, e.g. '60% of left swipes said time — try Thursday 6pm'.",
    user: `Org: ${orgName}\nToday: ${todayISO()}\n\nDRAFT:\n${draftText(draft)}\n\nORG SWIPE INSIGHTS: best slot = ${insights.bestSlot ? `${insights.bestSlot.label} (${DAYS_LONG[insights.bestSlot.day]} ${insights.bestSlot.startTime}, ${insights.bestSlot.rightRate}% right-swipe rate)` : "unknown"}; left-swipe reasons overall = ${JSON.stringify(insights.reasonTotals)}\n\nVENUES: ${venues.map((v) => `${v.id}: ${v.name} (cap ${v.capacity}, ${v.accessible ? "step-free" : "not step-free"}, $${v.costPerHour}/h)`).join("; ")}\n\nRETRIEVED RECORDS (most similar first):\n${records
      .map(
        (r) =>
          `[${r.id}] "${r.title}" ${r.date} ${DAYS[dayOfWeek(r.date)]} ${r.startTime}-${r.endTime} | ${r.eventType} | budget $${r.budget} | venue ${r.venueName} cap ${r.capacity} | checked in ${r.checkedIn} | right ${r.rightSwipes} / left ${r.leftSwipes} | left reasons ${JSON.stringify(r.leftReasons)} | rating ${r.avgRating.toFixed(1)} | keep: ${r.keep.join("; ")} | change: ${r.change.join("; ")}`,
      )
      .join("\n")}\n\nReturn {"prefill":{"budget","capacity","venue","venueId","date","startTime","endTime","time","food","goodies"},"suggestions":[{"title","detail","source"}]}.`,
    schema: PlanSchema,
    fallback,
    inputSummary: `${draft.title || "(untitled)"} · RAG over ${records.length} records: ${records.map((r) => r.title).join(", ")}`,
    summarize: (p) => `cap ${p.prefill.capacity}, ${p.prefill.time}; ${p.suggestions.map((s) => s.title).join(" | ")}`,
  });
  // Guard against hallucinated citations: drop suggestions whose source isn't a retrieved record.
  const cited = res.data.suggestions.filter((s) => ids.has(s.source));
  if (!cited.length) res.data.suggestions = fallback().suggestions;
  else res.data.suggestions = cited;
  return res;
}

// ───────────────────────── I. orgInsights ─────────────────────────
export type InsightAggregates = {
  orgName: string;
  perEvent: { title: string; rightRate: number; leftSwipes: number; reasons: Record<string, number>; foodType: string; startTime: string; date: string; avgRating: number }[];
  reasonTotals: Record<string, number>;
  bestSlotLabel: string | null;
};

export function mockTips(a: InsightAggregates) {
  const tips: { eventTitle: string | null; tip: string }[] = [];
  const low = [...a.perEvent].filter((e) => e.leftSwipes >= 5).sort((x, y) => x.rightRate - y.rightRate).slice(0, 3);
  for (const e of low) {
    const [reason, n] = Object.entries(e.reasons).sort((x, y) => y[1] - x[1])[0] ?? ["", 0];
    const share = pct(n, e.leftSwipes);
    const slotOfEvent = `${DAYS_LONG[dayOfWeek(e.date)]} ${fmt12(e.startTime)}`;
    if (reason === "time")
      tips.push({
        eventTitle: e.title,
        tip: `${share}% of passes on "${e.title}" were about timing (${DAYS[dayOfWeek(e.date)]} ${fmt12(e.startTime)}). ${a.bestSlotLabel && a.bestSlotLabel !== slotOfEvent ? `Move similar events to ${a.bestSlotLabel}.` : "Try a second session at a different time, or publish earlier so people can plan."}`,
      });
    else if (reason === "vague" || reason === "topic")
      tips.push({ eventTitle: e.title, tip: `Students found "${e.title}" ${reason === "vague" ? "unclear" : "off-topic"}. Add what they'll walk away with${e.foodType === "free" ? " and 'free food'" : ""} plus 'beginner-friendly' to the title.` });
    else if (reason === "cost") tips.push({ eventTitle: e.title, tip: `"${e.title}" lost people on price. Show what the ticket covers, or offer a free early-bird tier.` });
    else if (reason) tips.push({ eventTitle: e.title, tip: `"${e.title}" only got ${e.rightRate}% right swipes. Lead the card with the hook (food, speaker, prize) in the first 5 words.` });
  }
  if ((a.reasonTotals.vague ?? 0) > 0) tips.push({ eventTitle: null, tip: `"Unclear" came up ${a.reasonTotals.vague}× across your events — every description should say what attendees build, eat or win.` });
  if (!tips.length) tips.push({ eventTitle: null, tip: "Your cards are converting well. Keep titles short and lead with the hook." });
  return { tips: tips.slice(0, 5) };
}

export async function orgInsights(a: InsightAggregates) {
  return runAI({
    feature: "orgInsights",
    system:
      "You coach a USC student org on why students swipe left. From per-event left-swipe reasons and right-swipe rates, write 2–5 short, specific rewrite tips (titles, timing, framing), e.g. \"Add 'free food' and 'beginner-friendly' to the title.\" Reference event titles when relevant.",
    user: `Return {"tips":[{"eventTitle","tip"}]}.\nOrg: ${a.orgName}\nBest slot: ${a.bestSlotLabel ?? "unknown"}\nReason totals: ${JSON.stringify(a.reasonTotals)}\nEvents: ${a.perEvent
      .map((e) => `"${e.title}" right-rate ${e.rightRate}% left ${e.leftSwipes} reasons ${JSON.stringify(e.reasons)} food ${e.foodType} ${DAYS[dayOfWeek(e.date)]} ${e.startTime} rating ${e.avgRating.toFixed(1)}`)
      .join("\n")}`,
    schema: TipsSchema,
    fallback: () => mockTips(a),
    inputSummary: `${a.orgName}: ${a.perEvent.length} events, reasons ${JSON.stringify(a.reasonTotals)}`,
    summarize: (d) => d.tips.map((t) => t.tip).join(" | "),
  });
}

// ───────────────────────── J. clusterFeedback ─────────────────────────
export type FeedbackItem = { rating: number; tag: string; tags?: string[]; comment?: string | null };
const POSITIVE = new Set(["great-food", "well-organized", "learned-a-lot", "great-speakers", "made-friends", "would-return"]);
const NEGATIVE = new Set(["too-long", "bad-timing", "crowded", "boring", "hard-to-find"]);

export function mockThemes(items: FeedbackItem[]): Theme[] {
  const groups = new Map<string, FeedbackItem[]>();
  for (const f of items) {
    // Multi-select feedback: an item counts toward every tag the student picked.
    for (const t of f.tags?.length ? f.tags : [f.tag]) {
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(f);
    }
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([tag, list]) => {
      const withComment = list.filter((f) => f.comment && f.comment.trim().length > 3);
      // Representative quote: highest-rated for positive themes, lowest-rated for negative ones.
      const neg = NEGATIVE.has(tag);
      const quote = withComment.sort((a, b) => (neg ? a.rating - b.rating : b.rating - a.rating) || b.comment!.length - a.comment!.length)[0]?.comment ?? "";
      return {
        theme: FEEDBACK_LABELS[tag] ?? tag,
        count: list.length,
        sentiment: POSITIVE.has(tag) ? ("positive" as const) : NEGATIVE.has(tag) ? ("negative" as const) : ("neutral" as const),
        quote: truncate(quote, 160),
      };
    });
}

export async function clusterFeedback(items: FeedbackItem[], eventTitle: string) {
  if (!items.length) return { data: { themes: [] as Theme[] }, usedFallback: true, provider: "mock", model: "template-mock", latencyMs: 0 };
  return runAI({
    feature: "clusterFeedback",
    system:
      "Group event feedback (rating, tag, optional comment) into 3–5 themes. Each theme: short name, count of items, sentiment (positive|neutral|negative), and one representative verbatim quote from the comments (empty string if none).",
    user: `Return {"themes":[{"theme","count","sentiment","quote"}]}.\nEvent: ${eventTitle}\nFeedback:\n${items
      .slice(0, 150)
      .map((f) => `- ${f.rating}★ [${(f.tags?.length ? f.tags : [f.tag]).join(", ")}] ${f.comment ?? ""}`)
      .join("\n")}`,
    schema: ThemesSchema,
    fallback: () => ({ themes: mockThemes(items) }),
    inputSummary: `${items.length} feedback items for ${eventTitle}`,
    summarize: (d) => d.themes.map((t) => `${t.theme} (${t.count}, ${t.sentiment})`).join(", "),
  });
}

// ───────────────────────── K. generateRecord ─────────────────────────
export type FunnelStats = {
  rightSwipes: number;
  leftSwipes: number;
  preRegistered: number;
  registered: number;
  checkedIn: number;
  capacity: number;
  avgRating: number;
  feedbackCount: number;
};
export type RecordInput = {
  title: string;
  orgName: string;
  date: string;
  startTime: string;
  endTime: string;
  eventType: string;
  description: string;
  budget: number;
  venueName: string;
  location: string;
  foodType: string;
  goodies: string;
  capacity: number;
  ticketCost: number;
};

export function mockRecord(e: RecordInput, f: FunnelStats, reasons: Record<string, number>, themes: Theme[]) {
  const totalLeft = Object.values(reasons).reduce((a, b) => a + b, 0);
  const reasonRows = Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `| ${REASON_LABELS[r] ?? r} | ${n} | ${pct(n, totalLeft)}% |`);
  const keep: string[] = [];
  const change: string[] = [];
  for (const t of themes) {
    if (t.sentiment === "positive")
      keep.push(
        t.theme === "Great food"
          ? "Keep the food — it was the most-praised part"
          : t.theme === "Learned a lot"
            ? e.eventType === "workshop"
              ? "Keep the hands-on, practical format"
              : "Keep the substance — attendees said they learned a lot"
            : t.theme === "Well organized"
              ? "Keep the run-of-show and check-in flow"
              : `Keep ${t.theme.toLowerCase()}`,
      );
    if (t.sentiment === "negative") change.push(t.theme === "Too long" ? "Shorten the program — aim for under 2 hours" : t.theme === "Bad timing" ? "Start earlier / move to a better slot" : t.theme === "Crowded" ? "Book a bigger room or cap registrations" : t.theme === "Boring" ? "Add an interactive segment early on" : `Fix: ${t.theme}`);
  }
  const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
  if (topReason && pct(topReason[1], totalLeft) >= 35) {
    const map: Record<string, string> = {
      time: `Pick a better time slot — ${pct(topReason[1], totalLeft)}% of passes said "Bad time"`,
      vague: "Make the card concrete: say what attendees build, eat or win",
      cost: "Lower or justify the ticket price",
      topic: "Sharpen the target audience in the title",
      "not-for-me": "Target the card at a narrower audience",
    };
    if (map[topReason[0]] && !change.some((c) => c.includes("slot"))) change.push(map[topReason[0]]);
  }
  if (f.checkedIn > f.capacity * 0.95) change.push("Capacity was tight — book a larger venue");
  else if (f.capacity && f.checkedIn < f.capacity * 0.4) change.push("Room was under half full — book a smaller space");
  if (!keep.length) keep.push("Keep the QR check-in — it made attendance tracking effortless");
  const conv = (a: number, b: number) => (b ? `${pct(a, b)}%` : "—");
  const md = `# ${e.title} — Event Record

## Overview
**${e.orgName}** hosted *${e.title}* on **${formatDate(e.date)}**, ${fmt12(e.startTime)}–${fmt12(e.endTime)} at ${e.venueName || e.location || "TBD"}. ${f.checkedIn} students checked in (${pct(f.checkedIn, f.capacity)}% of capacity) and rated it **${f.avgRating.toFixed(1)} / 5** across ${f.feedbackCount} responses.

## What was planned
| Item | Plan |
|---|---|
| Budget | $${e.budget.toLocaleString()} |
| Venue | ${e.venueName || e.location || "—"} |
| Capacity | ${e.capacity} |
| Food | ${e.foodType === "free" ? "Free" : e.foodType === "paid" ? "Paid" : "None"} |
| Goodies | ${e.goodies || "—"} |
| Ticket | ${e.ticketCost ? `$${e.ticketCost}` : "Free"} |

## Funnel
| Stage | Count | Conversion |
|---|---|---|
| Swiped right | ${f.rightSwipes} | ${conv(f.rightSwipes, f.rightSwipes + f.leftSwipes)} of swipes |
| Pre-registered | ${f.preRegistered} | ${conv(f.preRegistered, f.rightSwipes)} |
| Registered | ${f.registered} | ${conv(f.registered, f.preRegistered)} |
| Checked in | ${f.checkedIn} | ${conv(f.checkedIn, f.registered)} |

## Why students passed
${totalLeft ? `${totalLeft} students swiped left.\n\n| Reason | Count | Share |\n|---|---|---|\n${reasonRows.join("\n")}` : "No left swipes recorded."}

## Attendance vs capacity
${f.checkedIn} checked in vs ${f.capacity} capacity — **${pct(f.checkedIn, f.capacity)}% full**.${f.checkedIn > f.capacity ? " Over capacity!" : ""}

## What students said
${themes.length ? themes.map((t) => `- **${t.theme}** (${t.count}, ${t.sentiment})${t.quote ? ` — "${t.quote}"` : ""}`).join("\n") : "No feedback collected."}

## Keep / Change next time
**Keep**
${keep.map((k) => `- ${k}`).join("\n")}

**Change**
${(change.length ? change : ["Nothing major — repeat the format"]).map((c) => `- ${c}`).join("\n")}
`;
  return { markdown: md, keep: keep.slice(0, 6), change: change.slice(0, 6) };
}

export async function generateRecord(e: RecordInput, f: FunnelStats, reasons: Record<string, number>, themes: Theme[]) {
  return runAI({
    feature: "generateRecord",
    system:
      "You write the official post-event record for a USC student org, in Markdown. Use EXACTLY these H2 sections in order: Overview · What was planned (budget, venue, food, goodies, capacity — as a table) · Funnel (swiped right → pre-registered → registered → checked in, with conversion % — as a table) · Why students passed (left-swipe reasons with counts and %) · Attendance vs capacity · What students said (themes with a quote each) · Keep / Change next time. Start with an H1 '<title> — Event Record'. Use only the numbers provided. Also return keep[] and change[] (2–4 short bullets each).",
    user: `Return {"markdown","keep":[],"change":[]}.\nEVENT: ${JSON.stringify(e)}\nFUNNEL: ${JSON.stringify(f)}\nLEFT-SWIPE REASONS: ${JSON.stringify(reasons)}\nFEEDBACK THEMES: ${JSON.stringify(themes)}`,
    schema: RecordSchema,
    fallback: () => mockRecord(e, f, reasons, themes),
    inputSummary: `${e.title}: ${f.checkedIn} checked in, ${f.leftSwipes} left swipes, ${themes.length} themes`,
    summarize: (r) => `${r.markdown.length} chars markdown; keep ${r.keep.length}, change ${r.change.length}`,
  });
}


// ───────────────────────── M. summarizeEvent ─────────────────────────
export type SummaryInput = EventDraft & {
  orgName: string;
  endDate?: string | null;
  campus?: string;
  format?: string;
  virtualUrl?: string | null;
  restrictions?: string[];
  coHosts?: string[];
  agenda?: { time: string; title: string; day?: string }[];
  capacity: number;
  spotsLeft?: number | null;
};

export function mockSummary(e: SummaryInput): EventSummary {
  const multiDay = e.endDate && e.endDate !== e.date;
  const when = multiDay ? `${formatDate(e.date)} ${fmt12(e.startTime)} → ${formatDate(e.endDate!)} ${fmt12(e.endTime)}` : `${formatDate(e.date)}, ${fmt12(e.startTime)}–${fmt12(e.endTime)}`;
  const where = e.format === "virtual" ? "online" : `${e.location || e.venueName || "TBD"}${e.campus && e.campus !== "UPC" ? ` (${e.campus === "HSC" ? "Health Sciences Campus" : e.campus})` : ""}${e.format === "hybrid" ? " or join online" : ""}`;
  const typeWord = (EVENT_TYPE_WORDS[e.eventType] ?? "event").toLowerCase();
  const host = e.coHosts?.length ? `${e.orgName} (with ${e.coHosts.join(", ")})` : e.orgName;
  const sentences = (e.description || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  const overview = `${host} is hosting ${/^[aeiou]/i.test(typeWord) ? "an" : "a"} ${typeWord}: **${e.title}**, ${when}, ${where}. ${sentences.slice(0, 2).join(" ")}`.trim();
  const doList: string[] = [];
  if (e.agenda?.length) for (const a of e.agenda.slice(0, 5)) doList.push(`${a.day ? a.day + " " : ""}${fmt12(a.time)} — ${a.title}`);
  else {
    for (const s2 of sentences.slice(0, 3)) doList.push(s2.replace(/\.$/, ""));
    if (!doList.length) doList.push(`Join ${e.orgName} for this ${typeWord}`);
  }
  const good: string[] = [];
  good.push(e.foodType === "free" ? "Free food provided" : e.foodType === "paid" ? "Food available for purchase" : "No food — eat before you come");
  if (e.goodies) good.push(`Goodies: ${e.goodies}`);
  good.push((e.ticketCost ?? 0) > 0 ? `Ticket: $${e.ticketCost}` : "Free entry");
  if (e.restrictions?.length) good.push(`Requirements: ${e.restrictions.map((r) => r.replace(/-/g, " ")).join(", ")}`);
  if (e.format !== "in-person" && e.virtualUrl) good.push("Online link is shared after you register");
  if (e.accessibilityNotes) good.push(e.accessibilityNotes);
  if (e.spotsLeft != null) good.push(e.spotsLeft > 0 ? `${e.spotsLeft} of ${e.capacity} spots left` : "Full — you'll join the waitlist");
  const tagWords = (e.tags ?? []).slice(0, 3).map((t) => TAG_LABELS[t] ?? t);
  const whoItsFor =
    e.audience && e.audience !== "all"
      ? `Open to ${e.audience.replace(/-/g, " ")} students${tagWords.length ? ` interested in ${tagWords.join(", ")}` : ""}.`
      : `Anyone at USC${tagWords.length ? ` curious about ${tagWords.join(", ").toLowerCase()}` : ""}${(e.tags ?? []).includes("beginner-friendly") ? " — no experience needed" : ""}.`;
  return { overview, whatYoullDo: doList.slice(0, 6), goodToKnow: good.slice(0, 8), whoItsFor };
}

const EVENT_TYPE_WORDS: Record<string, string> = {
  "info-session": "info session",
  "general-meeting": "general meeting",
  "watch-party": "watch party",
  performance: "performance",
  hackathon: "hackathon",
  conference: "conference",
  screening: "screening",
  exhibition: "exhibition",
  competition: "competition",
  fair: "fair",
  trip: "trip",
  academic: "study session",
  faith: "gathering",
  fundraiser: "fundraiser",
  volunteering: "volunteer event",
  wellness: "wellness session",
};

export async function summarizeEvent(e: SummaryInput) {
  return runAI({
    feature: "summarizeEvent",
    system:
      "You write detailed, student-friendly summaries of USC events for the event detail screen. Be concrete and accurate; never invent facts not in the data. overview: 2–3 sentences. whatYoullDo: 2–6 bullets (use the agenda if present). goodToKnow: practical bullets (food, cost, requirements, accessibility, format/links, capacity). whoItsFor: one sentence.",
    user: `Return {"overview","whatYoullDo":[],"goodToKnow":[],"whoItsFor"}.\nHost: ${e.orgName}${e.coHosts?.length ? " with " + e.coHosts.join(", ") : ""}\nEnd date: ${e.endDate ?? "same day"} | Campus: ${e.campus} | Format: ${e.format}\nRestrictions: ${(e.restrictions ?? []).join(", ") || "none"}\nAgenda: ${JSON.stringify(e.agenda ?? [])}\nSpots left: ${e.spotsLeft ?? "n/a"}\n\nEVENT:\n${draftText(e)}`,
    schema: SummarySchema,
    fallback: () => mockSummary(e),
    inputSummary: `${e.title} (${e.eventType})`,
    summarize: (d) => d.overview.slice(0, 160),
  });
}
