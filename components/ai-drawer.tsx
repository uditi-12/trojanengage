"use client";
import { Cpu, RefreshCw, Sparkles, Zap } from "lucide-react";
import * as React from "react";
import { api } from "@/lib/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type Log = { id: string; feature: string; provider: string; model: string; inputSummary: string; outputSummary: string; latencyMs: number; usedFallback: boolean; createdAt: string };
type Resp = { config: { provider: string; model: string; embeddings: string; images: boolean }; logs: Log[] };

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export function AiDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = React.useState<Resp | null>(null);
  const [loading, setLoading] = React.useState(false);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<Resp>("/api/ai/logs"));
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    if (!open) return;
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [open, load]);
  const counts = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of data?.logs ?? []) m[l.feature] = (m[l.feature] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [data]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="right"
      title={
        <span className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-cardinal" /> AI under the hood
        </span>
      }
    >
      {data && (
        <div className="mb-4 rounded-2xl bg-gradient-to-br from-cardinal to-cardinal-900 p-4 text-white">
          <div className="text-xs uppercase tracking-wider text-white/70">Live configuration</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-white/60">Chat</div>
              <div className="font-semibold">
                {data.config.provider} · {data.config.model}
              </div>
            </div>
            <div>
              <div className="text-white/60">Embeddings</div>
              <div className="font-semibold">{data.config.embeddings === "openai" ? "text-embedding-3-small" : "local TF-IDF (384d)"}</div>
            </div>
            <div>
              <div className="text-white/60">Flyer art</div>
              <div className="font-semibold">{data.config.images ? "gpt-image-1" : "CSS gradient"}</div>
            </div>
            <div>
              <div className="text-white/60">Calls shown</div>
              <div className="font-semibold">{data.logs.length} latest</div>
            </div>
          </div>
          {data.config.provider === "mock" && <p className="mt-3 text-xs text-white/80">No API key — every feature runs its deterministic template fallback, so the demo works offline.</p>}
        </div>
      )}
      {counts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {counts.map(([f, n]) => (
            <Badge key={f} variant="secondary">
              {f} × {n}
            </Badge>
          ))}
        </div>
      )}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Every AI call, newest first</div>
        <Button size="sm" variant="ghost" onClick={load} loading={loading}>
          <RefreshCw /> Refresh
        </Button>
      </div>
      <div className="space-y-2">
        {!data && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        {data?.logs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No AI calls yet. Swipe, generate a card or close an event.</p>}
        {data?.logs.map((l) => (
          <div key={l.id} className="rounded-xl border bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                {l.usedFallback ? <Zap className="h-4 w-4 text-amber-500" /> : <Sparkles className="h-4 w-4 text-cardinal" />}
                {l.feature}
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant={l.usedFallback ? "warning" : "success"}>{l.usedFallback ? "fallback" : "live AI"}</Badge>
                <span className="text-xs tabular-nums text-muted-foreground">{l.latencyMs}ms</span>
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {l.provider} · {l.model} · {ago(l.createdAt)}
            </div>
            <div className="mt-2 line-clamp-2 text-xs">
              <span className="font-medium text-muted-foreground">in:</span> {l.inputSummary}
            </div>
            <div className="line-clamp-3 text-xs">
              <span className="font-medium text-muted-foreground">out:</span> {l.outputSummary}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
