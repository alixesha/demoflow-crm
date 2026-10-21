import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./labels";

type Profile = { id: string; full_name: string; email: string; is_active: boolean };

type AuthCtx = {
  loading: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  roles: AppRole[];
  hasRole: (r: AppRole) => boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(s: Session | null) {
    setSession(s);
    if (!s) {
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, is_active").eq("id", s.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", s.user.id),
    ]);
    setProfile(p ?? null);
    setRoles(p?.is_active ? (r ?? []).map((x) => x.role) : []);
    setLoading(false);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => load(s), 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => load(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        loading,
        session,
        userId: session?.user.id ?? null,
        profile,
        roles,
        hasRole: (r) => roles.includes(r),
        refresh: () => supabase.auth.getSession().then(({ data }) => load(data.session)),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
