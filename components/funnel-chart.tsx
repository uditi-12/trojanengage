"use client";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FunnelView } from "@/lib/types";

const COLORS = ["#FFCC00", "#e0a800", "#b33333", "#990000"];

export function funnelRows(f: FunnelView) {
  return [
    { stage: "Swiped right", value: f.rightSwipes },
    { stage: "Pre-registered", value: f.preRegistered },
    { stage: "Registered", value: f.registered },
    { stage: "Checked in", value: f.checkedIn },
  ];
}

export function FunnelChart({ f, height = 220 }: { f: FunnelView; height?: number }) {
  const data = funnelRows(f);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48 }}>
          <XAxis type="number" hide domain={[0, Math.max(1, ...data.map((d) => d.value))]} />
          <YAxis type="category" dataKey="stage" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
          <Tooltip cursor={{ fill: "rgba(153,0,0,.05)" }} />
          <Bar dataKey="value" radius={[0, 10, 10, 0]} isAnimationActive animationDuration={500}>
            {data.map((d, i) => (
              <Cell key={d.stage} fill={COLORS[i]} />
            ))}
            <LabelList dataKey="value" position="right" style={{ fontWeight: 700, fontSize: 14 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny 4-bar funnel for timeline rows (pure CSS, cheap to render many). */
export function FunnelMini({ f }: { f: FunnelView }) {
  const data = funnelRows(f);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-10 items-end gap-1" title={data.map((d) => `${d.stage}: ${d.value}`).join("\n")}>
      {data.map((d, i) => (
        <div key={d.stage} className="flex w-5 flex-col items-center gap-0.5">
          <div className="w-full rounded-t" style={{ height: `${Math.max(3, (d.value / max) * 32)}px`, background: COLORS[i] }} />
          <span className="text-[9px] tabular-nums text-muted-foreground">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
