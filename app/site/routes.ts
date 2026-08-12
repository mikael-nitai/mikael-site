export const siteRoutes = [
  "/",
  "/sobre",
  "/trajetoria",
  "/projetos",
  "/caderno",
  "/formacao",
  "/contato",
] as const;

export type SiteRoute = (typeof siteRoutes)[number];

export type SiteRouteDefinition = {
  route: SiteRoute;
  label: string;
  title: string;
  description: string;
};

export const siteRouteDefinitions: readonly SiteRouteDefinition[] = [
  {
    route: "/",
    label: "Início",
    title: "Mikael — Física, Astrofísica e aprendizagem",
    description: "Site pessoal de Mikael, estudante de Física com ênfase em Astrofísica na UFS.",
  },
  {
    route: "/sobre",
    label: "Sobre",
    title: "Sobre — Mikael",
    description: "Uma apresentação honesta da formação em andamento de Mikael.",
  },
  {
    route: "/trajetoria",
    label: "Meu caminho",
    title: "Trajetória — Mikael",
    description: "Marcos da formação e do caminho acadêmico de Mikael.",
  },
  {
    route: "/projetos",
    label: "Projetos",
    title: "Projetos — Mikael",
    description: "Projetos e experimentos documentados ao longo da formação de Mikael.",
  },
  {
    route: "/caderno",
    label: "Caderno",
    title: "Caderno — Mikael",
    description: "Notas de estudo, leituras e perguntas registradas por Mikael.",
  },
  {
    route: "/formacao",
    label: "Formação",
    title: "Formação complementar — Mikael",
    description: "Cursos, atividades e documentos de formação complementar de Mikael.",
  },
  {
    route: "/contato",
    label: "Contato",
    title: "Contato — Mikael",
    description: "Canais públicos de contato informados por Mikael.",
  },
] as const;

const siteRouteSet = new Set<string>(siteRoutes);

export function isSiteRoute(pathname: string): pathname is SiteRoute {
  return siteRouteSet.has(pathname);
}

export function normalizeSiteRoute(pathname: string): SiteRoute | null {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return isSiteRoute(normalized) ? normalized : null;
}

export function routeFromSlug(slug: readonly string[] | undefined): SiteRoute | null {
  if (!slug?.length) return "/";
  try {
    return normalizeSiteRoute(`/${slug.map((part) => decodeURIComponent(part)).join("/")}`);
  } catch {
    return null;
  }
}

export function routeDefinition(route: SiteRoute): SiteRouteDefinition {
  return siteRouteDefinitions.find((definition) => definition.route === route) ?? siteRouteDefinitions[0];
}

export const primaryNavigation = siteRouteDefinitions.filter((definition) =>
  ["/sobre", "/trajetoria", "/projetos", "/caderno", "/formacao", "/contato"].includes(definition.route),
);
