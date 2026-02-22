import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Undo2, Loader2 } from "lucide-react";
import type { TipoImportacao } from "@/lib/spreadsheet-helpers";

export default function Auditoria() {
  const [logs, setLogs] = useState<any[]>([]);
  const [lastImport, setLastImport] = useState<any | null>(null);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => { loadData(); loadLastImport(); }, []);

  async function loadData() {
    const { data } = await (supabase as any).from("auditoria").select("*").order("created_at", { ascending: false }).limit(100);
    setLogs(data || []);
  }

  async function loadLastImport() {
    const { data } = await (supabase as any).from("auditoria")
      .select("id, descricao, created_at, modulo")
      .eq("acao", "importar_planilha")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastImport(data || null);
  }

  async function handleUndoLastImport() {
    if (!lastImport) return;
    setUndoing(true);
    try {
      const rollbackMatch = lastImport.descricao?.match(/\|\|ROLLBACK:(.+)$/);
      if (!rollbackMatch) {
        toast({ title: "Erro", description: "Dados de rollback não encontrados.", variant: "destructive" });
        return;
      }
      const { producaoIds = [], vendaIds = [], stockChanges = [] } = JSON.parse(rollbackMatch[1]);
      const tipo = lastImport.modulo as TipoImportacao;

      if (tipo === "producao" && producaoIds.length > 0) {
        await (supabase as any).from("producao_funcionarios").delete().in("producao_id", producaoIds);
        await (supabase as any).from("movimentacoes_estoque").delete().in("referencia_id", producaoIds);
        await (supabase as any).from("producoes").delete().in("id", producaoIds);
      }
      if (tipo === "vendas" && vendaIds.length > 0) {
        await (supabase as any).from("venda_itens").delete().in("venda_id", vendaIds);
        await (supabase as any).from("venda_parcelas").delete().in("venda_id", vendaIds);
        await (supabase as any).from("vendas").delete().in("id", vendaIds);
      }

      const saborTotals = new Map<string, number>();
      for (const sc of stockChanges) {
        saborTotals.set(sc.saborId, (saborTotals.get(sc.saborId) || 0) + sc.quantidade);
      }
      for (const [saborId, qtd] of saborTotals) {
        const { data: estoque } = await (supabase as any)
          .from("estoque_gelos").select("quantidade").eq("sabor_id", saborId).maybeSingle();
        if (estoque) {
          await (supabase as any).from("estoque_gelos")
            .update({ quantidade: Math.max(0, estoque.quantidade - qtd) }).eq("sabor_id", saborId);
        }
        await (supabase as any).from("movimentacoes_estoque").insert({
          tipo_item: "gelo_pronto", item_id: saborId, tipo_movimentacao: "saida",
          quantidade: qtd, operador: "desfazer importação", referencia: "rollback_importacao",
        });
      }

      await (supabase as any).from("auditoria").delete().eq("id", lastImport.id);
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "importação planilha",
        modulo: tipo === "producao" ? "producao" : "vendas",
        acao: "desfazer_importacao",
        descricao: `Importação desfeita: ${producaoIds.length + vendaIds.length} registros removidos, estoque revertido.`,
      });

      toast({ title: "Importação desfeita!", description: "Registros removidos e estoque revertido." });
      setLastImport(null);
      loadData();
      loadLastImport();
    } catch (e: any) {
      toast({ title: "Erro ao desfazer", description: e.message, variant: "destructive" });
    } finally {
      setUndoing(false);
    }
  }

  const hasRollback = lastImport?.descricao?.includes("||ROLLBACK:");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Auditoria</h1>

      {hasRollback && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Undo2 className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium">Última importação de planilha</p>
                <p className="text-xs text-muted-foreground">
                  {lastImport.descricao.split("||ROLLBACK:")[0].trim()}
                  {" — "}
                  {new Date(lastImport.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
            <Button onClick={handleUndoLastImport} variant="destructive" size="sm" disabled={undoing}>
              {undoing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Desfazendo...</>
              ) : (
                <><Undo2 className="h-4 w-4 mr-2" /> Desfazer Importação</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Dispositivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{l.usuario_nome}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{l.modulo}</Badge></TableCell>
                  <TableCell className="capitalize">{l.acao}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {l.descricao?.includes("||ROLLBACK:") ? l.descricao.split("||ROLLBACK:")[0].trim() : l.descricao}
                  </TableCell>
                  <TableCell>{l.dispositivo}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
