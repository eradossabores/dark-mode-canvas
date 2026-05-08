import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Package } from "lucide-react";

interface LoteRow {
  id: string;
  numero_lote: string | null;
  data_fabricacao: string | null;
  data_vencimento: string | null;
  quantidade: number;
  created_at: string;
  fornecedor_id: string | null;
  fornecedores?: { nome: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemNome: string | null;
}

export default function LotesDialog({ open, onOpenChange, itemNome }: Props) {
  const { factoryId } = useAuth();
  const [lotes, setLotes] = useState<LoteRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !itemNome || !factoryId) return;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("compras")
        .select("id, numero_lote, data_fabricacao, data_vencimento, quantidade, created_at, fornecedor_id, fornecedores(nome)")
        .eq("factory_id", factoryId)
        .eq("item_nome", itemNome)
        .order("data_vencimento", { ascending: true, nullsFirst: false });
      setLotes(data || []);
      setLoading(false);
    })();
  }, [open, itemNome, factoryId]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7days = new Date(today); in7days.setDate(today.getDate() + 7);

  const statusOf = (venc: string | null) => {
    if (!venc) return null;
    const d = new Date(venc + "T12:00:00");
    if (d < today) return { label: "Vencido", variant: "destructive" as const };
    if (d <= in7days) return { label: "Vence em breve", variant: "default" as const, className: "bg-amber-500 hover:bg-amber-500" };
    return { label: "OK", variant: "secondary" as const };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Lotes de {itemNome || "—"}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
        ) : lotes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum lote registrado para este item. Cadastre o lote ao registrar uma nova compra.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Lote</TableHead>
                <TableHead>Data Compra</TableHead>
                <TableHead>Fabricação</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotes.map((l) => {
                const st = statusOf(l.data_vencimento);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.numero_lote || "—"}</TableCell>
                    <TableCell>{format(new Date(l.created_at), "dd/MM/yy")}</TableCell>
                    <TableCell>{l.data_fabricacao ? format(new Date(l.data_fabricacao + "T12:00:00"), "dd/MM/yy") : "—"}</TableCell>
                    <TableCell>{l.data_vencimento ? format(new Date(l.data_vencimento + "T12:00:00"), "dd/MM/yy") : "—"}</TableCell>
                    <TableCell className="text-right">{Number(l.quantidade).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{l.fornecedores?.nome || "—"}</TableCell>
                    <TableCell>
                      {st ? <Badge variant={st.variant} className={(st as any).className}>{st.label}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}