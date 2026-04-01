export function normalizeCep(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCep(value: string) {
  return /^\d{8}$/.test(normalizeCep(value));
}

export function formatCep(value: string) {
  const digits = normalizeCep(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}
