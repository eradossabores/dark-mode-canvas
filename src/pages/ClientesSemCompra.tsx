import { useAuth } from "@/contexts/AuthContext";
import ClientesInativos from "@/components/dashboard/ClientesInativos";
import { UserX } from "lucide-react";
import { useEffect } from "react";

export default function ClientesSemCompra() {
  const { factoryId } = useAuth();

  useEffect(() => {
    document.title = "Clientes sem Compra";
  }, []);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <UserX className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes sem Compra</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe clientes inativos e envie mensagens de reengajamento via WhatsApp.
          </p>
        </div>
      </div>

      <ClientesInativos factoryId={factoryId} />
    </div>
  );
}