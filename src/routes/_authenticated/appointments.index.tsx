import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/appointments/")({
  head: () => ({ meta: [{ title: "Appointments — DemoDesk CRM" }] }),
  component: Appointments,
});

function Appointments() {
  return <PageHeader title="Appointments" subtitle="This page is not built yet." />;
}
