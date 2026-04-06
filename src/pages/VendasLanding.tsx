import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, ShieldCheck, Zap, Users, Smartphone, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import icetechLogo from "@/assets/icetech-logo.png";

const features = [
  { icon: Zap, title: "Vendas Rápidas", desc: "Registre vendas em segundos com cálculo automático de preços, descontos e brindes." },
  { icon: BarChart3, title: "Relatórios Inteligentes", desc: "Dashboards em tempo real com métricas de faturamento, estoque e produtividade." },
  { icon: Users, title: "Gestão de Clientes", desc: "Cadastro completo, tabelas de preço personalizadas e histórico de compras." },
  { icon: ShieldCheck, title: "Controle Total", desc: "Auditoria, permissões por usuário e rastreamento de cada movimentação." },
  { icon: Smartphone, title: "Acesso Mobile", desc: "Use de qualquer dispositivo. Interface responsiva e instalável como app." },
];

const stats = [
  { value: "10x", label: "Mais rápido" },
  { value: "100%", label: "Controle" },
  { value: "24/7", label: "Disponível" },
  { value: "0", label: "Papel" },
];

export default function VendasLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-x-hidden">
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            <img src={icetechLogo} alt="ICETECH" className="h-10 w-10 object-contain" />
            <span className="text-lg font-bold tracking-wide">ICETECH</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button size="sm" variant="outline" className="gap-1.5 border-white/20 text-white hover:bg-white/10">
                <LogIn className="h-4 w-4" /> Entrar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative py-24 md:py-36">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/15 text-blue-300 text-sm font-semibold mb-6 border border-blue-500/20">
            <Zap className="h-4 w-4" /> Sistema de Gestão para Fábricas
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-4xl mx-auto">
            Gerencie suas vendas com{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              inteligência e velocidade
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-blue-200/70 max-w-2xl mx-auto">
            Plataforma completa para fábricas de gelos saborizados. Controle vendas, estoque, produção e clientes em um só lugar.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button size="lg" className="gap-2 text-base px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 w-full sm:w-auto">
                Começar Agora <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <a href="#funcionalidades">
              <Button size="lg" variant="outline" className="gap-2 text-base px-8 border-white/20 text-white hover:bg-white/10 w-full sm:w-auto">
                Ver Funcionalidades
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="py-16 border-y border-white/10 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="mt-2 text-sm text-blue-200/60 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FUNCIONALIDADES ─── */}
      <section id="funcionalidades" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              Tudo que você precisa para{" "}
              <span className="text-blue-400">vender mais</span>
            </h2>
            <p className="mt-4 text-blue-200/60 max-w-xl mx-auto">
              Funcionalidades pensadas para o dia a dia da sua fábrica.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/15 flex items-center justify-center mb-4">
                    <f.icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-blue-200/60 leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMO FUNCIONA ─── */}
      <section className="py-20 md:py-28 bg-white/[0.02] border-y border-white/10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              Simples de <span className="text-blue-400">começar</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Crie sua conta", desc: "Cadastre sua fábrica e configure seus sabores e preços." },
              { step: "2", title: "Registre vendas", desc: "Use o sistema para registrar vendas, controlar estoque e gerar relatórios." },
              { step: "3", title: "Cresça mais", desc: "Acompanhe métricas, otimize a produção e escale o seu negócio." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-blue-200/60">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Pronto para transformar sua gestão?
          </h2>
          <p className="text-lg text-blue-200/60 mb-10">
            Comece agora e tenha controle total da sua fábrica na palma da mão.
          </p>
          <Link to="/login">
            <Button size="lg" className="gap-2 text-base px-10 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30">
              Acessar o Sistema <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={icetechLogo} alt="ICETECH" className="h-8 w-8 object-contain" />
            <span className="font-semibold text-sm">ICETECH</span>
          </div>
          <p className="text-xs text-blue-300/40">
            © {new Date().getFullYear()} ICETECH — Sistema de gestão para fábricas de gelos saborizados
          </p>
        </div>
      </footer>
    </div>
  );
}
