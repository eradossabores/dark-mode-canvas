import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, TrendingUp, Package, CreditCard } from "lucide-react";
import type { AnaliseResumo, ImportRow } from "@/lib/spreadsheet-helpers";

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AnaliseResumoCard({ analise, tipo }: { analise: AnaliseResumo; tipo: string }) {
  const hasValor = analise.totalValor > 0;
  const hasStatus = analise.porStatus.length > 0 && analise.porStatus.some(s => s.status !== "Não informado");

  return (
    <div className="space-y-4">
      {/* Resumo por Produto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" /> Resumo por Produto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sabor</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                {hasValor && <TableHead className="text-right">Valor Total</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {analise.porProduto.map((p) => (
                <TableRow key={p.sabor}>
                  <TableCell className="font-medium">{p.sabor}</TableCell>
                  <TableCell className="text-right">{p.quantidade}</TableCell>
                  {hasValor && <TableCell className="text-right">{formatCurrency(p.valor)}</TableCell>}
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{analise.totalQuantidade}</TableCell>
                {hasValor && <TableCell className="text-right">{formatCurrency(analise.totalValor)}</TableCell>}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Status de Pagamento */}
      {hasStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" /> Status de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {analise.porStatus.map((s) => (
                <div key={s.status} className="p-3 rounded-lg border text-center">
                  <Badge
                    variant={
                      s.status === "Pago" ? "default" :
                      s.status === "Pendente" || s.status === "Fiado" ? "secondary" :
                      s.status === "Atrasado" ? "destructive" : "outline"
                    }
                    className="mb-1"
                  >
                    {s.status}
                  </Badge>
                  <p className="text-lg font-bold">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{s.quantidade} un.</p>
                  {hasValor && <p className="text-xs text-muted-foreground">{formatCurrency(s.valor)}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pendentes e Atrasados */}
      {(analise.pendentes.length > 0 || analise.atrasados.length > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong>{" "}
            {analise.atrasados.length > 0 && (
              <span>{analise.atrasados.length} transação(ões) em <strong>atraso</strong>. </span>
            )}
            {analise.pendentes.length > 0 && (
              <span>{analise.pendentes.length} transação(ões) com pagamento <strong>pendente/a prazo</strong>.</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {analise.pendentes.length > 0 && (
        <PendingTable title="Pagamentos Pendentes / A Prazo" rows={analise.pendentes} hasValor={hasValor} />
      )}
      {analise.atrasados.length > 0 && (
        <PendingTable title="Pagamentos em Atraso" rows={analise.atrasados} hasValor={hasValor} />
      )}
    </div>
  );
}

function PendingTable({ title, rows, hasValor }: { title: string; rows: ImportRow[]; hasValor: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-destructive">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Sabor</TableHead>
              <TableHead>Qtd</TableHead>
              {hasValor && <TableHead className="text-right">Valor</TableHead>}
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.rowNum} className="bg-destructive/5">
                <TableCell>{r.data}</TableCell>
                <TableCell>{r.sabor}</TableCell>
                <TableCell>{r.quantidade}</TableCell>
                {hasValor && <TableCell className="text-right">{r.valorTotal ? formatCurrency(r.valorTotal) : "-"}</TableCell>}
                <TableCell>{r.cliente || "-"}</TableCell>
                <TableCell>
                  <Badge variant="destructive">{r.statusPagamento}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
