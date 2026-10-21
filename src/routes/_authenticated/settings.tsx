import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ErrorBox, Loading, PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [{ title: "Settings — DemoDesk CRM" }],
  }),
  component: Settings,
});

const timezones = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Kolkata",
  "Australia/Sydney",
  "UTC",
];

function Settings() {
  const { userId, profile, roles, refresh } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("Asia/Karachi");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
      } else if (data) {
        setFullName(data.full_name ?? "");
        setEmail(data.email ?? "");
        setPhone(data.phone ?? "");
      }

      setLoading(false);
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, [userId]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!userId) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      })
      .eq("id", userId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await refresh();
    setSuccess("Profile updated successfully.");
  }

  async function sendPasswordReset() {
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Your account email could not be found.");
      return;
    }

    setSendingReset(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    setSendingReset(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess(
      "If password reset is enabled for your account, check your email for the reset link."
    );
  }

  const roleLabels = roles.map((role) => {
    if (role === "admin") return "Admin";
    if (role === "booking_agent") return "Booking Agent";
    if (role === "demo_staff") return "Demo Staff";
    return role;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your profile and account security."
      />

      {error && <ErrorBox message={error} />}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          {success}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="font-semibold">Profile information</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Update your name and contact number.
              </p>
            </div>

            <form onSubmit={saveProfile} className="max-w-2xl space-y-5">
              <div className="space-y-2">
                <label htmlFor="settings-name" className="text-sm font-medium">
                  Full name
                </label>
                <input
                  id="settings-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  maxLength={120}
                  autoComplete="name"
                  className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="settings-email" className="text-sm font-medium">
                  Account email
                </label>
                <input
                  id="settings-email"
                  value={email}
                  readOnly
                  className="min-h-11 w-full rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Email changes are not available from this profile form.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="settings-phone" className="text-sm font-medium">
                  Phone number
                </label>
                <input
                  id="settings-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  maxLength={30}
                  autoComplete="tel"
                  className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your phone number"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="settings-timezone" className="text-sm font-medium">
                  Preferred timezone
                </label>
                <select
                  id="settings-timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  This preference is currently local to this page and is not saved to the database.
                  Appointment timezones remain set on each appointment.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-semibold">Account access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your current account permissions are shown below.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {roleLabels.length > 0 ? (
                roleLabels.map((role) => (
                  <span
                    key={role}
                    className="rounded-full border border-border bg-muted px-3 py-1.5 text-sm font-medium"
                  >
                    {role}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-sm text-amber-700 dark:text-amber-400">
                  No active role assigned
                </span>
              )}
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              Only an authorized administrator should change staff roles or account activation.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-semibold">Password and security</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Request a password reset email for your account.
            </p>

            <button
              type="button"
              onClick={() => void sendPasswordReset()}
              disabled={sendingReset || !email}
              className="mt-4 min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingReset ? "Sending email..." : "Send password reset email"}
            </button>

            <p className="mt-3 text-xs text-muted-foreground">
              The reset link must point to a valid password-reset route configured in Supabase.
              We will verify this during final testing.
            </p>
          </section>
        </>
      )}
    </div>
  );
      }
                    
