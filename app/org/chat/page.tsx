"use client";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Bot, Send, ShieldCheck, Sparkles, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { OrgLogo } from "@/components/avatar";
import { Markdown } from "@/components/markdown";
import { RoleGate } from "@/components/role-gate";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

type Source = { eventId: string; title: string; recordId: string | null };
type Msg = { id: string; role: "user" | "assistant"; content: string; sources: Source[]; usedFallback: boolean; createdAt: string };

const SUGGESTIONS: Record<string, string[]> = {
  org_ai: ["Why did students skip the Intro to LLMs Workshop?", "What did attendees say about PyTorch Hands-on Night?", "When should we schedule our next workshop?", "What should we change for our next event?"],
  org_isa: ["What did attendees say about the food at Diwali Night?", "What should we change for Diwali Night 2026?", "How was turnout at Holi on the Lawn?", "Why did students pass on our events?"],
  org_wic: ["What did attendees say about the Resume Review & Recruiter Mixer?", "Was the mixer too crowded?", "What should we keep for our next career event?", "Why did students pass on our events?"],
};
const DEFAULT_SUGGESTIONS = ["What did attendees say about our last event?", "Why did students pass on our events?", "When should we schedule our next event?", "What should we change next time?"];

function Chat({ orgId }: { orgId: string }) {
  const { current } = useSession();
  const [messages, setMessages] = React.useState<Msg[] | null>(null);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMessages(null);
    api<{ messages: Msg[] }>(`/api/orgs/${orgId}/chat`)
      .then((d) => setMessages(d.messages))
      .catch((e) => toast.error(e.message));
  }, [orgId]);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    setInput("");
    setSending(true);
    const optimistic: Msg = { id: `tmp-${Date.now()}`, role: "user", content: q, sources: [], usedFallback: false, createdAt: new Date().toISOString() };
    setMessages((m) => [...(m ?? []), optimistic]);
    try {
      const d = await api<{ user: Msg; assistant: Msg }>(`/api/orgs/${orgId}/chat`, { body: { message: q } });
      setMessages((m) => [...(m ?? []).filter((x) => x.id !== optimistic.id), d.user, d.assistant]);
    } catch (e) {
      toast.error((e as Error).message);
      setMessages((m) => (m ?? []).filter((x) => x.id !== optimistic.id));
      setInput(q);
    } finally {
      setSending(false);
    }
  };
  const clear = async () => {
    await api(`/api/orgs/${orgId}/chat`, { method: "DELETE" });
    setMessages([]);
    toast("Chat history cleared");
  };

  const suggestions = SUGGESTIONS[orgId] ?? DEFAULT_SUGGESTIONS;
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Bot className="h-6 w-6 text-cardinal" /> Ask TrojanEngage
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Answers use your event records, swipe data and feedback from verified attendees only (registered + checked in).
          </p>
        </div>
        {messages && messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <Trash2 /> Clear history
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-3xl border bg-card p-4 shadow-soft sm:p-6">
        {!messages && [0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        {messages?.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            {current && <OrgLogo org={current as { name: string; logoUrl: string }} size={56} />}
            <div className="mt-4 text-lg font-bold">Ask anything about {current?.name ?? "your"} event history</div>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Your questions and answers are saved here, so next year&apos;s board can scroll back through them.</p>
            <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-2xl border p-3 text-left text-sm font-medium transition hover:border-cardinal hover:bg-cardinal-50">
                  <Sparkles className="mb-1 h-4 w-4 text-cardinal" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages?.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm", m.role === "user" ? "bg-cardinal text-white" : "border bg-muted/40")}>
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <>
                    <Markdown>{m.content}</Markdown>
                    {m.sources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-2">
                        {m.sources.map((s) => (
                          <Link
                            key={s.eventId}
                            href={s.recordId ? `/org/events/${s.eventId}/record` : `/event/${s.eventId}`}
                            className="inline-flex items-center gap-1 rounded-full bg-cardinal-50 px-2.5 py-1 text-xs font-semibold text-cardinal hover:bg-cardinal-100"
                          >
                            <BookOpen className="h-3 w-3" /> {s.title}
                          </Link>
                        ))}
                        {m.usedFallback && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900" title="Template answer (no AI key, or the AI call failed)">
                            <Zap className="h-3 w-3" /> template
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 animate-pulse text-cardinal" /> Reading your event history…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages && messages.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={sending} className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-medium hover:border-cardinal hover:text-cardinal disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What did attendees say about the food at Diwali Night?"
          className="h-12 flex-1 rounded-2xl border border-input bg-card px-4 text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          maxLength={1000}
        />
        <Button type="submit" size="lg" loading={sending} disabled={!input.trim()}>
          <Send /> Ask
        </Button>
      </form>
    </div>
  );
}

export default function Page() {
  return <RoleGate role="org">{(id) => <Chat orgId={id} />}</RoleGate>;
}
