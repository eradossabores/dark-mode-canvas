import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Phone, MapPin, Snowflake, Trophy, Wine, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportToPDF } from "@/lib/export-utils";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Agrupamento, BebidaPerfilRaw, ItemPerfilRaw, resumoBebidas, VendaPerfilRaw, agruparVendas, dataBR, topSabores, vendasValidas,
} from "@/components/clientes/perfil-cliente-analysis";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeBR = () => dataBR(new Date().toISOString());

async function carregar(clienteId: string) {
  const { data: cliente, error } = await supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle();
  if (error) throw error;
  const vendas: VendaPerfilRaw[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await supabase.from("vendas").select("id,created_at,total,status")
      .eq("cliente_id", clienteId).order("created_at").range(from, from + 999);
    if (e) throw e;
    vendas.push(...((data ?? []) as VendaPerfilRaw[]));
    if (!data || data.length < 1000) break;
  }
  const itens: ItemPerfilRaw[] = [];
  const ids = vendas.map((v) => v.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: e } = await supabase.from("venda_itens")
      .select("venda_id,quantidade,subtotal,sabores(nome)").in("venda_id", ids.slice(i, i + 200));
    if (e) throw e;
    for (const r of (data ?? []) as Array<{ venda_id: string; quantidade: number; subtotal: number; sabores: { nome: string } | null }>) {
      itens.push({ venda_id: r.venda_id, quantidade: r.quantidade, subtotal: r.subtotal, sabor: r.sabores?.nome ?? null });
    }
  }
  const bebidas: BebidaPerfilRaw[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: e } = await supabase.from("venda_bebida_itens")
      .select("venda_id,nome,quantidade,subtotal,tipo_venda,bebidas(unidades_fardo)").in("venda_id", ids.slice(i, i + 200));
    if (e) throw e;
    for (const r of (data ?? []) as Array<{ venda_id: string; nome: string | null; quantidade: number; subtotal: number; tipo_venda: string | null; bebidas: { unidades_fardo: number | null } | null }>) {
      bebidas.push({ venda_id: r.venda_id, nome: r.nome, quantidade: r.quantidade, subtotal: r.subtotal, tipo_venda: r.tipo_venda, unidades_fardo: r.bebidas?.unidades_fardo ?? null });
    }
  }
  let factory: { name: string | null; logo_url: string | null } | null = null;
  if (cliente?.factory_id) {
    const { data: f } = await supabase.from("factories").select("name,logo_url").eq("id", cliente.factory_id).maybeSingle();
    factory = (f as typeof factory) ?? null;
  }
  return { cliente, vendas, itens, bebidas, factory };
}

export default function ClientePerfil() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ["cliente-perfil", id], queryFn: () => carregar(id), staleTime: 60_000 });
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("mes");
  const [inicio, setInicio] = useState<string>("");
  const [fim, setFim] = useState<string>("");

  const primeiraVenda = useMemo(() => {
    const v = data ? vendasValidas(data.vendas) : [];
    return v.length ? dataBR(v[0].created_at) : hojeBR();
  }, [data]);
  const ini = inicio || primeiraVenda;
  const fimEf = fim || hojeBR();

  const filtradas = useMemo(() => (data ? vendasValidas(data.vendas, ini, fimEf) : []), [data, ini, fimEf]);
  const pontos = useMemo(() => (data ? agruparVendas(filtradas, data.itens, agrupamento) : []), [filtradas, data, agrupamento]);
  const top5 = useMemo(() => (data ? topSabores(filtradas, data.itens) : []), [filtradas, data]);
  const totalValor = filtradas.reduce((s, v) => s + Number(v.total ?? 0), 0);
  const totalUn = pontos.reduce((s, p) => s + p.unidades, 0);
  const bebidasRank = useMemo(() => (data ? resumoBebidas(filtradas, data.bebidas) : []), [filtradas, data]);
  const totalBebUn = bebidasRank.reduce((s, b) => s + b.unidades, 0);
  const totalBebValor = bebidasRank.reduce((s, b) => s + b.valor, 0);
  const [gerando, setGerando] = useState(false);
  const fmtD = (d: string) => d.split("-").reverse().join("/");

  async function baixarPdf() {
    if (!data?.cliente) return;
    setGerando(true);
    try {
      const nomeAg = agrupamento === "mes" ? "Mês" : agrupamento === "semana" ? "Semana" : "Quinzena";
      await exportToPDF(
        `Perfil do Cliente — ${data.cliente.nome}`,
        [nomeAg, "Comandas", "Gelos Saborizados (un)", "Valor"],
        pontos.map((p) => [p.rotulo, p.comandas, p.unidades.toLocaleString("pt-BR"), brl(p.valor)]),
        `perfil-${String(data.cliente.nome).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${ini}-a-${fimEf}`,
        [{ label: "TOTAL DO PERÍODO", value: brl(totalValor) }],
        undefined,
        data.factory ? { factoryName: data.factory.name ?? undefined, factoryLogoUrl: data.factory.logo_url ?? undefined } : undefined,
        [
          { label: "Período", value: `${fmtD(ini)} a ${fmtD(fimEf)}` },
          { label: "Comandas", value: String(filtradas.length) },
          { label: "Gelos Saborizados", value: `${totalUn.toLocaleString("pt-BR")} un` },
          { label: "Bebidas", value: `${totalBebUn.toLocaleString("pt-BR")} un (${brl(totalBebValor)})` },
          { label: "Ticket médio", value: brl(filtradas.length ? totalValor / filtradas.length : 0) },
        ],
        {
          extraTables: [
            { title: "Top 5 Sabores", headers: ["#", "Sabor", "Unidades", "Valor", "%"], rows: top5.map((s, i) => [`${i + 1}º`, s.sabor, s.unidades.toLocaleString("pt-BR"), brl(s.valor), `${s.percentual.toFixed(1)}%`]) },
            ...(bebidasRank.length ? [{ title: "Bebidas", headers: ["Bebida", "Unidades", "Valor"], rows: bebidasRank.map((b) => [b.nome, b.unidades.toLocaleString("pt-BR"), brl(b.valor)]) }] : []),
          ],
        },
      );
    } catch (e) {
      toast.error("Não foi possível gerar o PDF", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setGerando(false);
    }
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>;
  if (error || !data?.cliente) return <p className="text-muted-foreground">Cliente não encontrado.</p>;
  const c = data.cliente;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/painel/clientes")}><ArrowLeft className="h-4 w-4 mr-1" />Clientes</Button>
        <Button size="sm" onClick={baixarPdf} disabled={gerando || filtradas.length === 0}>
          {gerando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}Exportar PDF
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{c.nome}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
              {c.telefone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{c.telefone}</span>}
              {(c.endereco || c.bairro) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[c.endereco, c.bairro, c.cidade].filter(Boolean).join(", ")}</span>}
              {c.possui_freezer && <span className="flex items-center gap-1"><Snowflake className="h-3.5 w-3.5" />{c.freezer_identificacao || "Freezer"}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={c.status === "ativo" ? "default" : "destructive"}>{c.status}</Badge>
            {c.preco_padrao_personalizado && <Badge variant="secondary">{brl(Number(c.preco_padrao_personalizado))}/un</Badge>}
            <Badge variant="outline">Saldo: {brl(Number(c.saldo_devedor_atual ?? 0))}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 grid grid-cols-2 gap-3 md:grid-cols-4 items-end">
          <div><Label>De</Label><Input type="date" value={ini} onChange={(e) => setInicio(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={fimEf} onChange={(e) => setFim(e.target.value)} /></div>
          <Button variant="outline" onClick={() => { setInicio(""); setFim(""); }}>Desde a 1ª venda</Button>
          <Tabs value={agrupamento} onValueChange={(v) => setAgrupamento(v as Agrupamento)}>
            <TabsList className="w-full">
              <TabsTrigger value="semana" className="flex-1">Semana</TabsTrigger>
              <TabsTrigger value="quinzena" className="flex-1">Quinzena</TabsTrigger>
              <TabsTrigger value="mes" className="flex-1">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Faturamento", brl(totalValor)],
          ["Gelos Saborizados", `${totalUn.toLocaleString("pt-BR")} un`],
          ["Bebidas", `${totalBebUn.toLocaleString("pt-BR")} un · ${brl(totalBebValor)}`],
          ["Comandas", String(filtradas.length)],
          ["Ticket médio", brl(filtradas.length ? totalValor / filtradas.length : 0)],
        ].map(([t, v]) => (
          <Card key={t}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t}</p><p className="text-lg font-bold">{v}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Vendas por {agrupamento === "mes" ? "mês" : agrupamento}</CardTitle></CardHeader>
        <CardContent className="h-72">
          {pontos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pontos}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="rotulo" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number, n: string) => (n === "valor" ? brl(v) : `${v} un`)} labelClassName="text-foreground" />
                <Bar dataKey="valor" name="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="unidades" name="unidades" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" />Top 5 Sabores</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {top5.length === 0 && <p className="text-sm text-muted-foreground">Sem sabores no período.</p>}
          {top5.map((s, i) => (
            <div key={s.sabor} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{i + 1}º {s.sabor}</span>
                <span className="text-muted-foreground">{s.unidades.toLocaleString("pt-BR")} un · {brl(s.valor)} · {s.percentual.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${s.percentual}%` }} /></div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wine className="h-4 w-4" />Bebidas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {bebidasRank.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma bebida no período.</p>}
          {bebidasRank.map((b) => (
            <div key={b.nome} className="flex justify-between text-sm border-b border-border pb-1 last:border-0">
              <span className="font-medium">{b.nome}</span>
              <span className="text-muted-foreground">{b.unidades.toLocaleString("pt-BR")} un · {brl(b.valor)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
