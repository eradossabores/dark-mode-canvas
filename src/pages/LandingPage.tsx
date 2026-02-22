import { Link } from "react-router-dom";
import { IceCream, Truck, Users, Award, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import sidImg from "@/assets/sid.png";
import scratStandingImg from "@/assets/scrat-standing.png";
import buckImg from "@/assets/buck.png";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 relative overflow-hidden">
      {/* Background characters */}
      <img src={sidImg} alt="" aria-hidden className="absolute bottom-8 left-8 w-40 h-40 object-contain opacity-[0.15] pointer-events-none select-none hidden lg:block" />
      <img src={scratStandingImg} alt="" aria-hidden className="absolute top-32 right-8 w-36 h-36 object-contain opacity-[0.15] pointer-events-none select-none hidden lg:block" />
      <img src={buckImg} alt="" aria-hidden className="absolute bottom-24 right-16 w-32 h-32 object-contain opacity-[0.12] pointer-events-none select-none hidden lg:block" />

      {/* Snowflake decoration */}
      <svg className="absolute top-20 left-[15%] w-12 h-12 text-primary/10 animate-pulse" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M25 2 L25 48 M5 14 L45 36 M5 36 L45 14" />
      </svg>
      <svg className="absolute top-[60%] right-[10%] w-8 h-8 text-primary/10 animate-pulse" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animationDelay: "2s" }}>
        <path d="M25 5 L25 45 M10 15 L40 35 M10 35 L40 15" />
      </svg>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="A Era dos Sabores" className="h-12 w-12 rounded-lg shadow-md" />
          <span className="text-xl font-bold text-foreground">A Era dos Sabores</span>
        </div>
        <Link to="/painel">
          <Button variant="outline" className="gap-2">
            Painel de Controle <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <IceCream className="h-4 w-4" />
          Geladinho Gourmet Artesanal
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-foreground max-w-3xl leading-tight">
          Sabores que conquistam, <br />
          <span className="text-primary">qualidade que encanta</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl">
          Produzimos geladinhos gourmet artesanais com ingredientes selecionados, levando frescor e sabor até você.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link to="/painel">
            <Button size="lg" className="gap-2 text-base px-8">
              Acessar Painel <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 md:px-12 pb-24">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: IceCream,
              title: "Variedade de Sabores",
              description: "Dezenas de sabores artesanais preparados com ingredientes frescos e selecionados.",
            },
            {
              icon: Truck,
              title: "Distribuição Própria",
              description: "Entregamos com freezers próprios para manter a qualidade do produto até você.",
            },
            {
              icon: Award,
              title: "Qualidade Premium",
              description: "Processo de produção controlado, garantindo o melhor sabor em cada geladinho.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center text-center p-8 rounded-2xl bg-card/80 backdrop-blur border border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} A Era dos Sabores — Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
