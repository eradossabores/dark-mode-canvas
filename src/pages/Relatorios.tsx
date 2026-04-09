import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Factory, Warehouse, ShoppingCart, AlertTriangle, Users, FileBarChart, Receipt, DollarSign, RefreshCw, TrendingUp, ShieldAlert, BarChart3 } from "lucide-react";
import RelatorioCompleto from "@/components/relatorios/RelatorioCompleto";
import RelatorioProducao from "@/components/relatorios/RelatorioProducao";
import RelatorioEstoque from "@/components/relatorios/RelatorioEstoque";
import RelatorioVendas from "@/components/relatorios/RelatorioVendas";
import RelatorioInadimplencia from "@/components/relatorios/RelatorioInadimplencia";
import RelatorioColaboradores from "@/components/relatorios/RelatorioColaboradores";
import RelatorioDespesas from "@/components/relatorios/RelatorioDespesas";
import RelatorioDRE from "@/components/relatorios/RelatorioDRE";
import RelatorioMargem from "@/components/relatorios/RelatorioMargem";
import RelatorioSazonalidade from "@/components/relatorios/RelatorioSazonalidade";
import RelatorioComissoes from "@/components/relatorios/RelatorioComissoes";
import RelatorioRecorrencia from "@/components/relatorios/RelatorioRecorrencia";
import RelatorioInadimplenciaPreditiva from "@/components/relatorios/RelatorioInadimplenciaPreditiva";
import { useAuth } from "@/contexts/AuthContext";

export default function Relatorios() {
  const { factoryId } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Relatórios</h1>
      <Tabs defaultValue="completo">
        <TabsList className="mb-4 w-full overflow-x-auto flex justify-start h-auto gap-1 p-1 flex-wrap">
          <TabsTrigger value="completo" className="gap-2"><FileBarChart className="h-4 w-4" /> Completo</TabsTrigger>
          <TabsTrigger value="producao" className="gap-2"><Factory className="h-4 w-4" /> Produção</TabsTrigger>
          <TabsTrigger value="estoque" className="gap-2"><Warehouse className="h-4 w-4" /> Estoque</TabsTrigger>
          <TabsTrigger value="vendas" className="gap-2"><ShoppingCart className="h-4 w-4" /> Vendas</TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-2"><AlertTriangle className="h-4 w-4" /> Inadimplência</TabsTrigger>
          <TabsTrigger value="colaboradores" className="gap-2"><Users className="h-4 w-4" /> Colaboradores</TabsTrigger>
          <TabsTrigger value="despesas" className="gap-2"><Receipt className="h-4 w-4" /> Despesas</TabsTrigger>
          <TabsTrigger value="dre" className="gap-2"><BarChart3 className="h-4 w-4" /> DRE</TabsTrigger>
          <TabsTrigger value="margem" className="gap-2"><DollarSign className="h-4 w-4" /> Margem</TabsTrigger>
          <TabsTrigger value="sazonalidade" className="gap-2"><TrendingUp className="h-4 w-4" /> Sazonalidade</TabsTrigger>
          <TabsTrigger value="comissoes" className="gap-2"><DollarSign className="h-4 w-4" /> Comissões</TabsTrigger>
          <TabsTrigger value="recorrencia" className="gap-2"><RefreshCw className="h-4 w-4" /> Recorrência</TabsTrigger>
          <TabsTrigger value="preditiva" className="gap-2"><ShieldAlert className="h-4 w-4" /> Risco</TabsTrigger>
        </TabsList>
        <TabsContent value="completo"><RelatorioCompleto /></TabsContent>
        <TabsContent value="producao"><RelatorioProducao /></TabsContent>
        <TabsContent value="estoque"><RelatorioEstoque /></TabsContent>
        <TabsContent value="vendas"><RelatorioVendas /></TabsContent>
        <TabsContent value="inadimplencia"><RelatorioInadimplencia /></TabsContent>
        <TabsContent value="colaboradores"><RelatorioColaboradores /></TabsContent>
        <TabsContent value="despesas"><RelatorioDespesas /></TabsContent>
        <TabsContent value="dre"><RelatorioDRE factoryId={factoryId} /></TabsContent>
        <TabsContent value="margem"><RelatorioMargem factoryId={factoryId} /></TabsContent>
        <TabsContent value="sazonalidade"><RelatorioSazonalidade factoryId={factoryId} /></TabsContent>
        <TabsContent value="comissoes"><RelatorioComissoes /></TabsContent>
        <TabsContent value="recorrencia"><RelatorioRecorrencia /></TabsContent>
        <TabsContent value="preditiva"><RelatorioInadimplenciaPreditiva /></TabsContent>
      </Tabs>
    </div>
  );
}
