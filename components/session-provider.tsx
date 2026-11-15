"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { api } from "@/lib/client";
import type { OrgLite, StudentLite } from "@/lib/types";

type Session = { role: "student" | "org"; id: string } | null;
type Ctx = {
  session: Session;
  current: (StudentLite | OrgLite) | null;
  orgs: OrgLite[];
  loading: boolean;
  switchToOrg: (id: string, redirect?: string) => Promise<void>;
  login: (email: string, password: string, remember?: boolean) => Promise<{ onboarded: boolean }>;
  signup: (data: { name: string; email: string; password: string; major: string; year: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = React.createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = React.useState<{ session: Session; current: Ctx["current"]; orgs: OrgLite[] }>({ session: null, current: null, orgs: [] });
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      setState(await api<{ session: Session; current: Ctx["current"]; orgs: OrgLite[] }>("/api/session"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const switchToOrg = React.useCallback(
    async (id: string, redirect?: string) => {
      await api("/api/session", { body: { role: "org", id } });
      await refresh();
      if (redirect) router.push(redirect);
      router.refresh();
    },
    [refresh, router],
  );
  const login = React.useCallback(
    async (email: string, password: string, remember = true) => {
      const d = await api<{ student: { onboarded: boolean } }>("/api/auth/login", { body: { email, password, remember } });
      await refresh();
      return { onboarded: d.student.onboarded };
    },
    [refresh],
  );
  const signup = React.useCallback(
    async (data: { name: string; email: string; password: string; major: string; year: string }) => {
      await api("/api/auth/signup", { body: data });
      await refresh();
    },
    [refresh],
  );
  const logout = React.useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    await refresh();
    router.push("/");
    router.refresh();
  }, [refresh, router]);

  return <SessionContext.Provider value={{ ...state, loading, switchToOrg, login, signup, logout, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export function studentHome(s: { onboarded: boolean }) {
  return s.onboarded ? "/student/feed" : "/student/setup";
}
