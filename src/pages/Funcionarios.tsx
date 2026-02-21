import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { insertRow } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", tipo_pagamento: "diaria" as string, valor_pagamento: "" });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data } = await (supabase as any).from("funcionarios").select("*").order("nome");
    setFuncionarios(data || []);
  }

  async function handleSubmit() {
    if (!form.nome) return toast({ title: "Nome obrigatório", variant: "destructive" });
    if (!form.valor_pagamento) return toast({ title: "Valor obrigatório", variant: "destructive" });
    try {
      await insertRow("funcionarios", {
        nome: form.nome,
        tipo_pagamento: form.tipo_pagamento,
        valor_pagamento: Number(form.valor_pagamento),
      });
      toast({ title: "Funcionário cadastrado!" });
      setOpen(false);
      setForm({ nome: "", tipo_pagamento: "diaria", valor_pagamento: "" });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Funcionários</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo Funcionário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
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
              <Button className="w-full" onClick={handleSubmit}>Cadastrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funcionarios.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="capitalize">{f.tipo_pagamento === "diaria" ? "Diária" : "Fixo"}</TableCell>
                  <TableCell>R$ {Number(f.valor_pagamento).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={f.ativo ? "default" : "destructive"}>{f.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {funcionarios.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum funcionário.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
