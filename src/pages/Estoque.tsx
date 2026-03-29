import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, Settings2, Trash2, Snowflake, AlertTriangle, Pencil } from "lucide-react";
import SacosTab from "@/components/estoque/SacosTab";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

export default function Estoque() {
  const { factoryId } = useAuth();
  const [gelos, setGelos] = useState<any[]>([]);
  const [materias, setMaterias] = useState<any[]>([]);
  const [embalagens, setEmbalagens] = useState<any[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [freezers, setFreezers] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [sabores, setSabores] = useState<any[]>([]);

  // Freezer dialog
  const [openFreezer, setOpenFreezer] = useState(false);
  const [fzClienteId, setFzClienteId] = useState("");
  const [fzSaborId, setFzSaborId] = useState("");
  const [fzQtd, setFzQtd] = useState(0);

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

  // Avaria
  const [avarias, setAvarias] = useState<any[]>([]);
  const [openAvaria, setOpenAvaria] = useState(false);
  const [avariaSaborId, setAvariaSaborId] = useState("");
  const [avariaQtd, setAvariaQtd] = useState(0);
  const [avariaMotivo, setAvariaMotivo] = useState("");
  const [avariaComEmbalagem, setAvariaComEmbalagem] = useState(false);
  const [avariaLoading, setAvariaLoading] = useState(false);

  // Edit/Delete avaria
  const [editAvaria, setEditAvaria] = useState<any>(null);
  const [editAvariaQtd, setEditAvariaQtd] = useState(0);
  const [editAvariaMotivo, setEditAvariaMotivo] = useState("");
  const [editAvariaLoading, setEditAvariaLoading] = useState(false);
  const [deleteAvariaId, setDeleteAvariaId] = useState<string | null>(null);
  const [deleteAvariaLoading, setDeleteAvariaLoading] = useState(false);
  useEffect(() => { loadData(); }, [factoryId]);

  async function loadData() {
    let gQ = (supabase as any).from("estoque_gelos").select("*, sabores(nome)").order("sabores(nome)");
    let mQ = (supabase as any).from("materias_primas").select("*").order("nome");
    let eQ = (supabase as any).from("embalagens").select("*").order("nome");
    let movQ = (supabase as any).from("movimentacoes_estoque").select("*").order("created_at", { ascending: false }).limit(50);
    let fzQ = (supabase as any).from("estoque_freezer").select("*, clientes(nome), sabores(nome)").order("updated_at", { ascending: false });
    let cliQ = (supabase as any).from("clientes").select("id, nome").eq("possui_freezer", true).order("nome");
    let sabQ = (supabase as any).from("sabores").select("id, nome").eq("ativo", true).order("nome");
    let avQ = (supabase as any).from("avarias").select("*, sabores(nome)").order("created_at", { ascending: false }).limit(100);

    if (factoryId) {
      gQ = gQ.eq("factory_id", factoryId);
      mQ = mQ.eq("factory_id", factoryId);
      eQ = eQ.eq("factory_id", factoryId);
      movQ = movQ.eq("factory_id", factoryId);
      fzQ = fzQ.eq("factory_id", factoryId);
      cliQ = cliQ.eq("factory_id", factoryId);
      sabQ = sabQ.eq("factory_id", factoryId);
      avQ = avQ.eq("factory_id", factoryId);
    }

    const [g, m, e, mov] = await Promise.all([gQ, mQ, eQ, movQ]);
    const [fz, cli, sab, av] = await Promise.all([fzQ, cliQ, sabQ, avQ]);
    setFreezers(fz.data || []);
    setClientes(cli.data || []);
    setSabores(sab.data || []);
    setAvarias(av.data || []);
    setGelos(g.data || []);
    // Ordenar matérias-primas na sequência fixa desejada
    const ordemMP: Record<string, number> = {
      "saborizante melancia": 1,
      "saborizante morango": 2,
      "saborizante maçã verde": 3,
      "saborizante maracujá": 4,
      "saborizante água de coco": 5,
      "saborizante abacaxi com hortelã": 6,
    };
    const sortedMaterias = (m.data || []).sort((a: any, b: any) => {
      const oA = ordemMP[a.nome?.toLowerCase()] ?? 99;
      const oB = ordemMP[b.nome?.toLowerCase()] ?? 99;
      return oA - oB || a.nome.localeCompare(b.nome);
    });
    setMaterias(sortedMaterias);
    // Ordenar embalagens na mesma sequência
    const ordemEmb: Record<string, number> = {
      "embalagem melancia": 1,
      "embalagem morango": 2,
      "embalagem maçã verde": 3,
      "embalagem maracujá": 4,
      "embalagem água de coco": 5,
      "embalagem abacaxi com hortelã": 6,
    };
    const sortedEmb = (e.data || []).sort((a: any, b: any) => {
      const oA = ordemEmb[a.nome?.toLowerCase()] ?? 99;
      const oB = ordemEmb[b.nome?.toLowerCase()] ?? 99;
      return oA - oB || a.nome.localeCompare(b.nome);
    });
    setEmbalagens(sortedEmb);
    setMovimentacoes(mov.data || []);
  }

  async function addFreezerStock() {
    if (!fzClienteId || !fzSaborId || fzQtd <= 0) {
      return toast({ title: "Preencha todos os campos", variant: "destructive" });
    }
    try {
      // Check if entry already exists
      const { data: existing } = await (supabase as any)
        .from("estoque_freezer")
        .select("id, quantidade")
        .eq("cliente_id", fzClienteId)
        .eq("sabor_id", fzSaborId)
        .maybeSingle();

      if (existing) {
        await (supabase as any)
          .from("estoque_freezer")
          .update({ quantidade: existing.quantidade + fzQtd })
          .eq("id", existing.id);
      } else {
        await (supabase as any)
          .from("estoque_freezer")
          .insert({ cliente_id: fzClienteId, sabor_id: fzSaborId, quantidade: fzQtd });
      }

      toast({ title: "Estoque do freezer atualizado!" });
      setOpenFreezer(false);
      setFzQtd(0);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function removeFreezerItem(id: string) {
    try {
      await (supabase as any).from("estoque_freezer").delete().eq("id", id);
      toast({ title: "Item removido do freezer" });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
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

  async function handleAvaria() {
    if (avariaLoading) return;
    if (!avariaSaborId || avariaQtd <= 0) return toast({ title: "Selecione o sabor e quantidade", variant: "destructive" });
    if (!avariaMotivo.trim()) return toast({ title: "Informe o motivo da avaria", variant: "destructive" });
    setAvariaLoading(true);
    try {
      const geloItem = gelos.find((g: any) => g.sabor_id === avariaSaborId);
      const saborNome = sabores.find((s: any) => s.id === avariaSaborId)?.nome || "Desconhecido";

      // Insert avaria record
      await (supabase as any).from("avarias").insert({
        sabor_id: avariaSaborId,
        quantidade: avariaQtd,
        motivo: avariaMotivo,
        operador: "sistema",
      });

      // Deduct from stock
      if (geloItem) {
        await (supabase as any).from("estoque_gelos")
          .update({ quantidade: geloItem.quantidade - avariaQtd })
          .eq("sabor_id", avariaSaborId);
      }

      // Movement record
      await (supabase as any).from("movimentacoes_estoque").insert({
        tipo_item: "gelo_pronto",
        item_id: avariaSaborId,
        tipo_movimentacao: "saida",
        quantidade: avariaQtd,
        referencia: "avaria",
        operador: "sistema",
      });

      // Deduct embalagem if checked
      let embDescricao = "";
      if (avariaComEmbalagem) {
        const { data: receita } = await (supabase as any)
          .from("sabor_receita")
          .select("embalagem_id")
          .eq("sabor_id", avariaSaborId)
          .single();
        if (receita?.embalagem_id) {
          await (supabase as any)
            .from("embalagens")
            .update({ estoque_atual: (embalagens.find((e: any) => e.id === receita.embalagem_id)?.estoque_atual || 0) - avariaQtd })
            .eq("id", receita.embalagem_id);
          await (supabase as any).from("movimentacoes_estoque").insert({
            tipo_item: "embalagem",
            item_id: receita.embalagem_id,
            tipo_movimentacao: "saida",
            quantidade: avariaQtd,
            referencia: "avaria",
            operador: "sistema",
          });
          embDescricao = " (com perda de embalagem)";
        }
      }

      // Audit
      await (supabase as any).from("auditoria").insert({
        usuario_nome: "sistema",
        modulo: "estoque",
        acao: "avaria",
        registro_afetado: avariaSaborId,
        descricao: `Avaria de ${avariaQtd} un. de ${saborNome}${embDescricao}. Motivo: ${avariaMotivo}`,
      });

      toast({ title: "Avaria registrada!", description: `${avariaQtd} un. de ${saborNome} descontadas do estoque` });
      setOpenAvaria(false);
      setAvariaQtd(0);
      setAvariaMotivo("");
      setAvariaSaborId("");
      setAvariaComEmbalagem(false);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro ao registrar avaria", description: e.message, variant: "destructive" });
    } finally {
      setAvariaLoading(false);
    }
  }

  function openEditAvaria(a: any) {
    setEditAvaria(a);
    setEditAvariaQtd(a.quantidade);
    setEditAvariaMotivo(a.motivo);
  }

  async function handleEditAvaria() {
    if (editAvariaLoading || !editAvaria) return;
    if (editAvariaQtd <= 0) return toast({ title: "Quantidade inválida", variant: "destructive" });
    if (!editAvariaMotivo.trim()) return toast({ title: "Informe o motivo", variant: "destructive" });
    setEditAvariaLoading(true);
    try {
      const diff = editAvariaQtd - editAvaria.quantidade;
      // Update avaria record
      await (supabase as any).from("avarias").update({
        quantidade: editAvariaQtd,
        motivo: editAvariaMotivo,
      }).eq("id", editAvaria.id);
      // Adjust stock (if qty changed)
      if (diff !== 0) {
        const geloItem = gelos.find((g: any) => g.sabor_id === editAvaria.sabor_id);
        if (geloItem) {
          await (supabase as any).from("estoque_gelos")
            .update({ quantidade: geloItem.quantidade - diff })
            .eq("sabor_id", editAvaria.sabor_id);
        }
      }
      toast({ title: "Avaria atualizada!" });
      setEditAvaria(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setEditAvariaLoading(false);
    }
  }

  async function handleDeleteAvaria() {
    if (deleteAvariaLoading || !deleteAvariaId) return;
    setDeleteAvariaLoading(true);
    try {
      const avaria = avarias.find((a: any) => a.id === deleteAvariaId);
      if (avaria) {
        // Restore stock
        const geloItem = gelos.find((g: any) => g.sabor_id === avaria.sabor_id);
        if (geloItem) {
          await (supabase as any).from("estoque_gelos")
            .update({ quantidade: geloItem.quantidade + avaria.quantidade })
            .eq("sabor_id", avaria.sabor_id);
        }
        // Delete related movements
        await (supabase as any).from("movimentacoes_estoque")
          .delete()
          .eq("referencia", "avaria")
          .eq("item_id", avaria.sabor_id)
          .eq("quantidade", avaria.quantidade);
      }
      await (supabase as any).from("avarias").delete().eq("id", deleteAvariaId);
      toast({ title: "Avaria excluída e estoque restaurado!" });
      setDeleteAvariaId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setDeleteAvariaLoading(false);
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

  const getItemColor = (nome: string) => {
    const key = nome?.toLowerCase() || "";
    // Check sabor colors first
    for (const [k, v] of Object.entries(SABOR_COLORS)) {
      if (key.includes(k)) return v;
    }
    return "bg-muted text-foreground border-border";
  };

  const getSaborColor = (nome: string) => {
    const key = nome?.toLowerCase() || "";
    return SABOR_COLORS[key] || "bg-muted text-foreground border-border";
  };

  const totalMaterias = materias.reduce((s, m) => s + (Number(m.estoque_atual) || 0), 0);
  const totalEmbalagens = embalagens.reduce((s, e) => s + (e.estoque_atual || 0), 0);
  const totalFreezers = freezers.reduce((s, f) => s + (f.quantidade || 0), 0);

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
        <TabsList className="flex-wrap">
          <TabsTrigger value="gelos">Gelos Prontos</TabsTrigger>
          <TabsTrigger value="sacos" className="gap-1">📦 Sacos</TabsTrigger>
          <TabsTrigger value="avarias" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" />Avarias</TabsTrigger>
          <TabsTrigger value="freezers" className="gap-1"><Snowflake className="h-3.5 w-3.5" />Freezers</TabsTrigger>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive ml-1"
                          onClick={() => { setAvariaSaborId(g.sabor_id); setOpenAvaria(true); }}
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" /> Avaria
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sacos">
          <SacosTab factoryId={factoryId} />
        </TabsContent>

        <TabsContent value="avarias">
          <div className="flex justify-end mb-4">
            <Dialog open={openAvaria} onOpenChange={setOpenAvaria}>
              <DialogTrigger asChild>
                <Button variant="destructive"><AlertTriangle className="h-4 w-4 mr-2" />Registrar Avaria</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar Avaria de Gelo</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Sabor</Label>
                    <Select value={avariaSaborId} onValueChange={setAvariaSaborId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o sabor" /></SelectTrigger>
                      <SelectContent>
                        {sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantidade perdida</Label>
                    <Input type="number" min={1} value={avariaQtd || ""} onChange={(e) => setAvariaQtd(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Motivo <span className="text-destructive">*</span></Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {["Derreteu no transporte", "Derreteu na freezer", "Embalagem furada", "Caiu no chão", "Defeito de produção"].map((m) => (
                        <Button
                          key={m}
                          type="button"
                          size="sm"
                          variant={avariaMotivo === m ? "default" : "outline"}
                          onClick={() => setAvariaMotivo(avariaMotivo === m ? "" : m)}
                        >
                          {m}
                        </Button>
                      ))}
                    </div>
                    <Textarea placeholder="Ou descreva outro motivo..." value={avariaMotivo} onChange={(e) => setAvariaMotivo(e.target.value)} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="avaria-emb" checked={avariaComEmbalagem} onCheckedChange={(v) => setAvariaComEmbalagem(!!v)} />
                    <Label htmlFor="avaria-emb" className="cursor-pointer text-sm">Perda inclui embalagem</Label>
                  </div>
                  <Button className="w-full" variant="destructive" onClick={handleAvaria} disabled={avariaLoading}>
                    {avariaLoading ? "Registrando..." : "Confirmar Avaria"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {avarias.length > 0 && (
            <>
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card><CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Avarias</p>
                  <p className="text-2xl font-bold text-destructive">{avarias.reduce((s: number, a: any) => s + a.quantidade, 0).toLocaleString()} un.</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground">Registros</p>
                  <p className="text-2xl font-bold">{avarias.length}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground">Sabor Mais Afetado</p>
                  <p className="text-sm font-bold truncate">{(() => {
                    const counts: Record<string, number> = {};
                    avarias.forEach((a: any) => { counts[a.sabores?.nome || "?"] = (counts[a.sabores?.nome || "?"] || 0) + a.quantidade; });
                    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
                  })()}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-3 text-center">
                  <p className="text-xs text-muted-foreground">Este Mês</p>
                  <p className="text-2xl font-bold text-destructive">{avarias.filter((a: any) => {
                    const d = new Date(a.created_at); const now = new Date();
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  }).reduce((s: number, a: any) => s + a.quantidade, 0).toLocaleString()} un.</p>
                </CardContent></Card>
              </div>
              <div className="mb-6">
                <p className="text-sm text-muted-foreground font-medium mb-3">Avarias por Sabor</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {(() => {
                    const porSabor: Record<string, { nome: string; qtd: number }> = {};
                    avarias.forEach((a: any) => {
                      const sn = a.sabores?.nome || "?";
                      if (!porSabor[sn]) porSabor[sn] = { nome: sn, qtd: 0 };
                      porSabor[sn].qtd += a.quantidade;
                    });
                    return Object.values(porSabor)
                      .sort((a, b) => b.qtd - a.qtd)
                      .map((s) => (
                        <div
                          key={s.nome}
                          className={`rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] ${getSaborColor(s.nome)} opacity-80`}
                        >
                          <p className="text-[11px] font-semibold truncate">{s.nome}</p>
                          <p className="text-lg font-extrabold mt-0.5">-{s.qtd.toLocaleString()}</p>
                        </div>
                      ));
                  })()}
                </div>
              </div>
            </>
          )}

          <Card><CardContent className="pt-6">
            {avarias.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma avaria registrada.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Sabor</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {avarias.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{new Date(a.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-medium">{a.sabores?.nome}</TableCell>
                      <TableCell className="text-destructive font-semibold">-{a.quantidade}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{a.motivo}</TableCell>
                      <TableCell>{a.operador}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditAvaria(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteAvariaId(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>

          {/* Edit Avaria Dialog */}
          <Dialog open={!!editAvaria} onOpenChange={(o) => !o && setEditAvaria(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Editar Avaria — {editAvaria?.sabores?.nome}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min={1} value={editAvariaQtd || ""} onChange={(e) => setEditAvariaQtd(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Motivo</Label>
                  <Textarea value={editAvariaMotivo} onChange={(e) => setEditAvariaMotivo(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleEditAvaria} disabled={editAvariaLoading}>
                  {editAvariaLoading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Avaria Confirmation */}
          <AlertDialog open={!!deleteAvariaId} onOpenChange={(o) => !o && setDeleteAvariaId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Avaria?</AlertDialogTitle>
                <AlertDialogDescription>
                  O estoque será restaurado automaticamente. Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAvaria} disabled={deleteAvariaLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleteAvariaLoading ? "Excluindo..." : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="mp">
          {materias.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground font-medium">Matérias-Primas</p>
                <Badge variant="secondary" className="text-xs font-bold">Total: {(totalMaterias / 1000).toFixed(1)} kg</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {materias.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] cursor-pointer ${getItemColor(m.nome)}`}
                    onClick={() => openAjusteDialog("mp", m.id, m.estoque_atual)}
                  >
                    <p className="text-[11px] font-semibold truncate">{m.nome}</p>
                    <p className="text-lg font-extrabold mt-0.5">{(Number(m.estoque_atual) / 1000).toFixed(1)}kg</p>
                  </div>
                ))}
                <div className="rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] bg-gray-700/90 text-white border-gray-800">
                  <p className="text-[11px] font-semibold truncate">TOTAL</p>
                  <p className="text-lg font-extrabold mt-0.5">{(totalMaterias / 1000).toFixed(1)}kg</p>
                </div>
              </div>
            </div>
          )}
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
          {embalagens.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground font-medium">Embalagens por Tipo</p>
                <Badge variant="secondary" className="text-xs font-bold">Total: {totalEmbalagens.toLocaleString()} un.</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {embalagens.map((e) => (
                  <div
                    key={e.id}
                    className={`rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] cursor-pointer ${getItemColor(e.nome)}`}
                    onClick={() => openAjusteDialog("emb", e.id, e.estoque_atual)}
                  >
                    <p className="text-[11px] font-semibold truncate">{e.nome}</p>
                    <p className="text-lg font-extrabold mt-0.5">{(e.estoque_atual || 0).toLocaleString()}</p>
                  </div>
                ))}
                <div className="rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] bg-gray-700/90 text-white border-gray-800">
                  <p className="text-[11px] font-semibold truncate">TOTAL</p>
                  <p className="text-lg font-extrabold mt-0.5">{totalEmbalagens.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
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
          {movimentacoes.length > 0 && (
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Total Entradas</p>
                <p className="text-2xl font-bold text-emerald-600">{movimentacoes.filter(m => m.tipo_movimentacao === "entrada").reduce((s, m) => s + Number(m.quantidade), 0).toLocaleString()}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Total Saídas</p>
                <p className="text-2xl font-bold text-destructive">{movimentacoes.filter(m => m.tipo_movimentacao === "saida").reduce((s, m) => s + Number(m.quantidade), 0).toLocaleString()}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Registros</p>
                <p className="text-2xl font-bold">{movimentacoes.length}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Última Mov.</p>
                <p className="text-sm font-bold">{movimentacoes[0] ? new Date(movimentacoes[0].created_at).toLocaleDateString("pt-BR") : "-"}</p>
              </CardContent></Card>
            </div>
          )}
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

        <TabsContent value="freezers">
          {freezers.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground font-medium">Freezers por Sabor</p>
                <Badge variant="secondary" className="text-xs font-bold">Total: {totalFreezers.toLocaleString()} un.</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {(() => {
                  const porSabor: Record<string, { nome: string; qtd: number }> = {};
                  freezers.forEach((f) => {
                    const sn = f.sabores?.nome || "?";
                    if (!porSabor[sn]) porSabor[sn] = { nome: sn, qtd: 0 };
                    porSabor[sn].qtd += f.quantidade || 0;
                  });
                  return Object.values(porSabor)
                    .sort((a, b) => b.qtd - a.qtd)
                    .map((s) => (
                      <div
                        key={s.nome}
                        className={`rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] ${getSaborColor(s.nome)}`}
                      >
                        <p className="text-[11px] font-semibold truncate">{s.nome}</p>
                        <p className="text-lg font-extrabold mt-0.5">{s.qtd.toLocaleString()}</p>
                      </div>
                    ));
                })()}
                <div className="rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] bg-gray-700/90 text-white border-gray-800">
                  <p className="text-[11px] font-semibold truncate">TOTAL</p>
                  <p className="text-lg font-extrabold mt-0.5">{totalFreezers.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end mb-4">
            <Dialog open={openFreezer} onOpenChange={setOpenFreezer}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Adicionar ao Freezer</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Adicionar Estoque ao Freezer</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Cliente (com freezer)</Label>
                    <Select value={fzClienteId} onValueChange={setFzClienteId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sabor</Label>
                    <Select value={fzSaborId} onValueChange={setFzSaborId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o sabor" /></SelectTrigger>
                      <SelectContent>
                        {sabores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantidade (unidades)</Label>
                    <Input type="number" min={1} value={fzQtd || ""} onChange={(e) => setFzQtd(Number(e.target.value))} />
                  </div>
                  <Button className="w-full" onClick={addFreezerStock}>Confirmar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="pt-6">
              {freezers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum item nos freezers. Adicione usando o botão acima.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Sabor</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Atualizado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freezers.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.clientes?.nome}</TableCell>
                        <TableCell>{f.sabores?.nome}</TableCell>
                        <TableCell>{f.quantidade} un.</TableCell>
                        <TableCell>{new Date(f.updated_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeFreezerItem(f.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}