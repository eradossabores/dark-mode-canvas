UPDATE public.compras
SET valor_total = ROUND((valor_total/100)::numeric, 2),
    valor_frete = ROUND((valor_frete/1000)::numeric, 2),
    valor_unitario = ROUND((valor_unitario/100)::numeric, 4),
    custo_total_com_frete = ROUND((valor_total/100 + valor_frete/1000)::numeric, 2),
    custo_unitario_com_frete = CASE WHEN quantidade > 0 THEN ROUND(((valor_total/100 + valor_frete/1000)/quantidade)::numeric, 6) ELSE custo_unitario_com_frete END
WHERE id IN (
  'a724076d-0447-493d-9af2-918c609c6208',
  '72472c0e-55b9-4d3a-a07c-559e463331ee',
  'e16dd35a-0b79-465e-b184-e1ee609f3505',
  '65a0e260-ce0e-465e-a173-40716c328f39',
  '17d57045-b1c6-4b6d-95c9-b6480cf0053d',
  '85fc84e7-5364-498b-b00d-54641210f4a0'
);