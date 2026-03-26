import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserX, Clock, Phone, MessageCircle, Copy } from "lucide-react";

const DEFAULT_WHATSAPP_TEMPLATE = `Oi, {nome}! Tudo bem? 😊

Percebi que faz um tempinho desde o seu último pedido e quis passar aqui para saber como vocês estão.

Tem algum sabor, quantidade ou necessidade especial para os próximos dias? Se quiser, posso te ajudar a organizar um novo pedido de forma rápida.

Se fizer sentido, me responde por aqui que continuamos a conversa.`;

interface ClienteInativo {
  id: string;
  nome: string;
  telefone: string | null;
  bairro: string | null;
  diasSemCompra: number;
  ultimaCompra: string | null;
}

export default function ClientesInativos({ factoryId }: { factoryId?: string | null }) {
  const [clientes, setClientes] = useState<ClienteInativo[]>([]);
  const [diasLimite, setDiasLimite] = useState(15);
  const [mensagemModelo, setMensagemModelo] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [mostrarMensagemWhatsapp, setMostrarMensagemWhatsapp] = useState(false);
  const [clienteMensagem, setClienteMensagem] = useState<ClienteInativo | null>(null);

  useEffect(() => { load(); }, [factoryId]);

  async function load() {
    try {
      let q = (supabase as any)
        .from("clientes")
        .select("id, nome, telefone, bairro, ultima_compra")
        .eq("status", "ativo")
        .not("nome", "ilike", "%amostra%")
        .not("nome", "ilike", "%avulso%");
      if (factoryId) q = q.eq("factory_id", factoryId);
      const { data } = await q;

      const hoje = new Date();
      const result: ClienteInativo[] = (data || [])
        .map((c: any) => {
          const diasSemCompra = c.ultima_compra
            ? Math.floor((hoje.getTime() - new Date(c.ultima_compra).getTime()) / (1000 * 60 * 60 * 24))
            : 999;
          return { ...c, diasSemCompra, ultimaCompra: c.ultima_compra };
        })
        .filter((c: ClienteInativo) => c.diasSemCompra >= 7)
        .sort((a: ClienteInativo, b: ClienteInativo) => b.diasSemCompra - a.diasSemCompra);

      setClientes(result);
    } catch (e) {
      console.error("ClientesInativos error:", e);
    }
  }

  const filtrados = clientes.filter(c => c.diasSemCompra >= diasLimite);
  const clienteMensagemValido = useMemo(
    () => filtrados.find((cliente) => cliente.id === clienteMensagem?.id) ?? null,
    [clienteMensagem, filtrados],
  );

  useEffect(() => {
    if (!clienteMensagemValido && clienteMensagem) {
      setClienteMensagem(null);
      setMostrarMensagemWhatsapp(false);
    }
  }, [clienteMensagem, clienteMensagemValido]);

  function formatarMensagem(cliente: ClienteInativo) {
    return mensagemModelo
      .replace(/\{nome\}/g, cliente.nome.split(" ")[0] || cliente.nome)
      .replace(/\{dias\}/g, cliente.diasSemCompra === 999 ? "muito tempo" : `${cliente.diasSemCompra} dias`);
  }

  function normalizarTelefoneWhatsapp(telefone: string) {
    const digitos = telefone.replace(/\D/g, "");
    if (!digitos) return null;
    if (digitos.startsWith("55")) return digitos;
    if (digitos.length >= 10 && digitos.length <= 11) return `55${digitos}`;
    return digitos;
  }

  async function copiarModelo() {
    const conteudo = clienteMensagemValido ? formatarMensagem(clienteMensagemValido) : mensagemModelo;
    await navigator.clipboard.writeText(conteudo);
  }

  function abrirMensagemCliente(cliente: ClienteInativo) {
    setClienteMensagem(cliente);
    setMostrarMensagemWhatsapp(true);
  }

  function enviarWhatsappCliente(cliente: ClienteInativo | null) {
    if (!cliente?.telefone) return;

    const telefone = normalizarTelefoneWhatsapp(cliente.telefone);
    if (!telefone) return;

    const mensagem = encodeURIComponent(formatarMensagem(cliente));
    const url = `https://wa.me/${telefone}?text=${mensagem}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (clientes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserX className="h-4 w-4 text-destructive" />
            Clientes sem Compra
          </CardTitle>
          <div className="flex gap-1">
            {[7, 15, 30].map(d => (
              <button
                key={d}
                onClick={() => setDiasLimite(d)}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                  diasLimite === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {d}d+
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Todos os clientes compraram recentemente! 🎉
          </p>
        ) : (
          <div className="space-y-3">
            {mostrarMensagemWhatsapp && clienteMensagemValido && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Mensagem para WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      Enviando para <span className="font-medium text-foreground">{clienteMensagemValido.nome}</span>. Use {'{nome}'} e {'{dias}'} para personalizar automaticamente.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copiarModelo}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar modelo
                    </button>
                    <button
                      type="button"
                      onClick={() => enviarWhatsappCliente(clienteMensagemValido)}
                      disabled={!clienteMensagemValido.telefone}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Enviar para cliente
                    </button>
                  </div>
                </div>

                <textarea
                  value={mensagemModelo}
                  onChange={(e) => setMensagemModelo(e.target.value)}
                  className="min-h-[148px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Prévia personalizada para envio individual.</span>
                  <span>{clienteMensagemValido.telefone ? "WhatsApp disponível" : "Cliente sem WhatsApp"}</span>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {filtrados.slice(0, 10).map(c => {
                const ativo = clienteMensagemValido?.id === c.id;

                return (
                  <div
                    key={c.id}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border p-2 text-left text-sm transition-colors ${
                      ativo ? "border-primary bg-primary/5" : "border-transparent bg-muted/30 hover:border-border"
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.nome}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {c.bairro && <span>{c.bairro}</span>}
                          {c.telefone && (
                            <span className="flex items-center gap-0.5 text-primary">
                              <Phone className="h-2.5 w-2.5" />{c.telefone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={c.diasSemCompra >= 30 ? "destructive" : c.diasSemCompra >= 15 ? "secondary" : "outline"}
                        className="shrink-0"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {c.diasSemCompra === 999 ? "Nunca" : `${c.diasSemCompra}d`}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => abrirMensagemCliente(c)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground transition-colors hover:opacity-90"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Enviar mensagem
                      </button>
                    </div>
                  </div>
                );
              })}
              {filtrados.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{filtrados.length - 10} cliente(s)
                </p>
              )}
            </div>
          </div>
        )}
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex justify-between">
          <span>{filtrados.length} cliente(s) sem compra há {diasLimite}+ dias</span>
          {filtrados.filter(c => c.diasSemCompra >= 30).length > 0 && (
            <span className="text-destructive font-medium">
              {filtrados.filter(c => c.diasSemCompra >= 30).length} crítico(s)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
