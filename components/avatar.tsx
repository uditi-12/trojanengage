"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

const PALETTE = ["#990000", "#B45309", "#1E3A8A", "#047857", "#6D28D9", "#BE185D", "#0F766E", "#9A3412"];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Image avatar with an initials fallback (works offline). */
export function Avatar({ name, src, size = 32, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = React.useState(!src);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ring-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: colorFor(name) }}
      title={name}
    >
      {!failed && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full bg-white object-cover" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function AvatarStack({ people, max = 3, size = 26 }: { people: { id: string; name: string; avatarUrl: string }[]; max?: number; size?: number }) {
  return (
    <span className="flex -space-x-2">
      {people.slice(0, max).map((p) => (
        <Avatar key={p.id} name={p.name} src={p.avatarUrl} size={size} />
      ))}
    </span>
  );
}

export function OrgLogo({ org, size = 36 }: { org: { name: string; logoUrl: string }; size?: number }) {
  const isUrl = /^(https?:)?\//.test(org.logoUrl);
  if (isUrl) return <Avatar name={org.name} src={org.logoUrl} size={size} />;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cardinal to-cardinal-900 shadow-sm" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {org.logoUrl || initials(org.name)}
    </span>
  );
}
