"use client";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";

/** QR landing page: records the check-in for the current student, then redirects to feedback. */
export default function CheckInPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { session, loading } = useSession();
  const [state, setState] = React.useState<{ status: "idle" | "working" | "done" | "error"; msg?: string; title?: string }>({ status: "idle" });
  const started = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (loading || session?.role !== "student" || started.current === session.id) return;
    started.current = session.id;
    setState({ status: "working" });
    (async () => {
      try {
        const ev = await api<{ event: { title: string; flyerHeadline: string } }>(`/api/events/${params.id}`);
        const r = await api<{ ok: boolean; already?: boolean; reason?: string }>("/api/checkin", { body: { eventId: params.id } });
        setState({ status: "done", title: ev.event.flyerHeadline || ev.event.title, msg: r.already ? "You were already checked in." : "You're checked in!" });
        setTimeout(() => router.push(`/feedback/${params.id}`), 1600);
      } catch (e) {
        setState({ status: "error", msg: (e as Error).message });
      }
    })();
  }, [loading, session, params.id, router]);

  React.useEffect(() => {
    if (!loading && session?.role !== "student") router.replace(`/login?next=${encodeURIComponent(`/checkin/${params.id}`)}`);
  }, [loading, session, params.id, router]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center p-6 text-center">
      {state.status !== "error" ? (
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
          <div className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full ${state.status === "done" ? "bg-emerald-500" : "bg-muted"}`}>
            {state.status === "done" ? <CheckCircle2 className="h-16 w-16 text-white" /> : <span className="h-10 w-10 animate-spin rounded-full border-4 border-cardinal border-t-transparent" />}
          </div>
          <h1 className="mt-6 text-2xl font-extrabold">{state.status === "done" ? state.msg : "Checking you in…"}</h1>
          {state.title && <p className="mt-1 text-muted-foreground">{state.title}</p>}
          {state.status === "done" && <p className="mt-4 text-sm text-muted-foreground">Taking you to a 10-second feedback card…</p>}
        </motion.div>
      ) : (
        <div>
          <XCircle className="mx-auto h-16 w-16 text-red-500" />
          <h1 className="mt-4 text-xl font-bold">Couldn&apos;t check in</h1>
          <p className="mt-1 text-sm text-muted-foreground">{state.msg}</p>
          <Button className="mt-4" onClick={() => router.push(`/event/${params.id}`)}>
            View event
          </Button>
        </div>
      )}
    </main>
  );
}
