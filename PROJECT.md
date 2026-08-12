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

Cada URL pública é resolvida no servidor e recebe rota, metadados e conteúdo D1 antes da hidratação; o seed estático é somente um fallback de resiliência. Depois da primeira carga, a superfície React preserva navegação leve e back/forward. `app/api/content` valida e versiona mutações editoriais. `app/api/assets` combina metadados D1, objetos R2 e autorização derivada da referência editorial publicada. `/edit` é a porta autenticada que retorna ao mesmo shell com a camada contextual ativada.

## Decisões atuais

- Outfit é a família sans-serif principal; Georgia funciona como contraponto editorial serifado.
- O hero segue a arquitetura assimétrica: texto à esquerda e composição astronômica integrada à direita.
- O bento de resumo usa 12 colunas por 2 linhas no desktop, com fluxo denso e ocupação sem lacunas.
- GSAP usa alvos verificados e `matchMedia`; o conteúdo nasce visível e movimento só inicia com `prefers-reduced-motion: no-preference`.
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
## Atualizações editoriais

- A home usa o retrato fornecido pelo proprietário em WebP e mantém os textos centrais editáveis.
- Perguntas em aberto são itens editoriais com imagem por URL ou upload R2.
- A página de contato possui estado vazio honesto e lista de canais publicada pelo proprietário; ao publicar o primeiro canal, o placeholder desaparece.
- A entrada dos cards de perguntas é one-shot e não altera o primeiro frame em reduced motion.

## Arquitetura pública e editorial refinada

- URLs desconhecidas retornam 404 real; a fronteira `/edit` usa navegação nativa porque cruza autenticação server-side.
- Ocultar altera o status editorial de forma reversível. Restaurar retorna a rascunho; excluir permanentemente é uma ação separada e explicitamente confirmada.
- Uploads entram privados. A publicação de capas e documentos é reconciliada no servidor junto com a referência editorial; o cliente faz limpeza compensatória de uploads novos quando o salvamento falha.
- Campos públicos de trajetória, projetos, caderno, formação e identidade possuem consumidores visuais. O array de ferramentas aparece na página Sobre.
