import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { insertRow } from "@/lib/supabase-helpers";
import { geocodeClienteAddress, hasAddressForGeocoding } from "@/lib/geocoding";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, History, Map, ClipboardCheck } from "lucide-react";
import HistoricoCompras from "@/components/clientes/HistoricoCompras";
import SituacaoCliente from "@/components/clientes/SituacaoCliente";

const emptyForm = {
  nome: "", telefone: "", email: "", endereco: "", bairro: "", cidade: "",
  estado: "RR", cep: "", cpf_cnpj: "", possui_freezer: false,
  freezer_identificacao: "", preco_padrao_personalizado: "", observacoes: "",
  latitude: "", longitude: "",
};

const TAMANHOS_CUBO = ["2kg", "4kg", "5kg"] as const;

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
  const [situacaoCliente, setSituacaoCliente] = useState<{ id: string; nome: string } | null>(null);
  const PAGE_SIZE = 20;

  // Gelo cubo config
  const [vendeGeloCubo, setVendeGeloCubo] = useState(false);
  const [geloCuboPrecos, setGeloCuboPrecos] = useState<Record<string, string>>({ "2kg": "", "4kg": "", "5kg": "" });

  const clientesFiltrados = clientes.filter((c) =>
    c.nome?.toLowerCase().includes(busca.toLowerCase())
  );

  useEffect(() => { loadData(); loadFactoryConfig(); }, [factoryId]);

  async function loadFactoryConfig() {
    if (!factoryId) return;
    const { data } = await (supabase as any).from("factories").select("vende_gelo_cubo").eq("id", factoryId).single();
    setVendeGeloCubo(data?.vende_gelo_cubo || false);
  }

  async function loadData() {
    let q = (supabase as any).from("clientes").select("*").order("nome");
    if (factoryId) q = q.eq("factory_id", factoryId);
    const { data } = await q;
    setClientes(data || []);
  }

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setGeloCuboPrecos({ "2kg": "", "4kg": "", "5kg": "" });
    setOpen(true);
  }

  async function openEdit(c: any) {
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

    // Load client cube prices
    if (vendeGeloCubo) {
      const { data: cuboPrecos } = await (supabase as any)
        .from("cliente_gelo_cubo_preco")
        .select("tamanho, preco")
        .eq("cliente_id", c.id);
      const map: Record<string, string> = { "2kg": "", "4kg": "", "5kg": "" };
      if (cuboPrecos) {
        cuboPrecos.forEach((p: any) => { map[p.tamanho] = String(p.preco).replace(".", ","); });
      }
      setGeloCuboPrecos(map);
    } else {
      setGeloCuboPrecos({ "2kg": "", "4kg": "", "5kg": "" });
    }

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

      let clienteId = editingId;

      if (editingId) {
        const { error } = await (supabase as any).from("clientes").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Cliente atualizado!" });
      } else {
        if (factoryId) payload.factory_id = factoryId;
        const { data: newCliente, error } = await (supabase as any).from("clientes").insert(payload).select("id").single();
        if (error) throw error;
        clienteId = newCliente?.id;
        toast({ title: "Cliente cadastrado!" });
      }

      // Save gelo cubo prices
      if (vendeGeloCubo && clienteId) {
        for (const tam of TAMANHOS_CUBO) {
          const val = geloCuboPrecos[tam]?.replace(",", ".");
          const preco = parseFloat(val);
          if (val && !isNaN(preco) && preco > 0) {
            await (supabase as any)
              .from("cliente_gelo_cubo_preco")
              .upsert(
                { cliente_id: clienteId, factory_id: factoryId, tamanho: tam, preco },
                { onConflict: "cliente_id,tamanho" }
              );
          } else {
            // Remove if empty
            await (supabase as any)
              .from("cliente_gelo_cubo_preco")
              .delete()
              .eq("cliente_id", clienteId)
              .eq("tamanho", tam);
          }
        }
      }

      setOpen(false);
      setForm({ ...emptyForm });
      setEditingId(null);
      setGeloCuboPrecos({ "2kg": "", "4kg": "", "5kg": "" });
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Clientes</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => navigate("/painel/mapa-clientes")}>
            <Map className="mr-1 sm:mr-2 h-4 w-4" /> <span className="hidden sm:inline">Ver no </span>Mapa
          </Button>
          <Button size="sm" className="text-xs sm:text-sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo Cliente</Button>
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

            {/* Gelo em Cubos - Preço por cliente */}
            {vendeGeloCubo && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-base">🧊</span>
                  <div>
                    <h4 className="text-sm font-semibold">Preço Gelo em Cubos</h4>
                    <p className="text-xs text-muted-foreground">Deixe em branco para usar o preço padrão da fábrica</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {TAMANHOS_CUBO.map((tam) => (
                    <div key={tam} className="text-center space-y-1">
                      <Badge variant="outline" className="text-xs">{tam}</Badge>
                      <div className="flex items-center gap-1 justify-center">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          className="h-8 w-20 text-center text-sm font-medium"
                          placeholder="0,00"
                          value={geloCuboPrecos[tam]}
                          onChange={(e) => setGeloCuboPrecos(prev => ({ ...prev, [tam]: e.target.value }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
          {/* Mobile card view */}
          <div className="block sm:hidden space-y-2">
            {clientesFiltrados.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((c) => {
              const dias = diasSemComprar(c.ultima_compra);
              return (
                <div key={c.id} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate max-w-[60%]">{c.nome}</span>
                    <Badge
                      variant={c.status === "ativo" ? "default" : "destructive"}
                      className="cursor-pointer text-[10px]"
                      onClick={() => handleToggleStatus(c)}
                    >{c.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{c.telefone || "Sem telefone"}</span>
                    <span>{dias !== null ? (
                      <span className={dias > 30 ? "text-destructive font-semibold" : ""}>{dias}d sem comprar</span>
                    ) : "Nunca comprou"}</span>
                  </div>
                  {(c.possui_freezer || c.preco_padrao_personalizado) && (
                    <div className="flex items-center gap-2 text-xs">
                      {c.possui_freezer && <Badge variant="outline" className="text-[10px]">❄ {c.freezer_identificacao || "Freezer"}</Badge>}
                      {c.preco_padrao_personalizado && <Badge variant="secondary" className="text-[10px]">R$ {Number(c.preco_padrao_personalizado).toFixed(2)}</Badge>}
                    </div>
                  )}
                  <div className="flex items-center gap-1 pt-1 border-t">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openClienteOnMap(c.id)}><Map className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setHistoricoCliente({ id: c.id, nome: c.nome })}><History className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 ml-auto" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
            {clientesFiltrados.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum cliente encontrado.</p>
            )}
          </div>
          {/* Desktop table view */}
          <div className="hidden sm:block">
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
          </div>
          {clientesFiltrados.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs sm:text-sm text-muted-foreground">
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
