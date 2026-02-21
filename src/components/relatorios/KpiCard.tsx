import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string;
  icon: LucideIcon;
  subtitle?: string;
}

export default function KpiCard({ title, value, icon: Icon, subtitle }: Props) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className="h-8 w-8 text-primary opacity-60" />
        </div>
      </CardContent>
    </Card>
  );
}
