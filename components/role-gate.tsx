"use client";
import Link from "next/link";
import { useSession } from "./session-provider";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

/** Renders children only when the current demo role matches; otherwise prompts to switch. */
export function RoleGate({ role, children }: { role: "student" | "org"; children: (id: string) => React.ReactNode }) {
  const { session, loading } = useSession();
  if (loading)
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    );
  if (session?.role !== role)
    return role === "student" ? (
      <div className="mx-auto max-w-md p-8 text-center">
        <div className="text-lg font-semibold">Log in to continue</div>
        <p className="mt-1 text-sm text-muted-foreground">Student pages need your USC login.</p>
        <Link href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/student/feed")}`}>
          <Button className="mt-4">Log in</Button>
        </Link>
      </div>
    ) : (
      <div className="mx-auto max-w-md p-8 text-center">
        <div className="text-lg font-semibold">Switch to an org to view this page</div>
        <p className="mt-1 text-sm text-muted-foreground">Use the org switcher in the top bar, or pick one on the home page.</p>
        <Link href="/">
          <Button className="mt-4">Choose an org</Button>
        </Link>
      </div>
    );
  return <>{children(session.id)}</>;
}
