// Fixed tag taxonomy used by AI card generation, ranking and the student setup chips.
export const TAGS = [
  "ai-ml",
  "coding",
  "data-science",
  "design",
  "entrepreneurship",
  "career",
  "networking",
  "research",
  "women-in-tech",
  "diversity",
  "culture",
  "music",
  "dance",
  "food",
  "social",
  "wellness",
  "sports",
  "outdoors",
  "gaming",
  "volunteering",
  "finance",
  "beginner-friendly",
  "hands-on",
  "talk",
  "festival",
  "arts",
  "film",
  "comedy",
  "faith",
  "advocacy",
  "sustainability",
] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<string, string> = {
  "ai-ml": "AI / ML",
  coding: "Coding",
  "data-science": "Data science",
  design: "Design",
  entrepreneurship: "Startups",
  career: "Career",
  networking: "Networking",
  research: "Research",
  "women-in-tech": "Women in tech",
  diversity: "Diversity",
  culture: "Culture",
  music: "Music",
  dance: "Dance",
  food: "Food",
  social: "Social",
  wellness: "Wellness",
  sports: "Sports",
  outdoors: "Outdoors",
  gaming: "Gaming",
  volunteering: "Volunteering",
  finance: "Finance",
  "beginner-friendly": "Beginner-friendly",
  "hands-on": "Hands-on",
  talk: "Talks",
  festival: "Festivals",
  arts: "Arts & theater",
  film: "Film",
  comedy: "Comedy",
  faith: "Faith & spirituality",
  advocacy: "Advocacy",
  sustainability: "Sustainability",
};

// Keyword → tag map used by mock tagging (and as a hint for embeddings).
export const TAG_KEYWORDS: Record<string, string[]> = {
  "ai-ml": ["ai", "ml", "machine learning", "llm", "llms", "neural", "gpt", "deep learning", "model", "models", "nlp", "agents", "transformer"],
  coding: ["code", "coding", "python", "hack", "hackathon", "programming", "developer", "software", "build", "github", "leetcode"],
  "data-science": ["data", "analytics", "pandas", "statistics", "visualization", "kaggle", "sql"],
  design: ["design", "ux", "ui", "figma", "product"],
  entrepreneurship: ["startup", "founder", "pitch", "venture", "entrepreneur"],
  career: ["career", "resume", "interview", "recruiting", "internship", "job", "jobs", "linkedin", "mock interview"],
  networking: ["networking", "mixer", "meet", "connect", "alumni", "industry"],
  research: ["research", "paper", "papers", "lab", "phd", "reading group"],
  "women-in-tech": ["women", "her", "female", "wic", "allies"],
  diversity: ["diversity", "inclusion", "first-gen", "community", "dei"],
  culture: ["culture", "cultural", "diwali", "holi", "heritage", "tradition", "festival", "indian", "international"],
  music: ["music", "concert", "band", "dj", "karaoke", "bollywood"],
  dance: ["dance", "garba", "bhangra", "salsa"],
  food: ["food", "pizza", "boba", "snacks", "dinner", "lunch", "samosa", "tacos", "chai", "potluck"],
  social: ["social", "party", "game night", "hangout", "mixer", "friends", "night"],
  wellness: ["wellness", "yoga", "meditation", "mental health", "self-care", "burnout"],
  sports: ["sports", "cricket", "soccer", "basketball", "tournament", "run", "5k"],
  outdoors: ["outdoor", "lawn", "hike", "beach", "picnic"],
  gaming: ["gaming", "game", "esports", "board games"],
  volunteering: ["volunteer", "service", "outreach", "mentoring", "teach"],
  finance: ["finance", "investing", "budget", "money", "fintech"],
  "beginner-friendly": ["beginner", "intro", "introduction", "101", "no experience", "first"],
  "hands-on": ["hands-on", "workshop", "build", "lab", "bring your laptop", "live coding"],
  talk: ["talk", "speaker", "panel", "fireside", "lecture", "keynote"],
  festival: ["festival", "night", "gala", "celebration", "fest"],
  arts: ["art", "arts", "theater", "theatre", "play", "musical", "gallery", "exhibit", "exhibition", "painting"],
  film: ["film", "films", "screening", "movie", "cinema", "documentary"],
  comedy: ["comedy", "improv", "stand-up", "sketch"],
  faith: ["faith", "prayer", "worship", "interfaith", "spiritual", "bible", "iftar", "diwali puja"],
  advocacy: ["advocacy", "activism", "rights", "justice", "policy", "awareness"],
  sustainability: ["sustainability", "climate", "environment", "green", "recycling"],
};

export const GOALS = ["network", "learn-skills", "make-friends", "free-food", "career", "culture"] as const;
export const GOAL_LABELS: Record<string, string> = {
  network: "Network",
  "learn-skills": "Learn skills",
  "make-friends": "Make friends",
  "free-food": "Free food",
  career: "Career",
  culture: "Culture",
};

// Covers what USC orgs, schools and departments actually run (EngageSC / calendar.usc.edu style).
export const EVENT_TYPES = [
  "workshop",
  "social",
  "cultural",
  "career",
  "talk",
  "sports",
  "performance",
  "exhibition",
  "screening",
  "hackathon",
  "competition",
  "info-session",
  "fair",
  "conference",
  "volunteering",
  "wellness",
  "faith",
  "fundraiser",
  "general-meeting",
  "watch-party",
  "trip",
  "academic",
  "other",
] as const;
export const EVENT_TYPE_LABELS: Record<string, string> = {
  workshop: "Workshop",
  social: "Social",
  cultural: "Cultural",
  career: "Career",
  talk: "Talk / panel",
  sports: "Sports / rec",
  performance: "Performance (music, theater, dance, comedy)",
  exhibition: "Exhibition / showcase",
  screening: "Film screening",
  hackathon: "Hackathon / buildathon",
  competition: "Competition / pitch",
  "info-session": "Info session",
  fair: "Fair / expo",
  conference: "Conference / summit",
  volunteering: "Volunteering / service",
  wellness: "Health & wellness",
  faith: "Faith / spiritual",
  fundraiser: "Fundraiser / gala",
  "general-meeting": "General meeting (GBM)",
  "watch-party": "Watch party / tailgate",
  trip: "Trip / excursion",
  academic: "Academic / study session",
  other: "Other",
};
export const AUDIENCES = ["all", "undergrad", "grad", "international", "major-specific", "members", "faculty-staff", "public"] as const;
export const CAMPUSES = ["UPC", "HSC", "off-campus", "online"] as const;
export const CAMPUS_LABELS: Record<string, string> = { UPC: "University Park", HSC: "Health Sciences", "off-campus": "Off campus", online: "Online" };
export const FORMATS = ["in-person", "virtual", "hybrid"] as const;
export const VISIBILITIES = ["public", "members-only"] as const;
export const RESTRICTIONS = ["usc-id-required", "18-plus", "21-plus", "members-only", "rsvp-required", "waiver-required"] as const;
export const RESTRICTION_LABELS: Record<string, string> = {
  "usc-id-required": "USC ID required",
  "18-plus": "18+",
  "21-plus": "21+",
  "members-only": "Members only",
  "rsvp-required": "RSVP required",
  "waiver-required": "Waiver required",
};
export const SCHEDULE_KINDS = ["class", "work", "personal", "other"] as const;
export const SCHEDULE_KIND_LABELS: Record<string, string> = { class: "Class", work: "Work shift", personal: "Personal", other: "Other" };
export const FOOD_TYPES = ["none", "free", "paid"] as const;
export const SWIPE_REASONS = ["time", "topic", "cost", "vague", "not-for-me"] as const;
export const REASON_LABELS: Record<string, string> = {
  time: "Bad time",
  topic: "Not my topic",
  cost: "Too expensive",
  vague: "Unclear",
  "not-for-me": "Not for me",
};
export const FEEDBACK_TAGS = ["great-food", "too-long", "well-organized", "bad-timing", "learned-a-lot", "crowded", "boring", "great-speakers", "made-friends", "hard-to-find", "would-return"] as const;
export const FEEDBACK_LABELS: Record<string, string> = {
  "great-food": "Great food",
  "too-long": "Too long",
  "well-organized": "Well organized",
  "bad-timing": "Bad timing",
  "learned-a-lot": "Learned a lot",
  crowded: "Crowded",
  boring: "Boring",
  "great-speakers": "Great speakers",
  "made-friends": "Made friends",
  "hard-to-find": "Hard to find",
  "would-return": "Would come again",
};

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const USC_ACCESSIBILITY_URL =
  "https://accessibility.usc.edu/accessibility-at-usc/event-accessibility/event-planner-responsibility/";

export function normalizeTags(tags: string[]): string[] {
  const set = new Set<string>();
  for (const t of tags) {
    const k = t.toLowerCase().trim().replace(/\s+/g, "-");
    if ((TAGS as readonly string[]).includes(k)) set.add(k);
  }
  return Array.from(set);
}

export function keywordTags(text: string, max = 6): string[] {
  const lower = " " + text.toLowerCase().replace(/[^a-z0-9+\- ]/g, " ") + " ";
  const scores: [string, number][] = [];
  for (const [tag, kws] of Object.entries(TAG_KEYWORDS)) {
    let s = 0;
    for (const kw of kws) if (lower.includes(" " + kw + " ") || lower.includes(" " + kw + "s ")) s += 1;
    if (s > 0) scores.push([tag, s]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  return scores.slice(0, max).map(([t]) => t);
}
