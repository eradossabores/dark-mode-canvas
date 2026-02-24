import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Factory, Warehouse, ShoppingCart, AlertTriangle } from "lucide-react";
import RelatorioProducao from "@/components/relatorios/RelatorioProducao";
import RelatorioEstoque from "@/components/relatorios/RelatorioEstoque";
import RelatorioVendas from "@/components/relatorios/RelatorioVendas";
import RelatorioInadimplencia from "@/components/relatorios/RelatorioInadimplencia";

export default function Relatorios() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Relatórios</h1>
      <Tabs defaultValue="producao">
        <TabsList className="mb-4">
          <TabsTrigger value="producao" className="gap-2"><Factory className="h-4 w-4" /> Produção</TabsTrigger>
          <TabsTrigger value="estoque" className="gap-2"><Warehouse className="h-4 w-4" /> Estoque</TabsTrigger>
          <TabsTrigger value="vendas" className="gap-2"><ShoppingCart className="h-4 w-4" /> Vendas</TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-2"><AlertTriangle className="h-4 w-4" /> Inadimplência</TabsTrigger>
        </TabsList>
        <TabsContent value="producao"><RelatorioProducao /></TabsContent>
        <TabsContent value="estoque"><RelatorioEstoque /></TabsContent>
        <TabsContent value="vendas"><RelatorioVendas /></TabsContent>
        <TabsContent value="inadimplencia"><RelatorioInadimplencia /></TabsContent>
      </Tabs>
    </div>
  );
}
