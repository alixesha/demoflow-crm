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
  Users,
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

type TeamAppointment = {
  booking_agent_id: string | null;
  status: string | null;
  outcome: string | null;
  sale_amount: number | null;
  scheduled_at: string | null;
  follow_up_date: string | null;
  is_demo: boolean | null;
};

type TeamAgent = {
  user_id: string;
  full_name: string;
  total: number;
  upcoming: number;
  followUps: number;
  sales: number;
  salesAmount: number;
};

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
  const [teamAgents, setTeamAgents] = useState<TeamAgent[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const today = new Date().toISOString().slice(0, 10);

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
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const currentUserId = sessionData.session?.user.id;

        if (!currentUserId) {
          throw new Error("Your session has expired. Please sign in again.");
        }

        baseQuery = baseQuery.eq("booking_agent_id", currentUserId);
        upcomingQuery = upcomingQuery.eq(
          "booking_agent_id",
          currentUserId
        );
        followUpQuery = followUpQuery.eq(
          "booking_agent_id",
          currentUserId
        );
        salesQuery = salesQuery.eq("booking_agent_id", currentUserId);
        recentQuery = recentQuery.eq("booking_agent_id", currentUserId);
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

      // Admin aur Demo Staff ke liye har booking agent ki performance.
      if (canSeeTeam) {
        const [rolesResult, profilesResult, appointmentsResult] =
          await Promise.all([
            supabase
              .from("user_roles")
              .select("user_id, role")
              .eq("role", "booking_agent"),

            supabase
              .from("profiles")
              .select("id, full_name"),

            supabase
              .from("appointments")
              .select(
                "booking_agent_id, status, outcome, sale_amount, scheduled_at, follow_up_date, is_demo"
              )
              .eq("is_demo", false),
          ]);

        const teamError =
          rolesResult.error ||
          profilesResult.error ||
          appointmentsResult.error;

        if (teamError) throw teamError;

        const agentIds = [
          ...new Set(
            (rolesResult.data ?? []).map((row) => row.user_id)
          ),
        ];

        const profileNames = new Map(
          (profilesResult.data ?? []).map((row) => [
            row.id,
            row.full_name,
          ])
        );

        const appointmentRows =
          (appointmentsResult.data ?? []) as TeamAppointment[];

        const agentStats: TeamAgent[] = agentIds.map((userId) => {
          const agentAppointments = appointmentRows.filter(
            (appointment) =>
              appointment.booking_agent_id === userId
          );

          const agentUpcoming = agentAppointments.filter(
            (appointment) =>
              ["scheduled", "rescheduled"].includes(
                appointment.status ?? ""
              ) &&
              !!appointment.scheduled_at &&
              appointment.scheduled_at >= now
          ).length;

          const agentFollowUps = agentAppointments.filter(
            (appointment) =>
              appointment.outcome === "follow_up_required" &&
              !!appointment.follow_up_date &&
              appointment.follow_up_date <= today
          ).length;

          const soldAppointments = agentAppointments.filter(
            (appointment) => appointment.outcome === "sold"
          );

          return {
            user_id: userId,
            full_name: profileNames.get(userId) || "Unnamed Agent",
            total: agentAppointments.length,
            upcoming: agentUpcoming,
            followUps: agentFollowUps,
            sales: soldAppointments.length,
            salesAmount: soldAppointments.reduce(
              (sum, appointment) =>
                sum + Number(appointment.sale_amount ?? 0),
              0
            ),
          };
        });

        agentStats.sort(
          (a, b) =>
            b.sales - a.sales ||
            b.total - a.total ||
            a.full_name.localeCompare(b.full_name)
        );

        setTeamAgents(agentStats);
      } else {
        setTeamAgents([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Dashboard data could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [canSeeTeam]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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

      {canSeeTeam && (
        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="font-display text-lg font-semibold">
                Agent-wise Performance
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Individual booking results for every booking agent.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
              <Users className="h-4 w-4" />
              {teamAgents.length} agents
            </div>
          </div>

          {loading ? (
            <Loading label="Loading agent performance..." />
          ) : teamAgents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Users className="mx-auto h-9 w-9 text-muted-foreground/60" />
              <h3 className="mt-3 font-semibold">
                No booking agents found
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Users assigned the booking_agent role will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Booking Agent</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Upcoming
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Follow-ups
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Sales
                    </th>
                    <th className="px-5 py-3 text-right font-medium">
                      Sales Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {teamAgents.map((agent) => (
                    <tr
                      key={agent.user_id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium">
                          {agent.full_name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Booking Agent
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {agent.total}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {agent.upcoming}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {agent.followUps}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold tabular-nums">
                        {agent.sales}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums">
                        {agent.salesAmount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Sales are sorted highest first. Demo records are excluded.
          </div>
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
