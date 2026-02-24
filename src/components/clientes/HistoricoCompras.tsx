import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";

interface Props {
  clienteId: string | null;
  clienteNome: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function HistoricoCompras({ clienteId, clienteNome, open, onOpenChange }: Props) {
  const [vendas, setVendas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && clienteId) loadHistorico();
  }, [open, clienteId]);

  async function loadHistorico() {
    setLoading(true);
    try {
      const { data: v } = await (supabase as any)
        .from("vendas")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(20);

      const vendaIds = (v || []).map((vn: any) => vn.id);
      let itensData: any[] = [];
      if (vendaIds.length > 0) {
        const { data: it } = await (supabase as any)
          .from("venda_itens")
          .select("*, sabores(nome)")
          .in("venda_id", vendaIds);
        itensData = it || [];
      }

      setVendas(v || []);
      setItens(itensData);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
    } finally {
      setLoading(false);
    }
  }

  const itensMap: Record<string, any[]> = {};
  itens.forEach(i => {
    if (!itensMap[i.venda_id]) itensMap[i.venda_id] = [];
    itensMap[i.venda_id].push(i);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Histórico - {clienteNome}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : vendas.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma compra registrada.</p>
        ) : (
          <div className="space-y-4">
            {vendas.map(v => (
              <div key={v.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {new Date(v.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={v.status === "paga" ? "default" : v.status === "cancelada" ? "destructive" : "secondary"}>
                      {v.status}
                    </Badge>
                    <span className="font-bold text-sm">R$ {Number(v.total).toFixed(2)}</span>
                  </div>
                </div>
                {itensMap[v.id] && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {itensMap[v.id].map((item: any) => (
                      <div key={item.id} className="flex justify-between">
                        <span>{item.sabores?.nome || "?"} × {item.quantidade}</span>
                        <span>R$ {Number(item.subtotal).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {v.forma_pagamento && (
                  <span className="text-[10px] text-muted-foreground">Pgto: {v.forma_pagamento}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
