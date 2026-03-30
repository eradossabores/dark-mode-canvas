import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ImagePlus, X, Upload, FlaskConical } from "lucide-react";

export default function Sabores() {
  const { factoryId } = useAuth();
  const [sabores, setSabores] = useState<any[]>([]);
  const [receitas, setReceitas] = useState<any[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  // Multi-ingredient dialog
  const [ingredientDialog, setIngredientDialog] = useState<any>(null);
  const [selectedMpId, setSelectedMpId] = useState("");
  const [selectedGrams, setSelectedGrams] = useState("100");

  // Image management
  const [imageDialog, setImageDialog] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadData(); }, [factoryId]);

  async function loadData() {
    let sQ = (supabase as any).from("sabores").select("*").order("nome");
    let rQ = (supabase as any).from("sabor_receita").select("*, materias_primas(nome), embalagens(nome)");
    let mpQ = (supabase as any).from("materias_primas").select("id, nome").order("nome");
    if (factoryId) { sQ = sQ.eq("factory_id", factoryId); rQ = rQ.eq("factory_id", factoryId); mpQ = mpQ.eq("factory_id", factoryId); }
    const [s, r, mp] = await Promise.all([sQ, rQ, mpQ]);
    setSabores(s.data || []);
    setReceitas(r.data || []);
    setMateriasPrimas(mp.data || []);
  }

  function getReceitas(saborId: string) {
    return receitas.filter((r) => r.sabor_id === saborId);
  }

  function openNew() {
    setEditingId(null);
    setNome("");
    setOpen(true);
  }

  function openEdit(s: any) {
    setEditingId(s.id);
    setNome(s.nome);
    setOpen(true);
  }

  async function handleSubmit() {
    if (!nome.trim()) return toast({ title: "Nome obrigatório", variant: "destructive" });
    try {
      if (editingId) {
        const { error } = await (supabase as any).from("sabores").update({ nome: nome.trim() }).eq("id", editingId);
        if (error) throw error;

        // Update linked matéria-prima and embalagem names only for single-ingredient recipes
        const receitasList = getReceitas(editingId);
        if (receitasList.length === 1) {
          const receita = receitasList[0];
          await Promise.all([
            (supabase as any).from("materias_primas").update({ nome: `Insumo ${nome.trim()}` }).eq("id", receita.materia_prima_id),
            (supabase as any).from("embalagens").update({ nome: `Embalagem ${nome.trim()}` }).eq("id", receita.embalagem_id),
          ]);
        }

        toast({ title: "Sabor atualizado!" });
      } else {
        const saborNome = nome.trim();
        const payload: any = { nome: saborNome };
        if (factoryId) payload.factory_id = factoryId;
        const { data: newSabor, error } = await (supabase as any).from("sabores").insert(payload).select().single();
        if (error) throw error;

        // Auto-create matéria-prima
        const mpPayload: any = { nome: `Insumo ${saborNome}`, unidade: "g", estoque_atual: 0, estoque_minimo: 500 };
        if (factoryId) mpPayload.factory_id = factoryId;
        const { data: newMP, error: mpErr } = await (supabase as any).from("materias_primas").insert(mpPayload).select().single();
        if (mpErr) throw mpErr;

        // Auto-create embalagem
        const embPayload: any = { nome: `Embalagem ${saborNome}`, estoque_atual: 0, estoque_minimo: 100 };
        if (factoryId) embPayload.factory_id = factoryId;
        const { data: newEmb, error: embErr } = await (supabase as any).from("embalagens").insert(embPayload).select().single();
        if (embErr) throw embErr;

        // Auto-create receita
        const receitaPayload: any = {
          sabor_id: newSabor.id,
          materia_prima_id: newMP.id,
          embalagem_id: newEmb.id,
          quantidade_insumo_por_lote: 400,
          gelos_por_lote: 84,
          embalagens_por_lote: 84,
        };
        if (factoryId) receitaPayload.factory_id = factoryId;
        const { error: recErr } = await (supabase as any).from("sabor_receita").insert(receitaPayload);
        if (recErr) throw recErr;

        // Auto-create estoque_gelos
        const estoquePayload: any = { sabor_id: newSabor.id, quantidade: 0 };
        if (factoryId) estoquePayload.factory_id = factoryId;
        await (supabase as any).from("estoque_gelos").insert(estoquePayload);

        toast({ title: "Sabor cadastrado com insumo e embalagem!" });
      }
      setOpen(false);
      setEditingId(null);
      setNome("");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleToggleStatus(s: any) {
    try {
      await (supabase as any).from("sabores").update({ ativo: !s.ativo }).eq("id", s.id);
      toast({ title: `Sabor ${!s.ativo ? "ativado" : "desativado"}!` });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any).from("sabores").update({ ativo: false }).eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Sabor desativado!" });
      setDeleteId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  // --- Multi-ingredient management ---
  async function handleAddIngredient() {
    if (!ingredientDialog || !selectedMpId || !selectedGrams) return;
    try {
      // Get the first receita for embalagem info
      const existingReceitas = getReceitas(ingredientDialog.id);
      const firstReceita = existingReceitas[0];
      if (!firstReceita) return toast({ title: "Receita base não encontrada", variant: "destructive" });

      const payload: any = {
        sabor_id: ingredientDialog.id,
        materia_prima_id: selectedMpId,
        embalagem_id: firstReceita.embalagem_id,
        quantidade_insumo_por_lote: Number(selectedGrams),
        gelos_por_lote: firstReceita.gelos_por_lote,
        embalagens_por_lote: firstReceita.embalagens_por_lote,
      };
      if (factoryId) payload.factory_id = factoryId;

      const { error } = await (supabase as any).from("sabor_receita").insert(payload);
      if (error) throw error;

      toast({ title: "Ingrediente adicionado!" });
      setSelectedMpId("");
      setSelectedGrams("100");
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleRemoveIngredient(receitaId: string, saborId: string) {
    const saborReceitas = getReceitas(saborId);
    if (saborReceitas.length <= 1) {
      return toast({ title: "Mínimo 1 ingrediente", description: "Cada sabor precisa de pelo menos 1 ingrediente.", variant: "destructive" });
    }
    try {
      const { error } = await (supabase as any).from("sabor_receita").delete().eq("id", receitaId);
      if (error) throw error;
      toast({ title: "Ingrediente removido!" });
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  // --- Image management ---
  async function handleImageUpload(file: File, saborId: string) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast({ title: "Arquivo inválido", description: "Envie uma imagem (JPG, PNG, WEBP)", variant: "destructive" });
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast({ title: "Arquivo muito grande", description: "Máximo 5MB", variant: "destructive" });
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${saborId}.${ext}`;
      await supabase.storage.from("sabor-images").remove([path]);

      const { error: uploadError } = await supabase.storage
        .from("sabor-images")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("sabor-images")
        .getPublicUrl(path);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await (supabase as any)
        .from("sabores")
        .update({ imagem_url: publicUrl })
        .eq("id", saborId);
      if (updateError) throw updateError;

      toast({ title: "Imagem atualizada! ✅" });
      setImageDialog(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveImage(saborId: string) {
    try {
      const extensions = ["jpg", "jpeg", "png", "webp", "gif"];
      const paths = extensions.map((ext) => `${saborId}.${ext}`);
      await supabase.storage.from("sabor-images").remove(paths);

      await (supabase as any)
        .from("sabores")
        .update({ imagem_url: null })
        .eq("id", saborId);

      toast({ title: "Imagem removida!" });
      setImageDialog(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  // Get available materias primas that are not yet in this sabor's receita
  function getAvailableMPs(saborId: string) {
    const usedIds = getReceitas(saborId).map((r) => r.materia_prima_id);
    return materiasPrimas.filter((mp) => !usedIds.includes(mp.id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sabores</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Sabor</Button>
      </div>

      {/* Dialog Novo/Editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Sabor" : "Novo Sabor"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <Button className="w-full" onClick={handleSubmit}>{editingId ? "Salvar" : "Cadastrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Ingredientes */}
      <Dialog open={!!ingredientDialog} onOpenChange={(v) => !v && setIngredientDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Ingredientes — {ingredientDialog?.nome}
            </DialogTitle>
          </DialogHeader>
          {ingredientDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure os insumos utilizados na receita deste sabor. Cada ingrediente será descontado automaticamente do estoque ao produzir.
              </p>

              {/* Current ingredients */}
              <div className="space-y-2">
                {getReceitas(ingredientDialog.id).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 bg-card">
                    <div>
                      <span className="font-medium text-sm">{r.materias_primas?.nome || "?"}</span>
                      <span className="text-xs text-muted-foreground ml-2">{r.quantidade_insumo_por_lote}g/lote</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleRemoveIngredient(r.id, ingredientDialog.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add new ingredient */}
              {getAvailableMPs(ingredientDialog.id).length > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <Label className="text-sm font-medium">Adicionar Ingrediente</Label>
                  <Select value={selectedMpId} onValueChange={setSelectedMpId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o insumo" /></SelectTrigger>
                    <SelectContent>
                      {getAvailableMPs(ingredientDialog.id).map((mp) => (
                        <SelectItem key={mp.id} value={mp.id}>{mp.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Gramas por lote</Label>
                      <Input
                        type="number"
                        min={1}
                        value={selectedGrams}
                        onChange={(e) => setSelectedGrams(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleAddIngredient} disabled={!selectedMpId}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Imagem */}
      <Dialog open={!!imageDialog} onOpenChange={(v) => !v && setImageDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Imagem — {imageDialog?.nome}</DialogTitle>
          </DialogHeader>
          {imageDialog && (
            <div className="space-y-4">
              {imageDialog.imagem_url ? (
                <div className="relative">
                  <img
                    src={imageDialog.imagem_url}
                    alt={imageDialog.nome}
                    className="w-full h-48 object-cover rounded-xl border border-border"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full"
                    onClick={() => handleRemoveImage(imageDialog.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="w-full h-48 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <ImagePlus className="h-10 w-10" />
                  <p className="text-sm">Nenhuma imagem</p>
                </div>
              )}
              <div>
                <Label className="cursor-pointer">
                  <div className={`flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 p-3 hover:bg-muted transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {uploading ? "Enviando..." : "Escolher nova imagem"}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, imageDialog.id);
                    }}
                  />
                </Label>
                <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
                  JPG, PNG ou WEBP • Máximo 5MB
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Alert desativar */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar sabor?</AlertDialogTitle>
            <AlertDialogDescription>O sabor será marcado como inativo e não aparecerá nas opções de produção/vendas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Foto</TableHead>
                <TableHead>Sabor</TableHead>
                <TableHead>Insumos</TableHead>
                <TableHead>g/lote</TableHead>
                <TableHead>Gelos/Lote</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sabores.map((s) => {
                const rList = getReceitas(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <button
                        onClick={() => setImageDialog(s)}
                        className="w-12 h-12 rounded-lg border border-border overflow-hidden bg-muted/50 hover:ring-2 hover:ring-primary/40 transition-all flex items-center justify-center"
                      >
                        {s.imagem_url ? (
                          <img src={s.imagem_url} alt={s.nome} className="w-full h-full object-cover" />
                        ) : (
                          <ImagePlus className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rList.length > 0 ? rList.map((r, i) => (
                          <Badge key={r.id} variant="outline" className="text-[11px]">
                            {r.materias_primas?.nome?.replace("Insumo ", "") || "?"}
                          </Badge>
                        )) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {rList.length > 0 ? (
                        <div className="text-xs space-y-0.5">
                          {rList.map((r) => (
                            <div key={r.id}>{r.quantidade_insumo_por_lote}g</div>
                          ))}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{rList[0]?.gelos_por_lote || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={s.ativo ? "default" : "destructive"}
                        className="cursor-pointer"
                        onClick={() => handleToggleStatus(s)}
                      >{s.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => { setIngredientDialog(s); setSelectedMpId(""); setSelectedGrams("100"); }} title="Gerenciar ingredientes">
                        <FlaskConical className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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