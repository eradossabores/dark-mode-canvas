import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, Users, ShoppingCart, Factory,
  Warehouse, ClipboardList, UserCog, BarChart3, FileUp, DollarSign, Monitor, ShoppingBag, Database, LogOut, Shield, Brain, MapPin, Map, Target, HardDrive, UserCheck, Crown, MessageCircle, Settings, CalendarDays, ChevronRight, ClipboardCheck
} from "lucide-react";
import PaymentBanner from "@/components/PaymentBanner";
import { AnimatedMenuToggle } from "@/components/ui/animated-menu-toggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isRouteAllowed } from "@/components/ProtectedRoute";
import logo from "@/assets/logo.png";
import useKeyboardShortcuts from "@/hooks/useKeyboardShortcuts";
import DottedSurface from "@/components/ui/dotted-surface";
import sidImg from "@/assets/sid.png";
import buckImg from "@/assets/buck.png";
import scrat3dImg from "@/assets/scrat-3d.png";
import scratAcornImg from "@/assets/scrat-acorn.png";
import scratStandingImg from "@/assets/scrat-standing.png";
import scratHangingImg from "@/assets/scrat-hanging.png";

const menuGroups = [
  {
    label: "Principal",
    items: [
      { path: "/painel", label: "Página Principal", icon: LayoutDashboard },
    ],
  },
  {
    label: "Produção",
    items: [
      { path: "/painel/plano-producao", label: "Plano de Produção", icon: ClipboardCheck, children: [
        { path: "/painel/plano-producao", label: "Plano Diário", icon: Factory },
        { path: "/painel/plano-semanal", label: "Plano Semanal", icon: CalendarDays },
      ]},
      { path: "/painel/producao", label: "Produção", icon: Factory },
      { path: "/painel/monitor-producao", label: "Monitor Produção", icon: Monitor },
      { path: "/painel/presenca", label: "Presença", icon: UserCheck },
      { path: "/painel/previsao-demanda", label: "Previsão Demanda", icon: Brain },
    ],
  },
  {
    label: "Comercial",
    items: [
      { path: "/painel/vendas", label: "Vendas", icon: ShoppingCart },
      { path: "/painel/a-receber", label: "A Receber", icon: DollarSign },
      { path: "/painel/contas-a-pagar", label: "Contas a Pagar", icon: ClipboardList },
      { path: "/painel/compras", label: "Compras", icon: ShoppingBag },
      { path: "/painel/prospeccao", label: "Prospecção", icon: Target },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { path: "/painel/clientes", label: "Clientes", icon: Users },
      { path: "/painel/funcionarios", label: "Colaboradores", icon: UserCog },
      { path: "/painel/sabores", label: "Sabores", icon: Package },
      { path: "/painel/estoque", label: "Estoque", icon: Warehouse },
    ],
  },
  {
    label: "Mapas",
    items: [
      { path: "/painel/mapa-entregas", label: "Mapa Entregas", icon: MapPin },
      { path: "/painel/pedidos-producao", label: "Histórico Pedidos p/ Entregas", icon: ShoppingBag },
      { path: "/painel/mapa-clientes", label: "Mapa Clientes", icon: Map },
    ],
  },
  {
    label: "Sistema",
    items: [
      { path: "/painel/configurar", label: "Configurar Fábrica", icon: Settings },
      { path: "/painel/relatorios", label: "Relatórios", icon: BarChart3 },
      { path: "/painel/importar-planilha", label: "Upload Planilha", icon: FileUp },
      { path: "/painel/auditoria", label: "Auditoria", icon: ClipboardList },
      { path: "/painel/diagnostico", label: "Diagnóstico", icon: Database },
      { path: "/painel/usuarios", label: "Usuários", icon: Shield },
      { path: "/painel/backup", label: "Backup", icon: HardDrive },
      { path: "/painel/suporte", label: "Suporte", icon: MessageCircle },
    ],
  },
];

const menuItems = menuGroups.flatMap((g) => g.items.flatMap((item: any) => item.children ? item.children : [item]));

const allCharacters = [
  { src: sidImg, alt: "Sid" },
  { src: buckImg, alt: "Buck" },
  { src: scrat3dImg, alt: "Scrat 3D" },
  { src: scratAcornImg, alt: "Scrat Acorn" },
  { src: scratStandingImg, alt: "Scrat Standing" },
  { src: scratHangingImg, alt: "Scrat Hanging" },
];

const positionSets = [
  // Set 0: corners + sides variant A
  [
    { pos: "bottom-[2%] right-[3%]", size: "w-44 h-44" },
    { pos: "top-[3%] left-[3%]", size: "w-36 h-36" },
    { pos: "top-[50%] right-[2%] -translate-y-1/2", size: "w-36 h-28" },
  ],
  // Set 1: opposite corners + center
  [
    { pos: "top-[2%] right-[4%]", size: "w-36 h-36" },
    { pos: "bottom-[3%] left-[4%]", size: "w-40 h-40" },
    { pos: "top-[45%] left-[2%]", size: "w-28 h-40" },
  ],
  // Set 2: scattered
  [
    { pos: "bottom-[4%] left-[5%]", size: "w-36 h-36" },
    { pos: "top-[5%] right-[3%]", size: "w-32 h-32" },
    { pos: "top-[55%] right-[3%]", size: "w-32 h-36" },
  ],
  // Set 3: top-heavy
  [
    { pos: "top-[2%] left-[5%]", size: "w-38 h-38" },
    { pos: "top-[3%] right-[5%]", size: "w-34 h-34" },
    { pos: "bottom-[3%] right-[4%]", size: "w-40 h-40" },
  ],
];

const routeToIndex: Record<string, number> = {
  "/painel": 0, "/painel/producao": 1, "/painel/pedidos-producao": 2, "/painel/monitor-producao": 3,
  "/painel/vendas": 4, "/painel/a-receber": 5, "/painel/contas-a-pagar": 6,
  "/painel/estoque": 7, "/painel/clientes": 8, "/painel/funcionarios": 9,
  "/painel/sabores": 10, "/painel/relatorios": 11, "/painel/importar-planilha": 12, "/painel/auditoria": 13,
  "/painel/diagnostico": 14, "/painel/previsao-demanda": 15, "/painel/mapa-entregas": 16,
};

function getPageCharacters(pathname: string) {
  const idx = routeToIndex[pathname] ?? 0;
  const posSet = positionSets[idx % positionSets.length];
  // Pick 3 characters, offset by page index so each page has different ones
  return posSet.map((p, i) => ({
    ...p,
    character: allCharacters[(idx * 2 + i) % allCharacters.length],
  }));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState(false);
  const isExpanded = !collapsed || hovered;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const navigate = useNavigate();
  const { role, signOut, user, factoryId, factoryName, branding, impersonatingFactory, clearImpersonation } = useAuth();
  useKeyboardShortcuts();

  // Auto-open parent menus when a child route is active
  useEffect(() => {
    const newOpen: Record<string, boolean> = {};
    for (const group of menuGroups) {
      for (const item of group.items) {
        if ((item as any).children) {
          const childActive = (item as any).children.some((c: any) => location.pathname === c.path);
          if (childActive) newOpen[item.label] = true;
        }
      }
    }
    setOpenMenus((prev) => ({ ...prev, ...newOpen }));
  }, [location.pathname]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Only show Ice Age theme for the original factory
  const ERA_DOS_SABORES_ID = "00000000-0000-0000-0000-000000000001";
  const isIceAgeFactory = factoryId === ERA_DOS_SABORES_ID;

  // Apply factory theme as CSS variables
  useEffect(() => {
    if (branding?.theme) {
      const root = document.documentElement;
      if (branding.theme.primary) {
        root.style.setProperty('--primary', branding.theme.primary);
        root.style.setProperty('--ring', branding.theme.primary);
        root.style.setProperty('--sidebar-primary', branding.theme.primary);
      }
      if (branding.theme.secondary) {
        root.style.setProperty('--secondary', branding.theme.secondary);
      }
      if (branding.theme.accent) {
        root.style.setProperty('--accent', branding.theme.accent);
      }
      return () => {
        // Reset to defaults on unmount / change
        root.style.removeProperty('--primary');
        root.style.removeProperty('--ring');
        root.style.removeProperty('--sidebar-primary');
        root.style.removeProperty('--secondary');
        root.style.removeProperty('--accent');
      };
    }
  }, [branding?.theme]);

  const factoryLogo = branding?.logoUrl || logo;

  const filteredGroups = menuGroups
    .map((g) => ({ ...g, items: g.items.filter((item) => isRouteAllowed(item.path, role)) }))
    .filter((g) => g.items.length > 0);
  const filteredMenu = menuItems.filter((item) => isRouteAllowed(item.path, role));

  const [sidebarCharIdx, setSidebarCharIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSidebarCharIdx((prev) => (prev + 1) % allCharacters.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const sidebarChar = allCharacters[sidebarCharIdx];

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-3 py-3 border-b border-sidebar-border">
        <img src={factoryLogo} alt={factoryName || "Logo"} className="h-12 w-12 shrink-0 rounded-lg shadow-sm object-contain" />
        {isExpanded && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm whitespace-nowrap leading-tight">{factoryName || "ICETECH"}</span>
            <span className="text-[10px] text-sidebar-foreground/60 leading-tight">Gelos Saborizados</span>
          </div>
        )}
      </div>
      <nav className="flex-1 py-2 space-y-1 overflow-y-auto">
        {filteredGroups.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <div className="mx-4 my-1.5 border-t border-sidebar-border" />}
            {isExpanded && (
              <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {group.label}
              </p>
            )}
            {group.items.map((item: any) => {
              // Has sub-items (expandable)
              if (item.children) {
                const childActive = item.children.some((c: any) => location.pathname === c.path);
                return (
                  <div key={item.label}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-md mx-2 cursor-default",
                        childActive
                          ? "text-sidebar-foreground font-semibold"
                          : "text-sidebar-foreground/70"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {isExpanded && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          <ChevronRight className={cn("h-3 w-3 transition-transform", childActive && "rotate-90")} />
                        </>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="ml-4 border-l border-sidebar-border/40 pl-1 space-y-0.5">
                        {item.children.map((child: any) => {
                          const active = location.pathname === child.path;
                          return (
                            <Link
                              key={child.path}
                              to={child.path}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors rounded-md mx-1",
                                active
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              )}
                            >
                              <child.icon className="h-3.5 w-3.5 shrink-0" />
                              <span>{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-md mx-2",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-md"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {isExpanded && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {/* Super Admin link */}
      {role === "super_admin" && (
        <Link
          to="/super-admin"
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-md mx-2 mb-1",
            location.pathname === "/super-admin"
              ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-md"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Crown className="h-4 w-4 shrink-0" />
          {isExpanded && <span>Super Admin</span>}
        </Link>
      )}
      {/* Factory name indicator */}
      {factoryName && role !== "super_admin" && isExpanded && (
        <div className="mx-3 mb-1 px-2 py-1.5 rounded-md bg-sidebar-accent/30 text-[11px] text-sidebar-foreground/70 text-center truncate">
          🏭 {factoryName}
        </div>
      )}
      {/* Logout button */}
      <button
        onClick={handleLogout}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors mx-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          !isExpanded ? "justify-center" : ""
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {isExpanded && <span>Sair</span>}
      </button>
      {isIceAgeFactory && (
        <div className="flex justify-center py-2 border-t border-sidebar-border">
          <img
            key={sidebarCharIdx}
            src={sidebarChar.src}
            alt=""
            aria-hidden
            className={cn(
              "object-contain pointer-events-none select-none animate-fade-in transition-opacity duration-500",
              !isExpanded ? "w-10 h-10" : "w-24 h-24"
            )}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-3 left-3 z-50 p-1 rounded-md bg-card shadow-md border border-border flex items-center gap-1">
        <img src={factoryLogo} alt="" className="h-7 w-7 rounded" />
        <AnimatedMenuToggle
          isOpen={mobileOpen}
          toggle={() => setMobileOpen(!mobileOpen)}
          size={20}
          strokeColor="hsl(var(--foreground))"
        />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute left-0 top-0 h-full w-64 flex flex-col border-r border-white/10 z-[61] opacity-100"
            style={{
              backgroundColor: 'hsl(230, 50%, 22%)',
              color: 'white',
              ['--sidebar-foreground' as any]: '0 0% 100%',
              ['--sidebar-border' as any]: '0 0% 100% / 0.12',
              ['--sidebar-accent' as any]: '0 0% 100% / 0.12',
              ['--sidebar-accent-foreground' as any]: '0 0% 100%',
              ['--sidebar-primary-foreground' as any]: '0 0% 100%',
            }}
          >
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <img src={factoryLogo} alt={factoryName || "Logo"} className="h-10 w-10 rounded-lg shadow-sm object-contain" />
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-white leading-tight">{factoryName || "ICETECH"}</span>
                  <span className="text-[10px] text-white/60 leading-tight">Gelos Saborizados</span>
                </div>
              </div>
              <AnimatedMenuToggle
                isOpen={true}
                toggle={() => setMobileOpen(false)}
                size={20}
                strokeColor="white"
              />
            </div>
            <nav className="flex-1 py-2 space-y-1 overflow-y-auto">
              {filteredGroups.map((group, gi) => (
                <div key={group.label}>
                  {gi > 0 && <div className="mx-4 my-1.5 border-t border-white/10" />}
                  <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {group.label}
                  </p>
                  {group.items.map((item: any) => {
                    if (item.children) {
                      const childActive = item.children.some((c: any) => location.pathname === c.path);
                      return (
                        <div key={item.label}>
                          <div className={cn(
                            "flex items-center gap-3 px-4 py-2 text-sm rounded-md mx-2",
                            childActive ? "text-white font-semibold" : "text-white/70"
                          )}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{item.label}</span>
                            <ChevronRight className={cn("h-3 w-3 transition-transform", childActive && "rotate-90")} />
                          </div>
                          <div className="ml-5 border-l border-white/15 pl-1 space-y-0.5">
                            {item.children.map((child: any) => {
                              const active = location.pathname === child.path;
                              return (
                                <Link
                                  key={child.path}
                                  to={child.path}
                                  onClick={() => setMobileOpen(false)}
                                  className={cn(
                                    "flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors rounded-md mx-1",
                                    active
                                      ? "bg-white/20 text-white font-semibold shadow-sm"
                                      : "text-white/70 hover:bg-white/10 hover:text-white"
                                  )}
                                >
                                  <child.icon className="h-3.5 w-3.5 shrink-0" />
                                  <span>{child.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-md mx-2",
                          active
                            ? "bg-white/20 text-white font-semibold shadow-md"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
              {/* Super Admin link mobile */}
              {role === "super_admin" && (
                <div>
                  <div className="mx-4 my-1.5 border-t border-white/10" />
                  <Link
                    to="/super-admin"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-md mx-2",
                      location.pathname === "/super-admin"
                        ? "bg-white/20 text-white font-semibold shadow-md"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Crown className="h-4 w-4 shrink-0" />
                    <span>Super Admin</span>
                  </Link>
                </div>
              )}
            </nav>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 mx-2 rounded-md"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sair</span>
            </button>
            {isIceAgeFactory && (
              <div className="flex justify-center py-2 border-t border-white/10">
                <img
                  key={sidebarCharIdx}
                  src={sidebarChar.src}
                  alt=""
                  aria-hidden
                  className="w-20 h-20 object-contain pointer-events-none select-none animate-fade-in"
                />
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "hidden md:flex flex-col bg-sidebar-background text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border",
          isExpanded ? "w-60" : "w-16"
        )}
      >
        {sidebarContent}
      </aside>

      <main className="flex-1 overflow-auto relative bg-background flex flex-col">
        <PaymentBanner />
        {/* Watermark logo */}
        <div className="fixed bottom-4 right-4 pointer-events-none z-0 opacity-[0.06] dark:opacity-[0.04]">
          <img src={factoryLogo} alt="" aria-hidden className="w-32 h-32 object-contain" />
        </div>
        {/* Themed background */}
        <div className="sticky top-0 left-0 w-full h-0 pointer-events-none" style={{ zIndex: 0 }}>
          <div className="absolute top-0 left-0 w-full h-screen overflow-hidden">
            <div className="absolute inset-0 opacity-60 dark:opacity-35">
              <DottedSurface className="opacity-80 dark:opacity-100" />
            </div>

            {isIceAgeFactory ? (
              <>
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

                {/* === ICE AGE CHARACTERS (route-based) === */}
                {getPageCharacters(location.pathname).map((item, i) => (
                  <img
                    key={`${location.pathname}-char-${i}`}
                    src={item.character.src}
                    alt=""
                    aria-hidden
                    className={`absolute ${item.pos} ${item.size} object-contain opacity-[0.28] dark:opacity-[0.16] pointer-events-none select-none`}
                  />
                ))}
              </>
            ) : (
              /* Neutral background for other factories - subtle gradient based on their theme */
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
            )}
          </div>
        </div>

        {impersonatingFactory && (
          <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between text-sm font-medium">
            <span>🏭 Visualizando fábrica: <strong>{factoryName}</strong></span>
            <button
              className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
              onClick={() => { clearImpersonation(); navigate("/super-admin"); }}
            >
              Sair da Fábrica
            </button>
          </div>
        )}
        <div className="relative p-3 sm:p-4 md:p-6 pt-14 md:pt-6" style={{ zIndex: 1 }}>{children}</div>
      </main>
    </div>
  );
}
