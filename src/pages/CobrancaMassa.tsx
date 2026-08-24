import RelatorioFinanceiroCliente from "@/components/relatorios/RelatorioFinanceiroCliente";

export default function CobrancaMassa() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Cobrança em Massa</h1>
      <RelatorioFinanceiroCliente initialTab="cobranca" />
    </div>
  );
}
