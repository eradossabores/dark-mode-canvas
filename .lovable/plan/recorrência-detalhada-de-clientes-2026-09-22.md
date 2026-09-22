# Recorrência detalhada de clientes

## Objetivo
Transformar o relatório de Recorrência em uma visão clara de quando cada cliente costuma comprar, quanto compra e quais produtos prefere.

## O que será entregue
- Resumo com clientes regulares, atrasados, novos, unidades vendidas e intervalo médio geral.
- Filtros por período, situação e busca por cliente.
- Lista mobile-first com última compra, frequência média, dias sem comprar, próxima compra prevista, atraso e quantidade média por pedido.
- Detalhes clicáveis por cliente com:
  - linha do tempo das compras;
  - intervalo real entre cada compra;
  - quantidade de cada pedido;
  - total e média de unidades;
  - produtos/sabores mais comprados;
  - valor e ticket médio.
- Contagem completa de Gelos Saborizados, gelo em cubo e bebidas; fardos serão convertidos para suas unidades reais quando essa configuração estiver disponível.
- Exportação PDF e Excel com as novas informações principais.
- Estados de carregamento, vazio e erro em linguagem simples.

## Regras de análise
- Vendas canceladas não entram nos cálculos.
- Frequência é a média dos intervalos entre compras dentro do período analisado.
- Cliente “Atrasado” ultrapassou a previsão baseada no seu próprio intervalo médio; “Comprar em breve” está próximo da previsão; “Regular” está dentro do ciclo; uma única compra aparece como “Novo”.
- A próxima compra é uma estimativa, não uma promessa.

## Implementação técnica
- Ampliar as consultas do relatório existente para vendas e três grupos de itens.
- Processar os indicadores no navegador, mantendo o isolamento da fábrica já aplicado.
- Criar tipagens locais explícitas e componentes menores para resumo, lista e detalhamento.
- Validar compilação e conferir a tela em navegador no tamanho mobile informado.
