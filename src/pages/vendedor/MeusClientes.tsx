import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { geocodeClienteAddress, hasAddressForGeocoding } from "@/lib/geocoding";
 import { Plus, Users, Pencil, Trash2 } from "lucide-react";
 import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
   async function handleDelete(id: string) {
     try {
       const { error } = await (supabase as any)
         .from("clientes")
         .delete()
         .eq("id", id);
       
       if (error) {
         if (error.code === "23503") {
           throw new Error("Não é possível excluir este cliente pois existem vendas ou pedidos vinculados a ele.");
         }
         throw error;
       }
       
       toast({ title: "Cliente excluído com sucesso" });
       load();
     } catch (e: any) {
       toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
     }
   }
 

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  bairro: string | null;
  endereco: string | null;
  status: string;
  ultima_compra: string | null;
}

const TAMANHOS_CUBO = ["2kg", "3kg", "4kg", "5kg"] as const;

const emptyForm = {
  nome: "", telefone: "", email: "", endereco: "", bairro: "", cidade: "",
  estado: "RR", cep: "", cpf_cnpj: "", possui_freezer: false,
  freezer_identificacao: "", preco_padrao_personalizado: "", observacoes: "",
};

export default function MeusClientes() {
  const { user, factoryId } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [vendeGeloCubo, setVendeGeloCubo] = useState(false);
  const [geloCuboPrecos, setGeloCuboPrecos] = useState<Record<string, string>>({ "2kg": "", "3kg": "", "4kg": "", "5kg": "" });

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

  async function loadFactoryConfig() {
    if (!factoryId) return;
    const { data } = await (supabase as any).from("factories").select("vende_gelo_cubo").eq("id", factoryId).single();
    setVendeGeloCubo(data?.vende_gelo_cubo || false);
  }

  useEffect(() => { load(); loadFactoryConfig(); }, [factoryId]);

  function reset() {
    setEditing(null);
    setForm({ ...emptyForm });
    setGeloCuboPrecos({ "2kg": "", "3kg": "", "4kg": "", "5kg": "" });
  }

  async function openEdit(c: any) {
    setEditing(c);
    // Buscar dados completos
    const { data: full } = await (supabase as any).from("clientes").select("*").eq("id", c.id).maybeSingle();
    const src = full || c;
    setForm({
      nome: src.nome || "", telefone: src.telefone || "", email: src.email || "",
      endereco: src.endereco || "", bairro: src.bairro || "", cidade: src.cidade || "",
      estado: src.estado || "RR", cep: src.cep || "", cpf_cnpj: src.cpf_cnpj || "",
      possui_freezer: src.possui_freezer || false,
      freezer_identificacao: src.freezer_identificacao || "",
      preco_padrao_personalizado: src.preco_padrao_personalizado ? String(src.preco_padrao_personalizado) : "",
      observacoes: src.observacoes || "",
    });
    if (vendeGeloCubo) {
      const { data: cuboPrecos } = await (supabase as any)
        .from("cliente_gelo_cubo_preco")
        .select("tamanho, preco")
        .eq("cliente_id", c.id);
      const map: Record<string, string> = { "2kg": "", "3kg": "", "4kg": "", "5kg": "" };
      cuboPrecos?.forEach((p: any) => { map[p.tamanho] = String(p.preco).replace(".", ","); });
      setGeloCuboPrecos(map);
    }
    setOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      return;
    }
    try {
      const payload: any = { ...form };
      if (!payload.preco_padrao_personalizado) payload.preco_padrao_personalizado = null;
      else payload.preco_padrao_personalizado = Number(payload.preco_padrao_personalizado);
      if (!payload.cpf_cnpj) payload.cpf_cnpj = null;

      // Geocodificação automática
      if (hasAddressForGeocoding(payload)) {
        const coords = await geocodeClienteAddress(payload);
        if (coords) {
          payload.latitude = coords.lat;
          payload.longitude = coords.lng;
        }
      }

      let clienteId = editing?.id ?? null;
      // Sempre obtém o factory_id autoritativo do servidor (mesmo que o RLS espera)
      let fid: string | null = factoryId ?? null;
      if (user) {
        const { data: rpcFid } = await (supabase as any).rpc("get_user_factory_id", { _user_id: user.id });
        if (rpcFid) fid = rpcFid as string;
      }

      if (editing) {
        const { error } = await (supabase as any)
          .from("clientes")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Cliente atualizado" });
      } else {
        if (!fid) {
          toast({ title: "Fábrica não identificada", description: "Faça login novamente.", variant: "destructive" });
          return;
        }
        payload.factory_id = fid;
        const { data, error } = await (supabase as any)
          .from("clientes")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        clienteId = data?.id;
        // Vínculo automático já é criado pelo trigger no Postgres,
        // mas garantimos aqui também (idempotente).
        if (user && clienteId) {
          await (supabase as any).from("cliente_vendedor").upsert({
            cliente_id: clienteId,
            vendedor_user_id: user.id,
            factory_id: fid,
          }, { onConflict: "cliente_id,vendedor_user_id" });
        }
        toast({ title: "Cliente cadastrado" });
      }

      // Salvar preços de gelo em cubo
      if (vendeGeloCubo && clienteId) {
        for (const tam of TAMANHOS_CUBO) {
          const val = geloCuboPrecos[tam]?.replace(",", ".");
          const preco = parseFloat(val);
          if (val && !isNaN(preco) && preco > 0) {
            await (supabase as any)
              .from("cliente_gelo_cubo_preco")
              .upsert(
                { cliente_id: clienteId, factory_id: fid, tamanho: tam, preco },
                { onConflict: "cliente_id,tamanho" }
              );
          } else {
            await (supabase as any)
              .from("cliente_gelo_cubo_preco")
              .delete()
              .eq("cliente_id", clienteId)
              .eq("tamanho", tam);
          }
        }
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
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

              {vendeGeloCubo && (
                <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧊</span>
                    <div>
                      <h4 className="text-sm font-semibold">Preço Gelo em Cubos</h4>
                      <p className="text-xs text-muted-foreground">Deixe em branco para usar o preço padrão da fábrica</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
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

              <div><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
              <Button className="w-full" onClick={save}>{editing ? "Salvar Alterações" : "Cadastrar"}</Button>
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
                       <div className="flex justify-end gap-2">
                         <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                           <Pencil className="h-4 w-4" />
                         </Button>
                         <AlertDialog>
                           <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </AlertDialogTrigger>
                           <AlertDialogContent>
                             <AlertDialogHeader>
                               <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                               <AlertDialogDescription>
                                 Esta ação não pode ser desfeita. O cliente e todos os seus dados de contato serão removidos permanentemente.
                               </AlertDialogDescription>
                             </AlertDialogHeader>
                             <AlertDialogFooter>
                               <AlertDialogCancel>Cancelar</AlertDialogCancel>
                               <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                 Excluir
                               </AlertDialogAction>
                             </AlertDialogFooter>
                           </AlertDialogContent>
                         </AlertDialog>
                       </div>
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