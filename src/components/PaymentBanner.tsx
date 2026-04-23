import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CreditCard, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentBanner() {
  const { role, subscription } = useAuth();

  if (role === "super_admin" || !subscription) return null;

  const { status, daysUntilDue } = subscription;

  if (status === "blocked") return null;
  if (daysUntilDue === null) return null;

  const isOverdue = daysUntilDue <= 0;
  const isTrial = status === "trial";
  const isCritical = daysUntilDue <= 3 && daysUntilDue > 0;
  const isWarning = daysUntilDue <= 7 && daysUntilDue > 3;

  const bgClass = isOverdue
    ? "bg-gradient-to-r from-destructive to-red-700 text-destructive-foreground"
    : isCritical
    ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white"
    : isWarning
    ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white"
    : isTrial
    ? "bg-gradient-to-r from-primary to-blue-600 text-primary-foreground"
    : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white";

  const Icon = isOverdue ? AlertTriangle : isTrial ? Sparkles : isCritical || isWarning ? Clock : CreditCard;

  const label = isTrial ? "teste gratuito" : "mensalidade";
  const message = isOverdue
    ? isTrial
      ? "Seu período de teste expirou!"
      : "Sua mensalidade está vencida!"
    : daysUntilDue === 0
    ? `Seu ${label} ${isTrial ? "termina" : "vence"} hoje!`
    : daysUntilDue === 1
    ? `Falta 1 dia para ${isTrial ? "o fim do teste" : "vencer"}`
    : `Faltam ${daysUntilDue} dias para ${isTrial ? "o fim do teste" : "vencer"}`;

  return (
    <div className={`${bgClass} px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-medium shadow-md z-50 animate-fade-in`}>
      <Icon className={`h-4 w-4 shrink-0 ${isOverdue || isCritical ? "animate-pulse" : ""}`} />
      <span>{message}</span>
      <span className="hidden sm:inline opacity-80">•</span>
      <span className="font-bold">R$ 99,90/mês</span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 px-3 text-xs font-semibold ml-1"
        onClick={() => window.open("https://wa.me/5511999999999?text=Quero%20regularizar%20minha%20mensalidade", "_blank")}
      >
        {isOverdue ? "Regularizar agora" : "Pagar agora"}
      </Button>
    </div>
  );
}
