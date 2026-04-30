import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Warehouse } from "lucide-react";

export default function EstoqueDisponivel() {
  const [linhas, setLinhas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: estoques } = await (supabase as any)
      .from("estoque_gelos").select("sabor_id, quantidade");
    const { data: sabores } = await (supabase as any)
      .from("sabores").select("id, nome, ativo").eq("ativo", true);

    const merged = (sabores || []).map((s: any) => {
      const e = (estoques || []).find((x: any) => x.sabor_id === s.id);
      return { id: s.id, nome: s.nome, quantidade: e?.quantidade ?? 0 };
    }).sort((a: any, b: any) => b.quantidade - a.quantidade);
    setLinhas(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = (supabase as any)
      .channel("estoque-vendedor")
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque_gelos" }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, []);

  const SABOR_COLORS: Record<string, string> = {
    melancia: "bg-red-500/90 text-white border-red-600",
    morango: "bg-pink-500/90 text-white border-pink-600",
    "maçã verde": "bg-green-500/90 text-white border-green-600",
    maracujá: "bg-yellow-500/90 text-white border-yellow-600",
    "água de coco": "bg-cyan-500/90 text-white border-cyan-600",
    "abacaxi com hortelã": "bg-emerald-500/90 text-white border-emerald-600",
    "bob marley": "bg-amber-500/90 text-white border-amber-600",
    limão: "bg-lime-500/90 text-white border-lime-600",
    "limão com sal": "bg-lime-600/90 text-white border-lime-700",
    pitaya: "bg-fuchsia-500/90 text-white border-fuchsia-600",
    "blue ice": "bg-blue-500/90 text-white border-blue-600",
  };
  const getSaborColor = (nome: string) => {
    const key = nome?.toLowerCase() || "";
    return SABOR_COLORS[key] || "bg-muted text-foreground border-border";
  };
  const totalGelos = linhas.reduce((s, l) => s + (l.quantidade || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Warehouse className="h-6 w-6" /> Estoque Disponível</h1>
        <p className="text-sm text-muted-foreground">Visão em tempo real (somente leitura).</p>
      </div>

      {/* Painel colorido de gelos por sabor */}
      {!loading && linhas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground font-medium">Gelos por Sabor</p>
            <Badge variant="secondary" className="text-xs font-bold">Total: {totalGelos.toLocaleString()} un.</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {linhas.map((l) => (
              <div
                key={l.id}
                className={`rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] ${getSaborColor(l.nome)}`}
              >
                <p className="text-[11px] font-semibold truncate">{l.nome}</p>
                <p className="text-lg font-extrabold mt-0.5">{(l.quantidade || 0).toLocaleString()}</p>
              </div>
            ))}
            <div className="rounded-lg border px-3 py-2.5 text-center transition-all hover:scale-[1.03] bg-gray-700/90 text-white border-gray-800">
              <p className="text-[11px] font-semibold truncate">TOTAL</p>
              <p className="text-lg font-extrabold mt-0.5">{totalGelos.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="text-muted-foreground text-sm">Carregando...</p>}
    </div>
  );
}