"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { siteData, type LearningEntry, type NoteEntry, type ProjectEntry, type TimelineEntry } from "../../content/siteData";

gsap.registerPlugin(ScrollTrigger);

type Route = "/" | "/sobre" | "/trajetoria" | "/projetos" | "/caderno" | "/formacao" | "/contato";

const routes: Route[] = [
  "/",
  "/sobre",
  "/trajetoria",
  "/projetos",
  "/caderno",
  "/formacao",
  "/contato",
];

const navItems: Array<{ label: string; href: Route }> = [
  { label: "Sobre", href: "/sobre" },
  { label: "Trajetória", href: "/trajetoria" },
  { label: "Projetos", href: "/projetos" },
  { label: "Caderno", href: "/caderno" },
  { label: "Contato", href: "/contato" },
];

const studyImages = [
  "https://picsum.photos/seed/quiet-observation/1200/900",
  "https://picsum.photos/seed/deep-field/1200/900",
  "https://picsum.photos/seed/analog-notes/1200/900",
];

function normalizeRoute(pathname: string): Route {
  return routes.includes(pathname as Route) ? (pathname as Route) : "/";
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function SiteLink({
  href,
  children,
  className = "",
  onNavigate,
  ...props
}: {
  href: Route;
  children: ReactNode;
  className?: string;
  onNavigate: (href: Route) => void;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate(href);
      }}
      {...props}
    >
      {children}
    </a>
  );
}

function ArrowLink({
  href,
  children,
  onNavigate,
  className = "arrow-link",
}: {
  href: Route;
  children: ReactNode;
  onNavigate: (href: Route) => void;
  className?: string;
}) {
  return (
    <SiteLink href={href} className={className} onNavigate={onNavigate}>
      <span>{children}</span>
      <span aria-hidden="true" className="arrow-link-mark">→</span>
    </SiteLink>
  );
}

function SiteHeader({ route, onNavigate }: { route: Route; onNavigate: (href: Route) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <SiteLink href="/" className="wordmark" onNavigate={onNavigate} aria-label="Mikael, início">
          Mikael
        </SiteLink>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span>{menuOpen ? "Fechar" : "Menu"}</span>
          <span aria-hidden="true" className="menu-toggle-line" />
        </button>

        <nav id="primary-navigation" className={`primary-nav ${menuOpen ? "is-open" : ""}`} aria-label="Navegação principal">
          {navItems.map((item) => (
            <SiteLink
              key={item.href}
              href={item.href}
              className={route === item.href ? "is-active" : ""}
              onNavigate={onNavigate}
              aria-current={route === item.href ? "page" : undefined}
            >
              {item.label}
            </SiteLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`page-intro ${align === "center" ? "page-intro-center" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-intro-copy">{description}</p>
    </div>
  );
}

function StatusMark({ children }: { children: ReactNode }) {
  return <span className="status-mark">{children}</span>;
}

function Timeline({ entries, compact = false }: { entries: readonly TimelineEntry[]; compact?: boolean }) {
  return (
    <ol className={`timeline ${compact ? "timeline-compact" : ""}`}>
      {entries.map((entry, index) => (
        <li key={`${entry.title}-${entry.period}`} className="timeline-item">
          <span className={`timeline-node ${index === 0 ? "is-current" : ""}`} aria-hidden="true" />
          <div className="timeline-copy">
            <p className="timeline-period">{entry.period}</p>
            <h3>{entry.title}</h3>
            {entry.institution ? <p className="timeline-institution">{entry.institution}</p> : null}
            <p>{entry.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ProjectMiniCard({ project }: { project: ProjectEntry }) {
  return (
    <article className="project-mini-card">
      <div className="project-mini-image image-reveal">
        <img src={project.image} alt={project.imageAlt} loading="lazy" />
      </div>
      <div className="project-mini-copy">
        <div className="card-line">
          <h3>{project.title}</h3>
          <StatusMark>{project.status}</StatusMark>
        </div>
        <p>{project.description}</p>
        <div className="tag-row" aria-label="Aspectos preparados para o projeto">
          {project.technologies.map((technology) => <span key={technology}>{technology}</span>)}
        </div>
      </div>
    </article>
  );
}

function NoteRow({ note }: { note: NoteEntry }) {
  return (
    <article className="note-row">
      <div>
        <p className="note-area">{note.area}</p>
        <h3>{note.title}</h3>
        <p>{note.summary}</p>
      </div>
      <div className="note-meta">
        <span>{note.date}</span>
        <span>{note.readingTime}</span>
      </div>
    </article>
  );
}

function LearningRow({ entry }: { entry: LearningEntry }) {
  return (
    <article className="learning-row">
      <span className="learning-symbol" aria-hidden="true">+</span>
      <div>
        <h3>{entry.title}</h3>
        <p>{entry.institution}</p>
      </div>
      <span className="learning-year">{entry.year}</span>
    </article>
  );
}

function InterestMarquee() {
  const items = [...siteData.interests, ...siteData.interests];
  return (
    <div className="interest-marquee" aria-label="Interesses de Mikael">
      <div className="marquee-track">
        {items.map((interest, index) => (
          <span key={`${interest}-${index}`}>
            {interest}
            <span className="marquee-divider" aria-hidden="true">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function QuestionCarousel() {
  const [activeQuestion, setActiveQuestion] = useState(0);
  const question = siteData.questions[activeQuestion];

  const move = (direction: -1 | 1) => {
    setActiveQuestion((current) => (current + direction + siteData.questions.length) % siteData.questions.length);
  };

  return (
    <section className="question-carousel" aria-labelledby="questions-title">
      <div className="question-carousel-heading">
        <p className="eyebrow">Perguntas em movimento</p>
        <h2 id="questions-title">Algumas perguntas ficam abertas por mais tempo.</h2>
      </div>
      <div className="question-carousel-stage">
        <p className="question-count" aria-label={`Pergunta ${activeQuestion + 1} de ${siteData.questions.length}`}>
          {String(activeQuestion + 1).padStart(2, "0")} / {String(siteData.questions.length).padStart(2, "0")}
        </p>
        <div className="question-carousel-copy" aria-live="polite">
          <h3>{question.title}</h3>
          <p>{question.text}</p>
        </div>
        <div className="carousel-controls">
          <button type="button" aria-label="Pergunta anterior" onClick={() => move(-1)}>←</button>
          <button type="button" aria-label="Próxima pergunta" onClick={() => move(1)}>→</button>
        </div>
      </div>
    </section>
  );
}

function HomePage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  return (
    <>
      <section className="hero chapter" id="inicio">
        <div className="star-field" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy hero-reveal">
            <p className="hero-kicker">{siteData.identity.role}</p>
            <h1>Mikael</h1>
            <p className="hero-lead">{siteData.identity.description}</p>
            <div className="hero-actions">
              <SiteLink href="/projetos" className="button button-primary" onNavigate={onNavigate}>Ver projetos</SiteLink>
              <SiteLink href="/caderno" className="button button-outline" onNavigate={onNavigate}>Ler caderno</SiteLink>
            </div>
          </div>

          <div className="hero-visual image-reveal">
            <div className="hero-image-frame">
              <img
                src="https://picsum.photos/seed/night-sky-observatory/1600/1300"
                alt="Céu noturno sobre uma paisagem escura, referência visual para a página pessoal"
                fetchPriority="high"
              />
              <div className="celestial-overlay" aria-hidden="true">
                <span className="orbit orbit-one" />
                <span className="orbit orbit-two" />
                <span className="orbit orbit-three" />
                <span className="celestial-cross cross-one" />
                <span className="celestial-cross cross-two" />
                <span className="celestial-dot dot-one" />
                <span className="celestial-dot dot-two" />
                <span className="celestial-dot dot-three" />
              </div>
              <div className="hero-image-caption">Céu profundo como ponto de partida</div>
            </div>
          </div>
        </div>
        <div className="container hero-bottomline">
          <span>Um site pessoal em construção permanente</span>
          <span aria-hidden="true" className="scroll-line" />
          <span>Role para observar o caminho</span>
        </div>
      </section>

      <section className="chapter overview-section" id="panorama">
        <div className="container">
          <div className="section-heading reveal">
            <div>
              <p className="eyebrow">O que estou reunindo</p>
              <h2>Uma página para acompanhar o caminho.</h2>
            </div>
            <p>O site começa pequeno de propósito: algumas áreas honestas, prontas para crescer conforme a formação e os projetos ganham corpo.</p>
          </div>

          <div className="bento-grid">
            <article className="bento-card trajectory-card reveal" id="trajetoria-resumo">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Percurso</p>
                  <h2>Trajetória acadêmica</h2>
                </div>
                <span className="card-index" aria-hidden="true">01</span>
              </div>
              <Timeline entries={siteData.timeline} compact />
              <ArrowLink href="/trajetoria" onNavigate={onNavigate}>Ver toda a trajetória</ArrowLink>
            </article>

            <article className="bento-card projects-card reveal" id="projetos-resumo">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Em preparação</p>
                  <h2>Projetos</h2>
                </div>
                <ArrowLink href="/projetos" onNavigate={onNavigate} className="arrow-link arrow-link-small">Ver todos</ArrowLink>
              </div>
              <div className="project-list">
                {siteData.projects.map((project) => <ProjectMiniCard key={project.title} project={project} />)}
              </div>
            </article>

            <article className="bento-card notebook-card reveal" id="caderno-resumo">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Registro</p>
                  <h2>Notas que vão ganhar corpo <span className="inline-title-image" aria-hidden="true" /></h2>
                </div>
              </div>
              <div className="note-list">
                {siteData.notes.slice(0, 2).map((note) => <NoteRow key={note.title} note={note} />)}
              </div>
              <ArrowLink href="/caderno" onNavigate={onNavigate}>Ir para o caderno</ArrowLink>
            </article>

            <article className="bento-card learning-card reveal" id="formacao-resumo">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Arquivo</p>
                  <h2>Formação complementar</h2>
                </div>
                <ArrowLink href="/formacao" onNavigate={onNavigate} className="arrow-link arrow-link-small">Abrir índice</ArrowLink>
              </div>
              <div className="learning-list">
                {siteData.learning.map((entry) => <LearningRow key={entry.title} entry={entry} />)}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="interest-chapter" aria-label="Interesses">
        <div className="container interest-heading">
          <p className="eyebrow">Eixos de curiosidade</p>
          <p>Astrofísica e Física são o eixo. Tecnologia aparece como ferramenta para perguntar melhor, organizar o estudo e construir pequenas coisas.</p>
        </div>
        <InterestMarquee />
      </section>

      <section className="chapter study-stage" id="estudo">
        <div className="container study-grid">
          <div className="study-stage-intro study-stage-pin">
            <p className="eyebrow">Caderno de campo</p>
            <h2>Aprender também é observar como a pergunta muda.</h2>
            <p>Este espaço foi pensado para notas breves, leituras e pequenos ensaios. A forma pode mudar; o compromisso com a clareza fica.</p>
            <ArrowLink href="/caderno" onNavigate={onNavigate}>Conhecer o caderno</ArrowLink>
          </div>
          <div className="study-stack">
            {siteData.questions.map((question, index) => (
              <article className="study-card image-reveal" key={question.title}>
                <div className="study-card-image">
                  <img src={studyImages[index]} alt="Textura visual abstrata para uma pergunta de estudo" loading="lazy" />
                </div>
                <div className="study-card-copy">
                  <p className="eyebrow">Pergunta em aberto</p>
                  <h3>{question.title}</h3>
                  <p>{question.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="container">
          <QuestionCarousel />
        </div>
      </section>

      <section className="chapter closing-chapter">
        <div className="container closing-cta reveal">
          <p className="eyebrow">Próxima página</p>
          <h2>O próximo registro começa quando houver algo real para contar.</h2>
          <p>Por enquanto, este site é uma base tranquila: uma forma de acompanhar o que estou aprendendo sem apressar conclusões.</p>
          <ArrowLink href="/sobre" onNavigate={onNavigate} className="button button-primary">Conhecer o espaço</ArrowLink>
        </div>
      </section>
    </>
  );
}

function AboutPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  return (
    <div className="inner-page chapter">
      <div className="container">
        <PageIntro
          eyebrow="Sobre"
          title="Uma formação em andamento, vista de perto."
          description="Sou estudante do bacharelado em Física com ênfase em Astrofísica na UFS. Este site acompanha o processo de aprender construindo, registrando o que já existe e deixando espaço para o que ainda vai aparecer."
        />
        <div className="about-layout">
          <article className="editorial-panel reveal">
            <p className="eyebrow">Como penso este espaço</p>
            <h2>Curiosidade antes de performance.</h2>
            <p>Não há uma biografia grandiosa aqui. Há uma formação que está começando, perguntas que continuam abertas e uma vontade de organizar o conhecimento para conseguir voltar a ele depois.</p>
            <p>Física e Astrofísica são o centro acadêmico. Programação, inteligência artificial e ferramentas digitais entram como interesses e instrumentos em desenvolvimento.</p>
          </article>
          <article className="editorial-panel editorial-panel-dark reveal">
            <p className="eyebrow">Ferramentas que uso e estou aprendendo</p>
            <ul className="tool-list">
              {siteData.tools.map((tool) => <li key={tool}>{tool}</li>)}
            </ul>
          </article>
        </div>
        <div className="page-backlink"><ArrowLink href="/" onNavigate={onNavigate}>Voltar ao início</ArrowLink></div>
      </div>
    </div>
  );
}

function TrajectoryPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  return (
    <div className="inner-page chapter">
      <div className="container narrow-container">
        <PageIntro
          eyebrow="Trajetória"
          title="Um caminho que ainda está começando."
          description="A linha do tempo começa com os poucos marcos que fazem sentido agora. Novos eventos entram quando existirem, não para preencher espaço."
        />
        <div className="full-timeline-panel reveal">
          <Timeline entries={siteData.timeline} />
        </div>
        <div className="page-backlink"><ArrowLink href="/" onNavigate={onNavigate}>Voltar ao início</ArrowLink></div>
      </div>
    </div>
  );
}

function ProjectsPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  return (
    <div className="inner-page chapter">
      <div className="container">
        <PageIntro
          eyebrow="Projetos"
          title="A estrutura está pronta para receber trabalho real."
          description="Ainda não há projetos públicos completos para apresentar. Em vez de preencher esta página com conquistas inventadas, deixo a arquitetura preparada para documentar cada projeto quando ele existir."
        />
        <div className="projects-page-grid">
          {siteData.projects.map((project) => (
            <article className="project-large-card reveal" key={project.title}>
              <div className="project-large-image image-reveal">
                <img src={project.image} alt={project.imageAlt} loading="lazy" />
              </div>
              <div className="project-large-copy">
                <div className="card-line"><StatusMark>{project.status}</StatusMark><span className="project-period">{project.period}</span></div>
                <h2>{project.title}</h2>
                <p>{project.description}</p>
                <div className="tag-row">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>
                <p className="placeholder-note">Conteúdo temporário: substituir quando houver um projeto público para documentar.</p>
              </div>
            </article>
          ))}
        </div>
        <div className="page-backlink"><ArrowLink href="/" onNavigate={onNavigate}>Voltar ao início</ArrowLink></div>
      </div>
    </div>
  );
}

function JournalPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  return (
    <div className="inner-page chapter">
      <div className="container narrow-container">
        <PageIntro
          eyebrow="Caderno"
          title="Notas pequenas para não perder o fio."
          description="Um índice pessoal para estudos, leituras e perguntas. As primeiras entradas ainda serão escritas; a estrutura já aceita conteúdo organizado por área, data e tempo de leitura."
        />
        <div className="journal-list reveal">
          {siteData.notes.map((note) => <NoteRow key={note.title} note={note} />)}
        </div>
        <div className="markdown-note reveal">
          <p className="eyebrow">Próxima evolução</p>
          <p>Quando houver textos reais, esta área pode receber Markdown ou MDX sem exigir que a interface seja reescrita.</p>
        </div>
        <div className="page-backlink"><ArrowLink href="/" onNavigate={onNavigate}>Voltar ao início</ArrowLink></div>
      </div>
    </div>
  );
}

function FormationPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  return (
    <div className="inner-page chapter">
      <div className="container narrow-container">
        <PageIntro
          eyebrow="Formação complementar"
          title="Um índice para cursos, atividades e certificados."
          description="A interface mostra apenas metadados públicos apropriados. Documentos originais permanecem privados por padrão e só serão associados quando isso fizer sentido."
        />
        <div className="formation-list reveal">
          {siteData.learning.map((entry) => <LearningRow key={entry.title} entry={entry} />)}
        </div>
        <div className="privacy-panel reveal">
          <p className="eyebrow">Privacidade</p>
          <p>Não há PDFs de certificados nem informações sensíveis publicados nesta primeira versão.</p>
        </div>
        <div className="page-backlink"><ArrowLink href="/" onNavigate={onNavigate}>Voltar ao início</ArrowLink></div>
      </div>
    </div>
  );
}

function ContactPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  return (
    <div className="inner-page chapter contact-page">
      <div className="container narrow-container">
        <PageIntro
          eyebrow="Contato"
          title="Um canal público entra aqui quando estiver definido."
          description="Nenhum e-mail ou perfil social foi informado para publicação. Por isso, esta página não inventa um contato: ela deixa o lugar pronto para receber um no futuro."
        />
        <div className="contact-card reveal">
          <p className="eyebrow">Em aberto</p>
          <h2>Contato a configurar.</h2>
          <p>Enquanto isso, você pode voltar ao início para conhecer a trajetória, os interesses e a estrutura do site.</p>
          <ArrowLink href="/" onNavigate={onNavigate} className="button button-outline">Voltar ao início</ArrowLink>
        </div>
      </div>
    </div>
  );
}

function SiteFooter({ onNavigate }: { onNavigate: (href: Route) => void }) {
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div>
          <SiteLink href="/" className="footer-wordmark" onNavigate={onNavigate}>Mikael</SiteLink>
          <p>Estudante de Física · Astrofísica | UFS</p>
        </div>
        <div className="footer-links">
          <div>
            <p className="eyebrow">Explorar</p>
            <SiteLink href="/sobre" onNavigate={onNavigate}>Sobre</SiteLink>
            <SiteLink href="/trajetoria" onNavigate={onNavigate}>Trajetória</SiteLink>
            <SiteLink href="/projetos" onNavigate={onNavigate}>Projetos</SiteLink>
          </div>
          <div>
            <p className="eyebrow">Registrar</p>
            <SiteLink href="/caderno" onNavigate={onNavigate}>Caderno</SiteLink>
            <SiteLink href="/formacao" onNavigate={onNavigate}>Formação</SiteLink>
            <SiteLink href="/contato" onNavigate={onNavigate}>Contato</SiteLink>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Mikael</span>
        <span>Feito com curiosidade e tempo.</span>
      </div>
    </footer>
  );
}

export default function HomeExperience() {
  const [route, setRoute] = useState<Route>(() => {
    if (typeof window === "undefined") return "/";
    return normalizeRoute(window.location.pathname);
  });
  const pageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const navigate = (nextRoute: Route) => {
    window.history.pushState({}, "", nextRoute);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  useLayoutEffect(() => {
    const syncRoute = () => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useGSAP(() => {
    if (reducedMotion) return;

    const revealTargets = gsap.utils.toArray<HTMLElement>(".hero-reveal, .reveal");
    gsap.fromTo(
      revealTargets,
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.06, clearProps: "transform" },
    );

    gsap.utils.toArray<HTMLElement>(".image-reveal").forEach((element) => {
      gsap.fromTo(
        element,
        { opacity: 0.28, scale: 0.84, filter: "brightness(0.65)" },
        {
          opacity: 1,
          scale: 1,
          filter: "brightness(1)",
          ease: "none",
          scrollTrigger: {
            trigger: element,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    });

    const pinTarget = pageRef.current?.querySelector<HTMLElement>(".study-stage-pin");
    const pinSection = pageRef.current?.querySelector<HTMLElement>(".study-stage");
    if (pinTarget && pinSection && window.matchMedia("(min-width: 900px)").matches) {
      ScrollTrigger.create({
        trigger: pinSection,
        pin: pinTarget,
        start: "top top+=100",
        end: "bottom bottom-=100",
        pinSpacing: false,
      });
    }
  }, { scope: pageRef, dependencies: [route, reducedMotion], revertOnUpdate: true });

  let page: ReactNode;
  if (route === "/sobre") page = <AboutPage onNavigate={navigate} />;
  else if (route === "/trajetoria") page = <TrajectoryPage onNavigate={navigate} />;
  else if (route === "/projetos") page = <ProjectsPage onNavigate={navigate} />;
  else if (route === "/caderno") page = <JournalPage onNavigate={navigate} />;
  else if (route === "/formacao") page = <FormationPage onNavigate={navigate} />;
  else if (route === "/contato") page = <ContactPage onNavigate={navigate} />;
  else page = <HomePage onNavigate={navigate} />;

  return (
    <div className="site-app">
      <SiteHeader key={route} route={route} onNavigate={navigate} />
      <main className="page-shell" ref={pageRef}>{page}</main>
      <SiteFooter onNavigate={navigate} />
    </div>
  );
}
