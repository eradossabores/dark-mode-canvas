
-- ============================================================
-- SECURITY FIX: Replace all allow_all RLS policies with
-- factory_id scoped policies for multi-tenant isolation
-- ============================================================

-- Helper: drop policy if exists (safe wrapper)
-- We'll drop and recreate for each table

-- 1. VENDAS
DROP POLICY IF EXISTS "allow_all" ON public.vendas;
CREATE POLICY "Factory users can manage vendas" ON public.vendas
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 2. VENDA_ITENS
DROP POLICY IF EXISTS "allow_all" ON public.venda_itens;
CREATE POLICY "Factory users can manage venda_itens" ON public.venda_itens
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 3. VENDA_PARCELAS
DROP POLICY IF EXISTS "allow_all" ON public.venda_parcelas;
CREATE POLICY "Factory users can manage venda_parcelas" ON public.venda_parcelas
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 4. CLIENTES
DROP POLICY IF EXISTS "allow_all" ON public.clientes;
CREATE POLICY "Factory users can manage clientes" ON public.clientes
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 5. CLIENTE_PRECO_SABOR
DROP POLICY IF EXISTS "allow_all" ON public.cliente_preco_sabor;
CREATE POLICY "Factory users can manage cliente_preco_sabor" ON public.cliente_preco_sabor
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 6. CLIENTE_TABELA_PRECO
DROP POLICY IF EXISTS "allow_all" ON public.cliente_tabela_preco;
CREATE POLICY "Factory users can manage cliente_tabela_preco" ON public.cliente_tabela_preco
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 7. ESTOQUE_GELOS
DROP POLICY IF EXISTS "allow_all" ON public.estoque_gelos;
CREATE POLICY "Factory users can manage estoque_gelos" ON public.estoque_gelos
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 8. ESTOQUE_SACOS
DROP POLICY IF EXISTS "allow_all_estoque_sacos" ON public.estoque_sacos;
CREATE POLICY "Factory users can manage estoque_sacos" ON public.estoque_sacos
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 9. ESTOQUE_FREEZER
DROP POLICY IF EXISTS "allow_all" ON public.estoque_freezer;
CREATE POLICY "Factory users can manage estoque_freezer" ON public.estoque_freezer
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 10. SABORES
DROP POLICY IF EXISTS "allow_all" ON public.sabores;
CREATE POLICY "Factory users can manage sabores" ON public.sabores
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 11. SABOR_RECEITA
DROP POLICY IF EXISTS "allow_all" ON public.sabor_receita;
CREATE POLICY "Factory users can manage sabor_receita" ON public.sabor_receita
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 12. PRODUCOES
DROP POLICY IF EXISTS "allow_all" ON public.producoes;
CREATE POLICY "Factory users can manage producoes" ON public.producoes
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 13. PRODUCAO_FUNCIONARIOS
DROP POLICY IF EXISTS "allow_all" ON public.producao_funcionarios;
CREATE POLICY "Factory users can manage producao_funcionarios" ON public.producao_funcionarios
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 14. DECISOES_PRODUCAO
DROP POLICY IF EXISTS "allow_all_decisoes" ON public.decisoes_producao;
CREATE POLICY "Factory users can manage decisoes_producao" ON public.decisoes_producao
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 15. MATERIAS_PRIMAS
DROP POLICY IF EXISTS "allow_all" ON public.materias_primas;
CREATE POLICY "Factory users can manage materias_primas" ON public.materias_primas
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 16. EMBALAGENS
DROP POLICY IF EXISTS "allow_all" ON public.embalagens;
CREATE POLICY "Factory users can manage embalagens" ON public.embalagens
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 17. MOVIMENTACOES_ESTOQUE
DROP POLICY IF EXISTS "allow_all" ON public.movimentacoes_estoque;
CREATE POLICY "Factory users can manage movimentacoes_estoque" ON public.movimentacoes_estoque
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 18. AVARIAS
DROP POLICY IF EXISTS "allow_all_avarias" ON public.avarias;
CREATE POLICY "Factory users can manage avarias" ON public.avarias
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 19. AUDITORIA
DROP POLICY IF EXISTS "allow_all" ON public.auditoria;
CREATE POLICY "Factory users can manage auditoria" ON public.auditoria
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 20. FUNCIONARIOS
DROP POLICY IF EXISTS "allow_all" ON public.funcionarios;
CREATE POLICY "Factory users can manage funcionarios" ON public.funcionarios
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 21. FOLLOWUP_MENSAGENS
DROP POLICY IF EXISTS "allow_all" ON public.followup_mensagens;
CREATE POLICY "Factory users can manage followup_mensagens" ON public.followup_mensagens
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 22. FACTORY_PRICING_TIERS
DROP POLICY IF EXISTS "allow_all" ON public.factory_pricing_tiers;
CREATE POLICY "Factory users can manage factory_pricing_tiers" ON public.factory_pricing_tiers
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 23. ABATIMENTOS_HISTORICO
DROP POLICY IF EXISTS "allow_all" ON public.abatimentos_historico;
CREATE POLICY "Factory users can manage abatimentos_historico" ON public.abatimentos_historico
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 24. PEDIDOS_PRODUCAO
DROP POLICY IF EXISTS "Allow all access to pedidos_producao" ON public.pedidos_producao;
CREATE POLICY "Factory users can manage pedidos_producao" ON public.pedidos_producao
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 25. PEDIDO_PRODUCAO_ITENS
DROP POLICY IF EXISTS "Allow all access to pedido_producao_itens" ON public.pedido_producao_itens;
CREATE POLICY "Factory users can manage pedido_producao_itens" ON public.pedido_producao_itens
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 26. PRESENCA_PRODUCAO (was already authenticated but no factory filter)
DROP POLICY IF EXISTS "Authenticated full access presenca" ON public.presenca_producao;
CREATE POLICY "Factory users can manage presenca_producao" ON public.presenca_producao
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 27. CONTAS_A_PAGAR (was authenticated but no factory filter)
DROP POLICY IF EXISTS "Authenticated users full access" ON public.contas_a_pagar;
CREATE POLICY "Factory users can manage contas_a_pagar" ON public.contas_a_pagar
  FOR ALL TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 28. PEDIDOS_PUBLICOS - needs public INSERT but factory-scoped read/update/delete
DROP POLICY IF EXISTS "Public can insert orders" ON public.pedidos_publicos;
DROP POLICY IF EXISTS "Authenticated can read orders" ON public.pedidos_publicos;
DROP POLICY IF EXISTS "Authenticated can update orders" ON public.pedidos_publicos;
DROP POLICY IF EXISTS "Authenticated can delete orders" ON public.pedidos_publicos;

CREATE POLICY "Public can insert orders" ON public.pedidos_publicos
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Factory users can read pedidos_publicos" ON public.pedidos_publicos
  FOR SELECT TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Factory users can update pedidos_publicos" ON public.pedidos_publicos
  FOR UPDATE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Factory users can delete pedidos_publicos" ON public.pedidos_publicos
  FOR DELETE TO authenticated
  USING (factory_id = get_user_factory_id(auth.uid()) OR is_super_admin(auth.uid()));

-- 29. FACTORIES - add UPDATE for factory owners
CREATE POLICY "Factory owners can update own factory" ON public.factories
  FOR UPDATE TO authenticated
  USING (id = get_user_factory_id(auth.uid()))
  WITH CHECK (id = get_user_factory_id(auth.uid()));
