import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function Auditoria() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data } = await (supabase as any).from("auditoria").select("*").order("created_at", { ascending: false }).limit(100);
    setLogs(data || []);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Auditoria</h1>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Dispositivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{l.usuario_nome}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{l.modulo}</Badge></TableCell>
                  <TableCell className="capitalize">{l.acao}</TableCell>
                  <TableCell className="max-w-xs truncate">{l.descricao}</TableCell>
                  <TableCell>{l.dispositivo}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
