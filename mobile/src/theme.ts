export const C = {
  cardinal: "#990000",
  cardinalDark: "#7A0000",
  gold: "#FFCC00",
  bg: "#FBF9F7",
  card: "#FFFFFF",
  text: "#161B26",
  muted: "#6B7280",
  border: "#E7E2DC",
  soft: "#F3EFEA",
  amberBg: "#FFFBEB",
  amber: "#92400E",
  green: "#047857",
};
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const REASONS: [string, string][] = [
  ["time", "🕒 Bad time"],
  ["topic", "🤷 Not my topic"],
  ["cost", "💸 Too expensive"],
  ["vague", "❓ Unclear"],
  ["not-for-me", "🙅 Not for me"],
];
export const FEEDBACK: [string, string][] = [
  ["learned-a-lot", "Learned a lot"],
  ["great-food", "Great food"],
  ["well-organized", "Well organized"],
  ["great-speakers", "Great speakers"],
  ["made-friends", "Made friends"],
  ["would-return", "Would come again"],
  ["too-long", "Too long"],
  ["bad-timing", "Bad timing"],
  ["crowded", "Crowded"],
  ["hard-to-find", "Hard to find"],
  ["boring", "Boring"],
];
export const INTERESTS: [string, string][] = [
  ["ai-ml", "AI / ML"],
  ["coding", "Coding"],
  ["data-science", "Data science"],
  ["design", "Design"],
  ["entrepreneurship", "Startups"],
  ["career", "Career"],
  ["networking", "Networking"],
  ["research", "Research"],
  ["women-in-tech", "Women in tech"],
  ["culture", "Culture"],
  ["music", "Music"],
  ["dance", "Dance"],
  ["food", "Food"],
  ["social", "Social"],
  ["wellness", "Wellness"],
  ["sports", "Sports"],
  ["gaming", "Gaming"],
  ["volunteering", "Volunteering"],
  ["arts", "Arts & theater"],
  ["film", "Film"],
];
export const GOALS: [string, string][] = [
  ["network", "Network"],
  ["learn-skills", "Learn skills"],
  ["make-friends", "Make friends"],
  ["free-food", "Free food"],
  ["career", "Career"],
  ["culture", "Culture"],
];

export function fmt12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${ap}` : `${hh}${ap}`;
}
export function dow(date: string) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}
export function fmtDate(date: string) {
  const [y, mo, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return `${DAYS[dt.getUTCDay()]}, ${dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d}`;
}
export function when(e: { date: string; endDate?: string | null; startTime: string; endTime: string }) {
  if (e.endDate && e.endDate !== e.date) return `${fmtDate(e.date)} ${fmt12(e.startTime)} → ${fmtDate(e.endDate)} ${fmt12(e.endTime)}`;
  return `${fmtDate(e.date)} · ${fmt12(e.startTime)}–${fmt12(e.endTime)}`;
}
export function addDays(date: string, n: number) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}
export function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
