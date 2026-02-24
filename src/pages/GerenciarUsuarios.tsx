import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Shield, Factory } from "lucide-react";

interface UserWithRole {
  id: string;
  email: string;
  nome: string;
  role: string;
  created_at: string;
}

export default function GerenciarUsuarios() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", nome: "", role: "producao" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadUsers(); }, []);

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
      // Use edge function to create user (admin action)
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo Usuário</Button>
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

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
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
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum usuário cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
