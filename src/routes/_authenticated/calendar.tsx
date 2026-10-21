import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm/ui-bits";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — DemoDesk CRM" }] }),
  component: Calendar,
});

function Calendar() {
  return <PageHeader title="Calendar" subtitle="This page is not built yet." />;
}
