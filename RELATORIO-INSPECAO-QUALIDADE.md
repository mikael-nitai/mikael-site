# Relatório de inspeção de qualidade

**Projeto:** Site pessoal de Mikael — Física e Astrofísica  
**Data da inspeção:** 12 de agosto de 2026  
**Versão publicada analisada:** versão 7, commit `190c25b`  
**Site analisado:** <https://mikael-site.mikaelnitai.chatgpt.site>

## 0. Handoff executável para o próximo agente

### Missão

Executar uma refatoração ampla do site até que os fluxos editoriais, a apresentação pública, a acessibilidade, a persistência e a experiência visual estejam operacionais e coerentes com uma experiência premium de registro acadêmico pessoal.

O objetivo não é apenas fazer o build passar. O agente deve corrigir os problemas documentados, testar a utilização real no navegador e demonstrar que cada campo editável produz um resultado previsível, seguro e visível quando deveria.

### Contexto operacional

- Repositório: `C:\Users\User\Documents\ChatGPT\Site pessoal`
- Site publicado: <https://mikael-site.mikaelnitai.chatgpt.site>
- Commit analisado: `190c25b`
- Deploy utiliza D1 para conteúdo editorial e R2 para assets.
- A área editorial é `/edit`, com autenticação ChatGPT e autorização server-side de proprietário único.
- O visitante não deve receber controles editoriais funcionais ou ambíguos.
- Conteúdo real deve ser preservado; não inventar fatos, instituições, datas, projetos, publicações, links ou credenciais.

### Regras de execução para o agente

Antes de implementar:

1. Ler `AGENTS.md`, `README.md`, `PROJECT.md`, `DESIGN.md` e este relatório.
2. Reproduzir pelo menos os problemas `BUG-001` a `BUG-005` antes de alterá-los.
3. Verificar o estado atual de `content/siteData.ts` e do conteúdo persistido antes de criar dados de teste.
4. Separar correções de infraestrutura, contrato de dados, UX editorial, apresentação pública e polimento visual.
5. Não resolver um campo ausente removendo-o silenciosamente do editor. Implementar sua apresentação, torná-lo explicitamente interno ou documentar a decisão.
6. Não trocar proteção server-side por uma condição de cliente, `editMode`, URL secreta ou senha embutida.
7. Não publicar documentos de formação sem uma decisão explícita de visibilidade.
8. Usar conteúdo temporário claramente identificado para testes e removê-lo ao final.

### Definição de pronto

A refatoração só deve ser considerada concluída quando todos os critérios abaixo forem demonstrados:

- o clique público em “Editar site” leva a `/edit` e o fluxo de autenticação funciona;
- acesso direto e refresh de cada rota renderizam o conteúdo correto no servidor, sem erro de hidratação;
- não há erros ou warnings recorrentes no console durante os fluxos principais;
- nenhuma ação de edição navega por acidente ou utiliza elementos interativos aninhados;
- “Ocultar” é reversível e não apaga conteúdo sem uma ação destrutiva explícita;
- criação, edição, ocultação, restauração e exclusão têm feedback e estados de erro claros;
- formação complementar mostra todos os dados que forem definidos como públicos;
- PDF privado permanece inacessível para visitantes e PDF público possui prévia ou fallback acessível, metadados claros e abertura segura;
- upload falho não deixa assets órfãos, ou existe compensação/limpeza documentada;
- todos os campos do editor têm um consumidor público ou uma indicação explícita de que são internos;
- modal, menu e controles editoriais funcionam com teclado, foco visível, `Esc` e leitores de tela;
- desktop e mobile não apresentam overflow horizontal, cortes, sobreposição ou ações escondidas;
- animações respeitam `prefers-reduced-motion` desde o primeiro frame;
- títulos, espaçamento, contraste, microcopy e estados vazios mantêm a atmosfera editorial noturna sem aparência de protótipo;
- `typecheck`, `lint`, testes, build e testes E2E principais passam.

### Backlog canônico

Os IDs abaixo devem ser usados nas branches, commits, testes e comentários da próxima etapa.

| ID | Prioridade | Estado | Tema | Critério de aceite principal |
|---|---|---|---|---|
| BUG-001 | P1 | Confirmado | Entrada em `/edit` | Clique público funciona, mantém a gate anônima e chega ao modo proprietário após autenticação |
| BUG-002 | P1 | Confirmado | SSR/hidratação | Cada rota direta entrega seu conteúdo correto no HTML inicial e não gera React #418 |
| BUG-003 | P1 | Confirmado | Edição inline | “Editar botão” edita sem navegar; links de navegação continuam navegando |
| BUG-004 | P1 | Confirmado | Ocultar/excluir | Ocultar muda status e permite restaurar; exclusão permanente exige ação separada |
| BUG-005 | P1/P2 | Confirmado | PDF/certificado | Upload, privacidade, prévia, metadados, abertura e fallback funcionam ponta a ponta |
| DATA-001 | P1/P2 | Risco de código | Assets órfãos | Falhas de persistência limpam ou reconciliam uploads e substituições |
| DATA-002 | P1 | Risco de código | Tipos de privacidade | API valida booleanos, MIME, tamanho, referências e nunca expõe documento privado |
| UX-001 | P2 | Confirmado | Modal editorial | Foco inicial, foco preso, `Esc`, fechamento e restauração funcionam |
| UX-002 | P2 | Confirmado | Lista de formação | Metadados, documento e edição formam uma unidade visual em desktop e mobile |
| UX-003 | P2 | Confirmado | GSAP | Seletores vazios não geram warnings e reduced motion é respeitado desde o primeiro frame |
| UX-004 | P2 | Confirmado | Menu mobile | Estado fechado não entra no foco/árvore acessível e possui fechamento por teclado |
| UX-005 | P2 | Confirmado | Cobertura de campos | Cada campo editorial tem apresentação pública ou indicação de uso interno |
| DESIGN-001 | P2 | Confirmado | Coerência pública/editorial | O visitante não vê controles quebrados ou ambíguos e o proprietário identifica claramente suas ações |
| DESIGN-002 | P2/P3 | Confirmado | Acabamento premium | Hierarquia, ritmo, copy, estados vazios, movimento e responsividade parecem deliberados |
| TEST-001 | P1 | Ausente | E2E | Fluxos críticos são cobertos por navegador real, não apenas por regex ou teste de API |

## 0.1. Especificação dos itens para implementação

### BUG-001 — Entrada em `/edit`

**Reprodução:** abrir o site público, clicar no link “Editar site” e observar que a URL permanece na home e o console registra erro de `next/link`/Vinext.

**Arquivos de referência:** `app/home/HomeExperience.tsx:796`, `app/edit/page.tsx`, `app/edit/EditRedirect.tsx`.

**Aceite:**

- clique com mouse, teclado e leitor de tela ativa `/edit`;
- visitante anônimo vê a área reservada e não conteúdo editorial;
- proprietário autenticado chega ao modo de edição;
- “Voltar ao site” retorna para a experiência pública;
- não há erro de prefetch ou transição no console;
- existe teste E2E para o fluxo.

### BUG-002 — Rotas e hidratação

**Reprodução:** fazer GET direto em `/contato` ou outra rota secundária e comparar o HTML inicial com o conteúdo após hidratação.

**Arquivos de referência:** `app/[...slug]/page.tsx`, `app/home/HomeExperience.tsx:1116`.

**Aceite:**

- `/sobre`, `/trajetoria`, `/projetos`, `/caderno`, `/formacao` e `/contato` retornam conteúdo específico no servidor;
- refresh e abertura em nova aba mantêm a rota correta;
- não existe flash da home em rota secundária;
- não há React #418 ou outros erros de hidratação;
- títulos, landmarks e headings são coerentes com a URL.

### BUG-003 — Edição inline

**Reprodução:** no modo proprietário, clicar em “Editar botão” na CTA da home ou no retorno de contato.

**Arquivos de referência:** `app/home/HomeExperience.tsx:231`, `:598`, `:763`.

**Aceite:**

- nenhum `<button>` fica aninhado em `<a>`;
- clique em editar abre campo editável e não navega;
- salvar, cancelar e erro de salvamento têm feedback;
- teclado consegue abrir, editar, salvar e cancelar;
- os links normais continuam funcionando no modo visitante.

### BUG-004 — Ocultar e restaurar

**Reprodução:** no editor, selecionar “Ocultar” em um item e verificar que a API executa `DELETE` e remove o item do array.

**Arquivos de referência:** `app/home/HomeExperience.tsx`, `app/api/content/route.ts:181`, `content/editorial.ts`.

**Aceite:**

- ocultar grava status `hidden` ou equivalente reversível;
- item oculto não aparece para visitante;
- proprietário consegue filtrar e restaurar o item;
- exclusão permanente possui confirmação específica, linguagem explícita e não é usada por “Ocultar”;
- falha de API não remove o item visualmente sem confirmação do servidor.

### BUG-005 — Formação complementar e PDF

**Reprodução:** abrir uma formação com documento anexado no editor e observar que há somente link para outra aba, sem prévia nem metadados completos.

**Arquivos de referência:** `app/home/HomeExperience.tsx:334`, `:827`, `:970`, `:1103`; `app/api/assets/route.ts`; `content/editorial.ts`.

**Aceite mínimo:**

- PDF é aceito com limite de tamanho e MIME validado no servidor;
- documento é privado por padrão;
- visitante não consegue adivinhar ou acessar asset privado;
- proprietário vê documento anexado, nome, tipo, tamanho e estado de privacidade;
- existe prévia segura ou fallback acessível para abrir o documento;
- quando o documento é público, o visitante vê apenas os dados definidos como públicos;
- erro de upload, preview ou abertura possui mensagem útil;
- substituir/remover arquivo não deixa referência quebrada ou asset órfão;
- capa opcional é exibida, usada ou removida do formulário com decisão documentada.

### DATA-001 e DATA-002 — Integridade e privacidade

**Aceite:**

- operações relacionadas a item e asset são transacionais ou possuem compensação;
- referências antigas são removidas com segurança quando um asset é substituído;
- `documentPublic` só aceita booleano real;
- MIME, tamanho, nome e extensão são validados no servidor;
- todas as rotas de escrita verificam identidade no servidor, independentemente do estado do cliente;
- respostas públicas não contêm identificadores ou metadados de documentos privados;
- testes cobrem combinações pública/privada e falhas intermediárias.

### UX-001 — Modal e teclado

**Aceite:**

- abrir o modal move foco para o título ou primeiro campo;
- `Esc` fecha quando não há confirmação pendente;
- Tab não escapa do modal;
- fechar restaura foco ao elemento que abriu;
- erros de validação levam foco ao campo relevante;
- `aria-labelledby`, `aria-describedby` e estados de busy/error são coerentes.

### UX-002 — Formação e documentos na lista

**Aceite:**

- cada item possui uma relação visual clara entre título, instituição, período, metadados, documento e ações;
- o botão de edição não ocupa uma área desproporcional;
- o layout funciona em pelo menos 390 px e desktop amplo;
- links de documento têm texto e estado de privacidade compreensíveis;
- nenhuma informação importante depende apenas de cor ou posição.

### UX-003 e UX-004 — Movimento e navegação

**Aceite:**

- animações só são inicializadas quando os alvos existem;
- não há `GSAP target not found` no console;
- `prefers-reduced-motion` evita movimento desde a renderização inicial;
- menu fechado não disponibiliza links invisíveis ao foco;
- menu abre, fecha, responde a `Esc` e anuncia `aria-expanded` corretamente;
- não há overflow horizontal causado por animações.

### UX-005, DESIGN-001 e DESIGN-002 — Coerência e acabamento

**Aceite:**

- a decisão sobre o link editorial público está documentada e implementada;
- todo campo que exige trabalho do proprietário produz resultado perceptível ou está claramente marcado como interno;
- estados vazios, loading, erro, sucesso e documento privado parecem deliberados;
- microcopy é revisada sem inventar fatos;
- títulos mantêm largura e ritmo editorial, sem blocos excessivamente estreitos;
- CTAs têm contraste e hierarquia claros;
- grids não deixam lacunas acidentais ou controles soltos;
- movimento é discreto, útil e não compete com leitura;
- a composição permanece coerente em mobile e desktop.

## 0.2. Sequenciamento recomendado

### Fase 0 — Baseline e testes

- criar uma branch de trabalho;
- reproduzir os bugs confirmados;
- criar testes E2E mínimos para rotas, `/edit`, editor e documentos;
- registrar screenshots/console antes da refatoração.

### Fase 1 — Roteamento e navegação

- corrigir SSR das rotas;
- consolidar uma estratégia de links internos compatível com Vinext;
- corrigir entrada e saída do modo editorial;
- remover hidratação divergente.

### Fase 2 — Modelo editorial e persistência

- corrigir ocultação reversível;
- endurecer validação de payloads;
- reconciliar uploads e referências de assets;
- preservar privacidade em todas as combinações de estado.

### Fase 3 — Editor e acessibilidade

- corrigir semântica de ações inline;
- implementar foco, `Esc`, foco preso e feedback de formulários;
- reorganizar drawer e lista de formação;
- corrigir menu mobile.

### Fase 4 — Apresentação pública completa

- decidir e implementar detalhe de notas e projetos;
- exibir ou classificar explicitamente os campos atualmente omitidos;
- implementar experiência de PDF/certificado;
- revisar estados vazios e conteúdo privado.

### Fase 5 — Design premium e hardening

- eliminar warnings do GSAP;
- revisar ritmo vertical, densidade, contraste, copy e microinterações;
- revisar dependências externas de imagens/fontes;
- validar desktop, mobile, reduced motion e teclado;
- executar a matriz completa de regressão antes do deploy.

## 0.3. Matriz de regressão obrigatória

| Fluxo | Visitante | Proprietário | Desktop | Mobile | Resultado esperado |
|---|---:|---:|---:|---:|---|
| Home e navegação interna | Sim | Sim | Sim | Sim | Sem erro, sem overflow, rota correta |
| Abertura direta de cada rota | Sim | Sim | Sim | Sim | HTML e hidratação coerentes |
| Entrada em `/edit` | Sim | Sim | Sim | Sim | Gate anônima e modo proprietário funcional |
| Edição inline | Não | Sim | Sim | Sim | Edita sem navegação acidental |
| Criar formação sem PDF | Não | Sim | Sim | Sim | Validação, salvamento e apresentação corretos |
| Criar formação com PDF privado | Não | Sim | Sim | Sim | Documento protegido e prévia do proprietário |
| Publicar PDF explicitamente | Sim | Sim | Sim | Sim | Documento público somente após confirmação |
| Ocultar e restaurar item | Não | Sim | Sim | Sim | Sem perda de conteúdo |
| Abrir e fechar modal | Não | Sim | Sim | Sim | Foco e teclado corretos |
| Menu mobile | Sim | Sim | Não | Sim | Acessível, previsível e sem links invisíveis focáveis |
| Reduced motion | Sim | Sim | Sim | Sim | Sem movimento não solicitado |

## 0.4. Entrega esperada do próximo agente

Ao concluir a refatoração, o agente deve retornar:

1. resumo das mudanças por fase;
2. lista de arquivos alterados;
3. tabela `ID -> correção -> teste realizado` para todos os IDs do backlog;
4. evidência dos fluxos E2E críticos;
5. resultado de typecheck, lint, testes e build;
6. confirmação de que não houve conteúdo inventado ou exposição de dados privados;
7. limitações restantes, se houver;
8. screenshots ou descrição objetiva das melhorias de UX quando a alteração for visual.

## 1. Objetivo e escopo

Esta inspeção avaliou o repositório e a utilização real do site publicado, procurando:

- bugs funcionais e regressões;
- problemas de rotas, autenticação, persistência e privacidade;
- inconsistências entre o editor e a apresentação pública;
- comportamento de campos de informação;
- fluxo de certificados e documentos PDF;
- acessibilidade e navegação por teclado;
- responsividade e overflow em desktop e mobile;
- qualidade visual, ritmo, hierarquia e percepção de acabamento premium;
- warnings, erros de console e fragilidades detectáveis na execução real.

Nenhum arquivo-fonte foi alterado durante a inspeção. O relatório foi produzido separadamente para documentar as descobertas.

## 2. Método

Foram revisados os documentos de orientação do projeto, a estrutura de dados, as páginas, os componentes, as APIs, as rotas de autenticação, o armazenamento editorial e os testes existentes.

Também foram executados:

- navegação pública no site publicado;
- navegação direta para `/`, `/sobre`, `/trajetoria`, `/projetos`, `/caderno`, `/formacao`, `/contato` e `/edit`;
- autenticação real do proprietário e entrada no modo editorial;
- retorno ao modo visitante;
- clique real no botão público “Editar site”;
- abertura dos diálogos de edição e do formulário de formação;
- inspeção do item de formação com documento já anexado;
- testes anônimos de sessão, conteúdo e assets;
- inspeção de layout em desktop e viewport mobile de 390 px;
- typecheck, lint, testes automatizados e build.

Não foi feito um novo upload de PDF ou imagem, porque isso criaria uma alteração persistente em D1/R2 durante uma auditoria que havia sido solicitada sem mudanças no produto. O fluxo foi inspecionado com o documento existente e pela leitura do código de upload, persistência e exibição.

## 3. Resumo executivo

O site possui uma base visual consistente: atmosfera noturna, composição editorial, boa hierarquia de títulos, contraste adequado e comportamento responsivo sem overflow horizontal observado. A autenticação direta, a separação entre proprietário e visitante e a proteção de documentos privados funcionaram.

Entretanto, a versão analisada ainda não deve ser considerada estável para uso editorial. O principal fluxo do produto — entrar no modo de edição pelo site público — está quebrado. Também existem falhas de hidratação, controles de edição com semântica incorreta, exclusão permanente disfarçada de ocultação e uma diferença significativa entre os campos oferecidos pelo editor e o conteúdo efetivamente apresentado aos visitantes.

Além dos bugs, alguns elementos reduzem a percepção de acabamento premium: transições com erros no console, falta de prévia de documentos, controles desalinhados, modal sem foco adequado e microcopy pouco refinada.

## 4. Classificação de prioridade

- **P1:** problema de alto impacto funcional, confiança, privacidade ou perda de conteúdo.
- **P2:** problema importante de UX, acessibilidade, consistência ou acabamento, mas que não bloqueia todo o site.
- **P3:** melhoria de qualidade, manutenção ou polimento editorial.

## 5. Descobertas principais

### P1 — O botão público “Editar site” não funciona

**Comportamento observado:**

- o link aparece no rodapé;
- o `href` é `/edit`;
- o clique real não muda a URL;
- o visitante permanece na página pública;
- o console registra `TypeError: e is not a function` em um chunk de `next/link`/Vinext;
- também aparece erro de configuração de prefetch RSC.

**O que funciona:** acessar `/edit` diretamente abre a área reservada; a autenticação ChatGPT e a autorização do proprietário funcionam depois do login.

**Causa provável:** o rodapé usa `next/link` em [app/home/HomeExperience.tsx:796](app/home/HomeExperience.tsx#L796), enquanto a aplicação possui um componente de navegação próprio baseado em History API. A integração de `next/link` com a implementação atual do Vinext está falhando no clique. O link “Voltar ao site” em [app/edit/page.tsx](app/edit/page.tsx) apresenta o mesmo risco estrutural.

**Impacto:** o principal ponto de entrada para a edição deixa de funcionar para o proprietário.

### P1 — Hidratação incorreta nas rotas secundárias

[app/[...slug]/page.tsx](app/%5B...slug%5D/page.tsx) sempre renderiza `HomeExperience`. No servidor, o estado inicial da rota é `/`, porque `window` não existe. No navegador, o componente identifica a URL real e muda para a rota correta.

**Evidências:**

- uma requisição direta para `/contato` recebe HTML inicial com conteúdo da home;
- após a hidratação, o conteúdo de contato aparece;
- o console registra `Minified React error #418`;
- esse comportamento ocorre nas páginas secundárias.

**Impacto:** flash de conteúdo errado, inconsistência para acesso sem JavaScript, risco de SEO ruim e console contaminado por erro de hidratação.

A lógica do estado inicial está em [app/home/HomeExperience.tsx:1116](app/home/HomeExperience.tsx#L1116). Os testes atuais não detectam o problema porque apenas verificam se a resposta contém o nome “Mikael”, e não se a rota renderiza o conteúdo correto no servidor.

### P1 — “Editar botão” navega em vez de editar

`InlineTextEditor` renderiza um `<button>` dentro de um `<a>`. O problema ocorre, entre outros pontos, em:

- [app/home/HomeExperience.tsx:598](app/home/HomeExperience.tsx#L598);
- [app/home/HomeExperience.tsx:763](app/home/HomeExperience.tsx#L763).

**Comportamento observado:** ao clicar em “Editar botão”, nenhuma área de edição aparece; o link pai é acionado e o navegador vai para `/sobre`.

Além de falhar funcionalmente, essa estrutura usa dois elementos interativos aninhados, o que é HTML inválido e pode produzir resultados inconsistentes para teclado, leitores de tela e eventos de clique.

### P1 — “Ocultar” exclui o item permanentemente

No editor, a ação é apresentada como “Ocultar”, mas chama `DELETE /api/content`. Em [app/api/content/route.ts:181](app/api/content/route.ts#L181), o item é removido do array persistido.

Isso contradiz:

- a existência do status editorial `hidden`;
- a expectativa de uma ação reversível;
- a orientação de design de preferir ocultação a exclusão;
- a possibilidade de restauração pelo proprietário.

**Impacto:** risco de perda definitiva de conteúdo e quebra de confiança na interface editorial.

### P1/P2 — Certificados não possuem prévia interna nem metadados completos

O formulário de formação aceita PDF e imagens e o item existente é reconhecido como documento anexado. Porém, a interface não fornece uma prévia do documento dentro do site.

Não foram encontrados `iframe`, `object`, `embed` ou visualizador próprio. O fluxo termina em um link “Abrir documento atual” ou “Ver documento”, que abre o arquivo em outra aba.

Também não são exibidos:

- nome do arquivo;
- tamanho;
- data de envio;
- quantidade de páginas;
- capa ou miniatura;
- status de processamento;
- descrição completa do certificado.

Na apresentação pública, [app/home/HomeExperience.tsx:334](app/home/HomeExperience.tsx#L334) mostra apenas título, instituição, ano e, quando permitido, o link para o documento. Os campos `hours`, `category` e `description` podem ser persistidos, mas não aparecem na lista pública.

### P1/P2 — Campos do editor sem consumidor público

Há uma diferença entre o que o editor permite cadastrar e o que o visitante consegue consultar.

#### Formação

O editor oferece título, instituição, ano, horas, categoria, descrição, capa e documento. A área pública mostra somente título, instituição, ano e documento.

#### Projetos

O editor oferece descrição curta, período, status, tecnologias, GitHub, demo, texto longo, imagem e texto alternativo. A página pública mostra os dados resumidos, mas não apresenta o corpo longo, GitHub ou demo.

#### Caderno

O editor oferece corpo rico, área, data, tags e capa. O visitante vê resumo e metadados, mas não há rota de detalhe nem renderização do corpo completo. O texto pode ser salvo e ficar inacessível para o público.

#### Trajetória

O editor aceita categoria, mas a timeline não a apresenta.

#### Identidade

O modelo suporta nome, função, localização e descrição, porém a edição inline permite alterar apenas a descrição. Isso cria uma diferença entre o modelo de dados e a capacidade real do editor.

### P2 — Modal editorial sem gestão adequada de foco

O drawer possui `role="dialog"` e `aria-modal`, mas:

- o foco não vai automaticamente para o primeiro campo;
- `Esc` não fecha o modal;
- não há foco preso no diálogo;
- não há restauração explícita de foco ao fechar;
- não há `aria-describedby` associado ao contexto do diálogo.

Para usuários de teclado, o foco pode permanecer atrás do overlay enquanto o formulário está aberto.

O componente está em [app/home/HomeExperience.tsx:818](app/home/HomeExperience.tsx#L818).

### P2 — Formação com documento fica visualmente desalinhada

Quando o item possui documento e botão de edição:

- no desktop, o botão “Editar” ocupa uma linha/coluna desproporcional;
- o link do documento fica separado do conteúdo principal;
- no mobile, ano, documento e edição ficam distribuídos em linhas diferentes;
- a relação entre item, documento e ação fica pouco evidente.

O problema está ligado ao grid `.learning-row` em [app/globals.css:222](app/globals.css#L222).

### P2 — Warnings do GSAP em rotas sem os elementos esperados

O hook de animação inicializa seletores mesmo quando não há elementos correspondentes na rota. O console registra repetidamente `GSAP target not found`.

A lógica está em [app/home/HomeExperience.tsx:1258](app/home/HomeExperience.tsx#L1258).

O warning não impede o uso, mas reduz a confiabilidade da camada de movimento e torna mais difícil distinguir problemas reais de ruído de inicialização.

### P2 — Menu mobile invisível permanece semanticamente disponível

O menu fechado usa `opacity: 0` e `pointer-events: none`, mas não utiliza `aria-hidden`, `display: none` ou outra estratégia equivalente. Os links invisíveis podem continuar no fluxo de foco ou na árvore acessível.

Também não foi encontrada uma ação de fechamento por `Esc` ou por clique fora.

## 6. Revisão de design e experiência premium

Esta revisão foi realizada separadamente da verificação técnica. O objetivo foi avaliar se o resultado final transmite cuidado, confiança, clareza e acabamento, mesmo quando uma determinada estrutura não produz um erro de código.

### Pontos positivos

- Fundo azul-preto e detalhes frios coerentes com o tema astronômico.
- Tipografia serifada e composição editorial apropriadas para um registro acadêmico pessoal.
- Hero assimétrico com boa presença visual em desktop.
- Títulos com boa escala e espaço generoso.
- Contraste geral legível.
- Layout mobile sem overflow horizontal observado.
- O site evita aparência corporativa, infantil ou excessivamente neon.

### Pontos que reduzem a percepção premium

#### Entrada editorial visível, mas quebrada

Expor “Editar site” no rodapé pode ser aceitável como uma entrada discreta para o proprietário, mas sua presença precisa ser impecável. Atualmente, o controle é visível para qualquer visitante e não funciona ao ser clicado. Isso transforma um detalhe de acabamento em uma quebra perceptível de confiança.

Além disso, o manual do projeto afirma que o modo público deve permanecer sem controles editoriais. É necessário decidir se o link do rodapé é uma exceção deliberada ou se deve ficar restrito ao proprietário.

#### Editor e site público não parecem o mesmo produto

O editor permite cadastrar horas, categorias, descrições longas, links, tags e documentos, mas a experiência pública omite vários desses dados. Isso cria a sensação de um sistema incompleto: o usuário investe esforço no editor, mas não vê o resultado final.

#### Documentos tratados como anexos técnicos

Abrir um PDF em outra aba é funcional, mas não proporciona uma experiência editorial premium. Para um site acadêmico, seria mais coerente apresentar uma miniatura, título, tipo de documento, status de privacidade e uma prévia segura antes de abrir o arquivo completo.

#### Hierarquia das ações editoriais

Documento, ano e botão de edição ficam visualmente separados. A ação primária não se destaca de maneira consistente e o usuário precisa reconstruir mentalmente qual controle pertence a qual item.

#### Modal sem acabamento de interação

Um drawer sem foco inicial, sem `Esc` e sem restauração de foco transmite sensação de protótipo, mesmo que visualmente esteja bem estilizado. Em uma experiência premium, essas microinterações precisam ser invisíveis e previsíveis.

#### Movimento com pouca tolerância a estados diferentes

Warnings do GSAP indicam que a animação não está totalmente sincronizada com a estrutura de cada rota. Movimento refinado depende de iniciar apenas quando os elementos existem e de respeitar corretamente `prefers-reduced-motion` desde o primeiro frame.

#### Marquee de interesses

O marquee duplica os itens para criar continuidade, mas não está claramente oculto de leitores de tela e pode parecer ornamental demais se não houver uma função editorial clara. Em telas menores, movimento contínuo também pode competir com a leitura principal.

#### Microcopy

O texto inicial de apresentação contém construção gramatical e ritmo pouco naturais, como “Bem vindo” e uma frase excessivamente longa. O conteúdo não parece falso, mas uma revisão editorial deixaria a primeira impressão mais segura e autoral.

#### Dependências visuais externas

Fontes carregadas externamente e imagens de placeholder de terceiros podem produzir variações de carregamento, mudança de layout ou aparência diferente em condições de rede lenta. Uma experiência premium precisa prever fallback visual consistente.

## 7. Privacidade e autenticação

Os fluxos normais de proteção funcionaram:

- sessão anônima retorna `authenticated: false` e `canEdit: false`;
- conteúdo em modo editorial retorna `403` para visitante;
- escrita de conteúdo retorna `403` sem autorização;
- upload de asset retorna `403` sem autorização;
- documento privado retorna `403` para visitante;
- conteúdo público não expõe o identificador de documento privado;
- ao usar “Visualizar como visitante”, os controles editoriais desaparecem.

O código relevante está em [app/api/assets/route.ts](app/api/assets/route.ts), [app/api/content/route.ts](app/api/content/route.ts) e [content/editorial.ts:124](content/editorial.ts#L124).

Há, porém, riscos de robustez que merecem correção futura:

- upload em R2 pode ter sucesso e o salvamento em D1 falhar, deixando asset órfão;
- a substituição de um documento não aparenta remover automaticamente o anterior;
- a alteração de visibilidade do asset ocorre antes da confirmação do salvamento completo do item;
- a normalização da API poderia validar com mais rigor tipos como `documentPublic`;
- assets de capa enviados podem ficar sem consumidor visual ou vínculo útil.

## 8. Matriz de cobertura de campos

| Área | Recebe dados no editor | Persiste/API | Aparece para visitante | Avaliação |
|---|---:|---:|---:|---|
| Formação | Sim | Sim | Parcialmente | Horas, categoria, descrição, capa e prévia estão ausentes |
| Projetos | Sim | Sim | Parcialmente | Corpo longo e links não aparecem |
| Caderno | Sim | Sim | Parcialmente | Corpo completo não tem página pública de detalhe |
| Trajetória | Sim | Sim | Parcialmente | Categoria não é apresentada |
| Questões | Sim | Sim | Sim, em parte | Imagens aparecem; vínculo de assets precisa ser revisado |
| Contatos | Sim | Sim | Sim | Fluxo mais completo |
| Identidade | Parcialmente | Sim | Sim | Editor inline expõe apenas descrição |

## 9. Validação técnica

Resultados executados no repositório:

- typecheck: aprovado;
- lint: aprovado com 4 warnings de uso de `<img>`;
- testes: 7/7 aprovados;
- build: aprovado;
- `git status`: sem alterações rastreadas.

Os testes automatizados são insuficientes para cobrir os principais problemas encontrados. Não há cobertura E2E real para:

- clique no botão “Editar site”;
- hidratação de rotas secundárias;
- edição inline de botões;
- foco e fechamento do modal;
- upload e exibição de PDF;
- ocultação e restauração de conteúdo;
- diferença entre dados salvos e apresentação pública.

## 10. Ordem recomendada de correção

1. Corrigir a navegação do botão “Editar site” e adicionar teste E2E desse fluxo.
2. Corrigir o render server-side das rotas e eliminar o erro de hidratação.
3. Separar semanticamente ações de edição e links de navegação.
4. Transformar “Ocultar” em ocultação reversível, com restauração.
5. Definir e implementar a experiência de certificados: prévia, metadados, capa e privacidade.
6. Criar páginas de detalhe para projetos e notas, ou remover campos ainda sem consumidor.
7. Corrigir foco, `Esc`, foco preso e restauração de foco no modal.
8. Reorganizar a linha de formação para aproximar documento, metadados e ação de edição.
9. Corrigir warnings do GSAP e revisar `prefers-reduced-motion` no primeiro frame.
10. Revisar microcopy, marquee, dependências externas de imagem/fonte e a política de exibição do link editorial público.

## Conclusão

O site já possui uma identidade visual forte e uma base técnica funcional, mas a versão analisada ainda apresenta falhas que afetam diretamente a confiança no produto e a percepção de acabamento.

O bug do botão “Editar site” está confirmado no ambiente publicado e deve ser tratado como prioridade máxima. Em paralelo, a inconsistência entre o editor e a experiência pública precisa ser resolvida para que todos os dados cadastrados tenham uma apresentação clara, útil e coerente.
