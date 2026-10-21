import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, Loading, ErrorBox } from "@/components/crm/ui-bits";

type ClientRow = {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  country: string;
  timezone: string;
};

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time — New York" },
  { value: "America/Chicago", label: "Central Time — Chicago" },
  { value: "America/Denver", label: "Mountain Time — Denver" },
  { value: "America/Los_Angeles", label: "Pacific Time — Los Angeles" },
  { value: "America/Anchorage", label: "Alaska Time — Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii Time — Honolulu" },
  { value: "America/Phoenix", label: "Arizona Time — Phoenix" },
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
    meta: [{ title: "New Appointment — DemoDesk CRM" }],
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

    for (const part of parts) values[part.type] = part.value;

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

  for (const part of finalParts) finalValues[part.type] = part.value;

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

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newClientMode, setNewClientMode] = useState(false);
  const [clientId, setClientId] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("United States");
  const [clientTimezone, setClientTimezone] = useState("America/New_York");

  const [websiteInterestLevel, setWebsiteInterestLevel] = useState("Interested");
  const [clientNotes, setClientNotes] = useState("");

  const [localDate, setLocalDate] = useState("");
  const [localTime, setLocalTime] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [platform, setPlatform] = useState<MeetingPlatform>("google_meet");
  const [duration, setDuration] = useState("30");

  useEffect(() => {
    if (authLoading || !userId || !canBook) {
      setLoadingClients(false);
      return;
    }

    let cancelled = false;

    async function loadClients() {
      setLoadingClients(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("clients")
        .select("id, business_name, owner_name, phone, country, timezone")
        .order("business_name", { ascending: true })
        .limit(500);

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setClients((data ?? []) as ClientRow[]);
      }

      setLoadingClients(false);
    }

    void loadClients();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, canBook]);

  function chooseClient(id: string) {
    setClientId(id);

    const selected = clients.find((client) => client.id === id);

    if (selected?.timezone) {
      const isSupportedTimezone = US_TIMEZONES.some(
        (item) => item.value === selected.timezone,
      );

      const selectedTimezone = isSupportedTimezone
        ? selected.timezone
        : "America/New_York";

      setClientTimezone(selectedTimezone);
      setTimezone(selectedTimezone);
    }
  }

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

    if (!newClientMode && !clientId) {
      setError("Please select a client or choose Add New Client.");
      return;
    }

    if (!websiteInterestLevel) {
      setError("Please select the client's website interest level.");
      return;
    }

    if (!localDate || !localTime || !timezone.trim()) {
      setError("Please enter the meeting date, time and timezone.");
      return;
    }

    let scheduledAt: string;

    try {
      const parsedDate = localDateTimeToUtc(
        localDate,
        localTime,
        timezone.trim(),
      );

      if (parsedDate.getTime() <= Date.now()) {
        throw new Error("Please select a future meeting date and time.");
      }

      scheduledAt = parsedDate.toISOString();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Please check the selected date, time and timezone.",
      );
      return;
    }

    setSaving(true);

    try {
      let selectedClientId = clientId;

      if (newClientMode) {
        if (
          !businessName.trim() ||
          !ownerName.trim() ||
          !phone.trim() ||
          !country.trim() ||
          !clientTimezone.trim()
        ) {
          throw new Error(
            "For a new client, business name, owner name, phone, country and timezone are required.",
          );
        }

        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            business_name: businessName.trim(),
            owner_name: ownerName.trim(),
            phone: phone.trim(),
            email: email.trim() || null,
            country: country.trim(),
            timezone: clientTimezone.trim(),
            created_by: userId,
            is_demo: false,
          })
          .select("id")
          .single();

        if (clientError) throw clientError;

        selectedClientId = newClient.id;
      }

      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          client_id: selectedClientId,
          booking_agent_id: userId,
          local_date: localDate,
          local_time: localTime,
          timezone: timezone.trim(),
          scheduled_at: scheduledAt,
          platform,
          duration_minutes: Number(duration),
          website_interest_level: websiteInterestLevel,
          client_notes: clientNotes.trim() || null,
          status: "scheduled",
          is_demo: false,
        })
        .select("id")
        .single();

      if (appointmentError) throw appointmentError;

      setSuccess("Appointment booked successfully.");

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
    return <ErrorBox error="You must be signed in to book an appointment." />;
  }

  if (!canBook) {
    return (
      <ErrorBox error="You do not have permission to create appointments. Contact your administrator." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book an Appointment"
        subtitle="Create a client demo booking and save it to DemoDesk CRM."
        actions={
          <Link
            to="/appointments/"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Back to Appointments
          </Link>
        }
      />

      {error && <ErrorBox error={error} />}

      {success && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Client Details</h2>
              <p className="text-sm text-muted-foreground">
                Select an existing client or add a new one.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewClientMode(!newClientMode);
                setError("");
              }}
              className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              {newClientMode ? "Choose Existing Client" : "+ Add New Client"}
            </button>
          </div>

          {!newClientMode ? (
            <div className="space-y-2">
              <label htmlFor="client" className="text-sm font-medium">
                Select Client *
              </label>

              {loadingClients ? (
                <Loading />
              ) : (
                <select
                  id="client"
                  value={clientId}
                  onChange={(event) => chooseClient(event.target.value)}
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2.5"
                >
                  <option value="">Choose a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.business_name} — {client.owner_name}
                    </option>
                  ))}
                </select>
              )}

              {!loadingClients && clients.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No clients found. Use Add New Client to create one.
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Business Name *"
                value={businessName}
                onChange={setBusinessName}
                required
              />
              <Field
                label="Owner / Contact Name *"
                value={ownerName}
                onChange={setOwnerName}
                required
              />
              <Field
                label="Phone Number *"
                value={phone}
                onChange={setPhone}
                required
                inputType="tel"
              />
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                inputType="email"
              />

              <div className="space-y-2">
                <label htmlFor="country" className="text-sm font-medium">
                  Country *
                </label>
                <select
                  id="country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  required
                  className="w-full rounded-lg border bg-background px-3 py-2.5"
                >
                  <option value="United States">United States (USA)</option>
                  <option value="Canada">Canada</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Pakistan">Pakistan</option>
                  <option value="Australia">Australia</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <TimezoneSelect
                id="client-timezone"
                label="Client Time Zone *"
                value={clientTimezone}
                onChange={(value) => {
                  setClientTimezone(value);
                  setTimezone(value);
                }}
                required
              />
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">
              Website Interest & Client Notes
            </h2>
            <p className="text-sm text-muted-foreground">
              Record the client's interest in getting a website.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="website-interest"
                className="text-sm font-medium"
              >
                Website Interest Level *
              </label>
              <select
                id="website-interest"
                value={websiteInterestLevel}
                onChange={(event) =>
                  setWebsiteInterestLevel(event.target.value)
                }
                required
                className="w-full rounded-lg border bg-background px-3 py-2.5"
              >
                {WEBSITE_INTEREST_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="client-notes" className="text-sm font-medium">
              Client Notes
            </label>
            <textarea
              id="client-notes"
              value={clientNotes}
              onChange={(event) => setClientNotes(event.target.value)}
              rows={4}
              placeholder="Client requirements, budget, objections, existing website details or follow-up notes..."
              className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Meeting Details</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Meeting Date *"
              value={localDate}
              onChange={setLocalDate}
              required
              inputType="date"
            />

            <Field
              label="Meeting Time *"
              value={localTime}
              onChange={setLocalTime}
              required
              inputType="time"
            />

            <TimezoneSelect
              id="meeting-timezone"
              label="Meeting Time Zone *"
              value={timezone}
              onChange={setTimezone}
              required
            />

            <div className="space-y-2">
              <label htmlFor="duration" className="text-sm font-medium">
                Duration *
              </label>
              <select
                id="duration"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                required
                className="w-full rounded-lg border bg-background px-3 py-2.5"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="platform" className="text-sm font-medium">
                Meeting Platform *
              </label>
              <select
                id="platform"
                value={platform}
                onChange={(event) =>
                  setPlatform(event.target.value as MeetingPlatform)
                }
                required
                className="w-full rounded-lg border bg-background px-3 py-2.5"
              >
                <option value="google_meet">Google Meet</option>
                <option value="zoom">Zoom</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || loadingClients}
            className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving Appointment..." : "Book Appointment"}
          </button>

          <Link
            to="/appointments/"
            className="rounded-lg border px-5 py-2.5 font-medium hover:bg-muted"
          >
            Cancel
          </Link>
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
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full rounded-lg border bg-background px-3 py-2.5"
      >
        {US_TIMEZONES.map((timezoneOption) => (
          <option key={timezoneOption.value} value={timezoneOption.value}>
            {timezoneOption.label}
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
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={inputType}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
