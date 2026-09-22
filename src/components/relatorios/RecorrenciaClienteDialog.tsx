import { CalendarClock, Package, ReceiptText, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ClienteRecorrencia,
  formatarData,
  formatarMoeda,
  formatarQuantidade,
  statusLabels,
} from "./recorrencia-types";

interface RecorrenciaClienteDialogProps {
  cliente: ClienteRecorrencia | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function statusVariant(status: ClienteRecorrencia["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "atrasado") return "destructive";
  if (status === "regular") return "default";
  if (status === "em_breve") return "secondary";
  return "outline";
}

export default function RecorrenciaClienteDialog({ cliente, open, onOpenChange }: RecorrenciaClienteDialogProps) {
  if (!cliente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-4 sm:p-6">
        <DialogHeader className="pr-8 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{cliente.nome}</DialogTitle>
            <Badge variant={statusVariant(cliente.status)}>{statusLabels[cliente.status]}</Badge>
          </div>
          <DialogDescription>
            Histórico detalhado e previsão calculada pelo comportamento de compra deste cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Compras", value: String(cliente.totalCompras), icon: ShoppingBag },
            { label: "Unidades", value: formatarQuantidade(cliente.totalUnidades), icon: Package },
            { label: "Média/pedido", value: formatarQuantidade(cliente.mediaUnidades), icon: ReceiptText },
            { label: "A cada", value: cliente.frequenciaMedia ? `${cliente.frequenciaMedia} dias` : "Calculando", icon: CalendarClock },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-md border bg-muted/30 p-3">
              <Icon className="mb-2 h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Leitura do ciclo</h3>
              <div className="mt-2 space-y-2 rounded-md border p-3 text-sm">
                <p className="flex justify-between gap-3"><span className="text-muted-foreground">Última compra</span><strong>{formatarData(cliente.ultimaCompra)}</strong></p>
                <p className="flex justify-between gap-3"><span className="text-muted-foreground">Próxima prevista</span><strong>{cliente.proximaCompra ? formatarData(cliente.proximaCompra) : "Após a 2ª compra"}</strong></p>
                <p className="flex justify-between gap-3"><span className="text-muted-foreground">Valor total</span><strong>{formatarMoeda(cliente.totalGasto)}</strong></p>
                <p className="flex justify-between gap-3"><span className="text-muted-foreground">Ticket médio</span><strong>{formatarMoeda(cliente.ticketMedio)}</strong></p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Produtos mais comprados</h3>
              <div className="mt-2 space-y-2">
                {cliente.produtosFavoritos.map((produto, index) => (
                  <div key={produto.nome} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate"><span className="mr-2 text-muted-foreground">{index + 1}.</span>{produto.nome}</span>
                    <strong className="shrink-0">{formatarQuantidade(produto.quantidade)} un</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">Linha do tempo das compras</h3>
            <div className="mt-2 space-y-3">
              {[...cliente.compras].reverse().map((compra, index) => (
                <div key={compra.id} className="relative border-l-2 border-primary/30 pl-4">
                  <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{formatarData(compra.data)}{compra.numeroPedido ? ` · #${compra.numeroPedido}` : ""}</p>
                      <p className="text-xs text-muted-foreground">
                        {index === cliente.compras.length - 1 ? "Primeira compra registrada" : `${compra.intervaloAnterior ?? 0} dias após a anterior`}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <strong>{formatarQuantidade(compra.unidades)} un</strong>
                      <p className="text-xs text-muted-foreground">{formatarMoeda(compra.valor)}</p>
                    </div>
                  </div>
                  <div className={cn("mt-1 text-xs text-muted-foreground", compra.produtos.length === 0 && "italic")}>
                    {compra.produtos.length > 0
                      ? compra.produtos.map((produto) => `${produto.nome} (${formatarQuantidade(produto.quantidade)})`).join(" · ")
                      : "Itens não identificados nesta venda"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}