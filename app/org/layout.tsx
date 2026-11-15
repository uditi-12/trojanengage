"use client";
import { Bot, FilePlus2, History, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrgLogo } from "@/components/avatar";
import { useSession } from "@/components/session-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/org/history", label: "History & insights", icon: History },
  { href: "/org/new", label: "New event", icon: FilePlus2 },
  { href: "/org/chat", label: "Ask TrojanEngage", icon: Bot },
  { href: "/org/setup", label: "Setup & import", icon: Upload },
];

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { session, current } = useSession();
  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
      <aside className="no-print sticky top-20 hidden h-fit w-60 shrink-0 lg:block">
        {session?.role === "org" && current && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft">
            <OrgLogo org={current as { name: string; logoUrl: string }} size={40} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{current.name}</div>
              <div className="text-xs text-muted-foreground">Org dashboard</div>
            </div>
          </div>
        )}
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition", path?.startsWith(n.href) ? "bg-cardinal text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <nav className="no-print mb-4 flex gap-1 overflow-x-auto lg:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn("flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium", path?.startsWith(n.href) ? "bg-cardinal text-white" : "bg-muted")}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
