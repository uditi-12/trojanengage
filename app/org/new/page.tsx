"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Accessibility,
  BookOpen,
  Building,
  CheckCircle2,
  ExternalLink,
  History,
  Printer,
  Rocket,
  ShieldCheck,
  Save,
  Sparkles,
  TriangleAlert,
  Users,
  Plus,
  X,
  Wand2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { EventCardFace } from "@/components/event-card";
import { Flyer } from "@/components/flyer";
import { RoleGate } from "@/components/role-gate";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { AUDIENCES, CAMPUS_LABELS, CAMPUSES, EVENT_TYPE_LABELS, EVENT_TYPES, RESTRICTION_LABELS, RESTRICTIONS, TAG_LABELS, USC_ACCESSIBILITY_URL } from "@/lib/taxonomy";
import { addDays, dayOfWeek, toMinutes, todayISO } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { EventView } from "@/lib/types";

type Form = {
  title: string;
  description: string;
  eventType: string;
  audience: string;
  date: string;
  startTime: string;
  endTime: string;
  budget: number;
  capacity: number;
  venueId: string | null;
  location: string;
  foodType: string;
  goodies: string;
  ticketCost: number;
  websiteUrl: string;
  accessibilityNotes: string;
  tags: string[];
  flyerHeadline: string;
  flyerTagline: string;
  cardBlurb: string;
  flyerColor: string;
  flyerImageUrl: string | null;
  endDate: string;
  campus: string;
  format: string;
  virtualUrl: string;
  registrationUrl: string;
  visibility: string;
  restrictions: string[];
  coHosts: string;
  agenda: { time: string; title: string; day?: string }[];
  waitlistEnabled: boolean;
};
type Avail = {
  clashes: { id: string; title: string; orgName: string; sameOrg: boolean; sameVenue: boolean; sharedTags: string[]; when: string; venue: string }[];
  venueClash: { title: string } | null;
  audience: { basis: string; size: number };
  availability: { free: number; total: number; pctFree: number; busy: Record<string, number> };
  betterSlots: { date: string; startTime: string; endTime: string; label: string; pctFree: number }[];
};
type VenueOpt = { id: string; name: string; capacity: number; accessible: boolean; costPerHour: number; totalCost: number; fitsCapacity: boolean; fitsBudget: boolean; reasons: string[] };
type Suggestion = { title: string; detail: string; source: string };
type Plan = {
  prefill: { budget: number; capacity: number; venue: string; venueId: string | null; date?: string | null; startTime: string; endTime: string; time: string; food: string; goodies: string };
  suggestions: Suggestion[];
  records: { id: string; eventId: string; title: string; date: string; similarity: number }[];
  usedFallback: boolean;
};
type Issue = { field: string; issue: string; fix: string; suggestedValue?: string | null; severity: "high" | "medium" | "low" };

const A11Y = [
  { key: "step-free", label: "Step-free venue", text: "Step-free venue with elevator access." },
  { key: "captions", label: "Captions / ASL on request", text: "Live captions or ASL interpretation available on request (email us 5 days ahead)." },
  { key: "dietary", label: "Dietary labels", text: "All food labeled; vegetarian, vegan and gluten-free options." },
  { key: "quiet", label: "Quiet space", text: "A quiet space is available next to the main room." },
];

function nextWeekday(day: number) {
  let d = addDays(todayISO(), 7);
  while (dayOfWeek(d) !== day) d = addDays(d, 1);
  return d;
}

const EMPTY: Form = {
  title: "",
  description: "",
  eventType: "workshop",
  audience: "all",
  date: nextWeekday(2),
  startTime: "19:00",
  endTime: "21:00",
  budget: 0,
  capacity: 40,
  venueId: null,
  location: "",
  foodType: "free",
  goodies: "",
  ticketCost: 0,
  websiteUrl: "",
  accessibilityNotes: "",
  tags: [],
  flyerHeadline: "",
  flyerTagline: "",
  cardBlurb: "",
  flyerColor: "#990000",
  flyerImageUrl: null,
  endDate: "",
  campus: "UPC",
  format: "in-person",
  virtualUrl: "",
  registrationUrl: "",
  visibility: "public",
  restrictions: [],
  coHosts: "",
  agenda: [],
  waitlistEnabled: true,
};

function fromEvent(e: EventView): Form {
  return {
    title: e.title,
    description: e.description,
    eventType: e.eventType,
    audience: e.audience,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    budget: e.budget,
    capacity: e.capacity,
    venueId: e.venueId,
    location: e.location,
    foodType: e.foodType,
    goodies: e.goodies,
    ticketCost: e.ticketCost,
    websiteUrl: e.websiteUrl ?? "",
    accessibilityNotes: e.accessibilityNotes,
    tags: e.tags,
    flyerHeadline: e.flyerHeadline,
    flyerTagline: e.flyerTagline,
    cardBlurb: e.cardBlurb,
    flyerColor: e.flyerColor,
    flyerImageUrl: e.flyerImageUrl,
    endDate: e.endDate ?? "",
    campus: e.campus,
    format: e.format,
    virtualUrl: e.virtualUrl ?? "",
    registrationUrl: e.registrationUrl ?? "",
    visibility: e.visibility,
    restrictions: e.restrictions,
    coHosts: e.coHosts.join(", "),
    agenda: e.agenda,
    waitlistEnabled: e.waitlistEnabled,
  };
}

function Field({ label, children, className, highlight }: { label: string; children: React.ReactNode; className?: string; highlight?: boolean }) {
  return (
    <div className={cn("transition-all", highlight && "rounded-xl ring-2 ring-gold ring-offset-4", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NewEvent({ orgId }: { orgId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const { current } = useSession();
  const [form, setForm] = React.useState<Form>(EMPTY);
  const [eventId, setEventId] = React.useState<string | null>(search.get("id"));
  const [status, setStatus] = React.useState("draft");
  const [venues, setVenues] = React.useState<{ capacity: number; venueBudget: number; venues: VenueOpt[] } | null>(null);
  const [venueLoading, setVenueLoading] = React.useState(false);
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [planLoading, setPlanLoading] = React.useState(false);
  const [issues, setIssues] = React.useState<Issue[] | null>(null);
  const [qLoading, setQLoading] = React.useState(false);
  const [cardLoading, setCardLoading] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [filled, setFilled] = React.useState<Set<string>>(new Set());
  const [hasCard, setHasCard] = React.useState(false);

  const createdRef = React.useRef<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  React.useEffect(() => {
    const id = search.get("id");
    if (!id || id === createdRef.current) return;
    api<{ event: EventView }>(`/api/events/${id}`).then((d) => {
      setForm(fromEvent(d.event));
      setStatus(d.event.status);
      setHasCard(!!d.event.flyerHeadline);
    });
  }, [search]);

  // Budget → capacity → venue helper (debounced).
  React.useEffect(() => {
    if (!form.budget || form.budget <= 0) {
      setVenues(null);
      return;
    }
    setVenueLoading(true);
    const hours = Math.max(0.5, (toMinutes(form.endTime) - toMinutes(form.startTime)) / 60);
    const t = setTimeout(async () => {
      try {
        setVenues(await api(`/api/events/suggest-venue`, { body: { budget: form.budget, capacity: form.capacity || null, hours } }));
      } finally {
        setVenueLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [form.budget, form.capacity, form.startTime, form.endTime]);

  // Availability + conflicts: campus clashes, venue double-booking, % of interested students free.
  const [avail, setAvail] = React.useState<Avail | null>(null);
  React.useEffect(() => {
    if (!form.date || !form.startTime || !form.endTime) return;
    const t = setTimeout(async () => {
      try {
        setAvail(
          await api<Avail>("/api/events/availability", {
            body: {
              orgId,
              date: form.date,
              endDate: form.endDate && form.endDate > form.date ? form.endDate : null,
              startTime: form.startTime,
              endTime: form.endTime,
              venueId: form.venueId,
              tags: form.tags.length ? form.tags : [],
              excludeEventId: eventId,
            },
          }),
        );
      } catch {
        /* non-blocking */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [orgId, eventId, form.date, form.endDate, form.startTime, form.endTime, form.venueId, form.tags]);

  const payload = () => ({
    orgId,
    ...form,
    endDate: form.endDate && form.endDate > form.date ? form.endDate : null,
    virtualUrl: form.format !== "in-person" ? form.virtualUrl.trim() || null : null,
    registrationUrl: form.registrationUrl.trim() || null,
    coHosts: form.coHosts
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    agenda: form.agenda.filter((a) => a.title.trim() && /^\d{2}:\d{2}$/.test(a.time)),
    websiteUrl: form.websiteUrl.trim() || null,
    budget: Number(form.budget) || 0,
    capacity: Math.max(1, Number(form.capacity) || 1),
    ticketCost: Number(form.ticketCost) || 0,
  });

  const ensureSaved = async (): Promise<string> => {
    if (!form.title.trim()) {
      toast.error("Add a title first");
      throw new Error("title required");
    }
    if (eventId) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { orgId: _o, ...patch } = payload();
      await api(`/api/events/${eventId}`, { method: "PATCH", body: patch });
      return eventId;
    }
    const d = await api<{ event: EventView }>("/api/events", { body: payload() });
    createdRef.current = d.event.id;
    setEventId(d.event.id);
    router.replace(`/org/new?id=${d.event.id}`, { scroll: false });
    return d.event.id;
  };

  const flash = (keys: string[]) => {
    setFilled(new Set(keys));
    setTimeout(() => setFilled(new Set()), 2500);
  };

  const prefill = async () => {
    setPlanLoading(true);
    try {
      const p = await api<Plan>("/api/events/prefill", { body: { orgId, draft: { ...payload(), title: form.title || "New event" } } });
      setPlan(p);
      setForm((f) => ({
        ...f,
        budget: p.prefill.budget,
        capacity: p.prefill.capacity,
        venueId: p.prefill.venueId ?? f.venueId,
        location: p.prefill.venue || f.location,
        date: p.prefill.date || f.date,
        startTime: p.prefill.startTime,
        endTime: p.prefill.endTime,
        foodType: p.prefill.food,
        goodies: p.prefill.goodies || f.goodies,
      }));
      flash(["budget", "capacity", "venue", "date", "startTime", "endTime", "foodType", "goodies"]);
      toast.success(`Pre-filled from ${p.records.length} past record${p.records.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPlanLoading(false);
    }
  };

  const check = async () => {
    setQLoading(true);
    try {
      const id = await ensureSaved();
      const d = await api<{ issues: Issue[] }>(`/api/events/${id}/quality-check`, { method: "POST" });
      setIssues(d.issues);
      if (!d.issues.length) toast.success("Looks great — no issues found");
    } catch (e) {
      if ((e as Error).message !== "title required") toast.error((e as Error).message);
    } finally {
      setQLoading(false);
    }
  };

  const applyFix = (i: Issue, idx: number) => {
    if (!i.suggestedValue) return;
    const field = i.field as keyof Form;
    if (field === "accessibilityNotes") {
      setForm((f) => ({ ...f, accessibilityNotes: f.accessibilityNotes.includes(i.suggestedValue!) ? f.accessibilityNotes : `${f.accessibilityNotes} ${i.suggestedValue}`.trim() }));
    } else if (field in form) {
      setForm((f) => ({ ...f, [field]: i.suggestedValue }));
    }
    flash([String(field)]);
    setIssues((list) => list?.filter((_, j) => j !== idx) ?? null);
  };

  const generate = async () => {
    setCardLoading(true);
    try {
      const id = await ensureSaved();
      const d = await api<{ event: EventView }>(`/api/events/${id}/generate-card`, { method: "POST" });
      setForm((f) => ({ ...f, flyerHeadline: d.event.flyerHeadline, flyerTagline: d.event.flyerTagline, cardBlurb: d.event.cardBlurb, flyerColor: d.event.flyerColor, tags: d.event.tags, flyerImageUrl: d.event.flyerImageUrl }));
      setHasCard(true);
    } catch (e) {
      if ((e as Error).message !== "title required") toast.error((e as Error).message);
    } finally {
      setCardLoading(false);
    }
  };

  const saveChanges = async () => {
    setPublishing(true);
    try {
      await ensureSaved();
      toast.success(status === "draft" ? "Draft saved" : "Changes saved — students see the update right away");
    } catch (e) {
      if ((e as Error).message !== "title required") toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const id = await ensureSaved();
      await api(`/api/events/${id}/publish`, { method: "POST" });
      setStatus("published");
      toast.success("Published! It's in students' feeds now.", { action: { label: "History", onClick: () => router.push("/org/history") } });
    } catch (e) {
      if ((e as Error).message !== "title required") toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const toggleA11y = (text: string) =>
    setForm((f) => ({ ...f, accessibilityNotes: f.accessibilityNotes.includes(text) ? f.accessibilityNotes.replace(text, "").replace(/\s+/g, " ").trim() : `${f.accessibilityNotes} ${text}`.trim() }));

  const cardEvent = {
    ...form,
    org: current ? { name: current.name } : null,
  };

  return (
    <>
      <div className="no-print space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{eventId ? "Edit event" : "New event"}</h1>
            <p className="text-sm text-muted-foreground">Plan with your history, check quality, generate the card, publish.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="gold" onClick={prefill} loading={planLoading}>
              <History /> Pre-fill from history
            </Button>
            <Button variant="outline" onClick={check} loading={qLoading}>
              <ShieldCheck /> Check quality
            </Button>
            <Button variant="outline" onClick={generate} loading={cardLoading}>
              <Wand2 /> {hasCard ? "Regenerate card" : "Generate card"}
            </Button>
            {status === "published" || status === "live" ? (
              <Button onClick={saveChanges} loading={publishing}>
                <Save /> Save changes
              </Button>
            ) : (
              <>
                {eventId && (
                  <Button variant="ghost" onClick={saveChanges} loading={publishing}>
                    <Save /> Save draft
                  </Button>
                )}
                <Button onClick={publish} loading={publishing}>
                  <Rocket /> Publish
                </Button>
              </>
            )}
            {eventId && (
              <Link href={`/org/events/${eventId}`}>
                <Button variant="ghost">Details</Button>
              </Link>
            )}
          </div>
        </div>

        <AnimatePresence>
          {(planLoading || plan) && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="border-gold/60 bg-gradient-to-br from-gold-100/50 to-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cardinal" /> Suggestions from your history
                    {plan && <span className="text-xs font-normal text-muted-foreground">· prefilled {plan.prefill.time}</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {planLoading && !plan ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {plan?.suggestions.map((s, i) => {
                        const rec = plan.records.find((r) => r.id === s.source);
                        return (
                          <div key={i} className="flex flex-col rounded-2xl border bg-card p-4 shadow-soft">
                            <div className="font-semibold leading-snug">{s.title}</div>
                            <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.detail}</p>
                            {rec && (
                              <Link href={`/org/events/${rec.eventId}/record`} target="_blank" className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-cardinal-50 px-2.5 py-1 text-xs font-semibold text-cardinal hover:bg-cardinal-100">
                                <BookOpen className="h-3 w-3" /> Source: {rec.title}
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Basics</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Title" className="md:col-span-2" highlight={filled.has("title")}>
                  <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Build Your First AI Agent" />
                </Field>
                <Field label="Description" className="md:col-span-2" highlight={filled.has("description")}>
                  <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What will attendees do, learn, eat or walk away with?" />
                </Field>
                <Field label="Type">
                  <Select value={form.eventType} onChange={(e) => set("eventType", e.target.value)}>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EVENT_TYPE_LABELS[t] ?? t}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Audience">
                  <Select value={form.audience} onChange={(e) => set("audience", e.target.value)}>
                    {AUDIENCES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" highlight={filled.has("date")}>
                    <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
                  </Field>
                  <Field label="End date (multi-day)">
                    <Input type="date" value={form.endDate} min={form.date} onChange={(e) => set("endDate", e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start" highlight={filled.has("startTime")}>
                    <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
                  </Field>
                  <Field label="End" highlight={filled.has("endTime")}>
                    <Input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
                  </Field>
                </div>
                <Field label="Website (optional)" className="md:col-span-2">
                  <Input value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://" />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Format, access & schedule</CardTitle>
                <p className="text-xs text-muted-foreground">Covers hybrid talks, HSC/off-campus events, members-only GBMs, 18+/21+ events and multi-session hackathons.</p>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Format">
                  <Select value={form.format} onChange={(e) => set("format", e.target.value)}>
                    <option value="in-person">In person</option>
                    <option value="hybrid">Hybrid (in person + online)</option>
                    <option value="virtual">Virtual</option>
                  </Select>
                </Field>
                <Field label="Campus">
                  <Select value={form.campus} onChange={(e) => set("campus", e.target.value)}>
                    {CAMPUSES.map((c) => (
                      <option key={c} value={c}>
                        {CAMPUS_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                </Field>
                {form.format !== "in-person" && (
                  <Field label="Stream / Zoom link" className="md:col-span-2">
                    <Input value={form.virtualUrl} onChange={(e) => set("virtualUrl", e.target.value)} placeholder="https://usc.zoom.us/j/…" />
                  </Field>
                )}
                <Field label="Visibility">
                  <Select value={form.visibility} onChange={(e) => set("visibility", e.target.value)}>
                    <option value="public">Public</option>
                    <option value="members-only">Members only</option>
                  </Select>
                </Field>
                <Field label="Co-hosts (comma-separated)">
                  <Input value={form.coHosts} onChange={(e) => set("coHosts", e.target.value)} placeholder="e.g. Viterbi Career Connections" />
                </Field>
                <Field label="External RSVP link (optional)" className="md:col-span-2">
                  <Input value={form.registrationUrl} onChange={(e) => set("registrationUrl", e.target.value)} placeholder="EngageSC, lu.ma, Google Form…" />
                </Field>
                <div className="md:col-span-2">
                  <Label>Requirements</Label>
                  <div className="flex flex-wrap gap-2">
                    {RESTRICTIONS.map((r) => {
                      const on = form.restrictions.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => set("restrictions", on ? form.restrictions.filter((x) => x !== r) : [...form.restrictions, r])}
                          className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-cardinal bg-cardinal text-white" : "hover:border-cardinal")}
                        >
                          {RESTRICTION_LABELS[r]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" checked={form.waitlistEnabled} onChange={(e) => set("waitlistEnabled", e.target.checked)} className="h-4 w-4 accent-cardinal" /> Waitlist when full
                </label>
                <div className="md:col-span-2">
                  <Label>Agenda / run of show</Label>
                  <div className="space-y-2">
                    {form.agenda.map((a, i) => (
                      <div key={i} className="flex gap-2">
                        <Input className="w-20" value={a.day ?? ""} onChange={(e) => set("agenda", form.agenda.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)))} placeholder="Day" />
                        <Input type="time" className="w-28" value={a.time} onChange={(e) => set("agenda", form.agenda.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
                        <Input value={a.title} onChange={(e) => set("agenda", form.agenda.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="What happens" />
                        <Button size="icon" variant="ghost" onClick={() => set("agenda", form.agenda.filter((_, j) => j !== i))} aria-label="Remove">
                          <X />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => set("agenda", [...form.agenda, { time: form.startTime, title: "" }])}>
                      <Plus /> Add agenda item
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-cardinal" /> Budget → capacity → venue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Budget ($)" highlight={filled.has("budget")}>
                    <Input type="number" min={0} value={form.budget || ""} onChange={(e) => set("budget", Number(e.target.value))} placeholder="e.g. 400" />
                  </Field>
                  <Field label="Capacity" highlight={filled.has("capacity")}>
                    <Input type="number" min={1} value={form.capacity || ""} onChange={(e) => set("capacity", Number(e.target.value))} />
                  </Field>
                  <Field label="Ticket cost ($)">
                    <Input type="number" min={0} value={form.ticketCost} onChange={(e) => set("ticketCost", Number(e.target.value))} />
                  </Field>
                </div>
                {venueLoading && !venues && (
                  <div className="grid gap-2 md:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                )}
                {venues && (
                  <div>
                    <div className="mb-2 text-xs text-muted-foreground">
                      For ~{venues.capacity} people, keeping ≤ ${venues.venueBudget} for the room. Tap to pick:
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {venues.venues.slice(0, 6).map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setForm((f) => ({ ...f, venueId: v.id, location: v.name }))}
                          className={cn(
                            "rounded-2xl border p-3 text-left text-sm transition hover:border-cardinal/50",
                            form.venueId === v.id && "border-cardinal bg-cardinal-50 ring-1 ring-cardinal",
                            !v.fitsCapacity && "opacity-60",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold leading-tight">{v.name}</span>
                            {form.venueId === v.id && <CheckCircle2 className="h-4 w-4 shrink-0 text-cardinal" />}
                          </div>
                          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {v.reasons.map((r) => (
                              <li key={r} className={cn(/over|Only|Not/.test(r) && "text-amber-700")}>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Field label="Location" highlight={filled.has("venue")}>
                  <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Building + room" />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Food" highlight={filled.has("foodType")}>
                    <Select value={form.foodType} onChange={(e) => set("foodType", e.target.value)}>
                      <option value="none">None</option>
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </Select>
                  </Field>
                  <Field label="Goodies" highlight={filled.has("goodies")}>
                    <Input value={form.goodies} onChange={(e) => set("goodies", e.target.value)} placeholder="Stickers, raffle, swag…" />
                  </Field>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Accessibility className="h-4 w-4 text-cardinal" /> Accessibility
                </CardTitle>
                <a href={USC_ACCESSIBILITY_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-cardinal hover:underline">
                  USC event planner responsibilities <ExternalLink className="h-3 w-3" />
                </a>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {A11Y.map((a) => {
                    const on = form.accessibilityNotes.includes(a.text);
                    return (
                      <label key={a.key} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-sm", on && "border-cardinal bg-cardinal-50")}>
                        <input type="checkbox" checked={on} onChange={() => toggleA11y(a.text)} className="h-4 w-4 accent-cardinal" /> {a.label}
                      </label>
                    );
                  })}
                </div>
                <Field label="Accessibility notes" highlight={filled.has("accessibilityNotes")}>
                  <Textarea value={form.accessibilityNotes} onChange={(e) => set("accessibilityNotes", e.target.value)} className="min-h-[70px]" />
                </Field>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            {avail && (
              <Card className={avail.clashes.length ? "border-amber-300" : "border-emerald-200"}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-cardinal" /> Availability & conflicts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-end gap-3">
                    <div className="text-4xl font-black">{avail.availability.pctFree}%</div>
                    <div className="pb-1 text-xs text-muted-foreground">
                      of {avail.availability.total} {avail.audience.basis === "interested" ? "students interested in these tags" : "students"} are free then
                    </div>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="bg-emerald-500" style={{ width: `${avail.availability.pctFree}%` }} />
                    <div className="bg-slate-400" style={{ width: `${(avail.availability.busy.class / Math.max(1, avail.availability.total)) * 100}%` }} />
                    <div className="bg-sky-400" style={{ width: `${(avail.availability.busy.work / Math.max(1, avail.availability.total)) * 100}%` }} />
                    <div className="bg-cardinal/60" style={{ width: `${(avail.availability.busy.event / Math.max(1, avail.availability.total)) * 100}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span>🟢 free {avail.availability.free}</span>
                    <span>⚪ in class {avail.availability.busy.class}</span>
                    <span>🔵 working {avail.availability.busy.work}</span>
                    <span>🔴 at other events {avail.availability.busy.event}</span>
                  </div>
                  {avail.venueClash && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 p-2 text-xs font-medium text-red-800">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Venue already booked: {avail.venueClash.title}
                    </div>
                  )}
                  {avail.clashes.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">Same time on campus</div>
                      {avail.clashes.slice(0, 4).map((c) => (
                        <div key={c.id} className="rounded-lg bg-amber-50 px-2 py-1.5 text-xs">
                          <b>{c.title}</b> · {c.orgName} · {c.when}
                          {c.sameOrg && <span className="ml-1 font-semibold text-cardinal">· your org</span>}
                          {c.sharedTags.length > 0 && <span className="ml-1 text-amber-800">· same audience ({c.sharedTags.map((t) => TAG_LABELS[t] ?? t).join(", ")})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {avail.betterSlots.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Better slots this week</div>
                      <div className="flex flex-wrap gap-1.5">
                        {avail.betterSlots.map((b) => (
                          <button
                            key={b.date + b.startTime}
                            onClick={() => {
                              setForm((f) => ({ ...f, date: b.date, startTime: b.startTime, endTime: b.endTime }));
                              flash(["date", "startTime", "endTime"]);
                            }}
                            className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                          >
                            {b.label} · {b.pctFree}% free
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <AnimatePresence>
              {issues && issues.length > 0 && (
                <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                  <Card className="border-amber-300">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-amber-600" /> Quality check · {issues.length} issue{issues.length > 1 ? "s" : ""}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {issues.map((i, idx) => (
                        <div key={idx} className="rounded-xl border bg-amber-50/50 p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant={i.severity === "high" ? "danger" : i.severity === "medium" ? "warning" : "secondary"}>{i.field}</Badge>
                          </div>
                          <div className="mt-1 font-medium">{i.issue}</div>
                          <div className="text-xs text-muted-foreground">{i.fix}</div>
                          {i.suggestedValue && (
                            <Button size="sm" variant="outline" className="mt-2" onClick={() => applyFix(i, idx)}>
                              <Wrench /> Apply fix
                            </Button>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle>Student swipe card · live preview</CardTitle>
              </CardHeader>
              <CardContent>
                {cardLoading ? (
                  <Skeleton className="h-[480px] rounded-3xl" />
                ) : (
                  <div className="mx-auto h-[480px] max-w-[340px]">
                    <EventCardFace e={cardEvent} why={hasCard ? "Matches your interests · fits your evening" : undefined} />
                  </div>
                )}
                {hasCard && (
                  <div className="mt-4 space-y-3">
                    <Field label="Headline (≤50)">
                      <Input value={form.flyerHeadline} maxLength={50} onChange={(e) => set("flyerHeadline", e.target.value)} />
                    </Field>
                    <Field label="Tagline (≤80)">
                      <Input value={form.flyerTagline} maxLength={80} onChange={(e) => set("flyerTagline", e.target.value)} />
                    </Field>
                    <Field label="Blurb (≤140)">
                      <Textarea value={form.cardBlurb} maxLength={140} onChange={(e) => set("cardBlurb", e.target.value)} className="min-h-[60px]" />
                    </Field>
                    <div className="flex items-end gap-3">
                      <Field label="Color">
                        <input type="color" value={form.flyerColor} onChange={(e) => set("flyerColor", e.target.value)} className="h-10 w-16 cursor-pointer rounded-lg border" />
                      </Field>
                      <div className="flex flex-1 flex-wrap gap-1 pb-1">
                        {form.tags.map((t) => (
                          <Badge key={t} variant="secondary">
                            {TAG_LABELS[t] ?? t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {hasCard && (
              <Card>
                <CardHeader className="flex-row items-center justify-between pb-3">
                  <CardTitle>Printable flyer</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer /> Print
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="mx-auto max-w-[300px]">
                    <Flyer e={cardEvent} id={eventId ?? undefined} />
                  </div>
                </CardContent>
              </Card>
            )}
            {status === "published" && (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="font-semibold">It&apos;s live in the feed.</div>
                Switch to a student in the top bar to see it ranked with its &ldquo;why&rdquo; line.
              </div>
            )}
          </div>
        </div>
      </div>
      {hasCard && (
        <div className="print-only mx-auto max-w-[520px] p-6">
          <Flyer e={cardEvent} id={eventId ?? undefined} />
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <RoleGate role="org">{(id) => <NewEvent orgId={id} />}</RoleGate>
    </React.Suspense>
  );
}
