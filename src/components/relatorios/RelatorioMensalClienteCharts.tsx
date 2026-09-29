import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { SaborMensal } from "./relatorio-mensal-cliente-analysis";

interface RelatorioMensalClienteChartsProps {
  ranking: SaborMensal[];
}

const chartConfig = {
  quantidade: { label: "Unidades", color: "hsl(var(--chart-1))" },
  participacao: { label: "Participação", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const fillTokens = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;
const fillValues = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const dotClasses = ["bg-[hsl(var(--chart-1))]", "bg-[hsl(var(--chart-2))]", "bg-[hsl(var(--chart-3))]", "bg-[hsl(var(--chart-4))]", "bg-[hsl(var(--chart-5))]"];

export default function RelatorioMensalClienteCharts({ ranking }: RelatorioMensalClienteChartsProps) {
  const principais = ranking.slice(0, 8);

  return (
    <div id="relatorio-mensal-cliente-graficos" className="grid gap-4 lg:grid-cols-2">
      <Card data-chart-export>
        <CardHeader className="pb-2"><CardTitle className="text-base">Sabores mais comprados</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart data={principais} layout="vertical" margin={{ left: 12, right: 20 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="nome" type="category" width={92} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="quantidade" fill="var(--color-quantidade)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card data-chart-export>
        <CardHeader className="pb-2"><CardTitle className="text-base">Participação por sabor</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="nome" />} />
              <Pie data={principais} dataKey="quantidade" nameKey="nome" innerRadius={54} outerRadius={94} paddingAngle={2}>
                {principais.map((sabor, index) => <Cell key={sabor.nome} fill={fillValues[index % fillTokens.length]} />)}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {principais.map((sabor, index) => (
              <div key={sabor.nome} className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${dotClasses[index % dotClasses.length]}`} />
                <span className="truncate">{sabor.nome} · {sabor.participacao.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}