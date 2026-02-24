import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import LandingPage from "@/pages/LandingPage";
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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Landing page - sem sidebar */}
          <Route path="/" element={<LandingPage />} />

          {/* Painel de controle - com sidebar */}
          <Route path="/painel" element={<Layout><Dashboard /></Layout>} />
          <Route path="/painel/producao" element={<Layout><Producao /></Layout>} />
          <Route path="/painel/pedidos-producao" element={<Layout><PedidosProducao /></Layout>} />
          <Route path="/painel/monitor-producao" element={<Layout><MonitorProducao /></Layout>} />
          <Route path="/painel/vendas" element={<Layout><Vendas /></Layout>} />
          <Route path="/painel/a-receber" element={<Layout><AReceber /></Layout>} />
          <Route path="/painel/contas-a-pagar" element={<Layout><ContasAPagar /></Layout>} />
          <Route path="/painel/estoque" element={<Layout><Estoque /></Layout>} />
          <Route path="/painel/clientes" element={<Layout><Clientes /></Layout>} />
          <Route path="/painel/funcionarios" element={<Layout><Funcionarios /></Layout>} />
          <Route path="/painel/sabores" element={<Layout><Sabores /></Layout>} />
          <Route path="/painel/relatorios" element={<Layout><Relatorios /></Layout>} />
          <Route path="/painel/importar-planilha" element={<Layout><ImportarPlanilha /></Layout>} />
          <Route path="/painel/auditoria" element={<Layout><Auditoria /></Layout>} />
          <Route path="/painel/diagnostico" element={<Layout><Diagnostico /></Layout>} />
          <Route path="/painel/verificacao-vendas" element={<Layout><VerificacaoVendas /></Layout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
