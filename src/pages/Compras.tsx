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
import { Plus, Truck, Package, ShoppingCart, BarChart3, Trash2, Edit } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Fornecedor {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <ShoppingCart className="h-6 w-6" /> Setor de Compras
      </h1>
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
            operador={nome || ""}
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
function ComprasTab({ factoryId, fornecedores, fornecedorMap, compras, operador, onRefresh }: {
  factoryId: string | null; fornecedores: Fornecedor[]; fornecedorMap: Record<string, string>;
  compras: Compra[]; operador: string; onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("insumo");
  const [itemNome, setItemNome] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [temFrete, setTemFrete] = useState(false);
  const [valorFrete, setValorFrete] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todos");

  const qty = parseFloat(quantidade) || 0;
  const unitPrice = parseFloat(valorUnitario) || 0;
  const freight = temFrete ? (parseFloat(valorFrete) || 0) : 0;
  const valorTotal = qty * unitPrice;
  const custoTotalComFrete = valorTotal + freight;
  const custoUnitarioComFrete = qty > 0 ? custoTotalComFrete / qty : 0;

  const handleSave = async () => {
    if (!factoryId || !itemNome.trim() || qty <= 0 || unitPrice <= 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("compras").insert({
      tipo, item_nome: itemNome.trim(), fornecedor_id: fornecedorId || null,
      quantidade: qty, valor_unitario: unitPrice, valor_total: valorTotal,
      tem_frete: temFrete, valor_frete: freight,
      custo_total_com_frete: custoTotalComFrete, custo_unitario_com_frete: custoUnitarioComFrete,
      observacoes: obs || null, factory_id: factoryId,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar compra"); return; }
    toast.success("Compra registrada!");
    setOpen(false);
    resetForm();
    onRefresh();
  };

  const resetForm = () => {
    setTipo("insumo"); setItemNome(""); setFornecedorId(""); setQuantidade("");
    setValorUnitario(""); setTemFrete(false); setValorFrete(""); setObs("");
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("compras").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Compra excluída");
    onRefresh();
  };

  const filtered = filterTipo === "todos" ? compras : compras.filter(c => c.tipo === filterTipo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nova Compra</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Registrar Compra</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="insumo">Insumo</SelectItem>
                    <SelectItem value="embalagem">Embalagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome do Item *</Label>
                <Input value={itemNome} onChange={e => setItemNome(e.target.value)} placeholder={tipo === "insumo" ? "Ex: Maçã Verde" : "Ex: Saco plástico 500ml"} />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade *</Label>
                  <Input type="number" min="0" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
                </div>
                <div>
                  <Label>Valor Unitário (R$) *</Label>
                  <Input type="number" min="0" step="0.01" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} />
                </div>
              </div>
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
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="py-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Valor Total:</div><div className="font-bold text-right">R$ {valorTotal.toFixed(2)}</div>
                    {temFrete && <>
                      <div>Frete:</div><div className="font-bold text-right">R$ {freight.toFixed(2)}</div>
                    </>}
                    <div>Custo Total c/ Frete:</div><div className="font-bold text-right text-primary">R$ {custoTotalComFrete.toFixed(2)}</div>
                    <div>Custo Unit. c/ Frete:</div><div className="font-bold text-right text-primary">R$ {custoUnitarioComFrete.toFixed(2)}</div>
                  </div>
                </CardContent>
              </Card>
              <div>
                <Label>Observações</Label>
                <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Notas sobre a compra..." />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Salvando..." : "Registrar Compra"}
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
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Unit. (R$)</TableHead>
                  <TableHead className="text-right">Total (R$)</TableHead>
                  <TableHead className="text-right">Frete</TableHead>
                  <TableHead className="text-right">Custo c/ Frete</TableHead>
                  <TableHead className="text-right">Unit. c/ Frete</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhuma compra registrada</TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
                    <TableCell><Badge variant={c.tipo === "insumo" ? "default" : "secondary"}>{c.tipo === "insumo" ? "Insumo" : "Embalagem"}</Badge></TableCell>
                    <TableCell className="font-medium">{c.item_nome}</TableCell>
                    <TableCell>{c.fornecedor_id ? fornecedorMap[c.fornecedor_id] || "—" : "—"}</TableCell>
                    <TableCell className="text-right">{Number(c.quantidade).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{Number(c.valor_unitario).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(c.valor_total).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{c.tem_frete ? `R$ ${Number(c.valor_frete).toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{Number(c.custo_total_com_frete).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium text-primary">{Number(c.custo_unitario_com_frete).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
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

// ─── FORNECEDORES TAB ───
function FornecedoresTab({ factoryId, fornecedores, onRefresh }: {
  factoryId: string | null; fornecedores: Fornecedor[]; onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!factoryId || !nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("fornecedores").insert({
      nome: nome.trim(), telefone: telefone || null, email: email || null,
      observacoes: obs || null, factory_id: factoryId,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Fornecedor cadastrado!");
    setOpen(false); setNome(""); setTelefone(""); setEmail(""); setObs("");
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
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fornecedores.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum fornecedor</TableCell></TableRow>
              ) : fornecedores.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
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

// ─── RELATORIOS TAB ───
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
