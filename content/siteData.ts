export type TimelineEntry = {
  period: string;
  title: string;
  institution?: string;
  description: string;
  category: string;
};

export type ProjectEntry = {
  title: string;
  description: string;
  status: string;
  period: string;
  image: string;
  imageAlt: string;
  technologies: string[];
  placeholder?: boolean;
};

export type NoteEntry = {
  title: string;
  summary: string;
  date: string;
  area: string;
  readingTime: string;
  placeholder?: boolean;
};

export type LearningEntry = {
  title: string;
  institution: string;
  year: string;
  category: string;
  placeholder?: boolean;
};

export type QuestionEntry = {
  title: string;
  text: string;
  image: string;
  imageAlt: string;
};

export type HomeContent = {
  heroImage: string;
  heroImageAlt: string;
  overviewTitle: string;
  overviewDescription: string;
  closingEyebrow: string;
  closingTitle: string;
  closingDescription: string;
  closingActionLabel: string;
};

export type AboutContent = {
  title: string;
  body: string;
};

export type ContactContent = {
  eyebrow: string;
  title: string;
  description: string;
  emptyEyebrow: string;
  emptyTitle: string;
  emptyDescription: string;
  backLabel: string;
};

export type ContactEntry = {
  label: string;
  value: string;
  href?: string;
  note?: string;
};

export const siteData = {
  identity: {
    name: "Mikael",
    role: "Estudante de Física · Astrofísica | UFS",
    location: "Brasil",
    description:
      "Um espaço pessoal para registrar a formação em andamento, os projetos que começam a tomar forma e as perguntas que continuam abertas.",
  },
  home: {
    heroImage: "/mikael-portrait.webp",
    heroImageAlt: "Retrato de Mikael em luz baixa, com fundo escuro",
    overviewTitle: "Uma página para acompanhar o caminho.",
    overviewDescription:
      "Bem vindo. Limpe os pés.\nAqui, reuni despretensiosamente fragmentos de quem sou, já fui, e pretendo ser, se trata de um pequeno projeto para organizar os pensamentos",
    closingEyebrow: "Sobre",
    closingTitle: "O próximo registro começa quando houver algo real para contar.",
    closingDescription:
      "Por enquanto, este site é uma base tranquila: uma forma de acompanhar o que estou aprendendo sem apressar conclusões.",
    closingActionLabel: "Abrir espelho",
  } satisfies HomeContent,
  about: {
    title: "Uma formação em andamento, vista de perto.",
    body:
      "Sou estudante do bacharelado em Física com ênfase em Astrofísica na UFS. Este site acompanha o processo de aprender construindo, registrando o que já existe e deixando espaço para o que ainda vai aparecer.",
  } satisfies AboutContent,
  contact: {
    eyebrow: "Contato",
    title: "Um canal público entra aqui quando estiver definido.",
    description:
      "Nenhum e-mail ou perfil social foi informado para publicação. Por isso, esta página não inventa um contato: ela deixa o lugar pronto para receber um no futuro.",
    emptyEyebrow: "Em aberto",
    emptyTitle: "Contato a configurar.",
    emptyDescription:
      "Enquanto isso, você pode voltar ao início para conhecer o caminho, os interesses e a estrutura do site.",
    backLabel: "Voltar ao início",
  } satisfies ContactContent,
  timeline: [
    {
      period: "Agora",
      title: "Bacharelado em Física com ênfase em Astrofísica",
      institution: "Universidade Federal de Sergipe — UFS",
      description:
        "Formação em andamento, com atenção aos fundamentos da Física e ao modo como a Astronomia amplia essas perguntas.",
      category: "Formação atual",
    },
    {
      period: "Antes",
      title: "Ensino médio",
      institution: "Etapa anterior à graduação",
      description:
        "O período que preparou o terreno para seguir estudando ciência com mais tempo, método e curiosidade.",
      category: "Base",
    },
    {
      period: "Sempre",
      title: "Curiosidade por natureza",
      description:
        "Perguntar, investigar respostas e reorganizar o que aprendi faz parte do caminho tanto quanto qualquer marco formal.",
      category: "Princípio",
    },
  ] satisfies TimelineEntry[],
  projects: [
    {
      title: "Primeiro projeto a documentar",
      description:
        "Espaço reservado para um projeto real, com contexto, processo, código e aprendizados registrados com calma.",
      status: "A preencher",
      period: "Em construção",
      image: "/og-sky.jpg",
      imageAlt: "Imagem abstrata com textura luminosa que lembra uma galáxia espiral",
      technologies: ["Contexto", "Processo", "Aprendizados"],
      placeholder: true,
    },
    {
      title: "Espaço para um experimento",
      description:
        "A estrutura aceita projetos de estudo, programação, automação ou ciência sem presumir resultados antes da hora.",
      status: "A preencher",
      period: "Próximo registro",
      image: "/og-sky.jpg",
      imageAlt: "Céu noturno sobre uma paisagem escura, usado como imagem de referência para um futuro projeto",
      technologies: ["Problema", "Método", "Resultado"],
      placeholder: true,
    },
  ] satisfies ProjectEntry[],
  notes: [
    {
      title: "Primeira nota de estudo a publicar",
      summary:
        "Um lugar para transformar anotações dispersas em textos pequenos, claros e honestos.",
      date: "Em breve",
      area: "Caderno",
      readingTime: "A organizar",
      placeholder: true,
    },
    {
      title: "Uma pergunta sobre o tamanho do Universo",
      summary:
        "Registro reservado para uma reflexão de aprendizagem, sem atribuir ao autor um texto que ainda não existe.",
      date: "Em breve",
      area: "Astronomia",
      readingTime: "A organizar",
      placeholder: true,
    },
    {
      title: "Notas de uma leitura futura",
      summary:
        "A estrutura está pronta para receber Markdown, MDX ou outra forma simples de escrita.",
      date: "Em breve",
      area: "Leitura",
      readingTime: "A organizar",
      placeholder: true,
    },
  ] satisfies NoteEntry[],
  learning: [
    {
      title: "Cursos e certificados a organizar",
      institution: "Formação complementar",
      year: "A preencher",
      category: "Registro",
      placeholder: true,
    },
    {
      title: "Atividades e monitorias futuras",
      institution: "Espaço reservado",
      year: "A preencher",
      category: "Atividade",
      placeholder: true,
    },
    {
      title: "Outras experiências de aprendizagem",
      institution: "Espaço reservado",
      year: "A preencher",
      category: "Registro",
      placeholder: true,
    },
  ] satisfies LearningEntry[],
  interests: [
    "Física",
    "Astrofísica",
    "Astronomia",
    "Ciência",
    "Filosofia",
    "Inteligência artificial",
    "Programação",
    "Automações",
    "Ferramentas digitais",
    "Aprendizagem",
  ],
  tools: [
    "Python",
    "Git e GitHub",
    "IA generativa",
    "Codex e Codex CLI",
    "Automações",
    "Linux",
    "Integrações com APIs",
    "Desenvolvimento web básico",
  ],
  questions: [
    {
      title: "Como uma pergunta vira método?",
      text: "A curiosidade é um começo. O estudo aparece quando a pergunta ganha contexto, fontes e alguma forma de teste.",
      image: "/og-sky.jpg",
      imageAlt: "Flores alaranjadas iluminadas em uma paisagem de estudo",
    },
    {
      title: "O que a escala muda?",
      text: "Da experiência cotidiana ao céu profundo, mudar a escala costuma mudar também a maneira de descrever o problema.",
      image: "/og-sky.jpg",
      imageAlt: "Paisagem ampla usada como metáfora para observar diferentes escalas",
    },
    {
      title: "Onde a tecnologia ajuda a aprender?",
      text: "Programar e automatizar podem organizar o caminho, desde que continuem servindo à compreensão e não apenas ao resultado.",
      image: "/og-sky.jpg",
      imageAlt: "Textura de anotações analógicas para uma pergunta de estudo",
    },
  ] satisfies QuestionEntry[],
  contacts: [] as ContactEntry[],
} as const;

export type SiteData = typeof siteData;
