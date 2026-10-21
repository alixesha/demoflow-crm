
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ErrorBox,
  Loading,
  PageHeader,
  StatusPill,
} from "@/components/crm/ui-bits";

type FollowUp = {
  id: string;
  client_id: string;
  booking_agent_id: string;
  local_date: string;
  local_time: string;
  timezone: string;
  status: "scheduled" | "rescheduled" | "completed" | "cancelled" | "no_show";
  follow_up_date: string | null;
  outcome: string | null;
  sale_amount: number | null;
  clients: {
    business_name: string;
    owner_name: string;
    phone: string;
    email: string | null;
  } | null;
};

export const Route = createFileRoute("/_authenticated/follow-ups")({
  head: () => ({
    meta: [{ title: "Follow-ups — DemoDesk CRM" }],
  }),
  component: FollowUps,
});

function FollowUps() {
  const { userId, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isDemoStaff = hasRole("demo_staff");

  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "overdue" | "upcoming">("all");
  const [search, setSearch] = useState("");

  const loadFollowUps = useCallback(async () => {
    setLoading(true);
    setError("");

    let query = supabase
      .from("appointments")
      .select(
        "id, client_id, booking_agent_id, local_date, local_time, timezone, status, follow_up_date, outcome, sale_amount, clients(business_name, owner_name, phone, email)"
      )
      .not("follow_up_date", "is", null)
      .order("follow_up_date", { ascending: true })
      .limit(500);

    // Booking agents only request their own appointments.
    // Supabase RLS must enforce this restriction as well.
    if (!isAdmin && !isDemoStaff && userId) {
      query = query.eq("booking_agent_id", userId);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      setError(queryError.message);
      setItems([]);
    } else {
      setItems((data ?? []) as unknown as FollowUp[]);
    }

    setLoading(false);
  }, [isAdmin, isDemoStaff, userId]);

  useEffect(() => {
    void loadFollowUps();
  }, [loadFollowUps]);

  const today = new Date().toLocaleDateString("en-CA");

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      const date = item.follow_up_date ?? "";
      const isOpen = item.status !== "cancelled";

      if (!isOpen) return false;

      if (filter === "today" && date !== today) return false;
      if (filter === "overdue" && date >= today) return false;
      if (filter === "upcoming" && date <= today) return false;

      if (!term) return true;

      const client = item.clients;
      return [
        client?.business_name,
        client?.owner_name,
        client?.phone,
        client?.email,
        item.outcome,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [items, filter, search, today]);

  const overdueCount = items.filter(
    (item) =>
      item.status !== "cancelled" &&
      item.follow_up_date &&
      item.follow_up_date < today
  ).length;

  const todayCount = items.filter(
    (item) =>
      item.status !== "cancelled" &&
      item.follow_up_date === today
  ).length;

  const upcomingCount = items.filter(
    (item) =>
      item.status !== "cancelled" &&
      item.follow_up_date &&
      item.follow_up_date > today
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        subtitle="Track pending client follow-ups and keep every opportunity moving."
      />

      {error && <ErrorBox message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Overdue"
          count={overdueCount}
          description="Follow-ups past their due date"
        />
        <SummaryCard
          title="Due today"
          count={todayCount}
          description="Clients to contact today"
        />
        <SummaryCard
          title="Upcoming"
          count={upcomingCount}
          description="Scheduled for a future date"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search business, contact, phone or email..."
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:flex-1"
        />

        <button
          type="button"
          onClick={() => void loadFollowUps()}
          className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
          All follow-ups
        </FilterButton>
        <FilterButton active={filter === "overdue"} onClick={() => setFilter("overdue")}>
          Overdue
        </FilterButton>
        <FilterButton active={filter === "today"} onClick={() => setFilter("today")}>
          Due today
        </FilterButton>
        <FilterButton active={filter === "upcoming"} onClick={() => setFilter("upcoming")}>
          Upcoming
        </FilterButton>
      </div>

      {loading ? (
        <Loading />
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <h3 className="font-semibold">No follow-ups found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another filter or search term. Follow-ups appear here when an
            appointment has a follow-up date.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const client = item.clients;
            const date = item.follow_up_date ?? "";
            const overdue = date < today;
            const dueToday = date === today;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">
                        {client?.business_name || "Unknown business"}
                      </h3>
                      <StatusPill status={item.status} />
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Contact: {client?.owner_name || "Not provided"}
                    </p>

                    {client?.phone && (
                      <p className="text-sm">
                        Phone:{" "}
                        <a
                          href={`tel:${client.phone}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {client.phone}
                        </a>
                      </p>
                    )}

                    {client?.email && (
                      <p className="break-all text-sm">
                        Email:{" "}
                        <a
                          href={`mailto:${client.email}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {client.email}
                        </a>
                      </p>
                    )}

                    <p className="text-sm text-muted-foreground">
                      Demo: {item.local_date} at {item.local_time} ({item.timezone})
                    </p>

                    {item.outcome && (
                      <p className="text-sm">
                        Last outcome:{" "}
                        <span className="font-medium">
                          {item.outcome.replaceAll("_", " ")}
                        </span>
                      </p>
                    )}

                    {item.sale_amount !== null && (
                      <p className="text-sm">
                        Sale amount: {item.sale_amount.toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                    <div
                      className={`rounded-lg px-3 py-2 text-sm font-medium ${
                        overdue
                          ? "bg-destructive/10 text-destructive"
                          : dueToday
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {overdue
                        ? `Overdue · ${date}`
                        : dueToday
                          ? "Due today"
                          : `Due ${date}`}
                    </div>

                    <Link
                      to="/appointments/$id"
                      params={{ id: item.id }}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      Open appointment
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  count,
  description,
}: {
  title: string;
  count: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{count}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
        }
          
