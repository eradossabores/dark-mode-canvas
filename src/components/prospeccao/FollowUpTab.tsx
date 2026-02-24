import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  MessageSquare, Send, Copy, Check, Pencil, Clock, CheckCircle2,
  XCircle, Loader2, BarChart3, RefreshCw, Sparkles,
} from "lucide-react";
import { format, addDays, isAfter, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FollowUp {
  id: string;
  prospecto_id: string;
  visita_id: string | null;
  mensagem_gerada: string;
  mensagem_editada: string | null;
  tom: string;
  data_agendada: string;
  data_envio: string | null;
  status: string;
  resposta_cliente: string | null;
  resultado: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "⏳ Pendente",
  enviada: "📤 Enviada",
  respondida: "💬 Respondida",
  convertida: "✅ Convertida",
  sem_resposta: "😶 Sem Resposta",
};

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "outline",
  enviada: "secondary",
  respondida: "default",
  convertida: "default",
  sem_resposta: "destructive",
};

interface Props {
  prospectos: any[];
  onReload: () => void;
}

export default function FollowUpTab({ prospectos, onReload }: Props) {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [respostaId, setRespostaId] = useState<string | null>(null);
  const [respostaText, setRespostaText] = useState("");
  const [resultadoText, setResultadoText] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  useEffect(() => { loadFollowups(); }, []);

  async function loadFollowups() {
    setLoading(true);
    const { data } = await (supabase as any).from("followup_mensagens")
      .select("*").order("data_agendada", { ascending: true });
    setFollowups(data || []);
    setLoading(false);
  }

  async function handleGenerateForProspecto(prospectoId: string) {
    const p = prospectos.find(x => x.id === prospectoId);
    if (!p) return;

    setGeneratingFor(prospectoId);
    try {
      // Get latest visit
      const { data: visitas } = await (supabase as any).from("prospecto_visitas")
        .select("*").eq("prospecto_id", prospectoId)
        .order("data_visita", { ascending: false }).limit(1);
      
      const visita = visitas?.[0] || { resultado: p.status, feedback: "", produto_apresentado: "", proxima_acao: "" };

      const { data, error } = await supabase.functions.invoke("generate-followup", {
        body: { prospecto: p, visita },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Save to DB
      const dataAgendada = format(addDays(new Date(), 5), "yyyy-MM-dd");
      await (supabase as any).from("followup_mensagens").insert({
        prospecto_id: prospectoId,
        visita_id: visita?.id || null,
        mensagem_gerada: data.mensagem,
        data_agendada: dataAgendada,
        tom: getTomFromTipo(p.tipo),
      });

      toast({ title: "Follow-up gerado com IA!", description: `Agendado para ${format(addDays(new Date(), 5), "dd/MM/yyyy")}` });
      loadFollowups();
    } catch (e: any) {
      toast({ title: "Erro ao gerar follow-up", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingFor(null);
    }
  }

  function getTomFromTipo(tipo: string): string {
    const map: Record<string, string> = {
      bar: "informal", tabacaria: "informal", distribuidora: "direto",
      casa_noturna: "premium", evento_buffet: "formal",
      restaurante_lounge: "premium", lanchonete: "informal",
      mercado: "direto", outro: "informal",
    };
    return map[tipo] || "informal";
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  }

  async function handleMarkSent(id: string) {
    await (supabase as any).from("followup_mensagens").update({
      status: "enviada", data_envio: new Date().toISOString(),
    }).eq("id", id);
    toast({ title: "Marcada como enviada!" });
    loadFollowups();
  }

  async function handleSaveEdit(id: string) {
    await (supabase as any).from("followup_mensagens").update({
      mensagem_editada: editText,
    }).eq("id", id);
    toast({ title: "Mensagem editada salva!" });
    setEditingId(null);
    loadFollowups();
  }

  async function handleSaveResposta(id: string) {
    await (supabase as any).from("followup_mensagens").update({
      resposta_cliente: respostaText,
      resultado: resultadoText,
      status: resultadoText === "convertida" ? "convertida" : "respondida",
    }).eq("id", id);
    toast({ title: "Resposta registrada!" });
    setRespostaId(null);
    setRespostaText("");
    setResultadoText("");
    loadFollowups();
  }

  async function handleMarkNoResponse(id: string) {
    await (supabase as any).from("followup_mensagens").update({
      status: "sem_resposta",
    }).eq("id", id);
    loadFollowups();
  }

  const filtered = useMemo(() => {
    return followups.filter(f => filterStatus === "todos" || f.status === filterStatus);
  }, [followups, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const total = followups.length;
    const enviadas = followups.filter(f => f.status !== "pendente").length;
    const respondidas = followups.filter(f => ["respondida", "convertida"].includes(f.status)).length;
    const convertidas = followups.filter(f => f.status === "convertida").length;
    const taxaResposta = enviadas > 0 ? ((respondidas / enviadas) * 100).toFixed(1) : "0";
    const taxaConversao = respondidas > 0 ? ((convertidas / respondidas) * 100).toFixed(1) : "0";
    const hoje = followups.filter(f => f.status === "pendente" && isToday(new Date(f.data_agendada))).length;
    const atrasadas = followups.filter(f => f.status === "pendente" && isBefore(new Date(f.data_agendada), new Date()) && !isToday(new Date(f.data_agendada))).length;
    return { total, enviadas, respondidas, convertidas, taxaResposta, taxaConversao, hoje, atrasadas };
  }, [followups]);

  // Prospects eligible for follow-up (visitado/interessado without pending followup)
  const eligibleProspectos = useMemo(() => {
    const withPending = new Set(followups.filter(f => f.status === "pendente").map(f => f.prospecto_id));
    return prospectos.filter(p =>
      ["visitado", "interessado"].includes(p.status) && !withPending.has(p.id)
    );
  }, [prospectos, followups]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-3xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Follow-ups</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-3xl font-bold text-primary">{stats.taxaResposta}%</p>
          <p className="text-xs text-muted-foreground">Taxa de Resposta</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-3xl font-bold text-green-600">{stats.convertidas}</p>
          <p className="text-xs text-muted-foreground">Conversões</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{stats.hoje + stats.atrasadas}</p>
          <p className="text-xs text-muted-foreground">Para Enviar Hoje</p>
          {stats.atrasadas > 0 && <p className="text-[10px] text-destructive">{stats.atrasadas} atrasada(s)</p>}
        </CardContent></Card>
      </div>

      {/* Generate for eligible */}
      {eligibleProspectos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Gerar Follow-up com IA ({eligibleProspectos.length} disponíveis)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {eligibleProspectos.map(p => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="outline"
                  disabled={generatingFor === p.id}
                  onClick={() => handleGenerateForProspecto(p.id)}
                >
                  {generatingFor === p.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  {p.nome}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={loadFollowups}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* Follow-up list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum follow-up {filterStatus !== "todos" ? `com status "${STATUS_LABELS[filterStatus]}"` : "encontrado"}</p>
          {eligibleProspectos.length > 0 && <p className="text-sm mt-2">Use os botões acima para gerar mensagens com IA</p>}
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(f => {
            const p = prospectos.find(x => x.id === f.prospecto_id);
            const isOverdue = f.status === "pendente" && isBefore(new Date(f.data_agendada), new Date()) && !isToday(new Date(f.data_agendada));
            const isEditing = editingId === f.id;
            const isAddingResposta = respostaId === f.id;
            const mensagemFinal = f.mensagem_editada || f.mensagem_gerada;

            return (
              <Card key={f.id} className={isOverdue ? "border-destructive/50" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">{p?.nome || "Prospecto"}</CardTitle>
                      <Badge variant={STATUS_BADGE[f.status] || "outline"} className="text-[10px]">
                        {STATUS_LABELS[f.status] || f.status}
                      </Badge>
                      {isOverdue && <Badge variant="destructive" className="text-[10px]">Atrasada</Badge>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(f.data_agendada), "dd/MM/yyyy")}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea value={editText} onChange={e => setEditText(e.target.value)} rows={6} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(f.id)}>Salvar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{mensagemFinal}</p>
                  )}

                  {f.mensagem_editada && (
                    <p className="text-[10px] text-muted-foreground italic">✏️ Mensagem editada manualmente</p>
                  )}

                  {/* Resposta do cliente */}
                  {f.resposta_cliente && (
                    <div className="bg-primary/5 p-3 rounded-lg">
                      <p className="text-xs font-medium mb-1">Resposta do cliente:</p>
                      <p className="text-sm">{f.resposta_cliente}</p>
                      {f.resultado && <Badge className="mt-2 text-[10px]">{f.resultado}</Badge>}
                    </div>
                  )}

                  {/* Add response form */}
                  {isAddingResposta && (
                    <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
                      <Textarea
                        placeholder="O que o cliente respondeu..."
                        value={respostaText}
                        onChange={e => setRespostaText(e.target.value)}
                        rows={3}
                      />
                      <Select value={resultadoText} onValueChange={setResultadoText}>
                        <SelectTrigger><SelectValue placeholder="Resultado..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="positiva">👍 Resposta Positiva</SelectItem>
                          <SelectItem value="negativa">👎 Resposta Negativa</SelectItem>
                          <SelectItem value="convertida">🎉 Converteu em Pedido</SelectItem>
                          <SelectItem value="agendar_reuniao">📅 Agendou Reunião</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveResposta(f.id)} disabled={!respostaText}>Salvar</Button>
                        <Button size="sm" variant="outline" onClick={() => setRespostaId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {f.status === "pendente" && (
                      <>
                        <Button size="sm" onClick={() => handleMarkSent(f.id)}>
                          <Send className="h-3 w-3 mr-1" />Marcar Enviada
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingId(f.id); setEditText(mensagemFinal); }}>
                          <Pencil className="h-3 w-3 mr-1" />Editar
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleCopy(mensagemFinal)}>
                      <Copy className="h-3 w-3 mr-1" />Copiar
                    </Button>
                    {f.status === "enviada" && !isAddingResposta && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setRespostaId(f.id); setRespostaText(""); setResultadoText(""); }}>
                          <MessageSquare className="h-3 w-3 mr-1" />Registrar Resposta
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleMarkNoResponse(f.id)}>
                          <XCircle className="h-3 w-3 mr-1" />Sem Resposta
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Send date */}
                  {f.data_envio && (
                    <p className="text-[10px] text-muted-foreground">
                      Enviada em {format(new Date(f.data_envio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
