
import { createFileRoute, Link } from "@tanstack/react-router";
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
  demo_staff_id: string | null;
  local_date: string;
  local_time: string;
  timezone: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string;
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

function AppointmentDetails() {
  const { id } = Route.useParams();
  const { userId, hasRole } = useAuth();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState<AppointmentStatus>("scheduled");
  const [outcome, setOutcome] = useState<DemoOutcome | "">("");
  const [saleAmount, setSaleAmount] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [demoWebsiteUrl, setDemoWebsiteUrl] = useState("");
  const [finalWebsiteUrl, setFinalWebsiteUrl] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [localTime, setLocalTime] = useState("");
  const [timezone, setTimezone] = useState("");
  const [duration, setDuration] = useState("30");

  const [remarkText, setRemarkText] = useState("");
  const [objections, setObjections] = useState("");
  const [requestedChanges, setRequestedChanges] = useState("");

  const canRecordOutcome =
    hasRole("admin") || hasRole("demo_staff");
  const canEditBooking =
    hasRole("admin");
  const canManageAssignments = hasRole("admin");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: appointmentError } = await supabase
      .from("appointments")
      .select(
        "*, clients(business_name, owner_name, phone, email, country)",
      )
      .eq("id", id)
      .maybeSingle();

    if (appointmentError) {
      setError(appointmentError.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setAppointment(null);
      setError("Appointment not found, or you do not have permission to view it.");
      setLoading(false);
      return;
    }

    const a = data as unknown as Appointment;

    setAppointment(a);
    setStatus(a.status);
    setOutcome(a.outcome ?? "");
    setSaleAmount(a.sale_amount == null ? "" : String(a.sale_amount));
    setFollowUpDate(a.follow_up_date ?? "");
    setCancellationReason(a.cancellation_reason ?? "");
    setMeetingUrl(a.meeting_url);
    setDemoWebsiteUrl(a.demo_website_url ?? "");
    setFinalWebsiteUrl(a.final_website_url ?? "");
    setLocalDate(a.local_date);
    setLocalTime(a.local_time);
    setTimezone(a.timezone);
    setDuration(String(a.duration_minutes));

    const { data: remarkData, error: remarkError } = await supabase
      .from("appointment_remarks")
      .select(
        "id, remark, objections, requested_changes, outcome_at_time, created_at, author_id",
      )
      .eq("appointment_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (remarkError) {
      setError(`Appointment loaded, but remarks could not be loaded: ${remarkError.message}`);
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
          timeZone: timezone.trim(),
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

          for (const part of parts) values[part.type] = part.value;

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
        for (const part of finalParts) finalValues[part.type] = part.value;

        if (
          Number(finalValues.year) !== year ||
          Number(finalValues.month) !== month ||
          Number(finalValues.day) !== day ||
          Number(finalValues.hour) !== hour ||
          Number(finalValues.minute) !== minute
        ) {
          throw new Error("This date and time is invalid for the selected timezone.");
        }

        scheduledAt = guess.toISOString();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Please check the timezone.",
        );
        setSaving(false);
        return;
      }

      if (!meetingUrl.trim()) {
        setError("Meeting link is required.");
        setSaving(false);
        return;
      }

      Object.assign(patch, {
        local_date: localDate,
        local_time: localTime,
        timezone: timezone.trim(),
        scheduled_at: scheduledAt,
        duration_minutes: Number(duration),
        meeting_url: meetingUrl.trim(),
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
          <Link
            to="/appointments/"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Appointments
          </Link>
        }
      />

      {error && <ErrorBox error={new Error(error)} />}

      {message && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      )}

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
            value={
              appointment.platform === "zoom" ? "Zoom" : "Google Meet"
            }
          />
          <a
            href={appointment.meeting_url}
            target="_blank"
            rel="noreferrer"
            className="inline-block break-all text-sm text-primary underline"
          >
            Open Meeting Link
          </a>
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
              <Field
                label="Timezone"
                value={timezone}
                onChange={setTimezone}
                required
                placeholder="America/New_York"
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2.5"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                </select>
              </div>
              <Field
                label="Meeting Link"
                type="url"
                value={meetingUrl}
                onChange={setMeetingUrl}
                required
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as AppointmentStatus)
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2.5"
                >
                  {statuses.map((item) => (
                    <option key={item} value={item}>
                      {item.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
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
                <label className="text-sm font-medium">Demo Outcome</label>
                <select
                  value={outcome}
                  onChange={(e) =>
                    setOutcome(e.target.value as DemoOutcome | "")
                  }
                  className="w-full rounded-lg border bg-background px-3 py-2.5"
                >
                  <option value="">Not recorded</option>
                  {outcomes.map((item) => (
                    <option key={item} value={item}>
                      {item.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
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
