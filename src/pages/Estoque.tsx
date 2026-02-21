import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export default function Estoque() {
  const [gelos, setGelos] = useState<any[]>([]);
  const [materias, setMaterias] = useState<any[]>([]);
  const [embalagens, setEmbalagens] = useState<any[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);

  const [openMP, setOpenMP] = useState(false);
  const [mpId, setMpId] = useState("");
  const [mpQtd, setMpQtd] = useState(0);
  const [mpUnidade, setMpUnidade] = useState("g");

  const [openEmb, setOpenEmb] = useState(false);
  const [embId, setEmbId] = useState("");
  const [embQtd, setEmbQtd] = useState(0);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [g, m, e, mov] = await Promise.all([
      (supabase as any).from("estoque_gelos").select("*, sabores(nome)").order("sabores(nome)"),
      (supabase as any).from("materias_primas").select("*").order("nome"),
      (supabase as any).from("embalagens").select("*").order("nome"),
      (supabase as any).from("movimentacoes_estoque").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setGelos(g.data || []);
    setMaterias(m.data || []);
    setEmbalagens(e.data || []);
    setMovimentacoes(mov.data || []);
  }

  async function addEstoqueMP() {
    if (!mpId || mpQtd <= 0) return toast({ title: "Preencha todos os campos", variant: "destructive" });
    try {
      const mp = materias.find((m) => m.id === mpId);
      // Convert kg to g if needed
      const qtdEmGramas = mpUnidade === "kg" ? mpQtd * 1000 : mpQtd;

      await (supabase as any).from("materias_primas").update({ estoque_atual: mp.estoque_atual + qtdEmGramas }).eq("id", mpId);
      await (supabase as any).from("movimentacoes_estoque").insert({
        tipo_item: "materia_prima", item_id: mpId, tipo_movimentacao: "entrada",
        quantidade: qtdEmGramas, referencia: "entrada_manual", operador: "sistema",
      });
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "sistema", modulo: "estoque", acao: "entrada_mp",
        registro_afetado: mpId, descricao: `Entrada de ${mpQtd}${mpUnidade} de ${mp.nome}`,
      });
      toast({ title: "Estoque atualizado!" });
      setOpenMP(false);
      setMpQtd(0);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function addEstoqueEmb() {
    if (!embId || embQtd <= 0) return toast({ title: "Preencha todos os campos", variant: "destructive" });
    try {
      const emb = embalagens.find((e) => e.id === embId);
      await (supabase as any).from("embalagens").update({ estoque_atual: emb.estoque_atual + embQtd }).eq("id", embId);
      await (supabase as any).from("movimentacoes_estoque").insert({
        tipo_item: "embalagem", item_id: embId, tipo_movimentacao: "entrada",
        quantidade: embQtd, referencia: "entrada_manual", operador: "sistema",
      });
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "sistema", modulo: "estoque", acao: "entrada_embalagem",
        registro_afetado: embId, descricao: `Entrada de ${embQtd} un. de ${emb.nome}`,
      });
      toast({ title: "Estoque atualizado!" });
      setOpenEmb(false);
      setEmbQtd(0);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Estoque</h1>
      <Tabs defaultValue="gelos">
        <TabsList>
          <TabsTrigger value="gelos">Gelos Prontos</TabsTrigger>
          <TabsTrigger value="mp">Matéria-Prima</TabsTrigger>
          <TabsTrigger value="emb">Embalagens</TabsTrigger>
          <TabsTrigger value="mov">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="gelos">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sabor</TableHead>
                    <TableHead>Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gelos.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>{g.sabores?.nome}</TableCell>
                      <TableCell>{g.quantidade} un.</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mp">
          <div className="flex justify-end mb-4">
            <Dialog open={openMP} onOpenChange={setOpenMP}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Entrada MP</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Entrada de Matéria-Prima</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Matéria-Prima</Label>
                    <Select value={mpId} onValueChange={setMpId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {materias.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>Quantidade</Label>
                      <Input type="number" min={0} value={mpQtd || ""} onChange={(e) => setMpQtd(Number(e.target.value))} />
                    </div>
                    <div className="w-24">
                      <Label>Unidade</Label>
                      <Select value={mpUnidade} onValueChange={setMpUnidade}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button className="w-full" onClick={addEstoqueMP}>Confirmar Entrada</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Unidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materias.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.nome}</TableCell>
                      <TableCell>{Number(m.estoque_atual).toLocaleString()}</TableCell>
                      <TableCell>{m.unidade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emb">
          <div className="flex justify-end mb-4">
            <Dialog open={openEmb} onOpenChange={setOpenEmb}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Entrada Embalagem</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Entrada de Embalagens</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Embalagem</Label>
                    <Select value={embId} onValueChange={setEmbId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {embalagens.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantidade (unidades)</Label>
                    <Input type="number" min={0} value={embQtd || ""} onChange={(e) => setEmbQtd(Number(e.target.value))} />
                  </div>
                  <Button className="w-full" onClick={addEstoqueEmb}>Confirmar Entrada</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Estoque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {embalagens.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.nome}</TableCell>
                      <TableCell>{e.estoque_atual} un.</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mov">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mov.</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Ref.</TableHead>
                    <TableHead>Operador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{new Date(m.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="capitalize">{m.tipo_item?.replace("_", " ")}</TableCell>
                      <TableCell className={m.tipo_movimentacao === "entrada" ? "text-emerald-600" : "text-destructive"}>
                        {m.tipo_movimentacao === "entrada" ? "+" : "-"}
                      </TableCell>
                      <TableCell>{Number(m.quantidade).toLocaleString()}</TableCell>
                      <TableCell>{m.referencia}</TableCell>
                      <TableCell>{m.operador}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
