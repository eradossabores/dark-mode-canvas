import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Users, ShoppingCart, Factory,
  Warehouse, ClipboardList, UserCog, ChevronLeft, ChevronRight, BarChart3, FileUp, Menu, X, DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const menuItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/producao", label: "Produção", icon: Factory },
  { path: "/vendas", label: "Vendas", icon: ShoppingCart },
  { path: "/a-receber", label: "A Receber", icon: DollarSign },
  { path: "/estoque", label: "Estoque", icon: Warehouse },
  { path: "/clientes", label: "Clientes", icon: Users },
  { path: "/funcionarios", label: "Funcionários", icon: UserCog },
  { path: "/sabores", label: "Sabores", icon: Package },
  { path: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { path: "/importar-planilha", label: "Upload Planilha", icon: FileUp },
  { path: "/auditoria", label: "Auditoria", icon: ClipboardList },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2 px-3 py-3 border-b border-sidebar-border">
        <img src={logo} alt="A Era dos Sabores" className="h-9 w-9 shrink-0 rounded" />
        {!collapsed && (
          <span className="font-bold text-sm whitespace-nowrap">A Era dos Sabores</span>
        )}
      </div>
      <nav className="flex-1 py-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors rounded-md mx-2",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-md"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-card shadow-md border border-border"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 flex flex-col bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border z-50">
            <div className="flex justify-end p-2">
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5 text-sidebar-foreground" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar-background text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-2 py-3 border-t border-sidebar-border hover:bg-sidebar-accent transition-colors",
            collapsed ? "justify-center px-2" : "px-4"
          )}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span className="text-xs text-sidebar-foreground/70">Recolher menu</span>
            </>
          )}
        </button>
      </aside>

      <main className="flex-1 overflow-auto relative bg-background">
        {/* Ice Age themed background - positioned behind content */}
        <div className="sticky top-0 left-0 w-full h-0 pointer-events-none" style={{ zIndex: 0 }}>
          <div className="absolute top-0 left-0 w-full h-screen overflow-hidden">
            {/* Aurora gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-sky-100/50 via-sky-50/20 to-cyan-100/30 dark:from-sky-950/30 dark:via-transparent dark:to-cyan-950/20" />
            
            {/* Icebergs / mountains at the bottom */}
            <svg className="absolute bottom-0 left-0 w-full h-56 opacity-[0.10] dark:opacity-[0.06]" viewBox="0 0 1200 200" preserveAspectRatio="none" fill="currentColor" style={{ color: 'hsl(200, 70%, 55%)' }}>
              <polygon points="0,200 0,140 80,90 150,120 200,60 280,100 350,40 420,80 500,30 580,70 650,50 720,90 800,20 880,60 950,80 1020,40 1100,70 1150,50 1200,100 1200,200" />
              <polygon points="0,200 0,160 60,130 120,150 200,110 300,140 380,100 460,130 540,90 620,120 700,80 780,110 860,70 940,100 1020,90 1100,120 1200,140 1200,200" opacity="0.6" />
            </svg>

            {/* Snowflakes */}
            <svg className="absolute top-12 right-[8%] w-14 h-14 text-sky-400/20 dark:text-sky-400/10 animate-pulse" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
              <path d="M25 2 L25 48 M5 14 L45 36 M5 36 L45 14" />
              <path d="M25 2 L20 8 M25 2 L30 8 M25 48 L20 42 M25 48 L30 42" />
              <path d="M5 14 L12 14 M5 14 L8 20 M45 36 L38 36 M45 36 L42 30" />
              <path d="M5 36 L12 36 M5 36 L8 30 M45 14 L38 14 M45 14 L42 20" />
            </svg>

            <svg className="absolute top-[28%] left-[6%] w-10 h-10 text-cyan-400/15 dark:text-cyan-500/8" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animation: 'pulse 4s ease-in-out infinite 1s' }}>
              <path d="M25 5 L25 45 M10 15 L40 35 M10 35 L40 15" />
              <path d="M25 5 L21 12 M25 5 L29 12 M25 45 L21 38 M25 45 L29 38" />
            </svg>

            <svg className="absolute top-[50%] right-[20%] w-8 h-8 text-sky-300/18 dark:text-sky-400/8" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animation: 'pulse 5s ease-in-out infinite 2.5s' }}>
              <path d="M25 5 L25 45 M10 15 L40 35 M10 35 L40 15" />
            </svg>

            <svg className="absolute top-[18%] left-[42%] w-7 h-7 text-cyan-300/15 dark:text-cyan-400/8" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animation: 'pulse 3.5s ease-in-out infinite 0.5s' }}>
              <path d="M25 5 L25 45 M10 15 L40 35 M10 35 L40 15" />
            </svg>

            <svg className="absolute top-[70%] right-[45%] w-6 h-6 text-sky-400/12 dark:text-sky-400/6" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animation: 'pulse 6s ease-in-out infinite 3s' }}>
              <path d="M25 5 L25 45 M10 15 L40 35 M10 35 L40 15" />
            </svg>

            {/* Ice particles */}
            <div className="absolute top-[15%] left-[18%] w-2.5 h-2.5 rounded-full bg-sky-400/15 dark:bg-sky-400/8" />
            <div className="absolute top-[35%] right-[12%] w-2 h-2 rounded-full bg-cyan-400/20 dark:bg-cyan-400/8" />
            <div className="absolute top-[60%] left-[30%] w-3 h-3 rounded-full bg-sky-300/12 dark:bg-sky-400/6" />
            <div className="absolute top-[8%] right-[35%] w-1.5 h-1.5 rounded-full bg-cyan-300/25 dark:bg-cyan-400/10" />
            <div className="absolute top-[78%] left-[55%] w-2 h-2 rounded-full bg-sky-400/12 dark:bg-sky-400/6" />
            <div className="absolute top-[45%] left-[75%] w-3 h-3 rounded-full bg-cyan-300/15 dark:bg-cyan-400/8" />
            <div className="absolute top-[25%] left-[60%] w-2 h-2 rounded-full bg-sky-300/20 dark:bg-sky-400/8" />
            <div className="absolute top-[85%] right-[60%] w-1.5 h-1.5 rounded-full bg-cyan-400/15 dark:bg-cyan-400/6" />

            {/* === ICE AGE CHARACTERS === */}

            {/* Mammoth - bottom right */}
            <svg className="absolute bottom-[8%] right-[5%] w-44 h-36 opacity-[0.07] dark:opacity-[0.04]" viewBox="0 0 200 160" fill="currentColor" style={{ color: 'hsl(25, 30%, 40%)' }}>
              {/* Body */}
              <ellipse cx="110" cy="95" rx="55" ry="45" />
              {/* Head */}
              <circle cx="55" cy="70" r="30" />
              {/* Trunk */}
              <path d="M30,85 Q20,110 25,140 Q28,145 32,140 Q35,115 40,95" fill="currentColor" />
              {/* Tusks */}
              <path d="M45,90 Q30,105 35,120 Q38,118 42,105 Q48,95 45,90" fill="hsl(45, 30%, 80%)" opacity="0.6" />
              {/* Legs */}
              <rect x="80" y="125" width="14" height="30" rx="5" />
              <rect x="100" y="128" width="14" height="28" rx="5" />
              <rect x="120" y="126" width="14" height="30" rx="5" />
              <rect x="140" y="128" width="14" height="28" rx="5" />
              {/* Fur bumps */}
              <ellipse cx="90" cy="60" rx="20" ry="10" />
              <ellipse cx="120" cy="55" rx="18" ry="8" />
              <ellipse cx="75" cy="55" rx="12" ry="7" />
              {/* Tail */}
              <path d="M160,80 Q175,70 170,60 Q168,58 165,62 Q168,72 155,82" />
              {/* Eye */}
              <circle cx="45" cy="62" r="3" fill="hsl(25, 30%, 20%)" opacity="0.5" />
              {/* Ear */}
              <ellipse cx="65" cy="50" rx="8" ry="12" opacity="0.7" />
            </svg>

            {/* Squirrel with acorn (Scrat-like) - top left area */}
            <svg className="absolute top-[12%] left-[3%] w-28 h-32 opacity-[0.07] dark:opacity-[0.04]" viewBox="0 0 120 140" fill="currentColor" style={{ color: 'hsl(30, 40%, 45%)' }}>
              {/* Body */}
              <ellipse cx="60" cy="90" rx="22" ry="30" />
              {/* Head */}
              <ellipse cx="60" cy="48" rx="16" ry="20" />
              {/* Snout - long pointed */}
              <path d="M60,35 Q55,15 52,5 Q50,2 54,4 Q58,8 62,5 Q64,2 62,4 Q58,15 60,35" />
              {/* Eyes */}
              <circle cx="52" cy="42" r="4" fill="white" opacity="0.4" />
              <circle cx="52" cy="42" r="2" fill="hsl(30, 40%, 20%)" opacity="0.5" />
              {/* Big fluffy tail */}
              <path d="M75,85 Q100,60 95,35 Q93,25 88,30 Q85,40 90,55 Q92,65 80,80" />
              <path d="M78,82 Q105,55 100,30 Q98,22 93,28 Q90,38 95,50 Q97,60 83,78" opacity="0.7" />
              {/* Arms holding acorn */}
              <path d="M45,75 Q35,70 30,65 Q28,63 32,62 Q38,65 48,72" />
              <path d="M75,75 Q82,68 85,62 Q87,60 84,60 Q78,63 72,72" />
              {/* Acorn */}
              <ellipse cx="57" cy="62" rx="8" ry="6" fill="hsl(30, 50%, 35%)" opacity="0.6" />
              <path d="M50,58 Q57,52 64,58" fill="hsl(30, 30%, 50%)" opacity="0.5" />
              {/* Feet */}
              <ellipse cx="48" cy="118" rx="10" ry="5" />
              <ellipse cx="72" cy="118" rx="10" ry="5" />
            </svg>

            {/* Sloth silhouette - hanging from top center-right */}
            <svg className="absolute top-[2%] right-[30%] w-24 h-36 opacity-[0.06] dark:opacity-[0.03]" viewBox="0 0 100 150" fill="currentColor" style={{ color: 'hsl(40, 25%, 50%)' }}>
              {/* Branch */}
              <rect x="0" y="0" width="100" height="6" rx="3" fill="hsl(25, 30%, 35%)" opacity="0.5" />
              {/* Arms reaching up */}
              <path d="M35,6 Q33,15 38,30" strokeWidth="6" stroke="currentColor" fill="none" />
              <path d="M65,6 Q67,15 62,30" strokeWidth="6" stroke="currentColor" fill="none" />
              {/* Body */}
              <ellipse cx="50" cy="55" rx="20" ry="28" />
              {/* Head */}
              <circle cx="50" cy="90" r="16" />
              {/* Eyes */}
              <circle cx="44" cy="87" r="4" fill="white" opacity="0.3" />
              <circle cx="56" cy="87" r="4" fill="white" opacity="0.3" />
              <circle cx="44" cy="88" r="2" fill="hsl(40, 25%, 25%)" opacity="0.4" />
              <circle cx="56" cy="88" r="2" fill="hsl(40, 25%, 25%)" opacity="0.4" />
              {/* Smile */}
              <path d="M43,96 Q50,102 57,96" fill="none" stroke="hsl(40, 25%, 30%)" strokeWidth="1.5" opacity="0.4" />
              {/* Legs dangling */}
              <path d="M38,78 Q32,100 28,120 Q26,128 30,125 Q34,115 40,95" />
              <path d="M62,78 Q68,100 72,120 Q74,128 70,125 Q66,115 60,95" />
              {/* Claws on arms */}
              <path d="M33,4 L30,0 M35,5 L33,0 M37,5 L36,0" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M63,4 L64,0 M65,5 L67,0 M67,5 L70,0" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>

            {/* Saber-tooth tiger - bottom left */}
            <svg className="absolute bottom-[12%] left-[8%] w-36 h-28 opacity-[0.06] dark:opacity-[0.04]" viewBox="0 0 180 120" fill="currentColor" style={{ color: 'hsl(35, 45%, 45%)' }}>
              {/* Body */}
              <ellipse cx="100" cy="55" rx="50" ry="30" />
              {/* Head */}
              <circle cx="40" cy="40" r="22" />
              {/* Ears */}
              <polygon points="28,22 22,8 35,18" />
              <polygon points="48,20 52,6 42,16" />
              {/* Eyes */}
              <circle cx="32" cy="35" r="3" fill="hsl(50, 70%, 60%)" opacity="0.5" />
              {/* Saber teeth! */}
              <path d="M30,55 Q28,75 30,85 Q32,87 33,85 Q34,75 33,58" fill="hsl(0, 0%, 90%)" opacity="0.5" />
              <path d="M40,56 Q39,73 40,82 Q42,84 43,82 Q43,73 42,58" fill="hsl(0, 0%, 90%)" opacity="0.5" />
              {/* Legs */}
              <rect x="70" y="75" width="12" height="25" rx="4" />
              <rect x="90" y="78" width="12" height="22" rx="4" />
              <rect x="110" y="76" width="12" height="24" rx="4" />
              <rect x="130" y="78" width="12" height="22" rx="4" />
              {/* Tail */}
              <path d="M148,50 Q165,35 175,45 Q178,50 172,48 Q165,42 152,52" />
              {/* Stripes */}
              <ellipse cx="85" cy="45" rx="8" ry="3" opacity="0.3" transform="rotate(-15 85 45)" />
              <ellipse cx="100" cy="42" rx="8" ry="3" opacity="0.3" transform="rotate(-10 100 42)" />
              <ellipse cx="115" cy="44" rx="8" ry="3" opacity="0.3" transform="rotate(-5 115 44)" />
            </svg>

            {/* Small bird (Dodo-like) - mid right */}
            <svg className="absolute top-[40%] right-[3%] w-16 h-18 opacity-[0.05] dark:opacity-[0.03]" viewBox="0 0 70 80" fill="currentColor" style={{ color: 'hsl(200, 30%, 50%)' }}>
              {/* Body */}
              <ellipse cx="35" cy="50" rx="20" ry="22" />
              {/* Head */}
              <circle cx="35" cy="22" r="14" />
              {/* Beak */}
              <path d="M48,22 L65,20 L48,26 Z" fill="hsl(40, 60%, 55%)" opacity="0.5" />
              {/* Eye */}
              <circle cx="40" cy="19" r="3" fill="white" opacity="0.4" />
              {/* Legs */}
              <path d="M28,70 L25,80 M25,80 L20,78 M25,80 L28,78" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M42,70 L45,80 M45,80 L40,78 M45,80 L48,78" stroke="currentColor" strokeWidth="2" fill="none" />
              {/* Wing */}
              <path d="M18,45 Q5,40 10,55 Q15,60 20,55" opacity="0.6" />
            </svg>
          </div>
        </div>

        <div className="relative p-4 md:p-6 pt-14 md:pt-6" style={{ zIndex: 1 }}>{children}</div>
      </main>
    </div>
  );
}
