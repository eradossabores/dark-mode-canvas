import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Users, Target, AlertTriangle, Award } from "lucide-react";

export default function AdminVisao() {
  const { factoryId } = useAuth();
  const [visitas, setVisitas] = useState<any[]>([]);
  const [prospeccoes, setProspeccoes] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!factoryId) return;
      const inicio = new Date(); inicio.setDate(1);
      const inicioMes = inicio.toISOString();
      const hoje = new Date().toISOString().split("T")[0];

      const { data: vs } = await (supabase as any).from("visitas_externas")
        .select("*, clientes(nome), profiles!visitas_externas_auxiliar_user_id_fkey(nome)")
        .eq("factory_id", factoryId).gte("chegada_em", `${hoje}T00:00:00`).order("chegada_em", { ascending: false });
      setVisitas(vs ?? []);

      const { data: ps } = await (supabase as any).from("prospeccoes_externas")
        .select("*").eq("factory_id", factoryId).gte("created_at", inicioMes).order("created_at", { ascending: false }).limit(50);
      setProspeccoes(ps ?? []);

      const { data: os } = await (supabase as any).from("ocorrencias_externas")
        .select("*, clientes(nome)").eq("factory_id", factoryId).eq("status", "aberta").order("created_at", { ascending: false });
      setOcorrencias(os ?? []);

      const { data: pts } = await (supabase as any).from("pontuacao_eventos")
        .select("auxiliar_user_id, pontos").eq("factory_id", factoryId).gte("created_at", inicioMes);
      const agrup: Record<string, number> = {};
      (pts ?? []).forEach((p: any) => { agrup[p.auxiliar_user_id] = (agrup[p.auxiliar_user_id] ?? 0) + (p.pontos ?? 0); });
      const ids = Object.keys(agrup);
      const { data: profs } = ids.length ? await (supabase as any).from("profiles").select("id, nome").in("id", ids) : { data: [] };
      const nomes: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { nomes[p.id] = p.nome || p.id; });
      setRanking(Object.entries(agrup).map(([id, pts]) => ({ id, nome: nomes[id] ?? id, pts })).sort((a, b) => b.pts - a.pts));
    })();
  }, [factoryId]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2"><Truck className="h-6 w-6" /><h1 className="text-2xl font-bold">Operação Externa — Visão Admin</h1></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={<Users />} label="Atendimentos hoje" value={visitas.length} />
        <MetricCard icon={<Target />} label="Prospecções (mês)" value={prospeccoes.length} />
        <MetricCard icon={<AlertTriangle />} label="Ocorrências abertas" value={ocorrencias.length} />
        <MetricCard icon={<Award />} label="Auxiliares ativos" value={ranking.length} />
      </div>

      <Card><CardHeader><CardTitle>Ranking mensal — pontuação</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {ranking.map((r, i) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <span className="font-bold w-6">{i + 1}º</span>
                <span>{r.nome}</span>
              </div>
              <Badge>{r.pts} pts</Badge>
            </div>
          ))}
          {ranking.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pontuação no mês.</p>}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Atendimentos hoje</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {visitas.map((v) => (
            <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium">{v.clientes?.nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{v.profiles?.nome ?? "auxiliar"} • {v.quantidade_entregue ?? 0} un</p>
              </div>
              <Badge variant={v.status === "finalizada" ? "default" : "secondary"}>{v.status}</Badge>
            </div>
          ))}
          {visitas.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendimento hoje.</p>}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Ocorrências abertas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ocorrencias.map((o) => (
            <div key={o.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div><p className="font-medium">{o.tipo}</p><p className="text-xs text-muted-foreground">{o.clientes?.nome ?? "—"}</p></div>
              <Badge variant="destructive">aberta</Badge>
            </div>
          ))}
          {ocorrencias.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ocorrência aberta.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
    </CardContent></Card>
  );
}