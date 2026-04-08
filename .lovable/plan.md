## Fase 1 — Correções de Segurança Críticas

### 1.1 Corrigir `get_user_factory_id` (adicionar ORDER BY)
- Migration: `ALTER FUNCTION` com `ORDER BY created_at DESC`

### 1.2 Isolar chaves NF-e da tabela `factories`
- Criar tabela `factory_secrets` com RLS restrito a owner/super_admin
- Mover `nfe_api_key` e `nfe_company_id` para nova tabela
- Atualizar Edge Functions `emit-nfe` e `check-nfe-status`

### 1.3 Proteger convites contra escalação de privilégios
- Remover policy UPDATE direta da tabela `invites`
- Toda redenção via Edge Function `process-invite` (já existente)

### 1.4 Validar pedidos públicos
- Restringir INSERT policy: validar que `factory_id` existe em `factories`

---

## Fase 2 — Dashboard & Produção

### 2.1 Comparativo mensal
- Gráfico lado a lado: mês atual vs anterior (faturamento, vendas, produção)

### 2.2 Meta de vendas
- Tabela `metas_vendas` (factory_id, mes, valor_meta)
- Barra de progresso visual no Dashboard

### 2.3 Alertas inteligentes
- Cards de alerta: estoque crítico, contas vencendo hoje, clientes inativos >30d

### 2.4 Indicador de eficiência de produção
- Taxa: produção total / (produção + avarias) × 100%

### 2.5 Histórico por funcionário
- Dashboard individual de produtividade com gráficos

---

## Fase 3 — Vendas & Estoque

### 3.1 Comissão de vendedores
- Tabela `comissoes_config` (factory_id, percentual, vendedor_id)
- Cálculo automático exibido em relatórios

### 3.2 Recorrência de clientes
- Análise de padrão de compra (frequência média, última compra)
- Badge de sugestão de reposição

### 3.3 Alerta de validade
- Coluna `validade` em `producoes`
- Destaque visual para lotes próximos do vencimento

### 3.4 Sugestão de compra automática
- Baseado no consumo médio dos últimos 30 dias vs estoque atual

---

## Fase 4 — Clientes & Relatórios

### 4.1 Classificação ABC
- Categorizar por faturamento: A (80%), B (15%), C (5%)
- Badge visual na lista de clientes

### 4.2 Inadimplência preditiva
- Score de risco baseado em histórico de pagamentos

### 4.3 Relatório de margem de lucro
- Custo de produção (matéria-prima + embalagem) vs preço de venda por sabor

### 4.4 DRE simplificado
- Receitas (vendas) - Custos (compras + produção) - Despesas (contas a pagar)

### 4.5 Relatório de sazonalidade
- Gráfico de vendas por mês para identificar tendências

---

## Fase 5 — Super Admin

### 5.1 Painel de saúde geral
- Resumo de todas as fábricas: status, faturamento, atividade, risco de churn

### 5.2 Onboarding automatizado
- Checklist guiado para novas fábricas (sabores, receita, cliente, primeira venda)
- Tabela `onboarding_progress` com tracking de etapas