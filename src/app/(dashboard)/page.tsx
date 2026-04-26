import { AppClient } from "@/components/AppClient";

export default function DashboardPage() {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--bg-base)] comfy-grid">
      <AppClient />
    </div>
  );
}
