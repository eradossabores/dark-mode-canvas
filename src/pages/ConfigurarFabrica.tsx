import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfigProducaoDialog from "@/components/producao/ConfigProducaoDialog";
import ConfigVendasSection from "@/components/configurar/ConfigVendasSection";

export default function ConfigurarFabrica() {
  const { factoryId } = useAuth();
  const [configProdOpen, setConfigProdOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Configurar Fábrica</h1>
      </div>

      <Tabs defaultValue="vendas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendas">💰 Tabela de Preços</TabsTrigger>
          <TabsTrigger value="producao">⚙️ Produção</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas">
          <ConfigVendasSection factoryId={factoryId} />
        </TabsContent>

        <TabsContent value="producao">
          <ConfigProducaoInline factoryId={factoryId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Inline version of production config (not dialog)
function ConfigProducaoInline({ factoryId }: { factoryId: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure a quantidade de gelos e matéria-prima por lote para cada sabor.
      </p>
      <ConfigProducaoDialog open={open || true} onOpenChange={() => {}} factoryId={factoryId} />
    </div>
  );
}
