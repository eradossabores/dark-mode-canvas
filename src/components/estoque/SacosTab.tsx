import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  factoryId: string | null;
}

export default function SacosTab({ factoryId }: Props) {
  const [usaSacos, setUsaSacos] = useState(false);
  const [unidadesPorSaco, setUnidadesPorSaco] = useState(50);
  const [quantidade, setQuantidade] = useState(0);
  const [novaQtd, setNovaQtd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSacos();
  }, [factoryId]);

  async function loadSacos() {
    if (!factoryId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: factory } = await (supabase as any)
        .from("factories").select("usa_sacos, unidades_por_saco").eq("id", factoryId).single();
      if (factory) {
        setUsaSacos(factory.usa_sacos || false);
        setUnidadesPorSaco(factory.unidades_por_saco || 50);
      }
      const { data: estoque } = await (supabase as any)
        .from("estoque_sacos").select("quantidade").eq("factory_id", factoryId).single();
      setQuantidade(estoque?.quantidade || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleAjuste() {
    if (!factoryId || !novaQtd) return;
    setSaving(true);
    try {
      const { data: existing } = await (supabase as any)
        .from("estoque_sacos").select("id").eq("factory_id", factoryId).single();
      if (existing) {
        await (supabase as any).from("estoque_sacos").update({ quantidade: Number(novaQtd) }).eq("factory_id", factoryId);
      } else {
        await (supabase as any).from("estoque_sacos").insert({ factory_id: factoryId, quantidade: Number(novaQtd) });
      }
      setQuantidade(Number(novaQtd));
      setNovaQtd("");
      toast({ title: "✅ Estoque de sacos atualizado!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
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

  if (!usaSacos) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sacos não configurados</p>
            <p className="text-sm mt-1">
              Ative a opção "Usar sacos para estoque" em <strong>Configurar Fábrica → Sacos / Pacotes</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Summary card */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="text-2xl font-bold">{quantidade}</div>
          <div className="text-xs text-muted-foreground">Sacos em estoque</div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="text-2xl font-bold">{unidadesPorSaco}</div>
          <div className="text-xs text-muted-foreground">Unidades por saco</div>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{quantidade * unidadesPorSaco}</div>
          <div className="text-xs text-muted-foreground">Total em unidades</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Ajustar Estoque de Sacos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-sm">Nova quantidade</Label>
              <Input
                type="number"
                min={0}
                value={novaQtd}
                onChange={(e) => setNovaQtd(e.target.value)}
                placeholder={`Atual: ${quantidade}`}
              />
            </div>
            <Button onClick={handleAjuste} disabled={saving || !novaQtd}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Salvar</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
