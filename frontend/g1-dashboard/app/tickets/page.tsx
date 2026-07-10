import { AuthGuard } from "@/app/components/auth-guard";
import { SupportTicketsModule } from "@/app/features/tickets";

export default function TenantTicketsPage() {
  return (
    <AuthGuard>
      <SupportTicketsModule />
    </AuthGuard>
  );
}
