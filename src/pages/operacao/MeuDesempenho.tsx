import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Award, Target, Users, Package, ClipboardCheck } from "lucide-react";

export default function MeuDesempenho() {
  const { user, factoryId } = useAuth();
  const [pontos, setPontos] = useState(0);
  const [meta, setMeta] = useState(0);
  const [eventos, setEventos] = useState<any[]>([]);
  const [totais, setTotais] = useState({ visitas: 0, prospeccoes: 0, unidades: 0, checklists: 0 });

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const inicio = new Date(); inicio.setDate(1);
      const inicioMes = inicio.toISOString();
      const anoMes = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}`;

      const { data: evs } = await (supabase as any).from("pontuacao_eventos")
        .select("*").eq("auxiliar_user_id", user.id).gte("created_at", inicioMes)
        .order("created_at", { ascending: false });
      const total = (evs ?? []).reduce((s: number, e: any) => s + (e.pontos ?? 0), 0);
      setPontos(total);
      setEventos(evs ?? []);

      const { data: metaData } = await (supabase as any).from("metas_operacao_externa")
        .select("meta_pontos").eq("auxiliar_user_id", user.id).eq("ano_mes", anoMes).maybeSingle();
      setMeta(metaData?.meta_pontos ?? 100);

      const { data: visitas } = await (supabase as any).from("visitas_externas")
        .select("id, quantidade_entregue, checklist").eq("auxiliar_user_id", user.id)
        .eq("status", "finalizada").gte("chegada_em", inicioMes);
      const { data: pros } = await (supabase as any).from("prospeccoes_externas")
        .select("id").eq("auxiliar_user_id", user.id).gte("created_at", inicioMes);

      const cksComp = (visitas ?? []).filter((v: any) => {
        const c = v.checklist ?? {};
        return Object.keys(c).length >= 5 && Object.values(c).every(Boolean);
      }).length;

      setTotais({
        visitas: (visitas ?? []).length,
        prospeccoes: (pros ?? []).length,
        unidades: (visitas ?? []).reduce((s: number, v: any) => s + (v.quantidade_entregue ?? 0), 0),
        checklists: cksComp,
      });
    })();
  }, [user?.id]);

  const perc = meta > 0 ? Math.min(100, Math.round((pontos / meta) * 100)) : 0;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2"><Award className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Meu Desempenho</h1></div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Pontuação do mês</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-4xl font-bold">{pontos}<span className="text-lg text-muted-foreground"> / {meta}</span></p>
            <p className="text-sm text-muted-foreground">{perc}%</p>
          </div>
          <Progress value={perc} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <MiniCard icon={<Users />} label="Clientes visitados" value={totais.visitas} />
        <MiniCard icon={<Target />} label="Novos pontos" value={totais.prospeccoes} />
        <MiniCard icon={<Package />} label="Unidades entregues" value={totais.unidades} />
        <MiniCard icon={<ClipboardCheck />} label="Checklists completos" value={totais.checklists} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos eventos de pontuação</CardTitle></CardHeader>
        <CardContent className="space-y-1 max-h-[400px] overflow-y-auto">
          {eventos.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div><p className="text-sm">{e.motivo ?? e.tipo}</p><p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString("pt-BR")}</p></div>
              <p className="font-bold text-primary">+{e.pontos}</p>
            </div>
          ))}
          {eventos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem eventos ainda no mês.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
    </CardContent></Card>
  );
}