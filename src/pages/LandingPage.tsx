import { useState } from "react";
import { Link } from "react-router-dom";
import {
  IceCream, Droplets, Sparkles, Leaf, Star, Send, MapPin, Phone, Mail,
  ArrowRight, Instagram, Facebook, ChevronRight, ThermometerSnowflake, Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import geloBobMarley from "@/assets/gelo-bob-marley.png";
import geloMelanciaMaca from "@/assets/gelo-melancia-maca.png";
import geloMaracujaCoco from "@/assets/gelo-maracuja-coco.png";
import geloMorango from "@/assets/gelo-morango.png";
import geloMaracuja from "@/assets/gelo-maracuja.png";
import geloMacaVerde from "@/assets/gelo-maca-verde.png";
import geloProducao from "@/assets/gelo-producao.png";
import geloBobMarleyDetalhe from "@/assets/gelo-bob-marley-detalhe.png";
import sidImg from "@/assets/sid.png";

const sabores = [
  {
    nome: "Gelo de Morango 🍓",
    desc: "Feito com morango de verdade, cor vibrante e sabor intenso. Perfeito para drinks e sucos.",
    img: geloMorango,
  },
  {
    nome: "Gelo de Maracujá 🔥",
    desc: "Maracujá concentrado com acidez equilibrada. Ideal para coquetéis e águas saborizadas.",
    img: geloMaracuja,
  },
  {
    nome: "Gelo Maçã Verde 🍏",
    desc: "Refrescante e com aroma marcante. Surpreende em qualquer bebida com seu toque especial.",
    img: geloMacaVerde,
  },
  {
    nome: "Gelo Bob Marley 🇯🇲",
    desc: "Três camadas: melancia, maracujá e maçã verde. 220ml de pura explosão de sabores!",
    img: geloBobMarley,
  },
];

const beneficios = [
  {
    icon: ThermometerSnowflake,
    titulo: "Frescor Duradouro",
    desc: "Nossos gelos mantêm suas bebidas geladas por mais tempo, liberando sabor gradualmente.",
  },
  {
    icon: Sparkles,
    titulo: "Sabor Intenso",
    desc: "Ingredientes naturais concentrados garantem um sabor marcante do início ao fim.",
  },
  {
    icon: Leaf,
    titulo: "100% Natural",
    desc: "Sem conservantes artificiais, corantes ou aditivos. Puro sabor da natureza.",
  },
  {
    icon: Droplets,
    titulo: "Versatilidade",
    desc: "Perfeito para drinks, sucos, águas, coquetéis e qualquer bebida que você imaginar.",
  },
];

const depoimentos = [
  {
    nome: "Ana Paula S.",
    texto: "Os gelos de maracujá são incríveis! Transformaram completamente meus drinks de verão. Recomendo demais!",
    estrelas: 5,
  },
  {
    nome: "Carlos M.",
    texto: "Qualidade excepcional. Uso nos eventos da minha empresa e os convidados sempre elogiam.",
    estrelas: 5,
  },
  {
    nome: "Juliana R.",
    texto: "Meus filhos amam! O de morango é o favorito. Prático, saboroso e sem químicas.",
    estrelas: 5,
  },
];

export default function LandingPage() {
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formMsg, setFormMsg] = useState("");

  function handleSubmitContato(e: React.FormEvent) {
    e.preventDefault();
    if (!formNome.trim() || !formEmail.trim() || !formMsg.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    toast({ title: "Mensagem enviada!", description: "Entraremos em contato em breve." });
    setFormNome("");
    setFormEmail("");
    setFormMsg("");
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="A Era dos Sabores" className="h-10 w-10 rounded-lg shadow-sm" />
            <span className="text-lg font-bold hidden sm:inline">A Era dos Sabores</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#sobre" className="hover:text-foreground transition-colors">Sobre</a>
            <a href="#sabores" className="hover:text-foreground transition-colors">Sabores</a>
            <a href="#beneficios" className="hover:text-foreground transition-colors">Benefícios</a>
            <a href="#contato" className="hover:text-foreground transition-colors">Contato</a>
          </nav>
          <Link to="/painel">
            <Button size="sm" variant="outline" className="gap-1.5">
              Painel <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative min-h-[90vh] flex items-center">
        {/* Background with real product photo */}
        <div className="absolute inset-0 overflow-hidden">
          <img src={geloMelanciaMaca} alt="Gelos Saborizados" className="w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-36 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-semibold mb-6 backdrop-blur-sm border border-primary/20">
              <IceCream className="h-4 w-4" />
              Gelos Saborizados Artesanais
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Transformando sua experiência com{" "}
              <span className="text-primary">gelos saborizados!</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
              Na Era dos Sabores, trazemos gelos saborizados inovadores para dar um toque especial às suas bebidas. Descubra nossos sabores exclusivos e surpreenda-se!
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <a href="#sabores">
                <Button size="lg" className="gap-2 text-base px-8 shadow-lg">
                  Veja Nossos Sabores <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
              <a href="#contato">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 backdrop-blur-sm">
                  Entre em Contato
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SOBRE + GALERIA ─── */}
      <section id="sobre" className="py-20 md:py-28 bg-gradient-to-b from-secondary/10 to-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Sobre a <span className="text-primary">Era dos Sabores</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Somos uma empresa apaixonada por transformar momentos simples em experiências saborosas.
                Nossos gelos saborizados são produzidos artesanalmente com ingredientes frescos e naturais,
                pensados para adicionar cor, sabor e diversão a qualquer bebida.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Do happy hour em família ao evento corporativo, nossos produtos fazem a diferença.
                Cada gelo é produzido com cuidado e dedicação, garantindo qualidade e sabor em cada cubo.
              </p>
            </div>
            {/* Real production photos grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl overflow-hidden shadow-lg border border-border row-span-2">
                <img src={geloBobMarleyDetalhe} alt="Gelo Bob Marley - detalhes dos sabores" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="rounded-2xl overflow-hidden shadow-lg border border-border">
                <img src={geloProducao} alt="Produção artesanal" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="rounded-2xl overflow-hidden shadow-lg border border-border">
                <img src={geloMaracujaCoco} alt="Gelo de maracujá e coco" className="w-full h-full object-cover" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DESTAQUE BOB MARLEY ─── */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/90 via-yellow-500/90 to-red-500/90" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-white">
              <span className="text-sm font-bold uppercase tracking-widest opacity-80">Novidade!!</span>
              <h2 className="text-4xl md:text-5xl font-bold mt-2 mb-4">Gelo Bob Marley</h2>
              <p className="text-xl opacity-90 mb-2">220ml de pura explosão de sabores</p>
              <ul className="space-y-2 mt-6 text-lg">
                <li className="flex items-center gap-3">🍉 <span>Melancia — frescor tropical</span></li>
                <li className="flex items-center gap-3">🥭 <span>Maracujá — acidez equilibrada</span></li>
                <li className="flex items-center gap-3">🍏 <span>Maçã Verde — toque refrescante</span></li>
              </ul>
              <a href="#contato">
                <Button size="lg" variant="secondary" className="mt-8 gap-2 text-base px-10 shadow-lg">
                  Faça Seu Pedido <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
            </div>
            <div className="flex justify-center">
              <img
                src={geloBobMarley}
                alt="Gelo Bob Marley"
                className="max-h-[500px] object-contain rounded-3xl shadow-2xl"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── SABORES / PRODUTOS ─── */}
      <section id="sabores" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos Sabores</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Conheça nossa linha de gelos saborizados feitos com frutas selecionadas e ingredientes premium.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {sabores.map((s) => (
              <div
                key={s.nome}
                className="group rounded-2xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="relative h-72 overflow-hidden bg-muted">
                  <img
                    src={s.img}
                    alt={s.nome}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold mb-2">{s.nome}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
                  <a href="#contato">
                    <Button size="sm" variant="outline" className="w-full gap-1.5">
                      Faça seu Pedido <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BENEFÍCIOS ─── */}
      <section id="beneficios" className="py-20 md:py-28 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Por que escolher nossos gelos?</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Qualidade, sabor e praticidade em cada cubo.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {beneficios.map((b) => (
              <div key={b.titulo} className="text-center p-8 rounded-2xl bg-card/60 backdrop-blur border border-border hover:border-primary/30 transition-colors">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <b.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-3">{b.titulo}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DEPOIMENTOS ─── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">O que nossos clientes dizem</h2>
            <p className="text-muted-foreground text-lg">A satisfação dos nossos clientes é nosso maior orgulho.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {depoimentos.map((d) => (
              <div key={d.nome} className="p-6 rounded-2xl bg-card border border-border shadow-sm">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: d.estrelas }).map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4 italic">"{d.texto}"</p>
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{d.nome}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CONTATO ─── */}
      <section id="contato" className="py-20 md:py-28 bg-gradient-to-b from-secondary/10 to-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Entre em Contato</h2>
              <p className="text-muted-foreground mb-8">
                Faça seu pedido ou tire suas dúvidas. Responderemos o mais rápido possível!
              </p>
              <form onSubmit={handleSubmitContato} className="space-y-5">
                <Input placeholder="Seu nome" value={formNome} onChange={(e) => setFormNome(e.target.value)} className="h-12" maxLength={100} />
                <Input type="email" placeholder="Seu e-mail" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="h-12" maxLength={255} />
                <Textarea placeholder="Sua mensagem ou pedido..." value={formMsg} onChange={(e) => setFormMsg(e.target.value)} className="min-h-[120px]" maxLength={1000} />
                <Button type="submit" size="lg" className="gap-2 w-full sm:w-auto px-10">
                  Enviar Mensagem <Send className="h-5 w-5" />
                </Button>
              </form>
            </div>
            <div className="flex flex-col justify-center space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Telefone</h4>
                  <p className="text-muted-foreground">(11) 99999-9999</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">E-mail</h4>
                  <p className="text-muted-foreground">contato@aeradossabores.com.br</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Localização</h4>
                  <p className="text-muted-foreground">São Paulo, SP - Brasil</p>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden border border-border h-48 bg-muted">
                <iframe
                  title="Localização"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d467692.0488684!2d-46.87529!3d-23.6821!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce448183a461d1%3A0x9ba94b08ff335bae!2sS%C3%A3o%20Paulo%2C%20SP!5e0!3m2!1spt-BR!2sbr!4v1"
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-16 bg-primary text-primary-foreground relative overflow-hidden">
        <img src={sidImg} alt="" aria-hidden className="absolute right-8 top-1/2 -translate-y-1/2 w-32 h-32 object-contain opacity-15 pointer-events-none select-none hidden lg:block" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para experimentar?</h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
            Adicione sabor e cor às suas bebidas. Faça seu pedido agora e receba em casa!
          </p>
          <a href="#contato">
            <Button size="lg" variant="secondary" className="gap-2 text-base px-10 shadow-lg">
              Faça Seu Pedido <ArrowRight className="h-5 w-5" />
            </Button>
          </a>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logo} alt="A Era dos Sabores" className="h-10 w-10 rounded-lg" />
                <span className="font-bold text-lg">A Era dos Sabores</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Gelos saborizados artesanais feitos com ingredientes frescos e naturais para transformar suas bebidas.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Links Rápidos</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#sobre" className="hover:text-foreground transition-colors">Sobre Nós</a></li>
                <li><a href="#sabores" className="hover:text-foreground transition-colors">Nossos Sabores</a></li>
                <li><a href="#beneficios" className="hover:text-foreground transition-colors">Benefícios</a></li>
                <li><a href="#contato" className="hover:text-foreground transition-colors">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Redes Sociais</h4>
              <div className="flex gap-3">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <Instagram className="h-5 w-5 text-primary" />
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <Facebook className="h-5 w-5 text-primary" />
                </a>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>contato@aeradossabores.com.br</p>
                <p>(11) 99999-9999</p>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} A Era dos Sabores — Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
