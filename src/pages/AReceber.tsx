import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DollarSign, CheckCircle, AlertTriangle, MinusCircle, History, Search, MessageCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoRecibo from "@/assets/logo-recibo.png";

export default function AReceber() {
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaterVenda, setAbaterVenda] = useState<any>(null);
  const [valorAbater, setValorAbater] = useState("");
  const [historicoVenda, setHistoricoVenda] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [whatsappPrompt, setWhatsappPrompt] = useState<{ vendaId: string; clienteNome: string; total: number; telefone: string; valorPago: number; historico: { valor: number; data: string }[]; quitou: boolean } | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("vendas")
      .select("*, clientes(nome)")
      .eq("status", "pendente")
      .order("created_at", { ascending: true });
    setVendas(data || []);
    setLoading(false);
  }

  async function loadHistorico(vendaId: string) {
    const { data } = await (supabase as any)
      .from("abatimentos_historico")
      .select("*")
      .eq("venda_id", vendaId)
      .order("created_at", { ascending: true });
    setHistorico(data || []);
  }

  async function checkWhatsappPrompt(vendaId: string, clienteId: string, clienteNome: string, total: number, valorPago: number, quitou: boolean) {
    const { data: cliente } = await (supabase as any).from("clientes").select("telefone").eq("id", clienteId).single();
    if (cliente?.telefone) {
      // Load full abatimento history
      const { data: hist } = await (supabase as any)
        .from("abatimentos_historico")
        .select("valor, created_at")
        .eq("venda_id", vendaId)
        .order("created_at", { ascending: true });
      const historicoFormatado = (hist || []).map((h: any) => ({
        valor: Number(h.valor),
        data: new Date(h.created_at).toLocaleDateString("pt-BR"),
      }));
      setWhatsappPrompt({ vendaId, clienteNome, total, telefone: cliente.telefone, valorPago, historico: historicoFormatado, quitou });
    }
  }

  function enviarReciboWhatsApp() {
    if (!whatsappPrompt) return;
    const restante = whatsappPrompt.total - whatsappPrompt.valorPago;
    let histLines = "";
    if (whatsappPrompt.historico.length > 0) {
      histLines = `\n📝 *Histórico de Pagamentos:*\n` +
        whatsappPrompt.historico.map((h, i) => `  ${i + 1}. ${h.data} — R$ ${h.valor.toFixed(2)}`).join("\n") +
        `\n  *Total pago: R$ ${whatsappPrompt.valorPago.toFixed(2)}*\n`;
    }
    const statusLine = whatsappPrompt.quitou
      ? `✅ *Pagamento Completo!*`
      : `⏳ *Pagamento Parcial* (Restante: R$ ${restante.toFixed(2)})`;
    const msg = `🧊 *RECIBO - ERA DOS SABORES*\n\n` +
      `${statusLine}\n\n` +
      `📋 *Cliente:* ${whatsappPrompt.clienteNome}\n` +
      `📅 *Data:* ${new Date().toLocaleDateString("pt-BR")}\n` +
      `💰 *Valor Total da Venda: R$ ${whatsappPrompt.total.toFixed(2)}*\n` +
      histLines +
      (whatsappPrompt.quitou ? "" : `\n💳 *Restante: R$ ${restante.toFixed(2)}*\n`) +
      `\n_Obrigado pela preferência!_`;
    const phone = whatsappPrompt.telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    setWhatsappPrompt(null);
  }

  async function marcarComoPaga(id: string) {
    try {
      const venda = vendas.find(v => v.id === id);
      const restante = (venda?.total || 0) - (venda?.valor_pago || 0);

      const { error } = await (supabase as any)
        .from("vendas")
        .update({ status: "paga", valor_pago: venda?.total || 0 })
        .eq("id", id);
      if (error) throw error;

      if (restante > 0) {
        await (supabase as any).from("abatimentos_historico").insert({
          venda_id: id,
          valor: restante,
        });
      }

      toast({ title: "Venda marcada como paga!" });
      await checkWhatsappPrompt(id, venda.cliente_id, venda.clientes?.nome || "?", Number(venda.total), Number(venda.total), true);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function abaterValor() {
    if (!abaterVenda) return;
    const valor = parseFloat(valorAbater.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      return toast({ title: "Informe um valor válido", variant: "destructive" });
    }

    const totalVenda = Number(abaterVenda.total);
    const jasPago = Number(abaterVenda.valor_pago || 0);
    const restante = totalVenda - jasPago;

    if (valor > restante) {
      return toast({ title: "Valor maior que o restante", description: `Restante: R$ ${restante.toFixed(2)}`, variant: "destructive" });
    }

    const novoValorPago = jasPago + valor;
    const quitou = novoValorPago >= totalVenda;

    try {
      const { error } = await (supabase as any)
        .from("vendas")
        .update({
          valor_pago: novoValorPago,
          status: quitou ? "paga" : "pendente",
        })
        .eq("id", abaterVenda.id);
      if (error) throw error;

      // Registrar no histórico
      await (supabase as any).from("abatimentos_historico").insert({
        venda_id: abaterVenda.id,
        valor,
      });

      toast({
        title: quitou ? "✅ Venda quitada!" : "💰 Valor abatido!",
        description: quitou
          ? `R$ ${valor.toFixed(2)} recebido. Venda totalmente paga.`
          : `R$ ${valor.toFixed(2)} recebido. Restante: R$ ${(restante - valor).toFixed(2)}`,
      });

      // Always prompt WhatsApp after abatimento
      await checkWhatsappPrompt(abaterVenda.id, abaterVenda.cliente_id, abaterVenda.clientes?.nome || "?", totalVenda, novoValorPago, quitou);

      setAbaterVenda(null);
      setValorAbater("");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  const hoje = new Date().toISOString().split("T")[0];
  const buscaLower = busca.toLowerCase().trim();
  const vendasFiltradas = buscaLower
    ? vendas.filter(v => v.clientes?.nome?.toLowerCase().includes(buscaLower))
    : vendas;
  const totalPendente = vendasFiltradas.reduce((s, v) => s + (Number(v.total) - Number(v.valor_pago || 0)), 0);
  const vencidas = vendasFiltradas.filter(v => v.created_at.split("T")[0] < hoje);
  const totalVencido = vencidas.reduce((s, v) => s + (Number(v.total) - Number(v.valor_pago || 0)), 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">A Receber</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Pendente</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">R$ {totalPendente.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vendasFiltradas.length} venda(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-destructive">R$ {totalVencido.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vencidas.length} venda(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Em dia</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">R$ {(totalPendente - totalVencido).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{vendasFiltradas.length - vencidas.length} venda(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader><CardTitle>Vendas Pendentes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Restante</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendasFiltradas.map((v) => {
                const isVencida = v.created_at.split("T")[0] < hoje;
                const pago = Number(v.valor_pago || 0);
                const total = Number(v.total);
                const restante = total - pago;
                const temAbatimento = pago > 0 && pago < total;
                return (
                  <TableRow key={v.id}>
                    <TableCell>{new Date(v.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{v.clientes?.nome}</TableCell>
                    <TableCell>R$ {total.toFixed(2)}</TableCell>
                    <TableCell>
                      {pago > 0 ? (
                        <span className="text-green-600 font-medium">R$ {pago.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${temAbatimento ? "text-amber-600" : ""}`}>
                        R$ {restante.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">{v.forma_pagamento?.replace("_", " ")}</TableCell>
                    <TableCell>
                      <Badge variant={isVencida ? "destructive" : temAbatimento ? "outline" : "secondary"}>
                        {temAbatimento ? "Parcial" : isVencida ? "Vencida" : "Em dia"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setHistoricoVenda(v); loadHistorico(v.id); }}
                        title="Histórico de abatimentos"
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setAbaterVenda(v); setValorAbater(""); }}
                      >
                        <MinusCircle className="h-3.5 w-3.5 mr-1" /> Abater
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => marcarComoPaga(v.id)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Quitar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {vendasFiltradas.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhuma venda pendente. 🎉
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Abater Valor */}
      <Dialog open={!!abaterVenda} onOpenChange={(open) => { if (!open) setAbaterVenda(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abater Valor</DialogTitle>
          </DialogHeader>
          {abaterVenda && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">{abaterVenda.clientes?.nome}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total da venda:</span>
                  <span className="font-bold text-foreground">R$ {Number(abaterVenda.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Já pago:</span>
                  <span className="font-bold text-green-600">R$ {Number(abaterVenda.valor_pago || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">Restante:</span>
                  <span className="font-black text-amber-600">
                    R$ {(Number(abaterVenda.total) - Number(abaterVenda.valor_pago || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
              <div>
                <Label>Valor a abater (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorAbater}
                  onChange={(e) => setValorAbater(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={abaterValor}>
                  Confirmar Abatimento
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const restante = Number(abaterVenda.total) - Number(abaterVenda.valor_pago || 0);
                    setValorAbater(restante.toFixed(2).replace(".", ","));
                  }}
                >
                  Quitar Tudo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico de Abatimentos */}
      <Dialog open={!!historicoVenda} onOpenChange={(open) => { if (!open) setHistoricoVenda(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Histórico de Abatimentos</DialogTitle>
          </DialogHeader>
          {historicoVenda && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">{historicoVenda.clientes?.nome}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total da venda:</span>
                  <span className="font-bold text-foreground">R$ {Number(historicoVenda.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Já pago:</span>
                  <span className="font-bold text-green-600">R$ {Number(historicoVenda.valor_pago || 0).toFixed(2)}</span>
                </div>
              </div>

              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum abatimento registrado.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {historico.map((h, i) => (
                    <div key={h.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleDateString("pt-BR")} às{" "}
                          {new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-xs text-muted-foreground">Abatimento #{i + 1}</p>
                      </div>
                      <span className="font-bold text-green-600">R$ {Number(h.valor).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t text-sm font-semibold">
                    <span>Total abatido:</span>
                    <span className="text-green-600">
                      R$ {historico.reduce((s: number, h: any) => s + Number(h.valor), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp Prompt */}
      <AlertDialog open={!!whatsappPrompt} onOpenChange={(v) => !v && setWhatsappPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Enviar recibo por WhatsApp?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Deseja enviar o comprovante para <strong>{whatsappPrompt?.clienteNome}</strong>?</p>
                <div className="rounded-md bg-muted p-2 text-xs space-y-1">
                  <div className="flex justify-between"><span>Total da venda:</span><span className="font-bold">R$ {whatsappPrompt?.total.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Total pago:</span><span className="font-bold text-green-600">R$ {whatsappPrompt?.valorPago.toFixed(2)}</span></div>
                  {!whatsappPrompt?.quitou && (
                    <div className="flex justify-between"><span>Restante:</span><span className="font-bold text-amber-600">R$ {((whatsappPrompt?.total || 0) - (whatsappPrompt?.valorPago || 0)).toFixed(2)}</span></div>
                  )}
                  {(whatsappPrompt?.historico?.length || 0) > 0 && (
                    <div className="border-t pt-1 mt-1">
                      <p className="font-semibold mb-0.5">Histórico ({whatsappPrompt?.historico.length} pagamento(s)):</p>
                      {whatsappPrompt?.historico.map((h, i) => (
                        <div key={i} className="flex justify-between text-muted-foreground">
                          <span>{h.data}</span><span>R$ {h.valor.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={enviarReciboWhatsApp} className="bg-green-600 hover:bg-green-700">
              Enviar WhatsApp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
