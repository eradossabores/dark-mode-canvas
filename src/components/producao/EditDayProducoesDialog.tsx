import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, Save, Loader2 } from "lucide-react";

interface EditableProd {
  id: string;
  sabor_id: string;
  sabor_nome: string;
  modo: "lote" | "unidade";
  quantidade_lotes: number;
  quantidade_total: number;
  observacoes: string;
  operador: string;
  funcIds: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayItems: any[];
  sabores: any[];
  funcionarios: any[];
  onSaved: () => void;
}

export default function EditDayProducoesDialog({ open, onOpenChange, dayItems, sabores, funcionarios, onSaved }: Props) {
  const [items, setItems] = useState<EditableProd[]>([]);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [loadingFuncs, setLoadingFuncs] = useState(true);
  // Global collaborators for the whole day
  const [globalFuncIds, setGlobalFuncIds] = useState<string[]>([]);

  const PATROES_ID = "patroes";
  const allOptions = [{ id: PATROES_ID, nome: "👑 Patrões" }, ...funcionarios];

  useEffect(() => {
    if (open && dayItems.length > 0) {
      const d = new Date(dayItems[0].created_at);
      setNewDate(d);
      loadFuncionarios();
    }
  }, [open, dayItems]);

  async function loadFuncionarios() {
    setLoadingFuncs(true);
    // Collect unique func ids from all productions of the day
    const allFuncIds = new Set<string>();
    const mapped: EditableProd[] = [];
    for (const p of dayItems) {
      const { data } = await (supabase as any)
        .from("producao_funcionarios")
        .select("funcionario_id")
        .eq("producao_id", p.id);
      const ids: string[] = data?.length ? data.map((d: any) => d.funcionario_id) : [];
      ids.forEach(id => allFuncIds.add(id));
      mapped.push({
        id: p.id,
        sabor_id: p.sabor_id,
        sabor_nome: p.sabores?.nome || "?",
        modo: p.modo || "lote",
        quantidade_lotes: p.quantidade_lotes || 1,
        quantidade_total: p.quantidade_total || 84,
        observacoes: p.observacoes || "",
        operador: p.operador || "",
        funcIds: ids,
      });
    }
    // Check if "patroes" was stored in operador field
    const hasPatroes = dayItems.some((p: any) => (p.operador || "").toLowerCase().includes("patr"));
    if (hasPatroes) allFuncIds.add(PATROES_ID);
    
    setGlobalFuncIds(allFuncIds.size > 0 ? [...allFuncIds] : []);
    setItems(mapped);
    setLoadingFuncs(false);
  }

  function updateItem(idx: number, field: keyof EditableProd, value: any) {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value };
      if (field === "quantidade_lotes" && item.modo === "lote") {
        item.quantidade_total = value * 84;
      }
      if (field === "modo" && value === "lote") {
        item.quantidade_total = item.quantidade_lotes * 84;
      }
      updated[idx] = item;
      return updated;
    });
  }

  async function handleSaveAll() {
    setLoading(true);
    try {
      const validFuncs = globalFuncIds.filter(f => f !== "" && f !== PATROES_ID);
      const hasPatroes = globalFuncIds.includes(PATROES_ID);
      const nomes: string[] = [];
      if (hasPatroes) nomes.push("👑 Patrões");
      validFuncs.forEach(f => {
        const fn = funcionarios.find((fn: any) => fn.id === f);
        if (fn) nomes.push(fn.nome);
      });
      const operadorStr = nomes.join(", ") || "sistema";

      for (const item of items) {
        const finalTotal = item.modo === "lote" ? item.quantidade_lotes * 84 : item.quantidade_total;

        const { error } = await (supabase as any).from("producoes").update({
          sabor_id: item.sabor_id,
          modo: item.modo,
          quantidade_lotes: item.modo === "lote" ? item.quantidade_lotes : 0,
          quantidade_total: finalTotal,
          observacoes: item.observacoes || null,
          operador: operadorStr,
          created_at: newDate.toISOString(),
        }).eq("id", item.id);
        if (error) throw error;

        // Update funcionarios for all productions with the same global list
        await (supabase as any).from("producao_funcionarios").delete().eq("producao_id", item.id);
        if (validFuncs.length > 0) {
          await (supabase as any).from("producao_funcionarios").insert(
            validFuncs.map(f => ({ producao_id: item.id, funcionario_id: f, quantidade_produzida: 0 }))
          );
        }
      }
      toast({ title: `✅ ${items.length} produção(ões) atualizada(s)!` });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const dayLabel = dayItems.length > 0
    ? new Date(dayItems[0].created_at).toLocaleDateString("pt-BR")
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Produções do Dia — {dayLabel}</DialogTitle>
        </DialogHeader>

        {loadingFuncs ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Data */}
            <div>
              <Label>Mover todas para a data:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(newDate, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newDate} onSelect={(d) => d && setNewDate(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Items */}
            {items.map((item, idx) => (
              <div key={item.id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-semibold">{item.sabor_nome}</Badge>
                  <span className="text-xs text-muted-foreground">ID: {item.id.slice(0, 8)}...</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Sabor</Label>
                    <Select value={item.sabor_id} onValueChange={(v) => {
                      const s = sabores.find(s => s.id === v);
                      updateItem(idx, "sabor_id", v);
                      if (s) updateItem(idx, "sabor_nome", s.nome);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{sabores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Modo</Label>
                    <Select value={item.modo} onValueChange={(v) => updateItem(idx, "modo", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lote">Lote (84 un.)</SelectItem>
                        <SelectItem value="unidade">Unidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {item.modo === "lote" ? (
                    <div>
                      <Label className="text-xs">Qtd. Lotes</Label>
                      <Input type="number" min={1} value={item.quantidade_lotes} onChange={(e) => updateItem(idx, "quantidade_lotes", Number(e.target.value))} />
                      <p className="text-xs text-muted-foreground mt-0.5">= {item.quantidade_lotes * 84} gelos</p>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs">Qtd. Total</Label>
                      <Input type="number" min={1} value={item.quantidade_total} onChange={(e) => updateItem(idx, "quantidade_total", Number(e.target.value))} />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Input value={item.observacoes} onChange={(e) => updateItem(idx, "observacoes", e.target.value)} placeholder="Opcional" />
                  </div>
                </div>

              </div>
            ))}

            {/* Responsáveis do Dia (global) */}
            <div className="rounded-lg border bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">👥 Responsáveis do Dia</Label>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setGlobalFuncIds([...globalFuncIds, ""])}>
                  <Plus className="h-3 w-3 mr-1" />Add
                </Button>
              </div>
              {globalFuncIds.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum responsável adicionado. Clique em + Add.</p>
              )}
              {globalFuncIds.map((f, fi) => (
                <div key={fi} className="flex gap-2">
                  <Select value={f} onValueChange={(v) => {
                    const list = [...globalFuncIds];
                    list[fi] = v;
                    setGlobalFuncIds(list);
                  }}>
                    <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="Colaborador" /></SelectTrigger>
                    <SelectContent>
                      {allOptions.map(fn => (
                        <SelectItem key={fn.id} value={fn.id}>{fn.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setGlobalFuncIds(globalFuncIds.filter((_, i) => i !== fi))}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <Button className="w-full" onClick={handleSaveAll} disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Salvar Todas ({items.length})</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
