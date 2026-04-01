import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Factory, Warehouse, ShoppingCart, AlertTriangle, Users, FileBarChart } from "lucide-react";
import RelatorioCompleto from "@/components/relatorios/RelatorioCompleto";
import RelatorioProducao from "@/components/relatorios/RelatorioProducao";
import RelatorioEstoque from "@/components/relatorios/RelatorioEstoque";
import RelatorioVendas from "@/components/relatorios/RelatorioVendas";
import RelatorioInadimplencia from "@/components/relatorios/RelatorioInadimplencia";
import RelatorioColaboradores from "@/components/relatorios/RelatorioColaboradores";

export default function Relatorios() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Relatórios</h1>
      <Tabs defaultValue="completo">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="completo" className="gap-2"><FileBarChart className="h-4 w-4" /> Completo</TabsTrigger>
          <TabsTrigger value="producao" className="gap-2"><Factory className="h-4 w-4" /> Produção</TabsTrigger>
          <TabsTrigger value="estoque" className="gap-2"><Warehouse className="h-4 w-4" /> Estoque</TabsTrigger>
          <TabsTrigger value="vendas" className="gap-2"><ShoppingCart className="h-4 w-4" /> Vendas</TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-2"><AlertTriangle className="h-4 w-4" /> Inadimplência</TabsTrigger>
          <TabsTrigger value="colaboradores" className="gap-2"><Users className="h-4 w-4" /> Colaboradores</TabsTrigger>
        </TabsList>
        <TabsContent value="completo"><RelatorioCompleto /></TabsContent>
        <TabsContent value="producao"><RelatorioProducao /></TabsContent>
        <TabsContent value="estoque"><RelatorioEstoque /></TabsContent>
        <TabsContent value="vendas"><RelatorioVendas /></TabsContent>
        <TabsContent value="inadimplencia"><RelatorioInadimplencia /></TabsContent>
        <TabsContent value="colaboradores"><RelatorioColaboradores /></TabsContent>
      </Tabs>
    </div>
  );
}
