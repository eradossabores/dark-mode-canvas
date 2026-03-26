import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DollarSign, Plus, Pencil, Trash2, Loader2, TrendingDown, Receipt, CircleDollarSign, AlertTriangle, Check, X, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface ContaPagar {
  id: string;
  descricao: string;
  responsavel: string | null;
  valor_parcela: number;
  parcela_atual: number;
  total_parcelas: number;
  tipo: "fixo" | "parcelado";
  valor_total: number;
  valor_restante: number;
  mes_referencia: string;
  ativa: boolean;
  pago_mes: boolean;
  proxima_parcela_data: string | null;
}

export default function ContasAPagar() {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pagarConta, setPagarConta] = useState<ContaPagar | null>(null);
  const [pagarData, setPagarData] = useState<Date | undefined>(undefined);
  const [pagarForma, setPagarForma] = useState<string>("pix");

  // Form state
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [parcelaAtual, setParcelaAtual] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("");
  const [tipo, setTipo] = useState<"fixo" | "parcelado">("parcelado");
  const [valorTotal, setValorTotal] = useState("");
  const [valorRestante, setValorRestante] = useState("");

  // Edit
  const [editId, setEditId] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editResponsavel, setEditResponsavel] = useState("");
  const [editValorParcela, setEditValorParcela] = useState("");
  const [editParcelaAtual, setEditParcelaAtual] = useState("");
  const [editTotalParcelas, setEditTotalParcelas] = useState("");
  const [editTipo, setEditTipo] = useState<"fixo" | "parcelado">("parcelado");
  const [editValorTotal, setEditValorTotal] = useState("");
  const [editValorRestante, setEditValorRestante] = useState("");

  useEffect(() => { loadContas(); }, []);

  async function loadContas() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("contas_a_pagar").select("*").eq("ativa", true).order("created_at");
    if (error) { console.error(error); }
    setContas(data || []);
    setLoading(false);
  }

  function resetForm() {
    setDescricao(""); setResponsavel(""); setValorParcela(""); setParcelaAtual("");
    setTotalParcelas(""); setTipo("parcelado"); setValorTotal(""); setValorRestante("");
  }

  async function handleAdd() {
    if (!descricao || !valorParcela) return toast({ title: "Preencha descrição e valor", variant: "destructive" });
    setSaving(true);
    const vp = parseFloat(valorParcela);
    const tp = tipo === "parcelado" ? parseInt(totalParcelas || "0") : 0;
    const pa = tipo === "parcelado" ? parseInt(parcelaAtual || "0") : 0;
    const vt = tipo === "parcelado" ? vp * tp : 0;
    const vr = tipo === "parcelado" ? vp * (tp - pa) : 0;
    const { error } = await (supabase as any).from("contas_a_pagar").insert({
      descricao,
      responsavel: responsavel || null,
      valor_parcela: vp,
      parcela_atual: pa,
      total_parcelas: tp,
      tipo,
      valor_total: vt,
      valor_restante: Math.max(0, vr),
    });
    setSaving(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Conta adicionada!" });
    setOpen(false); resetForm(); loadContas();
  }

  function openEdit(c: ContaPagar) {
    setEditId(c.id);
    setEditDescricao(c.descricao);
    setEditResponsavel(c.responsavel || "");
    setEditValorParcela(String(c.valor_parcela));
    setEditParcelaAtual(String(c.parcela_atual));
    setEditTotalParcelas(String(c.total_parcelas));
    setEditTipo(c.tipo);
    setEditValorTotal(String(c.valor_total));
    setEditValorRestante(String(c.valor_restante));
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editDescricao || !editValorParcela) return toast({ title: "Preencha descrição e valor", variant: "destructive" });
    setSaving(true);
    const vp = parseFloat(editValorParcela);
    const tp = editTipo === "parcelado" ? parseInt(editTotalParcelas || "0") : 0;
    const pa = editTipo === "parcelado" ? parseInt(editParcelaAtual || "0") : 0;
    const vt = editTipo === "parcelado" ? vp * tp : 0;
    const vr = editTipo === "parcelado" ? vp * (tp - pa) : 0;
    const { error } = await (supabase as any).from("contas_a_pagar").update({
      descricao: editDescricao,
      responsavel: editResponsavel || null,
      valor_parcela: vp,
      parcela_atual: pa,
      total_parcelas: tp,
      tipo: editTipo,
      valor_total: vt,
      valor_restante: Math.max(0, vr),
    }).eq("id", editId);
    setSaving(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Conta atualizada!" });
    setEditOpen(false); loadContas();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await (supabase as any).from("contas_a_pagar").update({ ativa: false }).eq("id", deleteId);
    toast({ title: "Conta removida!" });
    setDeleteId(null); loadContas();
  }

  async function avancarParcela(c: ContaPagar, proximaData?: Date) {
    if (c.tipo !== "parcelado" || c.parcela_atual >= c.total_parcelas) return;
    const novaParcela = c.parcela_atual + 1;
    const novoRestante = Math.max(0, c.valor_restante - c.valor_parcela);
    await (supabase as any).from("contas_a_pagar").update({
      parcela_atual: novaParcela,
      valor_restante: novoRestante,
      pago_mes: true,
      proxima_parcela_data: proximaData ? format(proximaData, "yyyy-MM-dd") : null,
    }).eq("id", c.id);
    toast({ title: `Parcela ${novaParcela}/${c.total_parcelas} paga!` });
    setPagarConta(null);
    setPagarData(undefined);
    loadContas();
  }

  async function togglePagoMes(c: ContaPagar) {
    const novo = !c.pago_mes;
    await (supabase as any).from("contas_a_pagar").update({ pago_mes: novo }).eq("id", c.id);
    toast({ title: novo ? `✅ ${c.descricao} — parcela do mês marcada como paga` : `${c.descricao} — parcela do mês desmarcada` });
    loadContas();
  }

  const R = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fixas = contas.filter(c => c.tipo === "fixo");
  const parceladas = contas.filter(c => c.tipo === "parcelado");
  const totalMensal = contas.reduce((s, c) => s + c.valor_parcela, 0);
  const totalRestante = parceladas.reduce((s, c) => s + c.valor_restante, 0);
  const totalFixo = fixas.reduce((s, c) => s + c.valor_parcela, 0);
  const totalParcelado = parceladas.reduce((s, c) => s + c.valor_parcela, 0);

  function renderForm(
    desc: string, setDesc: (v: string) => void,
    resp: string, setResp: (v: string) => void,
    vp: string, setVp: (v: string) => void,
    pa: string, setPa: (v: string) => void,
    tp: string, setTp: (v: string) => void,
    t: "fixo" | "parcelado", setT: (v: "fixo" | "parcelado") => void,
    vt: string, setVt: (v: string) => void,
    vr: string, setVr: (v: string) => void,
  ) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Descrição</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Freezer" />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={resp} onChange={e => setResp(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={t} onValueChange={v => setT(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parcelado">Parcelado</SelectItem>
                <SelectItem value="fixo">Fixo (Mensal)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor da Parcela / Mensal</Label>
            <Input type="number" step="0.01" value={vp} onChange={e => setVp(e.target.value)} placeholder="0,00" />
          </div>
        </div>
        {t === "parcelado" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Parcela Atual</Label>
                <Input type="number" value={pa} onChange={e => setPa(e.target.value)} placeholder="1" />
              </div>
              <div>
                <Label>Total de Parcelas</Label>
                <Input type="number" value={tp} onChange={e => setTp(e.target.value)} placeholder="12" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Total</Label>
                <Input type="number" step="0.01" value={(parseFloat(vp || "0") * parseInt(tp || "0")).toFixed(2)} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Valor Restante</Label>
                <Input type="number" step="0.01" value={Math.max(0, parseFloat(vp || "0") * (parseInt(tp || "0") - parseInt(pa || "0"))).toFixed(2)} disabled className="bg-muted" />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
            {renderForm(descricao, setDescricao, responsavel, setResponsavel, valorParcela, setValorParcela, parcelaAtual, setParcelaAtual, totalParcelas, setTotalParcelas, tipo, setTipo, valorTotal, setValorTotal, valorRestante, setValorRestante)}
            <Button className="w-full" onClick={handleAdd} disabled={saving}>
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Receipt className="h-4 w-4" /> Total Mensal
            </div>
            <p className="text-xl font-bold text-foreground">{R(totalMensal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" /> Faltam Pagar
            </div>
            <p className="text-xl font-bold text-destructive">{R(totalRestante)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CircleDollarSign className="h-4 w-4" /> Custos Fixos
            </div>
            <p className="text-xl font-bold text-foreground">{R(totalFixo)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4" /> Parcelas/Mês
            </div>
            <p className="text-xl font-bold text-foreground">{R(totalParcelado)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Contas Parceladas */}
      {parceladas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              📋 Contas Parceladas
              <Badge variant="secondary" className="text-xs">{parceladas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Custo</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-center">Mês Pago?</TableHead>
                  <TableHead className="text-right">Parcela</TableHead>
                  <TableHead>Próx. Vencimento</TableHead>
                  <TableHead className="text-center">Progresso</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Faltam</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parceladas.map(c => {
                  const pct = c.total_parcelas > 0 ? Math.round((c.parcela_atual / c.total_parcelas) * 100) : 0;
                  const quaseQuitando = c.parcela_atual >= c.total_parcelas - 2 && c.parcela_atual < c.total_parcelas;
                  const quitado = c.parcela_atual >= c.total_parcelas;
                  return (
                    <TableRow key={c.id} className={quitado ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{c.descricao}</TableCell>
                      <TableCell>{c.responsavel || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant={c.pago_mes ? "default" : "outline"}
                          className={`h-7 w-7 p-0 ${c.pago_mes ? "bg-green-600 hover:bg-green-700" : "hover:bg-red-50 dark:hover:bg-red-950/30"}`}
                          onClick={() => togglePagoMes(c)}
                          title={c.pago_mes ? "Parcela do mês paga ✅" : "Parcela do mês pendente"}
                        >
                          {c.pago_mes ? <Check className="h-4 w-4 text-white" /> : <X className="h-4 w-4 text-destructive" />}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right font-mono">{R(c.valor_parcela)}</TableCell>
                      <TableCell>
                        {c.proxima_parcela_data ? (
                          <Badge variant="outline" className="text-xs gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(c.proxima_parcela_data + "T12:00:00").toLocaleDateString("pt-BR")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <Badge variant={quitado ? "default" : quaseQuitando ? "secondary" : "outline"} className="text-xs font-mono whitespace-nowrap">
                            {c.parcela_atual}/{c.total_parcelas}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{R(c.valor_total)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-destructive">{R(c.valor_restante)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!quitado && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setPagarConta(c); setPagarData(undefined); }} title="Pagar próxima parcela">
                              💰 Pagar
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteId(c.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3}>TOTAL PARCELADAS</TableCell>
                  <TableCell className="text-right font-mono">{R(totalParcelado)}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-mono">{R(parceladas.reduce((s, c) => s + c.valor_total, 0))}</TableCell>
                  <TableCell className="text-right font-mono text-destructive">{R(totalRestante)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Custos Fixos */}
      {fixas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              🔁 Custos Fixos Mensais
              <Badge variant="secondary" className="text-xs">{fixas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Custo</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-center">Mês Pago?</TableHead>
                  <TableHead className="text-right">Valor Mensal</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixas.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.descricao}</TableCell>
                    <TableCell>{c.responsavel || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant={c.pago_mes ? "default" : "outline"}
                        className={`h-7 w-7 p-0 ${c.pago_mes ? "bg-green-600 hover:bg-green-700" : "hover:bg-red-50 dark:hover:bg-red-950/30"}`}
                        onClick={() => togglePagoMes(c)}
                        title={c.pago_mes ? "Pago este mês ✅" : "Pendente este mês"}
                      >
                        {c.pago_mes ? <Check className="h-4 w-4 text-white" /> : <X className="h-4 w-4 text-destructive" />}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right font-mono">{R(c.valor_parcela)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={2}>TOTAL FIXOS</TableCell>
                  <TableCell className="text-right font-mono">{R(totalFixo)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Conta</DialogTitle></DialogHeader>
          {renderForm(editDescricao, setEditDescricao, editResponsavel, setEditResponsavel, editValorParcela, setEditValorParcela, editParcelaAtual, setEditParcelaAtual, editTotalParcelas, setEditTotalParcelas, editTipo, setEditTipo, editValorTotal, setEditValorTotal, editValorRestante, setEditValorRestante)}
          <Button className="w-full" onClick={handleEdit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Pagar Parcela Dialog */}
      <Dialog open={!!pagarConta} onOpenChange={v => { if (!v) { setPagarConta(null); setPagarData(undefined); setPagarForma("pix"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pagar Parcela</DialogTitle>
          </DialogHeader>
          {pagarConta && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-bold">{pagarConta.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  Parcela {pagarConta.parcela_atual + 1}/{pagarConta.total_parcelas} · {R(pagarConta.valor_parcela)}
                </p>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Forma de pagamento</Label>
                <Select value={pagarForma} onValueChange={setPagarForma}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="especie">Espécie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Data da próxima parcela (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !pagarData && "text-muted-foreground")}
                    >
                      <CalendarDays className="h-4 w-4 mr-2" />
                      {pagarData ? format(pagarData, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pagarData}
                      onSelect={setPagarData}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button className="w-full" onClick={() => avancarParcela(pagarConta, pagarData)}>
                💰 Confirmar Pagamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conta?</AlertDialogTitle>
            <AlertDialogDescription>A conta será desativada e não aparecerá mais na lista.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
