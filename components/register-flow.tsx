"use client";
import { BookOpen, Briefcase, CalendarX2, TriangleAlert, User } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { ConflictItem } from "@/lib/types";

type RegisterResp =
  | { ok: false; needsConfirmation: true; conflicts: ConflictItem[]; note: string }
  | { ok: true; status: "registered" | "waitlisted"; conflicts: ConflictItem[]; note: string | null };

const ICON: Record<string, React.ReactNode> = {
  class: <BookOpen className="h-4 w-4 text-slate-600" />,
  work: <Briefcase className="h-4 w-4 text-sky-700" />,
  personal: <User className="h-4 w-4 text-violet-700" />,
  other: <User className="h-4 w-4 text-violet-700" />,
  event: <CalendarX2 className="h-4 w-4 text-cardinal" />,
};

/**
 * Register with clash handling: the API answers 409 + conflicts, we show them, and the student decides.
 * `url` is either /api/events/:id/register or /api/registrations/:id/confirm.
 */
export function useRegister(onDone: () => void) {
  const [pending, setPending] = React.useState<{ url: string; title: string; conflicts: ConflictItem[] } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const send = React.useCallback(
    async (url: string, title: string, force: boolean) => {
      setBusy(true);
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
        const data = (await res.json()) as RegisterResp & { error?: string };
        if (res.status === 409 && "needsConfirmation" in data && data.needsConfirmation) {
          setPending({ url, title, conflicts: data.conflicts });
          return;
        }
        if (!res.ok) throw new Error(data.error || "Couldn't register");
        setPending(null);
        if (data.ok && data.status === "waitlisted") toast(`You're on the waitlist for ${title}`, { description: "We'll move you up if a spot opens." });
        else toast.success(`Registered for ${title}`, { description: data.ok && data.note ? `Heads up: ${data.note}` : "It's on your calendar." });
        onDone();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [onDone],
  );

  const register = React.useCallback((url: string, title: string) => send(url, title, false), [send]);

  const dialog = (
    <Sheet open={!!pending} onClose={() => setPending(null)} title={<span className="flex items-center gap-2"><TriangleAlert className="h-5 w-5 text-amber-500" /> Schedule clash</span>}>
      <p className="-mt-1 mb-3 text-sm text-muted-foreground">
        <b>{pending?.title}</b> overlaps with:
      </p>
      <div className="space-y-2">
        {pending?.conflicts.map((c, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-xl border bg-amber-50/60 p-2.5 text-sm">
            {ICON[c.kind] ?? ICON.other}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{c.title}</div>
              <div className="text-xs capitalize text-muted-foreground">
                {c.kind === "event" ? "another event" : c.kind}
                {c.when ? ` · ${c.when}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">It&apos;s your call — you can still register. We&apos;ll flag it on your calendar.</p>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setPending(null)}>
          Not now
        </Button>
        <Button className="flex-1" loading={busy} onClick={() => pending && send(pending.url, pending.title, true)}>
          Register anyway
        </Button>
      </div>
    </Sheet>
  );
  return { register, busy, dialog };
}
