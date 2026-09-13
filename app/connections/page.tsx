import { ConnectionsPage } from "@/components/connections/connections-page";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: "Connections - FinanceFlow",
  description: "Manage your connections",
};

export default function ConnectionsPageRoute() {
  return (
    <AppShell>
      <ConnectionsPage />
    </AppShell>
  );
}