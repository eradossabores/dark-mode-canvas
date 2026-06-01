## Funcionalidade: Preço à Vista, Preço a Prazo e Conversão Automática

Vou implementar uma gestão financeira completa de preços por cliente, com suporte a venda à vista/a prazo, conversão automática após vencimento, contas a receber, alertas e relatórios.

---

### 1. Banco de Dados (migração)

**Tabela `clientes` — novos campos:**
- `preco_unidade_avista` (numeric) — preenchido pelo usuário
- `preco_unidade_aprazo` (numeric, default 2.05) — padrão R$ 2,05 alterável
- `limite_credito` (numeric, default 0)
- `saldo_devedor_atual` (numeric, default 0) — recalculado por trigger
- `status_financeiro` (text: 'adimplente' | 'inadimplente', default 'adimplente')
- `conversao_automatica_prazo` (boolean, default false)

**Tabela `vendas` — novos campos:**
- `forma_pagamento_tipo` (text: 'avista' | 'aprazo', default 'avista')
- `data_vencimento` (date)
- `convertida_automaticamente` (boolean, default false)
- `data_conversao` (timestamptz)
- `valor_original` (numeric) — preserva valor antes da conversão
- `preco_unitario_usado` (numeric) — preço congelado no momento da venda

**Tabela `clientes_alertas_financeiros` (nova):**
- `cliente_id`, `venda_id`, `tipo` ('vence_hoje'|'vencida_1d'|'vencida_2d'|'convertida'|'acima_limite'), `mensagem`, `lida`, `created_at`

**Funções/triggers:**
- `recalcular_saldo_devedor(cliente_id)` — recomputa saldo e status
- Trigger em `vendas` e `abatimentos_historico` para atualizar saldo
- Função `converter_vendas_avista_atrasadas()` — roda diariamente via pg_cron
- Auditoria em triggers para alterações de preço e conversões

---

### 2. Backend — Cron diário

Edge function `converter-vendas-atrasadas` agendada via `pg_cron`:
- Busca vendas à vista com >3 dias e cliente com `conversao_automatica_prazo = true`
- Converte para "aprazo", recalcula com `preco_unidade_aprazo`, gera alerta e registra auditoria
- Gera alertas diários (vence hoje, vencida 1d/2d)

---

### 3. Frontend

**Cadastro de Cliente (`MeusClientes.tsx`, `Clientes.tsx`):**
- Nova seção "Configuração Financeira" com os 6 novos campos
- Preço a prazo pré-preenchido com 2.05
- Checkbox conversão automática (desmarcado por padrão)

**Nova Venda (`Vendas.tsx`, `NovoPedido.tsx`):**
- Toggle "À Vista / A Prazo"
- Recalcula total ao alternar
- Mostra preço aplicado visivelmente
- Se "A Prazo": cria parcela automática em contas a receber

**Contas a Receber (`AReceber.tsx`):**
- Coluna valor original vs atualizado
- Dias em atraso, badge convertida automaticamente
- Filtros por status, forma de pagamento

**Dashboard:**
- Novos cards: vendido hoje à vista, a prazo, total a receber, vencido, qtd inadimplentes, qtd convertidas, previsão recebimento
- Widget de alertas financeiros

**Relatórios (`Relatorios.tsx`):**
- Novos relatórios: vendas à vista, a prazo, inadimplentes, conversões, maior saldo devedor
- Filtros: cliente, período, forma pagamento, status financeiro

**Auditoria:**
- Logar alterações de preço, ativação/desativação conversão, conversões automáticas, pagamentos (módulo `auditoria` já existe)

---

### Detalhes técnicos

- Cron: `pg_cron` + `pg_net` chamando edge function diária às 03:00 BRT (06:00 UTC)
- Preço congelado: `venda_itens.preco_unitario` já existe; adiciono `vendas.preco_unitario_usado` para referência rápida
- RLS: todas tabelas novas com policy `factory_id = get_user_factory_id(auth.uid())`
- Migração de dados: para vendas existentes `forma_pagamento_tipo = 'avista'`, `valor_original = total`

---

### Escopo de arquivos

- 1 migração SQL (schema + triggers + cron)
- 1 edge function nova (`converter-vendas-atrasadas`)
- Edit: `Clientes.tsx`, `vendedor/MeusClientes.tsx`, `Vendas.tsx`, `vendedor/NovoPedido.tsx`, `AReceber.tsx`, `Dashboard.tsx`, `Relatorios.tsx`
- Novo: `components/dashboard/AlertasFinanceiros.tsx`, `components/relatorios/RelatorioAVistaAPrazo.tsx`

Posso prosseguir com a migração e implementação?
