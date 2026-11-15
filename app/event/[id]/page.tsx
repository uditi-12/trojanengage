"use client";
import {
  Accessibility,
  ArrowLeft,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Gift,
  ListChecks,
  MapPin,
  QrCode,
  Radio,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CostBadge, FoodBadge, MatchBadge, flyerBackground, whenLabel } from "@/components/event-card";
import { useRegister } from "@/components/register-flow";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { CAMPUS_LABELS, EVENT_TYPE_LABELS, RESTRICTION_LABELS, TAG_LABELS } from "@/lib/taxonomy";
import { fmt12 } from "@/lib/time";
import type { ConflictItem, EventView, FunnelView } from "@/lib/types";

type Resp = {
  event: EventView;
  funnel: FunnelView;
  record: { id: string; approved: boolean } | null;
  me: {
    registration: { id: string; status: string } | null;
    checkedIn: boolean;
    gaveFeedback: boolean;
    swipe: string | null;
    matchPct: number | null;
    why: string | null;
    conflicts: ConflictItem[];
  } | null;
};
type Summary = { overview: string; whatYoullDo: string[]; goodToKnow: string[]; whoItsFor: string };

function bold(s: string) {
  return s.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <React.Fragment key={i}>{part}</React.Fragment>));
}

export default function EventPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { session } = useSession();
  const [d, setD] = React.useState<Resp | null>(null);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => setD(await api<Resp>(`/api/events/${params.id}`)), [params.id]);
  React.useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load, session?.id]);
  React.useEffect(() => {
    api<{ summary: Summary }>(`/api/events/${params.id}/summary`)
      .then((x) => setSummary(x.summary))
      .catch(() => {});
  }, [params.id]);
  const { register, busy: regBusy, dialog } = useRegister(() => load());

  if (!d)
    return (
      <div className="mx-auto max-w-md space-y-3 p-4">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-40" />
      </div>
    );
  const e = d.event;
  const me = d.me;
  const status = me?.registration?.status;
  const active = status && status !== "cancelled";
  const isStudent = session?.role === "student";
  const spotsLeft = Math.max(0, e.capacity - d.funnel.registered);

  const checkIn = async () => {
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; reason?: string }>("/api/checkin", { body: { eventId: e.id } });
      if (r.ok) {
        toast.success("You're checked in! 🎉");
        router.push(`/feedback/${e.id}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/events/${e.id}/save`, { method: "POST" });
      toast.success("Saved — it's on your calendar (dashed) until you register");
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-4">
      <button onClick={() => router.back()} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl" style={flyerBackground(e.flyerColor, e.flyerImageUrl)}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="glass">{EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}</Badge>
          {e.status === "live" && (
            <Badge className="bg-red-600">
              <Radio /> Live now
            </Badge>
          )}
          {e.status === "closed" && <Badge variant="glass">Ended</Badge>}
          {e.visibility === "members-only" && <Badge variant="glass">Members only</Badge>}
          {typeof me?.matchPct === "number" && <MatchBadge pct={me.matchPct} className="ml-auto" />}
        </div>
        <div className="mt-10 text-xs font-semibold uppercase tracking-wider text-white/80">
          {e.org?.name}
          {e.coHosts.length ? ` × ${e.coHosts.join(", ")}` : ""}
        </div>
        <h1 className="text-3xl font-black leading-tight">{e.flyerHeadline || e.title}</h1>
        {e.flyerTagline && <p className="mt-1 text-white/90">{e.flyerTagline}</p>}
      </div>

      {me?.why && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-cardinal-50 px-3 py-2 text-xs font-medium text-cardinal">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{me.why}</span>
        </div>
      )}
      {me && me.conflicts.length > 0 && e.status !== "closed" && (
        <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-semibold">
            <TriangleAlert className="h-3.5 w-3.5" /> Clashes with your schedule
          </div>
          <ul className="mt-1 list-disc pl-5">
            {me.conflicts.map((c, i) => (
              <li key={i}>
                {c.kind === "class" ? "Class: " : c.kind === "event" ? "Event: " : `${c.kind[0].toUpperCase() + c.kind.slice(1)}: `}
                {c.title}
                {c.when ? ` (${c.when})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isStudent && (
        <div className="mt-4 space-y-2">
          {e.status === "live" && !me?.checkedIn && (
            <Button size="lg" variant="gold" className="h-14 w-full text-lg" onClick={checkIn} loading={busy}>
              <QrCode /> I&apos;m here — check in
            </Button>
          )}
          {me?.checkedIn && !me.gaveFeedback && status === "registered" && (
            <Link href={`/feedback/${e.id}`}>
              <Button size="lg" className="w-full">
                Give 10-second feedback
              </Button>
            </Link>
          )}
          {me?.checkedIn && me.gaveFeedback && <div className="rounded-2xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-800">Checked in and feedback sent — thank you!</div>}
          {(e.status === "published" || e.status === "live") && status !== "registered" && status !== "waitlisted" && (
            <div className="flex gap-2">
              {!active && (
                <Button size="lg" variant="outline" className="flex-1" onClick={save} loading={busy}>
                  <Bookmark /> Save
                </Button>
              )}
              <Button size="lg" className="flex-1" loading={regBusy} onClick={() => register(`/api/events/${e.id}/register`, e.flyerHeadline || e.title)}>
                <CheckCircle2 /> {spotsLeft === 0 && e.waitlistEnabled ? "Join waitlist" : "Register"}
              </Button>
            </div>
          )}
          {status === "registered" && e.status === "published" && (
            <div className="rounded-2xl bg-cardinal-50 p-3 text-center text-sm font-medium text-cardinal">You&apos;re registered. Check-in opens when the event goes live.</div>
          )}
          {status === "waitlisted" && <div className="rounded-2xl bg-muted p-3 text-center text-sm font-medium">You&apos;re on the waitlist — we&apos;ll move you up if a spot opens.</div>}
          {e.registrationUrl && (
            <a href={e.registrationUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 text-xs font-semibold text-cardinal underline">
              Org also asks you to RSVP here <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
      {!isStudent && session?.role !== "org" && (
        <Link href={`/login?next=/event/${e.id}`}>
          <Button className="mt-4 w-full">Log in to save or register</Button>
        </Link>
      )}
      {session?.role === "org" && session.id === e.orgId && (
        <Link href={`/org/events/${e.id}`}>
          <Button className="mt-4 w-full">Manage this event</Button>
        </Link>
      )}

      <section className="mt-5 rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="mb-2 flex items-center gap-2 font-bold">
          <Sparkles className="h-4 w-4 text-cardinal" /> About this event
        </h2>
        {!summary ? (
          <div className="space-y-2">
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="space-y-3 text-sm leading-relaxed">
            <p>{bold(summary.overview)}</p>
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5" /> What you&apos;ll do
              </div>
              <ul className="list-disc space-y-0.5 pl-5">
                {summary.whatYoullDo.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Good to know</div>
              <ul className="list-disc space-y-0.5 pl-5">
                {summary.goodToKnow.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
            <p className="rounded-xl bg-muted/60 p-2.5 text-xs">
              <b>Who it&apos;s for:</b> {summary.whoItsFor}
            </p>
          </div>
        )}
      </section>

      <section className="mt-4 space-y-3 rounded-2xl border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 shrink-0 text-cardinal" /> {whenLabel(e)}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-cardinal" /> {e.format === "virtual" ? "Online" : e.location || e.venue?.name || "TBD"}
          {e.format !== "virtual" && <span className="text-muted-foreground">· {CAMPUS_LABELS[e.campus] ?? e.campus}</span>}
        </div>
        {e.format !== "in-person" && (
          <div className="flex items-center gap-2 text-sm">
            <Video className="h-4 w-4 shrink-0 text-cardinal" /> {e.format === "hybrid" ? "Hybrid — join in person or online" : "Virtual event"}
            {e.virtualUrl && status === "registered" && (
              <a href={e.virtualUrl} target="_blank" rel="noreferrer" className="font-semibold text-cardinal underline">
                Join link
              </a>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 shrink-0 text-cardinal" /> {d.funnel.registered} registered · {spotsLeft} of {e.capacity} spots left
        </div>
        {e.goodies && (
          <div className="flex items-center gap-2 text-sm">
            <Gift className="h-4 w-4 shrink-0 text-cardinal" /> {e.goodies}
          </div>
        )}
        {e.restrictions.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-cardinal" /> {e.restrictions.map((r) => RESTRICTION_LABELS[r] ?? r).join(" · ")}
          </div>
        )}
        {e.accessibilityNotes && (
          <div className="flex items-start gap-2 text-sm">
            <Accessibility className="mt-0.5 h-4 w-4 shrink-0 text-cardinal" /> {e.accessibilityNotes}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <FoodBadge foodType={e.foodType} />
          <CostBadge cost={e.ticketCost} />
          {e.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {TAG_LABELS[t] ?? t}
            </Badge>
          ))}
        </div>
        {e.agenda.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Agenda</div>
            <ol className="space-y-1 text-sm">
              {e.agenda.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-20 shrink-0 font-semibold tabular-nums text-cardinal">
                    {a.day ? `${a.day} ` : ""}
                    {fmt12(a.time)}
                  </span>
                  {a.title}
                </li>
              ))}
            </ol>
          </div>
        )}
        <p className="whitespace-pre-line border-t pt-3 text-sm leading-relaxed text-muted-foreground">{e.description}</p>
        {e.websiteUrl && (
          <a href={e.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-cardinal hover:underline">
            Event website <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </section>
      {dialog}
    </main>
  );
}
