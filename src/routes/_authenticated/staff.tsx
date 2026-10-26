
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  ErrorBox,
  Loading,
  PageHeader,
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
            Only administrators can manage staff accounts.
          </p>
        </div>
      </div>
    );
  }

  return <StaffDirectory />;
}

function StaffDirectory() {
  const { userId } = useAuth();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roleRows, setRoleRows] = useState<StaffRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [statusBusyUserId, setStatusBusyUserId] = useState<string | null>(
    null,
  );
  const [pendingRoles, setPendingRoles] = useState<
    Record<string, StaffRole>
  >({});
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [roleFilter, setRoleFilter] = useState<"all" | StaffRole>("all");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [profilesResult, rolesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, phone, is_active")
          .order("full_name", { ascending: true })
          .limit(1000),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;

      setStaff((profilesResult.data ?? []) as StaffMember[]);
      setRoleRows((rolesResult.data ?? []) as StaffRoleRow[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load staff accounts.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const getRoles = (id: string): StaffRole[] =>
    roleRows.filter((row) => row.user_id === id).map((row) => row.role);

  const assignRole = async (member: StaffMember) => {
    const newRole = pendingRoles[member.id];

    if (!newRole) {
      setError("Please select a role first.");
      return;
    }

    if (!userId) {
      setError("Your login session could not be verified.");
      return;
    }

    if (member.id === userId) {
      setError("You cannot change your own role here.");
      return;
    }

    if (!member.is_active) {
      setError("Resume this staff account before changing its role.");
      return;
    }

    const currentRoles = getRoles(member.id);

    if (currentRoles.length === 1 && currentRoles[0] === newRole) {
      setError("This user already has the selected role.");
      return;
    }

    if (
      currentRoles.includes("admin") &&
      newRole !== "admin" &&
      roleRows.filter((row) => row.role === "admin").length <= 1
    ) {
      setError("The last administrator cannot be demoted.");
      return;
    }

    const roleLabel = formatRole(newRole);
    const confirmed = window.confirm(
      `Assign ${roleLabel} role to ${member.email}?`,
    );

    if (!confirmed) return;

    setSavingUserId(member.id);
    setError("");
    setSuccess("");

    try {
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", member.id);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({
          user_id: member.id,
          role: newRole,
        });

      if (insertError) {
        throw new Error(
          `Role assignment failed. The previous role may have been removed. Refresh and verify this account. Details: ${insertError.message}`,
        );
      }

      setSuccess(`Role updated successfully for ${member.email}.`);

      setPendingRoles((previous) => {
        const next = { ...previous };
        delete next[member.id];
        return next;
      });

      await loadStaff();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update the user role.",
      );
      await loadStaff();
    } finally {
      setSavingUserId(null);
    }
  };

  const changeAccountStatus = async (
    member: StaffMember,
    makeActive: boolean,
    removeFromTeam = false,
  ) => {
    if (!userId) {
      setError("Your login session could not be verified.");
      return;
    }

    if (member.id === userId) {
      setError("You cannot pause or remove your own account.");
      return;
    }

    if (statusBusyUserId || savingUserId) return;

    const actionText = removeFromTeam
      ? "remove from the active team"
      : makeActive
        ? "resume"
        : "pause";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} ${member.full_name || member.email}?\n\n` +
        (makeActive
          ? "The account will be marked active."
          : "The account will be marked inactive. Historical appointments and sales records will not be deleted."),
    );

    if (!confirmed) return;

    setStatusBusyUserId(member.id);
    setError("");
    setSuccess("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_set_staff_active",
        {
          target_user_id: member.id,
          make_active: makeActive,
        },
      );

      if (rpcError) throw rpcError;

      setSuccess(
        removeFromTeam
          ? `${member.email} has been removed from the active team. The account and history are retained.`
          : makeActive
            ? `${member.email} has been resumed.`
            : `${member.email} has been paused. Historical records are preserved.`,
      );

      await loadStaff();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Could not ${actionText} this account.`,
      );
    } finally {
      setStatusBusyUserId(null);
    }
  };

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
    if (row.role in roleCounts) roleCounts[row.role]++;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Management"
        subtitle="Manage team accounts, roles and account status."
      />

      {error && <ErrorBox message={error} />}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Total accounts" value={staff.length} />
        <SummaryCard title="Active accounts" value={activeCount} />
        <SummaryCard title="Inactive accounts" value={inactiveCount} />
        <SummaryCard title="Administrators" value={roleCounts.admin} />
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
            disabled={
              loading ||
              savingUserId !== null ||
              statusBusyUserId !== null
            }
            className="min-h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
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
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Staff member</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Current role</th>
                  <th className="px-4 py-3 font-medium">Account status</th>
                  <th className="px-4 py-3 font-medium">Assign role</th>
                  <th className="px-4 py-3 font-medium">Account actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.map((member) => {
                  const roles = getRoles(member.id);
                  const selectedRole =
                    pendingRoles[member.id] ?? roles[0] ?? "";
                  const isSelf = member.id === userId;
                  const isBusy =
                    savingUserId === member.id ||
                    statusBusyUserId === member.id;

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

                      <td className="px-4 py-4">
                        <div className="flex min-w-44 flex-col gap-2">
                          <select
                            value={selectedRole}
                            disabled={
                              isBusy || isSelf || !member.is_active
                            }
                            onChange={(event) =>
                              setPendingRoles((previous) => ({
                                ...previous,
                                [member.id]: event.target.value as StaffRole,
                              }))
                            }
                            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"
                          >
                            <option value="" disabled>
                              Select role
                            </option>
                            <option value="admin">Admin</option>
                            <option value="booking_agent">
                              Booking Agent
                            </option>
                            <option value="demo_staff">Demo Staff</option>
                          </select>

                          <button
                            type="button"
                            disabled={
                              savingUserId !== null ||
                              statusBusyUserId !== null ||
                              loading ||
                              isSelf ||
                              !member.is_active ||
                              !pendingRoles[member.id] ||
                              pendingRoles[member.id] === roles[0]
                            }
                            onClick={() => void assignRole(member)}
                            className="min-h-10 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingUserId === member.id
                              ? "Saving..."
                              : "Save Role"}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex min-w-48 flex-col gap-2">
                          {member.is_active ? (
                            <>
                              <button
                                type="button"
                                disabled={
                                  isSelf ||
                                  isBusy ||
                                  loading ||
                                  savingUserId !== null ||
                                  statusBusyUserId !== null
                                }
                                onClick={() =>
                                  void changeAccountStatus(member, false)
                                }
                                className="min-h-10 rounded-lg border border-amber-500/40 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-400"
                              >
                                {statusBusyUserId === member.id
                                  ? "Updating..."
                                  : "Pause Account"}
                              </button>

                              <button
                                type="button"
                                disabled={
                                  isSelf ||
                                  isBusy ||
                                  loading ||
                                  savingUserId !== null ||
                                  statusBusyUserId !== null
                                }
                                onClick={() =>
                                  void changeAccountStatus(
                                    member,
                                    false,
                                    true,
                                  )
                                }
                                className="min-h-10 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Remove from Active Team
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                isSelf ||
                                isBusy ||
                                loading ||
                                savingUserId !== null ||
                                statusBusyUserId !== null
                              }
                              onClick={() =>
                                void changeAccountStatus(member, true)
                              }
                              className="min-h-10 rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
                            >
                              {statusBusyUserId === member.id
                                ? "Updating..."
                                : "Resume Account"}
                            </button>
                          )}

                          {isSelf && (
                            <p className="text-xs text-muted-foreground">
                              Your own account is protected.
                            </p>
                          )}
                        </div>
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
        Pausing or removing a staff member sets the account inactive and
        preserves historical records. These actions do not permanently delete
        the Supabase Auth user. Login enforcement must also be configured in
        authentication/session handling and database policies.
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

                              
