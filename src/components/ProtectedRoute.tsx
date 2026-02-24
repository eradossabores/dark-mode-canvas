import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Routes collaborators (producao) can access
const PRODUCAO_ROUTES = [
  "/painel/producao",
  "/painel/pedidos-producao",
  "/painel/monitor-producao",
  "/painel/estoque",
];

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If true, only admins can access */
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Sem permissão de acesso. Contate um administrador.</p>
      </div>
    );
  }

  if (adminOnly && role !== "admin") {
    return <Navigate to="/painel/producao" replace />;
  }

  return <>{children}</>;
}

export function isRouteAllowed(path: string, role: string | null): boolean {
  if (role === "admin") return true;
  if (role === "producao") {
    return PRODUCAO_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
  }
  return false;
}

export { PRODUCAO_ROUTES };
