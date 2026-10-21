import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff — DemoDesk CRM" }] }),
  component: Staff,
});

function Staff() {
  return <PageHeader title="Staff" subtitle="This page is not built yet." />;
}
