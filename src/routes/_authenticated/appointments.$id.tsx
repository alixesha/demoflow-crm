import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/appointments/$id")({
  head: () => ({ meta: [{ title: "AppointmentDetails — DemoDesk CRM" }] }),
  component: AppointmentDetails,
});

function AppointmentDetails() {
  return <PageHeader title="AppointmentDetails" subtitle="This page is not built yet." />;
}
