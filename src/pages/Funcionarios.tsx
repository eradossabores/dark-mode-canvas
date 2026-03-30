import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { insertRow } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function Funcionarios() {
  const { factoryId } = useAuth();
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", tipo_pagamento: "diaria" as string, valor_pagamento: "", setor: "producao" as string });

  useEffect(() => { loadData(); }, [factoryId]);

  async function loadData() {
    let q = (supabase as any).from("funcionarios").select("*").order("nome");
    if (factoryId) q = q.eq("factory_id", factoryId);
    const { data } = await q;
    setFuncionarios(data || []);
  }

  function openNew() {
    setEditingId(null);
    setForm({ nome: "", tipo_pagamento: "diaria", valor_pagamento: "", setor: "producao" });
    setOpen(true);
  }

  function openEdit(f: any) {
    setEditingId(f.id);
    setForm({ nome: f.nome, tipo_pagamento: f.tipo_pagamento, valor_pagamento: String(f.valor_pagamento), setor: f.setor || "producao" });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!form.nome) return toast({ title: "Nome obrigatório", variant: "destructive" });
    if (!form.valor_pagamento) return toast({ title: "Valor obrigatório", variant: "destructive" });
    try {
      const payload: any = { nome: form.nome, tipo_pagamento: form.tipo_pagamento, valor_pagamento: Number(form.valor_pagamento), setor: form.setor };
      if (editingId) {
        const { error } = await (supabase as any).from("funcionarios").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Colaborador atualizado!" });
      } else {
        if (factoryId) payload.factory_id = factoryId;
        await insertRow("funcionarios", payload);
        toast({ title: "Colaborador cadastrado!" });
      }
      setOpen(false);
      setEditingId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleToggleStatus(f: any) {
    try {
      await (supabase as any).from("funcionarios").update({ ativo: !f.ativo }).eq("id", f.id);
      toast({ title: `Colaborador ${!f.ativo ? "ativado" : "desativado"}!` });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any).from("funcionarios").update({ ativo: false }).eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Colaborador desativado!" });
      setDeleteId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Colaboradores</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Colaborador</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div>
              <Label>Setor</Label>
              <Select value={form.setor} onValueChange={(v) => setForm({ ...form, setor: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="producao">🏭 Produção</SelectItem>
                  <SelectItem value="vendas">🛒 Vendas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={form.tipo_pagamento} onValueChange={(v) => setForm({ ...form, tipo_pagamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="fixo">Valor Fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_pagamento} onChange={(e) => setForm({ ...form, valor_pagamento: e.target.value })} />
            </div>
            <Button className="w-full" onClick={handleSubmit}>{editingId ? "Salvar Alterações" : "Cadastrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar colaborador?</AlertDialogTitle>
            <AlertDialogDescription>O colaborador será marcado como inativo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funcionarios.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {f.setor === "vendas" ? "🛒 Vendas" : "🏭 Produção"}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{f.tipo_pagamento === "diaria" ? "Diária" : "Fixo"}</TableCell>
                  <TableCell>R$ {Number(f.valor_pagamento).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={f.ativo ? "default" : "destructive"}
                      className="cursor-pointer"
                      onClick={() => handleToggleStatus(f)}
                    >{f.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {funcionarios.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum colaborador.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
