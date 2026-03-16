import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";

type Periodo = "dia" | "semana" | "mes";

export default function GastosColaboradores() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [producaoFunc, setProducaoFunc] = useState<any[]>([]);
  const [producoes, setProducoes] = useState<any[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("semana");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [f, pf, p] = await Promise.all([
      (supabase as any).from("funcionarios").select("*"),
      (supabase as any).from("producao_funcionarios").select("*, producoes(created_at)"),
      (supabase as any).from("producoes").select("id, created_at"),
    ]);
    setFuncionarios(f.data || []);
    setProducaoFunc(pf.data || []);
    setProducoes(p.data || []);
  }

  const gastos = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    if (periodo === "dia") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (periodo === "semana") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Filter producao_funcionarios by date
    const filteredPF = producaoFunc.filter((pf: any) => {
      const createdAt = pf.producoes?.created_at;
      if (!createdAt) return false;
      return new Date(createdAt) >= startDate;
    });

    // Count distinct production days per employee (for diária)
    const funcDiasMap: Record<string, Set<string>> = {};
    filteredPF.forEach((pf: any) => {
      const fid = pf.funcionario_id;
      const day = new Date(pf.producoes?.created_at).toISOString().split("T")[0];
      if (!funcDiasMap[fid]) funcDiasMap[fid] = new Set();
      funcDiasMap[fid].add(day);
    });

    let totalGasto = 0;
    const detalhes: { nome: string; valor: number; tipo: string }[] = [];

    funcionarios.forEach((f: any) => {
      if (!f.ativo) return;
      let valor = 0;
      if (f.tipo_pagamento === "diaria") {
        const dias = funcDiasMap[f.id]?.size || 0;
        valor = dias * Number(f.valor_pagamento);
      } else {
        // fixo - show monthly value (proportional if filtering by day/week)
        if (periodo === "mes") {
          valor = Number(f.valor_pagamento);
        } else if (periodo === "semana") {
          valor = Number(f.valor_pagamento) / 4;
        } else {
          valor = Number(f.valor_pagamento) / 30;
        }
      }
      if (valor > 0) {
        totalGasto += valor;
        detalhes.push({ nome: f.nome, valor, tipo: f.tipo_pagamento });
      }
    });

    return { total: totalGasto, detalhes: detalhes.sort((a, b) => b.valor - a.valor) };
  }, [funcionarios, producaoFunc, periodo]);

  const periodoLabels: Record<Periodo, string> = { dia: "Hoje", semana: "Semana", mes: "Mês" };

  return (
    <Card className="border-0 bg-background">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Gastos Colaboradores
          </CardTitle>
          <div className="flex gap-1">
            {(["dia", "semana", "mes"] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                  periodo === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {periodoLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Total ({periodoLabels[periodo].toLowerCase()})</span>
            <span className="text-xl font-bold">R$ {gastos.total.toFixed(2)}</span>
          </div>
          {gastos.detalhes.slice(0, 4).map((d, i) => (
            <div key={i} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground truncate mr-2">{d.nome}</span>
              <span className="font-medium text-foreground whitespace-nowrap">
                R$ {d.valor.toFixed(2)}
                <span className="text-[10px] text-muted-foreground ml-1">
                  ({d.tipo === "diaria" ? "diária" : "fixo"})
                </span>
              </span>
            </div>
          ))}
          {gastos.detalhes.length > 4 && (
            <p className="text-xs text-muted-foreground text-center">+{gastos.detalhes.length - 4} colaboradores</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
