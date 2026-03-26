import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Package, ShoppingCart, DollarSign, Factory, Calendar, IceCream, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factory: {
    id: string;
    name: string;
    logo_url: string | null;
    owner_id: string;
    max_collaborators: number;
    created_at: string;
    subscription?: {
      status: string;
      trial_start: string;
      current_period_end: string | null;
      grace_until: string | null;
      paid_at: string | null;
      amount: number;
    };
    owner_email?: string;
    collaborator_count?: number;
  };
}

export default function FactoryDetailsDialog({ open, onOpenChange, factory }: Props) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) loadDetails();
  }, [open]);

  async function loadDetails() {
    setLoading(true);
    try {
      const fid = factory.id;
      const [clientes, vendas, producoes, sabores, funcionarios, estoque, pedidos] = await Promise.all([
        (supabase as any).from("clientes").select("id, status", { count: "exact", head: false }).eq("factory_id", fid),
        (supabase as any).from("vendas").select("total, status, created_at").eq("factory_id", fid),
        (supabase as any).from("producoes").select("quantidade_total, created_at").eq("factory_id", fid),
        (supabase as any).from("sabores").select("id, ativo").eq("factory_id", fid),
        (supabase as any).from("funcionarios").select("id, ativo").eq("factory_id", fid),
        (supabase as any).from("estoque_gelos").select("quantidade").eq("factory_id", fid),
        (supabase as any).from("pedidos_producao").select("id, status").eq("factory_id", fid),
      ]);

      const vendasData = (vendas.data || []).filter((v: any) => v.status !== "cancelada");
      const faturamentoTotal = vendasData.reduce((s: number, v: any) => s + Number(v.total), 0);

      const now = new Date();
      const faturamentoMes = vendasData
        .filter((v: any) => { const d = new Date(v.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
        .reduce((s: number, v: any) => s + Number(v.total), 0);

      const totalEstoque = (estoque.data || []).reduce((s: number, g: any) => s + g.quantidade, 0);
      const totalProd = (producoes.data || []).reduce((s: number, p: any) => s + p.quantidade_total, 0);

      const clientesAtivos = (clientes.data || []).filter((c: any) => c.status === "ativo").length;
      const clientesInativos = (clientes.data || []).filter((c: any) => c.status === "inativo").length;

      const pedidosPendentes = (pedidos.data || []).filter((p: any) => p.status === "pendente").length;
      const pedidosConcluidos = (pedidos.data || []).filter((p: any) => p.status === "concluido" || p.status === "entregue").length;

      setDetails({
        totalClientes: (clientes.data || []).length,
        clientesAtivos,
        clientesInativos,
        totalVendas: vendasData.length,
        faturamentoTotal,
        faturamentoMes,
        totalProducoes: (producoes.data || []).length,
        totalProduzido: totalProd,
        saboresAtivos: (sabores.data || []).filter((s: any) => s.ativo).length,
        saboresTotal: (sabores.data || []).length,
        funcionariosAtivos: (funcionarios.data || []).filter((f: any) => f.ativo).length,
        funcionariosTotal: (funcionarios.data || []).length,
        totalEstoque,
        pedidosPendentes,
        pedidosConcluidos,
        totalPedidos: (pedidos.data || []).length,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status?: string) {
    switch (status) {
      case "trial": return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Clock className="h-3 w-3 mr-1" />Teste</Badge>;
      case "active": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="h-3 w-3 mr-1" />Ativa</Badge>;
      case "overdue": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Vencida</Badge>;
      case "blocked": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Bloqueada</Badge>;
      default: return <Badge variant="outline">N/A</Badge>;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {factory.logo_url ? (
              <img src={factory.logo_url} alt={factory.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Factory className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <span>{factory.name}</span>
              <p className="text-xs text-muted-foreground font-normal">{factory.owner_email}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center text-muted-foreground py-8 animate-pulse">Carregando detalhes...</p>
        ) : details && (
          <div className="space-y-4">
            {/* Assinatura */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status da Assinatura</span>
              {getStatusBadge(factory.subscription?.status)}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-muted-foreground">Criada em</div>
              <div className="text-right font-medium">{format(new Date(factory.created_at), "dd/MM/yyyy", { locale: ptBR })}</div>
              {factory.subscription?.paid_at && (
                <>
                  <div className="text-muted-foreground">Último pagamento</div>
                  <div className="text-right font-medium">{format(new Date(factory.subscription.paid_at), "dd/MM/yyyy", { locale: ptBR })}</div>
                </>
              )}
              {factory.subscription?.current_period_end && (
                <>
                  <div className="text-muted-foreground">Vencimento</div>
                  <div className="text-right font-medium">{format(new Date(factory.subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })}</div>
                </>
              )}
              <div className="text-muted-foreground">Colaboradores</div>
              <div className="text-right font-medium">{factory.collaborator_count}/{factory.max_collaborators}</div>
            </div>

            <Separator />

            {/* Resumo operacional */}
            <h4 className="text-sm font-semibold">Resumo Operacional</h4>
            <div className="grid grid-cols-2 gap-3">
              <StatItem icon={<Users className="h-4 w-4 text-blue-500" />} label="Clientes" value={`${details.clientesAtivos} ativos / ${details.totalClientes} total`} />
              <StatItem icon={<ShoppingCart className="h-4 w-4 text-emerald-500" />} label="Vendas" value={`${details.totalVendas}`} />
              <StatItem icon={<DollarSign className="h-4 w-4 text-amber-500" />} label="Faturamento Total" value={`R$ ${details.faturamentoTotal.toFixed(2)}`} />
              <StatItem icon={<DollarSign className="h-4 w-4 text-green-500" />} label="Faturamento Mês" value={`R$ ${details.faturamentoMes.toFixed(2)}`} />
              <StatItem icon={<Package className="h-4 w-4 text-purple-500" />} label="Produções" value={`${details.totalProducoes} (${details.totalProduzido} un)`} />
              <StatItem icon={<IceCream className="h-4 w-4 text-pink-500" />} label="Sabores" value={`${details.saboresAtivos} ativos / ${details.saboresTotal}`} />
              <StatItem icon={<Users className="h-4 w-4 text-indigo-500" />} label="Funcionários" value={`${details.funcionariosAtivos} ativos / ${details.funcionariosTotal}`} />
              <StatItem icon={<Package className="h-4 w-4 text-cyan-500" />} label="Estoque Gelos" value={`${details.totalEstoque} un`} />
            </div>

            <Separator />

            {/* Pedidos */}
            <h4 className="text-sm font-semibold">Pedidos de Produção</h4>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-lg bg-muted p-2">
                <p className="text-lg font-bold">{details.totalPedidos}</p>
                <p className="text-[11px] text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-2">
                <p className="text-lg font-bold text-amber-500">{details.pedidosPendentes}</p>
                <p className="text-[11px] text-muted-foreground">Pendentes</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <p className="text-lg font-bold text-emerald-500">{details.pedidosConcluidos}</p>
                <p className="text-[11px] text-muted-foreground">Concluídos</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2">
      {icon}
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
        <p className="text-xs font-medium leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}
