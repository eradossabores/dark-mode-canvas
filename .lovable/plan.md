# Relatório mensal de compras por cliente

## Objetivo
Criar em **Relatórios** uma área própria para gerar e enviar ao cliente um resumo mensal apenas de **Gelos Saborizados**, com ranking por sabores, gráficos e economia obtida em relação ao preço padrão de **R$ 1,99 por unidade**.

## O que será entregue
- Filtro obrigatório de cliente e mês/ano, iniciando no mês atual.
- Indicadores de unidades compradas, pedidos realizados, valor pago e economia total.
- Ranking dos sabores por quantidade, participação no mês, preço médio pago e economia por sabor.
- Gráfico de barras com os sabores mais comprados e gráfico de participação por sabor.
- Histórico das compras do mês, com data, comanda, sabor, quantidade, preço unitário e economia.
- PDF com identidade visual da fábrica, período, indicadores, gráficos, ranking e detalhamento.
- Botão **Compartilhar PDF** que usa o compartilhamento do celular para enviar o arquivo pelo WhatsApp com mensagem pronta; em aparelhos sem esse recurso, baixa o PDF e abre o WhatsApp com o resumo.
- Estados de carregamento, erro e mês sem compras.

## Regras de cálculo
- Considerar somente itens de `venda_itens` ligados a vendas não canceladas da fábrica e do cliente selecionados.
- Preço de referência fixo: **R$ 1,99 por unidade**.
- Economia por item: `quantidade × máximo(0, 1,99 − preço unitário efetivo)`.
- Compras acima de R$ 1,99 não geram “economia negativa”.
- Brindes com preço zero serão identificados separadamente e não inflarão a economia apresentada como desconto comercial.
- Totais e gráficos serão calculados diretamente a partir dos itens vendidos, evitando estimativas pelo total geral da comanda.

## Validação
- Testes dos cálculos de ranking, preço médio, brindes e economia.
- Verificação visual em tela grande e celular.
- Conferência do PDF renderizado para evitar cortes, sobreposições ou gráficos ilegíveis.
