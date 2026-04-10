import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, FileText, Crown, Zap } from "lucide-react";

const PLANOS = [
  {
    id: "essencial",
    nome: "Essencial",
    preco: 99.90,
    icon: Zap,
    cor: "from-blue-500 to-cyan-500",
    recursos: [
      { nome: "Gestão completa de produção", incluso: true },
      { nome: "Controle de estoque", incluso: true },
      { nome: "Vendas e faturamento", incluso: true },
      { nome: "Gestão de clientes", incluso: true },
      { nome: "Relatórios básicos", incluso: true },
      { nome: "Monitor de produção", incluso: true },
      { nome: "Até 3 colaboradores", incluso: true },
      { nome: "Dashboard completo", incluso: true },
      { nome: "Suporte por ticket", incluso: true },
      { nome: "Emissão de NF-e", incluso: false },
      { nome: "Relatórios avançados (DRE, Margem)", incluso: false },
      { nome: "Previsão de demanda com IA", incluso: false },
    ],
  },
  {
    id: "profissional",
    nome: "Profissional",
    preco: 129.90,
    icon: Crown,
    cor: "from-amber-500 to-orange-500",
    recursos: [
      { nome: "Tudo do plano Essencial", incluso: true },
      { nome: "Emissão de NF-e automática", incluso: true },
      { nome: "Relatórios avançados (DRE, Margem, Sazonalidade)", incluso: true },
      { nome: "Previsão de demanda com IA", incluso: true },
      { nome: "Classificação ABC de clientes", incluso: true },
      { nome: "Mapa de entregas otimizado", incluso: true },
      { nome: "Prospecção e follow-up", incluso: true },
      { nome: "Até 5 colaboradores", incluso: true },
      { nome: "Suporte prioritário", incluso: true },
    ],
  },
];

interface PlanosTabProps {
  factories: Array<{
    id: string;
    name: string;
    subscription?: {
      status: string;
      amount: number;
      plan_name?: string;
    };
  }>;
  onReload: () => void;
}

export default function PlanosTab({ factories, onReload }: PlanosTabProps) {
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleChangePlan(factoryId: string, planId: string) {
    setUpdating(factoryId);
    try {
      const plano = PLANOS.find((p) => p.id === planId);
      if (!plano) return;

      const { error } = await (supabase as any)
        .from("subscriptions")
        .update({ plan_name: planId, amount: plano.preco })
        .eq("factory_id", factoryId);

      if (error) throw error;

      // Enable/disable NF-e based on plan
      const emiteNfe = planId === "profissional";
      await (supabase as any)
        .from("factories")
        .update({ emite_nfe: emiteNfe })
        .eq("id", factoryId);

      toast({ title: "Plano atualizado!", description: `Fábrica migrada para o plano ${plano.nome}` });
      onReload();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar plano", description: e.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  }

  const factoriesWithSub = factories.filter((f) => f.subscription);

  return (
    <div className="space-y-6">
      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANOS.map((plano) => {
          const Icon = plano.icon;
          const count = factoriesWithSub.filter(
            (f) => (f.subscription as any)?.plan_name === plano.id || 
                   (!((f.subscription as any)?.plan_name) && plano.id === "essencial")
          ).length;

          return (
            <Card key={plano.id} className="relative overflow-hidden border-2 hover:shadow-lg transition-shadow">
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${plano.cor}`} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${plano.cor} text-white`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{plano.nome}</CardTitle>
                      <p className="text-2xl font-bold mt-1">
                        R$ {plano.preco.toFixed(2).replace(".", ",")}
                        <span className="text-sm font-normal text-muted-foreground">/mês</span>
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {count} {count === 1 ? "fábrica" : "fábricas"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plano.recursos.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {r.incluso ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={r.incluso ? "" : "text-muted-foreground/60 line-through"}>
                        {r.nome}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Factory plan assignment table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Atribuição de Planos por Fábrica
          </CardTitle>
        </CardHeader>
        <CardContent>
          {factoriesWithSub.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhuma fábrica com assinatura ativa.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fábrica</TableHead>
                  <TableHead>Plano Atual</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>NF-e</TableHead>
                  <TableHead>Alterar Plano</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factoriesWithSub.map((f) => {
                  const currentPlan = (f.subscription as any)?.plan_name || "essencial";
                  const planoInfo = PLANOS.find((p) => p.id === currentPlan);

                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell>
                        <Badge className={currentPlan === "profissional" 
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30" 
                          : "bg-blue-500/20 text-blue-400 border-blue-500/30"}>
                          {planoInfo?.nome || "Essencial"}
                        </Badge>
                      </TableCell>
                      <TableCell>R$ {(planoInfo?.preco || 99.90).toFixed(2).replace(".", ",")}</TableCell>
                      <TableCell>
                        {currentPlan === "profissional" ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">—</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={currentPlan}
                          onValueChange={(v) => handleChangePlan(f.id, v)}
                          disabled={updating === f.id}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="essencial">Essencial — R$ 99,90</SelectItem>
                            <SelectItem value="profissional">Profissional — R$ 129,90</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
