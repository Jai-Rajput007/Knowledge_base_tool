import { AuthGuard } from "@/app/components/auth-guard";
import { EmployeesModule } from "@/app/features/employees";

export default function EmployeesPage() {
  return (
    <AuthGuard>
      <EmployeesModule />
    </AuthGuard>
  );
}
