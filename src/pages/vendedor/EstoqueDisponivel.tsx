import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Warehouse } from "lucide-react";

export default function EstoqueDisponivel() {
  const [linhas, setLinhas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: estoques } = await (supabase as any)
      .from("estoque_gelos").select("sabor_id, quantidade");
    const { data: sabores } = await (supabase as any)
      .from("sabores").select("id, nome, ativo").eq("ativo", true);

    const merged = (sabores || []).map((s: any) => {
      const e = (estoques || []).find((x: any) => x.sabor_id === s.id);
      return { id: s.id, nome: s.nome, quantidade: e?.quantidade ?? 0 };
    }).sort((a: any, b: any) => b.quantidade - a.quantidade);
    setLinhas(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = (supabase as any)
      .channel("estoque-vendedor")
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque_gelos" }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Warehouse className="h-6 w-6" /> Estoque Disponível</h1>
        <p className="text-sm text-muted-foreground">Visão em tempo real (somente leitura).</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Gelos prontos</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Sabor</TableHead><TableHead className="text-right">Disponível</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell className="text-right font-mono">{l.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {l.quantidade <= 0 ? <Badge variant="destructive">Sem estoque</Badge>
                        : l.quantidade < 50 ? <Badge variant="secondary">Baixo</Badge>
                        : <Badge>OK</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}