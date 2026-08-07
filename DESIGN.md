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
- Marquee contínuo com os eixos de curiosidade.
- Títulos com pequenas imagens inline para introduzir variação editorial.
- Carrossel manual de perguntas em aberto, com controles acessíveis.
- Footer de baixa densidade, sem redes sociais ou contatos inventados.
- Camada editorial contextual: barra discreta do proprietário, ações “Editar” junto ao item relevante e drawers em painel lateral; ela não altera o layout quando o visitante não está autorizado.
- “Visualizar como visitante” remove barra, botões, badges de rascunho e interesses de administração antes de recarregar a coleção pública.

## Movimento

GSAP e ScrollTrigger fazem a entrada inicial, o pin da coluna esquerda no campo de estudo e o ciclo de escala/opacidade das imagens. Hover usa transições de baixa amplitude. Não há partículas contínuas, cursor perseguido ou efeitos que disputem atenção com a leitura. `prefers-reduced-motion` desativa o movimento essencial e o marquee.

## Responsividade

Desktop usa composição assimétrica e grid denso. Tablet reduz o bento para seis colunas e converte o header em menu compacto. Celular reorganiza hero, cards, timeline, carrossel e footer em uma coluna, com botões de largura confortável e sem overflow horizontal.

## Acessibilidade

O projeto usa landmarks semânticos, headings hierárquicos, alt text nas imagens, `aria-label` nos controles, `aria-current` na rota ativa, foco visível, contraste forte nos CTAs e respeito à redução de movimento.

## Modo editorial

- A entrada é `/edit`; após autenticação válida, o usuário retorna à mesma página pública com `?edit=1`.
- O editor prioriza mobile: no celular o drawer vira uma folha inferior, os campos ocupam uma coluna e a barra do proprietário oferece alvos confortáveis.
- Formulários distinguem claramente rascunho, publicado e oculto. Ações destrutivas preferem ocultar o item e pedem confirmação.
- Notas têm rich text limitado a headings, negrito, itálico, link, citação, lista e código. O preview e a listagem reutilizam a linguagem do site, sem abrir uma dashboard paralela.
- Uploads têm áreas de clique e arrastar. Capas públicas usam a rota protegida por metadata; documentos ficam privados salvo escolha explícita.
