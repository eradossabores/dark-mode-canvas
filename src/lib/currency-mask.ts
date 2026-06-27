/**
 * Máscara monetária BRL determinística (sem ambiguidade entre cents/reais).
 * Regra: o usuário digita só dígitos; os 2 últimos são SEMPRE os centavos.
 * Ex.: "5"→R$ 0,05  "55"→R$ 0,55  "552900"→R$ 5.529,00
 * Isso elimina o bug histórico de valores entrarem ×10/×100/×1000.
 */

export function maskBRL(input: string): string {
  const digits = (input || "").replace(/\D/g, "").slice(0, 13);
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const cents = padded.slice(-2);
  const reais = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const reaisFmt = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${reaisFmt},${cents}`;
}

/** Converte string mascarada (ou número) em number reais. */
export function parseBRL(masked: string | number | null | undefined): number {
  if (masked == null || masked === "") return 0;
  if (typeof masked === "number") return masked;
  const digits = masked.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

/** Formata number → "R$ 1.234,56" para popular inputs em edição. */
export function numberToBRL(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "";
  const cents = Math.round(Number(n) * 100);
  return maskBRL(String(cents));
}