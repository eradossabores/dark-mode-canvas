import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Save, Loader2, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ConfigVendasSection from "@/components/configurar/ConfigVendasSection";

interface ReceitaRaw {
  id: string;
  sabor_nome: string;
  gelos_por_lote: number;
  quantidade_insumo_por_lote: number;
  is_agua_de_coco: boolean;
}

interface ConfigGeral {
  gelos_por_lote: number;
  quantidade_insumo_geral: number;
  quantidade_insumo_agua_coco: number;
}

export default function ConfigurarFabrica() {
  const { factoryId } = useAuth();
  const [receitas, setReceitas] = useState<ReceitaRaw[]>([]);
  const [config, setConfig] = useState<ConfigGeral>({ gelos_por_lote: 84, quantidade_insumo_geral: 400, quantidade_insumo_agua_coco: 500 });
  const [loadingRec, setLoadingRec] = useState(true);
  const [savingRec, setSavingRec] = useState(false);

  // Saco config
  const [usaSacos, setUsaSacos] = useState(false);
  const [unidadesPorSaco, setUnidadesPorSaco] = useState(50);
  const [estoqueSacos, setEstoqueSacos] = useState(0);
  const [savingSacos, setSavingSacos] = useState(false);
  const [loadingSacos, setLoadingSacos] = useState(true);

  useEffect(() => {
    loadReceitas();
    loadSacosConfig();
  }, [factoryId]);

  async function loadSacosConfig() {
    if (!factoryId) { setLoadingSacos(false); return; }
    setLoadingSacos(true);
    try {
      const { data: factory } = await (supabase as any)
        .from("factories").select("usa_sacos, unidades_por_saco").eq("id", factoryId).single();
      if (factory) {
        setUsaSacos(factory.usa_sacos || false);
        setUnidadesPorSaco(factory.unidades_por_saco || 50);
      }
      const { data: estoque } = await (supabase as any)
        .from("estoque_sacos").select("quantidade").eq("factory_id", factoryId).single();
      setEstoqueSacos(estoque?.quantidade || 0);
    } catch { /* ignore */ }
    setLoadingSacos(false);
  }

  async function handleSaveSacos() {
    if (!factoryId) return;
    setSavingSacos(true);
    try {
      await (supabase as any).from("factories").update({
        usa_sacos: usaSacos,
        unidades_por_saco: unidadesPorSaco,
      }).eq("id", factoryId);

      // Upsert estoque_sacos
      const { data: existing } = await (supabase as any)
        .from("estoque_sacos").select("id").eq("factory_id", factoryId).single();
      if (existing) {
        await (supabase as any).from("estoque_sacos").update({ quantidade: estoqueSacos }).eq("factory_id", factoryId);
      } else {
        await (supabase as any).from("estoque_sacos").insert({ factory_id: factoryId, quantidade: estoqueSacos });
      }
      toast({ title: "✅ Configuração de sacos salva!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingSacos(false);
  }

  async function loadReceitas() {
    if (!factoryId) { setLoadingRec(false); return; }
    setLoadingRec(true);
    try {
      const { data, error } = await (supabase as any)
        .from("sabor_receita")
        .select("*, sabores(nome)")
        .eq("factory_id", factoryId);
      if (error) throw error;
      const list = (data || []).map((r: any) => ({
        id: r.id,
        sabor_nome: r.sabores?.nome || "?",
        gelos_por_lote: r.gelos_por_lote,
        quantidade_insumo_por_lote: r.quantidade_insumo_por_lote,
        is_agua_de_coco: (r.sabores?.nome || "").toLowerCase().includes("água de coco") || (r.sabores?.nome || "").toLowerCase().includes("agua de coco"),
      }));
      setReceitas(list);
      // Derive config from first non-agua-de-coco and agua-de-coco
      const geral = list.find((r: ReceitaRaw) => !r.is_agua_de_coco);
      const aguaCoco = list.find((r: ReceitaRaw) => r.is_agua_de_coco);
      setConfig({
        gelos_por_lote: geral?.gelos_por_lote || 84,
        quantidade_insumo_geral: geral?.quantidade_insumo_por_lote || 400,
        quantidade_insumo_agua_coco: aguaCoco?.quantidade_insumo_por_lote || 500,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoadingRec(false);
    }
  }

  async function handleSaveReceitas() {
    setSavingRec(true);
    try {
      for (const r of receitas) {
        const insumo = r.is_agua_de_coco ? config.quantidade_insumo_agua_coco : config.quantidade_insumo_geral;
        const { error } = await (supabase as any)
          .from("sabor_receita")
          .update({
            gelos_por_lote: config.gelos_por_lote,
            quantidade_insumo_por_lote: insumo,
            embalagens_por_lote: config.gelos_por_lote,
          })
          .eq("id", r.id);
        if (error) throw error;
      }
      toast({ title: `✅ Configurações de produção salvas!` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSavingRec(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Configurar Fábrica</h1>
      </div>

      <Tabs defaultValue="vendas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendas">💰 Tabela de Preços</TabsTrigger>
          <TabsTrigger value="producao">⚙️ Produção (Receitas)</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas">
          <ConfigVendasSection factoryId={factoryId} />
        </TabsContent>

        <TabsContent value="producao">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuração de Produção
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure a quantidade de gelos e matéria-prima por lote para cada sabor.
                As embalagens são descontadas automaticamente (1 por gelo).
              </p>
            </CardHeader>
            <CardContent>
              {loadingRec ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando receitas...
                </div>
              ) : receitas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma receita cadastrada. Cadastre sabores primeiro.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Seção 1: Definição do Lote */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚙️</span>
                      <h3 className="font-semibold text-sm">Definição do Lote</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Quantas unidades (gelos) a máquina produz em cada lote.
                    </p>
                    <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                      <span className="text-sm font-medium whitespace-nowrap">1 Lote =</span>
                      <Input
                        type="number"
                        min={1}
                        className="h-9 text-center text-sm w-24 font-bold"
                        value={config.gelos_por_lote}
                        onChange={(e) => setConfig(prev => ({ ...prev, gelos_por_lote: Number(e.target.value) }))}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">unidades</span>
                    </div>
                  </div>

                  {/* Seção 2: Matéria-Prima por Lote */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧪</span>
                      <h3 className="font-semibold text-sm">Matéria-Prima por Lote</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Quantidade de matéria-prima utilizada em cada lote de produção.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                        <div>
                          <span className="font-medium text-sm">🧊 Geral</span>
                          <div className="text-xs text-muted-foreground">Todos os sabores (exceto Água de Coco)</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            className="h-9 text-center text-sm w-24 font-bold"
                            value={config.quantidade_insumo_geral}
                            onChange={(e) => setConfig(prev => ({ ...prev, quantidade_insumo_geral: Number(e.target.value) }))}
                          />
                          <span className="text-xs text-muted-foreground">g</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                        <div>
                          <span className="font-medium text-sm">🥥 Água de Coco</span>
                          <div className="text-xs text-muted-foreground">Configuração específica</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            className="h-9 text-center text-sm w-24 font-bold"
                            value={config.quantidade_insumo_agua_coco}
                            onChange={(e) => setConfig(prev => ({ ...prev, quantidade_insumo_agua_coco: Number(e.target.value) }))}
                          />
                          <span className="text-xs text-muted-foreground">g</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resumo */}
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <p className="text-xs text-muted-foreground">
                      📋 <strong>Resumo:</strong> 1 lote = <strong>{config.gelos_por_lote} unidades</strong>. 
                      Matéria-prima: <strong>{config.quantidade_insumo_geral}g</strong> (geral) | <strong>{config.quantidade_insumo_agua_coco}g</strong> (Água de Coco). 
                      Embalagens: <strong>{config.gelos_por_lote}</strong> por lote (1 por unidade).
                    </p>
                  </div>

                  <Button className="w-full" onClick={handleSaveReceitas} disabled={savingRec}>
                    {savingRec ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Salvar Configurações</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
