import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarCheck2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DemoDesk CRM" },
      { name: "description", content: "Sign in to manage website demo appointments." },
      { property: "og:title", content: "Sign in — DemoDesk CRM" },
      { property: "og:description", content: "Sign in to manage website demo appointments." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
  full_name: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const email = z.string().trim().email().safeParse(form.email);
        if (!email.success) throw new Error("Enter a valid email");
        const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your inbox for a reset link.");
        setMode("signin");
        return;
      }
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: parsed.data.full_name } },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy-gradient p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 font-display text-lg font-semibold text-sidebar-accent-foreground">
          <CalendarCheck2 className="h-6 w-6 text-sidebar-primary" /> DemoDesk
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight text-sidebar-accent-foreground">
            Every demo booked,<br />run and closed — <span className="text-sidebar-primary">in the right time zone.</span>
          </h1>
          <p className="mt-4 max-w-md text-sidebar-foreground/80">
            The appointment CRM for call centres selling websites. Agents book, demo staff present, admins see the numbers.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Access is role-based. Contact your admin for an account.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">
              {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signup" ? "New accounts need an admin to assign a role." : "Sign in with your work email."}
            </p>
          </div>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </Button>
          <div className="flex justify-between text-sm">
            {mode !== "signin" ? (
              <button type="button" className="text-primary hover:underline" onClick={() => setMode("signin")}>Back to sign in</button>
            ) : (
              <>
                <button type="button" className="text-primary hover:underline" onClick={() => setMode("signup")}>Create account</button>
                <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>Forgot password?</button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
