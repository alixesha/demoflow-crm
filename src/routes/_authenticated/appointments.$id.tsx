import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ErrorBox,
  Loading,
  OutcomePill,
  PageHeader,
  StatusPill,
} from "@/components/crm/ui-bits";
import type { AppointmentStatus, DemoOutcome } from "@/lib/labels";

type Appointment = {
  id: string;
  client_id: string;
  booking_agent_id: string;
  booking_agent_name?: string | null;
  demo_staff_id: string | null;
  local_date: string;
  local_time: string;
  timezone: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  platform: "zoom" | "google_meet";
  status: AppointmentStatus;
  outcome: DemoOutcome | null;
  sale_amount: number | null;
  follow_up_date: string | null;
  cancellation_reason: string | null;
  demo_website_url: string | null;
  final_website_url: string | null;
  is_demo: boolean;
  clients: {
    business_name: string;
    owner_name: string;
    phone: string;
    email: string | null;
    country: string;
  } | null;
};

type Remark = {
  id: string;
  remark: string;
  objections: string | null;
  requested_changes: string | null;
  outcome_at_time: DemoOutcome | null;
  created_at: string;
  author_id: string;
};

export const Route = createFileRoute("/_authenticated/appointments/$id")({
  head: () => ({
    meta: [{ title: "Appointment Details — DemoDesk CRM" }],
  }),
  component: AppointmentDetails,
});

const statuses: AppointmentStatus[] = [
  "scheduled",
  "rescheduled",
  "completed",
  "cancelled",
  "no_show",
];

const outcomes: DemoOutcome[] = [
  "interested",
  "follow_up_required",
  "not_interested",
  "sold",
  "lost",
];

const timezones = [
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/New_York", label: "Eastern Time" },
];

function AppointmentDetails() {
  const { id } = Route.useParams();
  const { userId, hasRole } = useAuth();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [status, setStatus] = useState<AppointmentStatus>("scheduled");
  const [outcome, setOutcome] = useState<DemoOutcome | "">("");
  const [saleAmount, setSaleAmount] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [demoWebsiteUrl, setDemoWebsiteUrl] = useState("");
  const [finalWebsiteUrl, setFinalWebsiteUrl] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [localTime, setLocalTime] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");

  const [remarkText, setRemarkText] = useState("");
  const [objections, setObjections] = useState("");
  const [requestedChanges, setRequestedChanges] = useState("");

  const canRecordOutcome = hasRole("admin") || hasRole("demo_staff");
  const canEditBooking = hasRole("admin");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: appointmentError } = await supabase
      .from("appointments")
      .select("*, clients(business_name, owner_name, phone, email, country)")
      .eq("id", id)
      .maybeSingle();

    if (appointmentError) {
      setError(appointmentError.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setAppointment(null);
      setError(
        "Appointment not found, or you do not have permission to view it.",
      );
      setLoading(false);
      return;
    }

    const { data: agentProfile, error: agentError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", data.booking_agent_id)
      .maybeSingle();

    if (agentError) {
      console.error("Booking agent name error:", agentError.message);
    }

    const a = {
      ...(data as unknown as Appointment),
      booking_agent_name: agentProfile?.full_name || "Name unavailable",
    };

    setAppointment(a);
    setStatus(a.status);
    setOutcome(a.outcome ?? "");
    setSaleAmount(a.sale_amount == null ? "" : String(a.sale_amount));
    setFollowUpDate(a.follow_up_date ?? "");
    setCancellationReason(a.cancellation_reason ?? "");
    setDemoWebsiteUrl(a.demo_website_url ?? "");
    setFinalWebsiteUrl(a.final_website_url ?? "");
    setLocalDate(a.local_date);
    setLocalTime(a.local_time);
    setTimezone(
      timezones.some((item) => item.value === a.timezone)
        ? a.timezone
        : "America/New_York",
    );

    const { data: remarkData, error: remarkError } = await supabase
      .from("appointment_remarks")
      .select(
        "id, remark, objections, requested_changes, outcome_at_time, created_at, author_id",
      )
      .eq("appointment_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (remarkError) {
      setError(
        `Appointment loaded, but remarks could not be loaded: ${remarkError.message}`,
      );
    } else {
      setRemarks((remarkData ?? []) as Remark[]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function saveAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appointment) return;

    setSaving(true);
    setError("");
    setMessage("");

    const patch: Record<string, unknown> = {};

    if (canEditBooking) {
      if (!localDate || !localTime || !timezone.trim()) {
        setError("Date, time and timezone are required.");
        setSaving(false);
        return;
      }

      let scheduledAt: string;

      try {
        const [year, month, day] = localDate.split("-").map(Number);
        const [hour, minute] = localTime.split(":").map(Number);
        const target = Date.UTC(year, month - 1, day, hour, minute);
        let guess = new Date(target);

        const formatter = new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        });

        for (let i = 0; i < 5; i++) {
          const parts = formatter.formatToParts(guess);
          const values: Record<string, string> = {};

          for (const part of parts) {
            values[part.type] = part.value;
          }

          const represented = Date.UTC(
            Number(values.year),
            Number(values.month) - 1,
            Number(values.day),
            Number(values.hour),
            Number(values.minute),
          );

          const difference = target - represented;
          if (!difference) break;
          guess = new Date(guess.getTime() + difference);
        }

        const finalParts = formatter.formatToParts(guess);
        const finalValues: Record<string, string> = {};

        for (const part of finalParts) {
          finalValues[part.type] = part.value;
        }

        if (
          Number(finalValues.year) !== year ||
          Number(finalValues.month) !== month ||
          Number(finalValues.day) !== day ||
          Number(finalValues.hour) !== hour ||
          Number(finalValues.minute) !== minute
        ) {
          throw new Error(
            "This date and time is invalid for the selected timezone.",
          );
        }

        scheduledAt = guess.toISOString();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Please check the timezone.",
        );
        setSaving(false);
        return;
      }

      Object.assign(patch, {
        local_date: localDate,
        local_time: localTime,
        timezone,
        scheduled_at: scheduledAt,
        status,
        cancellation_reason:
          status === "cancelled" ? cancellationReason.trim() || null : null,
      });
    }

    if (canRecordOutcome) {
      if (outcome === "sold" && (!saleAmount || Number(saleAmount) < 0)) {
        setError("Enter a valid sale amount for a sold appointment.");
        setSaving(false);
        return;
      }

      if (outcome === "follow_up_required" && !followUpDate) {
        setError("Please choose a follow-up date.");
        setSaving(false);
        return;
      }

      Object.assign(patch, {
        outcome: outcome || null,
        sale_amount: outcome === "sold" ? Number(saleAmount) : null,
        follow_up_date: followUpDate || null,
        demo_website_url: demoWebsiteUrl.trim() || null,
        final_website_url: finalWebsiteUrl.trim() || null,
      });
    }

    if (Object.keys(patch).length === 0) {
      setError("You do not have permission to edit these appointment fields.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setMessage("Appointment updated successfully.");
    await loadData();
    setSaving(false);
  }

  async function deleteAppointment() {
    if (!appointment || !hasRole("admin")) return;

    setSaving(true);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("appointments")
      .delete()
      .eq("id", appointment.id);

    if (deleteError) {
      setError(`Appointment delete nahi hui: ${deleteError.message}`);
      setSaving(false);
      return;
    }

    setDeleteDialogOpen(false);
    window.location.href = "/appointments/";
  }

  async function addRemark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || !remarkText.trim()) {
      setError("Please enter a remark.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const { error: insertError } = await supabase
      .from("appointment_remarks")
      .insert({
        appointment_id: id,
        author_id: userId,
        remark: remarkText.trim(),
        objections: objections.trim() || null,
        requested_changes: requestedChanges.trim() || null,
        outcome_at_time: outcome || null,
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      setRemarkText("");
      setObjections("");
      setRequestedChanges("");
      setMessage("Remark added successfully.");
      await loadData();
    }

    setSaving(false);
  }

  if (loading) return <Loading />;

  if (!appointment) {
    return (
      <div className="space-y-4">
        <ErrorBox error={new Error(error || "Appointment not found.")} />
        <Link to="/appointments/" className="underline">
          Back to Appointments
        </Link>
      </div>
    );
  }

  const client = appointment.clients;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment Details"
        subtitle={`Booking reference: ${appointment.id}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/appointments/"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Back to Appointments
            </Link>

            {hasRole("admin") && (
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {saving ? "Please wait..." : "Delete Appointment"}
              </button>
            )}
          </div>
        }
      />

      {error && <ErrorBox error={new Error(error)} />}

      {message && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      )}

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-semibold">Booking Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label="Booking Agent" value={appointment.booking_agent_name} />
          <Detail label="Booking Reference" value={appointment.id} />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Client Information</h2>
          <Detail label="Business" value={client?.business_name} />
          <Detail label="Contact Person" value={client?.owner_name} />
          <Detail label="Phone" value={client?.phone} />
          <Detail label="Email" value={client?.email} />
          <Detail label="Country" value={client?.country} />
        </div>

        <div className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Current Status</h2>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Appointment</p>
            <StatusPill status={appointment.status} />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Demo Outcome</p>
            {appointment.outcome ? (
              <OutcomePill outcome={appointment.outcome} />
            ) : (
              <span className="text-sm">Not recorded</span>
            )}
          </div>
          <Detail
            label="Scheduled At"
            value={`${appointment.local_date} ${appointment.local_time} (${appointment.timezone})`}
          />
          <Detail
            label="Platform"
            value={appointment.platform === "zoom" ? "Zoom" : "Google Meet"}
          />
        </div>
      </section>

      <form onSubmit={saveAppointment} className="space-y-6">
        {canEditBooking && (
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Booking & Rescheduling</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Date"
                type="date"
                value={localDate}
                onChange={setLocalDate}
                required
              />
              <Field
                label="Time"
                type="time"
                value={localTime}
                onChange={setLocalTime}
                required
              />

              <div className="space-y-2">
                <label htmlFor="appointment-timezone" className="text-sm font-medium">
                  Timezone
                </label>
                <select
                  id="appointment-timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2.5"
                >
                  {timezones.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="appointment-status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="appointment-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as AppointmentStatus)
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2.5"
                >
                  {statuses.map((item) => (
                    <option key={item} value={item}>
                      {item
                        .replace("_", " ")
                        .replace(/^\w/, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {status === "cancelled" && (
              <Field
                label="Cancellation Reason"
                value={cancellationReason}
                onChange={setCancellationReason}
                placeholder="Reason for cancellation"
              />
            )}
          </section>
        )}

        {canRecordOutcome && (
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Demo Outcome & Sale</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="demo-outcome" className="text-sm font-medium">
                  Demo Outcome
                </label>
                <select
                  id="demo-outcome"
                  value={outcome}
                  onChange={(event) =>
                    setOutcome(event.target.value as DemoOutcome | "")
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2.5"
                >
                  <option value="">Not recorded</option>
                  {outcomes.map((item) => (
                    <option key={item} value={item}>
                      {item
                        .replaceAll("_", " ")
                        .replace(/^\w/, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {outcome === "sold" && (
                <Field
                  label="Sale Amount"
                  type="number"
                  value={saleAmount}
                  onChange={setSaleAmount}
                  required
                  placeholder="0.00"
                />
              )}

              {(outcome === "follow_up_required" ||
                outcome === "interested") && (
                <Field
                  label="Follow-up Date"
                  type="date"
                  value={followUpDate}
                  onChange={setFollowUpDate}
                  required={outcome === "follow_up_required"}
                />
              )}

              <Field
                label="Demo Website URL"
                type="url"
                value={demoWebsiteUrl}
                onChange={setDemoWebsiteUrl}
                placeholder="https://..."
              />
              <Field
                label="Final Website URL"
                type="url"
                value={finalWebsiteUrl}
                onChange={setFinalWebsiteUrl}
                placeholder="https://..."
              />
            </div>
          </section>
        )}

        {(canEditBooking || canRecordOutcome) && (
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Appointment Changes"}
          </button>
        )}
      </form>
      {hasRole("demo_staff") && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">Remarks & Activity Notes</h2>
            <p className="text-sm text-muted-foreground">
              Add a new note below. Existing remarks are displayed as history.
            </p>
          </div>

          <form onSubmit={addRemark} className="space-y-4">
            <TextAreaField
              label="Remark *"
              value={remarkText}
              onChange={setRemarkText}
              required
              placeholder="Summarize the demo conversation..."
            />
            <TextAreaField
              label="Client Objections"
              value={objections}
              onChange={setObjections}
              placeholder="Budget, timing, features, or other objections..."
            />
            <TextAreaField
              label="Requested Changes"
              value={requestedChanges}
              onChange={setRequestedChanges}
              placeholder="Changes requested by the client..."
            />

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Remark"}
            </button>
          </form>

          <div className="space-y-3">
            {remarks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No remarks yet.</p>
            ) : (
              remarks.map((remark) => (
                <article
                  key={remark.id}
                  className="space-y-2 rounded-lg border p-4"
                >
                  <p className="whitespace-pre-wrap text-sm">{remark.remark}</p>

                  {remark.objections && (
                    <Detail label="Objections" value={remark.objections} />
                  )}

                  {remark.requested_changes && (
                    <Detail
                      label="Requested Changes"
                      value={remark.requested_changes}
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(remark.created_at).toLocaleString()}</span>
                    {remark.outcome_at_time && (
                      <OutcomePill outcome={remark.outcome_at_time} />
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>

              <div className="space-y-1">
                <h2 id="delete-dialog-title" className="text-lg font-semibold">
                  Delete Appointment?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete this appointment? This action
                  cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={saving}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void deleteAppointment()}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {saving ? "Deleting..." : "Delete Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap break-words text-sm font-medium">
        {value || "—"}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
