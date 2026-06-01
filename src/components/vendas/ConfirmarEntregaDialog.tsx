import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, AlertTriangle, Truck } from "lucide-react";

interface Props {
  venda: any | null;
  onClose: () => void;
  onConfirmed: () => void;
}

export default function ConfirmarEntregaDialog({ venda, onClose, onConfirmed }: Props) {
  const { user } = useAuth();
  const [pago, setPago] = useState<"sim" | "nao">("sim");
  const [forma, setForma] = useState<"especie" | "pix">("especie");
  const [loading, setLoading] = useState(false);

  if (!venda) return null;

  const clienteNome = venda.clientes?.nome ?? "Cliente";
  const total = Number(venda.total ?? 0);
  const precoAprazo = Number(venda.clientes?.preco_unidade_aprazo ?? 2.05);
  const qtd = Number(venda.totalUnidades ?? 0);
  const novoTotal = precoAprazo * qtd;

  async function handleConfirm() {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("confirmar_entrega_venda", {
        p_venda_id: venda.id,
        p_pago: pago === "sim",
        p_operador: user?.email ?? "operador",
        p_forma_pagamento: forma,
      });
      if (error) throw error;
      toast({
        title: pago === "sim" ? "✅ Entrega confirmada!" : "🔁 Convertida para A Prazo",
        description: pago === "sim"
          ? `Pagamento de R$ ${total.toFixed(2)} registrado.`
          : `Venda recalculada para R$ ${Number((data as any)?.total ?? novoTotal).toFixed(2)}.`,
      });
      onConfirmed();
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao confirmar entrega", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!venda} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-violet-600" /> Confirmar Entrega
          </DialogTitle>
          <DialogDescription>
            <strong>{clienteNome}</strong> · {qtd} un · R$ {total.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block">O cliente pagou no ato da entrega?</Label>
            <RadioGroup value={pago} onValueChange={(v) => setPago(v as any)} className="gap-2">
              <label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="sim" />
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Pagamento Recebido</div>
                  <div className="text-xs text-muted-foreground">Finaliza a venda como paga</div>
                </div>
              </label>
              <label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="nao" />
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Pagamento Não Recebido</div>
                  <div className="text-xs text-muted-foreground">
                    Converte para A Prazo (R$ {precoAprazo.toFixed(2)}/un → total R$ {novoTotal.toFixed(2)})
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {pago === "sim" && (
            <div>
              <Label className="mb-1 block">Forma de pagamento</Label>
              <Select value={forma} onValueChange={(v) => setForma(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="especie">💵 Espécie</SelectItem>
                  <SelectItem value="pix">📱 PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}