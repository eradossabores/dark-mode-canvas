import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, IceCream2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SaborPreco {
  sabor_id: string;
  sabor_nome: string;
  preco_unitario: number | null; // null = usa preço padrão da tabela
  id?: string; // id do registro em factory_preco_sabor
}

interface Props {
  factoryId: string | null;
}

export default function ConfigPrecoSaborSection({ factoryId }: Props) {
  const [sabores, setSabores] = useState<SaborPreco[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (factoryId) loadData();
  }, [factoryId]);

  async function loadData() {
    setLoading(true);
    try {
      // Load all active flavors
      const { data: saborData } = await supabase
        .from("sabores")
        .select("id, nome")
        .eq("factory_id", factoryId)
        .eq("ativo", true)
        .order("nome");

      // Load existing factory flavor prices
      const { data: precoData } = await (supabase as any)
        .from("factory_preco_sabor")
        .select("*")
        .eq("factory_id", factoryId);

      const list: SaborPreco[] = (saborData || []).map((s: any) => {
        const existing = precoData?.find((p: any) => p.sabor_id === s.id);
        return {
          sabor_id: s.id,
          sabor_nome: s.nome,
          preco_unitario: existing ? existing.preco_unitario : null,
          id: existing?.id,
        };
      });

      setSabores(list);
    } catch {
      toast({ title: "Erro ao carregar sabores", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function updatePreco(idx: number, value: string) {
    setSabores(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        preco_unitario: value === "" ? null : Number(value),
      };
      return updated;
    });
  }

  async function handleSave() {
    if (!factoryId) return;
    setSaving(true);
    try {
      // Delete all existing for this factory
      await (supabase as any)
        .from("factory_preco_sabor")
        .delete()
        .eq("factory_id", factoryId);

      // Insert only those with a price set
      const toInsert = sabores
        .filter(s => s.preco_unitario !== null && s.preco_unitario > 0)
        .map(s => ({
          factory_id: factoryId,
          sabor_id: s.sabor_id,
          preco_unitario: s.preco_unitario,
        }));

      if (toInsert.length > 0) {
        const { error } = await (supabase as any)
          .from("factory_preco_sabor")
          .insert(toInsert);
        if (error) throw error;
      }

      toast({ title: "✅ Preços por sabor salvos com sucesso!" });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const customCount = sabores.filter(s => s.preco_unitario !== null).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando sabores...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IceCream2 className="h-5 w-5" />
          Preço Diferenciado por Sabor
          {customCount > 0 && (
            <Badge variant="secondary" className="ml-2">{customCount} personalizado(s)</Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Defina preços especiais para sabores com valor agregado maior (ex: Gelo do Brasil, Bob Marley).
          Sabores sem preço definido usam a tabela de preços padrão acima.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sabor</TableHead>
                <TableHead className="text-center w-[180px]">Preço Unitário (R$)</TableHead>
                <TableHead className="text-center w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sabores.map((sabor, idx) => (
                <TableRow key={sabor.sabor_id}>
                  <TableCell className="font-medium">{sabor.sabor_nome}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Padrão"
                        className="h-8 w-24 text-center text-sm"
                        value={sabor.preco_unitario ?? ""}
                        onChange={(e) => updatePreco(idx, e.target.value)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {sabor.preco_unitario !== null ? (
                      <Badge className="bg-primary/10 text-primary border-primary/20">Personalizado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Padrão</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Salvar Preços por Sabor</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
