import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, IceCream2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TAMANHOS = ["2kg", "3kg", "4kg", "5kg"] as const;

interface Props {
  factoryId: string | null;
}

export default function ConfigGeloCuboSection({ factoryId }: Props) {
  const [ativo, setAtivo] = useState(false);
  const [precos, setPrecos] = useState<Record<string, number>>({ "2kg": 10, "3kg": 14, "4kg": 18, "5kg": 22 });
  const [estoqueInicial, setEstoqueInicial] = useState<Record<string, number>>({ "2kg": 0, "3kg": 0, "4kg": 0, "5kg": 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [factoryId]);

  async function loadConfig() {
    if (!factoryId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: factory } = await (supabase as any)
        .from("factories")
        .select("vende_gelo_cubo")
        .eq("id", factoryId)
        .single();
      if (factory) setAtivo(factory.vende_gelo_cubo || false);

      const { data: precosData } = await (supabase as any)
        .from("gelo_cubo_precos")
        .select("tamanho, preco")
        .eq("factory_id", factoryId);
      if (precosData && precosData.length > 0) {
        const map: Record<string, number> = { "2kg": 10, "3kg": 14, "4kg": 18, "5kg": 22 };
        precosData.forEach((p: any) => { map[p.tamanho] = Number(p.preco); });
        setPrecos(map);
      }

      // Load current stock
      const { data: estoqueData } = await (supabase as any)
        .from("estoque_gelo_cubo")
        .select("tamanho, quantidade")
        .eq("factory_id", factoryId);
      if (estoqueData && estoqueData.length > 0) {
        const map: Record<string, number> = { "2kg": 0, "3kg": 0, "4kg": 0, "5kg": 0 };
        estoqueData.forEach((e: any) => { map[e.tamanho] = Number(e.quantidade); });
        setEstoqueInicial(map);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleSave() {
    if (!factoryId) return;
    setSaving(true);
    try {
      await (supabase as any).from("factories").update({ vende_gelo_cubo: ativo }).eq("id", factoryId);

      // Upsert prices and stock
      for (const tam of TAMANHOS) {
        await (supabase as any)
          .from("gelo_cubo_precos")
          .upsert(
            { factory_id: factoryId, tamanho: tam, preco: precos[tam] || 0 },
            { onConflict: "factory_id,tamanho" }
          );

        await (supabase as any)
          .from("estoque_gelo_cubo")
          .upsert(
            { factory_id: factoryId, tamanho: tam, quantidade: estoqueInicial[tam] || 0, updated_at: new Date().toISOString() },
            { onConflict: "factory_id,tamanho" }
          );
      }

      toast({ title: "✅ Configuração de Gelo em Cubos salva!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IceCream2 className="h-5 w-5" />
          Gelo em Cubos Filtrados
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ative para vender gelo em cubos filtrados nos tamanhos 2kg, 3kg, 4kg e 5kg.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Vender gelo em cubos filtrados</Label>
            <p className="text-sm text-muted-foreground">
              {ativo ? "Ativo — aparece nas vendas" : "Desativado — não aparece nas vendas"}
            </p>
          </div>
          <Switch checked={ativo} onCheckedChange={setAtivo} />
        </div>

        {ativo && (
          <>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Preços por tamanho</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TAMANHOS.map((tam) => (
                  <div key={tam} className="rounded-lg border p-4 text-center space-y-2 bg-card hover:shadow-md transition-shadow">
                    <Badge variant="outline" className="text-xs">{tam}</Badge>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        className="h-9 w-24 text-center text-lg font-bold"
                        value={precos[tam]}
                        onChange={(e) => setPrecos(prev => ({ ...prev, [tam]: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">📦 Estoque atual por tamanho</h4>
              <p className="text-xs text-muted-foreground">Defina a quantidade em estoque de cada tamanho. Este valor será usado para controle de vendas.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TAMANHOS.map((tam) => (
                  <div key={tam} className="rounded-lg border p-4 text-center space-y-2 bg-card hover:shadow-md transition-shadow">
                    <Badge variant="secondary" className="text-xs">{tam}</Badge>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs text-muted-foreground">Qtd</span>
                      <Input
                        type="number"
                        min={0}
                        className="h-9 w-24 text-center text-lg font-bold"
                        value={estoqueInicial[tam]}
                        onChange={(e) => setEstoqueInicial(prev => ({ ...prev, [tam]: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Salvar Configuração</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
