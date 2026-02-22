import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Users, ShoppingCart, Factory,
  Warehouse, ClipboardList, UserCog, ChevronLeft, ChevronRight, BarChart3, FileUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const menuItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/producao", label: "Produção", icon: Factory },
  { path: "/vendas", label: "Vendas", icon: ShoppingCart },
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
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          "flex flex-col bg-sidebar-background text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border",
          collapsed ? "w-16" : "w-60"
        )}
      >
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
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
