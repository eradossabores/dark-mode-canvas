# Plano: Pagamento no Ato da Entrega

Reaproveita a infraestrutura já criada (`preco_unidade_avista`, `preco_unidade_aprazo`, `forma_pagamento_tipo`, `convertida_automaticamente`, `alertas_financeiros`, recálculo de saldo) e adiciona o fluxo de **confirmação de entrega com pagamento**.

## 1. Banco de dados (migração)

Tabela `vendas`:
- `status_entrega` text default `'aguardando_entrega'` — valores: `aguardando_entrega`, `entregue_pago`, `entregue_nao_pago`, `convertida_prazo`
- `entregue_em` timestamptz
- `entregue_por` text
- `pagamento_confirmado_em` timestamptz
- `pagamento_confirmado_por` text

Função `confirmar_entrega_venda(p_venda_id uuid, p_pago boolean, p_operador text, p_forma_pagamento text)`:
- Se `p_pago = true`: marca `status_entrega = entregue_pago`, cria abatimento total em `abatimentos_historico` com a `forma_pagamento`, registra auditoria. Não cria conta a receber (já está quitada via abatimento).
- Se `p_pago = false`: recalcula `total` e `venda_itens` usando `preco_unidade_aprazo` do cliente (fallback 2,05), seta `forma_pagamento_tipo = aprazo`, `convertida_automaticamente = true`, `data_conversao = now()`, `valor_original = total antigo`, `status_entrega = convertida_prazo`, `data_vencimento = CURRENT_DATE + 7`. Insere alerta `convertida_entrega` e auditoria. O trigger existente recalcula o saldo devedor.

Função `realizar_venda` (alteração): nova venda nasce com `forma_pagamento_tipo = 'avista'`, `status_entrega = 'aguardando_entrega'` e usa `preco_unidade_avista` do cliente quando disponível (mantém o `calcular_preco` como fallback).

## 2. Frontend

**Cadastro de Cliente** (`Clientes.tsx`): a seção "Configuração Financeira" já existe; renomear os labels para "Preço por Unidade (Pagamento na Entrega)" e "Preço por Unidade (A Prazo)". Remover o toggle "Conversão automática após 3 dias" (substituído pelo fluxo de entrega). Mostrar Saldo Devedor, Limite e Status Financeiro (já presentes).

**Nova Venda / Finalização** (`Vendas.tsx`, `NovoPedido.tsx`): default = "Pagamento na Entrega"; preço unitário usa `preco_unidade_avista`. Remover o toggle À Vista/A Prazo manual (a conversão acontece via confirmação de entrega).

**Histórico de Pedidos / Monitor** (`HistoricoPedidos.tsx`): nova coluna **Status de Entrega** com badge colorido. Botão **"Confirmar Entrega"** abre `AlertDialog` com duas opções: *Pagamento Recebido* (com select PIX/Espécie/Misto) ou *Pagamento Não Recebido (Converter para A Prazo)*. Chama a função `confirmar_entrega_venda` via RPC.

**A Receber** (`AReceber.tsx`): já existente; passa a listar automaticamente as vendas convertidas. Badge "Convertida na entrega" quando `convertida_automaticamente = true`.

**Dashboard** (`Dashboard.tsx`): novos KPIs — *Entregues hoje*, *Pagas na entrega (hoje)*, *Convertidas para prazo (hoje)*, *Total a Receber*, *Inadimplentes*, *Valor em aberto*.

**Relatórios** (`Relatorios.tsx`): novas abas — Pagas na Entrega, Convertidas para Prazo, Inadimplentes, Histórico Financeiro por Cliente (filtro de período).

## 3. Auditoria

`confirmar_entrega_venda` grava em `auditoria` com `modulo='vendas'`, `acao='confirmar_entrega'` ou `'converter_entrega_prazo'`, contendo operador, valores e ID do cliente.

## 4. Cron antigo

A função `processar_conversoes_e_alertas_diarios` é mantida apenas para emitir alertas de vencimento. A regra de conversão automática "3 dias" é desligada (passamos a converter no momento da entrega).

## Arquivos a editar
- `src/pages/Clientes.tsx`
- `src/pages/Vendas.tsx`, `src/pages/NovoPedido.tsx`
- `src/pages/HistoricoPedidos.tsx` (botão Confirmar Entrega)
- `src/pages/AReceber.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Relatorios.tsx`

## Arquivos novos
- `src/components/vendas/ConfirmarEntregaDialog.tsx`

Confirma para eu rodar a migração e implementar o frontend?
