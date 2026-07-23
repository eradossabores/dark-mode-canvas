import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { MapPin, Navigation, Plus, Trash2, PlayCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Cliente { id: string; nome: string; endereco?: string; telefone?: string }
interface Parada {
  id: string; cliente_id: string | null; ordem: number; quantidade_prevista: number;
  status: string; clientes?: Cliente | null;
}

export default function MinhaRota() {
  const { user, factoryId } = useAuth();
  const [rotaId, setRotaId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pendente");
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [novoCliente, setNovoCliente] = useState<string>("");
  const [novoQtd, setNovoQtd] = useState<string>("0");

  async function carregar() {
    if (!user?.id) return;
    const hoje = new Date().toISOString().split("T")[0];
    const { data: rota } = await (supabase as any)
      .from("rotas_externas").select("*")
      .eq("auxiliar_user_id", user.id).eq("data", hoje).maybeSingle();
    if (rota) { setRotaId(rota.id); setStatus(rota.status); await carregarParadas(rota.id); }
    else { setRotaId(null); setParadas([]); }

    const { data: cs } = await (supabase as any).from("clientes").select("id,nome,endereco,telefone").order("nome").limit(500);
    setClientes(cs ?? []);
  }

  async function carregarParadas(rid: string) {
    const { data } = await (supabase as any)
      .from("rota_paradas").select("*, clientes(id,nome,endereco,telefone)").eq("rota_id", rid).order("ordem");
    setParadas(data ?? []);
  }

  useEffect(() => { carregar(); }, [user?.id]);

  async function criarRota() {
    if (!user?.id || !factoryId) return;
    const { data, error } = await (supabase as any)
      .from("rotas_externas").insert({ auxiliar_user_id: user.id, factory_id: factoryId, data: new Date().toISOString().split("T")[0] })
      .select().single();
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setRotaId(data.id); setStatus(data.status);
  }

  async function iniciarRota() {
    if (!rotaId) return;
    await (supabase as any).from("rotas_externas").update({ status: "em_andamento", iniciada_em: new Date().toISOString() }).eq("id", rotaId);
    setStatus("em_andamento");
    toast({ title: "Rota iniciada!" });
  }

  async function finalizarRota() {
    if (!rotaId) return;
    await (supabase as any).from("rotas_externas").update({ status: "finalizada", finalizada_em: new Date().toISOString() }).eq("id", rotaId);
    setStatus("finalizada");
    toast({ title: "Rota finalizada" });
  }

  async function addParada() {
    if (!rotaId || !novoCliente || !factoryId) return;
    const ordem = paradas.length + 1;
    const { error } = await (supabase as any).from("rota_paradas").insert({
      rota_id: rotaId, cliente_id: novoCliente, ordem, quantidade_prevista: Number(novoQtd) || 0, factory_id: factoryId,
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setNovoCliente(""); setNovoQtd("0");
    await carregarParadas(rotaId);
  }

  async function removerParada(id: string) {
    await (supabase as any).from("rota_paradas").delete().eq("id", id);
    if (rotaId) await carregarParadas(rotaId);
  }

  function abrirMapa(p: Parada) {
    const q = encodeURIComponent(p.clientes?.endereco || p.clientes?.nome || "");
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Minha Rota</h1>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("pt-BR")}</p>
        </div>
        {!rotaId && <Button onClick={criarRota} className="gap-2"><Plus className="h-4 w-4" /> Criar rota do dia</Button>}
        {rotaId && status === "pendente" && <Button onClick={iniciarRota} className="gap-2"><PlayCircle className="h-4 w-4" /> Iniciar rota</Button>}
        {rotaId && status === "em_andamento" && <Button onClick={finalizarRota} variant="secondary" className="gap-2"><CheckCircle2 className="h-4 w-4" /> Finalizar</Button>}
        {status === "finalizada" && <Badge>Rota finalizada</Badge>}
      </div>

      {rotaId && (
        <Card>
          <CardHeader><CardTitle className="text-base">Adicionar parada</CardTitle></CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Select value={novoCliente} onValueChange={setNovoCliente}>
                <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input type="number" placeholder="Qtd" className="w-24" value={novoQtd} onChange={(e) => setNovoQtd(e.target.value)} />
            <Button onClick={addParada} disabled={!novoCliente}><Plus className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {paradas.length === 0 && rotaId && (
          <p className="text-center text-muted-foreground py-8">Nenhuma parada adicionada ainda.</p>
        )}
        {paradas.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold">{p.ordem}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.clientes?.nome ?? "Cliente removido"}</p>
                <p className="text-xs text-muted-foreground truncate">{p.clientes?.endereco ?? "—"}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Prevista</p>
                <p className="font-bold">{p.quantidade_prevista} un</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="outline" onClick={() => abrirMapa(p)}><Navigation className="h-4 w-4" /></Button>
                <Link to={`/painel/operacao-externa/atendimento?parada=${p.id}&cliente=${p.cliente_id ?? ""}`}>
                  <Button size="icon"><MapPin className="h-4 w-4" /></Button>
                </Link>
                <Button size="icon" variant="ghost" onClick={() => removerParada(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}