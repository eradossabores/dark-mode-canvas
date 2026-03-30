import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Shield, Factory, Clock, CheckCircle, XCircle, Bell, LinkIcon, KeyRound, Eye, EyeOff, Trash2, Pencil, ShoppingCart } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface UserWithRole {
  id: string;
  email: string;
  nome: string;
  role: string;
  created_at: string;
}

interface AccessRequest {
  id: string;
  user_id: string;
  email: string;
  nome: string | null;
  status: string;
  created_at: string;
}

export default function GerenciarUsuarios() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nome: "", role: "producao" });
  const [loading, setLoading] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; user: UserWithRole | null }>({ open: false, user: null });
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: UserWithRole | null }>({ open: false, user: null });
  const [deleting, setDeleting] = useState(false);
  const [clearAllDialog, setClearAllDialog] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; user: UserWithRole | null }>({ open: false, user: null });
  const [editForm, setEditForm] = useState({ nome: "", role: "" });
  const [saving, setSaving] = useState(false);

  async function handleEditUser() {
    if (!editDialog.user) return;
    setSaving(true);
    try {
      // Update name in profiles
      const { error: profileErr } = await (supabase as any).from("profiles").update({ nome: editForm.nome }).eq("id", editDialog.user.id);
      if (profileErr) throw profileErr;

      // Update role in user_roles
      if (editForm.role !== editDialog.user.role) {
        const { error: roleErr } = await (supabase as any).from("user_roles").update({ role: editForm.role }).eq("user_id", editDialog.user.id);
        if (roleErr) throw roleErr;
      }

      toast({ title: "Usuário atualizado!" });
      setEditDialog({ open: false, user: null });
      loadUsers();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDeleteUser() {
    if (!deleteDialog.user) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: deleteDialog.user.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `${deleteDialog.user.nome || deleteDialog.user.email} excluído com sucesso!` });
      setDeleteDialog({ open: false, user: null });
      loadUsers();
      loadRequests();
    } catch (e: any) {
      toast({ title: "Erro ao excluir usuário", description: e.message, variant: "destructive" });
    }
    setDeleting(false);
  }

  async function handleDeleteRequest(requestId: string) {
    try {
      const { error } = await (supabase as any).from("access_requests").delete().eq("id", requestId);
      if (error) throw error;
      toast({ title: "Solicitação excluída!" });
      loadRequests();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  }

  async function handleClearAllRequests() {
    setClearingAll(true);
    try {
      const { error } = await (supabase as any).from("access_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      toast({ title: "Todas as solicitações foram excluídas!" });
      setClearAllDialog(false);
      loadRequests();
    } catch (e: any) {
      toast({ title: "Erro ao limpar solicitações", description: e.message, variant: "destructive" });
    }
    setClearingAll(false);
  }

  async function handleChangePassword() {
    if (!passwordDialog.user || !newPassword) {
      toast({ title: "Preencha a nova senha", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-password", {
        body: { user_id: passwordDialog.user.id, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `Senha de ${passwordDialog.user.nome || passwordDialog.user.email} alterada com sucesso!` });
      setPasswordDialog({ open: false, user: null });
      setNewPassword("");
    } catch (e: any) {
      toast({ title: "Erro ao alterar senha", description: e.message, variant: "destructive" });
    }
    setChangingPassword(false);
  }

  async function generateInvite(role: "admin" | "producao" | "vendedor") {
    setGeneratingInvite(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await (supabase as any)
        .from("invites")
        .insert({ role, created_by: user.id })
        .select("token")
        .single();
      if (error) throw error;
      const link = `${window.location.origin}/cadastro?token=${data.token}`;
      await navigator.clipboard.writeText(link);
      const label = role === "admin" ? "Admin" : role === "vendedor" ? "Vendedor" : "Produção";
      toast({ title: `Link de convite (${label}) copiado!`, description: "Válido por 7 dias." });
    } catch (e: any) {
      toast({ title: "Erro ao gerar convite", description: e.message, variant: "destructive" });
    }
    setGeneratingInvite(false);
  }

  useEffect(() => { loadUsers(); loadRequests(); }, []);

  async function loadUsers() {
    const { data: profiles } = await (supabase as any).from("profiles").select("*").order("created_at");
    const { data: roles } = await (supabase as any).from("user_roles").select("*");
    
    const roleMap: Record<string, string> = {};
    (roles || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
    
    const merged = (profiles || []).map((p: any) => ({
      id: p.id,
      email: p.email || "",
      nome: p.nome || "",
      role: roleMap[p.id] || "sem_role",
      created_at: p.created_at,
    }));
    setUsers(merged);
  }

  async function loadRequests() {
    const { data } = await (supabase as any)
      .from("access_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests(data || []);
  }

  async function handleApprove(request: AccessRequest) {
    try {
      // Insert role for the user
      const { error: roleError } = await (supabase as any)
        .from("user_roles")
        .insert({ user_id: request.user_id, role: "producao" });
      if (roleError) throw roleError;

      // Update request status
      const { error: updateError } = await (supabase as any)
        .from("access_requests")
        .update({ status: "aprovado", updated_at: new Date().toISOString() })
        .eq("id", request.id);
      if (updateError) throw updateError;

      toast({ title: `${request.nome || request.email} aprovado com sucesso!` });
      loadRequests();
      loadUsers();
    } catch (e: any) {
      toast({ title: "Erro ao aprovar", description: e.message, variant: "destructive" });
    }
  }

  async function handleReject(request: AccessRequest) {
    try {
      const { error } = await (supabase as any)
        .from("access_requests")
        .update({ status: "rejeitado", updated_at: new Date().toISOString() })
        .eq("id", request.id);
      if (error) throw error;

      toast({ title: `${request.nome || request.email} rejeitado.` });
      loadRequests();
    } catch (e: any) {
      toast({ title: "Erro ao rejeitar", description: e.message, variant: "destructive" });
    }
  }

  async function handleCreate() {
    if (!form.email || !form.password || !form.nome) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email: form.email, password: form.password, nome: form.nome, role: form.role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário criado com sucesso!" });
      setOpen(false);
      setForm({ email: "", password: "", nome: "", role: "producao" });
      loadUsers();
    } catch (e: any) {
      toast({ title: "Erro ao criar usuário", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  const pendingRequests = requests.filter(r => r.status === "pendente");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            disabled={generatingInvite}
            onClick={() => generateInvite("admin")}
          >
            <Shield className="h-4 w-4 mr-2" />
            {generatingInvite ? "Gerando..." : "Convite Admin"}
          </Button>
          <Button
            variant="outline"
            disabled={generatingInvite}
            onClick={() => generateInvite("producao")}
          >
            <Factory className="h-4 w-4 mr-2" />
            {generatingInvite ? "Gerando..." : "Convite Colaborador"}
          </Button>
          <Button
            variant="outline"
            disabled={generatingInvite}
            onClick={() => generateInvite("vendedor")}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {generatingInvite ? "Gerando..." : "Convite Vendedor"}
          </Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo Usuário</Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Senha *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" /></div>
            <div>
              <Label>Perfil de Acesso</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador (acesso total)</SelectItem>
                  <SelectItem value="producao">Produção (acesso limitado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={loading}>
              {loading ? "Criando..." : "Criar Usuário"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Usuários Ativos</TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            Solicitações de Acesso
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Nome</TableHead>
                     <TableHead>Email</TableHead>
                     <TableHead>Perfil</TableHead>
                     <TableHead>Criado em</TableHead>
                     <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.filter(u => u.role !== "sem_role").map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="gap-1">
                          {u.role === "admin" ? <Shield className="h-3 w-3" /> : <Factory className="h-3 w-3" />}
                          {u.role === "admin" ? "Administrador" : "Produção"}
                        </Badge>
                      </TableCell>
                       <TableCell>{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                       <TableCell>
                         <div className="flex gap-2">
                           <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditDialog({ open: true, user: u }); setEditForm({ nome: u.nome, role: u.role }); }}>
                             <Pencil className="h-3 w-3" /> Editar
                           </Button>
                           <Button size="sm" variant="outline" className="gap-1" onClick={() => { setPasswordDialog({ open: true, user: u }); setNewPassword(""); }}>
                             <KeyRound className="h-3 w-3" /> Senha
                           </Button>
                           <Button size="sm" variant="destructive" className="gap-1" onClick={() => setDeleteDialog({ open: true, user: u })}>
                             <Trash2 className="h-3 w-3" />
                           </Button>
                         </div>
                       </TableCell>
                     </TableRow>
                   ))}
                   {users.filter(u => u.role !== "sem_role").length === 0 && (
                     <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum usuário cadastrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  {pendingRequests.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <Bell className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                        {pendingRequests.length} solicitação(ões) aguardando aprovação
                      </span>
                    </div>
                  )}
                </div>
                {requests.length > 0 && (
                  <Button variant="destructive" size="sm" className="gap-1" onClick={() => setClearAllDialog(true)}>
                    <Trash2 className="h-3 w-3" /> Excluir Tudo
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nome || "—"}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === "pendente" ? "outline" : r.status === "aprovado" ? "default" : "destructive"}
                          className="gap-1"
                        >
                          {r.status === "pendente" && <Clock className="h-3 w-3" />}
                          {r.status === "aprovado" && <CheckCircle className="h-3 w-3" />}
                          {r.status === "rejeitado" && <XCircle className="h-3 w-3" />}
                          {r.status === "pendente" ? "Pendente" : r.status === "aprovado" ? "Aprovado" : "Rejeitado"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                         {r.status === "pendente" ? (
                          <div className="flex gap-2">
                            <Button size="sm" variant="default" className="gap-1" onClick={() => handleApprove(r)}>
                              <CheckCircle className="h-3 w-3" /> Aprovar
                            </Button>
                            <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleReject(r)}>
                              <XCircle className="h-3 w-3" /> Rejeitar
                            </Button>
                          </div>
                         ) : (
                          <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => handleDeleteRequest(r.id)}>
                            <Trash2 className="h-3 w-3" /> Excluir
                          </Button>
                         )}
                       </TableCell>
                     </TableRow>
                  ))}
                  {requests.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma solicitação de acesso.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={passwordDialog.open} onOpenChange={(o) => { setPasswordDialog({ ...passwordDialog, open: o }); if (!o) setNewPassword(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Alterando senha de <strong>{passwordDialog.user?.nome || passwordDialog.user?.email}</strong>
            </p>
            <div>
              <Label>Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? "Alterando..." : "Confirmar Nova Senha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ ...deleteDialog, open: o })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteDialog.user?.nome || deleteDialog.user?.email}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={clearAllDialog} onOpenChange={setClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Todas as Solicitações</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir todas as {requests.length} solicitações de acesso? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllRequests} disabled={clearingAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {clearingAll ? "Excluindo..." : "Excluir Tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialog.open} onOpenChange={(o) => setEditDialog({ ...editDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
            </div>
            <div>
              <Label>Perfil</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleEditUser} disabled={saving || !editForm.nome.trim()}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
