import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Camera, Plus } from "lucide-react";
import { uploadOpFoto, getOpFotoUrl } from "@/lib/op-externa-photo";

const TIPOS = [
  { v: "freezer_desligado", l: "Freezer desligado" },
  { v: "produto_estranho", l: "Produto estranho no freezer" },
  { v: "cliente_ausente", l: "Cliente ausente" },
  { v: "ruptura", l: "Ruptura de estoque" },
  { v: "problema_pagamento", l: "Problema de pagamento" },
  { v: "outros", l: "Outros" },
];

export default function Ocorrencias() {
  const { user, factoryId } = useAuth();
  const [tipo, setTipo] = useState("freezer_desligado");
  const [clienteId, setClienteId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [lista, setLista] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  async function carregar() {
    if (factoryId) {
      const { data: cs } = await (supabase as any).from("clientes")
        .select("id,nome").eq("factory_id", factoryId).order("nome").limit(500);
      setClientes(cs ?? []);
    } else {
      setClientes([]);
    }
    if (!user?.id || !factoryId) return;
    const { data } = await (supabase as any).from("ocorrencias_externas")
      .select("*, clientes(nome)").eq("auxiliar_user_id", user.id).eq("factory_id", factoryId)
      .order("created_at", { ascending: false }).limit(20);
    setLista(data ?? []);
  }
  useEffect(() => { carregar(); }, [user?.id, factoryId]);

  async function handleFoto(file: File) {
    if (!user?.id) return;
    const path = `${user.id}/ocorrencia/${Date.now()}.jpg`;
    await uploadOpFoto(path, file);
    setFotoPath(path);
    setFotoUrl(await getOpFotoUrl(path));
  }

  async function salvar() {
    if (!user?.id || !factoryId) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("ocorrencias_externas").insert({
        auxiliar_user_id: user.id, factory_id: factoryId, cliente_id: clienteId || null,
        tipo, descricao, foto_url: fotoPath,
      });
      if (error) throw error;
      toast({ title: "Ocorrência registrada" });
      setDescricao(""); setFotoPath(null); setFotoUrl(null); setClienteId("");
      carregar();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Ocorrências</h1>
      </div>

      <Card><CardContent className="p-4 space-y-3">
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Cliente (opcional)</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Descrição</Label><Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        {fotoUrl && <img src={fotoUrl} alt="" className="w-full max-h-48 object-cover rounded" />}
        <label className="block">
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFoto(e.target.files[0])} />
          <div className="border-2 border-dashed rounded p-3 text-center cursor-pointer hover:bg-accent">
            <Camera className="h-5 w-5 mx-auto" /><span className="text-xs">Anexar foto</span>
          </div>
        </label>
        <Button onClick={salvar} disabled={saving} className="w-full gap-2"><Plus className="h-4 w-4" /> Registrar ocorrência</Button>
      </CardContent></Card>

      <div className="space-y-2">
        {lista.map((o) => (
          <Card key={o.id}><CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium truncate">{TIPOS.find(t => t.v === o.tipo)?.l ?? o.tipo}</p>
                <p className="text-xs text-muted-foreground truncate">{o.clientes?.nome ?? "Sem cliente"} • {new Date(o.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <Badge variant={o.status === "resolvida" ? "secondary" : "destructive"}>{o.status ?? "aberta"}</Badge>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}