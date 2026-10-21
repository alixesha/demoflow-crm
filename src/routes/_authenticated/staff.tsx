
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ErrorBox,
  Loading,
  PageHeader,
  RequireRole,
} from "@/components/crm/ui-bits";

type StaffRole = "admin" | "booking_agent" | "demo_staff";

type StaffMember = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
};

type StaffRoleRow = {
  user_id: string;
  role: StaffRole;
};

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [{ title: "Staff — DemoDesk CRM" }],
  }),
  component: Staff,
});

function Staff() {
  const { hasRole } = useAuth();

  if (!hasRole("admin")) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Staff"
          subtitle="Staff directory and team access overview."
        />
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold">Admin access required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Only administrators can view the staff directory and manage team access.
          </p>
        </div>
      </div>
    );
  }

  return <StaffDirectory />;
}

function StaffDirectory() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roleRows, setRoleRows] = useState<StaffRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | StaffRole>("all");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");

    const [profilesResult, rolesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, is_active")
        .order("full_name", { ascending: true })
        .limit(1000),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    if (profilesResult.error) {
      setError(profilesResult.error.message);
      setStaff([]);
      setRoleRows([]);
    } else if (rolesResult.error) {
      setError(rolesResult.error.message);
      setStaff((profilesResult.data ?? []) as StaffMember[]);
      setRoleRows([]);
    } else {
      setStaff((profilesResult.data ?? []) as StaffMember[]);
      setRoleRows((rolesResult.data ?? []) as StaffRoleRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const getRoles = (userId: string) =>
    roleRows.filter((row) => row.user_id === userId).map((row) => row.role);

  const filteredStaff = staff.filter((member) => {
    const term = search.trim().toLowerCase();
    const roles = getRoles(member.id);

    const matchesSearch =
      !term ||
      [member.full_name, member.email, member.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && member.is_active) ||
      (statusFilter === "inactive" && !member.is_active);

    const matchesRole = roleFilter === "all" || roles.includes(roleFilter);

    return matchesSearch && matchesStatus && matchesRole;
  });

  const activeCount = staff.filter((member) => member.is_active).length;
  const inactiveCount = staff.length - activeCount;

  const roleCounts: Record<StaffRole, number> = {
    admin: 0,
    booking_agent: 0,
    demo_staff: 0,
  };

  roleRows.forEach((row) => {
    if (row.role in roleCounts) {
      roleCounts[row.role]++;
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Management"
        subtitle="View staff accounts, assigned roles and account status."
      />

      {error && <ErrorBox message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total accounts" value={staff.length} />
        <SummaryCard title="Active accounts" value={activeCount} />
        <SummaryCard title="Inactive accounts" value={inactiveCount} />
        <SummaryCard title="Administrators" value={roleCounts.admin} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard title="Booking agents" value={roleCounts.booking_agent} />
        <SummaryCard title="Demo staff" value={roleCounts.demo_staff} />
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Staff directory</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredStaff.length} of {staff.length} accounts
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadStaff()}
            className="min-h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email or phone..."
            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as typeof statusFilter)
            }
            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All account statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>

          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value as typeof roleFilter)
            }
            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="booking_agent">Booking Agent</option>
            <option value="demo_staff">Demo Staff</option>
          </select>
        </div>

        {loading ? (
          <Loading />
        ) : filteredStaff.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <h3 className="font-medium">No staff members found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Try changing your search or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Staff member</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Account status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => {
                  const roles = getRoles(member.id);

                  return (
                    <tr key={member.id} className="border-t border-border">
                      <td className="px-4 py-4">
                        <div className="font-medium">
                          {member.full_name || "Unnamed user"}
                        </div>
                        <div className="mt-1 break-all text-xs text-muted-foreground">
                          {member.email}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {member.phone || "Not provided"}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {roles.length ? (
                            roles.map((role) => (
                              <span
                                key={role}
                                className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium"
                              >
                                {formatRole(role)}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">
                              No role assigned
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            member.is_active
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {member.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        This page is read-only. Account activation and role changes must be
        performed through a separately secured admin workflow. Database
        permissions must also restrict staff data access.
      </p>
    </div>
  );
}

function formatRole(role: StaffRole) {
  const labels: Record<StaffRole, string> = {
    admin: "Admin",
    booking_agent: "Booking Agent",
    demo_staff: "Demo Staff",
  };

  return labels[role];
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
    }
            
