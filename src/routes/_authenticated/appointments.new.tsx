import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/appointments/new")({
  head: () => ({ meta: [{ title: "NewAppointment — DemoDesk CRM" }] }),
  component: NewAppointment,
});

function NewAppointment() {
  return <PageHeader title="NewAppointment" subtitle="This page is not built yet." />;
}
