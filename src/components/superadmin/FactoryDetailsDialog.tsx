import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Users, Package, ShoppingCart, DollarSign, Factory, IceCream, AlertTriangle, CheckCircle, Clock, XCircle, Activity, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAdmin?: () => void;
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

interface UserUsage {
  userId: string;
  nome: string;
  email: string;
  role: string;
  totalSessions: number;
  totalMinutes: number;
  lastSeen: string | null;
  firstSeen: string | null;
}

function formatDuration(totalMinutes: number) {
  if (totalMinutes < 1) return "< 1 min";
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}min`);
  return parts.join(" ") || "0min";
}

function formatDurationLong(totalMinutes: number) {
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} dia${days > 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hora${hours > 1 ? "s" : ""}`);
  if (mins > 0) parts.push(`${mins} minuto${mins > 1 ? "s" : ""}`);
  return parts.join(", ") || "Menos de 1 minuto";
}

export default function FactoryDetailsDialog({ open, onOpenChange, factory, onAddAdmin }: Props) {
  const [details, setDetails] = useState<any>(null);
  const [usageData, setUsageData] = useState<UserUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadDetails();
      loadUsageData();
    }
  }, [open]);

  async function loadUsageData() {
    try {
      const fid = factory.id;

      // Get all user_roles for this factory
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("user_id, role")
        .eq("factory_id", fid);

      if (!roles || roles.length === 0) {
        setUsageData([]);
        return;
      }

      const userIds = roles.map((r: any) => r.user_id);

      // Get profiles for these users
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);

      // Get sessions for this factory
      const { data: sessions } = await (supabase as any)
        .from("user_sessions")
        .select("user_id, duration_minutes, started_at, last_seen_at")
        .eq("factory_id", fid);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

      const roleMap: Record<string, string> = {};
      roles.forEach((r: any) => { roleMap[r.user_id] = r.role; });

      // Aggregate sessions per user
      const sessionMap: Record<string, { total: number; count: number; first: string | null; last: string | null }> = {};
      (sessions || []).forEach((s: any) => {
        if (!sessionMap[s.user_id]) {
          sessionMap[s.user_id] = { total: 0, count: 0, first: null, last: null };
        }
        const entry = sessionMap[s.user_id];
        entry.total += s.duration_minutes || 0;
        entry.count += 1;
        if (!entry.first || s.started_at < entry.first) entry.first = s.started_at;
        if (!entry.last || s.last_seen_at > entry.last) entry.last = s.last_seen_at;
      });

      const usage: UserUsage[] = userIds.map((uid: string) => {
        const profile = profileMap[uid];
        const sess = sessionMap[uid] || { total: 0, count: 0, first: null, last: null };
        return {
          userId: uid,
          nome: profile?.nome || "Desconhecido",
          email: profile?.email || "",
          role: roleMap[uid] || "N/A",
          totalSessions: sess.count,
          totalMinutes: sess.total,
          lastSeen: sess.last,
          firstSeen: sess.first,
        };
      });

      // Sort: owner first, then by total usage desc
      usage.sort((a, b) => {
        if (a.role === "factory_owner" || a.role === "admin") return -1;
        if (b.role === "factory_owner" || b.role === "admin") return 1;
        return b.totalMinutes - a.totalMinutes;
      });

      setUsageData(usage);
    } catch (e) {
      console.error("Usage data error:", e);
    }
  }

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
      const pedidosPendentes = (pedidos.data || []).filter((p: any) => p.status === "pendente").length;
      const pedidosConcluidos = (pedidos.data || []).filter((p: any) => p.status === "concluido" || p.status === "entregue").length;

      setDetails({
        totalClientes: (clientes.data || []).length,
        clientesAtivos,
        clientesInativos: (clientes.data || []).filter((c: any) => c.status === "inativo").length,
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

  function getRoleName(role: string) {
    switch (role) {
      case "factory_owner": return "Proprietário";
      case "admin": return "Administrador";
      case "producao": return "Colaborador";
      case "super_admin": return "Super Admin";
      default: return role;
    }
  }

  const totalUsageMinutes = usageData.reduce((s, u) => s + u.totalMinutes, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

            {/* Sócios / Administradores */}
            {(() => {
              const socios = usageData.filter(u => u.role === "factory_owner" || u.role === "admin");
              if (socios.length === 0) return null;
              return (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-primary" />
                    Sócios / Administradores ({socios.length})
                  </h4>
                  <div className="space-y-2">
                    {socios.map((s, i) => (
                      <div key={i} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{s.nome}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{s.email}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 ml-2 border-primary/30 text-primary">
                            {getRoleName(s.role)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Último acesso:</span>
                            <p className="font-semibold">{s.lastSeen ? format(new Date(s.lastSeen), "dd/MM/yy HH:mm", { locale: ptBR }) : "Nunca acessou"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tempo total:</span>
                            <p className="font-semibold">{formatDuration(s.totalMinutes)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <Separator />

            {/* Tempo de Uso */}
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-primary" />
                Tempo de Uso do Sistema
              </h4>

              {/* Total geral */}
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tempo total da fábrica</span>
                  <span className="text-sm font-bold text-primary">{formatDurationLong(totalUsageMinutes)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">Total de sessões</span>
                  <span className="text-xs font-medium">{usageData.reduce((s, u) => s + u.totalSessions, 0)}</span>
                </div>
              </div>

              {/* Per user */}
              {usageData.length > 0 ? (
                <div className="space-y-2">
                  {usageData.map((u, i) => (
                    <div key={i} className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.nome}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{getRoleName(u.role)}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Tempo total:</span>
                          <p className="font-semibold">{formatDuration(u.totalMinutes)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sessões:</span>
                          <p className="font-semibold">{u.totalSessions}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Primeiro acesso:</span>
                          <p className="font-semibold">{u.firstSeen ? format(new Date(u.firstSeen), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Último acesso:</span>
                          <p className="font-semibold">{u.lastSeen ? format(new Date(u.lastSeen), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhum dado de uso registrado ainda. Os dados começarão a aparecer conforme os usuários acessarem o sistema.
                </p>
              )}
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

            {onAddAdmin && (
              <>
                <Separator />
                <Button className="w-full gap-2" onClick={onAddAdmin}>
                  <UserPlus className="h-4 w-4" /> Adicionar Sócio/Admin
                </Button>
              </>
            )}
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
