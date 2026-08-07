# Manual de agentes

## Finalidade

Este é o site pessoal de Mikael, um estudante de Física com ênfase em Astrofísica na UFS. O produto deve parecer um registro acadêmico pessoal em construção, não um site corporativo, uma consultoria ou um portfólio de profissional sênior.

## Princípios de produto

- Ser honesto sobre o estágio atual da formação.
- Preferir conteúdo concreto e simples a linguagem promocional.
- Fazer o site envelhecer bem: novas pesquisas, textos, projetos e atividades devem caber sem redesenho estrutural.
- Preservar uma atmosfera noturna, editorial e contemplativa inspirada em Astronomia.
- Manter desktop e mobile como experiências igualmente importantes.

## Regras de conteúdo e privacidade

- Não inventar datas, conquistas, pesquisas, publicações, empregos, cargos, certificados, instituições, habilidades ou projetos.
- Quando faltar informação, usar placeholder neutro e marcá-lo como conteúdo temporário.
- Não publicar CPF, RG, matrícula, telefone, endereço, horários, localização rotineira, documentos integrais ou dados sensíveis.
- Não inventar e-mails, perfis sociais ou links externos.
- Certificados podem ter metadados públicos, mas o documento original permanece privado por padrão.

## Identidade visual

- Fundo profundo em azul-preto, detalhes frios em violeta e azul.
- Títulos serifados; textos e metadados com sans-serif limpa e monoespaçada quando necessário.
- Cards discretos, bordas finas, espaço generoso e composição editorial.
- Astronomia aparece por imagens de céu profundo, órbitas e pontos de luz sutis, sem elementos infantis, cyberpunk ou neon exagerado.
- Usar a skill `gpt-taste` durante decisões visuais e manter AIDA, bento denso, títulos largos e movimento GSAP com respeito a `prefers-reduced-motion`.

## Fluxo de trabalho

1. Ler `README.md`, `PROJECT.md` e `DESIGN.md` antes de mudanças estruturais.
2. Conferir o conteúdo atual em `content/siteData.ts` antes de escrever novos fatos.
3. Implementar com componentes simples e dados centralizados.
4. Preservar acessibilidade, foco visível, HTML semântico, alt text e navegação por teclado.
5. Executar typecheck, lint, testes e build antes de considerar a alteração pronta.
6. Revisar mobile, overflow horizontal, links e qualquer conteúdo que possa parecer inventado.

## Critérios de qualidade

Uma alteração só está pronta quando mantém a hierarquia de headings, contraste legível, navegação funcional, layout responsivo, animações discretas, saída de build válida e documentação alinhada ao comportamento real.

Autonomia é preferível: decisões pequenas e médias devem ser tomadas com base neste manual e no briefing. Pergunte apenas quando faltar uma decisão que mude materialmente a funcionalidade ou crie risco de privacidade.
