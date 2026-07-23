import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Camera, Plus, Target } from "lucide-react";
import { uploadOpFoto, getOpFotoUrl } from "@/lib/op-externa-photo";

export default function Prospeccao() {
  const { user, factoryId } = useAuth();
  const [form, setForm] = useState({ nome_estabelecimento: "", endereco: "", contato: "", telefone: "", observacoes: "", interesse: "medio" });
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [lista, setLista] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  async function carregar() {
    if (!user?.id) return;
    const { data } = await (supabase as any).from("prospeccoes_externas").select("*").eq("auxiliar_user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setLista(data ?? []);
  }
  useEffect(() => { carregar(); }, [user?.id]);

  async function handleFoto(file: File) {
    if (!user?.id) return;
    const path = `${user.id}/prospeccao/${Date.now()}.jpg`;
    await uploadOpFoto(path, file);
    setFotoPath(path);
    setFotoUrl(await getOpFotoUrl(path));
  }

  async function salvar() {
    if (!user?.id || !factoryId || !form.nome_estabelecimento) {
      return toast({ title: "Nome do estabelecimento obrigatório", variant: "destructive" });
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("prospeccoes_externas").insert({
        ...form, auxiliar_user_id: user.id, factory_id: factoryId, foto_url: fotoPath,
      });
      if (error) throw error;
      toast({ title: "Prospecção registrada! +pontos ganhos" });
      setForm({ nome_estabelecimento: "", endereco: "", contato: "", telefone: "", observacoes: "", interesse: "medio" });
      setFotoPath(null); setFotoUrl(null);
      carregar();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Target className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Nova Prospecção</h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div><Label>Nome do estabelecimento *</Label><Input value={form.nome_estabelecimento} onChange={(e) => setForm(s => ({ ...s, nome_estabelecimento: e.target.value }))} /></div>
          <div><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm(s => ({ ...s, endereco: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Contato</Label><Input value={form.contato} onChange={(e) => setForm(s => ({ ...s, contato: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm(s => ({ ...s, telefone: e.target.value }))} /></div>
          </div>
          <div>
            <Label>Nível de interesse</Label>
            <Select value={form.interesse} onValueChange={(v) => setForm(s => ({ ...s, interesse: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alto">Alto — fechou / vai fechar</SelectItem>
                <SelectItem value="medio">Médio — demonstrou interesse</SelectItem>
                <SelectItem value="baixo">Baixo — só recebeu material</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Observações</Label><Textarea rows={3} value={form.observacoes} onChange={(e) => setForm(s => ({ ...s, observacoes: e.target.value }))} /></div>
          {fotoUrl && <img src={fotoUrl} alt="foto" className="w-full max-h-48 object-cover rounded" />}
          <label className="block">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFoto(e.target.files[0])} />
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-accent">
              <Camera className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs">{fotoPath ? "Trocar foto" : "Anexar foto do local"}</p>
            </div>
          </label>
          <Button className="w-full gap-2" onClick={salvar} disabled={saving}><Plus className="h-4 w-4" /> Registrar prospecção</Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-semibold mb-2">Últimas prospecções</h2>
        <div className="space-y-2">
          {lista.map((p) => (
            <Card key={p.id}><CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.nome_estabelecimento}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <Badge variant={p.interesse === "alto" ? "default" : "secondary"}>{p.interesse}</Badge>
              </div>
            </CardContent></Card>
          ))}
          {lista.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma prospecção ainda.</p>}
        </div>
      </div>
    </div>
  );
}