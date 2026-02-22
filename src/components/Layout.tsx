import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Users, ShoppingCart, Factory,
  Warehouse, ClipboardList, UserCog, ChevronLeft, ChevronRight, BarChart3, FileUp, Menu, X, DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import sidImg from "@/assets/sid.png";
import buckImg from "@/assets/buck.png";
import scrat3dImg from "@/assets/scrat-3d.png";
import scratAcornImg from "@/assets/scrat-acorn.png";
import scratStandingImg from "@/assets/scrat-standing.png";
import scratHangingImg from "@/assets/scrat-hanging.png";

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

            {/* === ICE AGE CHARACTERS (real images) === */}
            
            {/* Sid - bottom right corner */}
            <img src={sidImg} alt="" aria-hidden className="absolute bottom-[2%] right-[3%] w-44 h-44 object-contain opacity-[0.18] dark:opacity-[0.10] pointer-events-none select-none" />
            
            {/* Buck - top left corner */}
            <img src={buckImg} alt="" aria-hidden className="absolute top-[3%] left-[3%] w-36 h-36 object-contain opacity-[0.18] dark:opacity-[0.10] pointer-events-none select-none" />
            
            {/* Scrat 3D (glasses) - top right corner */}
            <img src={scrat3dImg} alt="" aria-hidden className="absolute top-[2%] right-[4%] w-32 h-32 object-contain opacity-[0.16] dark:opacity-[0.09] pointer-events-none select-none" />
            
            {/* Scrat with acorn - bottom left corner */}
            <img src={scratAcornImg} alt="" aria-hidden className="absolute bottom-[2%] left-[4%] w-36 h-36 object-contain opacity-[0.17] dark:opacity-[0.09] pointer-events-none select-none" />
            
            {/* Scrat standing - far right, vertically centered */}
            <img src={scratStandingImg} alt="" aria-hidden className="absolute top-[50%] right-[2%] w-40 h-32 object-contain opacity-[0.14] dark:opacity-[0.08] pointer-events-none select-none -translate-y-1/2" />
            
            {/* Scrat hanging - far left, vertically centered */}
            <img src={scratHangingImg} alt="" aria-hidden className="absolute top-[55%] left-[2%] w-28 h-40 object-contain opacity-[0.15] dark:opacity-[0.08] pointer-events-none select-none" />
          </div>
        </div>

        <div className="relative p-4 md:p-6 pt-14 md:pt-6" style={{ zIndex: 1 }}>{children}</div>
      </main>
    </div>
  );
}
