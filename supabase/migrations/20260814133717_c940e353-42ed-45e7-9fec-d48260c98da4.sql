UPDATE public.vendas v SET valor_original = v.total
WHERE v.status <> 'cancelada'
  AND v.valor_original IS NOT NULL
  AND v.valor_original > v.total
  AND ABS(v.valor_original - v.total) < 0.05;