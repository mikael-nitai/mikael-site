"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  publicEditorContent,
  seedEditorContent,
  type EditableCollection,
  type EditablePage,
  type EditorContent,
  type EditorialStatus,
} from "../../content/editorial";
import { type LearningEntry, type NoteEntry, type ProjectEntry, type TimelineEntry } from "../../content/siteData";

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
  { label: "Meu caminho", href: "/trajetoria" },
  { label: "Projetos", href: "/projetos" },
  { label: "Caderno", href: "/caderno" },
  { label: "Contato", href: "/contato" },
];

type DrawerState = { collection: EditableCollection; id?: string } | null;

type EditorController = {
  content: EditorContent;
  ownerAvailable: boolean;
  editMode: boolean;
  canEdit: boolean;
  drawer: DrawerState;
  statusMessage: string | null;
  openEditor: (collection: EditableCollection, id?: string) => void;
  closeEditor: () => void;
  enterEditMode: () => Promise<void>;
  viewAsVisitor: () => Promise<void>;
  signOut: () => void;
  saveItem: (collection: EditableCollection, id: string | undefined, payload: Record<string, unknown>) => Promise<void>;
  hideItem: (collection: EditableCollection, id: string) => Promise<void>;
  reorder: (collection: EditableCollection, orderedIds: string[]) => Promise<void>;
  saveIdentity: (field: "description", value: string) => Promise<void>;
  savePage: (page: EditablePage, fields: Record<string, string>) => Promise<void>;
  setStatusMessage: (value: string | null) => void;
};

const EditorContext = createContext<EditorController | null>(null);

function useEditor(): EditorController | null {
  return useContext(EditorContext);
}

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
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
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

function ContextEditButton({ label = "Editar", onClick }: { label?: string; onClick: () => void }) {
  const editor = useEditor();
  if (!editor?.canEdit) return null;
  return (
    <button type="button" className="context-edit" onClick={onClick}>
      {label}
    </button>
  );
}

function EditorAddButton({ collection, children }: { collection: EditableCollection; children: ReactNode }) {
  const editor = useEditor();
  if (!editor?.canEdit) return null;
  return (
    <button type="button" className="editor-add" onClick={() => editor.openEditor(collection)}>
      <span aria-hidden="true">+</span> {children}
    </button>
  );
}

function EditorialBadge({ status }: { status?: EditorialStatus }) {
  const editor = useEditor();
  if (!editor?.canEdit || !status || status === "published") return null;
  return <span className={`editorial-badge editorial-badge--${status}`}>{status === "draft" ? "Rascunho" : "Oculto"}</span>;
}

function InlineTextEditor({
  value,
  label,
  onSave,
}: {
  value: string;
  label: string;
  onSave: (value: string) => Promise<void>;
}) {
  const editor = useEditor();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editor?.canEdit) return <>{value}</>;

  if (editing) {
    return (
      <form
        className="inline-editor-form"
        onSubmit={async (event) => {
          event.preventDefault();
          await onSave(draft.trim());
          setEditing(false);
        }}
      >
        <textarea aria-label={label} value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} />
        <span className="inline-editor-actions">
          <button type="submit" className="button button-primary button-small">Salvar</button>
          <button type="button" className="button button-quiet button-small" onClick={() => { setDraft(value); setEditing(false); }}>Cancelar</button>
        </span>
      </form>
    );
  }

  return (
    <span className="inline-editor-value">
      {value}
      <button type="button" className="context-edit" onClick={() => setEditing(true)}>{label}</button>
    </span>
  );
}

function Timeline({ entries, compact = false }: { entries: readonly TimelineEntry[]; compact?: boolean }) {
  const editor = useEditor();
  return (
    <ol className={`timeline ${compact ? "timeline-compact" : ""}`}>
      {entries.map((entry, index) => (
        <li key={`${entry.title}-${entry.period}`} className="timeline-item">
          <span className={`timeline-node ${index === 0 ? "is-current" : ""}`} aria-hidden="true" />
          <div className="timeline-copy">
            <div className="editor-line">
              <p className="timeline-period">{entry.period}</p>
              {editor?.canEdit && "id" in entry ? <ContextEditButton onClick={() => editor.openEditor("timeline", String(entry.id))} /> : null}
            </div>
            <h3>{entry.title} <EditorialBadge status={(entry as TimelineEntry & { editorialStatus?: EditorialStatus }).editorialStatus} /></h3>
            {entry.institution ? <p className="timeline-institution">{entry.institution}</p> : null}
            <p>{entry.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ProjectMiniCard({ project }: { project: ProjectEntry & Partial<{ id: string; editorialStatus: EditorialStatus }> }) {
  const editor = useEditor();
  return (
    <article className="project-mini-card">
      <div className="project-mini-image image-reveal">
        <img src={project.image} alt={project.imageAlt} loading="lazy" />
      </div>
      <div className="project-mini-copy">
        <div className="card-line">
          <h3>{project.title}</h3>
          <span className="card-statuses"><StatusMark>{project.status}</StatusMark><EditorialBadge status={project.editorialStatus} /></span>
        </div>
        <p>{project.description}</p>
        <div className="tag-row" aria-label="Aspectos preparados para o projeto">
          {project.technologies.map((technology) => <span key={technology}>{technology}</span>)}
        </div>
        {editor?.canEdit && project.id ? <ContextEditButton onClick={() => editor.openEditor("projects", project.id)} /> : null}
      </div>
    </article>
  );
}

function NoteRow({ note }: { note: NoteEntry & Partial<{ id: string; editorialStatus: EditorialStatus }> }) {
  const editor = useEditor();
  return (
    <article className="note-row">
      <div>
        <p className="note-area">{note.area}</p>
        <h3>{note.title} <EditorialBadge status={note.editorialStatus} /></h3>
        <p>{note.summary}</p>
      </div>
      <div className="note-meta">
        <span>{note.date}</span>
        <span>{note.readingTime}</span>
        {editor?.canEdit && note.id ? <ContextEditButton onClick={() => editor.openEditor("notes", note.id)} /> : null}
      </div>
    </article>
  );
}

function LearningRow({ entry }: { entry: LearningEntry & Partial<{ id: string; editorialStatus: EditorialStatus; documentAssetId: string; documentPublic: boolean }> }) {
  const editor = useEditor();
  const canViewDocument = Boolean(entry.documentAssetId && (entry.documentPublic || editor?.canEdit));
  return (
    <article className="learning-row">
      <span className="learning-symbol" aria-hidden="true">+</span>
      <div>
        <h3>{entry.title} <EditorialBadge status={entry.editorialStatus} /></h3>
        <p>{entry.institution}</p>
      </div>
      <span className="learning-year">{entry.year}</span>
      {canViewDocument ? <a className="learning-document-link" href={`/api/assets?id=${encodeURIComponent(entry.documentAssetId ?? "")}`} target="_blank" rel="noreferrer">Ver documento</a> : null}
      {editor?.canEdit && entry.id ? <ContextEditButton onClick={() => editor.openEditor("learning", entry.id)} /> : null}
    </article>
  );
}

function InterestMarquee({ interests }: { interests: readonly string[] }) {
  const items = [...interests, ...interests];
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

function InterestEditor() {
  const editor = useEditor();
  if (!editor?.canEdit) return null;

  const move = (index: number, direction: -1 | 1) => {
    const next = [...editor.content.interests];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void editor.reorder("interests", next.map((item) => item.id));
  };

  return (
    <div className="interest-editor" aria-label="Editar interesses">
      <div className="editor-line">
        <span className="editor-helper">Interesses exibidos no movimento acima</span>
        <EditorAddButton collection="interests">Adicionar interesse</EditorAddButton>
      </div>
      <div className="interest-editor-list">
        {editor.content.interests.map((interest, index) => (
          <span className="interest-editor-item" key={interest.id}>
            <span>{interest.value}</span>
            <ContextEditButton label="Renomear" onClick={() => editor.openEditor("interests", interest.id)} />
            <button type="button" className="context-icon" aria-label={`Mover ${interest.value} para cima`} onClick={() => move(index, -1)}>↑</button>
            <button type="button" className="context-icon" aria-label={`Mover ${interest.value} para baixo`} onClick={() => move(index, 1)}>↓</button>
            <button type="button" className="context-icon context-icon-danger" aria-label={`Remover ${interest.value}`} onClick={() => void editor.hideItem("interests", interest.id)}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

function QuestionCarousel({ questions }: { questions: EditorContent["questions"] }) {
  const editor = useEditor();
  const [activeQuestion, setActiveQuestion] = useState(0);
  const question = questions[activeQuestion] ?? questions[0];

  const move = (direction: -1 | 1) => {
    setActiveQuestion((current) => (current + direction + questions.length) % questions.length);
  };

  if (!question) return null;

  return (
    <section className="question-carousel" aria-labelledby="questions-title">
      <div className="question-carousel-heading">
        <p className="eyebrow">Perguntas em movimento</p>
        <h2 id="questions-title">Algumas perguntas ficam abertas por mais tempo.</h2>
      </div>
      <div className="question-carousel-stage">
        <p className="question-count" aria-label={`Pergunta ${activeQuestion + 1} de ${questions.length}`}>
          {String(activeQuestion + 1).padStart(2, "0")} / {String(questions.length).padStart(2, "0")}
        </p>
        <div className="question-carousel-copy" aria-live="polite">
          <div className="editor-line">
            <h3>{question.title}</h3>
            {editor?.canEdit ? <ContextEditButton onClick={() => editor.openEditor("questions", question.id)} /> : null}
          </div>
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
  const editor = useEditor();
  const content = editor?.content ?? seedEditorContent();
  const home = content.home;
  return (
    <>
      <section className="hero chapter" id="inicio">
        <div className="star-field" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy hero-reveal">
            <h1>Mikael</h1>
            <p className="hero-lead"><InlineTextEditor value={content.identity.description} label="Editar apresentação" onSave={(value) => editor?.saveIdentity("description", value) ?? Promise.resolve()} /></p>
            <div className="hero-actions">
              <SiteLink href="/projetos" className="button button-primary" onNavigate={onNavigate}>Ver projetos</SiteLink>
              <SiteLink href="/caderno" className="button button-outline" onNavigate={onNavigate}>Ler caderno</SiteLink>
            </div>
          </div>

          <div className="hero-visual image-reveal">
            <div className="hero-image-frame">
              <img
                src={home.heroImage}
                alt={home.heroImageAlt}
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
              <h2><InlineTextEditor value={home.overviewTitle} label="Editar título" onSave={(value) => editor?.savePage("home", { overviewTitle: value }) ?? Promise.resolve()} /></h2>
            </div>
            <p className="overview-description"><InlineTextEditor value={home.overviewDescription} label="Editar texto" onSave={(value) => editor?.savePage("home", { overviewDescription: value }) ?? Promise.resolve()} /></p>
          </div>

          <div className="bento-grid">
            <article className="bento-card trajectory-card reveal" id="trajetoria-resumo">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Percurso</p>
                  <h2>Caminho</h2>
                </div>
                <span className="card-index" aria-hidden="true">01</span>
              </div>
              <Timeline entries={content.timeline} compact />
              <EditorAddButton collection="timeline">Adicionar marco</EditorAddButton>
              <ArrowLink href="/trajetoria" onNavigate={onNavigate}>Ver todo o caminho</ArrowLink>
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
                {content.projects.map((project) => <ProjectMiniCard key={project.id} project={project} />)}
              </div>
              <EditorAddButton collection="projects">Adicionar projeto</EditorAddButton>
            </article>

            <article className="bento-card notebook-card reveal" id="caderno-resumo">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Registro</p>
                  <h2>Caderno <span className="inline-title-image" aria-hidden="true" /></h2>
                </div>
              </div>
              <div className="note-list">
                {content.notes.slice(0, 2).map((note) => <NoteRow key={note.id} note={note} />)}
              </div>
              <EditorAddButton collection="notes">Nova nota</EditorAddButton>
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
                {content.learning.map((entry) => <LearningRow key={entry.id} entry={entry} />)}
              </div>
              <EditorAddButton collection="learning">Adicionar formação</EditorAddButton>
            </article>
          </div>
        </div>
      </section>

      <section className="interest-chapter" aria-label="Interesses">
        <div className="container interest-heading">
          <p className="eyebrow">Eixos de curiosidade</p>
          <p>Astrofísica e Física são o eixo. Tecnologia aparece como ferramenta para perguntar melhor, organizar o estudo e construir pequenas coisas.</p>
        </div>
        <InterestEditor />
        <InterestMarquee interests={content.interests.map((interest) => interest.value)} />
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
            {content.questions.map((question) => (
              <article className="study-card study-card-reveal" key={question.id}>
                <div className="study-card-image">
                  <img src={question.image} alt={question.imageAlt} loading="lazy" />
                </div>
                <div className="study-card-copy">
                  <div className="editor-line">
                    <p className="eyebrow">Pergunta em aberto</p>
                    {editor?.canEdit ? <ContextEditButton onClick={() => editor.openEditor("questions", question.id)} /> : null}
                  </div>
                  <h3>{question.title}</h3>
                  <p>{question.text}</p>
                </div>
              </article>
            ))}
            <EditorAddButton collection="questions">Adicionar pergunta</EditorAddButton>
          </div>
        </div>
        <div className="container">
          <QuestionCarousel questions={content.questions} />
        </div>
      </section>

      <section className="chapter closing-chapter">
        <div className="container closing-cta reveal">
          <p className="eyebrow"><InlineTextEditor value={home.closingEyebrow} label="Editar chamada" onSave={(value) => editor?.savePage("home", { closingEyebrow: value }) ?? Promise.resolve()} /></p>
          <h2><InlineTextEditor value={home.closingTitle} label="Editar título" onSave={(value) => editor?.savePage("home", { closingTitle: value }) ?? Promise.resolve()} /></h2>
          <p className="closing-copy"><InlineTextEditor value={home.closingDescription} label="Editar texto" onSave={(value) => editor?.savePage("home", { closingDescription: value }) ?? Promise.resolve()} /></p>
          <ArrowLink href="/sobre" onNavigate={onNavigate} className="button button-primary"><InlineTextEditor value={home.closingActionLabel} label="Editar botão" onSave={(value) => editor?.savePage("home", { closingActionLabel: value }) ?? Promise.resolve()} /></ArrowLink>
        </div>
      </section>
    </>
  );
}

function AboutPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  const editor = useEditor();
  const content = editor?.content ?? seedEditorContent();
  return (
    <div className="inner-page about-page chapter">
      <div className="container">
        <PageIntro
          eyebrow="Sobre"
          title={<InlineTextEditor value={content.about.title} label="Editar título" onSave={(value) => editor?.savePage("about", { title: value }) ?? Promise.resolve()} />}
          description={<InlineTextEditor value={content.about.body} label="Editar texto" onSave={(value) => editor?.savePage("about", { body: value }) ?? Promise.resolve()} />}
        />
        <div className="page-backlink"><ArrowLink href="/" onNavigate={onNavigate}>Voltar ao início</ArrowLink></div>
      </div>
    </div>
  );
}

function TrajectoryPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  const editor = useEditor();
  const content = editor?.content ?? seedEditorContent();
  return (
    <div className="inner-page chapter">
      <div className="container narrow-container">
        <PageIntro
          eyebrow="Meu caminho"
          title="Um caminho que ainda está começando."
          description="A linha do tempo começa com os poucos marcos que fazem sentido agora. Novos eventos entram quando existirem, não para preencher espaço."
        />
        <div className="full-timeline-panel reveal">
          <Timeline entries={content.timeline} />
          <EditorAddButton collection="timeline">Adicionar marco</EditorAddButton>
        </div>
        <div className="page-backlink"><ArrowLink href="/" onNavigate={onNavigate}>Voltar ao início</ArrowLink></div>
      </div>
    </div>
  );
}

function ProjectsPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  const editor = useEditor();
  const content = editor?.content ?? seedEditorContent();
  return (
    <div className="inner-page chapter">
      <div className="container">
        <PageIntro
          eyebrow="Projetos"
          title="A estrutura está pronta para receber trabalho real."
          description="Ainda não há projetos públicos completos para apresentar. Em vez de preencher esta página com conquistas inventadas, deixo a arquitetura preparada para documentar cada projeto quando ele existir."
        />
        <div className="projects-page-grid">
          {content.projects.map((project) => (
            <article className="project-large-card reveal" key={project.id}>
              <div className="project-large-image image-reveal">
                <img src={project.image} alt={project.imageAlt} loading="lazy" />
              </div>
              <div className="project-large-copy">
                <div className="card-line"><span className="card-statuses"><StatusMark>{project.status}</StatusMark><EditorialBadge status={project.editorialStatus} /></span><span className="project-period">{project.period}</span></div>
                <h2>{project.title}</h2>
                <p>{project.description}</p>
                <div className="tag-row">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>
                <p className="placeholder-note">Conteúdo temporário: substituir quando houver um projeto público para documentar.</p>
                {editor?.canEdit ? <ContextEditButton onClick={() => editor.openEditor("projects", project.id)} /> : null}
              </div>
            </article>
          ))}
        </div>
        <EditorAddButton collection="projects">Adicionar projeto</EditorAddButton>
        <div className="page-backlink"><ArrowLink href="/" onNavigate={onNavigate}>Voltar ao início</ArrowLink></div>
      </div>
    </div>
  );
}

function JournalPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  const editor = useEditor();
  const content = editor?.content ?? seedEditorContent();
  return (
    <div className="inner-page chapter">
      <div className="container narrow-container">
        <PageIntro
          eyebrow="Caderno"
          title="Notas pequenas para não perder o fio."
          description="Um índice pessoal para estudos, leituras e perguntas. As primeiras entradas ainda serão escritas; a estrutura já aceita conteúdo organizado por área, data e tempo de leitura."
        />
        <div className="journal-list reveal">
          {content.notes.map((note) => <NoteRow key={note.id} note={note} />)}
        </div>
        <EditorAddButton collection="notes">Nova nota</EditorAddButton>
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
  const editor = useEditor();
  const content = editor?.content ?? seedEditorContent();
  const hasDocument = content.learning.some((entry) => Boolean(entry.documentAssetId));
  const hasPublicDocument = content.learning.some((entry) => Boolean(entry.documentAssetId && entry.documentPublic));
  return (
    <div className="inner-page chapter">
      <div className="container narrow-container">
        <PageIntro
          eyebrow="Formação complementar"
          title="Um índice para cursos, atividades e certificados."
          description="A interface mostra apenas metadados públicos apropriados. Documentos originais permanecem privados por padrão e só serão associados quando isso fizer sentido."
        />
        <div className="formation-list reveal">
          {content.learning.map((entry) => <LearningRow key={entry.id} entry={entry} />)}
        </div>
        <EditorAddButton collection="learning">Adicionar formação</EditorAddButton>
        <div className="privacy-panel reveal">
          <p className="eyebrow">Privacidade</p>
          <p>{hasPublicDocument ? "Os documentos marcados como públicos podem ser abertos diretamente nos registros acima." : editor?.canEdit && hasDocument ? "Há documento(s) anexado(s), mas eles continuam privados. Você pode controlar isso ao editar cada formação." : "Não há PDFs de certificados nem informações sensíveis publicados nesta primeira versão."}</p>
        </div>
        <div className="page-backlink"><ArrowLink href="/" onNavigate={onNavigate}>Voltar ao início</ArrowLink></div>
      </div>
    </div>
  );
}

function ContactPage({ onNavigate }: { onNavigate: (href: Route) => void }) {
  const editor = useEditor();
  const content = editor?.content ?? seedEditorContent();
  const contact = content.contact;
  return (
    <div className="inner-page chapter contact-page">
      <div className="container narrow-container">
        <PageIntro
          eyebrow={<InlineTextEditor value={contact.eyebrow} label="Editar chamada" onSave={(value) => editor?.savePage("contact", { eyebrow: value }) ?? Promise.resolve()} />}
          title={<InlineTextEditor value={contact.title} label="Editar título" onSave={(value) => editor?.savePage("contact", { title: value }) ?? Promise.resolve()} />}
          description={<InlineTextEditor value={contact.description} label="Editar introdução" onSave={(value) => editor?.savePage("contact", { description: value }) ?? Promise.resolve()} />}
        />
        {content.contacts.length === 0 ? (
          <div className="contact-card reveal">
            <p className="eyebrow"><InlineTextEditor value={contact.emptyEyebrow} label="Editar chamada vazia" onSave={(value) => editor?.savePage("contact", { emptyEyebrow: value }) ?? Promise.resolve()} /></p>
            <h2><InlineTextEditor value={contact.emptyTitle} label="Editar título vazio" onSave={(value) => editor?.savePage("contact", { emptyTitle: value }) ?? Promise.resolve()} /></h2>
            <p><InlineTextEditor value={contact.emptyDescription} label="Editar texto vazio" onSave={(value) => editor?.savePage("contact", { emptyDescription: value }) ?? Promise.resolve()} /></p>
          </div>
        ) : (
          <div className="contact-list">
            {content.contacts.map((entry) => (
              <article className="contact-card contact-card-entry reveal" key={entry.id}>
                <div className="editor-line">
                  <p className="eyebrow">{entry.label}</p>
                  <span className="card-statuses"><EditorialBadge status={entry.editorialStatus} /><ContextEditButton onClick={() => editor?.openEditor("contacts", entry.id)} /></span>
                </div>
                {entry.href ? <a className="contact-value" href={entry.href}>{entry.value}</a> : <p className="contact-value">{entry.value}</p>}
                {entry.note ? <p>{entry.note}</p> : null}
              </article>
            ))}
          </div>
        )}
        <EditorAddButton collection="contacts">Adicionar contato</EditorAddButton>
        <div className="page-backlink"><ArrowLink href="/" onNavigate={onNavigate} className="button button-outline"><InlineTextEditor value={contact.backLabel} label="Editar botão" onSave={(value) => editor?.savePage("contact", { backLabel: value }) ?? Promise.resolve()} /></ArrowLink></div>
      </div>
    </div>
  );
}

function SiteFooter({ onNavigate }: { onNavigate: (href: Route) => void }) {
  const editor = useEditor();
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
            <SiteLink href="/trajetoria" onNavigate={onNavigate}>Meu caminho</SiteLink>
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
        {!editor?.editMode ? <Link className="owner-entry" href="/edit">Editar site</Link> : null}
      </div>
    </footer>
  );
}

function OwnerBar() {
  const editor = useEditor();
  if (!editor?.canEdit) return null;
  return (
    <aside className="owner-bar" aria-label="Ferramentas do proprietário">
      <span><strong>Modo de edição</strong><small>{editor.statusMessage ?? "As alterações são salvas no próprio site."}</small></span>
      <div className="owner-bar-actions">
        <button type="button" onClick={() => void editor.viewAsVisitor()}>Visualizar como visitante</button>
        <button type="button" className="owner-bar-signout" onClick={editor.signOut}>Sair</button>
      </div>
    </aside>
  );
}

type EditorFormState = Record<string, string | boolean>;

function EditorDrawer() {
  const editor = useEditor();
  if (!editor?.drawer || !editor.canEdit) return null;
  return <EditorDrawerContent key={`${editor.drawer.collection}-${editor.drawer.id ?? "new"}`} drawer={editor.drawer} editor={editor} />;
}

function EditorDrawerContent({ drawer, editor }: { drawer: NonNullable<DrawerState>; editor: EditorController }) {
  const [fields, setFields] = useState<EditorFormState>(() => initialEditorFields(editor.content, drawer));
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (name: string, value: string | boolean) => setFields((current) => ({ ...current, [name]: value }));
  const currentItem = drawer.id ? (editor.content[drawer.collection] as Array<{ id: string }>).find((item) => item.id === drawer.id) : null;
  const isExisting = Boolean(currentItem);
  const title = isExisting ? `Editar ${collectionLabel(drawer.collection).toLowerCase()}` : `Adicionar ${collectionLabel(drawer.collection).toLowerCase()}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const forcedStatus = submitter?.value === "published" || submitter?.value === "draft" ? submitter.value : fields.editorialStatus;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...fields, editorialStatus: forcedStatus };
      if (typeof payload.technologies === "string") payload.technologies = commaList(payload.technologies);
      if (typeof payload.tags === "string") payload.tags = commaList(payload.tags);

      if (coverFile) {
        const asset = await uploadAsset(coverFile, "image", true, String(payload.imageAlt || payload.title || "Capa"));
        payload.coverAssetId = asset.id;
        payload.image = `/api/assets?id=${encodeURIComponent(asset.id)}`;
        payload.imageAlt = asset.altText || payload.imageAlt || payload.title;
      }
      if (documentFile) {
        const asset = await uploadAsset(documentFile, "document", payload.documentPublic === true, String(payload.title || "Documento"));
        payload.documentAssetId = asset.id;
      }

      if (drawer.collection === "learning" && typeof payload.documentAssetId === "string" && !documentFile) {
        const visibilityResponse = await fetch(`/api/assets?id=${encodeURIComponent(payload.documentAssetId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic: payload.documentPublic === true }),
        });
        const visibilityPayload = await visibilityResponse.json() as { error?: string };
        if (!visibilityResponse.ok) throw new Error(visibilityPayload.error ?? "Não foi possível atualizar a visibilidade do documento.");
      }

      await editor.saveItem(drawer.collection, drawer.id, payload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível salvar o item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="editor-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) editor.closeEditor(); }}>
      <section className="editor-drawer" role="dialog" aria-modal="true" aria-labelledby="editor-drawer-title">
        <div className="editor-drawer-heading">
          <div>
            <p className="eyebrow">Edição contextual</p>
            <h2 id="editor-drawer-title">{title}</h2>
          </div>
          <button type="button" className="drawer-close" aria-label="Fechar editor" onClick={editor.closeEditor}>×</button>
        </div>

        <form className="editor-form" onSubmit={submit}>
          {drawer.collection === "timeline" ? <TimelineFields fields={fields} setField={setField} /> : null}
          {drawer.collection === "projects" ? <ProjectFields fields={fields} setField={setField} setCoverFile={setCoverFile} /> : null}
          {drawer.collection === "notes" ? <NoteFields fields={fields} setField={setField} setCoverFile={setCoverFile} /> : null}
          {drawer.collection === "learning" ? <LearningFields fields={fields} setField={setField} setCoverFile={setCoverFile} setDocumentFile={setDocumentFile} /> : null}
          {drawer.collection === "questions" ? <QuestionFields fields={fields} setField={setField} setCoverFile={setCoverFile} /> : null}
          {drawer.collection === "contacts" ? <ContactFields fields={fields} setField={setField} /> : null}
          {drawer.collection === "interests" ? <InterestFields fields={fields} setField={setField} /> : null}

          {error ? <p className="editor-error" role="alert">{error}</p> : null}
          <div className="editor-form-actions">
            <button type="button" className="button button-quiet" onClick={editor.closeEditor} disabled={busy}>Cancelar</button>
            {isExisting ? <button type="button" className="button button-danger" onClick={() => { if (drawer.id && window.confirm("Ocultar este item do site?")) void editor.hideItem(drawer.collection, drawer.id); }} disabled={busy}>Ocultar</button> : null}
            <span className="editor-form-submit-group">
              <button type="submit" name="actionStatus" value="draft" className="button button-outline" disabled={busy}>{busy ? "Salvando…" : "Salvar rascunho"}</button>
              <button type="submit" name="actionStatus" value="published" className="button button-primary" disabled={busy}>{busy ? "Salvando…" : "Publicar"}</button>
            </span>
          </div>
        </form>
      </section>
    </div>
  );
}

function TimelineFields({ fields, setField }: { fields: EditorFormState; setField: (name: string, value: string | boolean) => void }) {
  return (
    <div className="editor-field-grid">
      <EditorInput label="Período" value={String(fields.period ?? "")} onChange={(value) => setField("period", value)} />
      <EditorInput label="Título" value={String(fields.title ?? "")} onChange={(value) => setField("title", value)} required />
      <EditorInput label="Instituição / contexto" value={String(fields.institution ?? "")} onChange={(value) => setField("institution", value)} />
      <EditorInput label="Categoria" value={String(fields.category ?? "")} onChange={(value) => setField("category", value)} />
      <EditorTextarea label="Descrição curta" value={String(fields.description ?? "")} onChange={(value) => setField("description", value)} />
      <EditorStatusField value={String(fields.editorialStatus ?? "draft")} onChange={(value) => setField("editorialStatus", value)} />
    </div>
  );
}

function ProjectFields({ fields, setField, setCoverFile }: { fields: EditorFormState; setField: (name: string, value: string | boolean) => void; setCoverFile: (file: File | null) => void }) {
  return (
    <div className="editor-field-grid">
      <EditorInput label="Título" value={String(fields.title ?? "")} onChange={(value) => setField("title", value)} required />
      <EditorTextarea label="Descrição curta" value={String(fields.description ?? "")} onChange={(value) => setField("description", value)} required />
      <div className="editor-two-col">
        <EditorInput label="Período" value={String(fields.period ?? "")} onChange={(value) => setField("period", value)} />
        <EditorInput label="Rótulo de status" value={String(fields.status ?? "")} onChange={(value) => setField("status", value)} />
      </div>
      <details className="editor-accordion">
        <summary>Mais opções</summary>
        <div className="editor-field-grid editor-field-grid--nested">
          <EditorInput label="Tecnologias (separadas por vírgula)" value={String(fields.technologies ?? "")} onChange={(value) => setField("technologies", value)} />
          <EditorInput label="GitHub" type="url" value={String(fields.github ?? "")} onChange={(value) => setField("github", value)} />
          <EditorInput label="Demo" type="url" value={String(fields.demo ?? "")} onChange={(value) => setField("demo", value)} />
          <EditorInput label="Texto alternativo da capa" value={String(fields.imageAlt ?? "")} onChange={(value) => setField("imageAlt", value)} />
          <EditorTextarea label="Descrição longa" value={String(fields.body ?? "")} onChange={(value) => setField("body", value)} />
          <UploadField label="Capa do projeto" accept="image/jpeg,image/png,image/webp,image/gif" onFile={setCoverFile} />
        </div>
      </details>
      <EditorStatusField value={String(fields.editorialStatus ?? "draft")} onChange={(value) => setField("editorialStatus", value)} />
    </div>
  );
}

function NoteFields({ fields, setField, setCoverFile }: { fields: EditorFormState; setField: (name: string, value: string | boolean) => void; setCoverFile: (file: File | null) => void }) {
  return (
    <div className="editor-field-grid">
      <EditorInput label="Título" value={String(fields.title ?? "")} onChange={(value) => setField("title", value)} required />
      <RichEditor value={String(fields.body ?? "")} onChange={(value) => setField("body", value)} />
      <div className="editor-two-col">
        <EditorInput label="Área" value={String(fields.area ?? "")} onChange={(value) => setField("area", value)} />
        <EditorInput label="Data" value={String(fields.date ?? "")} onChange={(value) => setField("date", value)} />
      </div>
      <details className="editor-accordion">
        <summary>Mais opções</summary>
        <div className="editor-field-grid editor-field-grid--nested">
          <EditorInput label="Tags (separadas por vírgula)" value={String(fields.tags ?? "")} onChange={(value) => setField("tags", value)} />
          <UploadField label="Imagem de capa" accept="image/jpeg,image/png,image/webp,image/gif" onFile={setCoverFile} />
        </div>
      </details>
      <EditorStatusField value={String(fields.editorialStatus ?? "draft")} onChange={(value) => setField("editorialStatus", value)} />
    </div>
  );
}

function LearningFields({ fields, setField, setCoverFile, setDocumentFile }: { fields: EditorFormState; setField: (name: string, value: string | boolean) => void; setCoverFile: (file: File | null) => void; setDocumentFile: (file: File | null) => void }) {
  return (
    <div className="editor-field-grid">
      <EditorInput label="Nome" value={String(fields.title ?? "")} onChange={(value) => setField("title", value)} required />
      <EditorInput label="Instituição" value={String(fields.institution ?? "")} onChange={(value) => setField("institution", value)} required />
      <div className="editor-two-col">
        <EditorInput label="Ano / período" value={String(fields.year ?? "")} onChange={(value) => setField("year", value)} required />
        <EditorInput label="Horas" value={String(fields.hours ?? "")} onChange={(value) => setField("hours", value)} />
      </div>
      <EditorInput label="Categoria" value={String(fields.category ?? "")} onChange={(value) => setField("category", value)} />
      <EditorTextarea label="Descrição" value={String(fields.description ?? "")} onChange={(value) => setField("description", value)} />
      <details className="editor-accordion">
        <summary>Mais opções e documentos</summary>
        <div className="editor-field-grid editor-field-grid--nested">
          <UploadField label="Capa opcional" accept="image/jpeg,image/png,image/webp,image/gif" onFile={setCoverFile} />
          <UploadField label="Certificado / documento (privado por padrão)" accept="application/pdf,image/jpeg,image/png" onFile={setDocumentFile} />
          {fields.documentAssetId ? <div className="editor-asset-status"><span>Documento anexado</span><a href={`/api/assets?id=${encodeURIComponent(String(fields.documentAssetId))}`} target="_blank" rel="noreferrer">Abrir documento atual</a><small>O documento continua privado até você marcar a opção abaixo.</small></div> : null}
          <label className="editor-checkbox"><input type="checkbox" checked={fields.documentPublic === true} onChange={(event) => setField("documentPublic", event.target.checked)} /> Tornar o documento público</label>
        </div>
      </details>
      <EditorStatusField value={String(fields.editorialStatus ?? "draft")} onChange={(value) => setField("editorialStatus", value)} />
    </div>
  );
}

function InterestFields({ fields, setField }: { fields: EditorFormState; setField: (name: string, value: string | boolean) => void }) {
  return (
    <div className="editor-field-grid">
      <EditorInput label="Interesse" value={String(fields.value ?? "")} onChange={(value) => setField("value", value)} required />
      <EditorStatusField value={String(fields.editorialStatus ?? "draft")} onChange={(value) => setField("editorialStatus", value)} />
    </div>
  );
}

function QuestionFields({ fields, setField, setCoverFile }: { fields: EditorFormState; setField: (name: string, value: string | boolean) => void; setCoverFile: (file: File | null) => void }) {
  return (
    <div className="editor-field-grid">
      <EditorInput label="Título da pergunta" value={String(fields.title ?? "")} onChange={(value) => setField("title", value)} required />
      <EditorTextarea label="Texto da pergunta" value={String(fields.text ?? "")} onChange={(value) => setField("text", value)} required />
      <EditorInput label="Imagem (URL opcional)" type="url" value={String(fields.image ?? "")} onChange={(value) => setField("image", value)} />
      <EditorInput label="Texto alternativo da imagem" value={String(fields.imageAlt ?? "")} onChange={(value) => setField("imageAlt", value)} />
      <UploadField label="Imagem da pergunta" accept="image/jpeg,image/png,image/webp,image/gif" onFile={setCoverFile} />
      <EditorStatusField value={String(fields.editorialStatus ?? "draft")} onChange={(value) => setField("editorialStatus", value)} />
    </div>
  );
}

function ContactFields({ fields, setField }: { fields: EditorFormState; setField: (name: string, value: string | boolean) => void }) {
  return (
    <div className="editor-field-grid">
      <EditorInput label="Nome do canal" value={String(fields.label ?? "")} onChange={(value) => setField("label", value)} required />
      <EditorInput label="Contato exibido" value={String(fields.value ?? "")} onChange={(value) => setField("value", value)} required />
      <EditorInput label="Link opcional (https, mailto ou tel)" value={String(fields.href ?? "")} onChange={(value) => setField("href", value)} />
      <EditorTextarea label="Nota curta" value={String(fields.note ?? "")} onChange={(value) => setField("note", value)} />
      <EditorStatusField value={String(fields.editorialStatus ?? "draft")} onChange={(value) => setField("editorialStatus", value)} />
    </div>
  );
}

function EditorInput({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label className="editor-field"><span>{label}{required ? " *" : ""}</span><input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function EditorTextarea({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="editor-field"><span>{label}{required ? " *" : ""}</span><textarea value={value} required={required} onChange={(event) => onChange(event.target.value)} rows={4} /></label>;
}

function EditorStatusField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="editor-field"><span>Visibilidade</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="hidden">Oculto</option></select></label>;
}

function RichEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
  }, [value]);
  const format = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  };
  return (
    <div className="editor-field editor-rich-field">
      <span>Texto da nota *</span>
      <div className="editor-toolbar" role="toolbar" aria-label="Formatação do texto">
        <button type="button" onClick={() => format("formatBlock", "h2")} aria-label="Título">H2</button>
        <button type="button" onClick={() => format("formatBlock", "h3")} aria-label="Subtítulo">H3</button>
        <button type="button" onClick={() => format("bold")} aria-label="Negrito"><strong>B</strong></button>
        <button type="button" onClick={() => format("italic")} aria-label="Itálico"><em>I</em></button>
        <button type="button" onClick={() => format("formatBlock", "blockquote")} aria-label="Citação">“</button>
        <button type="button" onClick={() => format("insertUnorderedList")} aria-label="Lista">•</button>
        <button type="button" onClick={() => format("formatBlock", "pre")} aria-label="Código">&lt;/&gt;</button>
        <button type="button" onClick={() => { const url = window.prompt("URL do link"); if (url) format("createLink", url); }} aria-label="Adicionar link">↗</button>
      </div>
      <div ref={editorRef} className="editor-richtext" contentEditable suppressContentEditableWarning onInput={() => onChange(editorRef.current?.innerHTML ?? "")} role="textbox" aria-multiline="true" />
    </div>
  );
}

function UploadField({ label, accept, onFile }: { label: string; accept: string; onFile: (file: File | null) => void }) {
  const [fileName, setFileName] = useState("");
  const selectFile = (file: File | null) => {
    setFileName(file?.name ?? "");
    onFile(file);
  };
  return (
    <label className="editor-upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0] ?? null); }}>
      <span>{label}</span>
      <small>{fileName ? `Selecionado: ${fileName}` : "Clique ou arraste um arquivo"}</small>
      <input type="file" accept={accept} onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
    </label>
  );
}

function initialEditorFields(content: EditorContent, drawer: NonNullable<DrawerState>): EditorFormState {
  const item = drawer.id ? (content[drawer.collection] as Array<Record<string, unknown>>).find((entry) => entry.id === drawer.id) : undefined;
  if (drawer.collection === "timeline") return { period: String(item?.period ?? "Agora"), title: String(item?.title ?? ""), institution: String(item?.institution ?? ""), description: String(item?.description ?? ""), category: String(item?.category ?? "Trajetória"), editorialStatus: String(item?.editorialStatus ?? "draft") };
  if (drawer.collection === "projects") return { title: String(item?.title ?? ""), description: String(item?.description ?? ""), status: String(item?.status ?? "Em andamento"), period: String(item?.period ?? "Em construção"), technologies: Array.isArray(item?.technologies) ? item.technologies.join(", ") : "", body: String(item?.body ?? ""), github: String(item?.github ?? ""), demo: String(item?.demo ?? ""), image: String(item?.image ?? ""), imageAlt: String(item?.imageAlt ?? ""), editorialStatus: String(item?.editorialStatus ?? "draft") };
  if (drawer.collection === "notes") return { title: String(item?.title ?? ""), body: String(item?.body ?? "<p></p>"), area: String(item?.area ?? "Caderno"), date: String(item?.date ?? ""), tags: Array.isArray(item?.tags) ? item.tags.join(", ") : "", editorialStatus: String(item?.editorialStatus ?? "draft") };
  if (drawer.collection === "learning") return { title: String(item?.title ?? ""), institution: String(item?.institution ?? ""), year: String(item?.year ?? ""), hours: String(item?.hours ?? ""), category: String(item?.category ?? "Formação"), description: String(item?.description ?? ""), documentAssetId: String(item?.documentAssetId ?? ""), documentPublic: item?.documentPublic === true, editorialStatus: String(item?.editorialStatus ?? "draft") };
  if (drawer.collection === "questions") return { title: String(item?.title ?? ""), text: String(item?.text ?? ""), image: String(item?.image ?? ""), imageAlt: String(item?.imageAlt ?? ""), editorialStatus: String(item?.editorialStatus ?? "draft") };
  if (drawer.collection === "contacts") return { label: String(item?.label ?? ""), value: String(item?.value ?? ""), href: String(item?.href ?? ""), note: String(item?.note ?? ""), editorialStatus: String(item?.editorialStatus ?? "draft") };
  return { value: String(item?.value ?? ""), editorialStatus: String(item?.editorialStatus ?? "draft") };
}

function collectionLabel(collection: EditableCollection): string {
  return collection === "timeline" ? "marco" : collection === "projects" ? "projeto" : collection === "notes" ? "nota" : collection === "learning" ? "formação" : collection === "questions" ? "pergunta" : collection === "contacts" ? "contato" : "interesse";
}

function commaList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function uploadAsset(file: File, kind: "image" | "document", isPublic: boolean, altText: string): Promise<{ id: string; altText: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  form.append("isPublic", String(isPublic));
  form.append("altText", altText);
  const response = await fetch("/api/assets", { method: "POST", body: form });
  const payload = await response.json() as { asset?: { id: string; altText: string }; error?: string };
  if (!response.ok || !payload.asset) throw new Error(payload.error ?? "Não foi possível enviar o arquivo.");
  return payload.asset;
}

export default function HomeExperience() {
  const [route, setRoute] = useState<Route>(() => {
    if (typeof window === "undefined") return "/";
    return normalizeRoute(window.location.pathname);
  });
  const [content, setContent] = useState<EditorContent>(() => seedEditorContent());
  const [ownerAvailable, setOwnerAvailable] = useState(false);
  const [editMode, setEditModeState] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const canEdit = ownerAvailable && editMode;

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        const session = await sessionResponse.json() as { canEdit?: boolean };
        const canOwnerEdit = session.canEdit === true;
        const requestedEdit = new URLSearchParams(window.location.search).get("edit") === "1";
        if (active) {
          setOwnerAvailable(canOwnerEdit);
          setEditModeState(canOwnerEdit && requestedEdit);
        }

        const contentResponse = await fetch(`/api/content${canOwnerEdit && requestedEdit ? "?editor=1" : ""}`, { cache: "no-store" });
        if (contentResponse.ok) {
          const payload = await contentResponse.json() as { content?: EditorContent };
          if (active && payload.content) setContent(payload.content);
        }
      } catch {
        // The static seed remains available when the local preview has no D1 binding.
      }
    };
    void bootstrap();
    return () => { active = false; };
  }, []);

  const enterEditMode = async () => {
    if (!ownerAvailable) return;
    setStatusMessage("Carregando conteúdo privado…");
    const response = await fetch("/api/content?editor=1", { cache: "no-store" });
    const payload = await response.json() as { content?: EditorContent; error?: string };
    if (!response.ok || !payload.content) {
      setStatusMessage(payload.error ?? "Não foi possível abrir o editor.");
      return;
    }
    setContent(payload.content);
    setEditModeState(true);
    window.history.replaceState({}, "", `${window.location.pathname}?edit=1`);
    setStatusMessage("Conteúdo privado carregado.");
  };

  const viewAsVisitor = async () => {
    setEditModeState(false);
    setDrawer(null);
    window.history.replaceState({}, "", window.location.pathname);
    try {
      const response = await fetch("/api/content", { cache: "no-store" });
      const payload = await response.json() as { content?: EditorContent };
      if (response.ok && payload.content) setContent(payload.content);
      else setContent((current) => publicEditorContent(current));
    } catch {
      setContent((current) => publicEditorContent(current));
    }
  };

  const saveItem = async (collection: EditableCollection, id: string | undefined, payload: Record<string, unknown>) => {
    const response = await fetch(id ? `/api/content?collection=${collection}&id=${encodeURIComponent(id)}` : "/api/content", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? payload : { collection, item: payload }),
    });
    const result = await response.json() as { content?: EditorContent; error?: string };
    if (!response.ok || !result.content) throw new Error(result.error ?? "Não foi possível salvar o item.");
    setContent(result.content);
    setDrawer(null);
    setStatusMessage("Alteração salva.");
  };

  const hideItem = async (collection: EditableCollection, id: string) => {
    const response = await fetch(`/api/content?collection=${collection}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json() as { content?: EditorContent; error?: string };
    if (!response.ok || !result.content) {
      setStatusMessage(result.error ?? "Não foi possível ocultar o item.");
      return;
    }
    setContent(result.content);
    setDrawer(null);
    setStatusMessage("Item ocultado.");
  };

  const reorder = async (collection: EditableCollection, orderedIds: string[]) => {
    const response = await fetch("/api/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ collection, orderedIds }) });
    const result = await response.json() as { content?: EditorContent; error?: string };
    if (!response.ok || !result.content) {
      setStatusMessage(result.error ?? "Não foi possível reordenar.");
      return;
    }
    setContent(result.content);
    setStatusMessage("Ordem atualizada.");
  };

  const saveIdentity = async (field: "description", value: string) => {
    const response = await fetch("/api/content?collection=identity&id=primary", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    const result = await response.json() as { content?: EditorContent; error?: string };
    if (!response.ok || !result.content) {
      setStatusMessage(result.error ?? "Não foi possível salvar o texto.");
      return;
    }
    setContent(result.content);
    setStatusMessage("Texto salvo.");
  };

  const savePage = async (page: EditablePage, fields: Record<string, string>) => {
    const response = await fetch(`/api/content?collection=${page}&id=primary`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    const result = await response.json() as { content?: EditorContent; error?: string };
    if (!response.ok || !result.content) {
      setStatusMessage(result.error ?? "Não foi possível salvar a página.");
      return;
    }
    setContent(result.content);
    setStatusMessage("Texto salvo.");
  };

  const signOut = () => {
    window.location.href = `/signout-with-chatgpt?return_to=${encodeURIComponent(window.location.pathname)}`;
  };

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

    gsap.utils.toArray<HTMLElement>(".study-card-reveal").forEach((element) => {
      gsap.fromTo(
        element,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.72,
          ease: "power3.out",
          clearProps: "opacity,transform",
          scrollTrigger: {
            trigger: element,
            start: "top 86%",
            toggleActions: "play none none none",
            once: true,
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

  const editorController: EditorController = {
    content,
    ownerAvailable,
    editMode,
    canEdit,
    drawer,
    statusMessage,
    openEditor: (collection, id) => setDrawer({ collection, id }),
    closeEditor: () => setDrawer(null),
    enterEditMode,
    viewAsVisitor,
    signOut,
    saveItem,
    hideItem,
    reorder,
    saveIdentity,
    savePage,
    setStatusMessage,
  };

  return (
    <EditorContext.Provider value={editorController}>
      <div className="site-app">
        <SiteHeader key={route} route={route} onNavigate={navigate} />
        <main className="page-shell" ref={pageRef}>{page}</main>
        <SiteFooter onNavigate={navigate} />
        <OwnerBar />
        <EditorDrawer />
      </div>
    </EditorContext.Provider>
  );
}
