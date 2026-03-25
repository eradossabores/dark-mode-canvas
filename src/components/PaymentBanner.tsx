import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CreditCard } from "lucide-react";

export default function PaymentBanner() {
  const { role, subscription } = useAuth();

  // Only show for factory_owner/admin/producao, not super_admin
  if (role === "super_admin" || !subscription) return null;

  const { status, daysUntilDue } = subscription;

  // Show banner only when 3 days or less until due
  if (status === "blocked") return null; // Blocked is handled by ProtectedRoute
  if (daysUntilDue === null || daysUntilDue > 3) return null;

  const isOverdue = daysUntilDue <= 0;
  const isTrial = status === "trial";

  const bgColor = isOverdue
    ? "bg-destructive/90 text-destructive-foreground"
    : daysUntilDue <= 1
    ? "bg-amber-600 text-white"
    : "bg-amber-500 text-white";

  const message = isOverdue
    ? isTrial
      ? "Seu período de teste expirou! Regularize o pagamento para continuar usando o sistema."
      : "Sua mensalidade está vencida! Regularize o pagamento para evitar o bloqueio do acesso."
    : daysUntilDue === 0
    ? isTrial
      ? "Seu período de teste termina hoje!"
      : "Sua mensalidade vence hoje!"
    : daysUntilDue === 1
    ? isTrial
      ? "Seu período de teste termina amanhã!"
      : "Sua mensalidade vence amanhã!"
    : isTrial
    ? `Seu período de teste termina em ${daysUntilDue} dias.`
    : `Sua mensalidade vence em ${daysUntilDue} dias.`;

  return (
    <div className={`${bgColor} px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium shadow-md z-50`}>
      {isOverdue ? (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      ) : (
        <CreditCard className="h-4 w-4 shrink-0" />
      )}
      <span>{message}</span>
      <span className="font-bold ml-1">R$ 99,90/mês</span>
    </div>
  );
}
