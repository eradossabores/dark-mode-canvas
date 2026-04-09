import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { UserCheck } from "lucide-react";
import { format } from "date-fns";

interface Props {
  factoryId?: string | null;
}

export default function HistoricoProdutividade({ factoryId }: Props) {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [selectedFunc, setSelectedFunc] = useState<string>("");
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => { if (factoryId) loadFuncionarios(); }, [factoryId]);

  async function loadFuncionarios() {
    const { data } = await (supabase as any).from("funcionarios").select("id, nome").eq("factory_id", factoryId).eq("ativo", true).order("nome");
    setFuncionarios(data || []);
    if (data?.[0]) { setSelectedFunc(data[0].id); loadHistory(data[0].id); }
  }

  async function loadHistory(funcId: string) {
    const { data } = await (supabase as any)
      .from("producao_funcionarios")
      .select("quantidade_produzida, producoes(created_at)")
      .eq("funcionario_id", funcId);

    const byDay: Record<string, number> = {};
    (data || []).forEach((pf: any) => {
      const d = pf.producoes?.created_at ? format(new Date(pf.producoes.created_at), "dd/MM") : "?";
      byDay[d] = (byDay[d] || 0) + pf.quantidade_produzida;
    });

    const sorted = Object.entries(byDay)
      .map(([dia, qtd]) => ({ dia, qtd }))
      .slice(-14);
    setChartData(sorted);
  }

  function handleSelectFunc(id: string) {
    setSelectedFunc(id);
    loadHistory(id);
  }

  if (funcionarios.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Produtividade Individual
          </CardTitle>
          <Select value={selectedFunc} onValueChange={handleSelectFunc}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {funcionarios.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" fontSize={10} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: number) => [`${v} un`, "Produção"]} />
              <Bar dataKey="qtd" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados de produção</p>
        )}
      </CardContent>
    </Card>
  );
}
