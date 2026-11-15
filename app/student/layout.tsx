"use client";
import { CalendarCheck, Flame, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/student/feed", label: "Feed", icon: Flame },
  { href: "/student/search", label: "Search", icon: Search },
  { href: "/student/events", label: "My Events", icon: CalendarCheck },
  { href: "/student/profile", label: "Profile", icon: User },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const hideNav = path?.startsWith("/student/setup");
  return (
    <div className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-md pb-24">
      {children}
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="grid grid-cols-4">
            {NAV.map((n) => {
              const active = path === n.href;
              return (
                <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", active ? "text-cardinal" : "text-muted-foreground")}>
                  <n.icon className={cn("h-5 w-5", active && "fill-cardinal/10")} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
