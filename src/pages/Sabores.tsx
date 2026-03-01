import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ImagePlus, X, Upload } from "lucide-react";

export default function Sabores() {
  const [sabores, setSabores] = useState<any[]>([]);
  const [receitas, setReceitas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  // Image management
  const [imageDialog, setImageDialog] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

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
        toast({ title: "Sabor atualizado!" });
      } else {
        const { error } = await (supabase as any).from("sabores").insert({ nome: nome.trim() });
        if (error) throw error;
        toast({ title: "Sabor cadastrado!" });
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

      // Remove old image if exists
      await supabase.storage.from("sabor-images").remove([path]);

      const { error: uploadError } = await supabase.storage
        .from("sabor-images")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("sabor-images")
        .getPublicUrl(path);

      // Add cache buster
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
      // Try to remove all possible extensions
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

      {/* Dialog Imagem */}
      <Dialog open={!!imageDialog} onOpenChange={(v) => !v && setImageDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Imagem — {imageDialog?.nome}</DialogTitle>
          </DialogHeader>
          {imageDialog && (
            <div className="space-y-4">
              {/* Preview */}
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

              {/* Upload */}
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
                <TableHead>Insumo</TableHead>
                <TableHead>g/lote</TableHead>
                <TableHead>Embalagem</TableHead>
                <TableHead>Gelos/Lote</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sabores.map((s) => {
                const r = getReceita(s.id);
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
                    <TableCell>{r?.materias_primas?.nome || "-"}</TableCell>
                    <TableCell>{r?.quantidade_insumo_por_lote || "-"}</TableCell>
                    <TableCell>{r?.embalagens?.nome || "-"}</TableCell>
                    <TableCell>{r?.gelos_por_lote || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={s.ativo ? "default" : "destructive"}
                        className="cursor-pointer"
                        onClick={() => handleToggleStatus(s)}
                      >{s.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
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
