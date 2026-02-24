import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Settings2 } from "lucide-react";

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

  // Ajuste de estoque
  const [openAjuste, setOpenAjuste] = useState(false);
  const [ajusteTipo, setAjusteTipo] = useState<"gelo" | "mp" | "emb">("gelo");
  const [ajusteItemId, setAjusteItemId] = useState("");
  const [ajusteNovaQtd, setAjusteNovaQtd] = useState(0);
  const [ajusteMotivo, setAjusteMotivo] = useState("");

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

  function openAjusteDialog(tipo: "gelo" | "mp" | "emb", itemId: string, qtdAtual: number) {
    setAjusteTipo(tipo);
    setAjusteItemId(itemId);
    setAjusteNovaQtd(qtdAtual);
    setAjusteMotivo("");
    setOpenAjuste(true);
  }

  async function handleAjuste() {
    if (!ajusteItemId || ajusteNovaQtd < 0) return toast({ title: "Quantidade inválida", variant: "destructive" });
    if (!ajusteMotivo.trim()) return toast({ title: "Informe o motivo do ajuste", variant: "destructive" });

    try {
      let itemNome = "";
      let qtdAnterior = 0;
      let tipoItem: string;

      if (ajusteTipo === "gelo") {
        const item = gelos.find(g => g.id === ajusteItemId);
        qtdAnterior = item?.quantidade || 0;
        itemNome = item?.sabores?.nome || "Desconhecido";
        tipoItem = "gelo_pronto";
        await (supabase as any).from("estoque_gelos").update({ quantidade: ajusteNovaQtd }).eq("id", ajusteItemId);
      } else if (ajusteTipo === "mp") {
        const item = materias.find(m => m.id === ajusteItemId);
        qtdAnterior = item?.estoque_atual || 0;
        itemNome = item?.nome || "Desconhecido";
        tipoItem = "materia_prima";
        await (supabase as any).from("materias_primas").update({ estoque_atual: ajusteNovaQtd }).eq("id", ajusteItemId);
      } else {
        const item = embalagens.find(e => e.id === ajusteItemId);
        qtdAnterior = item?.estoque_atual || 0;
        itemNome = item?.nome || "Desconhecido";
        tipoItem = "embalagem";
        await (supabase as any).from("embalagens").update({ estoque_atual: ajusteNovaQtd }).eq("id", ajusteItemId);
      }

      const diff = ajusteNovaQtd - qtdAnterior;
      const movTipo = diff >= 0 ? "entrada" : "saida";
      const itemIdForMov = ajusteTipo === "gelo"
        ? gelos.find(g => g.id === ajusteItemId)?.sabor_id
        : ajusteItemId;

      await (supabase as any).from("movimentacoes_estoque").insert({
        tipo_item: tipoItem!,
        item_id: itemIdForMov,
        tipo_movimentacao: movTipo,
        quantidade: Math.abs(diff),
        referencia: "ajuste_manual",
        operador: "sistema",
      });

      await (supabase as any).from("auditoria").insert({
        usuario_nome: "sistema",
        modulo: "estoque",
        acao: "ajuste_estoque",
        registro_afetado: ajusteItemId,
        descricao: `Ajuste de ${itemNome}: ${qtdAnterior} → ${ajusteNovaQtd} (${diff >= 0 ? "+" : ""}${diff}). Motivo: ${ajusteMotivo}`,
      });

      toast({ title: "Estoque ajustado!", description: `${itemNome}: ${qtdAnterior} → ${ajusteNovaQtd}` });
      setOpenAjuste(false);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro ao ajustar", description: e.message, variant: "destructive" });
    }
  }

// ... keep existing code (addEstoqueMP function)
  async function addEstoqueMP() {
    if (!mpId || mpQtd <= 0) return toast({ title: "Preencha todos os campos", variant: "destructive" });
    try {
      const mp = materias.find((m) => m.id === mpId);
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

// ... keep existing code (addEstoqueEmb function)
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

  const SABOR_COLORS: Record<string, string> = {
    melancia: "bg-red-500/90 text-white border-red-600",
    morango: "bg-pink-500/90 text-white border-pink-600",
    "maçã verde": "bg-green-500/90 text-white border-green-600",
    maracujá: "bg-yellow-500/90 text-white border-yellow-600",
    "água de coco": "bg-cyan-500/90 text-white border-cyan-600",
    "abacaxi com hortelã": "bg-emerald-500/90 text-white border-emerald-600",
    "bob marley": "bg-amber-500/90 text-white border-amber-600",
    limão: "bg-lime-500/90 text-white border-lime-600",
    "limão com sal": "bg-lime-600/90 text-white border-lime-700",
    pitaya: "bg-fuchsia-500/90 text-white border-fuchsia-600",
    "blue ice": "bg-blue-500/90 text-white border-blue-600",
  };

  const getSaborColor = (nome: string) => {
    const key = nome?.toLowerCase() || "";
    return SABOR_COLORS[key] || "bg-muted text-foreground border-border";
  };

  const totalGelos = gelos.reduce((s, g) => s + (g.quantidade || 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Estoque</h1>

      {/* Painel de gelos por sabor */}
      {gelos.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground font-medium">Gelos por Sabor</p>
            <Badge variant="secondary" className="text-xs font-bold">Total: {totalGelos.toLocaleString()} un.</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {[...gelos]
              .sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0))
              .map((g) => (
                <div
                  key={g.id}
                  className={`rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] ${getSaborColor(g.sabores?.nome)}`}
                >
                  <p className="text-[11px] font-semibold truncate">{g.sabores?.nome}</p>
                  <p className="text-lg font-extrabold mt-0.5">{(g.quantidade || 0).toLocaleString()}</p>
                </div>
              ))}
            <div className="rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] bg-gray-700/90 text-white border-gray-800">
              <p className="text-[11px] font-semibold truncate">TOTAL</p>
              <p className="text-lg font-extrabold mt-0.5">{totalGelos.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de Ajuste */}
      <Dialog open={openAjuste} onOpenChange={setOpenAjuste}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nova Quantidade</Label>
              <Input
                type="number"
                min={0}
                value={ajusteNovaQtd || ""}
                onChange={(e) => setAjusteNovaQtd(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Motivo do Ajuste <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Ex: Contagem física, correção de erro, perda..."
                value={ajusteMotivo}
                onChange={(e) => setAjusteMotivo(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleAjuste}>Confirmar Ajuste</Button>
          </div>
        </DialogContent>
      </Dialog>

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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gelos.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>{g.sabores?.nome}</TableCell>
                      <TableCell>{g.quantidade} un.</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAjusteDialog("gelo", g.id, g.quantidade)}
                        >
                          <Settings2 className="h-3 w-3 mr-1" /> Ajustar
                        </Button>
                      </TableCell>
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materias.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.nome}</TableCell>
                      <TableCell>{Number(m.estoque_atual).toLocaleString()}</TableCell>
                      <TableCell>{m.unidade}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAjusteDialog("mp", m.id, m.estoque_atual)}
                        >
                          <Settings2 className="h-3 w-3 mr-1" /> Ajustar
                        </Button>
                      </TableCell>
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {embalagens.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.nome}</TableCell>
                      <TableCell>{e.estoque_atual} un.</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAjusteDialog("emb", e.id, e.estoque_atual)}
                        >
                          <Settings2 className="h-3 w-3 mr-1" /> Ajustar
                        </Button>
                      </TableCell>
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