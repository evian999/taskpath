import { AppClient } from "@/components/AppClient";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)] comfy-grid">
      <AppClient />
    </div>
  );
}
