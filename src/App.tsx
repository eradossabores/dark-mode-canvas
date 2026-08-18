import { Suspense, lazy } from "react";
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
import OfflineIndicator from "@/components/OfflineIndicator";
import ThemeProvider from "@/components/ThemeProvider";
import Login from "@/pages/Login";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Producao = lazy(() => import("@/pages/Producao"));
const Vendas = lazy(() => import("@/pages/Vendas"));
const Estoque = lazy(() => import("@/pages/Estoque"));
const Clientes = lazy(() => import("@/pages/Clientes"));
const ClientesSemCompra = lazy(() => import("@/pages/ClientesSemCompra"));
const Funcionarios = lazy(() => import("@/pages/Funcionarios"));
const Sabores = lazy(() => import("@/pages/Sabores"));
const Auditoria = lazy(() => import("@/pages/Auditoria"));
const Relatorios = lazy(() => import("@/pages/Relatorios"));
const Faturamento = lazy(() => import("@/pages/Faturamento"));
const ImportarPlanilha = lazy(() => import("@/pages/ImportarPlanilha"));
const AReceber = lazy(() => import("@/pages/AReceber"));
const ContasAPagar = lazy(() => import("@/pages/ContasAPagar"));
const PedidosProducao = lazy(() => import("@/pages/PedidosProducao"));
const MonitorProducao = lazy(() => import("@/pages/MonitorProducao"));
const Diagnostico = lazy(() => import("@/pages/Diagnostico"));
const VerificacaoVendas = lazy(() => import("@/pages/VerificacaoVendas"));
const GerenciarUsuarios = lazy(() => import("@/pages/GerenciarUsuarios"));
const PrevisaoDemanda = lazy(() => import("@/pages/PrevisaoDemanda"));
const PlanoProducaoDiario = lazy(() => import("@/pages/PlanoProducaoDiario"));
const PlanoSemanal = lazy(() => import("@/pages/PlanoSemanal"));
const MapaEntregas = lazy(() => import("@/pages/MapaEntregas"));
const MapaClientes = lazy(() => import("@/pages/MapaClientes"));
const Prospeccao = lazy(() => import("@/pages/Prospeccao"));
const Cadastro = lazy(() => import("@/pages/Cadastro"));
const Pedir = lazy(() => import("@/pages/Pedir"));
const Backup = lazy(() => import("@/pages/Backup"));
const PresencaProducao = lazy(() => import("@/pages/PresencaProducao"));
const SuperAdmin = lazy(() => import("@/pages/SuperAdmin"));
const Suporte = lazy(() => import("@/pages/Suporte"));
const ConfigurarFabrica = lazy(() => import("@/pages/ConfigurarFabrica"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Compras = lazy(() => import("@/pages/Compras"));
const Vendedores = lazy(() => import("@/pages/Vendedores"));
const MeusClientes = lazy(() => import("@/pages/vendedor/MeusClientes"));
const NovoPedido = lazy(() => import("@/pages/vendedor/NovoPedido"));
const EstoqueDisponivel = lazy(() => import("@/pages/vendedor/EstoqueDisponivel"));
const MinhasComissoes = lazy(() => import("@/pages/vendedor/MinhasComissoes"));
const DashboardVendedor = lazy(() => import("@/pages/vendedor/DashboardVendedor"));
const HistoricoVendas = lazy(() => import("@/pages/vendedor/HistoricoVendas"));
const OpExtDashboard = lazy(() => import("@/pages/operacao/Dashboard"));
const OpExtMinhaRota = lazy(() => import("@/pages/operacao/MinhaRota"));
const OpExtAtendimento = lazy(() => import("@/pages/operacao/Atendimento"));
const OpExtProspeccao = lazy(() => import("@/pages/operacao/Prospeccao"));
const OpExtOcorrencias = lazy(() => import("@/pages/operacao/Ocorrencias"));
const OpExtHistorico = lazy(() => import("@/pages/operacao/Historico"));
const OpExtDesempenho = lazy(() => import("@/pages/operacao/MeuDesempenho"));
const OpExtAdmin = lazy(() => import("@/pages/operacao/AdminVisao"));
const TrocarSenha = lazy(() => import("@/pages/TrocarSenha"));

const PageFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

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
              <OfflineIndicator />
              <Suspense fallback={<PageFallback />}>
              <Routes>
              {/* Public */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/pedir" element={<Pedir />} />

              {/* Super Admin */}
              <Route path="/super-admin" element={<SuperRoute><SuperAdmin /></SuperRoute>} />

              {/* Admin only routes */}
              <Route path="/painel" element={<Navigate to="/painel/operacao-externa" replace />} />
              <Route path="/painel/painel-vendas" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/painel/vendas" element={<AdminRoute><Vendas /></AdminRoute>} />
              <Route path="/painel/faturamento" element={<AdminRoute><Faturamento /></AdminRoute>} />
              <Route path="/painel/vendedores" element={<AdminRoute><Vendedores /></AdminRoute>} />
              <Route path="/painel/a-receber" element={<AdminRoute><AReceber /></AdminRoute>} />
              <Route path="/painel/contas-a-pagar" element={<AdminRoute><ContasAPagar /></AdminRoute>} />
              <Route path="/painel/compras" element={<AdminRoute><Compras /></AdminRoute>} />
              <Route path="/painel/clientes" element={<AdminRoute><Clientes /></AdminRoute>} />
              <Route path="/painel/clientes-sem-compra" element={<AdminRoute><ClientesSemCompra /></AdminRoute>} />
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
              <Route path="/painel/plano-semanal" element={<AdminRoute><PlanoSemanal /></AdminRoute>} />
               <Route path="/painel/backup" element={<AdminRoute><Backup /></AdminRoute>} />
               <Route path="/painel/configurar" element={<AdminRoute><ConfigurarFabrica /></AdminRoute>} />
               <Route path="/painel/suporte" element={<ProdRoute><Suporte /></ProdRoute>} />

              {/* Production accessible routes */}
              <Route path="/painel/producao" element={<ProdRoute><Producao /></ProdRoute>} />
              <Route path="/painel/pedidos-producao" element={<ProdRoute><PedidosProducao /></ProdRoute>} />
              <Route path="/painel/monitor-producao" element={<ProdRoute><MonitorProducao /></ProdRoute>} />
              <Route path="/painel/estoque" element={<ProdRoute><Estoque /></ProdRoute>} />
              <Route path="/painel/presenca" element={<ProdRoute><PresencaProducao /></ProdRoute>} />

              {/* Vendedor routes */}
              <Route path="/painel/vendedor" element={<ProdRoute><DashboardVendedor /></ProdRoute>} />
              <Route path="/painel/vendedor/clientes" element={<ProdRoute><MeusClientes /></ProdRoute>} />
              <Route path="/painel/vendedor/novo-pedido" element={<ProdRoute><NovoPedido /></ProdRoute>} />
              <Route path="/painel/vendedor/estoque" element={<ProdRoute><EstoqueDisponivel /></ProdRoute>} />
              <Route path="/painel/vendedor/comissoes" element={<ProdRoute><MinhasComissoes /></ProdRoute>} />
              <Route path="/painel/vendedor/historico" element={<ProdRoute><HistoricoVendas /></ProdRoute>} />

              {/* Trocar senha (todos os perfis) */}
              <Route path="/painel/trocar-senha" element={<ProdRoute><TrocarSenha /></ProdRoute>} />

              {/* Operação Externa (auxiliar_externo + admin/factory_owner/super_admin) */}
              <Route path="/painel/operacao-externa" element={<ProdRoute><OpExtDashboard /></ProdRoute>} />
              <Route path="/painel/operacao-externa/minha-rota" element={<ProdRoute><OpExtMinhaRota /></ProdRoute>} />
              <Route path="/painel/operacao-externa/atendimento" element={<ProdRoute><OpExtAtendimento /></ProdRoute>} />
              <Route path="/painel/operacao-externa/atendimento/:visitaId" element={<ProdRoute><OpExtAtendimento /></ProdRoute>} />
              <Route path="/painel/operacao-externa/prospeccao" element={<ProdRoute><OpExtProspeccao /></ProdRoute>} />
              <Route path="/painel/operacao-externa/ocorrencias" element={<ProdRoute><OpExtOcorrencias /></ProdRoute>} />
              <Route path="/painel/operacao-externa/historico" element={<ProdRoute><OpExtHistorico /></ProdRoute>} />
              <Route path="/painel/operacao-externa/desempenho" element={<ProdRoute><OpExtDesempenho /></ProdRoute>} />
              <Route path="/painel/operacao-externa/admin" element={<AdminRoute><OpExtAdmin /></AdminRoute>} />

              <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
