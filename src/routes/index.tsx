import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DemoDesk CRM — Website Demo Appointments" },
      { name: "description", content: "Secure appointment CRM for call-centre website demos." },
      { property: "og:title", content: "DemoDesk CRM" },
      { property: "og:description", content: "Secure appointment CRM for call-centre website demos." },
    ],
  }),
  component: Index,
});

function Index() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading) navigate({ to: session ? "/dashboard" : "/auth", replace: true });
  }, [loading, session, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-gradient">
      <Loader2 className="h-6 w-6 animate-spin text-sidebar-primary" />
    </div>
  );
}
