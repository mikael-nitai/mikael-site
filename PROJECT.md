# Projeto

## Contexto

Mikael está no começo da graduação em Física com ênfase em Astrofísica na Universidade Federal de Sergipe. O site é um espaço pessoal para acompanhar a formação, organizar projetos e transformar aprendizagem em registros que possam crescer com o tempo.

## Objetivos

- Apresentar a pessoa e a formação atual com honestidade.
- Criar um índice para trajetória, projetos, caderno e formação complementar.
- Manter uma base técnica simples, rápida e fácil de continuar.
- Oferecer uma experiência visual noturna, acadêmica e contemplativa inspirada na imagem de referência.

## Escopo atual

- Home com hero astronômico, preview de trajetória, projetos, notas e formação.
- Rotas navegáveis para Sobre, Trajetória, Projetos, Caderno, Formação e Contato.
- Conteúdo centralizado em `content/siteData.ts`.
- Placeholders explícitos onde ainda não existem dados públicos confirmados.
- Metadados básicos, favicon, acessibilidade estrutural, responsividade e animações GSAP.

## Arquitetura

O projeto usa uma única superfície React com roteamento leve baseado em History API. A rota é interpretada no cliente para manter a publicação simples e todos os caminhos renderizam o mesmo shell Vinext. Os dados ficam separados da apresentação, permitindo adicionar registros sem editar vários componentes.

## Decisões atuais

- Outfit é a família sans-serif principal; Georgia funciona como contraponto editorial serifado.
- O hero segue a arquitetura assimétrica: texto à esquerda e composição astronômica integrada à direita.
- O bento de resumo usa 12 colunas por 2 linhas no desktop, com fluxo denso e ocupação sem lacunas.
- GSAP usa ScrollTrigger para pin da introdução do campo de estudo e para escala/opacidade das imagens.
- A publicação não inclui e-mail, redes sociais, PDFs ou qualquer dado pessoal não confirmado.

## Backlog inicial

- Substituir placeholders por projetos, notas e formações reais.
- Adicionar conteúdo Markdown ou MDX para o caderno.
- Definir um canal público de contato, se desejado.
- Associar links de GitHub e outros perfis somente quando forem fornecidos.
- Adicionar página de projeto detalhada quando houver um projeto público completo.

## Evoluções futuras

Iniciação científica, artigos, apresentações, congressos, monitorias, extensão, novas habilidades e experiências profissionais podem ser adicionados aos arrays de conteúdo ou a novos módulos sem alterar a identidade do shell.
