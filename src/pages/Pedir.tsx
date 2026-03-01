import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Send, ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { z } from "zod";

const WHATSAPP_NUMBER = "5595991725677";

interface Sabor {
  id: string;
  nome: string;
}

interface CartItem {
  sabor_id: string;
  nome: string;
  quantidade: number;
}

const pedidoSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  telefone: z.string().trim().min(10, "Telefone inválido").max(20),
  endereco: z.string().trim().min(5, "Endereço deve ter pelo menos 5 caracteres").max(300),
  bairro: z.string().trim().min(2, "Bairro é obrigatório").max(100),
  formaPagamento: z.enum(["dinheiro", "pix", "cartao", "fiado"], { required_error: "Selecione a forma de pagamento" }),
  observacoes: z.string().max(500).optional(),
});

const PRECO_UNITARIO = 4.99;

export default function Pedir() {
  const [sabores, setSabores] = useState<Sabor[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<"catalogo" | "dados">("catalogo");

  // form fields
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sabores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      setSabores(data ?? []);
      setLoading(false);
    })();
  }, []);

  const addToCart = (sabor: Sabor) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.sabor_id === sabor.id);
      if (existing) {
        return prev.map((i) =>
          i.sabor_id === sabor.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [...prev, { sabor_id: sabor.id, nome: sabor.nome, quantidade: 1 }];
    });
  };

  const updateQty = (sabor_id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.sabor_id === sabor_id ? { ...i, quantidade: i.quantidade + delta } : i
        )
        .filter((i) => i.quantidade > 0)
    );
  };

  const totalItens = cart.reduce((s, i) => s + i.quantidade, 0);
  const totalValor = cart.reduce((s, i) => s + i.quantidade * PRECO_UNITARIO, 0);

  const getQty = (id: string) => cart.find((i) => i.sabor_id === id)?.quantidade ?? 0;

  const handleEnviar = () => {
    const result = pedidoSchema.safeParse({ nome, telefone, endereco, bairro, formaPagamento, observacoes });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const pagLabel: Record<string, string> = {
      dinheiro: "💵 Dinheiro",
      pix: "📱 PIX",
      cartao: "💳 Cartão",
      fiado: "📝 Fiado",
    };

    const itensText = cart
      .map((i) => `  • ${i.nome} — ${i.quantidade} un (R$ ${(i.quantidade * PRECO_UNITARIO).toFixed(2)})`)
      .join("\n");

    const msg = [
      `🧊 *NOVO PEDIDO — ICE SCRAT*`,
      ``,
      `👤 *Cliente:* ${nome.trim()}`,
      `📞 *Contato:* ${telefone.trim()}`,
      `📍 *Endereço:* ${endereco.trim()}`,
      `🏘️ *Bairro:* ${bairro.trim()}`,
      ``,
      `🛒 *Itens do Pedido:*`,
      itensText,
      ``,
      `📦 *Total:* ${totalItens} unidades`,
      `💰 *Valor Total:* R$ ${totalValor.toFixed(2)}`,
      ``,
      `💳 *Pagamento:* ${pagLabel[formaPagamento] ?? formaPagamento}`,
      observacoes?.trim() ? `📝 *Obs:* ${observacoes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");

    toast({ title: "Pedido gerado!", description: "Você será redirecionado ao WhatsApp." });
  };

  return (
    <>
      <Helmet>
        <title>Faça seu Pedido | Ice Scrat Gelos</title>
        <meta name="description" content="Monte seu pedido de gelos artesanais e envie direto pelo WhatsApp." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="Ice Scrat" className="h-9" />
            </Link>
            {step === "catalogo" && totalItens > 0 && (
              <Button size="sm" onClick={() => setStep("dados")} className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span>{totalItens}</span>
                <span className="hidden sm:inline">— R$ {totalValor.toFixed(2)}</span>
              </Button>
            )}
            {step === "dados" && (
              <Button size="sm" variant="ghost" onClick={() => setStep("catalogo")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-6">
          {step === "catalogo" && (
            <>
              <h1 className="mb-1 text-2xl font-bold text-foreground">Faça seu Pedido 🧊</h1>
              <p className="mb-6 text-sm text-muted-foreground">
                Escolha seus sabores e quantidade. Depois preencha seus dados para enviar pelo WhatsApp.
              </p>

              {loading ? (
                <p className="text-center text-muted-foreground py-12">Carregando sabores...</p>
              ) : (
                <div className="grid gap-3">
                  {sabores.map((s) => {
                    const qty = getQty(s.id);
                    return (
                      <Card key={s.id} className={`transition-all ${qty > 0 ? "ring-2 ring-primary/40" : ""}`}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">{s.nome}</p>
                            <p className="text-sm text-muted-foreground">R$ {PRECO_UNITARIO.toFixed(2)} / un</p>
                          </div>
                          {qty === 0 ? (
                            <Button size="sm" variant="outline" onClick={() => addToCart(s)}>
                              <Plus className="mr-1 h-4 w-4" /> Adicionar
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(s.id, -1)}>
                                {qty === 1 ? <Trash2 className="h-3.5 w-3.5 text-destructive" /> : <Minus className="h-3.5 w-3.5" />}
                              </Button>
                              <span className="w-8 text-center font-bold text-foreground">{qty}</span>
                              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(s.id, 1)}>
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {totalItens > 0 && (
                <div className="sticky bottom-4 mt-6">
                  <Button className="w-full gap-2 text-base h-12 shadow-lg" onClick={() => setStep("dados")}>
                    <ShoppingCart className="h-5 w-5" />
                    Continuar — {totalItens} {totalItens === 1 ? "item" : "itens"} (R$ {totalValor.toFixed(2)})
                  </Button>
                </div>
              )}
            </>
          )}

          {step === "dados" && (
            <>
              <h2 className="mb-1 text-2xl font-bold text-foreground">Seus Dados 📋</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Preencha para enviarmos seu pedido pelo WhatsApp.
              </p>

              {/* Cart summary */}
              <Card className="mb-6">
                <CardContent className="p-4 space-y-2">
                  <p className="font-semibold text-foreground mb-2">Resumo do pedido</p>
                  {cart.map((i) => (
                    <div key={i.sabor_id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{i.nome} × {i.quantidade}</span>
                      <span className="text-muted-foreground">R$ {(i.quantidade * PRECO_UNITARIO).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold text-foreground">
                    <span>Total</span>
                    <span>R$ {totalValor.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Nome *</label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" maxLength={100} />
                  {errors.nome && <p className="text-sm text-destructive mt-1">{errors.nome}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Telefone / WhatsApp *</label>
                  <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(99) 99999-9999" maxLength={20} />
                  {errors.telefone && <p className="text-sm text-destructive mt-1">{errors.telefone}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Endereço de Entrega *</label>
                  <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, complemento" maxLength={300} />
                  {errors.endereco && <p className="text-sm text-destructive mt-1">{errors.endereco}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Bairro *</label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Seu bairro" maxLength={100} />
                  {errors.bairro && <p className="text-sm text-destructive mt-1">{errors.bairro}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Forma de Pagamento *</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[
                      { value: "pix", label: "📱 PIX" },
                      { value: "dinheiro", label: "💵 Dinheiro" },
                      { value: "cartao", label: "💳 Cartão" },
                      { value: "fiado", label: "📝 Fiado" },
                    ].map((op) => (
                      <Button
                        key={op.value}
                        type="button"
                        variant={formaPagamento === op.value ? "default" : "outline"}
                        className="h-11 text-sm"
                        onClick={() => setFormaPagamento(op.value)}
                      >
                        {op.label}
                      </Button>
                    ))}
                  </div>
                  {errors.formaPagamento && <p className="text-sm text-destructive mt-1">{errors.formaPagamento}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Observações</label>
                  <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Alguma observação? (opcional)" maxLength={500} rows={3} />
                </div>

                <Button className="w-full gap-2 text-base h-12" onClick={handleEnviar}>
                  <Send className="h-5 w-5" />
                  Enviar Pedido pelo WhatsApp
                </Button>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
