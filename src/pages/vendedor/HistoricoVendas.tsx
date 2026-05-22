import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, DollarSign, Package, Search, Eye, MessageCircle, Pencil, Trash2, Sparkles, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import ReciboVenda from "@/components/vendas/ReciboVenda";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const FORMAS_PAGAMENTO = [
  { value: "amostra", label: "Amostra (Grátis)" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "parcelado", label: "Parcelado" },
  { value: "fiado", label: "A Prazo" },
];

export default function HistoricoVendas() {
  const { user, factoryId } = useAuth();
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [reciboOpen, setReciboOpen] = useState(false);
  const [reciboData, setReciboData] = useState<any>(null);
  const [editVenda, setEditVenda] = useState<any>(null);
  const [editStatus, setEditStatus] = useState("pendente");
  const [editForma, setEditForma] = useState("dinheiro");
  const [editObs, setEditObs] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [comissoesMap, setComissoesMap] = useState<Record<string, number>>({});
  const [totalComissao, setTotalComissao] = useState(0);
  const [periodoComissao, setPeriodoComissao] = useState<string>("mes");

  // Iury's special commission rule (first sale = full / repeat = half)
  const IURY_USER_ID = "c311e314-e569-4303-96f7-e26bfe17a5f1";
  const isIury = user?.id === IURY_USER_ID;

  async function load() {
    if (!user || !factoryId) return;
    setLoading(true);

    // Get vendor's clients + AVULSO and AMOSTRAS
    const [{ data: vinc }, { data: extras }] = await Promise.all([
      (supabase as any).from("cliente_vendedor").select("cliente_id").eq("vendedor_user_id", user.id),
      (supabase as any).from("clientes").select("id").in("nome", ["AVULSO", "AMOSTRAS"]).eq("factory_id", factoryId)
    ]);

    const clienteIds = [
      ...(vinc || []).map((v: any) => v.cliente_id),
      ...(extras || []).map((c: any) => c.id)
    ];

    if (clienteIds.length === 0) {
      setVendas([]);
      setLoading(false);
      return;
    }

    const { data } = await (supabase as any)
      .from("vendas")
      .select("id, cliente_id, numero_pedido, created_at, total, status, forma_pagamento, observacoes, valor_frete, frete_pago_por, valor_pago, clientes(nome, telefone, endereco, bairro, cidade), venda_itens(quantidade, preco_unitario, subtotal, sabores(nome)), abatimentos_historico(valor)")
      .in("cliente_id", clienteIds)
      .eq("factory_id", factoryId)
      .order("created_at", { ascending: false })
      .limit(200);

    setVendas(data || []);
    setLoading(false);

    // Carregar comissões do vendedor
    const { data: coms } = await (supabase as any)
      .from("comissoes_vendas")
      .select("venda_id, valor_comissao")
      .eq("vendedor_user_id", user.id)
      .eq("factory_id", factoryId);
    const map: Record<string, number> = {};
    let total = 0;
    (coms || []).forEach((c: any) => {
      map[c.venda_id] = Number(c.valor_comissao || 0);
      total += Number(c.valor_comissao || 0);
    });
    setComissoesMap(map);
    setTotalComissao(total);
  }

  useEffect(() => {
    load();
  }, [user, factoryId]);

  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      const matchSearch = !search || v.clientes?.nome?.toLowerCase().includes(search.toLowerCase()) || String(v.numero_pedido || "").includes(search);
      const matchStatus = statusFilter === "todos" || v.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [vendas, search, statusFilter]);

  // Mapa: venda_id -> "primeira" | "reposicao" (apenas Yuri)
  const tipoVendaMap = useMemo(() => {
    const map: Record<string, "primeira" | "reposicao"> = {};
    if (!isYuri) return map;
    const porCliente: Record<string, any[]> = {};
    vendas.forEach((v) => {
      const cid = v.clientes?.nome ? `${v.clientes?.nome}` : v.id;
      // Use cliente_id real via lookup: vendas têm clientes(nome) só; melhor agrupar por v.cliente_id se existir
      const key = (v as any).cliente_id || cid;
      (porCliente[key] = porCliente[key] || []).push(v);
    });
    Object.values(porCliente).forEach((arr) => {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      arr.forEach((v, idx) => {
        map[v.id] = idx === 0 ? "primeira" : "reposicao";
      });
    });
    return map;
  }, [vendas, isYuri]);

  const yuriStats = useMemo(() => {
    if (!isYuri) return null;
    let primeiras = 0, reposicoes = 0, comInt = 0, comRed = 0;
    filtered.forEach((v) => {
      const t = tipoVendaMap[v.id];
      const com = comissoesMap[v.id] || 0;
      if (t === "primeira") { primeiras++; comInt += com; }
      else if (t === "reposicao") { reposicoes++; comRed += com; }
    });
    return { primeiras, reposicoes, comInt, comRed };
  }, [filtered, tipoVendaMap, comissoesMap, isYuri]);

  const totals = useMemo(() => {
    const now = new Date();
    const dias = periodoComissao === "semana" ? 7 : periodoComissao === "quinzena" ? 15 : periodoComissao === "mes" ? 30 : null;
    const limite = dias ? new Date(now.getTime() - dias * 86400000) : null;
    const comissao = filtered.reduce((s, v) => {
      if (limite && new Date(v.created_at) < limite) return s;
      return s + (comissoesMap[v.id] || 0);
    }, 0);
    const unidades = filtered.reduce((s, v) => s + (v.venda_itens || []).reduce((x: number, i: any) => x + Number(i.quantidade || 0), 0), 0);
    return { comissao, unidades, count: filtered.length };
  }, [filtered, comissoesMap, periodoComissao]);

  function getStatusBadge(status: string) {
    const colors: Record<string, string> = {
      pago: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
      paga: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
      pendente: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
      
      cancelada: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  }

  function handleView(v: any) {
    const enderecoCompleto = [v.clientes?.endereco, v.clientes?.bairro, v.clientes?.cidade].filter(Boolean).join(", ") || undefined;
    setReciboData({
      cliente_nome: v.clientes?.nome || "?",
      endereco: enderecoCompleto,
      data: format(new Date(v.created_at), "dd/MM/yyyy", { locale: ptBR }),
      forma_pagamento: FORMAS_PAGAMENTO.find(f => f.value === v.forma_pagamento)?.label || v.forma_pagamento || "-",
      numero_pedido: v.numero_pedido,
      total: Number(v.total || 0),
      observacoes: v.observacoes || undefined,
      telefone: v.clientes?.telefone,
      status: v.status,
      valor_pago: Number(v.valor_pago || 0),
      valor_frete: Number(v.valor_frete || 0),
      frete_pago_por: v.frete_pago_por,
      itens: (v.venda_itens || []).map((it: any) => ({
        sabor_nome: it.sabores?.nome || "?",
        quantidade: it.quantidade,
        preco_unitario: Number(it.preco_unitario || 0),
        subtotal: Number(it.subtotal || 0),
      })),
    });
    setReciboOpen(true);
  }

  function handleWhatsApp(v: any) {
    const tel = (v.clientes?.telefone || "").replace(/\D/g, "");
    const itens = (v.venda_itens || []).map((i: any) => `• ${i.quantidade}x ${i.sabores?.nome || ""}`).join("\n");
    const msg = `*Pedido #${v.numero_pedido || "-"}*\nCliente: ${v.clientes?.nome || "-"}\nData: ${format(new Date(v.created_at), "dd/MM/yyyy", { locale: ptBR })}\n\n${itens}\n\n*Total: R$ ${Number(v.total || 0).toFixed(2)}*\nStatus: ${v.status || "-"}`;
    const full = tel.startsWith("55") ? tel : `55${tel}`;
    const url = tel ? `https://wa.me/${full}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  function openEdit(v: any) {
    setEditVenda(v);
    setEditStatus(v.status || "pendente");
    setEditForma(v.forma_pagamento || "dinheiro");
    setEditObs(v.observacoes || "");
  }

  async function saveEdit() {
    if (!editVenda) return;
    const { error } = await (supabase as any).from("vendas")
      .update({ status: editStatus, forma_pagamento: editForma, observacoes: editObs })
      .eq("id", editVenda.id);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Venda atualizada" });
    setEditVenda(null);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const { error } = await (supabase as any).from("vendas").delete().eq("id", deleteId);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Venda excluída" });
    setDeleteId(null);
    load();
  }

  return (
    <div className="space-y-6 p-4 md:p-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <History className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Histórico de Vendas</h1>
          <p className="text-sm text-muted-foreground">Suas vendas registradas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Total de Pedidos</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totals.count}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Unidades Vendidas</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totals.unidades}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Comissão</CardTitle>
              <Select value={periodoComissao} onValueChange={setPeriodoComissao}>
                <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">7 dias</SelectItem>
                  <SelectItem value="quinzena">15 dias</SelectItem>
                  <SelectItem value="mes">30 dias</SelectItem>
                  <SelectItem value="todos">Tudo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">R$ {totals.comissao.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Apenas vendas pagas geram comissão</p>
          </CardContent>
        </Card>
      </div>

      {isYuri && yuriStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-primary/30">
            <CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-amber-500" /> Primeiras Compras</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{yuriStats.primeiras}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5 text-blue-500" /> Reposições</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{yuriStats.reposicoes}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs">Comissão Integral</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold text-green-600">R$ {yuriStats.comInt.toFixed(2)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs">Comissão Reduzida (50%)</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold text-blue-600">R$ {yuriStats.comRed.toFixed(2)}</p></CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <CardTitle>Vendas</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente ou nº pedido..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-full md:w-64" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma venda encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Unid.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Pagto</TableHead>
                    <TableHead>Status</TableHead>
                    {isYuri && <TableHead>Tipo</TableHead>}
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => {
                    const unid = (v.venda_itens || []).reduce((s: number, i: any) => s + Number(i.quantidade || 0), 0);
                    const itens = (v.venda_itens || []).map((i: any) => `${i.quantidade}x ${i.sabores?.nome || ""}`).join(", ");
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">#{v.numero_pedido || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{format(new Date(v.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="font-medium">{v.clientes?.nome || "-"}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={itens}>{itens}</TableCell>
                        <TableCell className="text-right">{unid}</TableCell>
                        <TableCell className="text-right font-semibold">R$ {Number(v.total || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs capitalize">{v.forma_pagamento || "-"}</TableCell>
                        <TableCell><Badge variant="outline" className={getStatusBadge(v.status)}>{v.status || "-"}</Badge></TableCell>
                        {isYuri && (
                          <TableCell>
                            {tipoVendaMap[v.id] === "primeira" ? (
                              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1"><Sparkles className="h-3 w-3" /> Primeira</Badge>
                            ) : tipoVendaMap[v.id] === "reposicao" ? (
                              <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1"><Repeat className="h-3 w-3" /> Reposição</Badge>
                            ) : null}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Visualizar comanda" onClick={() => handleView(v)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700" title="Enviar pelo WhatsApp" onClick={() => handleWhatsApp(v)}>
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => openEdit(v)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir" onClick={() => setDeleteId(v.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ReciboVenda open={reciboOpen} onOpenChange={setReciboOpen} data={reciboData} />

      <Dialog open={!!editVenda} onOpenChange={(o) => !o && setEditVenda(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Venda #{editVenda?.numero_pedido || "-"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={editForma} onValueChange={setEditForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={editObs} onChange={(e) => setEditObs(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVenda(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e o estoque será revertido automaticamente. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
