import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";

interface GeloItem {
  id: string;
  sabor_id: string;
  quantidade: number;
  sabores: { nome: string } | null;
}

interface Props {
  gelos: GeloItem[];
  onComplete: () => void;
}

const SABOR_COLORS: Record<string, string> = {
  melancia: "bg-red-500/15 text-red-700",
  morango: "bg-pink-500/15 text-pink-700",
  "maçã verde": "bg-green-500/15 text-green-700",
  maracujá: "bg-yellow-500/15 text-yellow-700",
  "água de coco": "bg-cyan-500/15 text-cyan-700",
  "abacaxi com hortelã": "bg-emerald-500/15 text-emerald-700",
  "bob marley": "bg-amber-500/15 text-amber-700",
  limão: "bg-lime-500/15 text-lime-700",
  "limão com sal": "bg-lime-600/15 text-lime-800",
  pitaya: "bg-fuchsia-500/15 text-fuchsia-700",
  "blue ice": "bg-blue-500/15 text-blue-700",
};

export default function ConciliacaoEstoque({ gelos, onComplete }: Props) {
  const [esperado, setEsperado] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    gelos.forEach((g) => {
      initial[g.id] = g.quantidade;
    });
    return initial;
  });
  const [aplicando, setAplicando] = useState(false);

  const diffs = gelos.map((g) => {
    const esp = esperado[g.id] ?? g.quantidade;
    const diff = esp - g.quantidade;
    return { ...g, esperado: esp, diff };
  });

  const temDiferenca = diffs.some((d) => d.diff !== 0);
  const totalSistema = gelos.reduce((s, g) => s + g.quantidade, 0);
  const totalEsperado = diffs.reduce((s, d) => s + d.esperado, 0);

  async function aplicarConciliacao() {
    const itensComDiff = diffs.filter((d) => d.diff !== 0);
    if (itensComDiff.length === 0) {
      toast({ title: "Nenhuma diferença para ajustar" });
      return;
    }

    setAplicando(true);
    try {
      for (const item of itensComDiff) {
        await (supabase as any)
          .from("estoque_gelos")
          .update({ quantidade: item.esperado })
          .eq("id", item.id);

        const movTipo = item.diff >= 0 ? "entrada" : "saida";
        await (supabase as any).from("movimentacoes_estoque").insert({
          tipo_item: "gelo_pronto",
          item_id: item.sabor_id,
          tipo_movimentacao: movTipo,
          quantidade: Math.abs(item.diff),
          referencia: "conciliacao",
          operador: "sistema",
        });

        await (supabase as any).from("auditoria").insert({
          usuario_nome: "sistema",
          modulo: "estoque",
          acao: "conciliacao",
          registro_afetado: item.id,
          descricao: `Conciliação ${item.sabores?.nome}: ${item.quantidade} → ${item.esperado} (${item.diff >= 0 ? "+" : ""}${item.diff})`,
        });
      }

      toast({
        title: "Conciliação aplicada!",
        description: `${itensComDiff.length} sabor(es) ajustado(s)`,
      });
      onComplete();
    } catch (e: any) {
      toast({ title: "Erro ao aplicar", description: e.message, variant: "destructive" });
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            Conciliação de Estoque
          </CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Sistema: <span className="font-bold text-foreground">{totalSistema.toLocaleString()}</span>
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              Esperado: <span className="font-bold text-foreground">{totalEsperado.toLocaleString()}</span>
            </span>
            {totalEsperado !== totalSistema && (
              <Badge variant={totalEsperado - totalSistema > 0 ? "default" : "destructive"} className="text-[10px]">
                {totalEsperado - totalSistema > 0 ? "+" : ""}{totalEsperado - totalSistema}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Informe a quantidade esperada (da planilha) para cada sabor. O sistema ajustará automaticamente as diferenças.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sabor</TableHead>
              <TableHead className="text-center">Sistema</TableHead>
              <TableHead className="text-center w-[120px]">Esperado</TableHead>
              <TableHead className="text-center">Diferença</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {diffs
              .sort((a, b) => (a.sabores?.nome || "").localeCompare(b.sabores?.nome || ""))
              .map((d) => {
                const colorKey = d.sabores?.nome?.toLowerCase() || "";
                const color = SABOR_COLORS[colorKey] || "bg-muted text-foreground";
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
                        {d.sabores?.nome}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-medium">{d.quantidade.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        className="w-[100px] mx-auto text-center h-8 text-sm"
                        value={esperado[d.id] ?? ""}
                        onChange={(e) =>
                          setEsperado((prev) => ({ ...prev, [d.id]: Number(e.target.value) }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {d.diff === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <span className={`font-bold text-sm ${d.diff > 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {d.diff > 0 ? "+" : ""}{d.diff}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {temDiferenca ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>{diffs.filter((d) => d.diff !== 0).length} sabor(es) com diferença</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Estoque conciliado — sem diferenças</span>
              </>
            )}
          </div>
          <Button onClick={aplicarConciliacao} disabled={!temDiferenca || aplicando} size="sm">
            {aplicando ? "Aplicando..." : "Aplicar Conciliação"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
