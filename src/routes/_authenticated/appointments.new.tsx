
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, Loading, ErrorBox } from "@/components/crm/ui-bits";

const TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/New_York", label: "Eastern Time" },
];

const WEBSITE_INTEREST_LEVELS = [
  "Very Interested",
  "Interested",
  "Somewhat Interested",
  "Not Sure",
  "Not Interested",
];

type MeetingPlatform = "zoom" | "google_meet";

export const Route = createFileRoute("/_authenticated/appointments/new")({
  head: () => ({
    meta: [{ title: "Book Appointment — DemoDesk CRM" }],
  }),
  component: NewAppointment,
});

function localDateTimeToUtc(
  date: string,
  time: string,
  timezone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const targetMs = Date.UTC(year, month - 1, day, hour, minute);
  let guess = new Date(targetMs);

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

    const representedMs = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );

    const difference = targetMs - representedMs;

    if (difference === 0) break;

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
      "This local time is invalid in the selected timezone. Please choose another time.",
    );
  }

  return guess;
}

function NewAppointment() {
  const { userId, loading: authLoading, hasRole } = useAuth();
  const navigate = useNavigate();

  const canBook = hasRole("admin") || hasRole("booking_agent");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Client details
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("United States");
  const [clientTimezone, setClientTimezone] =
    useState("America/New_York");

  // Meeting details
  const [localDate, setLocalDate] = useState("");
  const [localTime, setLocalTime] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [platform, setPlatform] =
    useState<MeetingPlatform>("google_meet");

  // Appointment notes
  const [websiteInterestLevel, setWebsiteInterestLevel] =
    useState("Interested");
  const [clientNotes, setClientNotes] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!userId) {
      setError("Your login session is missing. Please sign in again.");
      return;
    }

    if (!canBook) {
      setError("You do not have permission to book appointments.");
      return;
    }

    if (
      !businessName.trim() ||
      !ownerName.trim() ||
      !phone.trim() ||
      !country.trim()
    ) {
      setError(
        "Please complete Business Name, Owner Name, Phone Number and Country.",
      );
      return;
    }

    if (!localDate || !localTime || !timezone) {
      setError("Please enter the meeting date, time and timezone.");
      return;
    }

    let scheduledAt: string;

    try {
      const parsedDate = localDateTimeToUtc(
        localDate,
        localTime,
        timezone,
      );

      if (parsedDate.getTime() <= Date.now()) {
        throw new Error("Please select a future meeting date and time.");
      }

      scheduledAt = parsedDate.toISOString();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Please check the meeting date, time and timezone.",
      );
      return;
    }

    setSaving(true);

    let createdClientId: string | null = null;

    try {
      // Step 1: Save client details to the clients table.
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          business_name: businessName.trim(),
          owner_name: ownerName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          country: country.trim(),
          timezone: clientTimezone,
          created_by: userId,
          is_demo: false,
        })
        .select("id")
        .single();

      if (clientError) {
        throw new Error(`Could not save client details: ${clientError.message}`);
      }

      createdClientId = newClient.id;

      // Step 2: Save the appointment linked to the newly created client.
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          client_id: createdClientId,
          booking_agent_id: userId,
          local_date: localDate,
          local_time: localTime,
          timezone,
          scheduled_at: scheduledAt,
          platform,
          duration_minutes: 30,
          website_interest_level: websiteInterestLevel,
          client_notes: clientNotes.trim() || null,
          status: "scheduled",
          is_demo: false,
        })
        .select("id")
        .single();

      if (appointmentError) {
        throw new Error(
          `Client was saved, but the appointment could not be saved: ${appointmentError.message}`,
        );
      }

      setSuccess("Client and appointment saved successfully.");

      await navigate({
        to: "/appointments/$id",
        params: { id: appointment.id },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the appointment. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <Loading />;

  if (!userId) {
    return (
      <ErrorBox error="You must be signed in to book an appointment." />
    );
  }

  if (!canBook) {
    return (
      <ErrorBox error="You do not have permission to create appointments. Contact your administrator." />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-8">
      <PageHeader
        title="Book an Appointment"
        subtitle="Enter client information and schedule a meeting."
        actions={
          <Link
            to="/appointments/"
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Back to Appointments
          </Link>
        }
      />

      {error && <ErrorBox error={error} />}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CLIENT DETAILS */}
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-5 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Step 1
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Client Details
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the client information. It will be saved to your Client
              List when you book the appointment.
            </p>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <Field
              label="Business Name"
              value={businessName}
              onChange={setBusinessName}
              required
              placeholder="Enter business name"
            />

            <Field
              label="Owner / Contact Name"
              value={ownerName}
              onChange={setOwnerName}
              required
              placeholder="Enter owner's full name"
            />

            <Field
              label="Phone Number"
              value={phone}
              onChange={setPhone}
              required
              inputType="tel"
              placeholder="Enter contact number"
            />

            <Field
              label="Email Address"
              value={email}
              onChange={setEmail}
              inputType="email"
              placeholder="name@business.com"
            />

            <Field
              label="Country"
              value={country}
              onChange={setCountry}
              required
              placeholder="United States"
            />

            <TimezoneSelect
              id="client-timezone"
              label="Client Timezone"
              value={clientTimezone}
              onChange={setClientTimezone}
              required
            />
          </div>
        </section>

        {/* MEETING DETAILS */}
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-5 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Step 2
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Meeting Details
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the meeting date, local time, timezone and platform.
            </p>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <Field
              label="Meeting Date"
              value={localDate}
              onChange={setLocalDate}
              required
              inputType="date"
            />

            <Field
              label="Meeting Time"
              value={localTime}
              onChange={setLocalTime}
              required
              inputType="time"
            />

            <TimezoneSelect
              id="meeting-timezone"
              label="Meeting Timezone"
              value={timezone}
              onChange={setTimezone}
              required
            />

            <div className="space-y-2">
              <label
                htmlFor="platform"
                className="block text-sm font-medium"
              >
                Meeting Platform
              </label>
              <select
                id="platform"
                value={platform}
                onChange={(event) =>
                  setPlatform(event.target.value as MeetingPlatform)
                }
                required
                className="w-full rounded-lg border bg-background px-3 py-3 outline-none transition focus:ring-2 focus:ring-primary"
              >
                <option value="google_meet">Google Meet</option>
                <option value="zoom">Zoom</option>
              </select>
            </div>
          </div>
        </section>

        {/* CLIENT INTEREST AND NOTES */}
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-5 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Step 3
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Client Interest & Notes
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Record the client's interest and any important information.
            </p>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <div className="space-y-2">
              <label
                htmlFor="website-interest"
                className="block text-sm font-medium"
              >
                Website Interest Level
              </label>
              <select
                id="website-interest"
                value={websiteInterestLevel}
                onChange={(event) =>
                  setWebsiteInterestLevel(event.target.value)
                }
                required
                className="w-full rounded-lg border bg-background px-3 py-3 outline-none transition focus:ring-2 focus:ring-primary"
              >
                {WEBSITE_INTEREST_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="client-notes"
                className="block text-sm font-medium"
              >
                Client Notes
                <span className="ml-1 font-normal text-muted-foreground">
                  (Optional)
                </span>
              </label>
              <textarea
                id="client-notes"
                value={clientNotes}
                onChange={(event) => setClientNotes(event.target.value)}
                rows={4}
                placeholder="Client requirements, budget, existing website, objections or follow-up notes..."
                className="w-full resize-y rounded-lg border bg-background px-3 py-3 outline-none transition focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </section>

        {/* ACTIONS */}
        <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/appointments/"
            className="inline-flex items-center justify-center rounded-lg border px-5 py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving Client & Appointment..." : "Save & Book Appointment"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TimezoneSelect({
  id,
  label,
  value,
  onChange,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full rounded-lg border bg-background px-3 py-3 outline-none transition focus:ring-2 focus:ring-primary"
      >
        {TIMEZONES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  inputType = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputType?: string;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <input
        id={id}
        type={inputType}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-background px-3 py-3 outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
  
