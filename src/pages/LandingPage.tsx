import { useState, useEffect, useRef } from "react";
import { GradientDots } from "@/components/ui/gradient-dots";
import { Link } from "react-router-dom";
import { LogIn, ShoppingCart, Download, Share, Plus, MoreVertical, X, Smartphone, Monitor, Menu } from "lucide-react";
import {
  IceCream, Droplets, Sparkles, Leaf, Star, Send, MapPin, Phone, Mail,
  ArrowRight, Instagram, Facebook, ChevronRight, ThermometerSnowflake, Heart,
  Factory, Users, TrendingUp, Truck, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

import logo from "@/assets/logo.png";
import geloBobMarley from "@/assets/gelo-bob-marley.png";
import geloMelanciaMaca from "@/assets/gelo-melancia-maca.png";
import geloMaracujaCoco from "@/assets/gelo-maracuja-coco.png";
import geloMorango from "@/assets/gelo-morango.png";
import geloMaracuja from "@/assets/gelo-maracuja.png";
import geloMacaVerde from "@/assets/gelo-maca-verde.png";
import geloProducao from "@/assets/gelo-producao.png";
import geloBobMarleyDetalhe from "@/assets/gelo-bob-marley-detalhe.png";
import saborMelancia from "@/assets/sabor-melancia.jpg";
import saborMacaVerde from "@/assets/sabor-maca-verde.jpg";
import saborMorango from "@/assets/sabor-morango2.jpg";
import saborMaracuja from "@/assets/sabor-maracuja2.jpg";
import saborAguaCoco from "@/assets/sabor-agua-coco.jpg";
import saborAbacaxiHortela from "@/assets/sabor-abacaxi-hortela.jpg";

const sabores = [
  { nome: "Gelo de Melancia 🍉", desc: "Vermelho intenso e sabor refrescante de melancia natural. Transforma qualquer drink!", img: saborMelancia },
  { nome: "Gelo de Morango 🍓", desc: "Feito com morango de verdade, cor vibrante e sabor intenso. Perfeito para drinks e sucos.", img: saborMorango },
  { nome: "Gelo de Maracujá 🔥", desc: "Maracujá concentrado com acidez equilibrada. Ideal para coquetéis e águas saborizadas.", img: saborMaracuja },
  { nome: "Gelo Maçã Verde 🍏", desc: "Refrescante e com aroma marcante. Surpreende em qualquer bebida com seu toque especial.", img: saborMacaVerde },
  { nome: "Gelo Água de Coco 🥥", desc: "Leve, natural e hidratante. O toque tropical perfeito para suas bebidas.", img: saborAguaCoco },
  { nome: "Gelo Abacaxi com Hortelã 🍍", desc: "Frescor tropical com toque mentolado. A combinação perfeita para drinks refrescantes!", img: saborAbacaxiHortela },
  { nome: "Gelo Bob Marley 🇯🇲", desc: "Três camadas: melancia, maracujá e maçã verde. 220ml de pura explosão de sabores!", img: geloBobMarley },
];

const beneficios = [
  { icon: ThermometerSnowflake, titulo: "Frescor Duradouro", desc: "Nossos gelos mantêm suas bebidas geladas por mais tempo, liberando sabor gradualmente." },
  { icon: Sparkles, titulo: "Sabor Intenso", desc: "Ingredientes naturais concentrados garantem um sabor marcante do início ao fim." },
  { icon: Leaf, titulo: "100% Natural", desc: "Sem conservantes artificiais, corantes ou aditivos. Puro sabor da natureza." },
  { icon: Droplets, titulo: "Versatilidade", desc: "Perfeito para drinks, sucos, águas, coquetéis e qualquer bebida que você imaginar." },
];

const compromissos = [
  { icon: Factory, titulo: "Produção Local", desc: "Nossa fábrica em Boa Vista garante frescor e qualidade direto da produção para sua mesa." },
  { icon: Users, titulo: "Geração de Empregos", desc: "Geramos empregos e apoiamos o desenvolvimento econômico de Roraima." },
  { icon: TrendingUp, titulo: "Economia Regional", desc: "Fortalecemos a cadeia produtiva local, valorizando ingredientes e fornecedores regionais." },
  { icon: Truck, titulo: "Distribuição Regional", desc: "Distribuímos para toda Boa Vista e regiões próximas, levando sabor a cada canto." },
];

const depoimentos = [
  { nome: "Ana Paula S.", texto: "Os gelos de maracujá são incríveis! Transformaram completamente meus drinks de verão. Recomendo demais!", estrelas: 5 },
  { nome: "Carlos M.", texto: "Qualidade excepcional. Uso nos eventos da minha empresa e os convidados sempre elogiam.", estrelas: 5 },
  { nome: "Juliana R.", texto: "Meus filhos amam! O de morango é o favorito. Prático, saboroso e sem químicas.", estrelas: 5 },
];

const navLinks = [
  { href: "#sobre", label: "Sobre" },
  { href: "#sabores", label: "Sabores" },
  { href: "#beneficios", label: "Benefícios" },
  { href: "#compromisso", label: "Compromisso Local" },
  { href: "#contato", label: "Contato" },
];

// Hook for fade-in on scroll
function useScrollFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    observer.observe(el);
    return () => observer.unobserve(el);
  }, []);

  return { ref, className: `transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}` };
}

function FadeInSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const fade = useScrollFadeIn();
  return <div ref={fade.ref} className={`${fade.className} ${className}`}>{children}</div>;
}

export default function LandingPage() {
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formMsg, setFormMsg] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  useEffect(() => {
    document.title = "A Era dos Sabores | Gelo Saborizado em Boa Vista, Roraima";

    const setMeta = (name: string, content: string, attribute: "name" | "property" = "name") => {
      let element = document.head.querySelector(`meta[${attribute}='${name}']`) as HTMLMetaElement | null;

      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    };

    const setLink = (rel: string, href: string) => {
      let element = document.head.querySelector(`link[rel='${rel}']`) as HTMLLinkElement | null;

      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
      }

      element.setAttribute("href", href);
    };

    setMeta("description", "Fábrica de gelo saborizado artesanal em Boa Vista, Roraima. Morango, maracujá, maçã verde e Bob Marley. Peça agora!");
    setLink("canonical", "https://aeradossabores.com.br");
    setMeta("og:title", "A Era dos Sabores | Gelo Saborizado Artesanal", "property");
    setMeta("og:description", "Gelos saborizados de qualidade, direto de Boa Vista para o Brasil. Morango, maracujá, maçã verde e Bob Marley!", "property");
    setMeta("twitter:title", "A Era dos Sabores | Gelo Saborizado");
    setMeta("twitter:description", "Gelos saborizados artesanais de Boa Vista, Roraima.");

    let jsonLd = document.head.querySelector("script[data-page='landing-jsonld']") as HTMLScriptElement | null;

    if (!jsonLd) {
      jsonLd = document.createElement("script");
      jsonLd.type = "application/ld+json";
      jsonLd.setAttribute("data-page", "landing-jsonld");
      document.head.appendChild(jsonLd);
    }

    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "A Era dos Sabores",
      description: "Fábrica de gelo saborizado artesanal em Boa Vista, Roraima",
      address: { "@type": "PostalAddress", addressLocality: "Boa Vista", addressRegion: "RR", addressCountry: "BR" },
      url: "https://aeradossabores.com.br",
      image: "/favicon.png",
    });

    return () => {
      jsonLd?.remove();
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        toast({ title: "App instalado com sucesso! 🎉" });
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallDialog(true);
    }
  }

  async function handleSubmitContato(e: React.FormEvent) {
    e.preventDefault();
    if (!formNome.trim() || !formEmail.trim() || !formMsg.trim()) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setFormLoading(true);
    try {
      const { error } = await supabase.from("contato_landing").insert({
        nome: formNome.trim(),
        email: formEmail.trim(),
        telefone: formTelefone.trim() || null,
        mensagem: formMsg.trim(),
      });
      if (error) throw error;
      toast({ title: "Pedido enviado com sucesso! 🎉", description: "Entraremos em contato em breve." });
      setFormNome("");
      setFormEmail("");
      setFormTelefone("");
      setFormMsg("");
    } catch {
      toast({ title: "Erro ao enviar", description: "Tente novamente ou entre em contato pelo WhatsApp.", variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <GradientDots duration={25} colorCycleDuration={8} dotSize={6} spacing={12} className="opacity-30 pointer-events-none z-0 fixed" />

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 bg-background md:bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="A Era dos Sabores" className="h-10 w-10 rounded-lg shadow-sm" />
            <div className="hidden sm:block">
              <span className="text-lg font-bold block leading-tight">A Era dos Sabores</span>
              <span className="text-xs text-muted-foreground">Boa Vista • Roraima</span>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground transition-colors">{l.label}</a>
            ))}
            <Link to="/pedir" className="hover:text-foreground transition-colors text-primary font-semibold">Peça Online</Link>
          </nav>

          <div className="flex items-center gap-2">
            {!isInstalled && (
              <Button size="sm" variant="outline" className="gap-1.5 hidden sm:inline-flex" onClick={handleInstallClick}>
                <Download className="h-4 w-4" /> Baixar App
              </Button>
            )}
            <Link to="/login">
              <Button size="sm" className="gap-1.5">
                <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Entrar</span>
              </Button>
            </Link>

            {/* Mobile hamburger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <img src={logo} alt="Logo" className="h-8 w-8 rounded-lg" />
                    A Era dos Sabores
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 mt-6">
                  {navLinks.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-3 rounded-lg text-sm font-medium hover:bg-accent/10 transition-colors"
                    >
                      {l.label}
                    </a>
                  ))}
                  <Link
                    to="/pedir"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-lg text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                  >
                    🛒 Peça Online
                  </Link>
                  {!isInstalled && (
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleInstallClick(); }}
                      className="px-4 py-3 rounded-lg text-sm font-medium text-left hover:bg-accent/10 transition-colors flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" /> Baixar App
                    </button>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative min-h-[92vh] flex items-center">
        <div className="absolute inset-0 overflow-hidden">
          <img src={geloMelanciaMaca} alt="Gelos Saborizados" className="w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-36 w-full z-10">
          <FadeInSection className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-semibold mb-6 backdrop-blur-sm border border-primary/20">
              <MapPin className="h-4 w-4" />
              Fábrica em Boa Vista, Roraima
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              A Era dos Sabores:{" "}
              <span className="text-primary">Fábrica de Gelo Saborizado</span> em Boa Vista!
            </h1>
            <p className="mt-4 text-lg md:text-xl text-muted-foreground font-medium">
              Gelos saborizados de qualidade, diretamente de Boa Vista para o Brasil.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-xl">
              Na Era dos Sabores, trazemos gelos saborizados inovadores para dar um toque especial às suas bebidas. Descubra nossos sabores exclusivos e surpreenda-se!
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <a href="#sabores">
                <Button size="lg" className="gap-2 text-base px-8 shadow-lg w-full sm:w-auto">
                  Veja Nossos Sabores <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
              <Link to="/pedir">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8 backdrop-blur-sm w-full sm:w-auto">
                  Faça Seu Pedido Online <ShoppingCart className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ─── SOBRE / APRESENTAÇÃO ─── */}
      <section id="sobre" className="py-20 md:py-28 bg-gradient-to-b from-secondary/10 to-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <FadeInSection>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 text-accent-foreground text-xs font-semibold mb-4 border border-accent/20">
                <Factory className="h-3.5 w-3.5" />
                Nossa Fábrica
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Conheça a <span className="text-primary">Era dos Sabores</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Somos a <strong>"A Era dos Sabores"</strong>, uma fábrica localizada em <strong>Boa Vista, Roraima</strong>, 
                especializada em criar gelos saborizados que transformam qualquer bebida. Nosso compromisso 
                é com a qualidade, inovação e frescor.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Cada gelo é produzido artesanalmente em nossa fábrica com ingredientes frescos e de alta qualidade, 
                passando por rigoroso controle para garantir o melhor sabor e segurança alimentar.
              </p>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">100%</div>
                  <div className="text-muted-foreground">Artesanal</div>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">10+</div>
                  <div className="text-muted-foreground">Sabores</div>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">BV/RR</div>
                  <div className="text-muted-foreground">Sede</div>
                </div>
              </div>
            </FadeInSection>
            <FadeInSection>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl overflow-hidden shadow-lg border border-border row-span-2">
                  <img src={geloBobMarleyDetalhe} alt="Gelo Bob Marley - detalhes dos sabores" className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="rounded-2xl overflow-hidden shadow-lg border border-border">
                  <img src={geloProducao} alt="Produção artesanal na fábrica" className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="rounded-2xl overflow-hidden shadow-lg border border-border">
                  <img src={geloMaracujaCoco} alt="Gelo de maracujá e coco" className="w-full h-full object-cover" loading="lazy" />
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ─── DESTAQUE BOB MARLEY ─── */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/90 via-yellow-500/90 to-red-500/90" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6">
          <FadeInSection>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="text-white">
                <span className="text-sm font-bold uppercase tracking-widest opacity-80">🔥 Novidade!!</span>
                <h2 className="text-4xl md:text-5xl font-bold mt-2 mb-4">Gelo Bob Marley</h2>
                <p className="text-xl opacity-90 mb-2">220ml de pura explosão de sabores</p>
                <p className="opacity-75 mb-6">Feito com ingredientes frescos em nossa fábrica de Boa Vista.</p>
                <ul className="space-y-3 text-lg">
                  <li className="flex items-center gap-3">🍉 <span>Melancia — frescor tropical</span></li>
                  <li className="flex items-center gap-3">🥭 <span>Maracujá — acidez equilibrada</span></li>
                  <li className="flex items-center gap-3">🍏 <span>Maçã Verde — toque refrescante</span></li>
                </ul>
                <Link to="/pedir">
                  <Button size="lg" variant="secondary" className="mt-8 gap-2 text-base px-10 shadow-lg">
                    Compre Agora <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
              <div className="flex justify-center">
                <img src={geloBobMarley} alt="Gelo Bob Marley" className="max-h-[500px] object-contain rounded-3xl shadow-2xl" loading="lazy" />
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ─── SABORES / PRODUTOS ─── */}
      <section id="sabores" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <FadeInSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos Sabores</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Feitos com ingredientes frescos e de alta qualidade em nossa fábrica de Boa Vista. 
              Cada sabor é pensado para surpreender.
            </p>
          </FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {sabores.map((s, i) => (
              <FadeInSection key={s.nome}>
                <div className="group rounded-2xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                  <div className="relative h-72 overflow-hidden bg-muted">
                    <img src={s.img} alt={s.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-bold mb-2">{s.nome}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{s.desc}</p>
                    <Link to="/pedir">
                      <Button size="sm" variant="outline" className="w-full gap-1.5">
                        Peça Online <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
          <FadeInSection className="text-center mt-12">
            <Link to="/pedir">
              <Button size="lg" className="gap-2 px-10">
                Ver Catálogo Completo e Pedir <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </FadeInSection>
        </div>
      </section>

      {/* ─── TABELA DE PREÇOS / PACOTES ─── */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-accent/5 via-background to-primary/5 relative overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-6">
          <FadeInSection className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/15 text-accent-foreground text-sm font-semibold mb-4 border border-accent/20">
              <TrendingUp className="h-4 w-4" />
              Quanto mais, mais barato!
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Nossos <span className="text-primary">Pacotes</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Preço por unidade que cabe no bolso. Compre mais e economize!
            </p>
          </FadeInSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Pacote 1 */}
            <FadeInSection>
              <div className="relative rounded-2xl border-2 border-border bg-card p-6 text-center transition-all hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 h-full">
                <div className="text-4xl mb-3">🧊</div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">1 a 9 unidades</p>
                <div className="my-3">
                  <span className="text-4xl font-black text-foreground">R$ 4,99</span>
                </div>
                <p className="text-xs text-muted-foreground">por unidade</p>
                <Link to="/pedir" className="block mt-5">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-full">
                    Pedir <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </FadeInSection>

            {/* Pacote 2 */}
            <FadeInSection>
              <div className="relative rounded-2xl border-2 border-border bg-card p-6 text-center transition-all hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 h-full">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-secondary text-secondary-foreground text-[11px] font-bold px-3 py-1 rounded-full">Econômico</span>
                </div>
                <div className="text-4xl mb-3">📦</div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">A partir de 10 un</p>
                <div className="my-3">
                  <span className="text-4xl font-black text-foreground">R$ 3,99</span>
                </div>
                <p className="text-xs text-muted-foreground">por unidade</p>
                <p className="text-xs text-primary font-semibold mt-1">Economize 20%</p>
                <Link to="/pedir" className="block mt-4">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-full">
                    Pedir <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </FadeInSection>

            {/* Pacote 3 - DESTAQUE */}
            <FadeInSection>
              <div className="relative rounded-2xl border-2 border-primary bg-gradient-to-b from-primary/10 to-card p-6 text-center shadow-xl shadow-primary/10 lg:scale-105 transition-all hover:-translate-y-1 h-full">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3" /> Familiar
                  </span>
                </div>
                <div className="text-4xl mb-3">🔥</div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">A partir de 30 un</p>
                <div className="my-3">
                  <span className="text-4xl font-black text-primary">R$ 2,50</span>
                </div>
                <p className="text-xs text-muted-foreground">por unidade</p>
                <p className="text-xs text-primary font-semibold mt-1">Economize 50%</p>
                <Link to="/pedir" className="block mt-4">
                  <Button size="sm" className="w-full gap-1.5 rounded-full shadow-md">
                    Pedir Agora <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </FadeInSection>

            {/* Pacote 4 */}
            <FadeInSection>
              <div className="relative rounded-2xl border-2 border-accent/50 bg-gradient-to-b from-accent/10 to-card p-6 text-center transition-all hover:shadow-lg hover:-translate-y-1 hover:border-accent h-full">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-accent text-accent-foreground text-[11px] font-bold px-3 py-1 rounded-full">Pacote Festa</span>
                </div>
                <div className="text-4xl mb-3">🚛</div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">A partir de 100 un</p>
                <div className="my-3">
                  <span className="text-4xl font-black text-accent-foreground">R$ 1,99</span>
                </div>
                <p className="text-xs text-muted-foreground">por unidade</p>
                <p className="text-xs text-accent-foreground font-semibold mt-1">Economize 60%</p>
                <Link to="/pedir" className="block mt-4">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-full border-accent/50 hover:bg-accent/10">
                    Pedir <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </FadeInSection>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            💡 Misture sabores à vontade! O desconto vale para o total de unidades do pedido.
          </p>
        </div>
      </section>

      {/* ─── BENEFÍCIOS ─── */}
      <section id="beneficios" className="py-20 md:py-28 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-7xl mx-auto px-6">
          <FadeInSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Por que escolher nossos gelos?</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Qualidade, sabor e praticidade em cada cubo de gelo saborizado.
            </p>
          </FadeInSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {beneficios.map((b) => (
              <FadeInSection key={b.titulo}>
                <div className="text-center p-8 rounded-2xl bg-card/60 backdrop-blur border border-border hover:border-primary/30 transition-colors h-full">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                    <b.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-3">{b.titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPROMISSO LOCAL ─── */}
      <section id="compromisso" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <FadeInSection className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold mb-4">
              <MapPin className="h-3.5 w-3.5" />
              Boa Vista, Roraima
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nosso Compromisso Local</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Com sede em Boa Vista, nossa fábrica gera empregos e apoia a economia de Roraima. 
              Distribuímos nossos gelos saborizados para toda Boa Vista e além, levando um toque de sabor em cada cubo de gelo.
            </p>
          </FadeInSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
            {compromissos.map((c) => (
              <FadeInSection key={c.titulo}>
                <div className="p-6 rounded-2xl bg-card border border-border shadow-sm text-center h-full">
                  <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4">
                    <c.icon className="h-7 w-7 text-secondary-foreground" />
                  </div>
                  <h3 className="font-bold mb-2">{c.titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DEPOIMENTOS ─── */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-7xl mx-auto px-6">
          <FadeInSection className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">O que nossos clientes dizem</h2>
            <p className="text-muted-foreground text-lg">A satisfação dos nossos clientes é nosso maior orgulho.</p>
          </FadeInSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {depoimentos.map((d) => (
              <FadeInSection key={d.nome}>
                <div className="p-6 rounded-2xl bg-card border border-border shadow-sm h-full flex flex-col">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: d.estrelas }).map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-accent text-accent" />
                    ))}
                  </div>
                  <p className="text-muted-foreground leading-relaxed mb-4 italic flex-1">"{d.texto}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
                      {d.nome.charAt(0)}
                    </div>
                    <span className="font-semibold text-sm">{d.nome}</span>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CONTATO / PEDIDO ─── */}
      <section id="contato" className="py-20 md:py-28 bg-gradient-to-b from-secondary/10 to-background">
        <div className="max-w-7xl mx-auto px-6">
          <FadeInSection className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Faça Seu Pedido</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Entre em contato para fazer seu pedido diretamente da fábrica! Compre nossos gelos saborizados fresquinhos!
            </p>
          </FadeInSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <FadeInSection>
              <form onSubmit={handleSubmitContato} className="space-y-5 bg-card p-8 rounded-2xl border border-border shadow-sm">
                <h3 className="text-xl font-bold mb-2">Formulário de Pedido</h3>
                <Input placeholder="Seu nome *" value={formNome} onChange={(e) => setFormNome(e.target.value)} className="h-12" maxLength={100} />
                <Input type="email" placeholder="Seu e-mail *" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="h-12" maxLength={255} />
                <Input type="tel" placeholder="Seu telefone" value={formTelefone} onChange={(e) => setFormTelefone(e.target.value)} className="h-12" maxLength={20} />
                <Textarea placeholder="Descreva seu pedido (sabores, quantidade, etc.) *" value={formMsg} onChange={(e) => setFormMsg(e.target.value)} className="min-h-[120px]" maxLength={1000} />
                <Button type="submit" size="lg" className="gap-2 w-full px-10" disabled={formLoading}>
                  {formLoading ? "Enviando..." : "Enviar Pedido"} <Send className="h-5 w-5" />
                </Button>
              </form>
            </FadeInSection>

            <FadeInSection>
              <div className="flex flex-col justify-between space-y-6 h-full">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Telefone / WhatsApp</h4>
                      <a href="https://wa.me/5595991725677" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">(95) 99172-5677</a>
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
                      <h4 className="font-semibold mb-1">Endereço da Fábrica</h4>
                      <p className="text-muted-foreground">A Era dos Sabores — Boa Vista, Roraima, Brasil</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border h-56 bg-muted">
                  <iframe
                    title="Localização - Boa Vista, Roraima"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d127133.2!2d-60.7!3d2.82!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8d931534f8770b5f%3A0x4c3e7741fb4ef76!2sBoa%20Vista%2C%20RR!5e0!3m2!1spt-BR!2sbr!4v1"
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-16 bg-primary text-primary-foreground relative overflow-hidden">
        <FadeInSection className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para experimentar?</h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
            Compre agora nossos gelos saborizados fresquinhos, direto da fábrica em Boa Vista!
          </p>
          <Link to="/pedir">
            <Button size="lg" variant="secondary" className="gap-2 text-base px-10 shadow-lg">
              Faça Seu Pedido Agora <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </FadeInSection>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logo} alt="A Era dos Sabores" className="h-10 w-10 rounded-lg" />
                <div>
                  <span className="font-bold text-lg block leading-tight">A Era dos Sabores</span>
                  <span className="text-xs text-muted-foreground">Boa Vista • Roraima</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Fábrica de gelos saborizados artesanais em Boa Vista, Roraima. Ingredientes frescos 
                e naturais para transformar suas bebidas.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Links Rápidos</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#sobre" className="hover:text-foreground transition-colors">Sobre Nós</a></li>
                <li><a href="#sabores" className="hover:text-foreground transition-colors">Nossos Sabores</a></li>
                <li><a href="#beneficios" className="hover:text-foreground transition-colors">Benefícios</a></li>
                <li><a href="#compromisso" className="hover:text-foreground transition-colors">Compromisso Local</a></li>
                <li><a href="#contato" className="hover:text-foreground transition-colors">Contato / Pedido</a></li>
                <li><Link to="/pedir" className="hover:text-foreground transition-colors font-semibold text-primary">Peça Online</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Redes Sociais</h4>
              <div className="flex gap-3">
                <a href="https://www.instagram.com/aeradossaboresrr" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <Instagram className="h-5 w-5 text-primary" />
                </a>
                <a href="https://www.instagram.com/aeradossaboresrr" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <Facebook className="h-5 w-5 text-primary" />
                </a>
              </div>
              <div className="mt-4 text-sm text-muted-foreground space-y-1">
                <p>📧 contato@aeradossabores.com.br</p>
                <p>📞 <a href="https://wa.me/5595991725677" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">(95) 99172-5677</a></p>
                <p>📍 Boa Vista, Roraima - Brasil</p>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} A Era dos Sabores — Fábrica de Gelos Saborizados — Boa Vista, Roraima. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* ─── BOTÃO FLUTUANTE WHATSAPP ─── */}
      <a
        href="https://wa.me/5595991725677?text=Olá! Gostaria de fazer um pedido de gelos saborizados 🧊"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110 animate-fade-in"
        aria-label="Fale conosco pelo WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>

      {/* ─── DIALOG INSTRUÇÕES INSTALAÇÃO ─── */}
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Como Baixar o App
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {isIOS ? (
              <>
                <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
                  <p className="text-sm font-semibold text-primary mb-1">📱 Você está no iPhone/iPad</p>
                  <p className="text-xs text-muted-foreground">
                    No iPhone, o app precisa ser instalado pelo <strong>Safari</strong>. Se você está no Chrome, abra este site no Safari primeiro.
                  </p>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-base">Passo a passo pelo Safari:</h3>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">1</div>
                    <div>
                      <p className="font-semibold text-sm">Abra no Safari</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Copie o link <strong>aeradossabores.online</strong> e cole no navegador <strong>Safari</strong> (aquele azulzinho com a bússola que já vem no iPhone).</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">2</div>
                    <div>
                      <p className="font-semibold text-sm">Toque no botão de Compartilhar</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Lá embaixo da tela, toque no ícone de <strong>compartilhar</strong> (um quadrado com uma seta pra cima ⬆️).</p>
                      <div className="mt-2 bg-muted rounded-lg p-3 flex items-center justify-center">
                        <Share className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">3</div>
                    <div>
                      <p className="font-semibold text-sm">Toque em "Adicionar à Tela Início"</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Role as opções que aparecem e procure <strong>"Adicionar à Tela de Início"</strong> (tem um ícone de ➕). Toque nele!</p>
                      <div className="mt-2 bg-muted rounded-lg p-3 flex items-center gap-3">
                        <Plus className="h-6 w-6 text-primary" />
                        <span className="text-sm font-medium">Adicionar à Tela de Início</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">4</div>
                    <div>
                      <p className="font-semibold text-sm">Toque em "Adicionar"</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Vai aparecer o nome do app. É só tocar em <strong>"Adicionar"</strong> no canto de cima. Pronto! 🎉</p>
                    </div>
                  </div>
                </div>
                <div className="bg-accent/50 rounded-xl p-4 border border-accent/30">
                  <p className="text-sm">✅ <strong>Pronto!</strong> O ícone do app vai aparecer na sua tela inicial, igualzinho um aplicativo de verdade!</p>
                </div>
              </>
            ) : isAndroid ? (
              <>
                <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
                  <p className="text-sm font-semibold text-primary mb-1">🤖 Você está no Android</p>
                  <p className="text-xs text-muted-foreground">Siga os passos abaixo para instalar pelo Chrome.</p>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-base">Passo a passo pelo Chrome:</h3>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">1</div>
                    <div>
                      <p className="font-semibold text-sm">Toque nos 3 pontinhos</p>
                      <p className="text-xs text-muted-foreground mt-0.5">No canto de cima do Chrome, toque nos <strong>três pontinhos</strong> (⋮).</p>
                      <div className="mt-2 bg-muted rounded-lg p-3 flex items-center justify-center">
                        <MoreVertical className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">2</div>
                    <div>
                      <p className="font-semibold text-sm">Toque em "Instalar aplicativo"</p>
                      <p className="text-xs text-muted-foreground mt-0.5">No menu que abriu, procure <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>. Toque nela!</p>
                      <div className="mt-2 bg-muted rounded-lg p-3 flex items-center gap-3">
                        <Download className="h-6 w-6 text-primary" />
                        <span className="text-sm font-medium">Instalar aplicativo</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">3</div>
                    <div>
                      <p className="font-semibold text-sm">Confirme a instalação</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Toque em <strong>"Instalar"</strong> na janelinha que aparecer. Pronto! 🎉</p>
                    </div>
                  </div>
                </div>
                <div className="bg-accent/50 rounded-xl p-4 border border-accent/30">
                  <p className="text-sm">✅ <strong>Pronto!</strong> O app vai aparecer na sua tela inicial como se fosse um aplicativo baixado da Play Store!</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
                  <p className="text-sm font-semibold text-primary mb-1">💻 Você está no computador</p>
                  <p className="text-xs text-muted-foreground">Instale pelo Chrome para ter acesso rápido.</p>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-base">Passo a passo:</h3>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">1</div>
                    <div>
                      <p className="font-semibold text-sm">Procure o ícone de instalar</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Na barra de endereço do Chrome, procure um ícone de <strong>computador com uma seta</strong> (⬇️) no lado direito. Clique nele!</p>
                      <div className="mt-2 bg-muted rounded-lg p-3 flex items-center justify-center">
                        <Monitor className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">2</div>
                    <div>
                      <p className="font-semibold text-sm">Clique em "Instalar"</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Confirme clicando em <strong>"Instalar"</strong>. O app vai abrir como uma janela separada! 🎉</p>
                    </div>
                  </div>
                </div>
                <div className="bg-accent/50 rounded-xl p-4 border border-accent/30">
                  <p className="text-sm">✅ <strong>Pronto!</strong> O app vai aparecer no seu computador como um aplicativo independente!</p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
