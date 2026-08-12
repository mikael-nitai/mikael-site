# Mikael site

Site pessoal de Mikael, estudante do bacharelado em Física com ênfase em Astrofísica na Universidade Federal de Sergipe.

## Propósito

O projeto é um espaço pessoal para registrar formação acadêmica, projetos, estudos, interesses e evolução ao longo do tempo. O conteúdo inicial é deliberadamente honesto: quando ainda não há um projeto, texto ou certificado real para publicar, a interface usa um placeholder claramente identificado.

## Stack

- React 19 + TypeScript
- Vinext/Vite com saída compatível com Cloudflare Workers
- GSAP + ScrollTrigger para movimento discreto
- CSS próprio para a identidade visual
- Conteúdo inicial centralizado em `content/siteData.ts`; conteúdo editorial salvo em D1 após a primeira publicação.

## Executar

Requer Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

## Validar

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

A suíte combina contratos unitários, budgets do bundle e Playwright em Chrome real. Ela cobre SSR e metadados de todas as rotas, 404, hidratação, navegação, breakpoints de 390 a 1600 px, teclado, menu, drawer, edição contextual, ocultação reversível e `prefers-reduced-motion` desde o primeiro frame.

## Estrutura

- `app/site/routes.ts`: registro canônico de rotas e metadados
- `app/home/HomeExperience.tsx`: superfície pública e camada editorial contextual
- `app/api/content/route.ts`: validação, versão e mutações editoriais
- `app/api/assets/route.ts`: upload, metadados, autorização e ciclo de vida de arquivos
- `app/globals.css`: tokens, layout, responsividade e animações CSS
- `lib/content-store.ts`: persistência D1 e reconciliação de referências R2
- `content/siteData.ts`: dados de trajetória, projetos, notas, formação e interesses
- `public/`: favicon e assets públicos
- `AGENTS.md`: regras permanentes para manutenção por agentes
- `PROJECT.md`: contexto, escopo e backlog
- `DESIGN.md`: decisões de design e referência visual

## Conteúdo

O conteúdo inicial continua em `content/siteData.ts` como seed honesto. Em produção, o proprietário usa `/edit` para entrar com ChatGPT e editar pelo próprio site; visitantes nunca recebem controles nem permissão de escrita. Notas, projetos, marcos, formação e interesses são persistidos em D1. Imagens e documentos passam por R2; documentos de formação são privados por padrão.

## Modo de edição nativo

- `/edit` exige autenticação ChatGPT e autorização server-side do único proprietário configurado no ambiente; a conta é reconhecida pelo ID do usuário e pelo e-mail autorizado como fallback de compatibilidade.
- A barra do proprietário aparece somente para a conta autorizada; “Visualizar como visitante” remove a camada editorial e recarrega apenas o conteúdo público.
- Textos curtos podem ser editados inline. Projetos, notas, marcos, formações e interesses usam drawers contextuais com estados de rascunho, publicado e oculto.
- O editor de notas oferece rich text leve, capa opcional e upload por clique ou arrastar; o resumo e o tempo de leitura são derivados do texto.
- Ocultar é reversível; restaurar retorna o item a rascunho. Exclusão permanente é uma ação separada e confirmada.
- Uploads entram privados. Capas só são públicas enquanto referenciadas por um item publicado; documentos exigem também `documentPublic === true`.
- APIs de escrita rejeitam visitantes e contas autenticadas que não sejam o proprietário. Assets privados exigem a mesma autorização em cada leitura, e mutações concorrentes usam controle de versão.

## Publicação

O projeto foi preparado para publicação via Sites. Depois de um build válido, o fluxo de hosting deve salvar uma versão e fazer o deploy da fonte validada. O arquivo `.openai/hosting.json` guarda somente bindings de infraestrutura; IDs e credenciais são gerenciados pelo conector.
## Recursos editoriais atuais

- Home, Sobre e Contato permitem editar textos inline dentro do modo `/edit`.
- Perguntas em aberto aceitam URL ou upload de imagem própria, com texto alternativo.
- Contato permite criar canais com rótulo, valor, link e nota. O placeholder “Contato a configurar” aparece somente quando não existe contato publicado.
- A página Sobre usa altura natural e aceita textos longos sem caixas fixas.
- Projetos, notas, trajetória e formação consomem publicamente os campos oferecidos pelo editor; documentos privados continuam omitidos da resposta pública.
