import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Factory, Plus, Users, CreditCard, CheckCircle, XCircle, Clock, AlertTriangle, Upload, Pencil, Trash2, LogIn, Info, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { extractColorsFromImage } from "@/lib/color-extract";
import EditFactoryDialog from "@/components/superadmin/EditFactoryDialog";
import FactoryDetailsDialog from "@/components/superadmin/FactoryDetailsDialog";

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
  owner_email?: string;
  collaborator_count?: number;
}

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
  // New factory form
  const [newFactory, setNewFactory] = useState({
    name: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerName: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  async function loadFactories() {
    try {
      const { data: factoriesData, error } = await (supabase as any)
        .from("factories")
        .select("*, subscriptions(*)")
        .neq("id", "00000000-0000-0000-0000-000000000001")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with owner emails and collaborator counts
      const enriched = await Promise.all(
        (factoriesData || []).map(async (f: any) => {
          // Get owner profile
          const { data: profile } = await (supabase as any)
            .from("profiles")
            .select("email, nome")
            .eq("id", f.owner_id)
            .maybeSingle();

          // Count collaborators
          const { count } = await (supabase as any)
            .from("user_roles")
            .select("id", { count: "exact", head: true })
            .eq("factory_id", f.id)
            .eq("role", "producao");

          return {
            ...f,
            subscription: f.subscriptions?.[0] || f.subscriptions || null,
            owner_email: profile?.email || "N/A",
            collaborator_count: count || 0,
          };
        })
      );

      // Sort: least time remaining first (trial expiring soonest, then active by period end, then others)
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

  useEffect(() => {
    loadFactories();
  }, []);

  async function handleCreateFactory() {
    if (!newFactory.name || !newFactory.ownerEmail || !newFactory.ownerPassword || !newFactory.ownerName) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      // 1. Upload logo if provided
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

      // 2. Extract dominant colors from logo for theme
      let theme: any = null;
      if (logoUrl && logoFile) {
        theme = await extractColorsFromImage(logoFile);
      }

      // 3. Create the user via edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-factory-owner`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
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
        .update({
          status: "blocked",
          blocked_at: new Date().toISOString(),
        })
        .eq("factory_id", factoryId);

      if (error) throw error;
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

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-factory`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ factory_id: factoryId }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao excluir");

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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-factory-admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: newAdmin.email,
            password: newAdmin.password,
            nome: newAdmin.name,
            factory_id: addAdminFactory.id,
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao adicionar admin");
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
    await handleMarkPaid(factoryId);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Painel Super Admin</h1>
          <p className="text-muted-foreground">Gerencie todas as fábricas e assinaturas</p>
        </div>
        <Dialog open={showNewFactory} onOpenChange={setShowNewFactory}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nova Fábrica
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Fábrica</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Logo upload */}
              <div>
                <Label>Logomarca da Fábrica</Label>
                <div className="mt-1 flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img src={logoPreview} alt="Preview" className="h-16 w-16 rounded-lg object-contain border border-border bg-muted" />
                      <button
                        type="button"
                        onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground mt-0.5">Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setLogoFile(file);
                            setLogoPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                  )}
                  <p className="text-[11px] text-muted-foreground flex-1">
                    Envie a logomarca. As cores do tema serão extraídas automaticamente.
                  </p>
                </div>
              </div>
              <div>
                <Label>Nome da Fábrica</Label>
                <Input
                  placeholder="Ex: Gelos Premium Ltda"
                  value={newFactory.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const firstName = name.trim().split(/\s+/)[0].toLowerCase()
                      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]/g, "");
                    setNewFactory({
                      ...newFactory,
                      name,
                      ownerEmail: firstName ? `${firstName}@icetech.com` : "",
                      ownerPassword: firstName ? `${firstName}@2026` : "",
                    });
                  }}
                />
              </div>
              <div>
                <Label>Nome do Proprietário</Label>
                <Input
                  placeholder="Nome completo"
                  value={newFactory.ownerName}
                  onChange={(e) => setNewFactory({ ...newFactory, ownerName: e.target.value })}
                />
              </div>
              <div>
                <Label>Email do Proprietário</Label>
                <Input
                  type="email"
                  placeholder="dono@fabrica.com"
                  value={newFactory.ownerEmail}
                  onChange={(e) => setNewFactory({ ...newFactory, ownerEmail: e.target.value })}
                />
              </div>
              <div>
                <Label>Senha Inicial</Label>
                <Input
                  type="text"
                  placeholder="Senha do proprietário"
                  value={newFactory.ownerPassword}
                  onChange={(e) => setNewFactory({ ...newFactory, ownerPassword: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O proprietário terá 30 dias grátis. Após, R$ 99,90/mês.
              </p>
              <Button className="w-full" onClick={handleCreateFactory} disabled={creating}>
                {creating ? "Criando..." : "Criar Fábrica e Proprietário"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Factory className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{factories.length}</p>
              <p className="text-xs text-muted-foreground">Fábricas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{factories.filter(f => f.subscription?.status === "active").length}</p>
              <p className="text-xs text-muted-foreground">Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{factories.filter(f => f.subscription?.status === "trial").length}</p>
              <p className="text-xs text-muted-foreground">Em Teste</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">
                R$ {(factories.filter(f => f.subscription?.status === "active").length * 99.90).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Receita Mensal</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Factories list */}
      {loading ? (
        <p className="text-muted-foreground animate-pulse text-center py-8">Carregando fábricas...</p>
      ) : factories.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma fábrica cadastrada ainda.</p>
            <Button className="mt-4 gap-2" onClick={() => setShowNewFactory(true)}>
              <Plus className="h-4 w-4" /> Criar Primeira Fábrica
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {factories.map((factory) => (
            <Card key={factory.id} className="overflow-hidden">
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
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Colaboradores
                  </span>
                  <span className="font-medium">{factory.collaborator_count}/{factory.max_collaborators}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Criada em</span>
                  <span>{format(new Date(factory.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>

                {factory.subscription?.trial_start && factory.subscription.status === "trial" && (() => {
                  const trialEnd = new Date(new Date(factory.subscription!.trial_start).getTime() + 30 * 24 * 60 * 60 * 1000);
                  const diasRestantes = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
                  return (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Teste até</span>
                        <span>{format(trialEnd, "dd/MM/yyyy", { locale: ptBR })}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Dias restantes</span>
                        <span className={`font-semibold ${diasRestantes <= 5 ? "text-destructive" : diasRestantes <= 10 ? "text-amber-500" : "text-emerald-500"}`}>
                          {diasRestantes === 0 ? "Expira hoje" : `${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""}`}
                        </span>
                      </div>
                    </>
                  );
                })()}

                {factory.subscription?.current_period_end && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Vencimento</span>
                    <span>{format(new Date(factory.subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}

                <div className="border-t my-1" />

                {/* Primary action */}
                <Button size="sm" variant="default" className="w-full" onClick={() => {
                  impersonateFactory({ id: factory.id, name: factory.name, logo_url: factory.logo_url, theme: undefined });
                  navigate("/painel");
                }}>
                  <LogIn className="h-3.5 w-3.5 mr-1" /> Entrar na Fábrica
                </Button>

                {/* Grid of secondary actions */}
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setEditingFactory(factory)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setDetailsFactory(factory)}>
                    <Info className="h-3.5 w-3.5 mr-1" /> Detalhes
                  </Button>
                  {factory.subscription?.status === "blocked" ? (
                    <Button size="sm" variant="outline" className="col-span-2" onClick={() => handleUnblock(factory.id)}>
                      Desbloquear
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleMarkPaid(factory.id)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pago
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setAddAdminFactory(factory)}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Sócio
                  </Button>
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
                        Esta ação é irreversível. Todos os dados da fábrica (clientes, vendas, produção, estoque, colaboradores e o proprietário) serão excluídos permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDeleteFactory(factory.id)}
                      >
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
            <p className="text-sm text-muted-foreground">
              Crie um acesso de administrador (sócio) para esta fábrica. Ele terá acesso total ao sistema da fábrica.
            </p>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome do Sócio</Label>
                <Input placeholder="Nome completo" value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" placeholder="socio@email.com" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} />
              </div>
              <div>
                <Label>Senha Inicial</Label>
                <Input type="text" placeholder="Senha do sócio" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} />
              </div>
              <Button className="w-full" onClick={handleAddAdmin} disabled={addingAdmin}>
                {addingAdmin ? "Adicionando..." : "Adicionar Administrador"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
