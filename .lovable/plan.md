# Módulo Operação Externa — ICETECH

Adicionar um novo perfil operacional para trabalho de campo (entregas, abastecimento de freezer, prospecção, ocorrências) com pontuação de desempenho. Nada do perfil Admin será alterado.

## 1. Novo perfil de acesso

- Adicionar valor `auxiliar_externo` ao enum `app_role`.
- Rota `/painel/operacao-externa/*` liberada apenas para esse role (+ admin/factory_owner/super_admin em modo leitura).
- Bloqueios explícitos: Financeiro, Custos, Relatórios, Configurações, Usuários, Dados estratégicos.
- Ajustes em `ProtectedRoute.tsx` e `Layout.tsx` (nova seção lateral "Operação Externa" visível ao role).

## 2. Usuário inicial

- Criar via edge function `create-user` existente:
  - Nome: Brendo
  - E-mail: Brendo@icetech.com
  - Senha: `Brendo@2026`
  - Role: `auxiliar_externo`
  - Fábrica: MACUXI ICE
- Flag `must_change_password` no `profiles` + tela obrigatória de troca no primeiro login.

## 3. Estrutura de banco (migrations)

Todas com `factory_id`, RLS, GRANT, timestamps.

- `rotas_externas` (data, auxiliar_user_id, status)
- `rota_paradas` (rota_id, cliente_id, ordem, quantidade_prevista, status)
- `visitas_externas` (rota_parada_id, cliente_id, auxiliar_user_id, chegada_em, saida_em, quantidade_entregue, foto_antes_url, foto_depois_url, observacao_inicial, observacao_organizacao, checklist_json)
- `visita_checklist_items` (visita_id, chave, marcado) — ou JSONB dentro da própria visita
- `prospeccoes_externas` (nome, responsavel, telefone, endereco, tipo, foto_fachada_url, potencial, status, observacoes, criado_por)
- `ocorrencias_externas` (cliente_id, tipo, descricao, foto_url, criado_por)
- `pontuacao_eventos` (auxiliar_user_id, tipo, pontos, referencia_id, referencia_tabela, created_at)
- `metas_operacao_externa` (auxiliar_user_id, mes, clientes_visitados, prospeccoes, novos_clientes, pct_checklist, meta_ruptura)
- Bucket storage `operacao-externa` (público) para fotos.

Triggers para pontuação: ao inserir prospecção, visita finalizada com checklist completo, novo cliente convertido, etc.

## 4. Telas do Auxiliar (mobile-first)

Rota base `/painel/operacao-externa`:

- **Dashboard pessoal** — saudação "Olá, Brendo", cards do dia (entregas, clientes, unidades, checklists pendentes, pontuação, meta do mês) + botão gigante **INICIAR ROTA DO DIA**.
- **Minha Rota** — lista de paradas ordenadas com status, botão Google Maps/Waze.
- **Fluxo de Atendimento** (wizard 6 etapas):
  1. Iniciar atendimento (registra chegada)
  2. Foto ANTES + observação (câmera nativa `<input capture>`)
  3. Registrar entrega (qtd + obs)
  4. Checklist de organização (7 itens)
  5. Foto DEPOIS
  6. Finalizar (grava tudo + fotos + gera pontos)
- **Prospecção** — formulário com foto de fachada, tipo, potencial, status.
- **Ocorrências** — formulário rápido com tipo + foto + descrição.
- **Clientes Visitados** — histórico próprio.
- **Meu Desempenho** — pontuação total, nível (Bronze/Prata/Ouro), breakdown por categoria, progresso das metas.

## 5. Telas do Admin

- Nova aba **Operação Externa** dentro do Dashboard (ou página `/painel/operacao-externa/admin`):
  - KPIs: entregas realizadas, clientes visitados, rotas concluídas, fotos, checklists, rupturas, prospecções, novos clientes.
  - Filtros: data, funcionário, cliente, região.
- Aba **Histórico Operacional** dentro do cadastro de cliente (`Clientes.tsx`) mostrando linha do tempo de visitas com fotos antes/depois.
- Configuração de **metas mensais** por auxiliar.

## 6. Sistema de pontuação

Tabela `pontuacao_eventos` alimentada por triggers/RPCs:

| Ação | Pontos |
|---|---|
| Cliente estratégico visitado | +10 |
| Cliente recorrente visitado | +5 |
| Novo ponto prospectado | +20 |
| Novo cliente convertido | +50 |
| Checklist completo | +5 |
| 100% checklists na semana | +20 |
| Mês sem ruptura | +30 |
| Freezer abastecido/organizado | +5 |
| Cliente aprovado padrão visual | +10 |

Níveis: Bronze < 200 · Prata 200–499 · Ouro ≥ 500 (mês corrente).

## Detalhes técnicos

- Fotos: `supabase.storage.from('operacao-externa').upload(...)` com path `visitas/{visita_id}/antes.jpg`.
- Câmera mobile: `<input type="file" accept="image/*" capture="environment">`.
- Enum novo `app_role` exige `ALTER TYPE ... ADD VALUE` em migration isolada (Postgres exige commit antes de usar).
- `ProtectedRoute` ganha lista `AUXILIAR_ROUTES`; redirect padrão do role vai para `/painel/operacao-externa`.
- Cada visita gera eventos em `pontuacao_eventos` via trigger AFTER INSERT/UPDATE.
- Views agregadas: `v_desempenho_auxiliar_mes` (soma pontos, conta ações no mês).

## Entrega em fases (sugestão)

1. **Fase 1 (base)**: enum de role, tabelas, RLS, buckets, usuário Brendo, layout/menu, dashboard pessoal, fluxo de atendimento completo com fotos.
2. **Fase 2**: prospecção, ocorrências, histórico operacional no cliente.
3. **Fase 3**: pontuação, metas, dashboards do admin.

Confirma que posso ir direto na Fase 1 completa nesta rodada, ou prefere que eu entregue tudo (1+2+3) num só ciclo?
