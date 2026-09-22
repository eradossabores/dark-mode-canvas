import { CalendarDays, ChevronRight, Package, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClienteRecorrencia, formatarData, formatarQuantidade, statusLabels } from "./recorrencia-types";

interface RecorrenciaListaProps {
  clientes: ClienteRecorrencia[];
  onSelect: (cliente: ClienteRecorrencia) => void;
}

function variant(status: ClienteRecorrencia["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "atrasado") return "destructive";
  if (status === "regular") return "default";
  if (status === "em_breve") return "secondary";
  return "outline";
}

function previsao(cliente: ClienteRecorrencia): string {
  if (!cliente.proximaCompra) return "Após a 2ª compra";
  if (cliente.diasAtraso > 0) return `${cliente.diasAtraso}d de atraso`;
  if (cliente.diasParaProxima === 0) return "Prevista para hoje";
  return `Em ${cliente.diasParaProxima}d`;
}

export default function RecorrenciaLista({ clientes, onSelect }: RecorrenciaListaProps) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {clientes.map((cliente) => (
          <Button key={cliente.id} variant="outline" className="h-auto w-full flex-col items-stretch gap-3 whitespace-normal p-4 text-left" onClick={() => onSelect(cliente)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-semibold">{cliente.nome}</p><p className="text-xs text-muted-foreground">Última: {formatarData(cliente.ultimaCompra)}</p></div>
              <Badge variant={variant(cliente.status)}>{statusLabels[cliente.status]}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><ShoppingBag className="mb-1 h-4 w-4 text-primary"/><span className="text-muted-foreground">Compras</span><strong className="block">{cliente.totalCompras}</strong></div>
              <div><CalendarDays className="mb-1 h-4 w-4 text-primary"/><span className="text-muted-foreground">Frequência</span><strong className="block">{cliente.frequenciaMedia ? `${cliente.frequenciaMedia} dias` : "—"}</strong></div>
              <div><Package className="mb-1 h-4 w-4 text-primary"/><span className="text-muted-foreground">Média</span><strong className="block">{formatarQuantidade(cliente.mediaUnidades)} un</strong></div>
            </div>
            <div className="flex items-center justify-between border-t pt-2 text-xs"><span>{previsao(cliente)}</span><span className="flex items-center font-medium text-primary">Ver detalhes <ChevronRight className="h-4 w-4"/></span></div>
          </Button>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Última compra</TableHead><TableHead className="text-right">Compras</TableHead><TableHead className="text-right">A cada</TableHead><TableHead className="text-right">Média/pedido</TableHead><TableHead>Previsão</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
          <TableBody>
            {clientes.map((cliente) => (
              <TableRow key={cliente.id} className="cursor-pointer" onClick={() => onSelect(cliente)}>
                <TableCell className="font-medium">{cliente.nome}</TableCell>
                <TableCell>{formatarData(cliente.ultimaCompra)}</TableCell>
                <TableCell className="text-right">{cliente.totalCompras}</TableCell>
                <TableCell className="text-right">{cliente.frequenciaMedia ? `${cliente.frequenciaMedia}d` : "—"}</TableCell>
                <TableCell className="text-right">{formatarQuantidade(cliente.mediaUnidades)} un</TableCell>
                <TableCell>{previsao(cliente)}</TableCell>
                <TableCell><Badge variant={variant(cliente.status)}>{statusLabels[cliente.status]}</Badge></TableCell>
                <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}