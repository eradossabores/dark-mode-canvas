import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, Loader2, Pencil, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { maskBRL, parseBRL, numberToBRL } from "@/lib/currency-mask";

export interface DespesaCategoria {
  value: string;
  label: string;
  icon: string;
}

export interface DespesasSectionProps {
  factoryId?: string | null;
  categorias: DespesaCategoria[];
  formasPagamento: { value: string; label: string }[];
}

interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  data_despesa: string;
  forma_pagamento: string;
  pago: boolean;
  responsavel: string | null;
  observacoes: string | null;
}

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const R = (n: number) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DespesasSection({ factoryId, categorias, formasPagamento }: DespesasSectionProps) {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [filtroMes, setFiltroMes] = useState(new Date().getMonth().toString());
  const [filtroCategoria, setFiltroCategoria] = useState("todos");

  // form
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("outros");
  const [valor, setValor] = useState("");
  const [data, setData] = useState<Date | undefined>(new Date());
  const [forma, setForma] = useState("pix");
  const [pago, setPago] = useState(true);
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [factoryId]);

  async function load() {
    setLoading(true);
    let q = (supabase as any).from("despesas").select("*").order("data_despesa", { ascending: false });
    if (factoryId) q = q.eq("factory_id", factoryId);
    const { data: rows, error } = await q;
    if (error) toast({ title: "Erro ao carregar despesas", description: error.message, variant: "destructive" });
    setDespesas((rows || []) as Despesa[]);
    setLoading(false);
  }

  function resetForm() {
    setEditId(null);
    setDescricao(""); setCategoria("outros"); setValor(""); setData(new Date());
    setForma("pix"); setPago(true); setResponsavel(""); setObservacoes("");
  }

  function openEdit(d: Despesa) {
    setEditId(d.id);
    setDescricao(d.descricao);
    setCategoria(d.categoria);
    setValor(numberToBRL(d.valor));
    setData(new Date(d.data_despesa + "T12:00:00"));
    setForma(d.forma_pagamento);
    setPago(d.pago);
    setResponsavel(d.responsavel || "");
    setObservacoes(d.observacoes || "");
    setOpen(true);
  }

  async function handleSave() {
    const v = parseBRL(valor);
    if (!descricao.trim()) return toast({ title: "Informe a descrição", variant: "destructive" });
    if (v <= 0) return toast({ title: "Informe um valor válido", variant: "destructive" });

    setSaving(true);
    const payload = {
      descricao: descricao.trim(),
      categoria,
      valor: v,
      data_despesa: format(data || new Date(), "yyyy-MM-dd"),
      forma_pagamento: forma,
      pago,
      responsavel: responsavel.trim() || null,
      observacoes: observacoes.trim() || null,
      factory_id: factoryId || null,
    };

    const { error } = editId
      ? await (supabase as any).from("despesas").update(payload).eq("id", editId)
      : await (supabase as any).from("despesas").insert(payload);
    setSaving(false);

    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: editId ? "Despesa atualizada" : "Despesa lançada" });
    setOpen(false);
    resetForm();
    load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await (supabase as any).from("despesas").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) return toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    toast({ title: "Despesa excluída" });
    load();
  }

  async function togglePago(d: Despesa) {
    const { error } = await (supabase as any).from("despesas").update({ pago: !d.pago }).eq("id", d.id);
    if (error) return toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    load();
  }

  const filtradas = useMemo(() => {
    return despesas.filter(d => {
      if (filtroCategoria !== "todos" && d.categoria !== filtroCategoria) return false;
      if (filtroMes !== "todos") {
        const m = new Date(d.data_despesa + "T12:00:00").getMonth();
        if (m.toString() !== filtroMes) return false;
      }
      return true;
    });
  }, [despesas, filtroMes, filtroCategoria]);

  const total = filtradas.reduce((s, d) => s + Number(d.valor), 0);
  const totalPago = filtradas.filter(d => d.pago).reduce((s, d) => s + Number(d.valor), 0);
  const totalPendente = total - totalPago;

  const catIcon = (c: string) => categorias.find(x => x.value === c)?.icon || "📋";
  const formaLabel = (f: string) => formasPagamento.find(x => x.value === f)?.label || f;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs mb-1 block">Mês</Label>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {MESES_PT.map((m, i) => <SelectItem key={m} value={i.toString()}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Categoria</Label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {categorias.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nova Despesa</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Despesa" : "Lançar Despesa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">Descrição *</Label>
                <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Combustível da entrega" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Valor *</Label>
                  <Input
                    inputMode="decimal"
                    value={valor}
                    onChange={e => setValor(maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start font-normal", !data && "text-muted-foreground")}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {data ? format(data, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                      <Calendar mode="single" selected={data} onSelect={setData} locale={ptBR} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categorias.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Forma de Pagamento</Label>
                  <Select value={forma} onValueChange={setForma}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {formasPagamento.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Responsável</Label>
                  <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Opcional" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Situação</Label>
                  <Select value={pago ? "pago" : "pendente"} onValueChange={v => setPago(v === "pago")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">Paga</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Observações</Label>
                <Input value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : editId ? "Salvar alterações" : "Lançar despesa"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Wallet className="h-3.5 w-3.5 text-primary" /> Total de Despesas
            </div>
            <p className="text-xl font-bold text-foreground">{R(total)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{filtradas.length} lançamento(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Receipt className="h-3.5 w-3.5" /> Pagas
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{R(totalPago)}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Receipt className="h-3.5 w-3.5 text-destructive" /> Pendentes
            </div>
            <p className="text-xl font-bold text-destructive">{R(totalPendente)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Despesas Lançadas</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtradas.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Nenhuma despesa lançada no período.</div>
          ) : (
            <>
              {/* Mobile */}
              <div className="space-y-2 md:hidden">
                {filtradas.map(d => (
                  <div key={d.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{catIcon(d.categoria)} {d.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(d.data_despesa + "T12:00:00"), "dd/MM/yyyy")} · {formaLabel(d.forma_pagamento)}
                        </p>
                      </div>
                      <p className="font-bold text-sm whitespace-nowrap">{R(d.valor)}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <Badge
                        variant={d.pago ? "secondary" : "destructive"}
                        className="cursor-pointer"
                        onClick={() => togglePago(d)}
                      >
                        {d.pago ? "Paga" : "Pendente"}
                      </Badge>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[90px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>{format(new Date(d.data_despesa + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="font-medium">{d.descricao}</TableCell>
                        <TableCell>{catIcon(d.categoria)} {categorias.find(c => c.value === d.categoria)?.label.replace(/^\S+\s/, "") || d.categoria}</TableCell>
                        <TableCell>{formaLabel(d.forma_pagamento)}</TableCell>
                        <TableCell className="text-muted-foreground">{d.responsavel || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={d.pago ? "secondary" : "destructive"}
                            className="cursor-pointer"
                            onClick={() => togglePago(d)}
                          >
                            {d.pago ? "Paga" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">{R(d.valor)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={6}>TOTAL</TableCell>
                      <TableCell className="text-right">{R(total)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
