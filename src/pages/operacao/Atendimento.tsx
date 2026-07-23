import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { uploadOpFoto, getOpFotoUrl } from "@/lib/op-externa-photo";
import { Camera, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

const STEPS = ["Chegada", "Foto antes", "Entrega", "Checklist", "Foto depois", "Finalizar"] as const;

const CHECKLIST_KEYS = [
  { key: "freezer_limpo", label: "Freezer limpo e organizado" },
  { key: "gelos_organizados", label: "Gelos organizados por sabor" },
  { key: "sem_produto_estranho", label: "Sem produto estranho no freezer" },
  { key: "cartaz_visivel", label: "Cartaz/comunicação visível" },
  { key: "cliente_orientado", label: "Cliente orientado sobre estoque" },
];

export default function Atendimento() {
  const { user, factoryId } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paradaId = params.get("parada");
  const clienteFromUrl = params.get("cliente");

  const [step, setStep] = useState(0);
  const [visitaId, setVisitaId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState<string>(clienteFromUrl || "");
  const [quantidade, setQuantidade] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [fotoAntes, setFotoAntes] = useState<string | null>(null);
  const [fotoDepois, setFotoDepois] = useState<string | null>(null);
  const [fotoAntesUrl, setFotoAntesUrl] = useState<string | null>(null);
  const [fotoDepoisUrl, setFotoDepoisUrl] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("clientes").select("id,nome").order("nome").limit(500);
      setClientes(data ?? []);
    })();
  }, []);

  async function iniciarVisita() {
    if (!user?.id || !factoryId || !clienteId) return toast({ title: "Selecione um cliente", variant: "destructive" });
    const { data, error } = await (supabase as any).from("visitas_externas").insert({
      auxiliar_user_id: user.id, factory_id: factoryId, cliente_id: clienteId,
      parada_id: paradaId, chegada_em: new Date().toISOString(), status: "em_andamento",
    }).select().single();
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    setVisitaId(data.id);
    setStep(1);
  }

  async function handleFoto(tipo: "antes" | "depois", file: File) {
    if (!visitaId || !user?.id) return;
    setSaving(true);
    try {
      const path = `${user.id}/${visitaId}/${tipo}-${Date.now()}.jpg`;
      await uploadOpFoto(path, file);
      const url = await getOpFotoUrl(path);
      const patch = tipo === "antes"
        ? { foto_antes_url: path }
        : { foto_depois_url: path };
      await (supabase as any).from("visitas_externas").update(patch).eq("id", visitaId);
      if (tipo === "antes") { setFotoAntes(path); setFotoAntesUrl(url); }
      else { setFotoDepois(path); setFotoDepoisUrl(url); }
      toast({ title: "Foto enviada" });
    } catch (e: any) {
      toast({ title: "Erro upload", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function salvarEntrega() {
    if (!visitaId) return;
    await (supabase as any).from("visitas_externas").update({ quantidade_entregue: Number(quantidade) || 0 }).eq("id", visitaId);
    setStep(3);
  }

  async function salvarChecklist() {
    if (!visitaId) return;
    await (supabase as any).from("visitas_externas").update({ checklist }).eq("id", visitaId);
    setStep(4);
  }

  async function finalizar() {
    if (!visitaId) return;
    setSaving(true);
    try {
      await (supabase as any).from("visitas_externas").update({
        observacoes, status: "finalizada", finalizada_em: new Date().toISOString(),
      }).eq("id", visitaId);
      if (paradaId) {
        await (supabase as any).from("rota_paradas").update({
          status: "concluida", quantidade_entregue: Number(quantidade) || 0, atendida_em: new Date().toISOString(),
        }).eq("id", paradaId);
      }
      toast({ title: "Atendimento finalizado! 🎉", description: "Pontuação registrada" });
      navigate("/painel/operacao-externa/minha-rota");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const checklistCompleto = useMemo(() => CHECKLIST_KEYS.every(k => checklist[k.key]), [checklist]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Novo Atendimento</h1>
          <p className="text-sm text-muted-foreground">Etapa {step + 1} de {STEPS.length}: {STEPS[step]}</p>
        </div>
      </div>
      <Progress value={((step + 1) / STEPS.length) * 100} />

      {step === 0 && (
        <Card><CardHeader><CardTitle>Chegada no cliente</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={iniciarVisita} disabled={!clienteId} className="w-full">Registrar chegada <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <FotoStep titulo="Foto ANTES da organização" onFoto={(f) => handleFoto("antes", f)} url={fotoAntesUrl} saving={saving} onNext={() => setStep(2)} nextDisabled={!fotoAntes} />
      )}

      {step === 2 && (
        <Card><CardHeader><CardTitle>Entrega de gelos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Quantidade entregue (unidades)</Label>
              <Input type="number" inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className="text-lg h-12" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              <Button className="flex-1" onClick={salvarEntrega}>Próximo <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card><CardHeader><CardTitle>Checklist de organização</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {CHECKLIST_KEYS.map(k => (
              <label key={k.key} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer">
                <Checkbox checked={!!checklist[k.key]} onCheckedChange={(v) => setChecklist(s => ({ ...s, [k.key]: !!v }))} />
                <span className="flex-1">{k.label}</span>
              </label>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              <Button className="flex-1" onClick={salvarChecklist} disabled={!checklistCompleto}>Próximo <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
            {!checklistCompleto && <p className="text-xs text-muted-foreground text-center">Marque todos os itens para avançar</p>}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <FotoStep titulo="Foto DEPOIS da organização" onFoto={(f) => handleFoto("depois", f)} url={fotoDepoisUrl} saving={saving} onNext={() => setStep(5)} nextDisabled={!fotoDepois} onBack={() => setStep(3)} />
      )}

      {step === 5 && (
        <Card><CardHeader><CardTitle>Observações finais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea rows={4} placeholder="Ex: cliente pediu mais 50 melancia na próxima" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(4)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              <Button className="flex-1 gap-2" onClick={finalizar} disabled={saving}><CheckCircle2 className="h-4 w-4" /> Finalizar</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FotoStep({ titulo, onFoto, url, saving, onNext, onBack, nextDisabled }:
  { titulo: string; onFoto: (f: File) => void; url: string | null; saving: boolean; onNext: () => void; onBack?: () => void; nextDisabled?: boolean }) {
  return (
    <Card><CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {url && <img src={url} alt="preview" className="w-full rounded-lg max-h-64 object-cover" />}
        <label className="block">
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && onFoto(e.target.files[0])} />
          <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent">
            <Camera className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">{url ? "Trocar foto" : "Tirar foto"}</p>
          </div>
        </label>
        <div className="flex gap-2">
          {onBack && <Button variant="outline" className="flex-1" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>}
          <Button className="flex-1" onClick={onNext} disabled={nextDisabled || saving}>Próximo <ArrowRight className="h-4 w-4 ml-1" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}