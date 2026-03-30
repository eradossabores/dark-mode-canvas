import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Truck, Package, ShoppingCart, BarChart3, Trash2, Edit, ChevronDown, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Fornecedor {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
  tipo: string;
}

interface Compra {
  id: string;
  tipo: string;
  item_nome: string;
  fornecedor_id: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  tem_frete: boolean;
  valor_frete: number;
  custo_total_com_frete: number;
  custo_unitario_com_frete: number;
  observacoes: string | null;
  created_at: string;
}

export default function Compras() {
  const { factoryId, user } = useAuth();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!factoryId) return;
    setLoading(true);
    const [fRes, cRes] = await Promise.all([
      (supabase as any).from("fornecedores").select("*").eq("factory_id", factoryId).order("nome"),
      (supabase as any).from("compras").select("*").eq("factory_id", factoryId).order("created_at", { ascending: false }),
    ]);
    if (fRes.data) setFornecedores(fRes.data);
    if (cRes.data) setCompras(cRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [factoryId]);

  const fornecedorMap = useMemo(() => {
    const m: Record<string, string> = {};
    fornecedores.forEach(f => { m[f.id] = f.nome; });
    return m;
  }, [fornecedores]);

  const resumo = useMemo(() => {
    let totalInsumos = 0, totalEmbalagens = 0, totalGeral = 0;
    compras.forEach(c => {
      const custo = Number(c.custo_total_com_frete);
      if (c.tipo === "insumo") totalInsumos += custo;
      else totalEmbalagens += custo;
      totalGeral += custo;
    });
    return { totalInsumos, totalEmbalagens, totalGeral };
  }, [compras]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <ShoppingCart className="h-6 w-6" /> Setor de Compras
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground font-medium">💧 Total Insumos</p>
            <p className="text-xl font-bold text-primary">R$ {resumo.totalInsumos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="bg-secondary/50 border-secondary/30">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground font-medium">📦 Total Embalagens</p>
            <p className="text-xl font-bold">R$ {resumo.totalEmbalagens.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="bg-accent/30 border-accent/20">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground font-medium">🧾 Total Geral</p>
            <p className="text-xl font-bold">R$ {resumo.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="compras">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="compras" className="gap-2"><Package className="h-4 w-4" /> Compras</TabsTrigger>
          <TabsTrigger value="fornecedores" className="gap-2"><Truck className="h-4 w-4" /> Fornecedores</TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2"><BarChart3 className="h-4 w-4" /> Relatórios</TabsTrigger>
        </TabsList>
        <TabsContent value="compras">
          <ComprasTab
            factoryId={factoryId}
            fornecedores={fornecedores}
            fornecedorMap={fornecedorMap}
            compras={compras}
            operador={user?.email || ""}
            onRefresh={fetchData}
          />
        </TabsContent>
        <TabsContent value="fornecedores">
          <FornecedoresTab factoryId={factoryId} fornecedores={fornecedores} onRefresh={fetchData} />
        </TabsContent>
        <TabsContent value="relatorios">
          <RelatoriosTab compras={compras} fornecedorMap={fornecedorMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── COMPRAS TAB ───
interface ItemQty { nome: string; quantidade: number; }

function ComprasTab({ factoryId, fornecedores, fornecedorMap, compras, operador, onRefresh }: {
  factoryId: string | null; fornecedores: Fornecedor[]; fornecedorMap: Record<string, string>;
  compras: Compra[]; operador: string; onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("insumo");
  const [fornecedorId, setFornecedorId] = useState("");
  const [valorTotalInput, setValorTotalInput] = useState("");
  const [temFrete, setTemFrete] = useState(false);
  const [tipoFrete, setTipoFrete] = useState("sedex");
  const [valorFrete, setValorFrete] = useState("");
  const [obs, setObs] = useState("");
  const [dataCompra, setDataCompra] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItemNome, setEditItemNome] = useState("");
  const [editQuantidade, setEditQuantidade] = useState("");

  // Items with quantities
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [customItems, setCustomItems] = useState<ItemQty[]>([]);
  const [newCustomItem, setNewCustomItem] = useState("");

  // All items from DB
  const [allInsumos, setAllInsumos] = useState<string[]>([]);
  const [allEmbalagens, setAllEmbalagens] = useState<string[]>([]);
  const [topInsumos, setTopInsumos] = useState<string[]>([]);
  const [topEmbalagens, setTopEmbalagens] = useState<string[]>([]);

  useEffect(() => {
    if (!factoryId) return;
    const fetchItems = async () => {
      const { data: vendaItens } = await (supabase as any)
        .from("venda_itens").select("sabor_id, quantidade").eq("factory_id", factoryId);
      const saborSales: Record<string, number> = {};
      (vendaItens || []).forEach((vi: any) => {
        saborSales[vi.sabor_id] = (saborSales[vi.sabor_id] || 0) + vi.quantidade;
      });

      const { data: mps } = await (supabase as any)
        .from("materias_primas").select("id, nome").eq("factory_id", factoryId).order("nome");
      const { data: embs } = await (supabase as any)
        .from("embalagens").select("id, nome").eq("factory_id", factoryId).order("nome");
      const { data: receitas } = await (supabase as any)
        .from("sabor_receita").select("sabor_id, materia_prima_id, embalagem_id").eq("factory_id", factoryId);

      const insumoSales: Record<string, number> = {};
      const embSales: Record<string, number> = {};
      (receitas || []).forEach((r: any) => {
        const sales = saborSales[r.sabor_id] || 0;
        insumoSales[r.materia_prima_id] = (insumoSales[r.materia_prima_id] || 0) + sales;
        embSales[r.embalagem_id] = (embSales[r.embalagem_id] || 0) + sales;
      });

      const mpNames = (mps || []).map((m: any) => m.nome as string);
      const embNames = (embs || []).map((e: any) => e.nome as string);
      setAllInsumos(mpNames);
      setAllEmbalagens(embNames);

      const mpMap: Record<string, string> = {};
      (mps || []).forEach((m: any) => { mpMap[m.id] = m.nome; });
      const sortedInsumos = Object.entries(insumoSales)
        .sort(([, a], [, b]) => b - a).slice(0, 5).map(([id]) => mpMap[id]).filter(Boolean);
      setTopInsumos(sortedInsumos.length > 0 ? sortedInsumos : mpNames.slice(0, 5));

      const embMap: Record<string, string> = {};
      (embs || []).forEach((e: any) => { embMap[e.id] = e.nome; });
      const sortedEmbs = Object.entries(embSales)
        .sort(([, a], [, b]) => b - a).slice(0, 5).map(([id]) => embMap[id]).filter(Boolean);
      setTopEmbalagens(sortedEmbs.length > 0 ? sortedEmbs : embNames.slice(0, 5));
    };
    fetchItems();
  }, [factoryId]);

  const allItems = tipo === "insumo" ? allInsumos : allEmbalagens;
  const topItems = tipo === "insumo" ? topInsumos : topEmbalagens;
  const otherItems = allItems.filter(i => !topItems.includes(i));

  // Sort: top items first, then others
  const orderedItems = [...topItems, ...otherItems];

  const totalQty = Object.values(itemQuantities).reduce((s, v) => s + v, 0)
    + customItems.reduce((s, ci) => s + ci.quantidade, 0);
  const valorTotal = parseFloat(valorTotalInput) || 0;
  const unitPrice = totalQty > 0 ? valorTotal / totalQty : 0;
  const freight = temFrete ? (parseFloat(valorFrete) || 0) : 0;
  const custoTotalComFrete = valorTotal + freight;
  const custoUnitarioComFrete = totalQty > 0 ? custoTotalComFrete / totalQty : 0;

  const filledItems = [
    ...orderedItems.filter(n => (itemQuantities[n] || 0) > 0).map(n => ({ nome: n, quantidade: itemQuantities[n] })),
    ...customItems.filter(ci => ci.quantidade > 0),
  ];

  const handleSave = async () => {
    if (!factoryId || filledItems.length === 0 || valorTotal <= 0) {
      toast.error("Preencha ao menos um item com quantidade e o valor total");
      return;
    }
    setSaving(true);
    // Save one record per item with proportional cost
    const rows = filledItems.map(item => {
      const proportion = item.quantidade / totalQty;
      return {
        tipo, item_nome: item.nome, fornecedor_id: fornecedorId || null,
        quantidade: item.quantidade,
        valor_unitario: unitPrice,
        valor_total: +(valorTotal * proportion).toFixed(2),
        tem_frete: temFrete, valor_frete: +(freight * proportion).toFixed(2),
        custo_total_com_frete: +(custoTotalComFrete * proportion).toFixed(2),
        custo_unitario_com_frete: +custoUnitarioComFrete.toFixed(2),
        observacoes: obs || null, factory_id: factoryId,
        created_at: new Date(dataCompra + "T12:00:00").toISOString(),
      };
    });
    const { error } = await (supabase as any).from("compras").insert(rows);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar compra"); return; }
    toast.success(`${rows.length} ite${rows.length > 1 ? "ns registrados" : "m registrado"}!`);
    setOpen(false);
    resetForm();
    onRefresh();
  };

  const handleEditSave = async () => {
    if (!editingId || !editItemNome.trim() || !editQuantidade || valorTotal <= 0) {
      toast.error("Preencha todos os campos"); return;
    }
    const qty = parseFloat(editQuantidade) || 0;
    const up = qty > 0 ? valorTotal / qty : 0;
    const ctf = valorTotal + freight;
    const cuf = qty > 0 ? ctf / qty : 0;
    setSaving(true);
    const { error } = await (supabase as any).from("compras").update({
      tipo, item_nome: editItemNome.trim(), fornecedor_id: fornecedorId || null,
      quantidade: qty, valor_unitario: up, valor_total: valorTotal,
      tem_frete: temFrete, valor_frete: freight,
      custo_total_com_frete: ctf, custo_unitario_com_frete: cuf,
      observacoes: obs || null,
      created_at: new Date(dataCompra + "T12:00:00").toISOString(),
    }).eq("id", editingId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Compra atualizada!");
    setOpen(false); resetForm(); onRefresh();
  };

  const handleEdit = (c: Compra) => {
    setEditingId(c.id);
    setTipo(c.tipo);
    setEditItemNome(c.item_nome);
    setEditQuantidade(String(c.quantidade));
    setFornecedorId(c.fornecedor_id || "");
    setValorTotalInput(String(c.valor_total));
    setTemFrete(c.tem_frete);
    setValorFrete(String(c.valor_frete));
    setObs(c.observacoes || "");
    setDataCompra(format(new Date(c.created_at), "yyyy-MM-dd"));
    setOpen(true);
  };

  const resetForm = () => {
    setTipo("insumo"); setFornecedorId(""); setValorTotalInput("");
    setTemFrete(false); setValorFrete(""); setObs("");
    setDataCompra(format(new Date(), "yyyy-MM-dd"));
    setItemQuantities({}); setCustomItems([]); setNewCustomItem("");
    setEditingId(null); setEditItemNome(""); setEditQuantidade("");
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("compras").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Compra excluída");
    onRefresh();
  };

  const addCustomItem = () => {
    if (!newCustomItem.trim()) return;
    setCustomItems(prev => [...prev, { nome: newCustomItem.trim(), quantidade: 0 }]);
    setNewCustomItem("");
  };

  const filtered = filterTipo === "todos" ? compras : compras.filter(c => c.tipo === filterTipo);

  // Group compras by created_at (same timestamp = same comanda)
  const grouped = useMemo(() => {
    const groups: Record<string, Compra[]> = {};
    filtered.forEach(c => {
      const key = c.created_at;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const handleDeleteGroup = async (items: Compra[]) => {
    const ids = items.map(c => c.id);
    const { error } = await (supabase as any).from("compras").delete().in("id", ids);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Comanda excluída");
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nova Compra</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar Compra" : "Registrar Compra"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={(v) => { setTipo(v); setItemQuantities({}); setCustomItems([]); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insumo">Insumo</SelectItem>
                      <SelectItem value="embalagem">Embalagem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data da Compra</Label>
                  <Input type="date" value={dataCompra} onChange={e => setDataCompra(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Fornecedor</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {fornecedores.filter(f => f.ativo).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* EDIT MODE: single item */}
              {editingId ? (
                <div className="space-y-3">
                  <div>
                    <Label>Item</Label>
                    <Input value={editItemNome} onChange={e => setEditItemNome(e.target.value)} />
                  </div>
                  <div>
                    <Label>Quantidade</Label>
                    <Input type="number" min="0" step="0.01" value={editQuantidade} onChange={e => setEditQuantidade(e.target.value)} />
                  </div>
                </div>
              ) : (
                /* NEW MODE: all items listed */
                <div className="space-y-2">
                  <Label>Itens e Quantidades</Label>
                  <div className="rounded-lg border divide-y max-h-60 overflow-y-auto">
                    {topItems.length > 0 && (
                      <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground">⭐ Top 5</div>
                    )}
                    {topItems.map(name => (
                      <div key={name} className="flex items-center gap-2 px-3 py-2">
                        <span className="text-sm flex-1 truncate">{name}</span>
                        <Input
                          type="number" min="0" step="1"
                          className="h-8 w-24 text-center text-sm"
                          placeholder="0"
                          value={itemQuantities[name] || ""}
                          onChange={e => setItemQuantities(prev => ({ ...prev, [name]: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    ))}
                    {otherItems.length > 0 && (
                      <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground">Outros</div>
                    )}
                    {otherItems.map(name => (
                      <div key={name} className="flex items-center gap-2 px-3 py-2">
                        <span className="text-sm flex-1 truncate">{name}</span>
                        <Input
                          type="number" min="0" step="1"
                          className="h-8 w-24 text-center text-sm"
                          placeholder="0"
                          value={itemQuantities[name] || ""}
                          onChange={e => setItemQuantities(prev => ({ ...prev, [name]: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    ))}
                    {customItems.map((ci, idx) => (
                      <div key={`custom-${idx}`} className="flex items-center gap-2 px-3 py-2 bg-accent/10">
                        <span className="text-sm flex-1 truncate">{ci.nome}</span>
                        <Input
                          type="number" min="0" step="1"
                          className="h-8 w-24 text-center text-sm"
                          placeholder="0"
                          value={ci.quantidade || ""}
                          onChange={e => setCustomItems(prev => prev.map((c, i) => i === idx ? { ...c, quantidade: parseFloat(e.target.value) || 0 } : c))}
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCustomItems(prev => prev.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Adicionar item..."
                      value={newCustomItem}
                      onChange={e => setNewCustomItem(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustomItem())}
                      className="h-8 text-sm"
                    />
                    <Button type="button" variant="outline" size="sm" className="h-8" onClick={addCustomItem}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {totalQty > 0 && (
                    <div className="text-sm font-medium bg-muted/50 rounded-md px-3 py-2">
                      Quantidade Total: <span className="font-bold text-primary">{totalQty.toLocaleString("pt-BR")}</span>
                      {" "}({filledItems.length} ite{filledItems.length > 1 ? "ns" : "m"})
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label>Valor Total (R$) *</Label>
                <Input type="number" min="0" step="0.01" value={valorTotalInput} onChange={e => setValorTotalInput(e.target.value)} />
              </div>
              {totalQty > 0 && valorTotal > 0 && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                  Valor Unitário: <span className="font-bold text-foreground">R$ {unitPrice.toFixed(2)}</span>
                </div>
              )}
              <Card className="bg-muted/50">
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Possui frete?</Label>
                    <Switch checked={temFrete} onCheckedChange={setTemFrete} />
                  </div>
                  {temFrete && (
                    <div>
                      <Label>Valor do Frete (R$)</Label>
                      <Input type="number" min="0" step="0.01" value={valorFrete} onChange={e => setValorFrete(e.target.value)} />
                    </div>
                  )}
                </CardContent>
              </Card>
              <div>
                <Label>Observações</Label>
                <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Notas sobre a compra..." />
              </div>
              {((editingId ? (parseFloat(editQuantidade) || 0) : totalQty) > 0 && valorTotal > 0) && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Valor Total (s/ frete):</div><div className="font-bold text-right">R$ {valorTotal.toFixed(2)}</div>
                      <div>Valor Unitário:</div><div className="font-bold text-right">R$ {unitPrice.toFixed(2)}</div>
                      {temFrete && <>
                        <div>Frete:</div><div className="font-bold text-right">R$ {freight.toFixed(2)}</div>
                      </>}
                      <div className="font-semibold">Custo Total c/ Frete:</div><div className="font-bold text-right text-primary">R$ {custoTotalComFrete.toFixed(2)}</div>
                      <div className="font-semibold">Custo Unit. c/ Frete:</div><div className="font-bold text-right text-primary">R$ {custoUnitarioComFrete.toFixed(2)}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Button onClick={editingId ? handleEditSave : handleSave} disabled={saving} className="w-full">
                {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Registrar Compra"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="insumo">Insumos</SelectItem>
            <SelectItem value="embalagem">Embalagens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Qtd Total</TableHead>
                  <TableHead className="text-right">Total (R$)</TableHead>
                  <TableHead className="text-right">Frete</TableHead>
                  <TableHead className="text-right">Custo c/ Frete</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma compra registrada</TableCell></TableRow>
                ) : grouped.map(([key, items]) => {
                  const isExpanded = expandedGroups[key];
                  const first = items[0];
                  const totalQtyGroup = items.reduce((s, c) => s + Number(c.quantidade), 0);
                  const totalValorGroup = items.reduce((s, c) => s + Number(c.valor_total), 0);
                  const totalFreteGroup = items.reduce((s, c) => s + Number(c.valor_frete), 0);
                  const totalCustoGroup = items.reduce((s, c) => s + Number(c.custo_total_com_frete), 0);
                  const isSingle = items.length === 1;
                  const itemNames = items.map(c => c.item_nome).join(", ");

                  return (
                    <>
                      <TableRow key={key} className="cursor-pointer hover:bg-muted/50" onClick={() => !isSingle && toggleGroup(key)}>
                        <TableCell className="w-8 px-2">
                          {!isSingle && (isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(first.created_at), "dd/MM/yy")}</TableCell>
                        <TableCell><Badge variant={first.tipo === "insumo" ? "default" : "secondary"}>{first.tipo === "insumo" ? "Insumo" : "Embalagem"}</Badge></TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate" title={itemNames}>
                          {isSingle ? first.item_nome : `${items.length} itens`}
                        </TableCell>
                        <TableCell>{first.fornecedor_id ? fornecedorMap[first.fornecedor_id] || "—" : "—"}</TableCell>
                        <TableCell className="text-right font-medium">{totalQtyGroup.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right">{totalValorGroup.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{first.tem_frete ? `R$ ${totalFreteGroup.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{totalCustoGroup.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            {isSingle && <Button variant="ghost" size="icon" onClick={() => handleEdit(first)}><Edit className="h-4 w-4" /></Button>}
                            <Button variant="ghost" size="icon" onClick={() => isSingle ? handleDelete(first.id) : handleDeleteGroup(items)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && items.map(c => (
                        <TableRow key={c.id} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-sm pl-6">↳ {c.item_nome}</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right text-sm">{Number(c.quantidade).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right text-sm">{Number(c.valor_total).toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm">{c.tem_frete ? Number(c.valor_frete).toFixed(2) : "—"}</TableCell>
                          <TableCell className="text-right text-sm">{Number(c.custo_total_com_frete).toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(c)}><Edit className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── FORNECEDORES TAB ───
function FornecedoresTab({ factoryId, fornecedores, onRefresh }: {
  factoryId: string | null; fornecedores: Fornecedor[]; onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("insumo");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!factoryId || !nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("fornecedores").insert({
      nome: nome.trim(), tipo, telefone: telefone || null, email: email || null,
      observacoes: obs || null, factory_id: factoryId,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Fornecedor cadastrado!");
    setOpen(false); setNome(""); setTipo("insumo"); setTelefone(""); setEmail(""); setObs("");
    onRefresh();
  };

  const toggleAtivo = async (f: Fornecedor) => {
    await (supabase as any).from("fornecedores").update({ ativo: !f.ativo }).eq("id", f.id);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("fornecedores").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir. Verifique se não há compras vinculadas."); return; }
    toast.success("Fornecedor excluído");
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Fornecedor</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar Fornecedor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
            <div>
              <Label>Tipo de Fornecedor</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="insumo">Fornecedor de Insumos</SelectItem>
                  <SelectItem value="embalagem">Fornecedor de Embalagens</SelectItem>
                  <SelectItem value="ambos">Ambos (Insumos e Embalagens)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Telefone</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} /></div>
            <div><Label>E-mail</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label>Observações</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} /></div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Salvando..." : "Cadastrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fornecedores.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum fornecedor</TableCell></TableRow>
              ) : fornecedores.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {f.tipo === "insumo" ? "Insumos" : f.tipo === "embalagem" ? "Embalagens" : "Ambos"}
                    </Badge>
                  </TableCell>
                  <TableCell>{f.telefone || "—"}</TableCell>
                  <TableCell>{f.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleAtivo(f)}>
                      {f.ativo ? "Desativar" : "Ativar"}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
function RelatoriosTab({ compras, fornecedorMap }: { compras: Compra[]; fornecedorMap: Record<string, string> }) {
  const [filtroFornecedor, setFiltroFornecedor] = useState("todos");
  const [dataInicio, setDataInicio] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const filtered = useMemo(() => {
    return compras.filter(c => {
      const d = new Date(c.created_at);
      if (d < new Date(dataInicio) || d > new Date(dataFim + "T23:59:59")) return false;
      if (filtroFornecedor !== "todos" && c.fornecedor_id !== filtroFornecedor) return false;
      return true;
    });
  }, [compras, filtroFornecedor, dataInicio, dataFim]);

  const totais = useMemo(() => {
    let insumosSemFrete = 0, insumosComFrete = 0, embalagensSemFrete = 0, embalagensComFrete = 0, totalFrete = 0;
    filtered.forEach(c => {
      if (c.tipo === "insumo") {
        insumosSemFrete += Number(c.valor_total);
        insumosComFrete += Number(c.custo_total_com_frete);
      } else {
        embalagensSemFrete += Number(c.valor_total);
        embalagensComFrete += Number(c.custo_total_com_frete);
      }
      totalFrete += Number(c.valor_frete);
    });
    return { insumosSemFrete, insumosComFrete, embalagensSemFrete, embalagensComFrete, totalFrete, total: insumosComFrete + embalagensComFrete };
  }, [filtered]);

  const uniqueFornecedores = useMemo(() => {
    const ids = new Set(compras.map(c => c.fornecedor_id).filter(Boolean));
    return Array.from(ids) as string[];
  }, [compras]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs">Data Início</Label>
          <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs">Data Fim</Label>
          <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs">Fornecedor</Label>
          <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {uniqueFornecedores.map(id => (
                <SelectItem key={id} value={id}>{fornecedorMap[id] || id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Insumos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totais.insumosComFrete.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Sem frete: R$ {totais.insumosSemFrete.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Embalagens</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totais.embalagensComFrete.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Sem frete: R$ {totais.embalagensSemFrete.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Geral</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">R$ {totais.total.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Frete total: R$ {totais.totalFrete.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Compras no Período ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Total s/ Frete</TableHead>
                  <TableHead className="text-right">Frete</TableHead>
                  <TableHead className="text-right">Total c/ Frete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma compra no período</TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
                    <TableCell><Badge variant={c.tipo === "insumo" ? "default" : "secondary"}>{c.tipo === "insumo" ? "Insumo" : "Embalagem"}</Badge></TableCell>
                    <TableCell>{c.item_nome}</TableCell>
                    <TableCell>{c.fornecedor_id ? fornecedorMap[c.fornecedor_id] || "—" : "—"}</TableCell>
                    <TableCell className="text-right">{Number(c.valor_total).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{c.tem_frete ? Number(c.valor_frete).toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{Number(c.custo_total_com_frete).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
