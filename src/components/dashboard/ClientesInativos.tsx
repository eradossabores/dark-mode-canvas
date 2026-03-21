import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserX, Clock, Phone, MessageCircle, Copy, CheckSquare, Square } from "lucide-react";

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

export default function ClientesInativos() {
  const [clientes, setClientes] = useState<ClienteInativo[]>([]);
  const [diasLimite, setDiasLimite] = useState(15);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [mensagemModelo, setMensagemModelo] = useState(DEFAULT_WHATSAPP_TEMPLATE);
  const [mostrarMensagemWhatsapp, setMostrarMensagemWhatsapp] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await (supabase as any)
        .from("clientes")
        .select("id, nome, telefone, bairro, ultima_compra")
        .eq("status", "ativo")
        .not("nome", "ilike", "%amostra%")
        .not("nome", "ilike", "%avulso%");

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
  const clientesSelecionados = useMemo(
    () => filtrados.filter((cliente) => selecionados.includes(cliente.id)),
    [filtrados, selecionados],
  );
  const selecionadosComTelefone = clientesSelecionados.filter((cliente) => !!cliente.telefone);

  function toggleSelecao(clienteId: string) {
    setSelecionados((atual) =>
      atual.includes(clienteId) ? atual.filter((id) => id !== clienteId) : [...atual, clienteId],
    );
  }

  function toggleSelecionarTodos() {
    const idsVisiveis = filtrados.slice(0, 10).map((cliente) => cliente.id);
    const todosVisiveisSelecionados = idsVisiveis.every((id) => selecionados.includes(id));

    setSelecionados((atual) =>
      todosVisiveisSelecionados
        ? atual.filter((id) => !idsVisiveis.includes(id))
        : Array.from(new Set([...atual, ...idsVisiveis])),
    );
  }

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
    await navigator.clipboard.writeText(mensagemModelo);
  }

  function enviarWhatsappSelecionados() {
    selecionadosComTelefone.forEach((cliente, index) => {
      const telefone = cliente.telefone ? normalizarTelefoneWhatsapp(cliente.telefone) : null;
      if (!telefone) return;

      const mensagem = encodeURIComponent(formatarMensagem(cliente));
      const url = `https://wa.me/${telefone}?text=${mensagem}`;
      window.setTimeout(() => window.open(url, "_blank", "noopener,noreferrer"), index * 180);
    });
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
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMostrarMensagemWhatsapp((atual) => !atual)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Enviar Mensagem para o Cliente
              </button>
            </div>

            {mostrarMensagemWhatsapp && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Mensagem para WhatsApp</p>
                    <p className="text-xs text-muted-foreground">Use {'{nome}'} e {'{dias}'} para personalizar automaticamente.</p>
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
                      onClick={enviarWhatsappSelecionados}
                      disabled={selecionadosComTelefone.length === 0}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Enviar para selecionados
                    </button>
                  </div>
                </div>

                <textarea
                  value={mensagemModelo}
                  onChange={(e) => setMensagemModelo(e.target.value)}
                  className="min-h-[148px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={toggleSelecionarTodos}
                    className="inline-flex items-center gap-1.5 text-foreground hover:text-primary"
                  >
                    {filtrados.slice(0, 10).every((cliente) => selecionados.includes(cliente.id)) ? (
                      <CheckSquare className="h-3.5 w-3.5" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                    Selecionar visíveis
                  </button>
                  <span>
                    {clientesSelecionados.length} selecionado(s) · {selecionadosComTelefone.length} com WhatsApp
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {filtrados.slice(0, 10).map(c => {
                const selecionado = selecionados.includes(c.id);

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleSelecao(c.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border p-2 text-left text-sm transition-colors ${
                      selecionado ? "border-primary bg-primary/5" : "border-transparent bg-muted/30 hover:border-border"
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="pt-0.5 text-primary">
                        {selecionado ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </div>
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
                    <Badge
                      variant={c.diasSemCompra >= 30 ? "destructive" : c.diasSemCompra >= 15 ? "secondary" : "outline"}
                      className="shrink-0"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {c.diasSemCompra === 999 ? "Nunca" : `${c.diasSemCompra}d`}
                    </Badge>
                  </button>
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
