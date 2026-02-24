import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserX, Clock, Phone } from "lucide-react";

interface ClienteInativo {
  id: string;
  nome: string;
  telefone: string | null;
  bairro: string | null;
  diasSemCompra: number;
  ultimaCompra: string | null;
}

export default function ClientesInativos() {
  const [clientes, setClientes] = useState<ClienteInativo[]>([]);
  const [diasLimite, setDiasLimite] = useState(15);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await (supabase as any)
        .from("clientes")
        .select("id, nome, telefone, bairro, ultima_compra")
        .eq("status", "ativo")
        .not("nome", "ilike", "%amostra%")
        .not("nome", "ilike", "%avulso%");

      const hoje = new Date();
      const result: ClienteInativo[] = (data || [])
        .map((c: any) => {
          const diasSemCompra = c.ultima_compra
            ? Math.floor((hoje.getTime() - new Date(c.ultima_compra).getTime()) / (1000 * 60 * 60 * 24))
            : 999;
          return { ...c, diasSemCompra, ultimaCompra: c.ultima_compra };
        })
        .filter((c: ClienteInativo) => c.diasSemCompra >= 7)
        .sort((a: ClienteInativo, b: ClienteInativo) => b.diasSemCompra - a.diasSemCompra);

      setClientes(result);
    } catch (e) {
      console.error("ClientesInativos error:", e);
    }
  }

  const filtrados = clientes.filter(c => c.diasSemCompra >= diasLimite);

  if (clientes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserX className="h-4 w-4 text-destructive" />
            Clientes sem Compra
          </CardTitle>
          <div className="flex gap-1">
            {[7, 15, 30].map(d => (
              <button
                key={d}
                onClick={() => setDiasLimite(d)}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                  diasLimite === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {d}d+
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Todos os clientes compraram recentemente! 🎉
          </p>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {filtrados.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.nome}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {c.bairro && <span>{c.bairro}</span>}
                    {c.telefone && (
                      <a href={`tel:${c.telefone}`} className="flex items-center gap-0.5 text-primary hover:underline">
                        <Phone className="h-2.5 w-2.5" />{c.telefone}
                      </a>
                    )}
                  </div>
                </div>
                <Badge
                  variant={c.diasSemCompra >= 30 ? "destructive" : c.diasSemCompra >= 15 ? "secondary" : "outline"}
                  className="shrink-0"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {c.diasSemCompra === 999 ? "Nunca" : `${c.diasSemCompra}d`}
                </Badge>
              </div>
            ))}
            {filtrados.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{filtrados.length - 10} cliente(s)
              </p>
            )}
          </div>
        )}
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex justify-between">
          <span>{filtrados.length} cliente(s) sem compra há {diasLimite}+ dias</span>
          {filtrados.filter(c => c.diasSemCompra >= 30).length > 0 && (
            <span className="text-destructive font-medium">
              {filtrados.filter(c => c.diasSemCompra >= 30).length} crítico(s)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
