
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ErrorBox,
  Loading,
  PageHeader,
  StatusPill,
} from "@/components/crm/ui-bits";

type ClientRecord = {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string | null;
  country: string;
  timezone: string;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

type AppointmentRecord = {
  id: string;
  local_date: string;
  local_time: string;
  timezone: string;
  status: "scheduled" | "rescheduled" | "completed" | "cancelled" | "no_show";
  outcome: string | null;
  sale_amount: number | null;
  follow_up_date: string | null;
  platform: "zoom" | "google_meet";
  meeting_url: string;
  duration_minutes: number;
};

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({
    meta: [{ title: "Client Details — DemoDesk CRM" }],
  }),
  component: ClientDetails,
});

function ClientDetails() {
  const { id } = Route.useParams();
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("booking_agent");

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("Asia/Karachi");
  const [notes, setNotes] = useState("");

  const loadClient = useCallback(async () => {
    setLoading(true);
    setError("");

    const [clientResult, appointmentsResult] = await Promise.all([
      supabase
        .from("clients")
        .select(
          "id, business_name, owner_name, phone, email, country, timezone, notes, is_demo, created_at, updated_at"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("appointments")
        .select(
          "id, local_date, local_time, timezone, status, outcome, sale_amount, follow_up_date, platform, meeting_url, duration_minutes"
        )
        .eq("client_id", id)
        .order("local_date", { ascending: false })
        .order("local_time", { ascending: false })
        .limit(100),
    ]);

    if (clientResult.error) {
      setError(clientResult.error.message);
      setClient(null);
    } else if (!clientResult.data) {
      setError("Client not found, or you do not have permission to view it.");
      setClient(null);
    } else {
      const record = clientResult.data as ClientRecord;
      setClient(record);
      setBusinessName(record.business_name);
      setOwnerName(record.owner_name);
      setPhone(record.phone);
      setEmail(record.email ?? "");
      setCountry(record.country);
      setTimezone(record.timezone);
      setNotes(record.notes ?? "");
    }

    if (appointmentsResult.error) {
      setError((previous) =>
        previous
          ? `${previous} Appointment history: ${appointmentsResult.error.message}`
          : `Appointment history: ${appointmentsResult.error.message}`
      );
      setAppointments([]);
    } else {
      setAppointments(
        (appointmentsResult.data ?? []) as AppointmentRecord[]
      );
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadClient();
  }, [loadClient]);

  async function saveChanges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;

    setError("");
    setSuccess("");

    if (!businessName.trim() || !ownerName.trim() || !phone.trim() || !country.trim()) {
      setError("Business name, contact name, phone and country are required.");
      return;
    }

    setSaving(true);

    const { data, error: updateError } = await supabase
      .from("clients")
      .update({
        business_name: businessName.trim(),
        owner_name: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        country: country.trim(),
        timezone,
        notes: notes.trim() || null,
      })
      .eq("id", client.id)
      .select(
        "id, business_name, owner_name, phone, email, country, timezone, notes, is_demo, created_at, updated_at"
      )
      .maybeSingle();

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data) {
      setError("Client was not updated. Check your account permissions.");
      return;
    }

    setClient(data as ClientRecord);
    setEditing(false);
    setSuccess("Client details updated successfully.");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Client Details" subtitle="Loading client information..." />
        <Loading />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <PageHeader title="Client Details" subtitle="Client information could not be loaded." />
        {error && <ErrorBox message={error} />}
        <Link
          to="/clients"
          className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          Back to clients
        </Link>
      </div>
    );
  }

  const completedCount = appointments.filter(
    (appointment) => appointment.status === "completed"
  ).length;

  const soldCount = appointments.filter(
    (appointment) => appointment.outcome === "sold"
  ).length;

  const money = (amount: number) =>
    new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.business_name}
        subtitle={`Client details · ${client.country}`}
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

      <div className="flex flex-wrap gap-3">
        <Link
          to="/clients"
          className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          ← All clients
        </Link>

        <Link
          to="/appointments/new"
          className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Book a demo
        </Link>

        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setEditing(true);
            }}
            className="min-h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Edit client
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total appointments" value={appointments.length} />
        <SummaryCard title="Completed demos" value={completedCount} />
        <SummaryCard title="Sales closed" value={soldCount} />
        <SummaryCard
          title="Recorded sales"
          value={money(
            appointments.reduce(
              (sum, appointment) =>
                sum +
                (appointment.outcome === "sold"
                  ? appointment.sale_amount ?? 0
                  : 0),
              0
            )
          )}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="font-semibold">
            {editing ? "Edit client information" : "Business information"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contact information and notes for this client.
          </p>
        </div>

        {editing ? (
          <form onSubmit={saveChanges} className="grid gap-5 sm:grid-cols-2">
            <Field label="Business name">
              <input
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                required
                maxLength={200}
                className={inputClass}
              />
            </Field>

            <Field label="Contact person">
              <input
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                required
                maxLength={150}
                className={inputClass}
              />
            </Field>

            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                maxLength={40}
                className={inputClass}
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                className={inputClass}
              />
            </Field>

            <Field label="Country">
              <input
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                required
                maxLength={100}
                className={inputClass}
              />
            </Field>

            <Field label="Timezone">
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className={inputClass}
              >
                {[
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
                ].map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  maxLength={5000}
                  className={inputClass}
                  placeholder="Client requirements, preferences or other useful information..."
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="min-h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBusinessName(client.business_name);
                  setOwnerName(client.owner_name);
                  setPhone(client.phone);
                  setEmail(client.email ?? "");
                  setCountry(client.country);
                  setTimezone(client.timezone);
                  setNotes(client.notes ?? "");
                  setEditing(false);
                  setError("");
                }}
                className="min-h-10 rounded-lg border border-border px-5 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Info label="Business name" value={client.business_name} />
            <Info label="Contact person" value={client.owner_name} />
            <Info label="Phone" value={client.phone} />
            <Info label="Email" value={client.email || "Not provided"} />
            <Info label="Country" value={client.country} />
            <Info label="Timezone" value={client.timezone} />
            <Info
              label="Client type"
              value={client.is_demo ? "Demo / sample client" : "Regular client"}
            />
            <Info
              label="Added on"
              value={new Date(client.created_at).toLocaleDateString()}
            />
            <div className="sm:col-span-2">
              <Info label="Notes" value={client.notes || "No notes added."} />
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border p-5">
          <h2 className="font-semibold">Appointment history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Demo bookings and recorded outcomes for this client.
          </p>
        </div>

        {appointments.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="font-medium">No appointments yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Book a demo to start this client&apos;s appointment history.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Outcome</th>
                  <th className="px-4 py-3 font-medium">Follow-up</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-3">
                      {appointment.local_date}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {appointment.local_time}
                      <div className="text-xs text-muted-foreground">
                        {appointment.timezone}
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {appointment.platform.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={appointment.status} />
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {appointment.outcome?.replaceAll("_", " ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {appointment.follow_up_date || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/appointments/$id"
                        params={{ id: appointment.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</p>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
  }
    
