import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, Circle, CalendarDays, Users, Clock, MapPin, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

// Fábrica: Av. Consolação de Matos 103, Cidade Satélite, Boa Vista-RR
const FABRICA_LAT = 2.8195;
const FABRICA_LNG = -60.6735;
const RAIO_MAXIMO_METROS = 1000; // 1km

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function PresencaProducao() {
  const { user } = useAuth();
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [presencas, setPresencas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [dataFiltro, setDataFiltro] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const isHoje = dataFiltro === (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  useEffect(() => {
    loadData();
  }, [dataFiltro]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("presenca-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "presenca_producao" }, () => {
        loadPresencas();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dataFiltro]);

  async function loadData() {
    setLoading(true);
    const [f, p] = await Promise.all([
      (supabase as any).from("funcionarios").select("*").eq("ativo", true).order("nome"),
      loadPresencasRaw(),
    ]);
    setFuncionarios(f.data || []);
    setPresencas(p);
    setLoading(false);
  }

  async function loadPresencasRaw() {
    const { data } = await (supabase as any)
      .from("presenca_producao")
      .select("*, funcionarios(nome), profiles:confirmado_por(nome)")
      .eq("data", dataFiltro);
    return data || [];
  }

  async function loadPresencas() {
    const data = await loadPresencasRaw();
    setPresencas(data);
  }

  async function togglePresenca(funcionarioId: string) {
    setToggling(funcionarioId);
    try {
      const existing = presencas.find((p: any) => p.funcionario_id === funcionarioId);
      if (existing) {
        await (supabase as any).from("presenca_producao").delete().eq("id", existing.id);
        toast({ title: "Presença removida" });
      } else {
        const { error } = await (supabase as any).from("presenca_producao").insert({
          funcionario_id: funcionarioId,
          data: dataFiltro,
          confirmado_por: user?.id,
        });
        if (error) throw error;
        toast({ title: "Presença confirmada! ✅" });
      }
      await loadPresencas();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setToggling(null);
    }
  }

  const totalPresentes = presencas.length;
  const totalFuncionarios = funcionarios.length;
  const dataLabel = new Date(dataFiltro + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });

  // Quick date navigation
  const diasNavegacao = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (3 - i));
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
      isToday: i === 3,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Presença na Produção
          </h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">{dataLabel}</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {totalPresentes}/{totalFuncionarios} presentes
        </Badge>
      </div>

      {/* Date navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {diasNavegacao.map((d) => (
          <button
            key={d.date}
            onClick={() => setDataFiltro(d.date)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              dataFiltro === d.date
                ? "bg-primary text-primary-foreground shadow-md"
                : d.isToday
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {d.label}
            {d.isToday && <span className="ml-1 text-[10px]">●</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {funcionarios.map((func, idx) => {
            const presente = presencas.find((p: any) => p.funcionario_id === func.id);
            const isToggling = toggling === func.id;

            return (
              <motion.div
                key={func.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    presente
                      ? "border-green-500/50 bg-green-500/5 dark:bg-green-500/10"
                      : "border-border hover:border-primary/30"
                  }`}
                  onClick={() => !isToggling && togglePresenca(func.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                          presente ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"
                        }`}>
                          {isToggling ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
                          ) : presente ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{func.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {func.tipo_pagamento === "diaria" ? "Diária" : "Fixo"} — R$ {Number(func.valor_pagamento).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {presente && (
                        <div className="text-right">
                          <Badge variant="default" className="bg-green-600 text-xs">Presente</Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            <Clock className="inline h-3 w-3 mr-0.5" />
                            {new Date(presente.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {presencas.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Resumo do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Presentes</p>
                <p className="text-2xl font-bold text-green-600">{totalPresentes}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ausentes</p>
                <p className="text-2xl font-bold text-destructive">{totalFuncionarios - totalPresentes}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo Diárias</p>
                <p className="text-2xl font-bold">
                  R$ {presencas.reduce((s: number, p: any) => {
                    const f = funcionarios.find((f: any) => f.id === p.funcionario_id);
                    return s + (f?.tipo_pagamento === "diaria" ? Number(f.valor_pagamento) : 0);
                  }, 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Primeiro Check-in</p>
                <p className="text-2xl font-bold">
                  {presencas.length > 0
                    ? new Date(presencas.reduce((min: any, p: any) => p.created_at < min.created_at ? p : min).created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
