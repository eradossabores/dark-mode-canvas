import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, XCircle, LogOut, Lock } from "lucide-react";
import logo from "@/assets/logo.png";

// Routes collaborators (producao) can access
const PRODUCAO_ROUTES = [
  "/painel/producao",
  "/painel/pedidos-producao",
  "/painel/monitor-producao",
  "/painel/estoque",
];

// Routes only super_admin can access
const SUPER_ADMIN_ROUTES = [
  "/super-admin",
];

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly, superAdminOnly }: ProtectedRouteProps) {
  const { user, role, approvalStatus, loading, signOut, subscription } = useAuth();
  const navigate = useNavigate();

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

  // User logged in via Google but pending approval
  if (!role && approvalStatus === "pendente") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 via-sky-50 to-cyan-100 dark:from-sky-950 dark:via-gray-900 dark:to-cyan-950 px-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-3">
            <div className="flex justify-center">
              <img src={logo} alt="A Era dos Sabores" className="h-14 w-14 rounded-lg shadow-md" />
            </div>
            <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Aguardando Aprovação
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Seu acesso foi solicitado com sucesso! Um administrador precisa aprovar sua conta antes que você possa utilizar o sistema.
            </p>
            <p className="text-sm text-muted-foreground">
              Você receberá acesso assim que for aprovado. Tente novamente mais tarde.
            </p>
            <Button variant="outline" className="gap-2" onClick={async () => { await signOut(); navigate("/login"); }}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rejected
  if (!role && approvalStatus === "rejeitado") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 via-sky-50 to-cyan-100 dark:from-sky-950 dark:via-gray-900 dark:to-cyan-950 px-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-3">
            <CardTitle className="text-xl font-bold flex items-center justify-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Acesso Negado
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Seu acesso foi recusado pelo administrador. Entre em contato se acredita que isso é um erro.
            </p>
            <Button variant="outline" className="gap-2" onClick={async () => { await signOut(); navigate("/login"); }}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No role and no request
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 via-sky-50 to-cyan-100 dark:from-sky-950 dark:via-gray-900 dark:to-cyan-950 px-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center space-y-3">
            <CardTitle className="text-xl font-bold flex items-center justify-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Sem permissão de acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Esta conta ainda não tem perfil de acesso vinculado. Contate um administrador para liberar o acesso.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate("/")}>Voltar ao início</Button>
              <Button variant="outline" className="gap-2" onClick={async () => { await signOut(); navigate("/login"); }}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Subscription blocked (not for super_admin)
  if (role !== "super_admin" && subscription?.status === "blocked") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 via-sky-50 to-cyan-100 dark:from-sky-950 dark:via-gray-900 dark:to-cyan-950 px-4">
        <Card className="w-full max-w-md shadow-2xl border-destructive/30">
          <CardHeader className="text-center space-y-3">
            <div className="flex justify-center">
              <Lock className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-xl font-bold text-destructive">
              Acesso Bloqueado
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Sua assinatura está vencida e o período de carência expirou. Entre em contato com o administrador para regularizar o pagamento.
            </p>
            <p className="text-sm font-semibold text-destructive">
              Valor: R$ 99,90/mês
            </p>
            <Button variant="outline" className="gap-2" onClick={async () => { await signOut(); navigate("/login"); }}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Super admin only routes
  if (superAdminOnly && role !== "super_admin") {
    return <Navigate to="/painel" replace />;
  }

  // Admin only routes (admin or factory_owner or super_admin can access)
  if (adminOnly && role !== "admin" && role !== "factory_owner" && role !== "super_admin") {
    return <Navigate to="/painel/producao" replace />;
  }

  return <>{children}</>;
}

export function isRouteAllowed(path: string, role: string | null): boolean {
  if (role === "super_admin") return true;
  if (role === "admin" || role === "factory_owner") return true;
  if (role === "producao") {
    return PRODUCAO_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
  }
  return false;
}

export { PRODUCAO_ROUTES, SUPER_ADMIN_ROUTES };
