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
- Modo de edição nativo integrado ao site: autenticação ChatGPT, autorização do proprietário, edição inline e drawers contextuais para conteúdo.
- Persistência em D1 e uploads em R2, sem dependência de CMS externo nem serviços pagos adicionais.

## Arquitetura

O projeto usa uma única superfície React com roteamento leve baseado em History API. A rota é interpretada no cliente para manter a publicação simples e todos os caminhos renderizam o mesmo shell Vinext. A camada pública tem seed estático para resiliência; quando o binding D1 está disponível, `app/api/content` carrega o conteúdo editorial. `app/api/assets` protege metadados no D1 e objetos no R2. `/edit` é uma porta autenticada que retorna ao mesmo shell com a camada contextual ativada.

## Decisões atuais

- Outfit é a família sans-serif principal; Georgia funciona como contraponto editorial serifado.
- O hero segue a arquitetura assimétrica: texto à esquerda e composição astronômica integrada à direita.
- O bento de resumo usa 12 colunas por 2 linhas no desktop, com fluxo denso e ocupação sem lacunas.
- GSAP usa ScrollTrigger para pin da introdução do campo de estudo e para escala/opacidade das imagens.
- A publicação não inclui e-mail, redes sociais, PDFs ou qualquer dado pessoal não confirmado.
- Visitantes recebem apenas itens publicados; rascunhos e ocultos ficam disponíveis somente ao proprietário.
- Documentos de formação são privados por padrão e não são expostos por URL pública previsível.

## Backlog inicial

- Substituir placeholders por projetos, notas e formações reais.
- Expandir o rich text do caderno somente se a necessidade real superar o editor leve atual.
- Definir um canal público de contato, se desejado.
- Associar links de GitHub e outros perfis somente quando forem fornecidos.
- Adicionar página de projeto detalhada quando houver um projeto público completo.

## Evoluções futuras

Iniciação científica, artigos, apresentações, congressos, monitorias, extensão, novas habilidades e experiências profissionais podem ser adicionados aos arrays de conteúdo ou a novos módulos sem alterar a identidade do shell.
