import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — DemoDesk CRM" },
      { name: "description", content: "Choose a new password for your DemoDesk account." },
      { property: "og:title", content: "Set new password — DemoDesk CRM" },
      { property: "og:description", content: "Choose a new password for your DemoDesk account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("At least 8 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="surface w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-semibold">Set a new password</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <Button className="w-full" disabled={busy}>Update password</Button>
      </form>
    </div>
  );
}
