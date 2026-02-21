import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function Sabores() {
  const [sabores, setSabores] = useState<any[]>([]);
  const [receitas, setReceitas] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [s, r] = await Promise.all([
      (supabase as any).from("sabores").select("*").order("nome"),
      (supabase as any).from("sabor_receita").select("*, materias_primas(nome), embalagens(nome)"),
    ]);
    setSabores(s.data || []);
    setReceitas(r.data || []);
  }

  function getReceita(saborId: string) {
    return receitas.find((r) => r.sabor_id === saborId);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sabores</h1>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sabor</TableHead>
                <TableHead>Insumo</TableHead>
                <TableHead>g/lote</TableHead>
                <TableHead>Embalagem</TableHead>
                <TableHead>Gelos/Lote</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sabores.map((s) => {
                const r = getReceita(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell>{r?.materias_primas?.nome || "-"}</TableCell>
                    <TableCell>{r?.quantidade_insumo_por_lote || "-"}</TableCell>
                    <TableCell>{r?.embalagens?.nome || "-"}</TableCell>
                    <TableCell>{r?.gelos_por_lote || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={s.ativo ? "default" : "destructive"}>{s.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
