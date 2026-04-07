import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, Users, ShoppingCart, Factory,
  Warehouse, ClipboardList, UserCog, BarChart3, FileUp, DollarSign, Monitor,
  ShoppingBag, Database, LogOut, Shield, Brain, MapPin, Map, Target,
  HardDrive, UserCheck, Crown, MessageCircle, Settings, CalendarDays,
  ChevronDown, Menu, X, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import PaymentBanner from "@/components/PaymentBanner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isRouteAllowed } from "@/components/ProtectedRoute";
import useKeyboardShortcuts from "@/hooks/useKeyboardShortcuts";

interface MenuItem {
  path: string;
  label: string;
  icon: any;
  children?: MenuItem[];
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Principal",
    items: [
      { path: "/painel", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Produção",
    items: [
      {
        path: "/painel/plano-producao", label: "Plano de Produção", icon: CalendarDays, children: [
          { path: "/painel/plano-producao", label: "Plano Diário", icon: Factory },
          { path: "/painel/plano-semanal", label: "Plano Semanal", icon: CalendarDays },
        ]
      },
      { path: "/painel/producao", label: "Produção", icon: Factory },
      { path: "/painel/monitor-producao", label: "Monitor", icon: Monitor },
      { path: "/painel/presenca", label: "Presença", icon: UserCheck },
      { path: "/painel/previsao-demanda", label: "Previsão", icon: Brain },
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
      { path: "/painel/pedidos-producao", label: "Histórico Pedidos", icon: ShoppingBag },
      { path: "/painel/mapa-clientes", label: "Mapa Clientes", icon: Map },
    ],
  },
  {
    label: "Sistema",
    items: [
      { path: "/painel/configurar", label: "Configurações", icon: Settings },
      { path: "/painel/relatorios", label: "Relatórios", icon: BarChart3 },
      { path: "/painel/importar-planilha", label: "Importar Dados", icon: FileUp },
      { path: "/painel/auditoria", label: "Auditoria", icon: ClipboardList },
      { path: "/painel/diagnostico", label: "Diagnóstico", icon: Database },
      { path: "/painel/usuarios", label: "Usuários", icon: Shield },
      { path: "/painel/backup", label: "Backup", icon: HardDrive },
      { path: "/painel/suporte", label: "Suporte", icon: MessageCircle },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const navigate = useNavigate();
  const { role, signOut, factoryName, branding, impersonatingFactory, clearImpersonation } = useAuth();
  useKeyboardShortcuts();

  // Apply factory theme
  useEffect(() => {
    if (branding?.theme) {
      const root = document.documentElement;
      if (branding.theme.primary) {
        root.style.setProperty('--primary', branding.theme.primary);
        root.style.setProperty('--ring', branding.theme.primary);
      }
      if (branding.theme.secondary) root.style.setProperty('--secondary', branding.theme.secondary);
      if (branding.theme.accent) root.style.setProperty('--accent', branding.theme.accent);
      return () => {
        root.style.removeProperty('--primary');
        root.style.removeProperty('--ring');
        root.style.removeProperty('--secondary');
        root.style.removeProperty('--accent');
      };
    }
  }, [branding?.theme]);

  // Auto-open parent when child is active
  useEffect(() => {
    for (const group of menuGroups) {
      for (const item of group.items) {
        if (item.children?.some((c) => location.pathname === c.path)) {
          setOpenMenus((prev) => ({ ...prev, [item.label]: true }));
        }
      }
    }
  }, [location.pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const filteredGroups = menuGroups
    .map((g) => ({ ...g, items: g.items.filter((item) => isRouteAllowed(item.path, role)) }))
    .filter((g) => g.items.length > 0);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const renderMenuItem = (item: MenuItem, isCollapsed = false) => {
    if (item.children) {
      const childActive = item.children.some((c) => location.pathname === c.path);
      const isOpen = openMenus[item.label] ?? false;

      if (isCollapsed) {
        // In collapsed mode, show only icon with tooltip-like behavior
        return (
          <div key={item.label} className="relative group">
            <div
              className={cn(
                "flex items-center justify-center p-2.5 rounded-lg transition-all duration-150",
                childActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
            </div>
            {/* Flyout on hover */}
            <div className="absolute left-full top-0 ml-2 hidden group-hover:block z-50">
              <div className="bg-popover border border-border rounded-lg shadow-lg p-2 min-w-[180px]">
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{item.label}</p>
                {item.children.map((child) => {
                  const active = location.pathname === child.path;
                  return (
                    <Link
                      key={child.path}
                      to={child.path}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <child.icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }

      return (
        <div key={item.label}>
          <button
            onClick={() => toggleMenu(item.label)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              childActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </button>
          <div
            className={cn(
              "overflow-hidden transition-all duration-200 ease-in-out",
              isOpen ? "max-h-40 mt-1" : "max-h-0"
            )}
          >
            <div className="ml-3 pl-3 border-l-2 border-border space-y-0.5">
              {item.children.map((child) => {
                const active = location.pathname === child.path;
                return (
                  <Link
                    key={child.path}
                    to={child.path}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <child.icon className="h-4 w-4 shrink-0" />
                    <span>{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    const active = location.pathname === item.path;

    if (isCollapsed) {
      return (
        <div key={item.path} className="relative group">
          <Link
            to={item.path}
            className={cn(
              "flex items-center justify-center p-2.5 rounded-lg transition-all duration-150",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-[18px] w-[18px]" />
          </Link>
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block z-50">
            <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap">
              {item.label}
            </div>
          </div>
        </div>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  };

  const renderSidebarNav = (isCollapsedMode: boolean) => (
    <nav className={cn("flex-1 overflow-y-auto py-4 space-y-6", isCollapsedMode ? "px-2" : "px-3")}>
      {filteredGroups.map((group) => (
        <div key={group.label}>
          {!isCollapsedMode && (
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {group.label}
            </p>
          )}
          {isCollapsedMode && <div className="h-px bg-border mx-1 mb-2" />}
          <div className="space-y-0.5">
            {group.items.map((item) => renderMenuItem(item, isCollapsedMode))}
          </div>
        </div>
      ))}
      {role === "super_admin" && (
        <div>
          <div className={cn("h-px bg-border mb-3", isCollapsedMode ? "mx-1" : "mx-3")} />
          {isCollapsedMode ? (
            <div className="relative group">
              <Link
                to="/super-admin"
                className={cn(
                  "flex items-center justify-center p-2.5 rounded-lg transition-all duration-150",
                  location.pathname === "/super-admin"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Crown className="h-[18px] w-[18px]" />
              </Link>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block z-50">
                <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap">
                  Super Admin
                </div>
              </div>
            </div>
          ) : (
            <Link
              to="/super-admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                location.pathname === "/super-admin"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Crown className="h-[18px] w-[18px] shrink-0" />
              <span>Super Admin</span>
            </Link>
          )}
        </div>
      )}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ─── MOBILE HEADER ─── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border flex items-center px-4 gap-3 shadow-sm">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2 min-w-0">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={factoryName || "Logo"} className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Factory className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          <span className="font-semibold text-sm truncate">{factoryName || "ICETECH"}</span>
        </div>
      </div>

      {/* ─── MOBILE OVERLAY ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-card border-r border-border flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt={factoryName || "Logo"} className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                  <Factory className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm truncate">{factoryName || "ICETECH"}</span>
                <span className="text-[10px] text-muted-foreground">Sistema de Gestão</span>
              </div>
            </div>

            {renderSidebarNav(false)}

            <div className="border-t border-border p-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                <span>Sair</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className={cn(
          "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 transition-all duration-300 ease-in-out text-sidebar-foreground",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center h-16 border-b border-sidebar-border shrink-0",
          collapsed ? "justify-center px-2" : "gap-3 px-4"
        )}>
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt={factoryName || "Logo"} className={cn("rounded-xl object-cover shrink-0", collapsed ? "h-9 w-9" : "h-10 w-10")} />
          ) : (
            <div className={cn(
              "rounded-xl bg-sidebar-primary flex items-center justify-center shadow-sm shrink-0",
              collapsed ? "h-9 w-9" : "h-10 w-10"
            )}>
              <Factory className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm truncate">{factoryName || "ICETECH"}</span>
              <span className="text-[10px] text-muted-foreground">Sistema de Gestão</span>
            </div>
          )}
        </div>

        {renderSidebarNav(collapsed)}

        {/* Footer */}
        <div className={cn("border-t border-sidebar-border space-y-1", collapsed ? "p-2" : "p-3")}>
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-all duration-150",
              collapsed ? "justify-center p-2.5 w-full" : "gap-3 px-3 py-2.5 w-full"
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <PaymentBanner />
        {impersonatingFactory && (
          <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between text-sm font-medium">
            <span>🏭 Visualizando fábrica: <strong>{factoryName}</strong></span>
            <button
              className="px-3 py-1 rounded-md bg-primary-foreground/20 text-xs font-medium hover:bg-primary-foreground/30 transition-colors"
              onClick={() => { clearImpersonation(); navigate("/super-admin"); }}
            >
              Sair da Fábrica
            </button>
          </div>
        )}
        <div className="flex-1 p-4 md:p-6 pt-16 md:pt-6">{children}</div>
      </main>
    </div>
  );
}
