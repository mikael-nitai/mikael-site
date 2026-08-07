# Mikael site

Site pessoal de Mikael, estudante do bacharelado em Física com ênfase em Astrofísica na Universidade Federal de Sergipe.

## Propósito

O projeto é um espaço pessoal para registrar formação acadêmica, projetos, estudos, interesses e evolução ao longo do tempo. O conteúdo inicial é deliberadamente honesto: quando ainda não há um projeto, texto ou certificado real para publicar, a interface usa um placeholder claramente identificado.

## Stack

- React 19 + TypeScript
- Vinext/Vite com saída compatível com Cloudflare Workers
- GSAP + ScrollTrigger para movimento discreto
- CSS próprio para a identidade visual
- Conteúdo centralizado em `content/siteData.ts`

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

O teste renderiza o HTML do worker e verifica que a página real substituiu o starter, que o título e o conteúdo principal existem e que as regras visuais essenciais permanecem presentes.

## Estrutura

- `app/home/HomeExperience.tsx`: shell da aplicação, navegação e páginas
- `app/globals.css`: tokens, layout, responsividade e animações CSS
- `content/siteData.ts`: dados de trajetória, projetos, notas, formação e interesses
- `public/`: favicon e assets públicos
- `AGENTS.md`: regras permanentes para manutenção por agentes
- `PROJECT.md`: contexto, escopo e backlog
- `DESIGN.md`: decisões de design e referência visual

## Conteúdo

Para adicionar uma entrada, edite primeiro `content/siteData.ts`. A interface consome os arrays centralizados em vez de espalhar fatos biográficos pelos componentes. Não adicione datas, instituições, prêmios, certificados, e-mails ou redes sociais sem confirmação.

## Publicação

O projeto foi preparado para publicação via Sites. Depois de um build válido, o fluxo de hosting deve salvar uma versão e fazer o deploy da fonte validada. O arquivo `.openai/hosting.json` guarda somente bindings de infraestrutura; IDs e credenciais são gerenciados pelo conector.
