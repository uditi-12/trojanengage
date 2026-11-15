"use client";
import { motion } from "framer-motion";
import { GraduationCap, KeyRound, LogIn, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DEMO = [
  { email: "alex@usc.edu", label: "Alex (new student)" },
  { email: "priya@usc.edu", label: "Priya" },
  { email: "sofia@usc.edu", label: "Sofia" },
  { email: "arjun@usc.edu", label: "Arjun" },
];

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next");
  const { login, signup, session, current } = useSession();
  const [mode, setMode] = React.useState<"login" | "signup">(search.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [major, setMajor] = React.useState("");
  const [year, setYear] = React.useState("Freshman");
  const [busy, setBusy] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const go = (onboarded: boolean) => {
    const dest = !onboarded ? "/student/setup" : next && next.startsWith("/") ? next : "/student/feed";
    router.push(dest);
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const r = await login(email, password, remember);
        toast.success("Welcome back!");
        go(r.onboarded);
      } else {
        await signup({ name, email, password, major, year });
        toast.success("Account created — let's set up your feed");
        go(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cardinal text-gold shadow-lift">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">{mode === "login" ? "Student log in" : "Create your account"}</h1>
            <p className="text-sm text-muted-foreground">Use your USC email — your class schedule is imported automatically.</p>
          </div>
        </div>
        {session?.role === "student" && current && (
          <div className="mb-4 rounded-xl bg-cardinal-50 p-3 text-sm">
            You&apos;re logged in as <b>{current.name}</b>.{" "}
            <button className="font-semibold text-cardinal underline" onClick={() => go("onboarded" in current ? current.onboarded : true)}>
              Continue
            </button>
          </div>
        )}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn("flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold", mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {m === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tommy Trojan" required />
            </div>
          )}
          <div>
            <Label>USC email</Label>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@usc.edu" required />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : ""} required />
          </div>
          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Major</Label>
                <Input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="Computer Science" required />
              </div>
              <div>
                <Label>Year</Label>
                <Select value={year} onChange={(e) => setYear(e.target.value)}>
                  {["Freshman", "Sophomore", "Junior", "Senior", "Masters", "PhD"].map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </Select>
              </div>
            </div>
          )}
          {mode === "login" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-cardinal" /> Keep me signed in on this device
            </label>
          )}
          {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</div>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {mode === "login" ? "Log in" : "Create account"}
          </Button>
        </form>
        {mode === "login" && (
          <div className="mt-6 border-t pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" /> Demo accounts · password <code className="rounded bg-muted px-1">trojan123</code>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword("trojan123");
                  }}
                  className="rounded-full border px-3 py-1 text-xs font-medium hover:border-cardinal hover:text-cardinal"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 max-w-md" />}>
      <LoginForm />
    </React.Suspense>
  );
}
