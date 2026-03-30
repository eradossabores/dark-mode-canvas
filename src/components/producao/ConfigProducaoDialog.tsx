import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, Settings } from "lucide-react";

interface ReceitaConfig {
  id: string;
  sabor_id: string;
  sabor_nome: string;
  materia_prima_nome: string;
  gelos_por_lote: number;
  quantidade_insumo_por_lote: number;
}

interface SaborGroup {
  sabor_id: string;
  sabor_nome: string;
  receitas: ReceitaConfig[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factoryId: string | null;
}

export default function ConfigProducaoDialog({ open, onOpenChange, factoryId }: Props) {
  const [groups, setGroups] = useState<SaborGroup[]>([]);
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

      // Group by sabor
      const groupMap = new Map<string, SaborGroup>();
      for (const r of (data || [])) {
        const saborId = r.sabor_id;
        if (!groupMap.has(saborId)) {
          groupMap.set(saborId, {
            sabor_id: saborId,
            sabor_nome: r.sabores?.nome || "?",
            receitas: [],
          });
        }
        groupMap.get(saborId)!.receitas.push({
          id: r.id,
          sabor_id: saborId,
          sabor_nome: r.sabores?.nome || "?",
          materia_prima_nome: r.materias_primas?.nome || "?",
          gelos_por_lote: r.gelos_por_lote,
          quantidade_insumo_por_lote: r.quantidade_insumo_por_lote,
        });
      }

      setGroups(Array.from(groupMap.values()));
    } catch (e: any) {
      toast({ title: "Erro ao carregar receitas", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function updateReceita(saborIdx: number, receitaIdx: number, field: string, value: number) {
    setGroups((prev) => {
      const updated = [...prev];
      const group = { ...updated[saborIdx] };
      const receitas = [...group.receitas];
      receitas[receitaIdx] = { ...receitas[receitaIdx], [field]: value };

      // If updating gelos_por_lote, sync across all receitas in this group
      if (field === "gelos_por_lote") {
        for (let i = 0; i < receitas.length; i++) {
          receitas[i] = { ...receitas[i], gelos_por_lote: value };
        }
      }

      group.receitas = receitas;
      updated[saborIdx] = group;
      return updated;
    });
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      for (const group of groups) {
        for (const r of group.receitas) {
          const { error } = await (supabase as any)
            .from("sabor_receita")
            .update({
              gelos_por_lote: r.gelos_por_lote,
              quantidade_insumo_por_lote: r.quantidade_insumo_por_lote,
              embalagens_por_lote: r.gelos_por_lote,
            })
            .eq("id", r.id);
          if (error) throw error;
        }
      }
      toast({ title: `✅ Configurações salvas!` });
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
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma receita cadastrada. Cadastre as receitas na página de Sabores.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure a quantidade de gelos e matéria-prima por lote para cada sabor.
              Sabores com múltiplos ingredientes mostram cada insumo separadamente.
            </p>

            <div className="space-y-3">
              {groups.map((group, sIdx) => (
                <div key={group.sabor_id} className="rounded-lg border p-4 bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {group.sabor_nome}
                      {group.receitas.length > 1 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {group.receitas.length} ingredientes
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Gelos/Lote:</Label>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 text-center text-sm w-20"
                        value={group.receitas[0]?.gelos_por_lote || 84}
                        onChange={(e) => updateReceita(sIdx, 0, "gelos_por_lote", Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {group.receitas.map((r, rIdx) => (
                    <div key={r.id} className="flex items-center gap-3 pl-2 border-l-2 border-primary/20 ml-1">
                      <span className="text-xs text-muted-foreground min-w-[120px] truncate">{r.materia_prima_nome}</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          step={10}
                          className="h-7 text-center text-sm w-20"
                          value={r.quantidade_insumo_por_lote}
                          onChange={(e) => updateReceita(sIdx, rIdx, "quantidade_insumo_por_lote", Number(e.target.value))}
                        />
                        <span className="text-xs text-muted-foreground">g/lote</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
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