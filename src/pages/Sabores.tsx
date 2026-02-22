import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function Sabores() {
  const [sabores, setSabores] = useState<any[]>([]);
  const [receitas, setReceitas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [s, r] = await Promise.all([
      (supabase as any).from("sabores").select("*").order("nome"),
      (supabase as any).from("sabor_receita").select("*, materias_primas(nome), embalagens(nome)"),
    ]);
    setSabores(s.data || []);
    setReceitas(r.data || []);
  }

  function getReceita(saborId: string) {
    return receitas.find((r) => r.sabor_id === saborId);
  }

  function openNew() {
    setEditingId(null);
    setNome("");
    setOpen(true);
  }

  function openEdit(s: any) {
    setEditingId(s.id);
    setNome(s.nome);
    setOpen(true);
  }

  async function handleSubmit() {
    if (!nome.trim()) return toast({ title: "Nome obrigatório", variant: "destructive" });
    try {
      if (editingId) {
        const { error } = await (supabase as any).from("sabores").update({ nome: nome.trim() }).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Sabor atualizado!" });
      } else {
        const { error } = await (supabase as any).from("sabores").insert({ nome: nome.trim() });
        if (error) throw error;
        toast({ title: "Sabor cadastrado!" });
      }
      setOpen(false);
      setEditingId(null);
      setNome("");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleToggleStatus(s: any) {
    try {
      await (supabase as any).from("sabores").update({ ativo: !s.ativo }).eq("id", s.id);
      toast({ title: `Sabor ${!s.ativo ? "ativado" : "desativado"}!` });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any).from("sabores").update({ ativo: false }).eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Sabor desativado!" });
      setDeleteId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sabores</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Sabor</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Sabor" : "Novo Sabor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <Button className="w-full" onClick={handleSubmit}>{editingId ? "Salvar" : "Cadastrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar sabor?</AlertDialogTitle>
            <AlertDialogDescription>O sabor será marcado como inativo e não aparecerá nas opções de produção/vendas.</AlertDialogDescription>
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
                <TableHead>Sabor</TableHead>
                <TableHead>Insumo</TableHead>
                <TableHead>g/lote</TableHead>
                <TableHead>Embalagem</TableHead>
                <TableHead>Gelos/Lote</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sabores.map((s) => {
                const r = getReceita(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell>{r?.materias_primas?.nome || "-"}</TableCell>
                    <TableCell>{r?.quantidade_insumo_por_lote || "-"}</TableCell>
                    <TableCell>{r?.embalagens?.nome || "-"}</TableCell>
                    <TableCell>{r?.gelos_por_lote || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={s.ativo ? "default" : "destructive"}
                        className="cursor-pointer"
                        onClick={() => handleToggleStatus(s)}
                      >{s.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
