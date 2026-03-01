import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ShoppingCart, Plus, Minus, Send, ArrowLeft, Trash2,
  Snowflake, Truck, Clock, Star, ChevronDown, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import geloMorango from "@/assets/gelo-morango.png";
import geloBobMarley from "@/assets/gelo-bob-marley.png";
import geloMaracuja from "@/assets/gelo-maracuja.png";
import geloMacaVerde from "@/assets/gelo-maca-verde.png";
import geloMelanciaMaca from "@/assets/gelo-melancia-maca.png";
import geloMaracujaCoco from "@/assets/gelo-maracuja-coco.png";
import geloBobMarleyDetalhe from "@/assets/gelo-bob-marley-detalhe.png";
import geloProducao from "@/assets/gelo-producao.png";
import { z } from "zod";

const WHATSAPP_NUMBER = "5595991725677";

// Map sabor names to images
const SABOR_IMAGES: Record<string, string> = {
  morango: geloMorango,
  "bob marley": geloBobMarley,
  maracujá: geloMaracuja,
  "maçã verde": geloMacaVerde,
  "maçã": geloMacaVerde,
  "melancia": geloMelanciaMaca,
  "maracujá com coco": geloMaracujaCoco,
  "maracuja coco": geloMaracujaCoco,
};

const SABOR_EMOJIS: Record<string, string> = {
  morango: "🍓",
  "bob marley": "🇯🇲",
  maracujá: "🔥",
  "maçã verde": "🍏",
  "maçã": "🍏",
  melancia: "🍉",
  "maracujá com coco": "🥥",
  limão: "🍋",
  manga: "🥭",
  uva: "🍇",
};

function getSaborImage(nome: string): string | null {
  const lower = nome.toLowerCase();
  for (const [key, img] of Object.entries(SABOR_IMAGES)) {
    if (lower.includes(key)) return img;
  }
  return null;
}

function getSaborEmoji(nome: string): string {
  const lower = nome.toLowerCase();
  for (const [key, emoji] of Object.entries(SABOR_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return "🧊";
}

// Generate a gradient based on sabor name
function getSaborGradient(nome: string): string {
  const lower = nome.toLowerCase();
  if (lower.includes("morango")) return "from-rose-500/20 to-pink-500/10";
  if (lower.includes("bob marley")) return "from-green-500/20 via-yellow-500/10 to-red-500/10";
  if (lower.includes("maracujá") && lower.includes("coco")) return "from-amber-500/20 to-orange-300/10";
  if (lower.includes("maracujá")) return "from-amber-500/20 to-yellow-500/10";
  if (lower.includes("maçã")) return "from-green-400/20 to-emerald-500/10";
  if (lower.includes("melancia")) return "from-red-400/20 to-green-500/10";
  if (lower.includes("limão")) return "from-lime-400/20 to-yellow-400/10";
  if (lower.includes("manga")) return "from-orange-400/20 to-amber-400/10";
  if (lower.includes("uva")) return "from-purple-500/20 to-violet-400/10";
  return "from-primary/10 to-secondary/10";
}

interface Sabor {
  id: string;
  nome: string;
  estoque: number;
  imagem_url: string | null;
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
  const [step, setStep] = useState<"hero" | "catalogo" | "dados">("hero");
  const catalogoRef = useRef<HTMLDivElement>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addedAnimation, setAddedAnimation] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Fetch sabores with their stock
      const { data: saboresData } = await supabase
        .from("sabores")
        .select("id, nome, imagem_url")
        .eq("ativo", true)
        .order("nome");

      const { data: estoqueData } = await supabase
        .from("estoque_gelos")
        .select("sabor_id, quantidade");

      const estoqueMap = new Map(
        (estoqueData ?? []).map((e: any) => [e.sabor_id, Number(e.quantidade)])
      );

      const saboresComEstoque = (saboresData ?? [])
        .map((s: any) => ({ ...s, estoque: estoqueMap.get(s.id) ?? 0 }))
        .filter((s: any) => s.estoque > 0);

      setSabores(saboresComEstoque);
      setLoading(false);
    })();
  }, []);

  const addToCart = (sabor: Sabor) => {
    const currentQty = getQty(sabor.id);
    if (currentQty >= sabor.estoque) {
      toast({ title: "Estoque limitado", description: `Máximo disponível: ${sabor.estoque} un`, variant: "destructive" });
      return;
    }
    setAddedAnimation(sabor.id);
    setTimeout(() => setAddedAnimation(null), 600);
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
    if (delta > 0) {
      const sabor = sabores.find(s => s.id === sabor_id);
      const currentQty = getQty(sabor_id);
      if (sabor && currentQty >= sabor.estoque) {
        toast({ title: "Estoque limitado", description: `Máximo disponível: ${sabor.estoque} un`, variant: "destructive" });
        return;
      }
    }
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

  const scrollToCatalogo = () => {
    setStep("catalogo");
    setTimeout(() => catalogoRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

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
      `🧊 *NOVO PEDIDO — A ERA DOS SABORES*`,
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
    toast({ title: "Pedido gerado! ✅", description: "Finalize o envio no WhatsApp." });
  };

  return (
    <>
      <Helmet>
        <title>Faça seu Pedido | A Era dos Sabores</title>
        <meta name="description" content="Peça gelos artesanais com sabor de verdade. Monte seu pedido e envie pelo WhatsApp." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* STICKY HEADER */}
        <header className="sticky top-0 z-50 border-b border-border/50 bg-card/90 backdrop-blur-xl shadow-sm">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="A Era dos Sabores" className="h-10" />
            </Link>
            {step !== "hero" && totalItens > 0 && step === "catalogo" && (
              <Button
                size="sm"
                onClick={() => setStep("dados")}
                className="gap-2 animate-in slide-in-from-right-2 rounded-full px-4 shadow-md"
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="font-bold">{totalItens}</span>
                <span className="hidden sm:inline">— R$ {totalValor.toFixed(2)}</span>
              </Button>
            )}
            {step === "dados" && (
              <Button size="sm" variant="ghost" onClick={() => setStep("catalogo")} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            )}
          </div>
        </header>

        {/* HERO SECTION */}
        {step === "hero" && (
          <section className="relative overflow-hidden">
            {/* Background with overlay */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-b from-foreground/80 via-foreground/60 to-background z-10" />
              <img
                src={geloProducao}
                alt="Gelos artesanais"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="relative z-20 mx-auto max-w-2xl px-4 py-16 sm:py-24 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 backdrop-blur-md px-4 py-1.5 mb-6 border border-primary/30">
                <Snowflake className="h-4 w-4 text-primary-foreground" />
                <span className="text-xs font-semibold text-primary-foreground tracking-wide uppercase">
                  Gelos Artesanais com Sabor de Verdade
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-black text-primary-foreground leading-tight mb-4 drop-shadow-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Transforme suas<br />
                bebidas em<br />
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  experiências
                </span>
              </h1>

              <p className="text-primary-foreground/80 text-base sm:text-lg mb-8 max-w-md mx-auto leading-relaxed">
                Gelos saborizados que colorem, perfumam e transformam qualquer drink numa explosão de sabor. Seu copo nunca mais vai ser o mesmo! 🔥
              </p>

              {/* Trust badges */}
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {[
                  { icon: Snowflake, text: "Cor, Cheiro e Sabor da Fruta" },
                  { icon: Truck, text: "Entrega Rápida" },
                  { icon: Star, text: "+500 Clientes" },
                ].map((b) => (
                  <div
                    key={b.text}
                    className="flex items-center gap-1.5 bg-primary-foreground/10 backdrop-blur-md rounded-full px-3 py-1.5 border border-primary-foreground/20"
                  >
                    <b.icon className="h-3.5 w-3.5 text-primary-foreground/90" />
                    <span className="text-xs font-medium text-primary-foreground/90">{b.text}</span>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                onClick={scrollToCatalogo}
                className="rounded-full px-8 h-14 text-base font-bold shadow-xl gap-2 animate-bounce"
                style={{ animationDuration: "2s" }}
              >
                <ShoppingCart className="h-5 w-5" />
                Montar meu Pedido
              </Button>

              <div className="mt-8 animate-bounce" style={{ animationDuration: "3s" }}>
                <ChevronDown className="h-6 w-6 mx-auto text-primary-foreground/50" />
              </div>
            </div>

            {/* Floating product images */}
            <div className="absolute bottom-4 left-4 z-20 hidden sm:block">
              <img
                src={geloMorango}
                alt=""
                className="w-20 h-20 object-contain opacity-80 rotate-[-15deg] drop-shadow-2xl"
              />
            </div>
            <div className="absolute bottom-8 right-6 z-20 hidden sm:block">
              <img
                src={geloBobMarleyDetalhe}
                alt=""
                className="w-24 h-24 object-contain opacity-80 rotate-[10deg] drop-shadow-2xl"
              />
            </div>
          </section>
        )}

        {/* CATÁLOGO */}
        {(step === "catalogo" || step === "hero") && (
          <div ref={catalogoRef}>
            {step === "catalogo" && (
              <main className="mx-auto max-w-2xl px-4 py-6 pb-32">
                {/* Section title */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-primary tracking-wide uppercase">Cardápio</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-foreground">
                    Escolha seus Sabores
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Toque no sabor para adicionar ao pedido
                  </p>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Snowflake className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-muted-foreground">Carregando sabores...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sabores.map((s) => {
                      const qty = getQty(s.id);
                      const img = s.imagem_url || getSaborImage(s.nome);
                      const emoji = getSaborEmoji(s.nome);
                      const gradient = getSaborGradient(s.nome);
                      const isAnimating = addedAnimation === s.id;

                      return (
                        <div
                          key={s.id}
                          className={`
                            relative overflow-hidden rounded-2xl border transition-all duration-300
                            ${qty > 0
                              ? "border-primary/40 shadow-md shadow-primary/10 scale-[1.01]"
                              : "border-border hover:border-primary/20 hover:shadow-sm"
                            }
                            ${isAnimating ? "scale-[1.03]" : ""}
                          `}
                        >
                          {/* Gradient background */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-60`} />

                          <div className="relative p-4">
                            {/* Product image or emoji */}
                            <div className="flex items-start gap-3 mb-3">
                              {img ? (
                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-card/80 backdrop-blur-sm border border-border/50 flex-shrink-0 shadow-sm">
                                  <img src={img} alt={s.nome} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center flex-shrink-0 text-3xl shadow-sm">
                                  {emoji}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-foreground text-base leading-tight">
                                  {s.nome}
                                </p>
                                <p className="text-primary font-black text-lg mt-0.5">
                                  R$ {PRECO_UNITARIO.toFixed(2)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {s.estoque} un disponíveis
                                </p>
                              </div>
                              {qty > 0 && (
                                <Badge className="bg-primary text-primary-foreground font-bold text-xs animate-in zoom-in-50">
                                  {qty}x
                                </Badge>
                              )}
                            </div>

                            {/* Action area */}
                            {qty === 0 ? (
                              <Button
                                onClick={() => addToCart(s)}
                                variant="outline"
                                className="w-full rounded-xl h-10 gap-2 bg-card/60 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-all"
                              >
                                <Plus className="h-4 w-4" />
                                Adicionar
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-10 w-10 rounded-xl bg-card/60 backdrop-blur-sm"
                                  onClick={() => updateQty(s.id, -1)}
                                >
                                  {qty === 1 ? (
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  ) : (
                                    <Minus className="h-4 w-4" />
                                  )}
                                </Button>
                                <div className="flex-1 text-center">
                                  <span className="text-xl font-black text-foreground">{qty}</span>
                                  <p className="text-[10px] text-muted-foreground -mt-0.5">unidades</p>
                                </div>
                                <Button
                                  size="icon"
                                  className="h-10 w-10 rounded-xl shadow-sm"
                                  onClick={() => updateQty(s.id, 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Floating cart bar */}
                {totalItens > 0 && (
                  <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
                    <div className="mx-auto max-w-2xl">
                      <Button
                        className="w-full h-14 rounded-2xl text-base font-bold shadow-2xl gap-3 relative overflow-hidden"
                        onClick={() => setStep("dados")}
                      >
                        <ShoppingCart className="h-5 w-5" />
                        <span>
                          Finalizar Pedido — {totalItens} {totalItens === 1 ? "item" : "itens"}
                        </span>
                        <span className="ml-auto font-black">R$ {totalValor.toFixed(2)}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </main>
            )}
          </div>
        )}

        {/* DADOS DO CLIENTE */}
        {step === "dados" && (
          <main className="mx-auto max-w-2xl px-4 py-6 pb-8">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-primary">Sabores</span>
              </div>
              <div className="flex-1 h-0.5 bg-primary/30 rounded-full" />
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Send className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-xs font-bold text-foreground">Finalizar</span>
              </div>
            </div>

            {/* Resumo compacto */}
            <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-4 mb-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Seu Pedido
                </h3>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setStep("catalogo")}>
                  Editar
                </Button>
              </div>
              <div className="space-y-2">
                {cart.map((i) => (
                  <div key={i.sabor_id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      <span className="mr-1.5">{getSaborEmoji(i.nome)}</span>
                      {i.nome} <span className="text-muted-foreground">× {i.quantidade}</span>
                    </span>
                    <span className="font-semibold text-foreground">R$ {(i.quantidade * PRECO_UNITARIO).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border mt-3 pt-3 flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground">{totalItens} unidades</p>
                  <p className="text-lg font-black text-foreground">R$ {totalValor.toFixed(2)}</p>
                </div>
                <Badge variant="outline" className="gap-1 text-primary border-primary/30">
                  <Clock className="h-3 w-3" /> Entrega rápida
                </Badge>
              </div>
            </div>

            {/* Formulário */}
            <div className="space-y-4">
              <h3 className="font-bold text-foreground text-lg">Dados para Entrega</h3>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Nome completo *</label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como devemos te chamar?"
                  maxLength={100}
                  className="h-12 rounded-xl"
                />
                {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">WhatsApp *</label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(99) 99999-9999"
                  maxLength={20}
                  className="h-12 rounded-xl"
                />
                {errors.telefone && <p className="text-xs text-destructive">{errors.telefone}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Endereço de entrega *</label>
                <Input
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, número, complemento"
                  maxLength={300}
                  className="h-12 rounded-xl"
                />
                {errors.endereco && <p className="text-xs text-destructive">{errors.endereco}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Bairro *</label>
                <Input
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Seu bairro"
                  maxLength={100}
                  className="h-12 rounded-xl"
                />
                {errors.bairro && <p className="text-xs text-destructive">{errors.bairro}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Forma de Pagamento *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "pix", label: "PIX", icon: "📱", desc: "Transferência instantânea" },
                    { value: "dinheiro", label: "Dinheiro", icon: "💵", desc: "Na entrega" },
                    { value: "cartao", label: "Cartão", icon: "💳", desc: "Crédito ou débito" },
                    { value: "fiado", label: "Fiado", icon: "📝", desc: "Para clientes cadastrados" },
                  ].map((op) => (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => setFormaPagamento(op.value)}
                      className={`
                        flex flex-col items-center gap-1 rounded-xl border p-3 transition-all
                        ${formaPagamento === op.value
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                          : "border-border bg-card hover:border-primary/30"
                        }
                      `}
                    >
                      <span className="text-2xl">{op.icon}</span>
                      <span className={`text-sm font-semibold ${formaPagamento === op.value ? "text-primary" : "text-foreground"}`}>
                        {op.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{op.desc}</span>
                    </button>
                  ))}
                </div>
                {errors.formaPagamento && <p className="text-xs text-destructive">{errors.formaPagamento}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Observações</label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Troco para quanto? Horário preferido? Ponto de referência?"
                  maxLength={500}
                  rows={3}
                  className="rounded-xl"
                />
              </div>

              <Button
                className="w-full h-14 rounded-2xl text-base font-bold shadow-lg gap-3 mt-2"
                onClick={handleEnviar}
              >
                <Send className="h-5 w-5" />
                Enviar Pedido pelo WhatsApp
              </Button>

              <p className="text-[11px] text-muted-foreground text-center">
                Ao enviar, você será redirecionado ao WhatsApp para confirmar o pedido.
              </p>
            </div>
          </main>
        )}
      </div>
    </>
  );
}
