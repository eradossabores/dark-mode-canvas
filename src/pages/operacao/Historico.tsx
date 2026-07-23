import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

export default function Historico() {
  const { user } = useAuth();
  const [visitas, setVisitas] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data } = await (supabase as any).from("visitas_externas")
        .select("*, clientes(nome)").eq("auxiliar_user_id", user.id)
        .order("chegada_em", { ascending: false }).limit(100);
      setVisitas(data ?? []);
    })();
  }, [user?.id]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2"><History className="h-6 w-6" /><h1 className="text-2xl font-bold">Histórico de Atendimentos</h1></div>
      <div className="space-y-2">
        {visitas.map((v) => (
          <Card key={v.id}><CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate">{v.clientes?.nome ?? "Cliente"}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(v.chegada_em).toLocaleString("pt-BR")} • {v.quantidade_entregue ?? 0} un
              </p>
            </div>
            <Badge variant={v.status === "finalizada" ? "default" : "secondary"}>{v.status}</Badge>
          </CardContent></Card>
        ))}
        {visitas.length === 0 && <p className="text-center text-muted-foreground py-8">Sem atendimentos ainda.</p>}
      </div>
    </div>
  );
}