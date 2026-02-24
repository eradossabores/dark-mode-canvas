import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Search } from "lucide-react";

// Dados da planilha VENDAS - Fevereiro 2026
const SABORES_COLS = ["Melancia","Morango","Maçã verde","Maracujá","Água de coco","Abacaxi c/ hort.","Bob Marley","Limão","Limão c/ sal","Blue ice","Pitaya"];

interface PlanilhaRow {
  data: string; // YYYY-MM-DD
  dataLabel: string;
  cliente: string;
  sabores: Record<string, number>;
  quantidade: number;
  valor: number;
  status: string;
  pagamento: string;
}

function parsePlanilhaDate(d: string): string {
  // Format: M/D/YY -> YYYY-MM-DD
  const parts = d.split("/");
  if (parts.length !== 3) return "";
  const m = parts[0].padStart(2, "0");
  const day = parts[1].padStart(2, "0");
  const y = parts[2].length === 2 ? "20" + parts[2] : parts[2];
  return `${y}-${m}-${day}`;
}

function parseValor(v: string): number {
  if (!v || v === "R$ -" || v === "") return 0;
  // Values are stored in US format from parser: comma=thousand, dot=decimal
  return parseFloat(v.replace("R$", "").replace(/,/g, "").trim()) || 0;
}

// Spreadsheet data hardcoded from parsed document (Janeiro + Fevereiro)
const PLANILHA_RAW: Array<{data:string; cliente:string; sabores:number[]; qtd:number; valor:string; status:string; pagto:string}> = [
  // Janeiro
  {data:"1/21/26",cliente:"CONV GOLD",sabores:[0,0,0,0,0,0,0,0,0,0,0],qtd:200,valor:"R$ 100.00",status:"PAGO",pagto:"PIX"},
  {data:"1/22/26",cliente:"FLUTUAI",sabores:[0,0,0,0,0,0,0,0,0,0,0],qtd:300,valor:"R$ 597.00",status:"PAGO",pagto:"PIX"},
  {data:"1/22/26",cliente:"BOLOTA",sabores:[0,0,0,0,0,0,0,0,0,0,0],qtd:105,valor:"R$ 208.95",status:"PAGO",pagto:"BOLETO"},
  {data:"1/23/26",cliente:"SMOKE",sabores:[0,0,0,0,0,0,0,0,0,0,0],qtd:100,valor:"R$ 195.00",status:"PAGO",pagto:"PIX"},
  {data:"1/24/26",cliente:"AVULSA",sabores:[0,0,0,0,0,0,0,0,0,0,0],qtd:75,valor:"R$ 187.50",status:"PAGO",pagto:"CRÉDITO"},
  {data:"1/26/26",cliente:"PORÃO",sabores:[0,0,0,0,0,0,0,0,0,0,0],qtd:300,valor:"R$ 540.00",status:"PAGO",pagto:""},
  {data:"1/26/26",cliente:"CONV GOLD",sabores:[59,58,58,15,0,10,0,0,0,0,0],qtd:200,valor:"R$ 390.00",status:"PAGO",pagto:"ENTRADA+PARCELA"},
  {data:"1/30/26",cliente:"CONV FROTA",sabores:[0,0,0,0,0,0,0,0,0,0,0],qtd:100,valor:"R$ 200.00",status:"PAGO",pagto:"PIX"},
  {data:"1/31/26",cliente:"PORÃO",sabores:[0,0,0,0,0,0,0,0,0,0,0],qtd:800,valor:"R$ 1,440.00",status:"PARCELADO",pagto:""},
  {data:"1/31/26",cliente:"FLUTUAI",sabores:[0,0,0,0,0,0,0,0,0,0,0],qtd:400,valor:"R$ 358.50",status:"PAGO",pagto:"PIX"},
  // Fevereiro
  {data:"2/1/26",cliente:"SMOKE",sabores:[25,25,20,10,10,10,0,0,0,0,0],qtd:100,valor:"R$ 195.00",status:"PAGO",pagto:"PIX"},
  {data:"2/2/26",cliente:"COPAO DE QUEBRADA",sabores:[6,6,6,6,6,0,0,0,0,0,0],qtd:30,valor:"R$ 67.50",status:"PAGO",pagto:"PIX"},
  {data:"2/3/26",cliente:"SMOKE",sabores:[30,30,20,10,10,0,0,0,0,0,0],qtd:100,valor:"R$ 195.00",status:"PAGO",pagto:"PIX"},
  {data:"2/4/26",cliente:"COPAO DE QUEBRADA",sabores:[8,8,8,8,8,0,0,0,0,0,0],qtd:40,valor:"R$ 90.00",status:"PAGO",pagto:"PIX"},
  {data:"2/6/26",cliente:"MERCADO GD",sabores:[70,70,70,70,70,70,0,0,0,0,0],qtd:420,valor:"R$ 835.80",status:"PAGO",pagto:"ESPÉCIE"},
  {data:"2/6/26",cliente:"GUAKA-GUAKA",sabores:[20,20,30,30,0,0,0,0,0,0,0],qtd:100,valor:"R$ 199.00",status:"PAGO",pagto:"PIX"},
  {data:"2/6/26",cliente:"SMOKE",sabores:[20,20,20,20,20,0,0,0,0,0,0],qtd:100,valor:"R$ 195.00",status:"PAGO",pagto:"PIX"},
  {data:"2/6/26",cliente:"AMOSTRAS",sabores:[1,1,1,1,1,1,1,0,0,0,0],qtd:7,valor:"R$ -",status:"",pagto:""},
  {data:"2/7/26",cliente:"SMOKE",sabores:[20,20,20,20,20,0,0,0,0,0,0],qtd:100,valor:"R$ 195.00",status:"PAGO",pagto:"PIX"},
  {data:"2/7/26",cliente:"CELEIRO",sabores:[0,0,60,90,0,0,0,0,0,0,0],qtd:150,valor:"R$ 292.50",status:"PAGO",pagto:"PIX"},
  {data:"2/7/26",cliente:"FLUTUAI",sabores:[200,100,100,0,0,0,0,0,0,0,0],qtd:400,valor:"R$ 780.00",status:"PAGO",pagto:"PIX"},
  {data:"2/7/26",cliente:"VILE CLUB",sabores:[88,87,88,87,50,0,0,0,0,0,0],qtd:400,valor:"R$ 796.00",status:"PAGO",pagto:"PIX"},
  {data:"2/7/26",cliente:"SMOKE",sabores:[40,40,40,40,40,0,0,0,0,0,0],qtd:200,valor:"R$ 390.00",status:"PAGO",pagto:"PIX"},
  {data:"2/7/26",cliente:"COPAO DE QUEBRADA",sabores:[10,0,10,0,0,0,0,0,0,0,0],qtd:20,valor:"R$ 45.00",status:"PAGO",pagto:"PIX"},
  {data:"2/7/26",cliente:"ADEGA GRECIA",sabores:[30,30,30,30,30,0,0,0,0,0,0],qtd:150,valor:"R$ 298.50",status:"PAGO",pagto:"PIX"},
  {data:"2/9/26",cliente:"MARLON BARBER",sabores:[10,0,10,10,0,0,0,0,0,0,0],qtd:30,valor:"R$ 75.00",status:"PAGO",pagto:"PIX"},
  {data:"2/9/26",cliente:"BOLOTA",sabores:[30,0,30,30,30,30,0,0,0,0,0],qtd:150,valor:"R$ 298.50",status:"PENDENTE",pagto:""},
  {data:"2/10/26",cliente:"SMOKE",sabores:[30,0,0,0,0,20,0,0,0,0,0],qtd:50,valor:"R$ 97.50",status:"PAGO",pagto:"PIX"},
  {data:"2/11/26",cliente:"COPAO DE QUEBRADA",sabores:[10,10,10,10,10,10,0,0,0,0,0],qtd:60,valor:"R$ 135.00",status:"PAGO",pagto:"PIX"},
  {data:"2/11/26",cliente:"STEM",sabores:[100,100,100,50,50,0,50,0,0,0,0],qtd:450,valor:"R$ 832.50",status:"PAGO",pagto:"BOLETO"},
  {data:"2/11/26",cliente:"SMOKE",sabores:[20,20,20,20,20,0,0,0,0,0,0],qtd:100,valor:"R$ 195.00",status:"PAGO",pagto:"PIX"},
  {data:"2/12/26",cliente:"SMOKE",sabores:[20,20,20,20,20,0,0,0,0,0,0],qtd:100,valor:"R$ 195.00",status:"PAGO",pagto:"PIX"},
  {data:"2/12/26",cliente:"BRETS",sabores:[60,60,60,60,60,0,0,0,0,0,0],qtd:300,valor:"R$ 597.00",status:"FIADO",pagto:"FIADO"},
  {data:"2/13/26",cliente:"PORÃO",sabores:[175,175,175,175,0,0,0,0,0,0,0],qtd:700,valor:"R$ 1,260.00",status:"PENDENTE",pagto:""},
  {data:"2/13/26",cliente:"MARLON BARBER",sabores:[10,0,10,10,0,0,0,0,0,0,0],qtd:30,valor:"R$ 75.00",status:"PAGO",pagto:"PIX"},
  {data:"2/13/26",cliente:"THONNY",sabores:[0,8,8,7,0,0,7,0,0,0,0],qtd:30,valor:"R$ 82.00",status:"PAGO",pagto:"PIX"},
  {data:"2/13/26",cliente:"AVULSO",sabores:[10,10,10,10,10,0,0,0,0,0,0],qtd:50,valor:"R$ 99.50",status:"PAGO",pagto:"PIX"},
  {data:"2/13/26",cliente:"SMOKE",sabores:[0,25,25,25,25,0,0,0,0,0,0],qtd:100,valor:"R$ 195.00",status:"PAGO",pagto:""},
  {data:"2/13/26",cliente:"ADEGA GRECIA",sabores:[50,50,50,50,50,0,0,0,0,0,0],qtd:250,valor:"R$ 497.50",status:"PAGO",pagto:"PIX"},
  {data:"2/13/26",cliente:"AVULSO",sabores:[2,1,1,0,0,1,0,0,0,0,0],qtd:5,valor:"R$ 66.00",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"AVULSO",sabores:[35,35,35,25,20,0,0,0,0,0,0],qtd:150,valor:"R$ 292.50",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"FLUTUAI",sabores:[0,200,100,0,0,0,0,0,0,0,0],qtd:300,valor:"R$ 597.00",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"COPAO DE QUEBRADA",sabores:[0,10,10,10,0,0,0,0,0,0,0],qtd:30,valor:"R$ 67.50",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"ADEGA GRECIA",sabores:[50,50,50,50,50,0,0,0,0,0,0],qtd:250,valor:"R$ 497.50",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"AVULSO",sabores:[3,10,4,0,0,3,0,0,0,0,0],qtd:20,valor:"R$ 39.80",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"COMBO",sabores:[6,2,0,1,2,0,0,0,0,0,0],qtd:11,valor:"R$ 165.00",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"AVULSO",sabores:[2,0,2,2,0,4,0,0,0,0,0],qtd:10,valor:"R$ 49.90",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"COMBO",sabores:[0,1,0,1,0,0,0,0,0,0,0],qtd:2,valor:"R$ 3.98",status:"PAGO",pagto:""},
  {data:"2/14/26",cliente:"AVULSO",sabores:[11,11,9,9,0,0,0,0,0,0,0],qtd:40,valor:"R$ 79.80",status:"PAGO",pagto:""},
  {data:"2/14/26",cliente:"AVULSO",sabores:[1,1,0,1,0,0,0,0,0,0,0],qtd:3,valor:"R$ 15.00",status:"PAGO",pagto:""},
  {data:"2/14/26",cliente:"PORÃO",sabores:[217,175,133,175,0,0,0,0,0,0,0],qtd:700,valor:"R$ 1,260.00",status:"",pagto:""},
  {data:"2/14/26",cliente:"COMBO",sabores:[5,6,0,2,4,0,0,0,0,0,0],qtd:17,valor:"R$ 185.00",status:"PAGO",pagto:"ESPÉCIE"},
  {data:"2/14/26",cliente:"COMBO",sabores:[1,1,1,1,0,0,0,0,0,0,0],qtd:4,valor:"R$ 75.00",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"AVULSO",sabores:[8,8,7,7,0,0,0,0,0,0,0],qtd:30,valor:"R$ 75.00",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"COPAO DE QUEBRADA",sabores:[10,0,10,10,0,0,0,0,0,0,0],qtd:30,valor:"R$ 67.50",status:"PAGO",pagto:"PIX"},
  {data:"2/14/26",cliente:"COMBO",sabores:[0,0,4,0,0,0,0,0,0,0,0],qtd:4,valor:"R$ 7.96",status:"PAGO",pagto:""},
  {data:"2/14/26",cliente:"COMBO",sabores:[4,0,1,3,0,0,0,0,0,0,0],qtd:8,valor:"R$ 88.00",status:"PAGO",pagto:"ESPÉCIE"},
  {data:"2/15/26",cliente:"SMOKE",sabores:[250,241,231,84,100,0,0,0,0,0,0],qtd:906,valor:"R$ 1,766.70",status:"PARCELADO",pagto:""},
  {data:"2/15/26",cliente:"VILE CLUB",sabores:[68,58,56,58,20,0,10,0,0,0,0],qtd:270,valor:"R$ 537.30",status:"PAGO",pagto:""},
  {data:"2/16/26",cliente:"PORÃO",sabores:[100,100,100,0,0,0,0,0,0,0,0],qtd:300,valor:"R$ 540.00",status:"PENDENTE",pagto:""},
  {data:"2/16/26",cliente:"COMBO",sabores:[0,0,0,0,0,2,2,0,0,0,0],qtd:4,valor:"R$ 55.00",status:"PAGO",pagto:""},
  {data:"2/16/26",cliente:"AVULSO",sabores:[10,10,0,0,0,0,10,0,0,0,0],qtd:30,valor:"R$ 75.00",status:"PAGO",pagto:""},
  {data:"2/16/26",cliente:"AMOSTRAS",sabores:[1,1,1,0,0,1,1,0,0,0,0],qtd:5,valor:"R$ -",status:"",pagto:""},
  {data:"2/16/26",cliente:"AVULSO",sabores:[10,10,0,0,0,10,0,0,0,0,0],qtd:30,valor:"R$ 75.00",status:"PAGO",pagto:"PIX"},
  {data:"2/16/26",cliente:"COMBO",sabores:[0,2,0,0,0,2,0,0,0,0,0],qtd:4,valor:"R$ 55.00",status:"PAGO",pagto:"ESPÉCIE"},
  {data:"2/16/26",cliente:"COMBO",sabores:[0,2,2,0,0,0,0,0,0,0,0],qtd:4,valor:"R$ 55.00",status:"PAGO",pagto:""},
  {data:"2/16/26",cliente:"COMBO",sabores:[2,0,0,0,0,0,2,0,0,0,0],qtd:4,valor:"R$ 55.00",status:"PAGO",pagto:""},
  {data:"2/16/26",cliente:"COMBO",sabores:[0,4,0,0,0,0,0,0,0,0,0],qtd:4,valor:"R$ 7.96",status:"PAGO",pagto:""},
  {data:"2/16/26",cliente:"COMBO",sabores:[0,2,2,0,0,0,2,0,0,0,0],qtd:6,valor:"R$ 60.00",status:"PAGO",pagto:"PIXESPECIE"},
  {data:"2/17/26",cliente:"COMBO",sabores:[2,0,0,0,0,0,0,0,0,0,0],qtd:2,valor:"R$ 25.00",status:"PAGO",pagto:"PIX"},
  {data:"2/17/26",cliente:"BRETS",sabores:[30,30,30,30,30,0,0,0,0,0,0],qtd:150,valor:"R$ 298.50",status:"FIADO",pagto:""},
  {data:"2/17/26",cliente:"AVULSO",sabores:[5,5,3,4,0,3,0,0,0,0,0],qtd:20,valor:"R$ 39.80",status:"PAGO",pagto:""},
  {data:"2/17/26",cliente:"VILE CLUB",sabores:[66,67,67,0,0,0,0,0,0,0,0],qtd:200,valor:"R$ 398.00",status:"PENDENTE",pagto:""},
  {data:"2/17/26",cliente:"COMBO",sabores:[2,2,2,2,1,1,0,0,0,0,0],qtd:10,valor:"R$ 73.00",status:"PAGO",pagto:""},
  {data:"2/20/26",cliente:"BOLOTA",sabores:[60,60,60,60,30,40,0,0,0,0,0],qtd:310,valor:"R$ 616.90",status:"",pagto:""},
  {data:"2/21/26",cliente:"FLUTUAI",sabores:[100,0,0,0,0,0,0,0,0,0,0],qtd:100,valor:"R$ 199.00",status:"",pagto:""},
  {data:"2/21/26",cliente:"VILE CLUB",sabores:[75,0,75,0,0,0,0,0,0,0,0],qtd:150,valor:"R$ 298.50",status:"",pagto:""},
  {data:"2/24/26",cliente:"CONV OLD",sabores:[20,20,20,20,20,0,0,0,0,0,0],qtd:100,valor:"R$ 199.00",status:"PAGO",pagto:""},
];

const planilhaData: PlanilhaRow[] = PLANILHA_RAW.map((r) => {
  const sabs: Record<string, number> = {};
  SABORES_COLS.forEach((s, i) => { if (r.sabores[i]) sabs[s] = r.sabores[i]; });
  return {
    data: parsePlanilhaDate(r.data),
    dataLabel: r.data,
    cliente: r.cliente,
    sabores: sabs,
    quantidade: r.qtd,
    valor: parseValor(r.valor),
    status: r.status,
    pagamento: r.pagto,
  };
});

// Normalize client name for matching
function normCliente(n: string): string {
  return n.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normSabor(n: string): string {
  return n.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

// Map sabor names between spreadsheet and DB
const SABOR_MAP: Record<string, string[]> = {
  "melancia": ["melancia"],
  "morango": ["morango"],
  "maca verde": ["maca verde", "maça verde", "maçã verde"],
  "maracuja": ["maracuja", "maracujá"],
  "agua de coco": ["agua de coco", "água de coco"],
  "abacaxi c/ hort.": ["abacaxi c/ hort.", "abacaxi c/ hortelã", "abacaxi com hortelã", "abacaxi c/ hort"],
  "bob marley": ["bob marley"],
  "limao": ["limao", "limão"],
  "limao c/ sal": ["limao c/ sal", "limão c/ sal", "limão com sal", "limao com sal"],
  "blue ice": ["blue ice"],
  "pitaya": ["pitaya"],
};

function matchSabor(planilhaSabor: string, dbSabor: string): boolean {
  const pn = normSabor(planilhaSabor);
  const dn = normSabor(dbSabor);
  for (const [, aliases] of Object.entries(SABOR_MAP)) {
    if (aliases.some(a => normSabor(a) === pn) && aliases.some(a => normSabor(a) === dn)) return true;
  }
  return pn === dn;
}

interface DbVenda {
  id: string;
  created_at: string;
  cliente_nome: string;
  total: number;
  status: string;
  forma_pagamento: string;
  itens: { sabor_nome: string; quantidade: number; subtotal: number }[];
  totalQtd: number;
}

interface CompareResult {
  idx: number;
  planilha: PlanilhaRow;
  dbMatch: DbVenda | null;
  issues: string[];
  ok: boolean;
}

export default function VerificacaoVendas() {
  const [loading, setLoading] = useState(true);
  const [dbVendas, setDbVendas] = useState<DbVenda[]>([]);
  const [results, setResults] = useState<CompareResult[]>([]);

  useEffect(() => { loadAndCompare(); }, []);

  async function loadAndCompare() {
    setLoading(true);
    try {
      // Buscar TODAS as vendas (sem filtro de mês)
      const [vendasRes, itensRes] = await Promise.all([
        (supabase as any).from("vendas").select("*, clientes(nome)")
          .order("created_at", { ascending: true }),
        (supabase as any).from("venda_itens").select("*, sabores(nome)"),
      ]);

      const vendas = vendasRes.data || [];
      const itens = itensRes.data || [];

      // Build DB vendas with items
      const vendaIds = new Set(vendas.map((v: any) => v.id));
      const itensMap: Record<string, typeof itens> = {};
      itens.forEach((i: any) => {
        if (!vendaIds.has(i.venda_id)) return;
        if (!itensMap[i.venda_id]) itensMap[i.venda_id] = [];
        itensMap[i.venda_id].push(i);
      });

      const dbList: DbVenda[] = vendas.map((v: any) => {
        const vitens = (itensMap[v.id] || []).map((i: any) => ({
          sabor_nome: i.sabores?.nome || "?",
          quantidade: i.quantidade,
          subtotal: Number(i.subtotal),
        }));
        return {
          id: v.id,
          created_at: v.created_at,
          cliente_nome: v.clientes?.nome || "?",
          total: Number(v.total),
          status: v.status,
          forma_pagamento: v.forma_pagamento,
          itens: vitens,
          totalQtd: vitens.reduce((s: number, i: any) => s + i.quantidade, 0),
        };
      });

      setDbVendas(dbList);

      // Match each planilha row to a DB venda
      const usedDbIds = new Set<string>();
      const compareResults: CompareResult[] = [];

      for (let idx = 0; idx < planilhaData.length; idx++) {
        const p = planilhaData[idx];
        const pDate = p.data; // YYYY-MM-DD

        // Find matching DB venda: same date + similar client name + not yet used
        const candidates = dbList.filter((d) => {
          if (usedDbIds.has(d.id)) return false;
          const dDate = d.created_at.substring(0, 10);
          if (dDate !== pDate) return false;
          return normCliente(d.cliente_nome).includes(normCliente(p.cliente)) ||
                 normCliente(p.cliente).includes(normCliente(d.cliente_nome));
        });

        // Try to match by quantity too if multiple candidates
        let match: DbVenda | null = null;
        if (candidates.length === 1) {
          match = candidates[0];
        } else if (candidates.length > 1) {
          // Prefer exact quantity match
          match = candidates.find(c => c.totalQtd === p.quantidade) || candidates[0];
        }

        const issues: string[] = [];

        if (!match) {
          issues.push("❌ Venda NÃO encontrada no banco");
        } else {
          usedDbIds.add(match.id);

          // Check total quantity
          if (match.totalQtd !== p.quantidade) {
            issues.push(`Qtd total: planilha=${p.quantidade}, banco=${match.totalQtd}`);
          }

          // Check value
          if (Math.abs(match.total - p.valor) > 0.05 && p.valor > 0) {
            issues.push(`Valor: planilha=R$${p.valor.toFixed(2)}, banco=R$${match.total.toFixed(2)}`);
          }

          // Check sabores (only planilha sabores that have qty > 0)
          for (const [sabor, qtd] of Object.entries(p.sabores)) {
            if (qtd <= 0) continue;
            const dbItem = match.itens.find(i => matchSabor(sabor, i.sabor_nome));
            if (!dbItem) {
              issues.push(`Sabor "${sabor}" (${qtd}un) não encontrado no banco`);
            } else if (dbItem.quantidade !== qtd) {
              issues.push(`${sabor}: planilha=${qtd}, banco=${dbItem.quantidade}`);
            }
          }
        }

        compareResults.push({
          idx,
          planilha: p,
          dbMatch: match,
          issues,
          ok: issues.length === 0,
        });
      }

      setResults(compareResults);

      // Check for DB vendas not matched to planilha
      const unmatchedDb = dbList.filter(d => !usedDbIds.has(d.id));
      if (unmatchedDb.length > 0) {
        unmatchedDb.forEach(d => {
          compareResults.push({
            idx: -1,
            planilha: { data: "", dataLabel: "", cliente: "", sabores: {}, quantidade: 0, valor: 0, status: "", pagamento: "" },
            dbMatch: d,
            issues: [`⚠️ Venda no banco SEM correspondência na planilha: ${d.cliente_nome} (${d.created_at.substring(0,10)}, ${d.totalQtd}un, R$${d.total.toFixed(2)})`],
            ok: false,
          });
        });
      }

      setResults(compareResults);
    } catch (e: any) {
      console.error("Erro na verificação:", e);
    } finally {
      setLoading(false);
    }
  }

  const totalOk = results.filter(r => r.ok).length;
  const totalIssues = results.filter(r => !r.ok).length;
  const totalPlanilha = planilhaData.length;

  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Search className="h-6 w-6 text-primary" />
        Verificação Total de Vendas — Planilha vs Banco
      </h1>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Carregando e comparando dados...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Linhas Planilha</p>
                <p className="text-2xl font-bold">{totalPlanilha}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Vendas no Banco (Total)</p>
                <p className="text-2xl font-bold">{dbVendas.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">OK</p>
                <p className="text-2xl font-bold text-green-600">{totalOk}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Divergências</p>
                <p className="text-2xl font-bold text-red-600">{totalIssues}</p>
              </CardContent>
            </Card>
          </div>

          {/* Summary by client */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-sm">Resumo por Cliente</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Qtd Planilha</TableHead>
                    <TableHead className="text-right">Qtd Banco</TableHead>
                    <TableHead className="text-right">R$ Planilha</TableHead>
                    <TableHead className="text-right">R$ Banco</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const clientMap: Record<string, { qtdP: number; valP: number; qtdD: number; valD: number }> = {};
                    results.forEach(r => {
                      const nome = r.planilha.cliente || r.dbMatch?.cliente_nome || "?";
                      if (!clientMap[nome]) clientMap[nome] = { qtdP: 0, valP: 0, qtdD: 0, valD: 0 };
                      clientMap[nome].qtdP += r.planilha.quantidade;
                      clientMap[nome].valP += r.planilha.valor;
                      if (r.dbMatch) {
                        clientMap[nome].qtdD += r.dbMatch.totalQtd;
                        clientMap[nome].valD += r.dbMatch.total;
                      }
                    });
                    return Object.entries(clientMap)
                      .sort((a, b) => b[1].qtdP - a[1].qtdP)
                      .map(([nome, v]) => {
                        const qtdOk = v.qtdP === v.qtdD;
                        const valOk = Math.abs(v.valP - v.valD) < 0.05;
                        return (
                          <TableRow key={nome}>
                            <TableCell className="font-medium">{nome}</TableCell>
                            <TableCell className="text-right">{v.qtdP}</TableCell>
                            <TableCell className={`text-right font-bold ${qtdOk ? "" : "text-red-600"}`}>{v.qtdD}</TableCell>
                            <TableCell className="text-right">R$ {v.valP.toFixed(2)}</TableCell>
                            <TableCell className={`text-right font-bold ${valOk ? "" : "text-red-600"}`}>R$ {v.valD.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              {qtdOk && valOk ? <CheckCircle className="h-4 w-4 text-green-600 mx-auto" /> : <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />}
                            </TableCell>
                          </TableRow>
                        );
                      });
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Detailed line-by-line comparison */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Comparação Linha a Linha</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Qtd Plan.</TableHead>
                    <TableHead className="text-right">Qtd Banco</TableHead>
                    <TableHead className="text-right">R$ Plan.</TableHead>
                    <TableHead className="text-right">R$ Banco</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Divergências</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i} className={r.ok ? "" : "bg-red-50 dark:bg-red-950/20"}>
                      <TableCell className="text-xs">{r.idx >= 0 ? r.idx + 1 : "—"}</TableCell>
                      <TableCell className="text-sm">{r.idx >= 0 ? r.planilha.dataLabel : r.dbMatch?.created_at.substring(0, 10)}</TableCell>
                      <TableCell className="text-sm font-medium">{r.idx >= 0 ? r.planilha.cliente : r.dbMatch?.cliente_nome}</TableCell>
                      <TableCell className="text-right">{r.idx >= 0 ? r.planilha.quantidade : ""}</TableCell>
                      <TableCell className={`text-right font-bold ${r.dbMatch && r.idx >= 0 && r.dbMatch.totalQtd !== r.planilha.quantidade ? "text-red-600" : ""}`}>
                        {r.dbMatch?.totalQtd ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">{r.idx >= 0 && r.planilha.valor > 0 ? `R$ ${r.planilha.valor.toFixed(2)}` : ""}</TableCell>
                      <TableCell className={`text-right font-bold ${r.dbMatch && r.idx >= 0 && r.planilha.valor > 0 && Math.abs(r.dbMatch.total - r.planilha.valor) > 0.05 ? "text-red-600" : ""}`}>
                        {r.dbMatch ? `R$ ${r.dbMatch.total.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        {r.ok ? (
                          <Badge variant="default" className="bg-green-600 text-xs">OK</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">DIVERGE</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[300px]">
                        {r.issues.map((iss, j) => (
                          <div key={j} className="text-red-600">{iss}</div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
