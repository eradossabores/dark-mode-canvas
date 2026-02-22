import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export default function ContasAPagar() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contas a Pagar</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhuma conta a pagar registrada ainda.</p>
        </CardContent>
      </Card>
    </div>
  );
}
