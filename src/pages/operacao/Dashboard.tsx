import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Route as RouteIcon, ClipboardCheck, Users, Package, Award, Target, AlertTriangle, PlayCircle } from "lucide-react";

export default function OperacaoDashboard() {
  const { user, factoryId } = useAuth();
  const navigate = useNavigate();
  const [resumo, setResumo] = useState({
    entregas: 0, clientes: 0, unidades: 0, checklists: 0, pontos: 0,
  });
  const nome = (user?.user_metadata as any)?.nome || user?.email?.split("@")[0] || "Operador";

  useEffect(() => {
    (async () => {
      if (!user?.id || !factoryId) return;
      const hoje = new Date().toISOString().split("T")[0];
      const inicio = new Date(); inicio.setDate(1);
      const inicioMes = inicio.toISOString();

      const { data: visitas } = await (supabase as any)
        .from("visitas_externas").select("id, quantidade_entregue, cliente_id, checklist, status")
        .eq("auxiliar_user_id", user.id).eq("factory_id", factoryId).gte("chegada_em", `${hoje}T00:00:00`);

      const { data: pontos } = await (supabase as any)
        .from("pontuacao_eventos").select("pontos")
        .eq("auxiliar_user_id", user.id).eq("factory_id", factoryId).gte("created_at", inicioMes);

      const totalPontos = (pontos ?? []).reduce((s: number, p: any) => s + (p.pontos ?? 0), 0);
      const clientesUnicos = new Set((visitas ?? []).map((v: any) => v.cliente_id).filter(Boolean));
      const unidades = (visitas ?? []).reduce((s: number, v: any) => s + (v.quantidade_entregue ?? 0), 0);
      const pendentes = (visitas ?? []).filter((v: any) => v.status !== "finalizada").length;

      setResumo({
        entregas: (visitas ?? []).filter((v: any) => v.status === "finalizada").length,
        clientes: clientesUnicos.size,
        unidades,
        checklists: pendentes,
        pontos: totalPontos,
      });
    })();
  }, [user?.id, factoryId]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Olá, {nome} 👋</h1>
        <p className="text-muted-foreground">Resumo da sua operação hoje</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <ResumoCard icon={<Package className="h-5 w-5" />} label="Entregas" value={resumo.entregas} />
        <ResumoCard icon={<Users className="h-5 w-5" />} label="Clientes" value={resumo.clientes} />
        <ResumoCard icon={<Package className="h-5 w-5" />} label="Unidades" value={resumo.unidades} />
        <ResumoCard icon={<ClipboardCheck className="h-5 w-5" />} label="Pendentes" value={resumo.checklists} />
        <ResumoCard icon={<Award className="h-5 w-5" />} label="Pontuação (mês)" value={resumo.pontos} />
      </div>

      <Button size="lg" className="w-full h-16 text-lg gap-2" onClick={() => navigate("/painel/operacao-externa/minha-rota")}>
        <PlayCircle className="h-6 w-6" /> INICIAR ROTA DO DIA
      </Button>

      <div className="grid grid-cols-2 gap-3">
        <QuickLink to="/painel/operacao-externa/atendimento" icon={<RouteIcon />} label="Novo Atendimento" />
        <QuickLink to="/painel/operacao-externa/prospeccao" icon={<Target />} label="Nova Prospecção" />
        <QuickLink to="/painel/operacao-externa/ocorrencias" icon={<AlertTriangle />} label="Registrar Ocorrência" />
        <QuickLink to="/painel/operacao-externa/desempenho" icon={<Award />} label="Meu Desempenho" />
      </div>
    </div>
  );
}

function ResumoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </CardContent></Card>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to}>
      <Card className="hover:bg-accent transition-colors h-full">
        <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center h-full">
          <div className="text-primary">{icon}</div>
          <p className="text-sm font-medium">{label}</p>
        </CardContent>
      </Card>
    </Link>
  );
}