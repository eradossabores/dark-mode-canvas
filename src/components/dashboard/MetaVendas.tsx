import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Target, Edit2, Check } from "lucide-react";

interface Props {
  factoryId: string | null;
  vendedorId?: string;
  vendedorNome?: string;
}

export default function MetaVendas({ factoryId, vendedorId, vendedorNome }: Props) {
  const [meta, setMeta] = useState(0);
  const [faturamento, setFaturamento] = useState(0);
  const [editing, setEditing] = useState(false);
  const [inputMeta, setInputMeta] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!factoryId) return;
    loadData();
  }, [factoryId, vendedorId]);

  async function loadData() {
    setLoading(true);
    try {
      const now = new Date();
      const mesDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      // Load meta
      let query = (supabase as any)
        .from("metas_vendas")
        .select("valor_meta")
        .eq("factory_id", factoryId)
        .eq("mes", mesDate);
      
      if (vendedorId) {
        query = query.eq("vendedor_user_id", vendedorId);
      } else {
        query = query.is("vendedor_user_id", null);
      }

      const { data: metaData } = await query.maybeSingle();

      if (metaData) {
        setMeta(Number(metaData.valor_meta));
        setInputMeta(String(metaData.valor_meta));
      }

      // Load current month sales
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      let salesQuery = (supabase as any)
        .from("vendas")
        .select("total, cliente_id")
        .eq("factory_id", factoryId)
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes)
        .neq("status", "cancelada");

      if (vendedorId) {
        // Se temos vendedorId, precisamos filtrar as vendas que pertencem a esse vendedor
        const { data: vinc } = await (supabase as any)
          .from("cliente_vendedor")
          .select("cliente_id")
          .eq("vendedor_user_id", vendedorId);
        
        const cliIds = (vinc || []).map((x: any) => x.cliente_id);
        if (cliIds.length > 0) {
          salesQuery = salesQuery.in("cliente_id", cliIds);
        } else {
          // Se o vendedor não tem clientes, faturamento é 0
          setFaturamento(0);
          setLoading(false);
          return;
        }
      }

      const { data: vendas } = await salesQuery;

      const total = (vendas || []).reduce((s: number, v: any) => s + Number(v.total), 0);
      setFaturamento(total);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function saveMeta() {
    if (!factoryId) return;
    const now = new Date();
    const mesDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const valor = parseFloat(inputMeta) || 0;

    try {
      const upsertData: any = {
        factory_id: factoryId,
        mes: mesDate,
        valor_meta: valor,
      };

      if (vendedorId) {
        upsertData.vendedor_user_id = vendedorId;
      }

      await (supabase as any).from("metas_vendas").upsert(upsertData, { 
        onConflict: vendedorId ? "factory_id,mes,vendedor_user_id" : "factory_id,mes" 
      });

      setMeta(valor);
      setEditing(false);
      toast({ title: "✅ Meta salva!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  const progress = meta > 0 ? Math.min((faturamento / meta) * 100, 100) : 0;
  const progressColor = progress >= 100 ? "bg-green-500" : progress >= 70 ? "bg-primary" : progress >= 40 ? "bg-yellow-500" : "bg-destructive";

  if (loading) return null;

  return (
    <Card className="border-0 bg-background">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Meta de Vendas {vendedorNome ? ` - ${vendedorNome}` : ""}
          </CardTitle>
          {!editing ? (
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => { setEditing(true); setInputMeta(String(meta)); }}>
              <Edit2 className="h-3 w-3" />
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={inputMeta}
                onChange={(e) => setInputMeta(e.target.value)}
                className="h-6 w-28 text-xs"
                placeholder="R$ Meta"
              />
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={saveMeta}>
                <Check className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {meta > 0 ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold">R$ {faturamento.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">de R$ {meta.toFixed(2)}</p>
              </div>
              <span className={`text-lg font-bold ${progress >= 100 ? "text-green-500" : ""}`}>
                {progress.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${progress}%` }} />
            </div>
            {progress >= 100 && (
              <p className="text-xs text-green-500 font-medium text-center">🎉 Meta atingida!</p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Nenhuma meta definida</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setEditing(true)}>
              Definir Meta
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
