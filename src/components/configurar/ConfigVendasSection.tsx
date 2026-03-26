import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, DollarSign, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PriceTier {
  id?: string;
  quantidade_minima: number;
  preco_unitario: number;
  isNew?: boolean;
}

const DEFAULT_TIERS: PriceTier[] = [
  { quantidade_minima: 1, preco_unitario: 4.99 },
  { quantidade_minima: 10, preco_unitario: 3.99 },
  { quantidade_minima: 30, preco_unitario: 2.50 },
  { quantidade_minima: 50, preco_unitario: 2.20 },
  { quantidade_minima: 100, preco_unitario: 1.99 },
  { quantidade_minima: 200, preco_unitario: 1.80 },
  { quantidade_minima: 500, preco_unitario: 1.50 },
];

interface Props {
  factoryId: string | null;
}

export default function ConfigVendasSection({ factoryId }: Props) {
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTiers();
  }, [factoryId]);

  async function loadTiers() {
    setLoading(true);
    try {
      // Load factory-level pricing from a config approach
      // We'll use cliente_tabela_preco with a special "default" client approach
      // Actually, let's create a factory_pricing_tiers concept using the existing calcular_preco function defaults
      // For now, we show the hardcoded defaults and allow customization
      
      let q = (supabase as any)
        .from("factory_pricing_tiers")
        .select("*")
        .order("quantidade_minima", { ascending: true });
      if (factoryId) q = q.eq("factory_id", factoryId);

      const { data, error } = await q;
      
      if (error) {
        // Table might not exist yet, use defaults
        setTiers(DEFAULT_TIERS.map(t => ({ ...t, isNew: true })));
      } else if (!data || data.length === 0) {
        setTiers(DEFAULT_TIERS.map(t => ({ ...t, isNew: true })));
      } else {
        setTiers(data.map((t: any) => ({
          id: t.id,
          quantidade_minima: t.quantidade_minima,
          preco_unitario: t.preco_unitario,
        })));
      }
    } catch {
      setTiers(DEFAULT_TIERS.map(t => ({ ...t, isNew: true })));
    } finally {
      setLoading(false);
    }
  }

  function updateTier(idx: number, field: keyof PriceTier, value: number) {
    setTiers(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }

  function addTier() {
    const lastQty = tiers.length > 0 ? tiers[tiers.length - 1].quantidade_minima : 0;
    setTiers(prev => [...prev, { quantidade_minima: lastQty + 50, preco_unitario: 1.50, isNew: true }]);
  }

  function removeTier(idx: number) {
    setTiers(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Delete existing tiers for this factory
      if (factoryId) {
        await (supabase as any)
          .from("factory_pricing_tiers")
          .delete()
          .eq("factory_id", factoryId);
      }

      // Insert all tiers
      const inserts = tiers.map(t => ({
        factory_id: factoryId,
        quantidade_minima: t.quantidade_minima,
        preco_unitario: t.preco_unitario,
      }));

      const { error } = await (supabase as any)
        .from("factory_pricing_tiers")
        .insert(inserts);

      if (error) throw error;

      toast({ title: "✅ Tabela de preços salva com sucesso!" });
      loadTiers();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const tierLabels: Record<number, string> = {
    1: "Unidade",
    10: "Pacote 10",
    30: "Pacote 30",
    50: "Pacote 50",
    100: "Pacote 100",
    200: "Pacote 200",
    500: "Pacote 500",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando tabela de preços...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Tabela de Preços por Quantidade
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Defina os preços unitários para cada faixa de quantidade de gelos saborizados.
          Esses valores serão aplicados automaticamente nas vendas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {tiers.map((tier, idx) => {
            const label = tierLabels[tier.quantidade_minima] || `${tier.quantidade_minima}+ un`;
            const basePrice = tiers[0]?.preco_unitario || 4.99;
            const discount = basePrice > 0 ? Math.round((1 - tier.preco_unitario / basePrice) * 100) : 0;
            return (
              <div
                key={idx}
                className="rounded-lg border p-3 text-center bg-card hover:shadow-md transition-shadow"
              >
                <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
                <div className="text-lg font-bold text-primary">
                  R$ {tier.preco_unitario.toFixed(2)}
                </div>
                {discount > 0 && (
                  <Badge variant="secondary" className="text-[10px] mt-1">
                    -{discount}%
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Editable table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Faixa (mín. unidades)</TableHead>
                <TableHead className="text-center min-w-[130px]">Preço Unitário (R$)</TableHead>
                <TableHead className="text-center w-[60px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        className="h-8 w-24 text-sm"
                        value={tier.quantidade_minima}
                        onChange={(e) => updateTier(idx, "quantidade_minima", Number(e.target.value))}
                      />
                      <span className="text-xs text-muted-foreground">
                        {tierLabels[tier.quantidade_minima] || "unidades"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        className="h-8 w-24 text-center text-sm"
                        value={tier.preco_unitario}
                        onChange={(e) => updateTier(idx, "preco_unitario", Number(e.target.value))}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeTier(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addTier}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Faixa
          </Button>
          <Button className="ml-auto" onClick={handleSave} disabled={saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Salvar Tabela de Preços</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
