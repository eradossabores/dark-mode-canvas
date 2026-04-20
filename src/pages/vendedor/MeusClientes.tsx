import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Users, Pencil } from "lucide-react";

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  bairro: string | null;
  endereco: string | null;
  status: string;
  ultima_compra: string | null;
}

export default function MeusClientes() {
  const { user, factoryId } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bairro, setBairro] = useState("");
  const [endereco, setEndereco] = useState("");

  async function load() {
    setLoading(true);
    // RLS já filtra: vendedor só vê os próprios via cliente_vendedor
    const { data, error } = await (supabase as any)
      .from("clientes")
      .select("id, nome, telefone, bairro, endereco, status, ultima_compra")
      .order("nome");
    if (error) {
      toast({ title: "Erro ao carregar clientes", description: error.message, variant: "destructive" });
    } else {
      setClientes(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function reset() {
    setEditing(null);
    setNome(""); setTelefone(""); setBairro(""); setEndereco("");
  }

  function openEdit(c: Cliente) {
    setEditing(c);
    setNome(c.nome);
    setTelefone(c.telefone || "");
    setBairro(c.bairro || "");
    setEndereco(c.endereco || "");
    setOpen(true);
  }

  async function save() {
    if (!nome.trim()) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      return;
    }
    try {
      if (editing) {
        const { error } = await (supabase as any)
          .from("clientes")
          .update({ nome, telefone, bairro, endereco })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Cliente atualizado" });
      } else {
        const { data, error } = await (supabase as any)
          .from("clientes")
          .insert({ nome, telefone, bairro, endereco, factory_id: factoryId, estado: "RR" })
          .select()
          .single();
        if (error) throw error;
        // Vínculo automático já é criado pelo trigger no Postgres,
        // mas garantimos aqui também (idempotente).
        if (user && data?.id) {
          await (supabase as any).from("cliente_vendedor").upsert({
            cliente_id: data.id,
            vendedor_user_id: user.id,
            factory_id: factoryId,
          }, { onConflict: "cliente_id,vendedor_user_id" });
        }
        toast({ title: "Cliente cadastrado" });
      }
      setOpen(false);
      reset();
      load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Meus Clientes</h1>
          <p className="text-sm text-muted-foreground">Apenas os clientes cadastrados por você.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Cadastrar cliente"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome*</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <div><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
              <div><Label>Bairro</Label><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
              <div><Label>Endereço</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
              <Button className="w-full" onClick={save}>{editing ? "Salvar alterações" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>{clientes.length} cliente(s)</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : clientes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Você ainda não cadastrou nenhum cliente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.telefone || "—"}</TableCell>
                    <TableCell>{c.bairro || "—"}</TableCell>
                    <TableCell><Badge variant={c.status === "ativo" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}