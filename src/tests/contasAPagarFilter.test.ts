import { describe, it, expect } from 'vitest';
import { startOfMonth, addMonths } from 'date-fns';

// Mock simple version of the filtering logic from ContasAPagar.tsx
function shouldShowConta(c: any, targetMonth: number, targetYear: number, ultimosPagamentos: Record<string, string>) {
  const targetDate = new Date(targetYear, targetMonth, 1);
  const created = new Date(c.created_at || "");
  const start = startOfMonth(created);

  // General logic: if a bill was finished (paid in full) before the target month, hide it
  if (c.valor_restante <= 0 || (c.total_parcelas > 0 && c.parcela_atual >= c.total_parcelas)) {
    const lastPayment = ultimosPagamentos[c.id];
    if (lastPayment) {
      const lastPaymentDate = new Date(lastPayment.split(' ')[0] + "T12:00:00");
      const finalizedMonth = startOfMonth(lastPaymentDate);
      if (targetDate > finalizedMonth) return false;
    } else {
      // If no history but progress is 100%, remove from future flow
      return false;
    }
  }

  const monthsElapsed = (targetDate.getFullYear() - start.getFullYear()) * 12 + (targetDate.getMonth() - start.getMonth());
  return monthsElapsed >= 0 && monthsElapsed < (c.total_parcelas || 1);
}

describe('Contas a Pagar Filtering Logic', () => {
  const ultimosPagamentos = {
    'conta-finalizada-maio': '2026-05-22 17:03:39',
  };

  it('should NOT show a bill finished in May when filtering for July 2026', () => {
    const conta = {
      id: 'conta-finalizada-maio',
      descricao: 'ESSENCIA',
      valor_restante: 0,
      parcela_atual: 12,
      total_parcelas: 12,
      created_at: '2025-06-01T12:00:00Z',
      tipo: 'parcelado'
    };

    const result = shouldShowConta(conta, 6, 2026, ultimosPagamentos); // 6 = July
    expect(result).toBe(false);
  });

  it('should NOT show a bill finished in May when filtering for August 2026', () => {
    const conta = {
      id: 'conta-finalizada-maio',
      descricao: 'ESSENCIA',
      valor_restante: 0,
      parcela_atual: 12,
      total_parcelas: 12,
      created_at: '2025-06-01T12:00:00Z',
      tipo: 'parcelado'
    };

    const result = shouldShowConta(conta, 7, 2026, ultimosPagamentos); // 7 = August
    expect(result).toBe(false);
  });

  it('should show an active bill (Freezer 04) in July 2026 if it is not finished', () => {
    const conta = {
      id: 'freezer-04',
      descricao: 'FREEZER 04',
      valor_restante: 3324.30,
      parcela_atual: 3,
      total_parcelas: 10,
      created_at: '2026-04-01T12:00:00Z',
      tipo: 'parcelado'
    };

    // For Freezer 04 created in April, 10 installments go until January 2027
    const result = shouldShowConta(conta, 6, 2026, {}); // 6 = July
    expect(result).toBe(true);
  });

  it('should NOT show a bill that reached 100% progress even without payment history recorded', () => {
    const conta = {
      id: 'conta-sem-historico-mas-100-pct',
      descricao: 'TESTE',
      valor_restante: 0,
      parcela_atual: 5,
      total_parcelas: 5,
      created_at: '2026-01-01T12:00:00Z',
      tipo: 'parcelado'
    };

    const result = shouldShowConta(conta, 6, 2026, {}); // 6 = July
    expect(result).toBe(false);
  });
});
