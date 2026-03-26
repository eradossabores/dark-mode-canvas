import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, Settings } from "lucide-react";

interface ReceitaConfig {
  id: string;
  sabor_id: string;
  sabor_nome: string;
  materia_prima_nome: string;
  embalagem_nome: string;
  gelos_por_lote: number;
  quantidade_insumo_por_lote: number;
  embalagens_por_lote: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factoryId: string | null;
}

export default function ConfigProducaoDialog({ open, onOpenChange, factoryId }: Props) {
  const [receitas, setReceitas] = useState<ReceitaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) loadReceitas();
  }, [open, factoryId]);

  async function loadReceitas() {
    if (!factoryId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("sabor_receita")
        .select("*, sabores(nome), materias_primas(nome), embalagens(nome)")
        .eq("factory_id", factoryId)
        .order("sabores(nome)");
      if (error) throw error;

      setReceitas(
        (data || []).map((r: any) => ({
          id: r.id,
          sabor_id: r.sabor_id,
          sabor_nome: r.sabores?.nome || "?",
          materia_prima_nome: r.materias_primas?.nome || "?",
          embalagem_nome: r.embalagens?.nome || "?",
          gelos_por_lote: r.gelos_por_lote,
          quantidade_insumo_por_lote: r.quantidade_insumo_por_lote,
          embalagens_por_lote: r.embalagens_por_lote,
        }))
      );
    } catch (e: any) {
      toast({ title: "Erro ao carregar receitas", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function updateReceita(idx: number, field: keyof ReceitaConfig, value: number) {
    setReceitas((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      for (const r of receitas) {
        const { error } = await (supabase as any)
          .from("sabor_receita")
          .update({
            gelos_por_lote: r.gelos_por_lote,
            quantidade_insumo_por_lote: r.quantidade_insumo_por_lote,
            embalagens_por_lote: r.gelos_por_lote, // auto-sync: 1 embalagem per gelo
          })
          .eq("id", r.id);
        if (error) throw error;
      }
      toast({ title: `✅ Configurações de ${receitas.length} receita(s) salvas!` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração de Produção
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando receitas...
          </div>
        ) : receitas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma receita cadastrada. Cadastre as receitas na página de Sabores.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure a quantidade de gelos e matéria-prima por lote para cada sabor.
              As embalagens são descontadas automaticamente do estoque (1 por gelo).
            </p>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Sabor</TableHead>
                    <TableHead className="text-center min-w-[100px]">Gelos/Lote</TableHead>
                    <TableHead className="text-center min-w-[130px]">Matéria-Prima/Lote</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receitas.map((r, idx) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{r.sabor_nome}</span>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {r.materia_prima_nome} · {r.embalagem_nome}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          className="h-8 text-center text-sm w-20 mx-auto"
                          value={r.gelos_por_lote}
                          onChange={(e) => updateReceita(idx, "gelos_por_lote", Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            className="h-8 text-center text-sm w-24"
                            value={r.quantidade_insumo_por_lote}
                            onChange={(e) => updateReceita(idx, "quantidade_insumo_por_lote", Number(e.target.value))}
                          />
                          <span className="text-xs text-muted-foreground">g</span>
                        </div>
                    </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button className="w-full" onClick={handleSaveAll} disabled={saving}>
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Salvar Configurações</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
