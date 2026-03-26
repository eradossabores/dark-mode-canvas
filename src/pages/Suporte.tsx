import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { Plus, MessageCircle, Send, HelpCircle, Ticket, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SupportTicket {
  id: string;
  factory_id: string | null;
  user_id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at: string;
}

const FAQ_ITEMS = [
  {
    q: "Como cadastrar um novo sabor?",
    a: "Acesse o menu Cadastros > Sabores, clique em '+ Novo Sabor', preencha o nome e configure a receita com matéria-prima e embalagem.",
  },
  {
    q: "Como registrar uma produção?",
    a: "Vá em Produção > Produção, selecione o sabor, informe a quantidade de lotes e os colaboradores envolvidos. O estoque será atualizado automaticamente.",
  },
  {
    q: "Como funciona o sistema de preços?",
    a: "O sistema aplica uma tabela progressiva de preços baseada na quantidade total do pedido. Você pode configurar preços personalizados por cliente em Cadastros > Clientes.",
  },
  {
    q: "Como gerenciar colaboradores?",
    a: "Acesse Cadastros > Colaboradores para adicionar, editar ou desativar funcionários. Configure o tipo de pagamento (diária, produção, etc.) individualmente.",
  },
  {
    q: "Como emitir relatórios?",
    a: "No menu Sistema > Relatórios, selecione o tipo de relatório desejado (vendas, produção, estoque, etc.), defina o período e exporte em PDF ou Excel.",
  },
  {
    q: "Como funciona o controle de estoque?",
    a: "O estoque é atualizado automaticamente com produções (entrada) e vendas (saída). Você pode verificar o saldo atual em Cadastros > Estoque e configurar alertas de estoque mínimo.",
  },
  {
    q: "Como funciona o período de teste?",
    a: "Você tem 30 dias gratuitos para usar todas as funcionalidades do sistema. Após esse período, o valor é de R$ 99,90/mês.",
  },
  {
    q: "Como faço backup dos meus dados?",
    a: "Acesse Sistema > Backup para exportar seus dados. Os dados também são salvos automaticamente na nuvem com segurança.",
  },
];

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "financeiro", label: "Financeiro" },
  { value: "producao", label: "Produção" },
  { value: "estoque", label: "Estoque" },
  { value: "vendas", label: "Vendas" },
  { value: "bug", label: "Erro no Sistema" },
  { value: "sugestao", label: "Sugestão" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "aberto":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><AlertCircle className="h-3 w-3 mr-1" />Aberto</Badge>;
    case "em_andamento":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Clock className="h-3 w-3 mr-1" />Em Andamento</Badge>;
    case "resolvido":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="h-3 w-3 mr-1" />Resolvido</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function Suporte() {
  const { user, role, factoryId } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: "", category: "geral", message: "" });
  const [userName, setUserName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSuperAdmin = role === "super_admin";

  useEffect(() => {
    if (user?.id) {
      (supabase as any).from("profiles").select("nome").eq("id", user.id).maybeSingle().then(({ data }: any) => {
        setUserName(data?.nome || user.email || "Usuário");
      });
    }
  }, [user?.id]);

  async function loadTickets() {
    try {
      const { data, error } = await (supabase as any)
        .from("support_tickets")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (e: any) {
      toast({ title: "Erro ao carregar tickets", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(ticketId: string) {
    const { data, error } = await (supabase as any)
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar mensagens", variant: "destructive" });
      return;
    }
    setMessages(data || []);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  useEffect(() => { loadTickets(); }, []);

  useEffect(() => {
    if (!selectedTicket) return;
    loadMessages(selectedTicket.id);

    const channel = supabase
      .channel(`support-${selectedTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${selectedTicket.id}` },
        (payload: any) => {
          setMessages(prev => [...prev, payload.new as SupportMessage]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket?.id]);

  async function handleCreateTicket() {
    if (!newTicket.subject || !newTicket.message) {
      toast({ title: "Preencha assunto e mensagem", variant: "destructive" });
      return;
    }
    try {
      const { data: ticket, error } = await (supabase as any)
        .from("support_tickets")
        .insert({
          user_id: user?.id,
          factory_id: factoryId || null,
          subject: newTicket.subject,
          category: newTicket.category,
        })
        .select()
        .single();
      if (error) throw error;

      await (supabase as any).from("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: user?.id,
        sender_name: userName || user?.email || "Usuário",
        message: newTicket.message,
      });

      toast({ title: "Ticket criado com sucesso!" });
      setShowNewTicket(false);
      setNewTicket({ subject: "", category: "geral", message: "" });
      loadTickets();
      setSelectedTicket(ticket);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedTicket) return;
    setSending(true);
    try {
      const { error } = await (supabase as any).from("support_messages").insert({
        ticket_id: selectedTicket.id,
        sender_id: user?.id,
        sender_name: userName || user?.email || "Usuário",
        message: newMessage.trim(),
      });
      if (error) throw error;
      setNewMessage("");

      // Update ticket status if super admin responds
      if (isSuperAdmin && selectedTicket.status === "aberto") {
        await (supabase as any).from("support_tickets").update({ status: "em_andamento", updated_at: new Date().toISOString() }).eq("id", selectedTicket.id);
        setSelectedTicket({ ...selectedTicket, status: "em_andamento" });
        loadTickets();
      }
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function handleChangeStatus(ticketId: string, status: string) {
    await (supabase as any).from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", ticketId);
    if (selectedTicket?.id === ticketId) setSelectedTicket({ ...selectedTicket!, status });
    loadTickets();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suporte</h1>
          <p className="text-muted-foreground">Central de ajuda e atendimento</p>
        </div>
        <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Abrir Novo Ticket</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Assunto</Label>
                <Input placeholder="Descreva brevemente o problema" value={newTicket.subject} onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={newTicket.category} onValueChange={v => setNewTicket({ ...newTicket, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea placeholder="Descreva seu problema com detalhes..." rows={4} value={newTicket.message} onChange={e => setNewTicket({ ...newTicket, message: e.target.value })} />
              </div>
              <Button className="w-full" onClick={handleCreateTicket}>Enviar Ticket</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="tickets" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tickets" className="gap-1.5"><Ticket className="h-4 w-4" />Tickets</TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5"><MessageCircle className="h-4 w-4" />Chat</TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5"><HelpCircle className="h-4 w-4" />FAQ</TabsTrigger>
        </TabsList>

        {/* TICKETS TAB */}
        <TabsContent value="tickets" className="mt-4">
          {loading ? (
            <p className="text-center text-muted-foreground animate-pulse py-8">Carregando...</p>
          ) : tickets.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum ticket aberto.</p>
              <Button className="mt-4 gap-2" onClick={() => setShowNewTicket(true)}><Plus className="h-4 w-4" />Abrir Primeiro Ticket</Button>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {tickets.map(t => (
                <Card key={t.id} className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedTicket?.id === t.id ? "border-primary" : ""}`}
                  onClick={() => setSelectedTicket(t)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{t.subject}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{CATEGORIES.find(c => c.value === t.category)?.label || t.category}</Badge>
                        <span>{format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(t.status)}
                      {isSuperAdmin && t.status !== "resolvido" && (
                        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); handleChangeStatus(t.id, "resolvido"); }}>
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CHAT TAB */}
        <TabsContent value="chat" className="mt-4">
          {!selectedTicket ? (
            <Card><CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Selecione um ticket na aba "Tickets" para abrir o chat.</p>
            </CardContent></Card>
          ) : (
            <Card className="flex flex-col" style={{ height: "calc(100vh - 320px)", minHeight: 400 }}>
              <CardHeader className="pb-2 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{selectedTicket.subject}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CATEGORIES.find(c => c.value === selectedTicket.category)?.label} • {format(new Date(selectedTicket.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  {getStatusBadge(selectedTicket.status)}
                </div>
              </CardHeader>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map(m => {
                    const isMe = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                          <p className={`text-[10px] font-medium mb-0.5 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {m.sender_name}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                          <p className={`text-[9px] mt-1 ${isMe ? "text-primary-foreground/50" : "text-muted-foreground/60"}`}>
                            {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              {selectedTicket.status !== "resolvido" && (
                <div className="p-3 border-t flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  />
                  <Button size="icon" onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        {/* FAQ TAB */}
        <TabsContent value="faq" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HelpCircle className="h-5 w-5" />Perguntas Frequentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {FAQ_ITEMS.map((item, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
