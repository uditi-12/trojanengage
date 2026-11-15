"use client";
import { motion } from "framer-motion";
import { Lock, PartyPopper, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client";
import { FEEDBACK_LABELS, FEEDBACK_TAGS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

function FeedbackCard({ eventId }: { eventId: string }) {
  const [title, setTitle] = React.useState("");
  const [rating, setRating] = React.useState(0);
  const [tags, setTags] = React.useState<string[]>([]);
  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= 4 ? cur : [...cur, t]));
  const [comment, setComment] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [eligible, setEligible] = React.useState<{ ok: boolean; reason?: string } | null>(null);
  React.useEffect(() => {
    api<{ ok: boolean; reason?: string }>(`/api/feedback/eligibility?eventId=${encodeURIComponent(eventId)}`)
      .then(setEligible)
      .catch((e) => setEligible({ ok: false, reason: (e as Error).message }));
  }, [eventId]);
  React.useEffect(() => {
    api<{ event: { title: string; flyerHeadline: string } }>(`/api/events/${eventId}`)
      .then((d) => setTitle(d.event.flyerHeadline || d.event.title))
      .catch(() => {});
  }, [eventId]);
  const submit = async () => {
    if (!rating || !tags.length) return;
    setBusy(true);
    try {
      await api("/api/feedback", { body: { eventId, rating, tags, comment: comment.trim() || null } });
      setSent(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (sent)
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-md p-8 text-center">
        <PartyPopper className="mx-auto h-14 w-14 text-cardinal" />
        <h1 className="mt-4 text-2xl font-extrabold">Thanks! That makes the next one better.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your feed learns from this too.</p>
        <Link href="/student/feed">
          <Button className="mt-6">Back to feed</Button>
        </Link>
      </motion.div>
    );
  if (!eligible)
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center p-8">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-cardinal border-t-transparent" />
      </main>
    );
  if (!eligible.ok)
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-extrabold">Feedback is for attendees</h1>
        <p className="mt-1 text-sm text-muted-foreground">{eligible.reason}</p>
        <p className="mt-1 text-xs text-muted-foreground">We only ask students who registered and checked in, so orgs get feedback they can trust.</p>
        <Link href={`/event/${eventId}`}>
          <Button className="mt-6">View event</Button>
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-md p-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-cardinal">10-second feedback</div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3 w-3" /> Verified attendee
          </span>
        </div>
        <h1 className="mt-1 text-xl font-extrabold leading-tight">How was {title || "the event"}?</h1>
        <div className="my-5 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className="transition active:scale-90">
              <Star className={cn("h-10 w-10", n <= rating ? "fill-gold text-gold" : "text-muted-foreground/40")} />
            </button>
          ))}
        </div>
        <div className="mb-1 text-xs font-semibold text-muted-foreground">Pick all that apply (up to 4)</div>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_TAGS.map((t) => (
            <Chip key={t} active={tags.includes(t)} onClick={() => toggleTag(t)}>
              {FEEDBACK_LABELS[t]}
            </Chip>
          ))}
        </div>
        <Input className="mt-4" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="One line (optional)" maxLength={200} />
        <Button size="lg" className="mt-5 w-full" disabled={!rating || !tags.length} loading={busy} onClick={submit}>
          Submit
        </Button>
      </motion.div>
    </main>
  );
}

export default function Page({ params }: { params: { id: string } }) {
  return <RoleGate role="student">{() => <FeedbackCard eventId={params.id} />}</RoleGate>;
}
