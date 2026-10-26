import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  TrendingUp,
  Trophy,
  Medal,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { AppointmentStatus, DemoOutcome } from "@/lib/labels";
import {
  ErrorBox,
  Loading,
  OutcomePill,
  PageHeader,
  Stat,
  StatusPill,
} from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Team CUL CRM" }],
  }),
  component: Dashboard,
});

type RecentAppointment = {
  id: string;
  created_at: string;
  scheduled_at: string;
  local_date: string;
  local_time: string;
  status: AppointmentStatus;
  outcome: DemoOutcome | null;
  sale_amount: number | null;
  clients: {
    business_name: string;
    owner_name: string;
  } | null;
};

type LeaderboardAppointment = {
  booking_agent_id: string | null;
  created_at: string;
  outcome: string | null;
  sale_amount: number | null;
  is_demo: boolean | null;
};

type LeaderboardAgent = {
  user_id: string;
  full_name: string;
  sales: number;
  salesAmount: number;
};

type DateFilter = "today" | "week" | "month" | "all";

function getDateRange(filter: DateFilter) {
  if (filter === "all") {
    return null;
  }

  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  if (filter === "week") {
    const day = start.getDay();
    const daysSinceMonday = (day + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  }

  if (filter === "month") {
    start.setDate(1);
  }

  const end = new Date(start);

  if (filter === "today") {
    end.setDate(end.getDate() + 1);
  } else if (filter === "week") {
    end.setDate(end.getDate() + 7);
  } else {
    end.setMonth(end.getMonth() + 1);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function Dashboard() {
  const { profile, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isDemoStaff = hasRole("demo_staff");
  const canSeeTeam = isAdmin || isDemoStaff;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [total, setTotal] = useState(0);
  const [upcoming, setUpcoming] = useState(0);
  const [followUps, setFollowUps] = useState(0);
  const [sales, setSales] = useState(0);
  const [salesAmount, setSalesAmount] = useState(0);
  const [recent, setRecent] = useState<RecentAppointment[]>([]);

  const [leaderboard, setLeaderboard] = useState<LeaderboardAgent[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user.id;

      if (!userId) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      setCurrentUserId(userId);

      const now = new Date().toISOString();
      const today = new Date().toLocaleDateString("en-CA");

      let baseQuery = supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("is_demo", false);

      let upcomingQuery = supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("is_demo", false)
        .in("status", ["scheduled", "rescheduled"])
        .gte("scheduled_at", now);

      let followUpQuery = supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("is_demo", false)
        .eq("outcome", "follow_up_required")
        .not("follow_up_date", "is", null)
        .lte("follow_up_date", today);

      let salesQuery = supabase
        .from("appointments")
        .select("sale_amount")
        .eq("is_demo", false)
        .eq("outcome", "sold");

      let recentQuery = supabase
        .from("appointments")
        .select(
          "id, created_at, scheduled_at, local_date, local_time, status, outcome, sale_amount, clients(business_name, owner_name)"
        )
        .eq("is_demo", false)
        .order("created_at", { ascending: false })
        .limit(6);

      if (!canSeeTeam) {
        baseQuery = baseQuery.eq("booking_agent_id", userId);
        upcomingQuery = upcomingQuery.eq("booking_agent_id", userId);
        followUpQuery = followUpQuery.eq("booking_agent_id", userId);
        salesQuery = salesQuery.eq("booking_agent_id", userId);
        recentQuery = recentQuery.eq("booking_agent_id", userId);
      }

      const [
        totalResult,
        upcomingResult,
        followUpResult,
        salesResult,
        recentResult,
      ] = await Promise.all([
        baseQuery,
        upcomingQuery,
        followUpQuery,
        salesQuery,
        recentQuery,
      ]);

      const firstError =
        totalResult.error ||
        upcomingResult.error ||
        followUpResult.error ||
        salesResult.error ||
        recentResult.error;

      if (firstError) throw firstError;

      setTotal(totalResult.count ?? 0);
      setUpcoming(upcomingResult.count ?? 0);
      setFollowUps(followUpResult.count ?? 0);

      const soldRows = salesResult.data ?? [];
      setSales(soldRows.length);
      setSalesAmount(
        soldRows.reduce(
          (sum, row) => sum + Number(row.sale_amount ?? 0),
          0
        )
      );

      setRecent(
        (recentResult.data ?? []) as unknown as RecentAppointment[]
      );

      // Load leaderboard records. Booking agents only request their own data.
      const range = getDateRange(dateFilter);

      let leaderboardQuery = supabase
        .from("appointments")
        .select(
          "booking_agent_id, created_at, outcome, sale_amount, is_demo"
        )
        .eq("is_demo", false)
        .eq("outcome", "sold");

      if (!canSeeTeam) {
        leaderboardQuery = leaderboardQuery.eq(
          "booking_agent_id",
          userId
        );
      }

      if (range) {
        leaderboardQuery = leaderboardQuery
          .gte("created_at", range.start)
          .lt("created_at", range.end);
      }

      const leaderboardResult = await leaderboardQuery;

      if (leaderboardResult.error) {
        throw leaderboardResult.error;
      }

      const soldAppointments =
        (leaderboardResult.data ?? []) as LeaderboardAppointment[];

      let agents: { user_id: string; full_name: string }[] = [];

      if (canSeeTeam) {
        const [rolesResult, profilesResult] = await Promise.all([
          supabase
            .from("user_roles")
            .select("user_id, role")
            .eq("role", "booking_agent"),

          supabase
            .from("profiles")
            .select("id, full_name"),
        ]);

        if (rolesResult.error) throw rolesResult.error;
        if (profilesResult.error) throw profilesResult.error;

        const names = new Map(
          (profilesResult.data ?? []).map((row) => [
            row.id,
            row.full_name,
          ])
        );

        agents = [
          ...new Set(
            (rolesResult.data ?? []).map((row) => row.user_id)
          ),
        ].map((id) => ({
          user_id: id,
          full_name: names.get(id) || "Unnamed Agent",
        }));
      } else {
        agents = [
          {
            user_id: userId,
            full_name: profile?.full_name || "My Performance",
          },
        ];
      }

      const rows: LeaderboardAgent[] = agents.map((agent) => {
        const agentSales = soldAppointments.filter(
          (appointment) =>
            appointment.booking_agent_id === agent.user_id
        );

        return {
          user_id: agent.user_id,
          full_name: agent.full_name,
          sales: agentSales.length,
          salesAmount: agentSales.reduce(
            (sum, appointment) =>
              sum + Number(appointment.sale_amount ?? 0),
            0
          ),
        };
      });

      rows.sort(
        (a, b) =>
          b.sales - a.sales ||
          b.salesAmount - a.salesAmount ||
          a.full_name.localeCompare(b.full_name)
      );

      setLeaderboard(rows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Dashboard data could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [canSeeTeam, dateFilter, profile?.full_name]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const filterOptions: { value: DateFilter; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "all", label: "All Time" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Your website demo operations at a glance."
        actions={
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        }
      />

      <section className="surface flex flex-col justify-between gap-4 overflow-hidden p-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Welcome back
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">
            {profile?.full_name || "Team Member"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep your bookings organized and your demos moving forward.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Team CUL CRM</p>
            <p className="text-xs text-muted-foreground">
              Appointment workspace
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div className="space-y-3">
          <ErrorBox message={error} />
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Try loading again
          </button>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">
            Performance overview
          </h2>
          <span className="text-xs text-muted-foreground">
            Excludes demo records
          </span>
        </div>

        {loading ? (
          <Loading label="Loading your dashboard..." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Total Appointments"
              value={total.toLocaleString()}
              hint="All non-demo appointments"
              icon={CalendarDays}
            />
            <Stat
              label="Upcoming Demos"
              value={upcoming.toLocaleString()}
              hint="Scheduled or rescheduled"
              icon={Clock3}
            />
            <Stat
              label="Follow-ups Due"
              value={followUps.toLocaleString()}
              hint="Due today or overdue"
              icon={AlertCircle}
            />
            <Stat
              label="Sales Closed"
              value={sales.toLocaleString()}
              hint={`Recorded sales: ${salesAmount.toLocaleString()}`}
              icon={TrendingUp}
            />
          </div>
        )}
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <h2 className="font-display text-lg font-semibold">
                Sales Leaderboard
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked by number of closed sales.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDateFilter(option.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  dateFilter === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Loading label="Loading sales leaderboard..." />
        ) : leaderboard.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Trophy className="mx-auto h-9 w-9 text-muted-foreground/60" />
            <h3 className="mt-3 font-semibold">No sales to rank yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Closed sales for this period will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {leaderboard.map((agent, index) => (
              <div
                key={agent.user_id}
                className={`flex flex-col gap-3 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  index === 0 ? "bg-yellow-500/5" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      index === 0
                        ? "bg-yellow-500/15 text-yellow-600"
                        : index === 1
                          ? "bg-slate-400/15 text-slate-500"
                          : index === 2
                            ? "bg-orange-600/10 text-orange-600"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index < 3 ? (
                      <Medal className="h-5 w-5" />
                    ) : (
                      <span className="font-semibold">{index + 1}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {agent.full_name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {index === 0 && agent.sales > 0
                        ? "Top Sales Agent"
                        : `Rank #${index + 1}`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 sm:gap-10">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Closed Sales
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {agent.sales.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Sales Amount
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {agent.salesAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          {dateFilter === "all"
            ? "All-time results."
            : `Filtered by ${filterOptions.find((item) => item.value === dateFilter)?.label.toLowerCase()}.`}{" "}
          Date range uses appointment creation date. Demo records are excluded.
        </div>
      </section>

      {canSeeTeam && (
        <section className="surface overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="font-display text-lg font-semibold">
              Agent-wise Performance
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Overall appointment performance for every booking agent.
            </p>
          </div>

          {loading ? (
            <Loading label="Loading agent performance..." />
          ) : leaderboard.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No booking agents found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Agent</th>
                    <th className="px-5 py-3 text-right font-medium">
                      Closed Sales
                    </th>
                    <th className="px-5 py-3 text-right font-medium">
                      Sales Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leaderboard.map((agent) => (
                    <tr key={agent.user_id}>
                      <td className="px-5 py-4 font-medium">
                        {agent.full_name}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {agent.sales}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums">
                        {agent.salesAmount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-display text-lg font-semibold">
              Recent Appointments
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The latest bookings recorded in your workspace.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Database connected
          </div>
        </div>
{loading ? (
          <Loading label="Loading recent appointments..." />
        ) : recent.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground/60" />
            <h3 className="mt-3 font-semibold">No appointments yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your latest bookings will appear here when they are added.
            </p>
            <Link
              to="/appointments/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Create appointment <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((appointment) => (
              <Link
                key={appointment.id}
                to="/appointments/$id"
                params={{ id: appointment.id }}
                className="flex flex-col gap-3 p-5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {appointment.clients?.business_name || "Unnamed client"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {appointment.clients?.owner_name || "No contact name"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {appointment.local_date} · {appointment.local_time}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <StatusPill status={appointment.status} />
                  <OutcomePill outcome={appointment.outcome} />
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && recent.length > 0 && (
          <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" />
            Showing the 6 most recently created appointments.
          </div>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Appointment access follows your account&apos;s database permissions.
      </p>
    </div>
  );
}
        
