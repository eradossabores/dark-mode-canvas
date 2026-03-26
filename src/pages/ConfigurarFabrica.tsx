import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Save, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    loadReceitas();
  }, [factoryId]);

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
                <div className="space-y-4">
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
                                <div className="text-xs text-muted-foreground mt-0.5">{r.materia_prima_nome}</div>
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
