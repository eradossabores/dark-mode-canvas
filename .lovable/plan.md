# Auditoria — Vendas × Estoque

## Resumo executivo

A criação de venda (RPC `realizar_venda`) e a exclusão total da venda (trigger `cascade_delete_venda_movimentacoes`) tratam o estoque corretamente. **Mas a edição de uma venda já finalizada NÃO mexe em estoque algum** — é o ponto crítico desta auditoria.

## Problemas encontrados

### 1. CRÍTICO — Edição de venda não ajusta estoque
Arquivo: `src/pages/Vendas.tsx` → função `handleEditSave` (linhas ~695-814).

O código:
- Faz `update` em `venda_itens` ao alterar quantidade → **estoque não é debitado/creditado pela diferença**.
- Faz `delete` em `venda_itens` removidos → **quantidade não volta para `estoque_gelos`**.
- Faz `insert` de novo item (`isNew`) → **estoque não é debitado**.
- Não grava nada em `movimentacoes_estoque` → perda total de rastreabilidade dos ajustes.

Consequência: após qualquer edição, o saldo de `estoque_gelos` fica divergente da realidade. Brindes (preço 0) também não baixam estoque.

### 2. CRÍTICO — Cancelamento de venda não devolve estoque
Arquivo: `src/pages/Vendas.tsx` → `handleCancel` (linha ~851).

Apenas marca `status = 'cancelada'`. O trigger `cascade_delete_venda_movimentacoes` só dispara no DELETE da venda, não em UPDATE de status. Portanto cancelar deixa o estoque deduzido eternamente.

### 3. MÉDIO — Sem logs de auditoria de movimentação por edição
Nenhum INSERT em `auditoria` nem em `movimentacoes_estoque` registra: estoque antes, estoque depois, diferença, usuário, venda_id. Edições e cancelamentos passam invisíveis no histórico de estoque.

### 4. BAIXO — `handleDelete` confia no trigger, mas remove `venda_itens` ANTES do `DELETE` da venda
Arquivo: `src/pages/Vendas.tsx` linha ~913. O trigger `cascade_delete_venda_movimentacoes` lê `movimentacoes_estoque` por `referencia_id = venda.id` (não depende de `venda_itens`), então o estorno funciona, mas é frágil — qualquer mudança futura no trigger pode quebrar silenciosamente.

## Correções propostas

### A. Nova função SQL `ajustar_venda_item` (transacional)
Centraliza qualquer mudança de item em uma venda existente:

```text
ajustar_venda_item(p_venda_id, p_sabor_id, p_quantidade_nova, p_operador)
  ├─ lê quantidade atual em venda_itens (0 se não existe)
  ├─ calcula delta = nova - atual
  ├─ se delta > 0: valida estoque, debita estoque_gelos, INSERT movimentacao 'saida'
  ├─ se delta < 0: credita estoque_gelos, INSERT movimentacao 'entrada' (estorno)
  ├─ INSERT/UPDATE/DELETE em venda_itens conforme o caso
  └─ INSERT em auditoria com {estoque_antes, estoque_depois, delta, venda_id, operador}
```

### B. Nova função SQL `cancelar_venda(p_venda_id, p_operador)`
- Reaproveita a lógica do trigger: para cada item da venda, credita estoque e registra movimentação `entrada` com `referencia = 'cancelamento_venda'`.
- Atualiza `status = 'cancelada'`.
- Registra auditoria.

### C. Refatorar frontend
- `handleEditSave`: substitui os loops de update/insert/delete por chamadas a `ajustar_venda_item` para cada item (incluindo brindes, removidos e novos).
- `handleCancel`: chama `cancelar_venda` em vez do update direto.

### D. Testes automáticos (Vitest)
Criar `src/tests/vendasEstoque.test.ts` cobrindo (com mocks do supabase client):
1. Venda simples — debita 1 sabor.
2. Venda múltipla — debita N sabores.
3. Edição aumentando qty — debita só a diferença.
4. Edição diminuindo qty — credita a diferença.
5. Exclusão de item — credita qty total do item.
6. Inclusão de novo item — debita qty.
7. Cancelamento — credita todos os itens.

Os testes verificam o **payload enviado** às RPCs e o conjunto de chamadas — não tocam banco real.

## Arquivos afetados

- **Nova migration** (SQL): funções `ajustar_venda_item` e `cancelar_venda` + grants.
- `src/pages/Vendas.tsx`: `handleEditSave`, `handleCancel`.
- `src/tests/vendasEstoque.test.ts`: novo.

## Entregáveis finais

Ao final você recebe:
- Relatório de execução dos 7 cenários de teste.
- Lista de funções/arquivos alterados.
- Confirmação de que toda movimentação passa a gerar linha em `movimentacoes_estoque` + `auditoria`.

## Observação importante

Esta é uma mudança estrutural: novas funções no banco e refatoração do fluxo de edição. Quer que eu prossiga com a implementação completa (migration + refactor + testes) ou prefere fatiar (ex.: só A+C primeiro, testes depois)?
