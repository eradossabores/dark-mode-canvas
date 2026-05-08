## Sistema de Compras, Estoque e Produção com Rastreabilidade de Lotes

Vou estender os módulos existentes (Compras, Estoque e Produção) para suportar **rastreabilidade completa por lote**, com datas de fabricação/vencimento, alertas automáticos e relatórios detalhados.

### Visão geral

O projeto já possui:
- `compras` (registra compras de matérias-primas e embalagens)
- `materias_primas` / `embalagens` (estoque atual)
- `producoes` + `sabor_receita` (consome matérias-primas e produz gelo)
- `movimentacoes_estoque` (histórico)

O que **falta** e será criado: **camada de lotes** (batches) ligando compras → estoque → produção, com validade.

---

### 1. Banco de Dados (novas tabelas)

**`lotes_estoque`** — um lote por compra/item
- `item_tipo` ('materia_prima' | 'embalagem')
- `item_id`
- `numero_lote` (alfanumérico, único por fábrica/item)
- `compra_id` (origem)
- `fornecedor_id`
- `quantidade_inicial`, `quantidade_atual`
- `data_fabricacao`, `data_vencimento`
- `custo_unitario`
- `factory_id`, `created_at`

**`producao_lotes_consumidos`** — rastreabilidade reversa
- `producao_id`
- `lote_id` (FK lotes_estoque)
- `quantidade_usada`

**`producoes`** — adicionar colunas:
- `numero_lote_producao` (auto-gerado: `PROD-YYYYMMDD-NNN`)
- `data_vencimento` (opcional, configurável por sabor)

**Triggers/funções**:
- Ao inserir em `compras`: criar `lotes_estoque` automaticamente e somar ao estoque do item.
- Ao realizar produção: consumir dos lotes mais antigos (FIFO) e registrar em `producao_lotes_consumidos`.
- Auto-numeração de lote produção.

---

### 2. Tela de Compras (atualizada)

Adicionar à tela `Compras.tsx` os campos por item:
- **Data de Fabricação** (date picker)
- **Data de Vencimento** (date picker)
- **Número do Lote** (texto; sugestão automática `LOTE-YYYYMMDD-XXX`)

Mantém: fornecedor, produtos múltiplos, frete, total automático.

---

### 3. Tela de Estoque (atualizada)

Em cada linha de matéria-prima/embalagem, adicionar **botão "Ver Lotes"** que abre dialog com:
- Nº Lote, Quantidade restante, Data Fabricação, Data Vencimento, Compra/Fornecedor de origem
- Destaque visual: **vermelho** se vencido, **amarelo** se vence em ≤7 dias

---

### 4. Tela de Produção (atualizada)

- Exibir **lotes disponíveis** (FIFO) ao escolher sabor
- Após produzir, mostrar **Lote de Produção gerado** + lotes de origem consumidos
- Nova aba "Rastreabilidade" para buscar um lote de produção e ver a árvore: lote produção → lotes matérias-primas → compras → fornecedores

---

### 5. Alertas

Adicionar ao Dashboard (componente `AlertasInteligentes` existente) cards:
- **Lotes vencendo em 7 dias** (lista com sabor/MP, lote, dias restantes)
- **Lotes vencidos** (em vermelho)
- Estoque baixo já existe, mantido.

---

### 6. Relatórios

Estender `RelatorioEstoque.tsx` e criar nova seção em `Relatorios.tsx`:
- **Relatório de Compras por período** (já existe parcial — adicionar coluna Lote, Validade)
- **Relatório de Lotes** (todos os lotes com saldo, fornecedor, validade)
- **Relatório de Rastreabilidade** (dado um lote produção, mostrar árvore completa)

Exportação PDF/Excel via `export-utils` já existente.

---

### 7. Integração financeira

Já existe: compras alimentam custos. Adicionar custo médio ponderado por lote ao calcular margem em `RelatorioMargem.tsx`.

---

### Detalhes técnicos

**Migrations necessárias (1 migration consolidada):**
1. `CREATE TABLE lotes_estoque` + RLS por `factory_id`
2. `CREATE TABLE producao_lotes_consumidos` + RLS
3. `ALTER TABLE producoes ADD COLUMN numero_lote_producao TEXT, data_vencimento DATE`
4. Função `gerar_lote_producao(factory_id) RETURNS TEXT`
5. Trigger `apos_compra_criar_lote` em `compras`
6. Atualizar `realizar_producao` para consumir FIFO e gravar `producao_lotes_consumidos`
7. View `lotes_vencendo` para alertas

**Arquivos frontend a editar/criar:**
- `src/pages/Compras.tsx` — campos lote/datas
- `src/pages/Estoque.tsx` — botão Ver Lotes
- `src/components/estoque/LotesDialog.tsx` (novo)
- `src/pages/Producao.tsx` — exibir lotes consumidos
- `src/components/producao/RastreabilidadeDialog.tsx` (novo)
- `src/components/dashboard/AlertasVencimento.tsx` (novo) + integrar no Dashboard
- `src/components/relatorios/RelatorioLotes.tsx` (novo) + adicionar tab em `Relatorios.tsx`

---

### Escopo / pergunta antes de iniciar

Esse é um trabalho **grande** (1 migration complexa + ~10 arquivos frontend). Antes de implementar tudo de uma vez, quero confirmar:

1. **Confirma criar a camada de lotes do zero** (hoje compras só somam ao estoque sem rastrear lote individual)?
2. **FIFO** automático na produção é OK, ou prefere escolher manualmente o lote a consumir?
3. **Data de vencimento do produto fabricado**: calcular automaticamente (ex: 6 meses após produção, configurável por sabor) ou pedir ao operador a cada produção?

Se confirmar, executo tudo numa única passada.