import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Rocket } from "lucide-react";

interface OnboardingFactory {
  factoryId: string;
  factoryName: string;
  progress: Record<string, boolean>;
  percent: number;
}

const STEPS = [
  { key: "sabores_cadastrados", label: "Cadastrar sabores" },
  { key: "receita_configurada", label: "Configurar receita" },
  { key: "estoque_configurado", label: "Configurar estoque" },
  { key: "cliente_cadastrado", label: "Cadastrar cliente" },
  { key: "primeira_producao", label: "Primeira produção" },
  { key: "primeira_venda", label: "Primeira venda" },
];

export default function OnboardingChecklist() {
  const [factories, setFactories] = useState<OnboardingFactory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ data: fabs }, { data: onb }] = await Promise.all([
        (supabase as any).from("factories").select("id, name"),
        (supabase as any).from("onboarding_progress").select("*"),
      ]);

      const onbMap: Record<string, any> = {};
      (onb || []).forEach((o: any) => { onbMap[o.factory_id] = o; });

      const result: OnboardingFactory[] = (fabs || []).map((f: any) => {
        const progress: Record<string, boolean> = {};
        STEPS.forEach(s => { progress[s.key] = onbMap[f.id]?.[s.key] || false; });
        const done = Object.values(progress).filter(Boolean).length;
        return { factoryId: f.id, factoryName: f.name, progress, percent: Math.round((done / STEPS.length) * 100) };
      }).filter(f => f.percent < 100).sort((a, b) => b.percent - a.percent);

      setFactories(result);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (loading) return <div className="animate-pulse p-4 text-muted-foreground">Carregando onboarding...</div>;
  if (factories.length === 0) return (
    <Card><CardContent className="pt-6 text-center text-muted-foreground">
      <Rocket className="h-8 w-8 mx-auto mb-2 text-green-500" />
      Todas as fábricas completaram o onboarding! 🎉
    </CardContent></Card>
  );

  return (
    <div className="space-y-3">
      {factories.map(f => (
        <Card key={f.factoryId}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{f.factoryName}</CardTitle>
              <Badge variant="outline">{f.percent}%</Badge>
            </div>
            <Progress value={f.percent} className="h-2" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
              {STEPS.map(s => (
                <div key={s.key} className="flex items-center gap-1.5 text-xs">
                  {f.progress[s.key] ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className={f.progress[s.key] ? "text-muted-foreground line-through" : ""}>{s.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
