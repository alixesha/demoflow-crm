
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ErrorBox,
  Loading,
  PageHeader,
} from "@/components/crm/ui-bits";

type Client = {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string | null;
  country: string;
  timezone: string;
  notes: string | null;
  created_at: string;
  is_demo: boolean;
};

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({ meta: [{ title: "Clients — DemoDesk CRM" }] }),
  component: Clients,
});

function Clients() {
  const { userId, loading: authLoading } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Karachi",
  );
  const [notes, setNotes] = useState("");

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("clients")
      .select(
        "id, business_name, owner_name, phone, email, country, timezone, notes, created_at, is_demo",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (fetchError) {
      setError(fetchError.message);
      setClients([]);
    } else {
      setClients((data ?? []) as Client[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  function resetForm() {
    setBusinessName("");
    setOwnerName("");
    setPhone("");
    setEmail("");
    setCountry("");
    setTimezone(
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Karachi",
    );
    setNotes("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!userId) {
      setError("Please sign in again before adding a client.");
      return;
    }

    setSaving(true);

    const { error: insertError } = await supabase.from("clients").insert({
      business_name: businessName.trim(),
      owner_name: ownerName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      country: country.trim(),
      timezone: timezone.trim(),
      notes: notes.trim() || null,
      created_by: userId,
      is_demo: false,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    resetForm();
    setShowForm(false);
    setMessage("Client added successfully.");
    await loadClients();
    setSaving(false);
  }

  const normalizedSearch = search.trim().toLowerCase();

  const filteredClients = clients.filter((client) =>
    [
      client.business_name,
      client.owner_name,
      client.phone,
      client.email ?? "",
      client.country,
    ].some((value) => value.toLowerCase().includes(normalizedSearch)),
  );

  if (authLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Manage business contacts and client information."
        actions={
          <button
            type="button"
            onClick={() => {
              setShowForm(!showForm);
              setError("");
              setMessage("");
            }}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {showForm ? "Close Form" : "+ Add Client"}
          </button>
        }
      />

      {error && <ErrorBox message={error} />}

      {message && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border bg-card p-5"
        >
          <div>
            <h2 className="text-lg font-semibold">Add New Client</h2>
            <p className="text-sm text-muted-foreground">
              Fields marked with * are required.
            </p>
          </div>

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
              type="tel"
            />
            <Field
              label="Email Address"
              value={email}
              onChange={setEmail}
              type="email"
            />
            <Field
              label="Country *"
              value={country}
              onChange={setCountry}
              required
              placeholder="United States"
            />
            <Field
              label="Timezone *"
              value={timezone}
              onChange={setTimezone}
              required
              placeholder="America/New_York"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="client-notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="client-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Additional information about this client..."
              className="w-full rounded-lg border bg-background px-3 py-2.5"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Client"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="rounded-lg border px-5 py-2.5 font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Client Directory</h2>
            <p className="text-sm text-muted-foreground">
              {filteredClients.length} client
              {filteredClients.length === 1 ? "" : "s"} shown
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadClients()}
            disabled={loading}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search business, contact, phone, email or country..."
          className="w-full rounded-lg border bg-background px-3 py-2.5"
        />

        {loading ? (
          <Loading />
        ) : filteredClients.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <h3 className="font-semibold">
              {clients.length === 0 ? "No clients yet" : "No matching clients"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {clients.length === 0
                ? "Add your first client to get started."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <article
                key={client.id}
                className="space-y-3 rounded-lg border p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold">{client.business_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {client.owner_name}
                    </p>
                  </div>
                  <span className="w-fit rounded-full border px-2.5 py-1 text-xs">
                    {client.is_demo ? "Demo Client" : "Client"}
                  </span>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Phone: </span>
                    {client.phone}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Email: </span>
                    {client.email || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Country: </span>
                    {client.country}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Timezone: </span>
                    {client.timezone}
                  </p>
                </div>

                {client.notes && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {client.notes}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Added {new Date(client.created_at).toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Showing up to 500 clients. Search filters the clients currently loaded.
        </p>
      </section>
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
                
