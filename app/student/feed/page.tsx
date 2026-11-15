"use client";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Heart, MessageSquareHeart, RotateCcw, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { EventCardFace } from "@/components/event-card";
import { RoleGate } from "@/components/role-gate";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { REASON_LABELS, SWIPE_REASONS } from "@/lib/taxonomy";
import type { RankedEventView } from "@/lib/types";

type SwipeResp = {
  conflict: { eventId: string; title: string; note: string } | null;
  swipeCount: number;
  smarter: { sentence: string } | null;
};

const REASON_EMOJI: Record<string, string> = { time: "🕒", topic: "🤷", cost: "💸", vague: "❓", "not-for-me": "🙅" };

type FeedCard = RankedEventView & { dwellMs?: number };

function SwipeCard({ e, isTop, depth, onSwipe }: { e: RankedEventView; isTop: boolean; depth: number; onSwipe: (dir: "left" | "right") => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);
  const likeOpacity = useTransform(x, [30, 130], [0, 1]);
  const nopeOpacity = useTransform(x, [-130, -30], [1, 0]);
  const onDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (info.offset.x > 120 || info.velocity.x > 700) onSwipe("right");
    else if (info.offset.x < -120 || info.velocity.x < -700) onSwipe("left");
  };
  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, rotate, zIndex: 10 - depth, touchAction: "pan-y" }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.92, y: 24, opacity: 0 }}
      animate={{ scale: 1 - depth * 0.04, y: depth * 14, opacity: depth > 2 ? 0 : 1 }}
      variants={{ exit: (dir: "left" | "right") => ({ x: dir === "right" ? 600 : -600, rotate: dir === "right" ? 25 : -25, opacity: 0, transition: { duration: 0.3 } }) }}
      exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      whileTap={isTop ? { cursor: "grabbing" } : undefined}
    >
      <EventCardFace
        e={e}
        why={e.why}
        friends={e.friendsGoing}
        conflicts={e.conflicts}
        isNew={e.isNew}
        matchPct={e.matchPct}
        detailsHref={isTop ? `/event/${e.id}?from=feed` : undefined}
        className={isTop ? "cursor-grab" : ""}
      />
      {isTop && (
        <>
          <motion.div style={{ opacity: likeOpacity }} className="pointer-events-none absolute left-5 top-6 -rotate-12 rounded-xl border-4 border-emerald-500 bg-white/80 px-3 py-1 text-2xl font-black text-emerald-600">
            GOING
          </motion.div>
          <motion.div style={{ opacity: nopeOpacity }} className="pointer-events-none absolute right-5 top-6 rotate-12 rounded-xl border-4 border-red-500 bg-white/80 px-3 py-1 text-2xl font-black text-red-600">
            PASS
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

function Feed({ id }: { id: string }) {
  const router = useRouter();
  const { current } = useSession();
  React.useEffect(() => {
    if (current && "onboarded" in current && !current.onboarded) router.replace("/student/setup");
  }, [current, router]);
  const [queue, setQueue] = React.useState<RankedEventView[] | null>(null);
  const [exitDir, setExitDir] = React.useState<"left" | "right">("right");
  const [pendingLeft, setPendingLeft] = React.useState<FeedCard | null>(null);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [swipes, setSwipes] = React.useState(0);
  const busy = React.useRef(false);
  const [pending, setPending] = React.useState<{ eventId: string; title: string; orgName: string }[]>([]);
  const [liveNow, setLiveNow] = React.useState<{ id: string; title: string }[]>([]);
  const shownAt = React.useRef<number>(Date.now());
  React.useEffect(() => {
    api<{ pending: { eventId: string; title: string; orgName: string }[] }>(`/api/students/${id}/pending-feedback`)
      .then((d) => setPending(d.pending))
      .catch(() => {});
    api<{ registrations: { status: string; checkedIn: boolean; event: { id: string; title: string; flyerHeadline: string; status: string } }[] }>(`/api/students/${id}/events`)
      .then((d) => setLiveNow(d.registrations.filter((r) => r.event.status === "live" && !r.checkedIn && r.status !== "cancelled").map((r) => ({ id: r.event.id, title: r.event.flyerHeadline || r.event.title }))))
      .catch(() => {});
  }, [id]);
  React.useEffect(() => {
    shownAt.current = Date.now();
  }, [queue?.[0]?.id]);

  const load = React.useCallback(async () => {
    const d = await api<{ events: RankedEventView[] }>(`/api/students/${id}/feed`);
    setQueue(d.events);
  }, [id]);
  React.useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load]);

  const afterSwipe = React.useCallback(
    async (res: SwipeResp) => {
      setSwipes((n) => n + 1);
      if (res.smarter) {
        setBanner(res.smarter.sentence);
        // Re-rank the remaining cards with the updated tag weights + profile embedding.
        const d = await api<{ events: RankedEventView[] }>(`/api/students/${id}/feed`);
        setQueue(d.events);
      }
    },
    [id],
  );

  const send = React.useCallback(
    async (e: FeedCard, direction: "left" | "right", reason?: string | null) => {
      try {
        const res = await api<SwipeResp>("/api/swipes", {
          body: { studentId: id, eventId: e.id, direction, reason: reason ?? null, matchPct: e.matchPct, rankPos: e.rankPos, dwellMs: e.dwellMs ?? null, source: "feed" },
        });
        if (direction === "right") {
          if (res.conflict)
            toast.warning(
              <div>
                <div className="font-semibold">Saved {e.flyerHeadline || e.title}</div>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  <TriangleAlert className="h-3 w-3" /> Conflicts with {res.conflict.title}
                </div>
              </div>,
            );
          else toast.success(`Saved ${e.flyerHeadline || e.title}`, { description: "Register from My Events — it'll show on your calendar." });
        }
        await afterSwipe(res);
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [id, afterSwipe],
  );

  const swipe = React.useCallback(
    (dir: "left" | "right") => {
      if (!queue?.length || busy.current || pendingLeft) return;
      busy.current = true;
      const top = { ...queue[0], dwellMs: Math.min(3_600_000, Date.now() - shownAt.current) };
      setExitDir(dir);
      // Let React commit the exit direction before removing the card.
      requestAnimationFrame(() => {
        setQueue((q) => (q ? q.slice(1) : q));
        busy.current = false;
        if (dir === "right") send(top, "right");
        else setPendingLeft(top);
      });
    },
    [queue, pendingLeft, send],
  );

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowRight") swipe("right");
      if (ev.key === "ArrowLeft") swipe("left");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swipe]);

  const chooseReason = (reason: string | null) => {
    const e = pendingLeft;
    setPendingLeft(null);
    if (e) send(e, "left", reason);
  };

  return (
    <div className="px-4 pt-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">For you</h1>
          <p className="text-xs text-muted-foreground">Swipe right to save · left to pass · tap details for the full summary</p>
        </div>
        {queue && <div className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums">{queue.length} left</div>}
      </div>

      {liveNow.map((l) => (
        <Link key={l.id} href={`/event/${l.id}`} className="mb-3 flex items-center gap-3 rounded-2xl bg-red-600 p-3 text-white shadow-lift">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <span className="flex-1 text-sm font-semibold">Live now: {l.title}</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-red-700">Check in</span>
        </Link>
      ))}
      {pending.length > 0 && (
        <Link href={`/feedback/${pending[0].eventId}`} className="mb-3 flex items-center gap-3 rounded-2xl border border-gold bg-gold-100/70 p-3 transition hover:bg-gold-100">
          <MessageSquareHeart className="h-6 w-6 shrink-0 text-cardinal" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">How was {pending[0].title}?</div>
            <div className="text-xs text-muted-foreground">
              You checked in — 10 seconds of feedback helps {pending[0].orgName}
              {pending.length > 1 ? ` · ${pending.length - 1} more to rate` : ""}
            </div>
          </div>
          <span className="rounded-full bg-cardinal px-2.5 py-1 text-xs font-semibold text-white">Rate</span>
        </Link>
      )}

      <AnimatePresence>
        {banner && (
          <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
            <div className="relative rounded-2xl bg-gradient-to-r from-cardinal to-cardinal-800 p-3.5 pr-9 text-white shadow-lift">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold">
                <Sparkles className="h-3.5 w-3.5" /> Your feed just got smarter
              </div>
              <p className="mt-1 text-sm">{banner}</p>
              <button onClick={() => setBanner(null)} className="absolute right-2 top-2 rounded-full p-1 hover:bg-white/10" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto h-[540px] w-full">
        {!queue && <Skeleton className="h-full rounded-3xl" />}
        {queue && queue.length === 0 && (
          <EmptyState
            className="h-full"
            icon={<Sparkles className="h-6 w-6" />}
            title="You're all caught up"
            body="New events drop all the time. Check your registrations or search for something specific."
            action={
              <div className="flex gap-2">
                <Link href="/student/events">
                  <Button>My events</Button>
                </Link>
                <Button variant="outline" onClick={() => load()}>
                  <RotateCcw /> Refresh
                </Button>
              </div>
            }
          />
        )}
        <AnimatePresence custom={exitDir}>
          {queue
            ?.slice(0, 3)
            .map((e, i) => <SwipeCard key={e.id} e={e} isTop={i === 0} depth={i} onSwipe={swipe} />)
            .reverse()}
        </AnimatePresence>
      </div>

      {queue && queue.length > 0 && (
        <div className="mt-8 flex items-center justify-center gap-6">
          <button onClick={() => swipe("left")} className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-200 bg-card text-red-500 shadow-soft transition hover:scale-105 active:scale-95" aria-label="Pass">
            <X className="h-8 w-8" strokeWidth={3} />
          </button>
          <div className="text-center text-xs text-muted-foreground">
            {swipes > 0 ? `${swipes} swiped` : "← → keys work too"}
          </div>
          <button onClick={() => swipe("right")} className="flex h-16 w-16 items-center justify-center rounded-full bg-cardinal text-white shadow-lift transition hover:scale-105 active:scale-95" aria-label="Pre-register">
            <Heart className="h-8 w-8 fill-white" />
          </button>
        </div>
      )}

      <Sheet open={!!pendingLeft} onClose={() => chooseReason(null)} title="Why pass?">
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">One tap helps {pendingLeft?.org?.name ?? "the org"} plan better events.</p>
        <div className="grid grid-cols-2 gap-2">
          {SWIPE_REASONS.map((r) => (
            <button key={r} onClick={() => chooseReason(r)} className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3.5 text-left text-sm font-semibold transition hover:border-cardinal hover:bg-cardinal-50 active:scale-[.98]">
              <span className="text-lg">{REASON_EMOJI[r]}</span> {REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

export default function Page() {
  return <RoleGate role="student">{(id) => <Feed id={id} />}</RoleGate>;
}
