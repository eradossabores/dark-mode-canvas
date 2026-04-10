import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Factory, Plus, Users, CreditCard, CheckCircle, XCircle, Clock, AlertTriangle, Upload, Pencil, Trash2, LogIn, Info, UserPlus, Activity, Search, TrendingUp, TrendingDown, Bell, Headphones, FileDown, ShieldAlert, BarChart3, FileText, Heart, Rocket, Tag } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { extractColorsFromImage } from "@/lib/color-extract";
import EditFactoryDialog from "@/components/superadmin/EditFactoryDialog";
import FactoryDetailsDialog from "@/components/superadmin/FactoryDetailsDialog";
import MonitorUsuarios from "@/components/superadmin/MonitorUsuarios";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PainelSaudeGeral from "@/components/superadmin/PainelSaudeGeral";
import OnboardingChecklist from "@/components/superadmin/OnboardingChecklist";
import PlanosTab from "@/components/superadmin/PlanosTab";

interface FactoryRow {
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
  emite_nfe?: boolean;
  owner_email?: string;
  collaborator_count?: number;
  vendas_mes?: number;
  producoes_mes?: number;
  faturamento_mes?: number;
  last_access?: string | null;
}

const buildAutoCredentials = (rawName: string) => {
  const slug = rawName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");

  const capitalized = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "";

  return {
    email: slug ? `${slug}@icetech.com` : "",
    password: capitalized ? `${capitalized}@2026` : "",
  };
};

export default function SuperAdmin() {
  const { user, impersonateFactory, impersonatingFactory, clearImpersonation } = useAuth();
  const navigate = useNavigate();
  const [factories, setFactories] = useState<FactoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewFactory, setShowNewFactory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingFactory, setEditingFactory] = useState<FactoryRow | null>(null);
  const [detailsFactory, setDetailsFactory] = useState<FactoryRow | null>(null);
  const [addAdminFactory, setAddAdminFactory] = useState<FactoryRow | null>(null);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: "", password: "", name: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Previous month factories for trend
  const [prevMonthStats, setPrevMonthStats] = useState({ total: 0, active: 0, trial: 0, revenue: 0 });

  const [newFactory, setNewFactory] = useState({
    name: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerName: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    const baseName = newFactory.ownerName.trim() || newFactory.name.trim();
    const next = buildAutoCredentials(baseName);
    setNewFactory((prev) => {
      if (prev.ownerEmail === next.email && prev.ownerPassword === next.password) return prev;
      return { ...prev, ownerEmail: next.email, ownerPassword: next.password };
    });
  }, [newFactory.name, newFactory.ownerName]);

  useEffect(() => {
    const next = buildAutoCredentials(newAdmin.name);
    setNewAdmin((prev) => {
      if (prev.email === next.email && prev.password === next.password) return prev;
      return { ...prev, email: next.email, password: next.password };
    });
  }, [newAdmin.name]);

  async function loadFactories() {
    try {
      const { data: factoriesData, error } = await (supabase as any)
        .from("factories")
        .select("*, subscriptions(*)")
        .neq("id", "00000000-0000-0000-0000-000000000001")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const enriched = await Promise.all(
        (factoriesData || []).map(async (f: any) => {
          const { data: profile } = await (supabase as any)
            .from("profiles")
            .select("email, nome")
            .eq("id", f.owner_id)
            .maybeSingle();

          const { count } = await (supabase as any)
            .from("user_roles")
            .select("id", { count: "exact", head: true })
            .eq("factory_id", f.id)
            .eq("role", "producao");

          // Mini metrics: vendas do mês
          const { data: vendasMes } = await (supabase as any)
            .from("vendas")
            .select("total")
            .eq("factory_id", f.id)
            .gte("created_at", monthStart)
            .neq("status", "cancelada");

          // Mini metrics: produções do mês
          const { count: prodCount } = await (supabase as any)
            .from("producoes")
            .select("id", { count: "exact", head: true })
            .eq("factory_id", f.id)
            .gte("created_at", monthStart);

          // Last access via user_sessions
          const { data: lastSession } = await (supabase as any)
            .from("user_sessions")
            .select("last_seen_at")
            .eq("factory_id", f.id)
            .order("last_seen_at", { ascending: false })
            .limit(1);

          const faturamento = (vendasMes || []).reduce((s: number, v: any) => s + Number(v.total), 0);

          return {
            ...f,
            subscription: f.subscriptions?.[0] || f.subscriptions || null,
            owner_email: profile?.email || "N/A",
            collaborator_count: count || 0,
            vendas_mes: (vendasMes || []).length,
            producoes_mes: prodCount || 0,
            faturamento_mes: faturamento,
            last_access: lastSession?.[0]?.last_seen_at || null,
          };
        })
      );

      // Sort: least time remaining first
      enriched.sort((a, b) => {
        const getExpiry = (f: any) => {
          const sub = f.subscription;
          if (!sub) return Infinity;
          if (sub.status === "trial" && sub.trial_start) {
            return new Date(sub.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000;
          }
          if (sub.current_period_end) {
            return new Date(sub.current_period_end).getTime();
          }
          return Infinity;
        };
        return getExpiry(a) - getExpiry(b);
      });

      setFactories(enriched);
    } catch (e: any) {
      toast({ title: "Erro ao carregar fábricas", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadSupportTickets() {
    setLoadingTickets(true);
    try {
      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .select("*, support_messages(id)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      // Enrich with factory names
      const factoryIds = [...new Set((data || []).filter((t: any) => t.factory_id).map((t: any) => t.factory_id))];
      let factoryMap: Record<string, string> = {};
      if (factoryIds.length > 0) {
        const { data: fData } = await (supabase as any).from("factories").select("id, name").in("id", factoryIds);
        factoryMap = Object.fromEntries((fData || []).map((f: any) => [f.id, f.name]));
      }

      // Enrich with user names
      const userIds = [...new Set((data || []).map((t: any) => t.user_id))];
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: pData } = await (supabase as any).from("profiles").select("id, nome").in("id", userIds);
        userMap = Object.fromEntries((pData || []).map((p: any) => [p.id, p.nome]));
      }

      setSupportTickets((data || []).map((t: any) => ({
        ...t,
        factory_name: factoryMap[t.factory_id] || "—",
        user_name: userMap[t.user_id] || "—",
        message_count: t.support_messages?.length || 0,
      })));
    } catch (e) {
      console.error("Erro ao carregar tickets:", e);
    } finally {
      setLoadingTickets(false);
    }
  }

  useEffect(() => {
    loadFactories();
  }, []);

  // Filtered factories
  const filteredFactories = useMemo(() => {
    return factories.filter((f) => {
      const matchesSearch =
        !searchTerm ||
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.owner_email || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || f.subscription?.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [factories, searchTerm, statusFilter]);

  // KPI calculations with real amounts
  const kpiData = useMemo(() => {
    const total = factories.length;
    const active = factories.filter((f) => f.subscription?.status === "active").length;
    const trial = factories.filter((f) => f.subscription?.status === "trial").length;
    const blocked = factories.filter((f) => f.subscription?.status === "blocked").length;
    const overdue = factories.filter((f) => f.subscription?.status === "overdue").length;
    const revenue = factories
      .filter((f) => f.subscription?.status === "active")
      .reduce((s, f) => s + (f.subscription?.amount || 99.90), 0);
    return { total, active, trial, blocked, overdue, revenue };
  }, [factories]);

  // Alerts: trials expiring soon, overdue, inactive
  const alerts = useMemo(() => {
    const now = Date.now();
    const items: { type: "warning" | "danger" | "info"; message: string; factory: string }[] = [];

    factories.forEach((f) => {
      const sub = f.subscription;
      if (!sub) return;

      // Trial expiring in ≤5 days
      if (sub.status === "trial" && sub.trial_start) {
        const trialEnd = new Date(sub.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000;
        const daysLeft = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));
        if (daysLeft <= 5 && daysLeft > 0) {
          items.push({ type: "warning", message: `Teste expira em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`, factory: f.name });
        } else if (daysLeft <= 0) {
          items.push({ type: "danger", message: "Teste expirado", factory: f.name });
        }
      }

      // Overdue
      if (sub.status === "overdue") {
        items.push({ type: "danger", message: "Assinatura vencida sem pagamento", factory: f.name });
      }

      // Inactive (no access in 7+ days)
      if (f.last_access) {
        const daysInactive = differenceInDays(new Date(), new Date(f.last_access));
        if (daysInactive >= 7) {
          items.push({ type: "info", message: `Sem acesso há ${daysInactive} dias`, factory: f.name });
        }
      }
    });

    return items.sort((a, b) => (a.type === "danger" ? -1 : b.type === "danger" ? 1 : 0));
  }, [factories]);

  // Health border for factory card
  function getHealthBorder(f: FactoryRow) {
    const sub = f.subscription;
    if (!sub) return "border-border";
    if (sub.status === "blocked") return "border-red-500/50 shadow-red-500/10 shadow-md";
    if (sub.status === "overdue") return "border-amber-500/50 shadow-amber-500/10 shadow-md";
    if (sub.status === "trial" && sub.trial_start) {
      const daysLeft = Math.ceil(
        (new Date(sub.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000)
      );
      if (daysLeft <= 5) return "border-red-500/40 shadow-red-500/10 shadow-sm";
      if (daysLeft <= 10) return "border-amber-500/40 shadow-amber-500/10 shadow-sm";
    }
    if (f.last_access) {
      const daysInactive = differenceInDays(new Date(), new Date(f.last_access));
      if (daysInactive >= 14) return "border-red-500/30";
      if (daysInactive >= 7) return "border-amber-500/30";
    }
    if (sub.status === "active") return "border-emerald-500/30";
    return "border-border";
  }

  async function logAudit(acao: string, descricao: string) {
    try {
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "Super Admin",
        modulo: "super_admin",
        acao,
        descricao,
      });
    } catch (e) {
      console.error("Audit log error:", e);
    }
  }

  async function handleCreateFactory() {
    if (!newFactory.name || !newFactory.ownerEmail || !newFactory.ownerPassword || !newFactory.ownerName) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      let logoUrl: string | null = null;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('factory-logos')
          .upload(fileName, logoFile, { contentType: logoFile.type });
        if (uploadError) throw new Error("Erro ao enviar logo: " + uploadError.message);
        const { data: urlData } = supabase.storage.from('factory-logos').getPublicUrl(fileName);
        logoUrl = urlData.publicUrl;
      }

      let theme: any = null;
      if (logoUrl && logoFile) {
        theme = await extractColorsFromImage(logoFile);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-factory-owner`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: newFactory.ownerEmail,
            password: newFactory.ownerPassword,
            nome: newFactory.ownerName,
            factory_name: newFactory.name,
            logo_url: logoUrl,
            theme,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao criar fábrica");

      await logAudit("criar_fabrica", `Fábrica "${newFactory.name}" criada com proprietário ${newFactory.ownerEmail}`);
      toast({ title: "Fábrica criada com sucesso!", description: `${newFactory.name} - ${newFactory.ownerEmail}` });
      setShowNewFactory(false);
      setNewFactory({ name: "", ownerEmail: "", ownerPassword: "", ownerName: "" });
      setLogoFile(null);
      setLogoPreview(null);
      loadFactories();
    } catch (e: any) {
      toast({ title: "Erro ao criar fábrica", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleMarkPaid(factoryId: string) {
    try {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      const { error } = await (supabase as any)
        .from("subscriptions")
        .update({
          status: "active",
          paid_at: now.toISOString(),
          current_period_start: now.toISOString().split("T")[0],
          current_period_end: periodEnd.toISOString().split("T")[0],
          grace_until: null,
          blocked_at: null,
        })
        .eq("factory_id", factoryId);
      if (error) throw error;
      const fname = factories.find((f) => f.id === factoryId)?.name || factoryId;
      await logAudit("registrar_pagamento", `Pagamento registrado para "${fname}"`);
      toast({ title: "Pagamento registrado!" });
      loadFactories();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleBlock(factoryId: string) {
    try {
      const { error } = await (supabase as any)
        .from("subscriptions")
        .update({ status: "blocked", blocked_at: new Date().toISOString() })
        .eq("factory_id", factoryId);
      if (error) throw error;
      const fname = factories.find((f) => f.id === factoryId)?.name || factoryId;
      await logAudit("bloquear_fabrica", `Fábrica "${fname}" bloqueada`);
      toast({ title: "Fábrica bloqueada" });
      loadFactories();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleDeleteFactory(factoryId: string) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const fname = factories.find((f) => f.id === factoryId)?.name || factoryId;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-factory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ factory_id: factoryId }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao excluir");
      await logAudit("excluir_fabrica", `Fábrica "${fname}" excluída permanentemente`);
      toast({ title: "Fábrica excluída com sucesso!" });
      loadFactories();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  }

  async function handleAddAdmin() {
    if (!addAdminFactory || !newAdmin.email || !newAdmin.password || !newAdmin.name) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setAddingAdmin(true);
    try {
      const response = await supabase.functions.invoke("add-factory-admin", {
        body: {
          email: newAdmin.email,
          password: newAdmin.password,
          nome: newAdmin.name,
          factory_id: addAdminFactory.id,
        },
      });
      if (response.error) throw new Error(response.error.message || "Erro ao adicionar admin");
      await logAudit("adicionar_socio", `Sócio "${newAdmin.name}" adicionado à fábrica "${addAdminFactory.name}"`);
      toast({ title: "Administrador adicionado!", description: `${newAdmin.name} agora é admin de ${addAdminFactory.name}` });
      setAddAdminFactory(null);
      setNewAdmin({ email: "", password: "", name: "" });
      loadFactories();
    } catch (e: any) {
      toast({ title: "Erro ao adicionar admin", description: e.message, variant: "destructive" });
    } finally {
      setAddingAdmin(false);
    }
  }

  async function handleUnblock(factoryId: string) {
    const fname = factories.find((f) => f.id === factoryId)?.name || factoryId;
    await handleMarkPaid(factoryId);
    await logAudit("desbloquear_fabrica", `Fábrica "${fname}" desbloqueada`);
  }

  async function handleResolveTicket(ticketId: string) {
    try {
      const { error } = await (supabase as any)
        .from("support_tickets")
        .update({ status: "resolvido" })
        .eq("id", ticketId);
      if (error) throw error;
      toast({ title: "Ticket resolvido!" });
      loadSupportTickets();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function exportFactoriesPDF() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    const date = format(new Date(), "dd/MM/yyyy HH:mm");

    doc.setFontSize(16);
    doc.text("ICETECH — Lista de Fábricas", 14, 18);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${date} | Total: ${factories.length} fábricas`, 14, 26);

    autoTable(doc, {
      startY: 34,
      head: [["Fábrica", "Email", "Status", "Valor", "Colaboradores", "Vendas/Mês", "Faturamento/Mês"]],
      body: factories.map((f) => [
        f.name,
        f.owner_email || "—",
        f.subscription?.status || "—",
        `R$ ${(f.subscription?.amount || 99.90).toFixed(2)}`,
        `${f.collaborator_count}/${f.max_collaborators}`,
        String(f.vendas_mes || 0),
        `R$ ${(f.faturamento_mes || 0).toFixed(2)}`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 95] },
    });

    doc.save(`fabricas-icetech-${format(new Date(), "yyyyMMdd")}.pdf`);
  }

  function getStatusBadge(sub: FactoryRow["subscription"]) {
    if (!sub) return <Badge variant="outline">Sem assinatura</Badge>;
    switch (sub.status) {
      case "trial":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Clock className="h-3 w-3 mr-1" />Teste</Badge>;
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="h-3 w-3 mr-1" />Ativa</Badge>;
      case "overdue":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><AlertTriangle className="h-3 w-3 mr-1" />Vencida</Badge>;
      case "blocked":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Bloqueada</Badge>;
      default:
        return <Badge variant="outline">{sub.status}</Badge>;
    }
  }

  function getTicketStatusBadge(status: string) {
    switch (status) {
      case "aberto":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Aberto</Badge>;
      case "em_andamento":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Em andamento</Badge>;
      case "resolvido":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Resolvido</Badge>;
      case "fechado":
        return <Badge variant="outline">Fechado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getTicketPriorityBadge(priority: string) {
    switch (priority) {
      case "urgente":
        return <Badge variant="destructive" className="text-[10px]">Urgente</Badge>;
      case "alta":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Alta</Badge>;
      default:
        return null;
    }
  }

  const openTicketsCount = supportTickets.filter((t) => t.status === "aberto" || t.status === "em_andamento").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Painel Super Admin</h1>
        </div>
      </div>

      <Tabs defaultValue="fabricas" onValueChange={(v) => { if (v === "suporte") loadSupportTickets(); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="fabricas" className="gap-2"><Factory className="h-4 w-4" /> Fábricas</TabsTrigger>
          <TabsTrigger value="monitor" className="gap-2"><Activity className="h-4 w-4" /> Monitor de Uso</TabsTrigger>
          <TabsTrigger value="suporte" className="gap-2 relative">
            <Headphones className="h-4 w-4" /> Suporte
            {openTicketsCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center">
                {openTicketsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="saude" className="gap-2"><Heart className="h-4 w-4" /> Saúde</TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-2"><Rocket className="h-4 w-4" /> Onboarding</TabsTrigger>
          <TabsTrigger value="planos" className="gap-2"><Tag className="h-4 w-4" /> Planos</TabsTrigger>
        </TabsList>

        <TabsContent value="monitor">
          <MonitorUsuarios />
        </TabsContent>

        <TabsContent value="saude">
          <PainelSaudeGeral />
        </TabsContent>

        <TabsContent value="onboarding">
          <OnboardingChecklist />
        </TabsContent>

        {/* ====== SUPPORT TAB ====== */}
        <TabsContent value="suporte">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Tickets de suporte de todas as fábricas</p>
            </div>

            {loadingTickets ? (
              <p className="text-center text-muted-foreground py-8 animate-pulse">Carregando tickets...</p>
            ) : supportTickets.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Headphones className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Nenhum ticket de suporte encontrado.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Fábrica</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mensagens</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supportTickets.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {t.subject}
                            {getTicketPriorityBadge(t.priority)}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{t.factory_name}</TableCell>
                        <TableCell className="text-muted-foreground">{t.user_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{t.category}</Badge></TableCell>
                        <TableCell>{getTicketStatusBadge(t.status)}</TableCell>
                        <TableCell className="text-center">{t.message_count}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(t.created_at), "dd/MM/yy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {(t.status === "aberto" || t.status === "em_andamento") && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleResolveTicket(t.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Resolver
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ====== FACTORIES TAB ====== */}
        <TabsContent value="fabricas">
          <div className="space-y-4">
            {/* Top bar: subtitle + actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-muted-foreground">Gerencie todas as fábricas e assinaturas</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportFactoriesPDF} className="gap-1.5">
                  <FileDown className="h-4 w-4" /> Exportar PDF
                </Button>
                <Dialog open={showNewFactory} onOpenChange={setShowNewFactory}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" size="sm">
                      <Plus className="h-4 w-4" /> Nova Fábrica
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Nova Fábrica</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div>
                        <Label>Logomarca da Fábrica</Label>
                        <div className="mt-1 flex items-center gap-4">
                          {logoPreview ? (
                            <div className="relative">
                              <img src={logoPreview} alt="Preview" className="h-16 w-16 rounded-lg object-contain border border-border bg-muted" />
                              <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs">×</button>
                            </div>
                          ) : (
                            <label className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
                              <Upload className="h-5 w-5 text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground mt-0.5">Logo</span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); } }} />
                            </label>
                          )}
                          <p className="text-[11px] text-muted-foreground flex-1">Envie a logomarca. As cores do tema serão extraídas automaticamente.</p>
                        </div>
                      </div>
                      <div>
                        <Label>Nome da Fábrica</Label>
                        <Input placeholder="Ex: Gelos Premium Ltda" value={newFactory.name} onChange={(e) => setNewFactory((prev) => ({ ...prev, name: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Nome do Proprietário</Label>
                        <Input placeholder="Nome completo" value={newFactory.ownerName} onChange={(e) => setNewFactory((prev) => ({ ...prev, ownerName: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Email do Proprietário</Label>
                        <Input type="email" placeholder="dono@fabrica.com" value={newFactory.ownerEmail} onChange={(e) => setNewFactory({ ...newFactory, ownerEmail: e.target.value })} />
                      </div>
                      <div>
                        <Label>Senha Inicial</Label>
                        <Input type="text" placeholder="Senha do proprietário" value={newFactory.ownerPassword} onChange={(e) => setNewFactory({ ...newFactory, ownerPassword: e.target.value })} />
                      </div>
                      <p className="text-xs text-muted-foreground">O proprietário terá 30 dias grátis. Após, R$ 99,90/mês.</p>
                      <Button className="w-full" onClick={handleCreateFactory} disabled={creating}>{creating ? "Criando..." : "Criar Fábrica e Proprietário"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou email..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="trial">Em Teste</SelectItem>
                  <SelectItem value="overdue">Vencidas</SelectItem>
                  <SelectItem value="blocked">Bloqueadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* KPI Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Factory className="h-8 w-8 text-primary shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{kpiData.total}</p>
                    <p className="text-xs text-muted-foreground">Fábricas</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{kpiData.active}</p>
                    <p className="text-xs text-muted-foreground">Ativas</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="h-8 w-8 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">{kpiData.trial}</p>
                    <p className="text-xs text-muted-foreground">Em Teste</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <CreditCard className="h-8 w-8 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold">R$ {kpiData.revenue.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Receita Mensal</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <Card className="border-amber-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-500" />
                    Alertas e Notificações
                    <Badge variant="destructive" className="ml-auto text-[10px]">{alerts.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {alerts.map((alert, i) => (
                      <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                        alert.type === "danger" ? "bg-red-500/10 border border-red-500/20" :
                        alert.type === "warning" ? "bg-amber-500/10 border border-amber-500/20" :
                        "bg-blue-500/10 border border-blue-500/20"
                      }`}>
                        <div className="flex items-center gap-2">
                          {alert.type === "danger" ? <ShieldAlert className="h-4 w-4 text-red-500" /> :
                           alert.type === "warning" ? <AlertTriangle className="h-4 w-4 text-amber-500" /> :
                           <Clock className="h-4 w-4 text-blue-500" />}
                          <div>
                            <p className="text-sm font-medium">{alert.factory}</p>
                            <p className="text-[11px] text-muted-foreground">{alert.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Factories list */}
            {loading ? (
              <p className="text-muted-foreground animate-pulse text-center py-8">Carregando fábricas...</p>
            ) : filteredFactories.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== "all" ? "Nenhuma fábrica encontrada com esses filtros." : "Nenhuma fábrica cadastrada ainda."}
                  </p>
                  {!searchTerm && statusFilter === "all" && (
                    <Button className="mt-4 gap-2" onClick={() => setShowNewFactory(true)}>
                      <Plus className="h-4 w-4" /> Criar Primeira Fábrica
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredFactories.map((factory) => (
                  <Card key={factory.id} className={`overflow-hidden transition-all ${getHealthBorder(factory)}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {factory.logo_url ? (
                            <img src={factory.logo_url} alt={factory.name} className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Factory className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          <div>
                            <CardTitle className="text-base">{factory.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">{factory.owner_email}</p>
                          </div>
                        </div>
                        {getStatusBadge(factory.subscription)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Mini metrics */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-md bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold">{factory.vendas_mes || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Vendas/Mês</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold">{factory.producoes_mes || 0}</p>
                          <p className="text-[10px] text-muted-foreground">Produções</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2 text-center">
                          <p className="text-sm font-bold">R$ {((factory.faturamento_mes || 0) / 1000).toFixed(1)}k</p>
                          <p className="text-[10px] text-muted-foreground">Faturamento</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Colaboradores</span>
                        <span className="font-medium">{factory.collaborator_count}/{factory.max_collaborators}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Último acesso</span>
                        <span className={`text-xs ${factory.last_access ? (differenceInDays(new Date(), new Date(factory.last_access)) >= 7 ? "text-amber-500" : "") : "text-muted-foreground"}`}>
                          {factory.last_access ? format(new Date(factory.last_access), "dd/MM HH:mm") : "Nunca"}
                        </span>
                      </div>

                      {factory.subscription?.trial_start && factory.subscription.status === "trial" && (() => {
                        const trialEnd = new Date(new Date(factory.subscription!.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000);
                        const diasRestantes = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
                        return (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Dias restantes</span>
                            <span className={`font-semibold ${diasRestantes <= 5 ? "text-destructive" : diasRestantes <= 10 ? "text-amber-500" : "text-emerald-500"}`}>
                              {diasRestantes === 0 ? "Expira hoje" : `${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""}`}
                            </span>
                          </div>
                        );
                      })()}

                      {factory.subscription?.current_period_end && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Vencimento</span>
                          <span>{format(new Date(factory.subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                      )}

                      {/* NFE Toggle */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Nota Fiscal</span>
                        <Switch
                          checked={!!factory.emite_nfe}
                          onCheckedChange={async (checked) => {
                            const { error } = await (supabase as any).from("factories").update({ emite_nfe: checked }).eq("id", factory.id);
                            if (error) { toast({ title: "Erro ao atualizar NF-e", variant: "destructive" }); return; }
                            setFactories(prev => prev.map(f => f.id === factory.id ? { ...f, emite_nfe: checked } : f));
                            toast({ title: checked ? "NF-e habilitada" : "NF-e desabilitada" });
                          }}
                        />
                      </div>

                      <div className="border-t my-1" />

                      <Button size="sm" variant="default" className="w-full" onClick={() => {
                        impersonateFactory({ id: factory.id, name: factory.name, logo_url: factory.logo_url, theme: undefined });
                        navigate("/painel");
                      }}>
                        <LogIn className="h-3.5 w-3.5 mr-1" /> Entrar na Fábrica
                      </Button>

                      <div className="grid grid-cols-2 gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setEditingFactory(factory)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setDetailsFactory(factory)}>
                          <Info className="h-3.5 w-3.5 mr-1" /> Detalhes
                        </Button>
                        {factory.subscription?.status === "blocked" ? (
                          <Button size="sm" variant="outline" className="col-span-2" onClick={() => handleUnblock(factory.id)}>Desbloquear</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(factory.id)}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pago
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setAddAdminFactory(factory)}>
                          <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Sócio
                        </Button>
                        {factory.subscription?.status !== "blocked" && (
                          <Button size="sm" variant="outline" className="col-span-2" onClick={() => setDetailsFactory(factory)}>
                            <Users className="h-3.5 w-3.5 mr-1" /> Ver Sócios
                          </Button>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 mt-1">
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir Fábrica
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir "{factory.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação é irreversível. Todos os dados da fábrica serão excluídos permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteFactory(factory.id)}>
                              Sim, excluir tudo
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Edit Factory Dialog */}
          {editingFactory && (
            <EditFactoryDialog
              open={!!editingFactory}
              onOpenChange={(open) => !open && setEditingFactory(null)}
              factory={editingFactory}
              onSaved={loadFactories}
            />
          )}

          {detailsFactory && (
            <FactoryDetailsDialog
              open={!!detailsFactory}
              onOpenChange={(open) => !open && setDetailsFactory(null)}
              factory={detailsFactory}
              onAddAdmin={() => {
                setAddAdminFactory(detailsFactory);
                setDetailsFactory(null);
              }}
            />
          )}

          {/* Add Admin Dialog */}
          {addAdminFactory && (
            <Dialog open={!!addAdminFactory} onOpenChange={(open) => { if (!open) { setAddAdminFactory(null); setNewAdmin({ email: "", password: "", name: "" }); } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Administrador — {addAdminFactory.name}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">Crie um acesso de administrador (sócio) para esta fábrica.</p>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Nome do Sócio</Label>
                    <Input placeholder="Ex: Carlos Sheik" value={newAdmin.name} onChange={(e) => setNewAdmin((prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Senha Inicial</Label>
                    <Input type="text" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} />
                  </div>
                  <Button className="w-full" onClick={handleAddAdmin} disabled={addingAdmin}>
                    {addingAdmin ? "Adicionando..." : "Adicionar Administrador"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
