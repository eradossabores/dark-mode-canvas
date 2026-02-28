import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  LayoutDashboard, Factory, ShoppingCart, Warehouse, Users, UserCog, Package,
  BarChart3, Monitor, ShoppingBag, DollarSign, ClipboardList, Shield, Brain,
  MapPin, Map, Target, FileUp, Database, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isRouteAllowed } from "@/components/ProtectedRoute";

const pages = [
  { path: "/painel", label: "Dashboard", icon: LayoutDashboard, keywords: "inicio home painel" },
  { path: "/painel/producao", label: "Produção", icon: Factory, keywords: "fabricar lote" },
  { path: "/painel/monitor-producao", label: "Monitor Produção", icon: Monitor, keywords: "acompanhar pedidos separação" },
  { path: "/painel/pedidos-producao", label: "Histórico de Pedidos", icon: ShoppingBag, keywords: "pedidos historico" },
  { path: "/painel/vendas", label: "Vendas", icon: ShoppingCart, keywords: "vender nota fiscal" },
  { path: "/painel/a-receber", label: "A Receber", icon: DollarSign, keywords: "parcelas inadimplência cobrança" },
  { path: "/painel/contas-a-pagar", label: "Contas a Pagar", icon: ClipboardList, keywords: "despesas pagamentos" },
  { path: "/painel/estoque", label: "Estoque", icon: Warehouse, keywords: "materias primas embalagens gelos" },
  { path: "/painel/clientes", label: "Clientes", icon: Users, keywords: "cliente freezer" },
  { path: "/painel/funcionarios", label: "Colaboradores", icon: UserCog, keywords: "funcionario colaborador" },
  { path: "/painel/sabores", label: "Sabores", icon: Package, keywords: "sabor receita" },
  { path: "/painel/relatorios", label: "Relatórios", icon: BarChart3, keywords: "relatorio exportar pdf" },
  { path: "/painel/importar-planilha", label: "Upload Planilha", icon: FileUp, keywords: "importar excel xlsx" },
  { path: "/painel/auditoria", label: "Auditoria", icon: ClipboardList, keywords: "log registro" },
  { path: "/painel/diagnostico", label: "Diagnóstico", icon: Database, keywords: "verificar sistema" },
  { path: "/painel/usuarios", label: "Usuários", icon: Shield, keywords: "usuario permissão convite" },
  { path: "/painel/previsao-demanda", label: "Previsão Demanda", icon: Brain, keywords: "ia inteligencia previsao" },
  { path: "/painel/mapa-entregas", label: "Mapa Entregas", icon: MapPin, keywords: "mapa rota entrega" },
  { path: "/painel/mapa-clientes", label: "Mapa Clientes", icon: Map, keywords: "mapa localização" },
  { path: "/painel/prospeccao", label: "Prospecção", icon: Target, keywords: "prospecto lead visita" },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const navigate = useNavigate();
  const { role } = useAuth();

  const filtered = pages.filter((p) => {
    if (!isRouteAllowed(p.path, role)) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.label.toLowerCase().includes(q) || p.keywords.includes(q);
  });

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const go = useCallback((path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  }, [navigate]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      go(filtered[selectedIdx].path);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-lg gap-0 overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Buscar página... (Ctrl+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum resultado encontrado.</p>
          )}
          {filtered.map((p, i) => (
            <button
              key={p.path}
              onClick={() => go(p.path)}
              className={cn(
                "flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors",
                i === selectedIdx ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
            >
              <p.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground flex gap-4">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc fechar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
