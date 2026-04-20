import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { realizarVenda } from "@/lib/supabase-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ShoppingCart, AlertTriangle } from "lucide-react";
import ReciboVenda from "@/components/vendas/ReciboVenda";

export default function NovoPedido() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [sabores, setSabores] = useState<any[]>([]);
  const [estoques, setEstoques] = useState<Record<string, number>>({});
  const [clienteId, setClienteId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<{ sabor_id: string; quantidade: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [reciboOpen, setReciboOpen] = useState(false);
  const [reciboData, setReciboData] = useState<any>(null);

  async function load() {
    const [{ data: cli }, { data: sab }, { data: est }] = await Promise.all([
      (supabase as any).from("clientes").select("id, nome, telefone").eq("status", "ativo").order("nome"),
      (supabase as any).from("sabores").select("id, nome").eq("ativo", true).order("nome"),
      (supabase as any).from("estoque_gelos").select("sabor_id, quantidade"),
    ]);
    setClientes(cli || []);
    setSabores(sab || []);
    const map: Record<string, number> = {};
    (est || []).forEach((e: any) => { map[e.sabor_id] = e.quantidade; });
    setEstoques(map);
  }

  useEffect(() => { load(); }, []);

  function addItem() {
    setItens((prev) => [...prev, { sabor_id: "", quantidade: 1 }]);
  }
  function removeItem(i: number) {
    setItens((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateItem(i: number, patch: Partial<{ sabor_id: string; quantidade: number }>) {
    setItens((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  const totalUnidades = useMemo(() => itens.reduce((s, it) => s + (Number(it.quantidade) || 0), 0), [itens]);

  // Verifica estoque insuficiente
  const itensSemEstoque = useMemo(() => {
    return itens.filter((it) => it.sabor_id && (estoques[it.sabor_id] ?? 0) < it.quantidade);
  }, [itens, estoques]);

  async function submit(ignorar: boolean) {
    if (!clienteId) { toast({ title: "Selecione um cliente", variant: "destructive" }); return; }
    const validos = itens.filter((it) => it.sabor_id && it.quantidade > 0);
    if (validos.length === 0) { toast({ title: "Adicione ao menos um item", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const vendaId = await realizarVenda({
        p_cliente_id: clienteId,
        p_operador: user?.email || "vendedor",
        p_observacoes: observacoes,
        p_itens: validos.map((it) => ({ sabor_id: it.sabor_id, quantidade: Number(it.quantidade) })),
        p_ignorar_estoque: ignorar,
      });
      toast({ title: "Pedido registrado com sucesso!" });

      // Abrir comanda/recibo igual ao do operador
      try {
        const idVenda = typeof vendaId === "string" ? vendaId : (vendaId as any)?.id;
        if (idVenda) {
          const { data: v } = await (supabase as any)
            .from("vendas")
            .select("*, clientes(nome, telefone)")
            .eq("id", idVenda)
            .single();
          const { data: itensData } = await (supabase as any)
            .from("venda_itens").select("*, sabores(nome)").eq("venda_id", idVenda);
          if (v) {
            setReciboData({
              cliente_nome: v.clientes?.nome || "?",
              data: new Date(v.created_at).toLocaleDateString("pt-BR"),
              forma_pagamento: v.forma_pagamento || "Pendente",
              numero_nf: v.numero_nf || undefined,
              numero_pedido: v.numero_pedido || undefined,
              total: Number(v.total),
              observacoes: (v.observacoes || "").replace(/^\[[^\]]*\]\s*/, "").trim() || undefined,
              telefone: v.clientes?.telefone || undefined,
              status: v.status,
              valor_pago: Number(v.valor_pago || 0),
              valor_frete: Number(v.valor_frete || 0),
              frete_pago_por: v.frete_pago_por || undefined,
              itens: (itensData || []).map((it: any) => ({
                sabor_nome: it.sabores?.nome || "?",
                quantidade: it.quantidade,
                preco_unitario: Number(it.preco_unitario),
                subtotal: Number(it.subtotal),
              })),
            });
            setReciboOpen(true);
          }
        }
      } catch (err) {
        console.error("Erro ao abrir recibo:", err);
      }

      setClienteId(""); setObservacoes(""); setItens([]);
      load();
    } catch (e: any) {
      toast({ title: "Erro ao registrar pedido", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6" /> Novo Pedido</h1>
        <p className="text-sm text-muted-foreground">Lance um pedido para um dos seus clientes.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados do pedido</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens</Label>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Adicionar sabor</Button>
            </div>
            {itens.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>}
            {itens.map((it, i) => {
              const disp = it.sabor_id ? (estoques[it.sabor_id] ?? 0) : null;
              const insuf = disp !== null && disp < it.quantidade;
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-7">
                    <Select value={it.sabor_id} onValueChange={(v) => updateItem(i, { sabor_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Sabor" /></SelectTrigger>
                      <SelectContent>
                        {sabores.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nome} <span className="text-xs text-muted-foreground ml-2">({estoques[s.id] ?? 0} disp.)</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input type="number" min={1} value={it.quantidade}
                      onChange={(e) => updateItem(i, { quantidade: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    {insuf && <Badge variant="destructive" className="text-[10px]">sem estoque</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>

          {totalUnidades > 0 && (
            <Alert>
              <AlertDescription>
                Total: <strong>{totalUnidades} unidade(s)</strong>. A comissão será calculada quando a venda for marcada como paga.
              </AlertDescription>
            </Alert>
          )}

          {itensSemEstoque.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Há itens sem estoque suficiente. Você pode confirmar mesmo assim, mas o estoque ficará negativo.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            {itensSemEstoque.length > 0 ? (
              <Button variant="outline" disabled={submitting} onClick={() => submit(true)}>
                Confirmar mesmo sem estoque
              </Button>
            ) : (
              <Button disabled={submitting} onClick={() => submit(false)}>
                {submitting ? "Registrando..." : "Registrar pedido"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ReciboVenda open={reciboOpen} onOpenChange={setReciboOpen} data={reciboData} />
    </div>
  );
}