import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import GlobalSearch from "@/components/GlobalSearch";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import SnowEffect from "@/components/SnowEffect";
import ThemeProvider from "@/components/ThemeProvider";
import Login from "@/pages/Login";
import { Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Producao from "@/pages/Producao";
import Vendas from "@/pages/Vendas";
import Estoque from "@/pages/Estoque";
import Clientes from "@/pages/Clientes";
import Funcionarios from "@/pages/Funcionarios";
import Sabores from "@/pages/Sabores";
import Auditoria from "@/pages/Auditoria";
import Relatorios from "@/pages/Relatorios";
import ImportarPlanilha from "@/pages/ImportarPlanilha";
import AReceber from "@/pages/AReceber";
import ContasAPagar from "@/pages/ContasAPagar";
import PedidosProducao from "@/pages/PedidosProducao";
import MonitorProducao from "@/pages/MonitorProducao";
import Diagnostico from "@/pages/Diagnostico";
import VerificacaoVendas from "@/pages/VerificacaoVendas";
import GerenciarUsuarios from "@/pages/GerenciarUsuarios";
import PrevisaoDemanda from "@/pages/PrevisaoDemanda";
import PlanoProducaoDiario from "@/pages/PlanoProducaoDiario";
import MapaEntregas from "@/pages/MapaEntregas";
import MapaClientes from "@/pages/MapaClientes";
import Prospeccao from "@/pages/Prospeccao";
import Cadastro from "@/pages/Cadastro";
import Pedir from "@/pages/Pedir";
import Backup from "@/pages/Backup";
import PresencaProducao from "@/pages/PresencaProducao";
import SuperAdmin from "@/pages/SuperAdmin";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

// Helper for admin-only routes (admin, factory_owner, super_admin)
const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute adminOnly><Layout>{children}</Layout></ProtectedRoute>
);

// Helper for routes accessible by producao role too
const ProdRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><Layout>{children}</Layout></ProtectedRoute>
);

// Helper for super admin only routes
const SuperRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute superAdminOnly><Layout>{children}</Layout></ProtectedRoute>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <SnowEffect />
              <GlobalSearch />
              <Routes>
              {/* Public */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/pedir" element={<Pedir />} />

              {/* Super Admin */}
              <Route path="/super-admin" element={<SuperRoute><SuperAdmin /></SuperRoute>} />

              {/* Admin only routes */}
              <Route path="/painel" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/painel/vendas" element={<AdminRoute><Vendas /></AdminRoute>} />
              <Route path="/painel/a-receber" element={<AdminRoute><AReceber /></AdminRoute>} />
              <Route path="/painel/contas-a-pagar" element={<AdminRoute><ContasAPagar /></AdminRoute>} />
              <Route path="/painel/clientes" element={<AdminRoute><Clientes /></AdminRoute>} />
              <Route path="/painel/funcionarios" element={<AdminRoute><Funcionarios /></AdminRoute>} />
              <Route path="/painel/sabores" element={<AdminRoute><Sabores /></AdminRoute>} />
              <Route path="/painel/relatorios" element={<AdminRoute><Relatorios /></AdminRoute>} />
              <Route path="/painel/importar-planilha" element={<AdminRoute><ImportarPlanilha /></AdminRoute>} />
              <Route path="/painel/auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />
              <Route path="/painel/diagnostico" element={<AdminRoute><Diagnostico /></AdminRoute>} />
              <Route path="/painel/verificacao-vendas" element={<AdminRoute><VerificacaoVendas /></AdminRoute>} />
              <Route path="/painel/usuarios" element={<AdminRoute><GerenciarUsuarios /></AdminRoute>} />
              <Route path="/painel/previsao-demanda" element={<AdminRoute><PrevisaoDemanda /></AdminRoute>} />
              <Route path="/painel/mapa-entregas" element={<AdminRoute><MapaEntregas /></AdminRoute>} />
              <Route path="/painel/mapa-clientes" element={<AdminRoute><MapaClientes /></AdminRoute>} />
              <Route path="/painel/prospeccao" element={<AdminRoute><Prospeccao /></AdminRoute>} />
              <Route path="/painel/plano-producao" element={<AdminRoute><PlanoProducaoDiario /></AdminRoute>} />
              <Route path="/painel/backup" element={<AdminRoute><Backup /></AdminRoute>} />

              {/* Production accessible routes */}
              <Route path="/painel/producao" element={<ProdRoute><Producao /></ProdRoute>} />
              <Route path="/painel/pedidos-producao" element={<ProdRoute><PedidosProducao /></ProdRoute>} />
              <Route path="/painel/monitor-producao" element={<ProdRoute><MonitorProducao /></ProdRoute>} />
              <Route path="/painel/estoque" element={<ProdRoute><Estoque /></ProdRoute>} />
              <Route path="/painel/presenca" element={<ProdRoute><PresencaProducao /></ProdRoute>} />

              <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
