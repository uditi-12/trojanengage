/* eslint-disable no-console */
// Seed data with realistic USC flavor. Deterministic (fixed PRNG), dates relative to today.
// Run: npx prisma db seed
import { PrismaClient } from "@prisma/client";
import { embed } from "../lib/ai/client";
import { disableAiLogging } from "../lib/ai/log";
import { mockRecord, mockThemes } from "../lib/ai/features";
import { normalize } from "../lib/ai/localEmbed";
import { toJSON } from "../lib/json";
import { applyFeedbackWeights, applySwipeWeights, initialTagWeights, profileText } from "../lib/services/preferences";
import { eventText } from "../lib/services/serialize";
import { recordEmbeddingText } from "../lib/services/records";
import { getFunnels } from "../lib/services/funnel";
import { conflictBetween } from "../lib/services/conflicts";
import { addDays, dayOfWeek, fmt12, freeSlotFit, todayISO, type FreeSlot } from "../lib/time";
import { round } from "../lib/utils";
import { hashPassword } from "../lib/auth";
import { importUscSchedule, recomputeFreeSlots } from "../lib/services/schedule";
import { applySwipeContext } from "../lib/services/preferences";
import { liveTodayEvents } from "./live-today";

export const DEMO_PASSWORD = "trojan123";

const prisma = new PrismaClient();
disableAiLogging();

// ───────── deterministic PRNG ─────────
let seed = 20261114;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const TODAY = todayISO();
/** The most recent date `daysAgo`+ days back that falls on `weekday` (0=Sun). */
function pastDate(daysAgo: number, weekday: number) {
  let d = addDays(TODAY, -daysAgo);
  while (dayOfWeek(d) !== weekday) d = addDays(d, -1);
  return d;
}
/** The first date ≥ `inDays` from today that falls on `weekday`. */
function nextDate(inDays: number, weekday: number) {
  let d = addDays(TODAY, inDays);
  while (dayOfWeek(d) !== weekday) d = addDays(d, 1);
  return d;
}
const avatar = (name: string) => `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=ffdfbf,ffd5dc,c0aede,d1d4f9,b6e3f4`;
const daysAgoDate = (n: number) => new Date(Date.now() - n * 86_400_000);

export async function main() {
  console.log("🌱 Seeding TrojanEngage…");
  // Wipe in FK-safe order.
  await prisma.aiLog.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.scheduleBlock.deleteMany();
  await prisma.eventRecord.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.swipe.deleteMany();
  await prisma.event.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.student.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.org.deleteMany();

  // ───────── Venues ─────────
  const venueData = [
    { id: "v_ballroom", name: "Ronald Tutor Campus Center Ballroom", capacity: 400, accessible: true, costPerHour: 150 },
    { id: "v_seminar", name: "Leavey Library Seminar Room 3A", capacity: 40, accessible: true, costPerHour: 0 },
    { id: "v_lawn", name: "McCarthy Quad Lawn", capacity: 500, accessible: true, costPerHour: 40 },
    { id: "v_library", name: "Doheny Library Classroom 241", capacity: 60, accessible: true, costPerHour: 0 },
    { id: "v_auditorium", name: "Taper Hall 101 Auditorium", capacity: 200, accessible: true, costPerHour: 60 },
    { id: "v_lab", name: "SAL Computer Lab 127", capacity: 50, accessible: true, costPerHour: 0 },
    { id: "v_lounge", name: "Parkside International Lounge", capacity: 90, accessible: true, costPerHour: 25 },
    { id: "v_studio", name: "Old Annex Basement Studio", capacity: 35, accessible: false, costPerHour: 0 },
  ];
  await prisma.venue.createMany({ data: venueData });
  const venueName = Object.fromEntries(venueData.map((v) => [v.id, v.name]));

  // ───────── Orgs ─────────
  await prisma.org.createMany({
    data: [
      { id: "org_ai", name: "AI@USC", logoUrl: "🤖", category: "Tech · Student AI club", description: "USC's student AI club: hands-on workshops, paper reading groups and build nights for anyone curious about machine learning." },
      { id: "org_isa", name: "Indian Students Association", logoUrl: "🪔", category: "Cultural", description: "Celebrating Indian culture at USC with festivals, food, dance and a home away from home for 1,500+ members." },
      { id: "org_wic", name: "Women in Computing", logoUrl: "👩‍💻", category: "Tech · Professional", description: "Community, mentorship and career prep for women and allies in computing at USC." },
    ],
  });

  // ───────── Students ─────────
  type S = { id: string; name: string; major: string; year: string; interests: string[]; goals: string[]; freeSlots: FreeSlot[]; onboarded: boolean };
  const eve = (days: number[], start = "18:00", end = "21:00") => days.map((day) => ({ day, start, end }));
  const students: S[] = [
    { id: "stu_priya", name: "Priya Sharma", major: "Computer Science", year: "Junior", interests: ["ai-ml", "coding", "culture", "food"], goals: ["learn-skills", "free-food"], freeSlots: [...eve([2, 4]), { day: 6, start: "12:00", end: "17:00" }], onboarded: true },
    { id: "stu_marcus", name: "Marcus Johnson", major: "Business Administration", year: "Senior", interests: ["entrepreneurship", "career", "networking", "finance"], goals: ["network", "career"], freeSlots: eve([1, 3], "17:00", "20:00"), onboarded: true },
    { id: "stu_sofia", name: "Sofia Martinez", major: "Data Science (MS)", year: "Masters", interests: ["data-science", "ai-ml", "women-in-tech", "research"], goals: ["career", "learn-skills"], freeSlots: eve([2, 3, 4]), onboarded: true },
    { id: "stu_arjun", name: "Arjun Mehta", major: "Electrical Engineering (MS)", year: "Masters", interests: ["culture", "music", "dance", "food"], goals: ["culture", "make-friends"], freeSlots: [...eve([5], "18:00", "23:00"), { day: 6, start: "11:00", end: "23:00" }], onboarded: true },
    { id: "stu_emily", name: "Emily Chen", major: "Design", year: "Sophomore", interests: ["design", "social", "wellness", "entrepreneurship"], goals: ["make-friends", "learn-skills"], freeSlots: [...eve([1, 3]), { day: 0, start: "12:00", end: "16:00" }], onboarded: true },
    { id: "stu_jamal", name: "Jamal Wright", major: "Computer Science", year: "Freshman", interests: ["gaming", "coding", "sports", "ai-ml"], goals: ["make-friends", "free-food"], freeSlots: eve([2, 4, 5], "18:00", "22:00"), onboarded: true },
    { id: "stu_aisha", name: "Aisha Khan", major: "Neuroscience", year: "Junior", interests: ["research", "wellness", "volunteering", "diversity"], goals: ["learn-skills", "culture"], freeSlots: [{ day: 1, start: "12:00", end: "14:00" }, { day: 3, start: "12:00", end: "14:00" }, ...eve([4])], onboarded: true },
    // The "new student" for the demo: not onboarded, no swipes, but has friends with signal.
    { id: "stu_alex", name: "Alex Rivera", major: "Computer Science", year: "Sophomore", interests: [], goals: [], freeSlots: [], onboarded: false },
  ];
  const pw = hashPassword(DEMO_PASSWORD);
  for (const s of students) {
    const email = `${s.name.split(" ")[0].toLowerCase()}@usc.edu`;
    await prisma.student.create({
      data: { id: s.id, name: s.name, email, passwordHash: pw, avatarUrl: avatar(s.name), major: s.major, year: s.year, interests: toJSON(s.interests), goals: toJSON(s.goals), freeSlots: toJSON(s.freeSlots), onboarded: s.onboarded, createdAt: daysAgoDate(60) },
    });
  }
  // Background "campus" students (hidden from the role switcher via the sim_ prefix) to give past events realistic volume.
  const FIRST = ["Aarav", "Sofia", "Jordan", "Mei", "Diego", "Fatima", "Noah", "Ananya", "Liam", "Zoe", "Kenji", "Isabella", "Omar", "Chloe", "Ravi", "Emma", "Tariq", "Grace", "Leo", "Nia", "Ishaan", "Hana", "Mateo", "Ivy", "Rohan", "Lucia", "Ethan", "Sana", "Kai", "Maya"];
  const LAST = ["Patel", "Garcia", "Kim", "Nguyen", "Johnson", "Singh", "Chen", "Lopez", "Shah", "Williams", "Park", "Rao", "Reddy", "Brown", "Iyer"];
  const bg: string[] = [];
  for (let i = 0; i < 90; i++) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
    const id = `sim_seed_${String(i).padStart(2, "0")}`;
    bg.push(id);
    await prisma.student.create({ data: { id, name, avatarUrl: avatar(name + i), major: pick(["Computer Science", "Business", "Data Science", "EE", "Biology", "Cinema", "Economics"]), year: pick(["Freshman", "Sophomore", "Junior", "Senior", "Masters"]), onboarded: true } });
  }

  // ───────── Friendships (12) ─────────
  const friends: [string, string][] = [
    ["stu_alex", "stu_priya"],
    ["stu_alex", "stu_sofia"],
    ["stu_alex", "stu_jamal"],
    ["stu_alex", "stu_emily"],
    ["stu_priya", "stu_sofia"],
    ["stu_priya", "stu_arjun"],
    ["stu_priya", "stu_jamal"],
    ["stu_marcus", "stu_emily"],
    ["stu_marcus", "stu_sofia"],
    ["stu_arjun", "stu_aisha"],
    ["stu_emily", "stu_aisha"],
    ["stu_jamal", "stu_sofia"],
  ];
  for (const [a, b] of friends) await prisma.friendship.create({ data: { studentId: a, friendId: b } });

  // ───────── Events ─────────
  type E = {
    id: string;
    orgId: string;
    title: string;
    description: string;
    eventType: string;
    date: string;
    startTime: string;
    endTime: string;
    venueId: string;
    foodType: string;
    goodies?: string;
    budget: number;
    capacity: number;
    ticketCost?: number;
    audience?: string;
    tags: string[];
    accessibilityNotes?: string;
    endDate?: string;
    campus?: string;
    format?: string;
    virtualUrl?: string;
    visibility?: string;
    restrictions?: string[];
    coHosts?: string[];
    agenda?: { time: string; title: string; day?: string }[];
    color: string;
    headline?: string;
    tagline?: string;
    blurb?: string;
    status: "published" | "live" | "closed";
  };
  const A11Y = "Step-free venue with elevator access. Request captions or ASL by emailing the org 5 days ahead.";

  const past: E[] = [
    {
      id: "ev_llm_intro",
      orgId: "org_ai",
      title: "Intro to LLMs Workshop",
      description: "A beginner-friendly, hands-on intro to large language models: tokens, embeddings and prompting. Bring a laptop — you'll build a tiny chatbot with the OpenAI API. Pizza provided.",
      eventType: "workshop",
      date: pastDate(45, 5),
      startTime: "20:00",
      endTime: "22:00",
      venueId: "v_lab",
      foodType: "free",
      goodies: "Stickers",
      budget: 300,
      capacity: 50,
      tags: ["ai-ml", "coding", "hands-on", "beginner-friendly", "food"],
      accessibilityNotes: A11Y,
      color: "#990000",
      status: "closed",
    },
    {
      id: "ev_pytorch",
      orgId: "org_ai",
      title: "PyTorch Hands-on Night",
      description: "Train your first neural net in PyTorch, step by step, with mentors in the room. No ML experience needed. Free boba + snacks.",
      eventType: "workshop",
      date: pastDate(24, 4),
      startTime: "18:00",
      endTime: "20:00",
      venueId: "v_lab",
      foodType: "free",
      goodies: "Boba, stickers",
      budget: 350,
      capacity: 50,
      tags: ["ai-ml", "coding", "hands-on", "beginner-friendly", "food"],
      accessibilityNotes: A11Y,
      color: "#7a0000",
      status: "closed",
    },
    {
      id: "ev_ethics",
      orgId: "org_ai",
      title: "AI Ethics Panel: Who's Accountable?",
      description: "Faculty from Viterbi and Annenberg debate bias, copyright and accountability in generative AI, then take your questions.",
      eventType: "talk",
      date: pastDate(60, 3),
      startTime: "17:00",
      endTime: "18:30",
      venueId: "v_auditorium",
      foodType: "free",
      budget: 400,
      capacity: 120,
      tags: ["ai-ml", "talk", "research"],
      accessibilityNotes: A11Y,
      color: "#4C1D95",
      status: "closed",
    },
    {
      id: "ev_diwali",
      orgId: "org_isa",
      title: "Diwali Night 2025",
      description: "ISA's biggest night of the year: performances, a dance showcase, rangoli, diyas and a full Indian dinner.",
      eventType: "cultural",
      date: pastDate(385, 6),
      startTime: "19:00",
      endTime: "23:00",
      venueId: "v_ballroom",
      foodType: "free",
      goodies: "Diyas to take home",
      budget: 4500,
      capacity: 350,
      ticketCost: 10,
      tags: ["culture", "festival", "dance", "food", "music"],
      accessibilityNotes: A11Y,
      color: "#C2185B",
      status: "closed",
    },
    {
      id: "ev_holi",
      orgId: "org_isa",
      title: "Holi on the Lawn",
      description: "Colors, music and thandai on McCarthy Quad. Wear white! Color packets included.",
      eventType: "cultural",
      date: pastDate(240, 6),
      startTime: "12:00",
      endTime: "15:00",
      venueId: "v_lawn",
      foodType: "free",
      goodies: "Color packets",
      budget: 1500,
      capacity: 300,
      tags: ["culture", "festival", "outdoors", "music", "social"],
      color: "#D97706",
      status: "closed",
    },
    {
      id: "ev_resume",
      orgId: "org_wic",
      title: "Resume Review & Recruiter Mixer",
      description: "Get your resume reviewed 1:1 by engineers from Google, Snap and Riot, then mingle with recruiters. Bring a printed copy.",
      eventType: "career",
      date: pastDate(30, 2),
      startTime: "18:00",
      endTime: "20:00",
      venueId: "v_library",
      foodType: "free",
      budget: 500,
      capacity: 60,
      tags: ["career", "networking", "women-in-tech", "food"],
      accessibilityNotes: A11Y,
      color: "#1E3A8A",
      status: "closed",
    },
  ];

  const live: E = {
    id: "ev_prompt_lab",
    orgId: "org_ai",
    title: "Prompt Engineering Lab",
    description: "Live, hands-on lab: you'll iterate on prompts for a real task (summarizing course reviews) and learn evaluation tricks. Laptops required. Free tacos.",
    eventType: "workshop",
    date: TODAY,
    startTime: "18:00",
    endTime: "20:00",
    venueId: "v_lab",
    foodType: "free",
    goodies: "Stickers",
    budget: 320,
    capacity: 50,
    tags: ["ai-ml", "hands-on", "coding", "beginner-friendly", "food"],
    accessibilityNotes: A11Y,
    color: "#990000",
    status: "live",
  };

  // A second live event (orgs can run more than one at once).
  const live2: E = {
    id: "ev_study_jam",
    orgId: "org_ai",
    title: "AI Study Jam: Midterm Review",
    description: "Drop-in study session for CSCI 567 / DSCI 552 midterms. TAs and AI@USC officers answer questions; bring your problem sets. Snacks.",
    eventType: "academic",
    date: TODAY,
    startTime: "19:00",
    endTime: "21:00",
    venueId: "v_library",
    foodType: "free",
    budget: 80,
    capacity: 60,
    tags: ["ai-ml", "data-science", "research", "food"],
    accessibilityNotes: A11Y,
    color: "#3F6212",
    status: "live",
  };
  // More live events today, running until 11pm.
  const liveLate: E[] = liveTodayEvents(TODAY);
  const tue1 = nextDate(2, 2);
  const upcoming: E[] = [
    { id: "ev_paper", orgId: "org_ai", title: "LLM Paper Reading Group: Attention Is All You Need", description: "We read and discuss the transformer paper together — no prior reading required, slides provided. Chai and samosas.", eventType: "talk", date: tue1, startTime: "18:00", endTime: "19:30", venueId: "v_seminar", foodType: "free", budget: 120, capacity: 40, tags: ["ai-ml", "research", "talk", "food"], color: "#4C1D95", status: "published" },
    { id: "ev_wic_ml", orgId: "org_wic", title: "WiC x Google: Breaking into ML Careers", description: "A Google ML engineer shares how she broke into ML, then live resume tips and Q&A. Dinner provided.", eventType: "career", date: tue1, startTime: "18:30", endTime: "20:00", venueId: "v_library", foodType: "free", budget: 450, capacity: 60, tags: ["career", "ai-ml", "women-in-tech", "networking", "food"], color: "#1E3A8A", status: "published" },
    { id: "ev_hack", orgId: "org_ai", title: "Build Night: Ship an AI Side Project", description: "Three hours to build and demo an AI side project with mentors on hand. Teams form on the spot; best demo wins AirPods.", eventType: "workshop", date: nextDate(3, 4), startTime: "18:00", endTime: "21:00", venueId: "v_lab", foodType: "free", goodies: "AirPods prize", budget: 600, capacity: 50, tags: ["ai-ml", "coding", "hands-on", "entrepreneurship", "food"], color: "#990000", status: "published" },
    { id: "ev_garba", orgId: "org_isa", title: "Navratri Garba Night", description: "Learn garba from ISA dancers, then dance the night away. Dandiya sticks provided; Indian snacks for sale.", eventType: "cultural", date: nextDate(3, 5), startTime: "19:30", endTime: "22:30", venueId: "v_ballroom", foodType: "paid", budget: 2000, capacity: 300, ticketCost: 5, tags: ["culture", "dance", "music", "festival", "social"], color: "#C2185B", status: "published" },
    { id: "ev_wellness", orgId: "org_wic", title: "Burnout-Proof: Wellness Workshop for Techies", description: "A counselor-led workshop on managing midterm stress, with guided breathing and tea.", eventType: "workshop", date: nextDate(4, 3), startTime: "12:00", endTime: "13:00", venueId: "v_seminar", foodType: "free", budget: 100, capacity: 35, tags: ["wellness", "women-in-tech", "hands-on"], color: "#047857", status: "published" },
    { id: "ev_startup", orgId: "org_wic", title: "Founder Fireside: From Class Project to Startup", description: "Two USC alumni founders on going from a class project to a funded startup. Networking after.", eventType: "talk", date: nextDate(5, 1), startTime: "18:00", endTime: "19:30", venueId: "v_auditorium", foodType: "free", budget: 300, capacity: 150, tags: ["entrepreneurship", "talk", "networking", "career"], color: "#B45309", status: "published" },
    { id: "ev_cricket", orgId: "org_isa", title: "ISA Cricket Tournament", description: "Six-a-side tennis-ball cricket on the lawn. Sign up as a team or get placed on one. All skill levels.", eventType: "sports", date: nextDate(5, 0), startTime: "10:00", endTime: "14:00", venueId: "v_lawn", foodType: "free", budget: 250, capacity: 80, tags: ["sports", "outdoors", "culture", "social"], color: "#047857", status: "published" },
    { id: "ev_kaggle", orgId: "org_ai", title: "Kaggle Speedrun: Data Science in 90 Minutes", description: "Tackle a beginner Kaggle competition in teams — pandas, feature engineering and a leaderboard. Pizza.", eventType: "workshop", date: nextDate(7, 2), startTime: "19:00", endTime: "20:30", venueId: "v_lab", foodType: "free", budget: 250, capacity: 50, tags: ["data-science", "ai-ml", "coding", "hands-on", "food"], color: "#990000", status: "published" },
    { id: "ev_mock", orgId: "org_wic", title: "Mock Technical Interviews", description: "Practice a 30-minute technical interview with an industry engineer and get written feedback.", eventType: "career", date: nextDate(7, 2), startTime: "19:00", endTime: "21:00", venueId: "v_library", foodType: "none", budget: 80, capacity: 40, tags: ["career", "coding", "women-in-tech"], color: "#1E3A8A", status: "published" },
    { id: "ev_bolly", orgId: "org_isa", title: "Bollywood Karaoke Night", description: "Sing your favorite Bollywood hits (or just cheer). Lyrics on screen, chai and pakoras free.", eventType: "social", date: nextDate(8, 3), startTime: "20:00", endTime: "22:00", venueId: "v_lounge", foodType: "free", budget: 200, capacity: 90, tags: ["music", "culture", "social", "food"], color: "#D97706", status: "published" },
    { id: "ev_design", orgId: "org_wic", title: "Figma for Engineers: UX Crash Course", description: "Hands-on Figma basics: wireframe and prototype an app screen in an hour. Bring a laptop.", eventType: "workshop", date: nextDate(9, 4), startTime: "17:00", endTime: "18:30", venueId: "v_studio", foodType: "none", budget: 60, capacity: 30, tags: ["design", "hands-on", "beginner-friendly"], color: "#6D28D9", status: "published" },
    { id: "ev_agents", orgId: "org_ai", title: "Agents 101: Tools, Memory & Planning", description: "Talk + demo on how LLM agents call tools and plan, with live code you can run afterwards.", eventType: "talk", date: nextDate(9, 4), startTime: "18:00", endTime: "19:30", venueId: "v_auditorium", foodType: "free", budget: 200, capacity: 120, tags: ["ai-ml", "talk", "coding"], color: "#4C1D95", status: "published" },
    { id: "ev_volunteer", orgId: "org_wic", title: "Code Camp: Teach Kids Scratch", description: "Volunteer to teach South LA middle schoolers their first Scratch game. Training provided; transport arranged.", eventType: "other", date: nextDate(12, 6), startTime: "10:00", endTime: "13:00", venueId: "v_library", foodType: "free", budget: 150, capacity: 25, tags: ["volunteering", "coding", "diversity"], color: "#0F766E", status: "published" },
    { id: "ev_potluck", orgId: "org_isa", title: "Friendsgiving Potluck for International Students", description: "Not going home for Thanksgiving? Bring a dish from home (or don't) and meet people. ISA covers the turkey and paneer.", eventType: "social", date: nextDate(11, 4), startTime: "18:30", endTime: "21:00", venueId: "v_lounge", foodType: "free", budget: 400, capacity: 90, audience: "international", tags: ["food", "social", "culture"], color: "#B45309", status: "published" },
    { id: "ev_finance", orgId: "org_wic", title: "Money 101: Investing on a Student Budget", description: "Roth IRAs, index funds and budgeting apps explained by a USC Marshall alum. Snacks.", eventType: "talk", date: nextDate(13, 1), startTime: "18:00", endTime: "19:00", venueId: "v_seminar", foodType: "free", budget: 90, capacity: 40, tags: ["finance", "career", "talk"], color: "#047857", status: "published" },
    { id: "ev_gaming", orgId: "org_ai", title: "AI vs Humans: Game Night", description: "Play board games and video games against reinforcement-learning bots our members trained. Snacks + prizes.", eventType: "social", date: nextDate(14, 5), startTime: "19:00", endTime: "22:00", venueId: "v_lounge", foodType: "free", goodies: "Prizes", budget: 220, capacity: 80, tags: ["gaming", "ai-ml", "social", "food"], color: "#374151", status: "published" },
    { id: "ev_research", orgId: "org_ai", title: "Undergrad Research Fair: Find an ML Lab", description: "Meet PhD students from 10 Viterbi ML labs who are recruiting undergrads. Bring questions, not a resume.", eventType: "career", date: nextDate(15, 3), startTime: "12:00", endTime: "14:00", venueId: "v_ballroom", foodType: "free", budget: 500, capacity: 200, tags: ["research", "ai-ml", "career", "networking"], color: "#1E3A8A", status: "published" },
    { id: "ev_rangoli", orgId: "org_isa", title: "Rangoli & Chai Workshop", description: "Learn to draw rangoli patterns with colored powder, then relax over masala chai.", eventType: "cultural", date: nextDate(16, 0), startTime: "14:00", endTime: "16:00", venueId: "v_lawn", foodType: "free", budget: 150, capacity: 50, tags: ["culture", "design", "hands-on", "food"], color: "#C2185B", status: "published" },
    { id: "ev_hackher", orgId: "org_wic", title: "HackHer Mini-Hackathon", description: "A 6-hour beginner hackathon for women and non-binary students. Workshops, mentors, meals and prizes.", eventType: "workshop", date: nextDate(19, 6), startTime: "10:00", endTime: "16:00", venueId: "v_ballroom", foodType: "free", goodies: "Swag + prizes", budget: 1800, capacity: 150, tags: ["coding", "women-in-tech", "hands-on", "beginner-friendly", "food"], color: "#BE185D", status: "published" },
    // Campus event shapes the old schema couldn't hold: multi-day hackathon, hybrid talk, HSC campus, members-only GBM.
    {
      id: "ev_buildathon",
      orgId: "org_ai",
      title: "Trojan AI Buildathon (36h)",
      description: "A 36-hour build weekend: Friday workshops, then teams build AI projects through Sunday demos. Mentors from industry, meals provided, prizes for the top 3 teams.",
      eventType: "hackathon",
      date: nextDate(9, 5),
      endDate: addDays(nextDate(9, 5), 2),
      startTime: "17:00",
      endTime: "14:00",
      venueId: "v_ballroom",
      foodType: "free",
      goodies: "Swag, prizes, all meals",
      budget: 6000,
      capacity: 200,
      tags: ["ai-ml", "coding", "hands-on", "entrepreneurship", "food"],
      restrictions: ["18-plus", "rsvp-required", "usc-id-required"],
      coHosts: ["Viterbi Career Connections"],
      agenda: [
        { day: "Fri", time: "17:00", title: "Check-in + kickoff dinner" },
        { day: "Fri", time: "19:00", title: "Workshops: LLM APIs, RAG, deployment" },
        { day: "Sat", time: "09:00", title: "Build day, mentor office hours" },
        { day: "Sun", time: "11:00", title: "Demos + judging" },
        { day: "Sun", time: "13:30", title: "Awards" },
      ],
      accessibilityNotes: A11Y,
      color: "#7A0000",
      status: "published",
    },
    {
      id: "ev_ai_med",
      orgId: "org_ai",
      title: "AI in Medicine: Talk at Keck",
      description: "Keck School of Medicine researchers on how ML reads scans and predicts readmissions, then Q&A. Hosted at the Health Sciences Campus; free shuttle from UPC.",
      eventType: "talk",
      date: nextDate(6, 3),
      startTime: "17:30",
      endTime: "19:00",
      venueId: "v_auditorium",
      foodType: "free",
      budget: 250,
      capacity: 120,
      campus: "HSC",
      tags: ["ai-ml", "research", "talk"],
      coHosts: ["Keck School of Medicine"],
      color: "#4C1D95",
      status: "published",
    },
    {
      id: "ev_isa_gbm",
      orgId: "org_isa",
      title: "ISA General Body Meeting",
      description: "Members-only GBM: Diwali Night 2026 committee sign-ups, budget update and chai.",
      eventType: "general-meeting",
      date: nextDate(4, 2),
      startTime: "19:00",
      endTime: "20:00",
      venueId: "v_lounge",
      foodType: "free",
      budget: 60,
      capacity: 80,
      audience: "members",
      visibility: "members-only",
      restrictions: ["members-only"],
      tags: ["culture", "social"],
      color: "#475569",
      status: "published",
    },
    { id: "ev_diwali26", orgId: "org_isa", title: "Diwali Night 2026", description: "ISA's Diwali Night returns: dance showcase, live music, diyas and a full Indian dinner. Shorter program this year!", eventType: "cultural", date: nextDate(20, 6), startTime: "18:00", endTime: "21:30", venueId: "v_ballroom", foodType: "free", goodies: "Diyas", budget: 5000, capacity: 380, ticketCost: 10, tags: ["culture", "festival", "dance", "food", "music"], color: "#C2185B", status: "published" },
  ];

  // Make the fireside hybrid (stream link for students at HSC or off campus).
  const fireside = upcoming.find((e) => e.id === "ev_startup")!;
  fireside.format = "hybrid";
  fireside.virtualUrl = "https://usc.zoom.us/j/0000000000";
  const all = [...past, live, live2, ...liveLate, ...upcoming];
  const vectors = await embed(all.map((e) => eventText({ ...e, tags: e.tags })), { log: false });
  const vecById = new Map<string, number[]>();
  for (let i = 0; i < all.length; i++) {
    const e = all[i];
    vecById.set(e.id, vectors[i]);
    const words = e.title.split(" ");
    await prisma.event.create({
      data: {
        id: e.id,
        orgId: e.orgId,
        title: e.title,
        description: e.description,
        foodType: e.foodType,
        goodies: e.goodies ?? "",
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        budget: e.budget,
        capacity: e.capacity,
        venueId: e.venueId,
        location: venueName[e.venueId],
        eventType: e.eventType,
        audience: e.audience ?? "all",
        endDate: e.endDate ?? null,
        campus: e.campus ?? "UPC",
        format: e.format ?? "in-person",
        virtualUrl: e.virtualUrl ?? null,
        visibility: e.visibility ?? "public",
        restrictions: toJSON(e.restrictions ?? []),
        coHosts: toJSON(e.coHosts ?? []),
        agenda: toJSON(e.agenda ?? []),
        ticketCost: e.ticketCost ?? 0,
        tags: toJSON(e.tags),
        accessibilityNotes: e.accessibilityNotes ?? "",
        flyerHeadline: e.headline ?? (e.title.length <= 50 ? e.title : words.slice(0, 5).join(" ")),
        flyerTagline: e.tagline ?? `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek(e.date)]} ${fmt12(e.startTime)} · ${e.foodType === "free" ? "free food" : e.foodType === "paid" ? "food for sale" : "no food"} · ${e.ticketCost ? `$${e.ticketCost}` : "free entry"}`,
        cardBlurb: e.blurb ?? e.description.split(/(?<=[.!?])\s/)[0].slice(0, 140),
        flyerColor: e.color,
        embedding: toJSON(vecById.get(e.id)!.map((x) => round(x, 5))),
        status: e.status,
        createdAt: daysAgoDate(e.status === "closed" ? 400 : 3),
      },
    });
  }

  // ───────── Swipe helpers ─────────
  const swipeRows: { studentId: string; eventId: string; direction: string; reason: string | null; createdAt: Date }[] = [];
  const regRows: { studentId: string; eventId: string; status: string }[] = [];
  const checkRows: { studentId: string; eventId: string }[] = [];
  const fbRows: { studentId: string; eventId: string; rating: number; tag: string; comment: string | null }[] = [];
  const taken = new Map<string, Set<string>>(); // eventId -> students used
  const use = (eventId: string, studentId: string) => {
    if (!taken.has(eventId)) taken.set(eventId, new Set());
    const s = taken.get(eventId)!;
    if (s.has(studentId)) return false;
    s.add(studentId);
    return true;
  };
  const freeBg = (eventId: string) => shuffle(bg).filter((id) => !taken.get(eventId)?.has(id));

  type Plan = {
    right: number;
    left: Record<string, number>;
    preReg: number; // share of right swipes that pre-registered
    reg: number; // share of pre-registered that confirmed
    check: number; // share of registered that checked in
    feedback: { tag: string; rating: number; comment: string | null }[];
    realRight?: string[];
  };
  function populate(e: E, p: Plan, ageDays: number) {
    const rightIds = [...(p.realRight ?? []).filter((id) => use(e.id, id))];
    for (const id of freeBg(e.id)) {
      if (rightIds.length >= p.right) break;
      if (use(e.id, id)) rightIds.push(id);
    }
    for (const id of rightIds) swipeRows.push({ studentId: id, eventId: e.id, direction: "right", reason: null, createdAt: daysAgoDate(ageDays + rand() * 6) });
    const leftReasons = Object.entries(p.left).flatMap(([r, n]) => Array(n).fill(r) as string[]);
    for (const reason of leftReasons) {
      const id = freeBg(e.id)[0];
      if (!id) break;
      use(e.id, id);
      swipeRows.push({ studentId: id, eventId: e.id, direction: "left", reason, createdAt: daysAgoDate(ageDays + rand() * 6) });
    }
    const pre = rightIds.slice(0, Math.round(rightIds.length * p.preReg));
    const regN = Math.round(pre.length * p.reg);
    pre.forEach((id, i) => regRows.push({ studentId: id, eventId: e.id, status: i < regN ? "registered" : "pre-registered" }));
    const checked = pre.slice(0, Math.round(regN * p.check));
    for (const id of checked) checkRows.push({ studentId: id, eventId: e.id });
    p.feedback.slice(0, checked.length).forEach((f, i) => fbRows.push({ studentId: checked[i], eventId: e.id, ...f }));
    return checked;
  }
  const fb = (tag: string, rating: number, comment: string | null, n = 1) => Array.from({ length: n }, () => ({ tag, rating, comment }));

  // Past events — hand-tuned so the history tells a story.
  populate(past[0], {
    // Intro to LLMs: Friday 8pm → 60% of passes say "time"
    right: 30,
    left: { time: 24, topic: 6, "not-for-me": 6, vague: 4 },
    preReg: 0.9,
    reg: 0.8,
    check: 0.75,
    realRight: ["stu_priya", "stu_jamal"],
    feedback: [
      ...fb("learned-a-lot", 5, "Finally understood embeddings, want a part 2"),
      ...fb("bad-timing", 3, "Friday 8pm is rough, start earlier please"),
      ...fb("learned-a-lot", 4, "Great hands-on part"),
      ...fb("bad-timing", 2, "Too late on a Friday"),
      ...fb("great-food", 4, "Pizza was clutch"),
      ...fb("learned-a-lot", 5, null),
      ...fb("bad-timing", 3, "Would come again if it was on a weeknight"),
      ...fb("too-long", 3, "Setup took forever"),
      ...fb("learned-a-lot", 4, "Loved building the chatbot"),
      ...fb("bad-timing", 3, null),
      ...fb("well-organized", 4, "Mentors were super helpful"),
      ...fb("learned-a-lot", 5, null),
      ...fb("great-food", 4, null),
    ],
  }, 45);
  populate(past[1], {
    // PyTorch Thursday 6pm → the best slot
    right: 46,
    left: { topic: 4, time: 2, "not-for-me": 3 },
    preReg: 0.9,
    reg: 0.85,
    check: 0.9,
    realRight: ["stu_priya", "stu_sofia", "stu_jamal"],
    feedback: [
      ...fb("learned-a-lot", 5, "Best workshop I've been to at USC"),
      ...fb("well-organized", 5, "Started on time, clear steps"),
      ...fb("great-food", 5, "Boba was a great touch"),
      ...fb("learned-a-lot", 5, "Trained my first neural net!"),
      ...fb("crowded", 3, "Lab was packed, needed more seats"),
      ...fb("learned-a-lot", 4, null),
      ...fb("great-food", 4, null),
      ...fb("well-organized", 5, null),
      ...fb("learned-a-lot", 5, "Mentor ratio was perfect"),
      ...fb("crowded", 3, "Hard to find a seat"),
      ...fb("learned-a-lot", 5, null),
      ...fb("well-organized", 4, "Loved the step-by-step notebook"),
      ...fb("great-food", 5, null),
      ...fb("learned-a-lot", 4, null),
      ...fb("learned-a-lot", 5, "Please do a part 2 on CNNs"),
    ],
  }, 24);
  populate(past[2], {
    right: 24,
    left: { topic: 7, vague: 5, time: 3 },
    preReg: 0.8,
    reg: 0.75,
    check: 0.8,
    realRight: ["stu_sofia", "stu_aisha"],
    feedback: [
      ...fb("learned-a-lot", 4, "Great debate on copyright"),
      ...fb("boring", 2, "Too much lecture, not enough Q&A"),
      ...fb("learned-a-lot", 5, null),
      ...fb("too-long", 3, "Opening remarks dragged"),
      ...fb("well-organized", 4, null),
      ...fb("boring", 3, null),
      ...fb("learned-a-lot", 4, "Wish we had more student questions"),
      ...fb("great-food", 4, null),
      ...fb("learned-a-lot", 4, "Good mix of perspectives"),
      ...fb("boring", 3, "Needed more student voices"),
      ...fb("well-organized", 4, null),
    ],
  }, 60);
  populate(past[3], {
    // Diwali Night 2025: loved the food; start earlier; shorten the speeches
    right: 62,
    left: { cost: 5, time: 6, "not-for-me": 4 },
    preReg: 0.95,
    reg: 0.9,
    check: 0.9,
    realRight: ["stu_arjun", "stu_priya", "stu_aisha"],
    feedback: [
      ...fb("great-food", 5, "Loved the food, the biryani was amazing"),
      ...fb("too-long", 3, "Shorten the speeches"),
      ...fb("bad-timing", 3, "Start earlier, it ended so late"),
      ...fb("great-food", 5, "Loved the food"),
      ...fb("well-organized", 4, "Dance showcase was incredible"),
      ...fb("too-long", 2, "Speeches went on forever, shorten the speeches"),
      ...fb("great-food", 5, "Felt like home, loved the food"),
      ...fb("bad-timing", 3, "Please start earlier"),
      ...fb("great-food", 5, null),
      ...fb("crowded", 3, "Dinner line was huge"),
      ...fb("too-long", 3, "Four hours is too long"),
      ...fb("great-food", 4, "Best Diwali food on campus"),
      ...fb("well-organized", 5, null),
      ...fb("bad-timing", 3, "Start earlier so we can catch the metro"),
      ...fb("great-food", 5, null),
      ...fb("too-long", 3, null),
    ],
  }, 385);
  populate(past[4], {
    right: 40,
    left: { time: 5, "not-for-me": 4, topic: 2 },
    preReg: 0.85,
    reg: 0.8,
    check: 0.85,
    realRight: ["stu_arjun", "stu_emily"],
    feedback: [
      ...fb("great-food", 5, "Thandai was perfect"),
      ...fb("well-organized", 5, "So much fun, great music"),
      ...fb("crowded", 3, "Ran out of color packets"),
      ...fb("great-food", 4, null),
      ...fb("well-organized", 4, null),
      ...fb("learned-a-lot", 4, "Loved learning the history of Holi"),
      ...fb("great-food", 5, null),
      ...fb("well-organized", 5, null),
      ...fb("crowded", 3, null),
      ...fb("great-food", 5, "The thandai station was the best part"),
      ...fb("well-organized", 4, "Easy check-in"),
      ...fb("bad-timing", 3, "Noon was hot, start later in the afternoon"),
      ...fb("great-food", 5, null),
    ],
  }, 240);
  populate(past[5], {
    right: 36,
    left: { time: 4, topic: 3, vague: 2 },
    preReg: 0.9,
    reg: 0.85,
    check: 0.85,
    realRight: ["stu_sofia", "stu_marcus"],
    feedback: [
      ...fb("learned-a-lot", 5, "The 1:1 review was so useful"),
      ...fb("crowded", 3, "Too crowded near the recruiters"),
      ...fb("well-organized", 5, null),
      ...fb("learned-a-lot", 5, "Got an interview from this!"),
      ...fb("great-food", 4, null),
      ...fb("crowded", 3, "Bigger room next time"),
      ...fb("learned-a-lot", 4, null),
      ...fb("well-organized", 4, "Loved the name tags by company"),
      ...fb("learned-a-lot", 5, null),
      ...fb("great-food", 4, "Snacks were great"),
      ...fb("learned-a-lot", 5, "Recruiters actually read my resume"),
      ...fb("crowded", 2, "Lines for the Google table were too long"),
    ],
  }, 30);
  // Live event: partway through its funnel (Simulate adds the rest during the demo).
  populate(live, { right: 26, left: { time: 4, topic: 3, vague: 2, "not-for-me": 2 }, preReg: 0.85, reg: 0.6, check: 0.35, realRight: ["stu_sofia"], feedback: [] }, 4);
  populate(live2, { right: 18, left: { time: 3, topic: 2 }, preReg: 0.9, reg: 0.7, check: 0.4, realRight: ["stu_priya"], feedback: [] }, 3);
  for (const e of liveLate) populate(e, { right: 14, left: { time: 2, topic: 2 }, preReg: 0.85, reg: 0.7, check: 0.4, feedback: [] }, 3);

  // Upcoming events — real students swipe by affinity; background students add volume.
  const realOnboarded = students.filter((s) => s.onboarded);
  for (const s of realOnboarded) {
    const scored = upcoming
      .map((e) => {
        const overlap = e.tags.filter((t) => s.interests.includes(t)).length;
        const fit = freeSlotFit(s.freeSlots, e.date, e.startTime, e.endTime);
        const food = s.goals.includes("free-food") && e.foodType === "free" ? 0.5 : 0;
        return { e, aff: overlap + fit + food + rand() * 0.4, fit, overlap };
      })
      .sort((a, b) => b.aff - a.aff);
    const rights = scored.slice(0, 6);
    const lefts = scored.slice(6, 10);
    for (const { e } of rights) {
      if (!use(e.id, s.id)) continue;
      swipeRows.push({ studentId: s.id, eventId: e.id, direction: "right", reason: null, createdAt: daysAgoDate(1 + rand() * 2) });
      regRows.push({ studentId: s.id, eventId: e.id, status: rand() < 0.4 ? "registered" : "pre-registered" });
    }
    for (const { e, fit, overlap } of lefts) {
      if (!use(e.id, s.id)) continue;
      const reason = fit === 0 ? "time" : overlap === 0 ? pick(["topic", "not-for-me"]) : (e.ticketCost ?? 0) > 0 ? "cost" : pick(["vague", "topic"]);
      swipeRows.push({ studentId: s.id, eventId: e.id, direction: "left", reason, createdAt: daysAgoDate(1 + rand() * 2) });
    }
  }
  for (const e of upcoming) {
    const n = 3 + Math.floor(rand() * 5);
    for (const id of freeBg(e.id).slice(0, n)) {
      use(e.id, id);
      const right = rand() < 0.62;
      swipeRows.push({ studentId: id, eventId: e.id, direction: right ? "right" : "left", reason: right ? null : pick(["time", "time", "topic", "vague", "cost", "not-for-me"]), createdAt: daysAgoDate(rand() * 3) });
      if (right && rand() < 0.8) regRows.push({ studentId: id, eventId: e.id, status: rand() < 0.35 ? "registered" : "pre-registered" });
    }
  }

  await prisma.swipe.createMany({ data: swipeRows });
  await prisma.registration.createMany({ data: regRows });
  await prisma.checkIn.createMany({ data: checkRows });
  // Multi-select feedback: some students picked a second tag.
  const SECOND: Record<string, string[]> = { "learned-a-lot": ["would-return", "great-speakers"], "great-food": ["made-friends", "would-return"], "well-organized": ["would-return"], "too-long": ["boring"], "bad-timing": ["hard-to-find"], crowded: ["hard-to-find"], boring: ["too-long"] };
  await prisma.feedback.createMany({
    data: fbRows.map((f) => {
      const extra = rand() < 0.4 ? pick(SECOND[f.tag] ?? []) : undefined;
      return { ...f, tags: toJSON(extra ? [f.tag, extra] : [f.tag]) };
    }),
  });

  // Conflict flags for real students' registrations.
  const evById = new Map(all.map((e) => [e.id, e]));
  for (const s of realOnboarded) {
    const regs = await prisma.registration.findMany({ where: { studentId: s.id } });
    for (const r of regs) {
      const e = evById.get(r.eventId)!;
      if (e.status === "closed") continue;
      const other = regs.find((o) => o.id !== r.id && evById.get(o.eventId)!.status !== "closed" && conflictBetween(evById.get(o.eventId)!, e));
      if (other) {
        const oe = evById.get(other.eventId)!;
        await prisma.registration.update({ where: { id: r.id }, data: { hasConflict: true, conflictNote: `Overlaps with "${oe.title}" (${fmt12(oe.startTime)}–${fmt12(oe.endTime)})` } });
      }
    }
  }

  // ───────── Approved EventRecords for past events ─────────
  const funnels = await getFunnels(past.map((e) => e.id));
  const orgName: Record<string, string> = { org_ai: "AI@USC", org_isa: "Indian Students Association", org_wic: "Women in Computing" };
  const recTexts: string[] = [];
  const recData: { eventId: string; markdown: string; stats: string; themes: string; reasons: string; keepChange: string }[] = [];
  for (const e of past) {
    const f = funnels[e.id];
    const themes = mockThemes(fbRows.filter((x) => x.eventId === e.id));
    const rec = mockRecord(
      { title: e.title, orgName: orgName[e.orgId], date: e.date, startTime: e.startTime, endTime: e.endTime, eventType: e.eventType, description: e.description, budget: e.budget, venueName: venueName[e.venueId], location: venueName[e.venueId], foodType: e.foodType, goodies: e.goodies ?? "", capacity: e.capacity, ticketCost: e.ticketCost ?? 0 },
      f,
      f.reasons,
      themes,
    );
    recTexts.push(recordEmbeddingText(e.title, rec.markdown));
    recData.push({ eventId: e.id, markdown: rec.markdown, stats: toJSON(f), themes: toJSON(themes), reasons: toJSON(f.reasons), keepChange: toJSON({ keep: rec.keep, change: rec.change }) });
  }
  const recVecs = await embed(recTexts, { log: false });
  for (let i = 0; i < recData.length; i++) {
    const r = recData[i];
    await prisma.eventRecord.create({
      data: { eventId: r.eventId, markdown: r.markdown, stats: r.stats, feedbackThemes: r.themes, swipeInsights: r.reasons, keepChange: r.keepChange, embedding: toJSON(recVecs[i].map((x) => round(x, 5))), approved: true, createdAt: daysAgoDate(20) },
    });
  }

  // ───────── Pre-compute tagWeights + profile embeddings from seeded swipes ─────────
  const profileTexts: string[] = [];
  const weightsById = new Map<string, Record<string, number>>();
  const ctxById = new Map<string, { slot: Record<string, number>; type: Record<string, number> }>();
  for (const s of realOnboarded) {
    let w = initialTagWeights(s.interests, s.goals);
    const mine = swipeRows.filter((x) => x.studentId === s.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const sw of mine) w = applySwipeWeights(w, evById.get(sw.eventId)!.tags, sw.direction as "left" | "right", sw.reason);
    for (const f of fbRows.filter((x) => x.studentId === s.id)) w = applyFeedbackWeights(w, evById.get(f.eventId)!.tags, f.rating);
    weightsById.set(s.id, w);
    let ctx = { slot: {} as Record<string, number>, type: {} as Record<string, number> };
    for (const sw of mine) ctx = applySwipeContext(ctx.slot, ctx.type, evById.get(sw.eventId)!, sw.direction as "left" | "right", sw.reason);
    ctxById.set(s.id, ctx);
    profileTexts.push(profileText({ interests: toJSON(s.interests), goals: toJSON(s.goals), tagWeights: toJSON(w) }));
  }
  const profVecs = await embed(profileTexts, { log: false });
  for (let i = 0; i < realOnboarded.length; i++) {
    const s = realOnboarded[i];
    let v = profVecs[i];
    const rights = swipeRows.filter((x) => x.studentId === s.id && x.direction === "right");
    for (const r of rights) {
      const ev = vecById.get(r.eventId)!;
      if (ev.length === v.length) v = normalize(v.map((x, j) => 0.7 * x + 0.3 * ev[j]));
    }
    await prisma.student.update({ where: { id: s.id }, data: { tagWeights: toJSON(weightsById.get(s.id)), slotWeights: toJSON(ctxById.get(s.id)!.slot), typeWeights: toJSON(ctxById.get(s.id)!.type), profileEmbedding: toJSON(v.map((x) => round(x, 5))), profileSwipeMark: 0 } });
  }

  // ───────── Class schedules (simulated USC import) + work/personal blocks ─────────
  for (const st of students.filter((x) => x.onboarded)) await importUscSchedule(st.id);
  for (const id of bg) await importUscSchedule(id);
  await prisma.scheduleBlock.createMany({
    data: [
      { studentId: "stu_priya", kind: "work", source: "manual", title: "Leavey Library desk shift", location: "Leavey Library", day: 3, start: "18:00", end: "21:00" },
      { studentId: "stu_arjun", kind: "work", source: "manual", title: "TA office hours (EE 503)", location: "EEB 248", day: 2, start: "13:00", end: "15:00" },
      { studentId: "stu_marcus", kind: "work", source: "manual", title: "Off-campus internship (Downtown LA)", location: "Off campus", day: 5, start: "09:00", end: "17:00" },
      { studentId: "stu_emily", kind: "personal", source: "manual", title: "Dance team practice", location: "Lyon Center", day: 1, start: "19:00", end: "21:00" },
    ],
  });
  for (const id of ["stu_priya", "stu_arjun", "stu_marcus", "stu_emily"]) await recomputeFreeSlots(id);
  // Background students get topic/slot/type weights from their swipes too (powers org availability by interest).
  for (const id of bg) {
    let w: Record<string, number> = {};
    let ctx = { slot: {} as Record<string, number>, type: {} as Record<string, number> };
    for (const sw of swipeRows.filter((x) => x.studentId === id)) {
      const ev = evById.get(sw.eventId)!;
      w = applySwipeWeights(w, ev.tags, sw.direction as "left" | "right", sw.reason);
      ctx = applySwipeContext(ctx.slot, ctx.type, ev, sw.direction as "left" | "right", sw.reason);
    }
    await prisma.student.update({ where: { id }, data: { tagWeights: toJSON(w), slotWeights: toJSON(ctx.slot), typeWeights: toJSON(ctx.type) } });
  }

  const counts = {
    students: await prisma.student.count({ where: { NOT: { id: { startsWith: "sim_" } } } }),
    backgroundStudents: bg.length,
    events: await prisma.event.count(),
    swipes: await prisma.swipe.count(),
    registrations: await prisma.registration.count(),
    checkIns: await prisma.checkIn.count(),
    feedback: await prisma.feedback.count(),
    records: await prisma.eventRecord.count(),
    scheduleBlocks: await prisma.scheduleBlock.count(),
    friendships: await prisma.friendship.count(),
  };
  console.log("✅ Seeded:", counts);
  const ll = funnels["ev_llm_intro"];
  const timeShare = Math.round(((ll.reasons.time ?? 0) / Math.max(1, ll.leftSwipes)) * 100);
  console.log(`   Intro to LLMs: ${ll.leftSwipes} left swipes, ${timeShare}% said "time"`);
  console.log(`   Student logins: priya@usc.edu, alex@usc.edu (new), … — password "${DEMO_PASSWORD}"`);
  console.log(`   Live events: "${live.title}" (${live.id}) and "${live2.title}" (${live2.id}) — AI@USC`);
  console.log(`   Live until 11pm: ${liveLate.map((e) => `"${e.title}"`).join(", ")}`);
}

// Auto-run unless imported by a test harness.
if (!process.env.TROJANENGAGE_SEED_IMPORT) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
