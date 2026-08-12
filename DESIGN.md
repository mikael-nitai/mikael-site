# Design system

## Direção

A imagem de referência fornecida para este projeto orienta a linguagem: interface escura, céu profundo, observatório, tipografia serifada, navegação simples, cards de baixa luminosidade e detalhes astronômicos discretos. A implementação interpreta essa referência em vez de copiá-la pixel a pixel.

O resultado deve lembrar um caderno de observação pessoal: calmo, preciso, curioso e ainda em processo. Astronomia é uma atmosfera e um eixo acadêmico, não uma coleção de enfeites.

## Tipografia

- Sans principal: Outfit, com `Segoe UI` como fallback.
- Display editorial: Georgia, com `Times New Roman` como fallback.
- Metadados e pequenos indicadores: DM Mono, com Consolas como fallback.
- Títulos preferem linhas largas; o H1 do hero usa `max-w-6xl`, `white-space: nowrap` e escala fluida para evitar paredes estreitas de texto.

## Cores

- Fundo: `#02060d` e `#040a14`.
- Superfícies: azul-noite translúcido entre `#071323` e `#091828`.
- Texto: `#f2f4f8`.
- Texto secundário: `#b8c1cf`.
- Texto auxiliar: `#7e8ca2`.
- Acento violeta: `#b9a8ff`.
- Acento azul: `#8eb5ff`.
- Linhas: branco-azul com baixa opacidade.

## Espaçamento e grid

Seções principais usam padding vertical generoso, com valor fluido entre 7rem e 13rem. O resumo da home usa um bento de 12 colunas por 2 linhas:

- trajetória: 5 × 2;
- projetos: 7 × 1;
- caderno: 4 × 1;
- formação: 3 × 1.

O total ocupa `10 + 7 + 4 + 3 = 24` células, exatamente as `12 × 2` disponíveis. `grid-auto-flow: dense` permanece aplicado. Em telas médias o mesmo raciocínio é reduzido para 6 × 2; em celular todos os cards se tornam uma coluna.

## Componentes

- Header sticky com wordmark serifado e navegação discreta.
- Hero assimétrico com imagem de céu, linhas orbitais em CSS e apenas duas ações principais.
- Cards de trajetória, projetos, caderno e formação em bento grid.
- Marquee discreto com uma única cópia semântica dos eixos de curiosidade; no mobile, a apresentação é estática.
- Títulos com pequenas imagens inline para introduzir variação editorial.
- Pilha editorial de perguntas em aberto, sem carrossel redundante.
- Footer de baixa densidade, sem redes sociais ou contatos inventados.
- Camada editorial contextual: barra discreta do proprietário, ações “Editar” junto ao item relevante e drawers em painel lateral; ela não altera o layout quando o visitante não está autorizado.
- “Visualizar como visitante” remove barra, botões, badges de rascunho e interesses de administração antes de recarregar a coleção pública.

## Movimento

GSAP e ScrollTrigger fazem entradas de baixa amplitude e, em desktop, o pin útil da introdução do campo de estudo. Alvos são verificados antes da animação e o conteúdo permanece visível como estado base. Não há scrub agressivo, filtros contínuos, partículas ou cursor perseguido. `prefers-reduced-motion` impede a inicialização do movimento desde o primeiro frame.

## Responsividade

Desktop usa composição assimétrica e grid denso. Em até 1040 px, o header vira menu compacto para acomodar os seis destinos. Celular reorganiza hero, cards, timeline, documentos e footer em uma coluna, com botões de largura confortável e sem overflow horizontal.

## Acessibilidade

O projeto usa landmarks semânticos, headings hierárquicos, alt text nas imagens, `aria-label` nos controles, `aria-current` na rota ativa, foco visível, contraste forte nos CTAs e respeito à redução de movimento.

## Modo editorial

- A entrada é `/edit`; após autenticação válida, o usuário retorna à mesma página pública com `?edit=1`.
- O editor prioriza mobile: no celular o drawer vira uma folha inferior, os campos ocupam uma coluna e a barra do proprietário oferece alvos confortáveis.
- Formulários distinguem claramente rascunho, publicado e oculto. Ações destrutivas preferem ocultar o item e pedem confirmação.
- Notas têm rich text limitado a headings, negrito, itálico, link, citação, lista e código. O preview e a listagem reutilizam a linguagem do site, sem abrir uma dashboard paralela.
- Uploads têm áreas de clique e arrastar. Capas públicas usam a rota protegida por metadata; documentos ficam privados salvo escolha explícita.
## Extensões recentes

- A página de Contato usa a mesma linguagem editorial e troca o estado vazio por cards de canais reais.
- Perguntas em aberto aceitam imagem editável e usam entrada one-shot para não permanecerem com opacidade residual.
- O modo editorial preserva a composição pública: controles aparecem somente para o proprietário autenticado.

## Refinamento de arquitetura e interação

- O hero assimétrico foi preservado por corresponder ao caderno acadêmico pessoal. Recomendações visuais genéricas ou comerciais não substituem essa direção.
- A estrutura AIDA, os títulos largos e o bento denso continuam como base; o carrossel que repetia as perguntas foi removido para reduzir redundância.
- O menu compacto só existe no DOM enquanto aberto e oferece fechamento por `Esc`, clique externo e retorno de foco.
- O drawer editorial gerencia foco inicial, ciclo de foco, `Esc`, bloqueio do fundo, mensagens de erro focáveis e restauração do foco ao controle de origem.
- Formação, projetos, notas e trajetória exibem os metadados públicos que o editor coleta. Documentos formam uma unidade visual com seus registros e continuam privados por padrão.
- A camada de decisão do `gpt-taste` conserva hierarquia editorial, bento e espaçamento quando agregam valor, mas rejeita RNG de layout, efeitos comerciais e movimento que prejudique identidade, acessibilidade, mobile ou desempenho.
