import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CupSoda, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { maskBRL, parseBRL, numberToBRL } from "@/lib/currency-mask";
import { toast } from "sonner";

/** Bebida do catálogo — sem controle de estoque, apenas nome e preço. */
export interface Bebida {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_fardo: number | null;
  unidades_fardo: number;
  ativo: boolean;
}

export default function Bebidas() {
  const { factoryId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bebidas, setBebidas] = useState<Bebida[]>([]);
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Bebida | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [precoFardo, setPrecoFardo] = useState("");
  const [unidadesFardo, setUnidadesFardo] = useState("6");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removendo, setRemovendo] = useState<Bebida | null>(null);

  useEffect(() => {
    document.title = "Bebidas | Cadastro de produtos";
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factoryId]);

  async function load() {
    setLoading(true);
    try {
      let q = (supabase as any).from("bebidas").select("*").order("nome");
      if (factoryId) q = q.eq("factory_id", factoryId);
      const { data, error } = await q;
      if (error) throw error;
      setBebidas((data || []) as Bebida[]);
    } catch (e) {
      console.error("Erro ao carregar bebidas:", e);
      toast.error("Não foi possível carregar as bebidas.");
    } finally {
      setLoading(false);
    }
  }

  function abrirNovo() {
    setEditando(null);
    setNome("");
    setDescricao("");
    setPreco("");
    setPrecoFardo("");
    setUnidadesFardo("6");
    setAtivo(true);
    setOpen(true);
  }

  function abrirEdicao(b: Bebida) {
    setEditando(b);
    setNome(b.nome);
    setDescricao(b.descricao || "");
    setPreco(numberToBRL(Number(b.preco)));
    setPrecoFardo(b.preco_fardo != null ? numberToBRL(Number(b.preco_fardo)) : "");
    setUnidadesFardo(String(b.unidades_fardo ?? 6));
    setAtivo(b.ativo);
    setOpen(true);
  }

  async function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome da bebida.");
    if (!factoryId) return toast.error("Fábrica não identificada.");
    const valor = parseBRL(preco);
    if (valor <= 0) return toast.error("Informe um preço válido.");

    setSaving(true);
    try {
      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        preco: valor,
        preco_fardo: parseBRL(precoFardo) > 0 ? parseBRL(precoFardo) : null,
        unidades_fardo: Math.max(1, Number(unidadesFardo) || 6),
        ativo,
        factory_id: factoryId,
      };
      if (editando) {
        const { error } = await (supabase as any).from("bebidas").update(payload).eq("id", editando.id);
        if (error) throw error;
        toast.success("Bebida atualizada.");
      } else {
        const { error } = await (supabase as any).from("bebidas").insert(payload);
        if (error) throw error;
        toast.success("Bebida cadastrada.");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      console.error("Erro ao salvar bebida:", e);
      toast.error(e?.message || "Não foi possível salvar a bebida.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    if (!removendo) return;
    try {
      const { error } = await (supabase as any).from("bebidas").delete().eq("id", removendo.id);
      if (error) throw error;
      toast.success("Bebida removida.");
      setRemovendo(null);
      load();
    } catch (e: any) {
      console.error("Erro ao excluir bebida:", e);
      toast.error("Não foi possível remover. Ela pode estar vinculada a vendas.");
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <CupSoda className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bebidas</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre as bebidas e os preços para incluir nas comandas de venda.
            </p>
          </div>
        </div>
        <Button onClick={abrirNovo} className="gap-2">
          <Plus className="h-4 w-4" /> Nova bebida
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando bebidas...
        </div>
      ) : bebidas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma bebida cadastrada ainda. Clique em “Nova bebida” para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {bebidas.map((b) => (
            <Card key={b.id} className={b.ativo ? "" : "opacity-60"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="truncate">{b.nome}</span>
                  <Badge variant={b.ativo ? "secondary" : "outline"}>
                    {b.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {b.descricao && <p className="text-xs text-muted-foreground">{b.descricao}</p>}
                <div>
                  <p className="text-xl font-bold">R$ {Number(b.preco).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">/ unidade</span></p>
                  {b.preco_fardo != null && (
                    <p className="text-sm font-semibold text-primary">
                      R$ {Number(b.preco_fardo).toFixed(2)} <span className="text-xs font-normal text-muted-foreground">/ fardo ({b.unidades_fardo ?? 6} un)</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => abrirEdicao(b)}>
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => setRemovendo(b)}>
                    <Trash2 className="h-3 w-3" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar bebida" : "Nova bebida"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Coca-Cola 350ml" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Lata gelada" />
            </div>
            <div>
              <Label>Preço por unidade</Label>
              <Input
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(maskBRL(e.target.value))}
                placeholder="0,00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço do fardo (opcional)</Label>
                <Input
                  inputMode="decimal"
                  value={precoFardo}
                  onChange={(e) => setPrecoFardo(maskBRL(e.target.value))}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Unidades por fardo</Label>
                <Input
                  type="number"
                  min={1}
                  value={unidadesFardo}
                  onChange={(e) => setUnidadesFardo(e.target.value)}
                  placeholder="6"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Sem preço de fardo informado, o sistema calcula preço unitário × unidades por fardo.
            </p>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Disponível para venda</Label>
                <p className="text-xs text-muted-foreground">Bebidas inativas não aparecem na comanda.</p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removendo} onOpenChange={(o) => !o && setRemovendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover “{removendo?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              A bebida deixará de aparecer no cadastro e nas novas comandas. Vendas já registradas mantêm o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
