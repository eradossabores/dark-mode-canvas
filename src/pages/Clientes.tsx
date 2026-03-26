import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { insertRow } from "@/lib/supabase-helpers";
import { geocodeClienteAddress, hasAddressForGeocoding } from "@/lib/geocoding";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, History, Map } from "lucide-react";
import HistoricoCompras from "@/components/clientes/HistoricoCompras";

const emptyForm = {
  nome: "", telefone: "", email: "", endereco: "", bairro: "", cidade: "",
  estado: "RR", cep: "", cpf_cnpj: "", possui_freezer: false,
  freezer_identificacao: "", preco_padrao_personalizado: "", observacoes: "",
  latitude: "", longitude: "",
};

export default function Clientes() {
  const navigate = useNavigate();
  const { factoryId } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [page, setPage] = useState(0);
  const [busca, setBusca] = useState("");
  const [historicoCliente, setHistoricoCliente] = useState<{ id: string; nome: string } | null>(null);
  const PAGE_SIZE = 20;

  const clientesFiltrados = clientes.filter((c) =>
    c.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  useEffect(() => { loadData(); }, [factoryId]);

  async function loadData() {
    let q = (supabase as any).from("clientes").select("*").order("nome");
    if (factoryId) q = q.eq("factory_id", factoryId);
    const { data } = await q;
    setClientes(data || []);
  }

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(c: any) {
    setEditingId(c.id);
    setForm({
      nome: c.nome || "", telefone: c.telefone || "", email: c.email || "",
      endereco: c.endereco || "", bairro: c.bairro || "", cidade: c.cidade || "",
      estado: c.estado || "RR", cep: c.cep || "", cpf_cnpj: c.cpf_cnpj || "",
      possui_freezer: c.possui_freezer || false,
      freezer_identificacao: c.freezer_identificacao || "",
      preco_padrao_personalizado: c.preco_padrao_personalizado ? String(c.preco_padrao_personalizado) : "",
      observacoes: c.observacoes || "",
      latitude: c.latitude != null ? String(c.latitude) : "",
      longitude: c.longitude != null ? String(c.longitude) : "",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!form.nome) return toast({ title: "Nome obrigatório", variant: "destructive" });
    try {
      const payload: any = { ...form };
      if (!payload.preco_padrao_personalizado) payload.preco_padrao_personalizado = null;
      else payload.preco_padrao_personalizado = Number(payload.preco_padrao_personalizado);
      if (!payload.cpf_cnpj) payload.cpf_cnpj = null;
      payload.latitude = payload.latitude ? Number(payload.latitude) : null;
      payload.longitude = payload.longitude ? Number(payload.longitude) : null;

      // Sempre geocodificar quando tem endereço (novo ou editado)
      if (hasAddressForGeocoding(payload)) {
        const coords = await geocodeClienteAddress(payload);
        if (coords) {
          payload.latitude = coords.lat;
          payload.longitude = coords.lng;
          toast({ title: "📍 Localização encontrada automaticamente!" });
        } else if (!payload.latitude) {
          toast({ title: "⚠️ Endereço não encontrado no mapa", description: "Você pode posicionar manualmente no Mapa de Clientes", variant: "destructive" });
        }
      }

      if (editingId) {
        const { error } = await (supabase as any).from("clientes").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Cliente atualizado!" });
      } else {
        await insertRow("clientes", payload);
        toast({ title: "Cliente cadastrado!" });
      }
      setOpen(false);
      setForm({ ...emptyForm });
      setEditingId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleDeactivate() {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any).from("clientes").update({ status: "inativo" }).eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Cliente desativado!" });
      setDeleteId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleDeletePermanent() {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any).from("clientes").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Cliente apagado permanentemente!" });
      setDeleteId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleToggleStatus(c: any) {
    const newStatus = c.status === "ativo" ? "inativo" : "ativo";
    try {
      await (supabase as any).from("clientes").update({ status: newStatus }).eq("id", c.id);
      toast({ title: `Cliente ${newStatus === "ativo" ? "ativado" : "desativado"}!` });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  function diasSemComprar(ultima: string | null) {
    if (!ultima) return null;
    return Math.floor((Date.now() - new Date(ultima).getTime()) / 86400000);
  }

  function openClienteOnMap(clienteId: string) {
    navigate(`/painel/mapa-clientes?cliente=${clienteId}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/painel/mapa-clientes")}>
            <Map className="mr-2 h-4 w-4" /> Ver no mapa
          </Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
        </div>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Buscar cliente pelo nome..."
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPage(0); }}
          className="max-w-sm"
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>CPF/CNPJ</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></div>
            <div><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Bairro</Label><Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} /></div>
              <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} /></div>
            </div>
            <div><Label>CEP</Label><Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} /></div>
            <div className="flex items-center gap-3">
              <Switch checked={form.possui_freezer} onCheckedChange={(v) => setForm({ ...form, possui_freezer: v })} />
              <Label>Possui freezer em comodato</Label>
            </div>
            {form.possui_freezer && (
              <div><Label>ID do Freezer</Label><Input value={form.freezer_identificacao} onChange={(e) => setForm({ ...form, freezer_identificacao: e.target.value })} /></div>
            )}
            <div><Label>Preço Padrão Personalizado (R$)</Label><Input type="number" step="0.01" value={form.preco_padrao_personalizado} onChange={(e) => setForm({ ...form, preco_padrao_personalizado: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Latitude</Label><Input type="number" step="0.0001" placeholder="Ex: 2.8195" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></div>
              <div><Label>Longitude</Label><Input type="number" step="0.0001" placeholder="Ex: -60.6714" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
            <Button className="w-full" onClick={handleSubmit}>{editingId ? "Salvar Alterações" : "Cadastrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O que deseja fazer com este cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>Desativar:</strong> O cliente será marcado como inativo mas seus dados serão mantidos.<br />
              <strong>Apagar:</strong> O cliente será removido permanentemente do sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:justify-between">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <div className="flex gap-2">
              <AlertDialogAction onClick={handleDeactivate} className="bg-amber-600 hover:bg-amber-700 text-white">Desativar</AlertDialogAction>
              <AlertDialogAction onClick={handleDeletePermanent} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Freezer</TableHead>
                <TableHead>Preço Pers.</TableHead>
                <TableHead>Dias s/ comprar</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesFiltrados.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((c) => {
                const dias = diasSemComprar(c.ultima_compra);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.telefone || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={c.status === "ativo" ? "default" : "destructive"}
                        className="cursor-pointer"
                        onClick={() => handleToggleStatus(c)}
                      >{c.status}</Badge>
                    </TableCell>
                    <TableCell>{c.possui_freezer ? c.freezer_identificacao || "Sim" : "Não"}</TableCell>
                    <TableCell>{c.preco_padrao_personalizado ? `R$ ${Number(c.preco_padrao_personalizado).toFixed(2)}` : "-"}</TableCell>
                    <TableCell>
                      {dias !== null ? (
                        <span className={dias > 30 ? "text-destructive font-semibold" : ""}>{dias}d</span>
                      ) : "Nunca comprou"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openClienteOnMap(c.id)}>
                          <Map className="mr-1 h-4 w-4" /> Ver no mapa
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setHistoricoCliente({ id: c.id, nome: c.nome })} title="Histórico"><History className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)} title="Apagar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {clientesFiltrados.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {clientesFiltrados.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, clientesFiltrados.length)} de {clientesFiltrados.length}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= clientesFiltrados.length} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <HistoricoCompras
        clienteId={historicoCliente?.id || null}
        clienteNome={historicoCliente?.nome || ""}
        open={!!historicoCliente}
        onOpenChange={(v) => !v && setHistoricoCliente(null)}
      />
    </div>
  );
}
