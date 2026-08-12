"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
import { type TimelineEntry } from "../../content/siteData";
import {
  normalizeSiteRoute,
  primaryNavigation,
  routeDefinition,
  type SiteRoute as Route,
} from "../site/routes";

gsap.registerPlugin(ScrollTrigger);

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
  viewAsVisitor: () => Promise<void>;
  signOut: () => void;
  saveItem: (collection: EditableCollection, id: string | undefined, payload: Record<string, unknown>) => Promise<void>;
  setItemStatus: (collection: EditableCollection, id: string, status: EditorialStatus) => Promise<void>;
  deleteItem: (collection: EditableCollection, id: string) => Promise<void>;
  reorder: (collection: EditableCollection, orderedIds: string[]) => Promise<void>;
  saveIdentity: (field: "name" | "role" | "location" | "description", value: string) => Promise<void>;
  savePage: (page: EditablePage, fields: Record<string, string>) => Promise<void>;
  setStatusMessage: (value: string | null) => void;
};

const EditorContext = createContext<EditorController | null>(null);

function useEditor(): EditorController | null {
  return useContext(EditorContext);
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
        if (
          event.defaultPrevented
          || event.button !== 0
          || event.metaKey
          || event.ctrlKey
          || event.shiftKey
          || event.altKey
          || (props.target && props.target !== "_self")
        ) return;
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
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    mobileMenuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      requestAnimationFrame(() => toggleRef.current?.focus());
    };
    const onPointerDown = (event: PointerEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const navigateFromMenu = (href: Route) => {
    setMenuOpen(false);
    onNavigate(href);
  };

  return (
    <header className="site-header" ref={headerRef}>
      <div className="container header-inner">
        <SiteLink href="/" className="wordmark" onNavigate={onNavigate} aria-label="Mikael, início">
          Mikael
        </SiteLink>

        <button
          ref={toggleRef}
          type="button"
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span>{menuOpen ? "Fechar" : "Menu"}</span>
          <span aria-hidden="true" className="menu-toggle-line" />
        </button>

        <nav className="primary-nav primary-nav-desktop" aria-label="Navegação principal">
          {primaryNavigation.map((item) => (
            <SiteLink
              key={item.route}
              href={item.route}
              className={route === item.route ? "is-active" : ""}
              onNavigate={onNavigate}
              aria-current={route === item.route ? "page" : undefined}
            >
              {item.label}
            </SiteLink>
          ))}
        </nav>

        {menuOpen ? (
          <nav ref={mobileMenuRef} id="mobile-navigation" className="primary-nav primary-nav-mobile" aria-label="Navegação principal">
            {primaryNavigation.map((item) => (
              <SiteLink
                key={item.route}
                href={item.route}
                className={route === item.route ? "is-active" : ""}
                onNavigate={navigateFromMenu}
                aria-current={route === item.route ? "page" : undefined}
              >
                {item.label}
              </SiteLink>
            ))}
          </nav>
        ) : null}
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
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <div className="page-intro-copy">{description}</div>
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

function ItemEditorialActions({
  collection,
  itemId,
  itemLabel,
}: {
  collection: EditableCollection;
  itemId: string;
  itemLabel: string;
}) {
  const editor = useEditor();
  const [busy, setBusy] = useState(false);
  if (!editor?.canEdit) return null;

  const entries = editor.content[collection] as readonly { id: string }[];
  const index = entries.findIndex((entry) => entry.id === itemId);
  if (index < 0) return null;

  const move = async (direction: -1 | 1) => {
    const target = index + direction;
    if (busy || target < 0 || target >= entries.length) return;
    const reordered = [...entries];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBusy(true);
    try {
      await editor.reorder(collection, reordered.map((entry) => entry.id));
    } catch (error) {
      editor.setStatusMessage(error instanceof Error ? error.message : `Não foi possível reordenar ${itemLabel}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="item-editor-actions">
      <ContextEditButton onClick={() => editor.openEditor(collection, itemId)} />
      <span
        className="item-order-controls"
        role="group"
        aria-label={`Reordenar ${itemLabel}, posição ${index + 1} de ${entries.length}`}
        aria-busy={busy}
      >
        <button
          type="button"
          className="context-icon"
          aria-label={`Mover ${itemLabel} para cima`}
          disabled={busy || index === 0}
          onClick={() => { void move(-1); }}
        >
          <span aria-hidden="true">↑</span>
        </button>
        <button
          type="button"
          className="context-icon"
          aria-label={`Mover ${itemLabel} para baixo`}
          disabled={busy || index === entries.length - 1}
          onClick={() => { void move(1); }}
        >
          <span aria-hidden="true">↓</span>
        </button>
      </span>
    </span>
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
  showValue = true,
}: {
  value: string;
  label: string;
  onSave: (value: string) => Promise<void>;
  showValue?: boolean;
}) {
  const editor = useEditor();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editor?.canEdit) return showValue ? <>{value}</> : null;

  if (editing) {
    return (
      <form
        className="inline-editor-form"
        aria-busy={busy}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          let restoreFieldFocus = false;
          try {
            await onSave(draft.trim());
            setEditing(false);
          } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o texto.");
            restoreFieldFocus = true;
          } finally {
            setBusy(false);
            // The textarea is disabled while saving, so it can only receive
            // focus after the busy state has been cleared and React commits.
            if (restoreFieldFocus) requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
      >
        <textarea ref={inputRef} aria-label={label} value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} disabled={busy} />
        {error ? <span className="inline-editor-error" role="alert">{error}</span> : null}
        <span className="inline-editor-actions">
          <button type="submit" className="button button-primary button-small" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
          <button type="button" className="button button-quiet button-small" disabled={busy} onClick={() => { setDraft(value); setError(null); setEditing(false); }}>Cancelar</button>
        </span>
      </form>
    );
  }

  return (
    <span className="inline-editor-value">
      {showValue ? value : null}
      <button type="button" className="context-edit" onClick={() => { setDraft(value); setError(null); setEditing(true); }}>{label}</button>
    </span>
  );
}

function EditableAction({
  href,
  value,
  label,
  className,
  onNavigate,
  onSave,
}: {
  href: Route;
  value: string;
  label: string;
  className: string;
  onNavigate: (href: Route) => void;
  onSave: (value: string) => Promise<void>;
}) {
  return (
    <div className="editable-action">
      <ArrowLink href={href} onNavigate={onNavigate} className={className}>{value}</ArrowLink>
      <InlineTextEditor value={value} label={label} onSave={onSave} showValue={false} />
    </div>
  );
}

function Timeline({ entries, compact = false }: { entries: readonly (TimelineEntry & { id?: string })[]; compact?: boolean }) {
  const editor = useEditor();
  const Heading = compact ? "h3" : "h2";
  return (
    <ol className={`timeline ${compact ? "timeline-compact" : ""}`}>
      {entries.map((entry, index) => (
        <li key={entry.id ?? `${entry.title}-${entry.period}-${index}`} className="timeline-item">
          <span className={`timeline-node ${index === 0 ? "is-current" : ""}`} aria-hidden="true" />
          <div className="timeline-copy">
            <div className="editor-line">
              <p className="timeline-period">{entry.period}</p>
              {editor?.canEdit && entry.id ? <ItemEditorialActions collection="timeline" itemId={String(entry.id)} itemLabel={entry.title} /> : null}
            </div>
            <div className="timeline-title-line">
              <Heading>{entry.title} <EditorialBadge status={(entry as TimelineEntry & { editorialStatus?: EditorialStatus }).editorialStatus} /></Heading>
              {entry.category ? <span className="timeline-category">{entry.category}</span> : null}
            </div>
            {entry.institution ? <p className="timeline-institution">{entry.institution}</p> : null}
            <p>{entry.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ProjectMiniCard({ project }: { project: EditorContent["projects"][number] }) {
  const editor = useEditor();
  return (
    <article className="project-mini-card">
      <div className="project-mini-image image-reveal">
        <img src={project.image || "/og-sky.jpg"} alt={project.imageAlt || `Capa de ${project.title}`} loading="lazy" />
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
        {editor?.canEdit && project.id ? <ItemEditorialActions collection="projects" itemId={project.id} itemLabel={project.title} /> : null}
      </div>
    </article>
  );
}

function NoteRow({ note, detailed = false }: { note: EditorContent["notes"][number]; detailed?: boolean }) {
  const editor = useEditor();
  const Heading = detailed ? "h2" : "h3";
  return (
    <article className={`note-row ${detailed ? "note-row-detailed" : ""}`}>
      {detailed && note.coverAssetId ? (
        <div className="note-cover image-reveal">
          <img src={`/api/assets?id=${encodeURIComponent(note.coverAssetId)}`} alt={`Capa de ${note.title}`} loading="lazy" />
        </div>
      ) : null}
      <div className="note-copy">
        <p className="note-area">{note.area}</p>
        <Heading>{note.title} <EditorialBadge status={note.editorialStatus} /></Heading>
        <p>{note.summary}</p>
        {detailed && note.tags.length ? <div className="tag-row" aria-label="Temas da nota">{note.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
        {detailed && note.body ? <div className="rich-content note-body" dangerouslySetInnerHTML={{ __html: note.body }} /> : null}
      </div>
      <div className="note-meta">
        <span>{note.date}</span>
        <span>{note.readingTime}</span>
        {editor?.canEdit && note.id ? <ItemEditorialActions collection="notes" itemId={note.id} itemLabel={note.title} /> : null}
      </div>
    </article>
  );
}

type AssetMetadata = {
  id: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  altText?: string;
  isPublic?: boolean;
  kind?: string;
  createdAt?: string;
};

function formatFileSize(size: number | undefined): string | null {
  if (!size || size < 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function DocumentPanel({
  assetId,
  title,
  declaredPublic,
  compact = false,
  onRemove,
}: {
  assetId: string;
  title: string;
  declaredPublic: boolean;
  compact?: boolean;
  onRemove?: () => void;
}) {
  const [metadata, setMetadata] = useState<AssetMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const source = `/api/assets?id=${encodeURIComponent(assetId)}`;

  useEffect(() => {
    let active = true;
    const loadMetadata = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${source}&metadata=1`, { cache: "no-store" });
        const responseType = response.headers.get("content-type") ?? "";
        if (!response.ok) {
          const payload = responseType.includes("application/json") ? await response.json() as { error?: string } : null;
          throw new Error(payload?.error ?? "Não foi possível carregar os dados do documento.");
        }
        const next = responseType.includes("application/json")
          ? (await response.json() as { asset?: AssetMetadata }).asset ?? null
          : {
              id: assetId,
              contentType: responseType || undefined,
              size: Number(response.headers.get("content-length")) || undefined,
              isPublic: declaredPublic,
            };
        if (active) setMetadata(next);
      } catch (metadataError) {
        if (active) setError(metadataError instanceof Error ? metadataError.message : "Documento indisponível.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadMetadata();
    return () => { active = false; };
  }, [assetId, declaredPublic, source]);

  const contentType = metadata?.contentType ?? "";
  const fileSize = formatFileSize(metadata?.size);
  const publicState = metadata?.isPublic ?? declaredPublic;

  return (
    <section className={`document-panel ${compact ? "document-panel-compact" : ""}`} aria-label={`Documento de ${title}`}>
      <div className="document-panel-heading">
        <div>
          <p className="document-kicker">{publicState ? "Documento público" : "Documento privado"}</p>
          <h4>{metadata?.fileName || "Documento anexado"}</h4>
          <p className="document-meta">
            {[contentType === "application/pdf" ? "PDF" : contentType.startsWith("image/") ? "Imagem" : null, fileSize].filter(Boolean).join(" · ") || "Metadados em carregamento"}
          </p>
        </div>
        <div className="document-actions">
          <a href={source} target="_blank" rel="noreferrer">Abrir documento</a>
          {onRemove ? <button type="button" className="context-edit context-edit-danger" onClick={onRemove}>Remover anexo</button> : null}
        </div>
      </div>

      {loading ? <p className="document-feedback" role="status">Carregando informações do documento…</p> : null}
      {error ? <p className="document-feedback document-feedback-error" role="alert">{error} O link de abertura continua disponível.</p> : null}
      {!compact && !loading && !error && contentType === "application/pdf" ? (
        <iframe className="document-preview" src={source} title={`Prévia de ${metadata?.fileName || title}`} loading="lazy" />
      ) : null}
      {!compact && !loading && !error && contentType.startsWith("image/") ? (
        <div className="document-image-preview"><img src={source} alt={metadata?.altText || `Documento de ${title}`} loading="lazy" /></div>
      ) : null}
      {!compact && !loading && !error && !contentType ? <p className="document-feedback">A prévia não está disponível. Use “Abrir documento”.</p> : null}
    </section>
  );
}

function LearningRow({ entry, detailed = false }: { entry: EditorContent["learning"][number]; detailed?: boolean }) {
  const editor = useEditor();
  const canViewDocument = Boolean(entry.documentAssetId && (entry.documentPublic || editor?.canEdit));
  const Heading = detailed ? "h2" : "h3";
  return (
    <article className={`learning-row ${detailed ? "learning-row-detailed" : ""}`}>
      {detailed && entry.coverAssetId ? (
        <div className="learning-cover image-reveal"><img src={`/api/assets?id=${encodeURIComponent(entry.coverAssetId)}`} alt={`Capa de ${entry.title}`} loading="lazy" /></div>
      ) : <span className="learning-symbol" aria-hidden="true">+</span>}
      <div className="learning-copy">
        <div className="learning-title-line">
          <div>
            <p className="learning-category">{entry.category}</p>
            <Heading>{entry.title} <EditorialBadge status={entry.editorialStatus} /></Heading>
          </div>
          {editor?.canEdit && entry.id ? <ItemEditorialActions collection="learning" itemId={entry.id} itemLabel={entry.title} /> : null}
        </div>
        <p className="learning-institution">{entry.institution}</p>
        <div className="learning-meta">
          <span>{entry.year}</span>
          {entry.hours ? <span>{entry.hours}</span> : null}
        </div>
        {detailed && entry.description ? <p className="learning-description">{entry.description}</p> : null}
        {canViewDocument && entry.documentAssetId ? <DocumentPanel assetId={entry.documentAssetId} title={entry.title} declaredPublic={entry.documentPublic} compact={!detailed} /> : null}
      </div>
    </article>
  );
}

function InterestMarquee({ interests }: { interests: readonly { id: string; value: string }[] }) {
  const items = [...interests, ...interests];
  return (
    <div className="interest-marquee">
      <ul className="sr-only" aria-label="Interesses de Mikael">
        {interests.map((interest) => <li key={interest.id}>{interest.value}</li>)}
      </ul>
      <div className="marquee-track" aria-hidden="true">
        {items.map((interest, index) => (
          <span key={`${interest.id}-${index}`}>
            {interest.value}
            <span className="marquee-divider" aria-hidden="true">/</span>
          </span>
        ))}
      </div>
      <div className="interest-static-list" aria-hidden="true">
        {interests.map((interest) => <span key={interest.id}>{interest.value}</span>)}
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
    void editor.reorder("interests", next.map((item) => item.id)).catch((error) => {
      editor.setStatusMessage(error instanceof Error ? error.message : "Não foi possível reordenar os interesses.");
    });
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
            <button
              type="button"
              className="context-icon"
              aria-label={`Mover ${interest.value} para cima`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="context-icon"
              aria-label={`Mover ${interest.value} para baixo`}
              disabled={index === editor.content.interests.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="context-icon context-icon-danger"
              aria-label={`Ocultar ${interest.value}`}
              onClick={() => {
                void editor.setItemStatus("interests", interest.id, "hidden").catch((error) => {
                  editor.setStatusMessage(error instanceof Error ? error.message : "Não foi possível ocultar o interesse.");
                });
              }}
            >×</button>
          </span>
        ))}
      </div>
    </div>
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
            <div className="hero-kicker">
              <InlineTextEditor value={content.identity.role} label="Editar função" onSave={(value) => editor?.saveIdentity("role", value) ?? Promise.resolve()} />
              <span aria-hidden="true"> · </span>
              <InlineTextEditor value={content.identity.location} label="Editar localização" onSave={(value) => editor?.saveIdentity("location", value) ?? Promise.resolve()} />
            </div>
            <h1><InlineTextEditor value={content.identity.name} label="Editar nome" onSave={(value) => editor?.saveIdentity("name", value) ?? Promise.resolve()} /></h1>
            <div className="hero-lead"><InlineTextEditor value={content.identity.description} label="Editar apresentação" onSave={(value) => editor?.saveIdentity("description", value) ?? Promise.resolve()} /></div>
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
            <div className="overview-description"><InlineTextEditor value={home.overviewDescription} label="Editar texto" onSave={(value) => editor?.savePage("home", { overviewDescription: value }) ?? Promise.resolve()} /></div>
          </div>

          <div className="bento-grid">
            <article className="bento-card trajectory-card reveal" id="trajetoria-resumo">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Percurso</p>
                  <h2>Caminho</h2>
                </div>
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
        <InterestMarquee interests={content.interests} />
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
                  <img src={question.image || "/og-sky.jpg"} alt={question.imageAlt || `Imagem de ${question.title}`} loading="lazy" />
                </div>
                <div className="study-card-copy">
                  <div className="editor-line">
                    <p className="eyebrow">Pergunta em aberto</p>
                    {editor?.canEdit ? <ItemEditorialActions collection="questions" itemId={question.id} itemLabel={question.title} /> : null}
                  </div>
                  <h3>{question.title}</h3>
                  <p>{question.text}</p>
                </div>
              </article>
            ))}
            <EditorAddButton collection="questions">Adicionar pergunta</EditorAddButton>
          </div>
        </div>
      </section>

      <section className="chapter closing-chapter">
        <div className="container closing-cta reveal">
          <div className="eyebrow"><InlineTextEditor value={home.closingEyebrow} label="Editar chamada" onSave={(value) => editor?.savePage("home", { closingEyebrow: value }) ?? Promise.resolve()} /></div>
          <h2><InlineTextEditor value={home.closingTitle} label="Editar título" onSave={(value) => editor?.savePage("home", { closingTitle: value }) ?? Promise.resolve()} /></h2>
          <div className="closing-copy"><InlineTextEditor value={home.closingDescription} label="Editar texto" onSave={(value) => editor?.savePage("home", { closingDescription: value }) ?? Promise.resolve()} /></div>
          <EditableAction
            href="/sobre"
            value={home.closingActionLabel}
            label="Editar botão"
            className="button button-primary"
            onNavigate={onNavigate}
            onSave={(value) => editor?.savePage("home", { closingActionLabel: value }) ?? Promise.resolve()}
          />
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
        <section className="about-tools" aria-labelledby="about-tools-title">
          <div>
            <p className="eyebrow">Ferramentas de estudo</p>
            <h2 id="about-tools-title">Recursos que ajudam a organizar o caminho.</h2>
          </div>
          <ul className="tool-list">
            {content.tools.map((tool) => <li key={tool}>{tool}</li>)}
          </ul>
        </section>
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
                <img src={project.image || "/og-sky.jpg"} alt={project.imageAlt || `Capa de ${project.title}`} loading="lazy" />
              </div>
              <div className="project-large-copy">
                <div className="card-line"><span className="card-statuses"><StatusMark>{project.status}</StatusMark><EditorialBadge status={project.editorialStatus} /></span><span className="project-period">{project.period}</span></div>
                <h2>{project.title}</h2>
                <p>{project.description}</p>
                <div className="tag-row">{project.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>
                {project.body && project.body.replace(/<[^>]+>/g, "").trim() !== project.description.trim() ? (
                  <details className="public-details">
                    <summary>Ler registro completo</summary>
                    <div className="rich-content" dangerouslySetInnerHTML={{ __html: project.body }} />
                  </details>
                ) : null}
                {project.github || project.demo ? (
                  <div className="project-links" aria-label={`Links de ${project.title}`}>
                    {project.github ? <a href={project.github} target="_blank" rel="noreferrer">GitHub</a> : null}
                    {project.demo ? <a href={project.demo} target="_blank" rel="noreferrer">Demonstração</a> : null}
                  </div>
                ) : null}
                {project.placeholder ? <p className="placeholder-note">Conteúdo temporário: substituir quando houver um projeto público para documentar.</p> : null}
                {editor?.canEdit ? <ItemEditorialActions collection="projects" itemId={project.id} itemLabel={project.title} /> : null}
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
          {content.notes.map((note) => <NoteRow key={note.id} note={note} detailed />)}
        </div>
        <EditorAddButton collection="notes">Nova nota</EditorAddButton>
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
          {content.learning.map((entry) => <LearningRow key={entry.id} entry={entry} detailed />)}
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
            <div className="eyebrow"><InlineTextEditor value={contact.emptyEyebrow} label="Editar chamada vazia" onSave={(value) => editor?.savePage("contact", { emptyEyebrow: value }) ?? Promise.resolve()} /></div>
            <h2><InlineTextEditor value={contact.emptyTitle} label="Editar título vazio" onSave={(value) => editor?.savePage("contact", { emptyTitle: value }) ?? Promise.resolve()} /></h2>
            <div><InlineTextEditor value={contact.emptyDescription} label="Editar texto vazio" onSave={(value) => editor?.savePage("contact", { emptyDescription: value }) ?? Promise.resolve()} /></div>
          </div>
        ) : (
          <div className="contact-list">
            {content.contacts.map((entry) => (
              <article className="contact-card contact-card-entry reveal" key={entry.id}>
                <div className="editor-line">
                  <p className="eyebrow">{entry.label}</p>
                  <span className="card-statuses"><EditorialBadge status={entry.editorialStatus} /><ItemEditorialActions collection="contacts" itemId={entry.id} itemLabel={entry.label} /></span>
                </div>
                {entry.href ? <a className="contact-value" href={entry.href}>{entry.value}</a> : <p className="contact-value">{entry.value}</p>}
                {entry.note ? <p>{entry.note}</p> : null}
              </article>
            ))}
          </div>
        )}
        <EditorAddButton collection="contacts">Adicionar contato</EditorAddButton>
        <div className="page-backlink">
          <EditableAction
            href="/"
            value={contact.backLabel}
            label="Editar botão"
            className="button button-outline"
            onNavigate={onNavigate}
            onSave={(value) => editor?.savePage("contact", { backLabel: value }) ?? Promise.resolve()}
          />
        </div>
      </div>
    </div>
  );
}

function SiteFooter({ onNavigate }: { onNavigate: (href: Route) => void }) {
  const editor = useEditor();
  const content = editor?.content ?? seedEditorContent();
  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div>
          <SiteLink href="/" className="footer-wordmark" onNavigate={onNavigate}>{content.identity.name}</SiteLink>
          <p>{content.identity.role}</p>
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
        {!editor?.editMode ? (
          /* Native navigation is intentional: this crosses into the authenticated server route. */
          <a className="owner-entry" href="/edit">Editar site</a>
        ) : null}
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const setField = (name: string, value: string | boolean) => setFields((current) => ({ ...current, [name]: value }));
  const currentItem = drawer.id ? (editor.content[drawer.collection] as Array<Record<string, unknown>>).find((item) => item.id === drawer.id) : null;
  const isExisting = Boolean(currentItem);
  const title = isExisting ? `Editar ${collectionLabel(drawer.collection).toLowerCase()}` : `Adicionar ${collectionLabel(drawer.collection).toLowerCase()}`;
  const currentStatus = typeof currentItem?.editorialStatus === "string" ? currentItem.editorialStatus : "draft";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstField = dialogRef.current?.querySelector<HTMLElement>(".editor-form input:not([type='hidden']), .editor-form textarea, .editor-form select, .editor-richtext");
    requestAnimationFrame(() => firstField?.focus());
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusableElements = () => [...dialog.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), summary, input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable='true'], [tabindex]:not([tabindex='-1'])",
    )].filter((element) => {
      const closedDetails = element.closest("details:not([open])");
      const hiddenByDetails = closedDetails && element !== closedDetails.querySelector(":scope > summary");
      return !hiddenByDetails && !element.hasAttribute("hidden") && element.getClientRects().length > 0;
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        editor.closeEditor();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        (focusableElements()[0] ?? dialog).focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [busy, editor]);

  const runItemAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não foi possível concluir a ação.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const forcedStatus = submitter?.value === "published" || submitter?.value === "draft" || submitter?.value === "hidden"
      ? submitter.value
      : fields.editorialStatus;
    setBusy(true);
    setError(null);
    const newAssetIds: string[] = [];
    let contentSaved = false;
    try {
      const payload: Record<string, unknown> = { ...fields, editorialStatus: forcedStatus };
      if (typeof payload.technologies === "string") payload.technologies = commaList(payload.technologies);
      if (typeof payload.tags === "string") payload.tags = commaList(payload.tags);
      if (payload.placeholder === true) delete payload.placeholder;

      if (payload.removeCover === true) {
        payload.coverAssetId = null;
        if (drawer.collection === "projects" || drawer.collection === "questions") payload.image = "";
      }
      if (payload.removeDocument === true) {
        payload.documentAssetId = null;
        payload.documentPublic = false;
      }
      delete payload.removeCover;
      delete payload.removeDocument;

      if (coverFile) {
        const asset = await uploadAsset(coverFile, "image", String(payload.imageAlt || payload.title || "Capa"));
        newAssetIds.push(asset.id);
        payload.coverAssetId = asset.id;
        // Only projects and questions own image/imageAlt content fields. Notes
        // and learning entries reference the cover exclusively by asset id.
        if (drawer.collection === "projects" || drawer.collection === "questions") {
          payload.image = `/api/assets?id=${encodeURIComponent(asset.id)}`;
          payload.imageAlt = asset.altText || payload.imageAlt || payload.title;
        }
      }
      if (documentFile) {
        const asset = await uploadAsset(documentFile, "document", String(payload.title || "Documento"));
        newAssetIds.push(asset.id);
        payload.documentAssetId = asset.id;
      }

      await editor.saveItem(drawer.collection, drawer.id, payload);
      contentSaved = true;

      const coverAssetId = typeof payload.coverAssetId === "string" ? payload.coverAssetId : typeof fields.coverAssetId === "string" ? fields.coverAssetId : "";
      const documentAssetId = typeof payload.documentAssetId === "string" ? payload.documentAssetId : typeof fields.documentAssetId === "string" ? fields.documentAssetId : "";

      const oldCoverId = typeof currentItem?.coverAssetId === "string" ? currentItem.coverAssetId : "";
      const oldDocumentId = typeof currentItem?.documentAssetId === "string" ? currentItem.documentAssetId : "";
      if (oldCoverId && (payload.coverAssetId === null || (coverFile && oldCoverId !== coverAssetId))) void deleteAssetBestEffort(oldCoverId);
      if (oldDocumentId && (payload.documentAssetId === null || (documentFile && oldDocumentId !== documentAssetId))) void deleteAssetBestEffort(oldDocumentId);
      editor.closeEditor();
    } catch (submitError) {
      if (!contentSaved) await Promise.all(newAssetIds.map((id) => deleteAssetBestEffort(id)));
      setError(submitError instanceof Error ? submitError.message : "Não foi possível salvar o item.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="editor-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) editor.closeEditor(); }}>
      <div
        ref={dialogRef}
        className="editor-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-drawer-title"
        aria-describedby="editor-drawer-description"
        aria-busy={busy}
        tabIndex={-1}
      >
        <div className="editor-drawer-heading">
          <div>
            <p className="eyebrow">Edição contextual</p>
            <h2 id="editor-drawer-title">{title}</h2>
          </div>
          <button type="button" className="drawer-close" aria-label="Fechar editor" onClick={editor.closeEditor} disabled={busy}>×</button>
        </div>
        <p id="editor-drawer-description" className="editor-drawer-description">Edite os campos abaixo. Itens ocultos continuam disponíveis para restauração no modo do proprietário.</p>

        <form className="editor-form" onSubmit={submit}>
          {drawer.collection === "timeline" ? <TimelineFields fields={fields} setField={setField} /> : null}
          {drawer.collection === "projects" ? <ProjectFields fields={fields} setField={setField} setCoverFile={setCoverFile} /> : null}
          {drawer.collection === "notes" ? <NoteFields fields={fields} setField={setField} setCoverFile={setCoverFile} /> : null}
          {drawer.collection === "learning" ? <LearningFields fields={fields} setField={setField} setCoverFile={setCoverFile} setDocumentFile={setDocumentFile} /> : null}
          {drawer.collection === "questions" ? <QuestionFields fields={fields} setField={setField} setCoverFile={setCoverFile} /> : null}
          {drawer.collection === "contacts" ? <ContactFields fields={fields} setField={setField} /> : null}
          {drawer.collection === "interests" ? <InterestFields fields={fields} setField={setField} /> : null}

          {error ? <p ref={errorRef} className="editor-error" role="alert" tabIndex={-1}>{error}</p> : null}
          <div className="editor-form-actions">
            <button type="button" className="button button-quiet" onClick={editor.closeEditor} disabled={busy}>Cancelar</button>
            {isExisting && currentStatus !== "hidden" ? (
              <button type="button" className="button button-quiet" onClick={() => { if (drawer.id) void runItemAction(() => editor.setItemStatus(drawer.collection, drawer.id!, "hidden")); }} disabled={busy}>Ocultar</button>
            ) : null}
            {isExisting && currentStatus === "hidden" ? (
              <button type="button" className="button button-outline" onClick={() => { if (drawer.id) void runItemAction(() => editor.setItemStatus(drawer.collection, drawer.id!, "draft")); }} disabled={busy}>Restaurar como rascunho</button>
            ) : null}
            <span className="editor-form-submit-group">
              <button
                type="submit"
                name="actionStatus"
                value={currentStatus === "hidden" ? "hidden" : "draft"}
                className="button button-outline"
                disabled={busy}
              >{busy ? "Salvando…" : currentStatus === "hidden" ? "Salvar mantendo oculto" : "Salvar rascunho"}</button>
              <button type="submit" name="actionStatus" value="published" className="button button-primary" disabled={busy}>{busy ? "Salvando…" : "Publicar"}</button>
            </span>
          </div>
          {isExisting ? (
            <details className="editor-danger-zone">
              <summary>Exclusão permanente</summary>
              <p>Esta ação remove o item definitivamente. Para apenas tirá-lo do site, use “Ocultar”.</p>
              <button
                type="button"
                className="button button-danger"
                disabled={busy}
                onClick={() => {
                  if (!drawer.id || !window.confirm("Excluir permanentemente este item? Esta ação não pode ser desfeita.")) return;
                  void runItemAction(() => editor.deleteItem(drawer.collection, drawer.id!));
                }}
              >
                Excluir permanentemente
              </button>
            </details>
          ) : null}
        </form>
      </div>
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
          <ExistingCoverField fields={fields} setField={setField} setCoverFile={setCoverFile} />
        </div>
      </details>
      <EditorStatusField value={String(fields.editorialStatus ?? "draft")} onChange={(value) => setField("editorialStatus", value)} />
      <PlaceholderPromotionField fields={fields} setField={setField} />
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
          <ExistingCoverField fields={fields} setField={setField} setCoverFile={setCoverFile} />
        </div>
      </details>
      <EditorStatusField value={String(fields.editorialStatus ?? "draft")} onChange={(value) => setField("editorialStatus", value)} />
      <PlaceholderPromotionField fields={fields} setField={setField} />
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
          <ExistingCoverField fields={fields} setField={setField} setCoverFile={setCoverFile} />
          <UploadField label="Certificado / documento (privado por padrão)" accept="application/pdf,image/jpeg,image/png" onFile={setDocumentFile} />
          {fields.documentAssetId && fields.removeDocument !== true ? (
            <DocumentPanel
              assetId={String(fields.documentAssetId)}
              title={String(fields.title || "Documento")}
              declaredPublic={fields.documentPublic === true}
              onRemove={() => {
                setDocumentFile(null);
                setField("removeDocument", true);
                setField("documentPublic", false);
              }}
            />
          ) : null}
          {fields.removeDocument === true ? <p className="editor-helper">O documento atual será removido quando você salvar.</p> : null}
          <label className="editor-checkbox">
            <input
              type="checkbox"
              checked={fields.documentPublic === true}
              disabled={fields.removeDocument === true}
              onChange={(event) => {
                if (event.target.checked && !window.confirm("Tornar este documento público permitirá que visitantes o abram. Confirmar?")) return;
                setField("documentPublic", event.target.checked);
              }}
            />
            Tornar o documento público
          </label>
        </div>
      </details>
      <EditorStatusField value={String(fields.editorialStatus ?? "draft")} onChange={(value) => setField("editorialStatus", value)} />
      <PlaceholderPromotionField fields={fields} setField={setField} />
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
          <ExistingCoverField fields={fields} setField={setField} setCoverFile={setCoverFile} />
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
  const normalizedValue = value === "hidden" ? "hidden" : value === "published" ? "published" : "draft";
  return (
    <label className="editor-field">
      <span>Visibilidade</span>
      <select value={normalizedValue} onChange={(event) => onChange(event.target.value)}>
        {normalizedValue === "hidden" ? <option value="hidden">Oculto — use uma ação explícita para restaurar</option> : null}
        {normalizedValue !== "hidden" ? <option value="draft">Rascunho</option> : null}
        {normalizedValue !== "hidden" ? <option value="published">Publicado</option> : null}
      </select>
    </label>
  );
}

function PlaceholderPromotionField({ fields, setField }: { fields: EditorFormState; setField: (name: string, value: string | boolean) => void }) {
  if (fields.placeholder !== true) return null;
  return (
    <label className="editor-checkbox">
      <input type="checkbox" checked onChange={(event) => setField("placeholder", event.target.checked)} />
      Manter aviso de conteúdo temporário
    </label>
  );
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

function ExistingCoverField({
  fields,
  setField,
  setCoverFile,
}: {
  fields: EditorFormState;
  setField: (name: string, value: string | boolean) => void;
  setCoverFile: (file: File | null) => void;
}) {
  if (!fields.coverAssetId || fields.removeCover === true) {
    return fields.removeCover === true ? <p className="editor-helper">A capa atual será removida quando você salvar.</p> : null;
  }
  const assetId = String(fields.coverAssetId);
  return (
    <div className="editor-cover-status">
      <img src={`/api/assets?id=${encodeURIComponent(assetId)}`} alt="Prévia da capa atual" />
      <div>
        <span>Capa atual</span>
        <button
          type="button"
          className="context-edit context-edit-danger"
          onClick={() => {
            setCoverFile(null);
            setField("removeCover", true);
          }}
        >
          Remover capa
        </button>
      </div>
    </div>
  );
}

function initialEditorFields(content: EditorContent, drawer: NonNullable<DrawerState>): EditorFormState {
  const item = drawer.id ? (content[drawer.collection] as Array<Record<string, unknown>>).find((entry) => entry.id === drawer.id) : undefined;
  if (drawer.collection === "timeline") return { period: String(item?.period ?? "Agora"), title: String(item?.title ?? ""), institution: String(item?.institution ?? ""), description: String(item?.description ?? ""), category: String(item?.category ?? "Trajetória"), editorialStatus: String(item?.editorialStatus ?? "draft") };
  if (drawer.collection === "projects") return { title: String(item?.title ?? ""), description: String(item?.description ?? ""), status: String(item?.status ?? "Em andamento"), period: String(item?.period ?? "Em construção"), technologies: Array.isArray(item?.technologies) ? item.technologies.join(", ") : "", body: String(item?.body ?? ""), github: String(item?.github ?? ""), demo: String(item?.demo ?? ""), image: String(item?.image ?? ""), imageAlt: String(item?.imageAlt ?? ""), coverAssetId: String(item?.coverAssetId ?? ""), removeCover: false, placeholder: item?.placeholder === true, editorialStatus: String(item?.editorialStatus ?? "draft") };
  if (drawer.collection === "notes") return { title: String(item?.title ?? ""), body: String(item?.body ?? "<p></p>"), area: String(item?.area ?? "Caderno"), date: String(item?.date ?? ""), tags: Array.isArray(item?.tags) ? item.tags.join(", ") : "", coverAssetId: String(item?.coverAssetId ?? ""), removeCover: false, placeholder: item?.placeholder === true, editorialStatus: String(item?.editorialStatus ?? "draft") };
  if (drawer.collection === "learning") return { title: String(item?.title ?? ""), institution: String(item?.institution ?? ""), year: String(item?.year ?? ""), hours: String(item?.hours ?? ""), category: String(item?.category ?? "Formação"), description: String(item?.description ?? ""), coverAssetId: String(item?.coverAssetId ?? ""), removeCover: false, documentAssetId: String(item?.documentAssetId ?? ""), removeDocument: false, documentPublic: item?.documentPublic === true, placeholder: item?.placeholder === true, editorialStatus: String(item?.editorialStatus ?? "draft") };
  if (drawer.collection === "questions") return { title: String(item?.title ?? ""), text: String(item?.text ?? ""), image: item?.coverAssetId ? "" : String(item?.image ?? ""), imageAlt: String(item?.imageAlt ?? ""), coverAssetId: String(item?.coverAssetId ?? ""), removeCover: false, editorialStatus: String(item?.editorialStatus ?? "draft") };
  if (drawer.collection === "contacts") return { label: String(item?.label ?? ""), value: String(item?.value ?? ""), href: String(item?.href ?? ""), note: String(item?.note ?? ""), editorialStatus: String(item?.editorialStatus ?? "draft") };
  return { value: String(item?.value ?? ""), editorialStatus: String(item?.editorialStatus ?? "draft") };
}

function collectionLabel(collection: EditableCollection): string {
  return collection === "timeline" ? "marco" : collection === "projects" ? "projeto" : collection === "notes" ? "nota" : collection === "learning" ? "formação" : collection === "questions" ? "pergunta" : collection === "contacts" ? "contato" : "interesse";
}

function commaList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function uploadAsset(file: File, kind: "image" | "document", altText: string): Promise<{ id: string; altText: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  form.append("altText", altText);
  const response = await fetch("/api/assets", { method: "POST", body: form });
  const payload = await response.json() as { asset?: { id: string; altText: string }; error?: string };
  if (!response.ok || !payload.asset) throw new Error(payload.error ?? "Não foi possível enviar o arquivo.");
  return payload.asset;
}

async function deleteAssetBestEffort(id: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`/api/assets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (response.ok || response.status === 404) return true;
      if (response.status !== 503 && response.status !== 409) return false;
    } catch {
      // Retry transient network failures below. The content reconciliation has
      // already made an unlinked asset private before cleanup starts.
    }
    if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 120 * (attempt + 1)));
  }
  return false;
}

type ContentApiPayload = {
  content?: EditorContent;
  version?: number;
  error?: string;
};

export default function HomeExperience({ initialRoute, initialContent }: { initialRoute: Route; initialContent: EditorContent }) {
  const [route, setRoute] = useState<Route>(initialRoute);
  const [content, setContent] = useState<EditorContent>(initialContent);
  const [ownerAvailable, setOwnerAvailable] = useState(false);
  const [editMode, setEditModeState] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pageRef = useRef<HTMLElement>(null);
  const focusBeforeDrawerRef = useRef<HTMLElement | null>(null);
  const focusPageAfterNavigationRef = useRef(false);
  const contentVersionRef = useRef<number | null>(null);
  const canEdit = ownerAvailable && editMode;

  const applyVersionedContent = (payload: ContentApiPayload): boolean => {
    if (!payload.content || !Number.isSafeInteger(payload.version) || (payload.version ?? 0) < 1) return false;
    contentVersionRef.current = payload.version!;
    setContent(payload.content);
    return true;
  };

  const versionedHeaders = (includeJson = true): Record<string, string> => {
    const version = contentVersionRef.current;
    if (!Number.isSafeInteger(version) || (version ?? 0) < 1) {
      throw new Error("A versão editorial não está disponível. Reabra o modo de edição antes de salvar.");
    }
    return {
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
      "If-Match": `"${version}"`,
    };
  };

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
          // Editing is enabled only after the private payload and its version
          // are both confirmed below.
          setEditModeState(false);
        }

        if (canOwnerEdit && requestedEdit) {
          const contentResponse = await fetch("/api/content?editor=1", { cache: "no-store" });
          const payload = await contentResponse.json() as ContentApiPayload;
          if (active) {
            if (contentResponse.ok && applyVersionedContent(payload)) {
              setEditModeState(true);
            } else {
              setEditModeState(false);
              setStatusMessage(payload.error ?? "Não foi possível confirmar a versão do conteúdo editorial.");
            }
          }
        }
      } catch {
        if (active) {
          setEditModeState(false);
          setStatusMessage("Não foi possível carregar o modo de edição.");
        }
      }
    };
    void bootstrap();
    return () => { active = false; };
  }, []);

  const viewAsVisitor = async () => {
    setEditModeState(false);
    setDrawer(null);
    window.history.replaceState({}, "", window.location.pathname);
    try {
      const response = await fetch("/api/content", { cache: "no-store" });
      const payload = await response.json() as ContentApiPayload;
      if (response.ok && payload.content) {
        setContent(payload.content);
        if (Number.isSafeInteger(payload.version) && (payload.version ?? 0) > 0) contentVersionRef.current = payload.version!;
      }
      else setContent((current) => publicEditorContent(current));
    } catch {
      setContent((current) => publicEditorContent(current));
    }
  };

  const saveItem = async (collection: EditableCollection, id: string | undefined, payload: Record<string, unknown>) => {
    const response = await fetch(id ? `/api/content?collection=${collection}&id=${encodeURIComponent(id)}` : "/api/content", {
      method: id ? "PATCH" : "POST",
      headers: versionedHeaders(),
      body: JSON.stringify(id ? payload : { collection, item: payload }),
    });
    const result = await response.json() as ContentApiPayload;
    if (!response.ok || !applyVersionedContent(result)) throw new Error(result.error ?? "Não foi possível salvar o item.");
    setStatusMessage("Alteração salva.");
  };

  const setItemStatus = async (collection: EditableCollection, id: string, status: EditorialStatus) => {
    const response = await fetch(`/api/content?collection=${collection}&id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: versionedHeaders(),
      body: JSON.stringify({ editorialStatus: status }),
    });
    const result = await response.json() as ContentApiPayload;
    if (!response.ok || !applyVersionedContent(result)) throw new Error(result.error ?? "Não foi possível alterar a visibilidade do item.");
    closeEditor();
    setStatusMessage(status === "hidden" ? "Item ocultado. Ele pode ser restaurado no modo de edição." : "Item restaurado como rascunho.");
  };

  const deleteItem = async (collection: EditableCollection, id: string) => {
    const currentItem = (content[collection] as Array<Record<string, unknown>>).find((item) => item.id === id);
    const assetIds = [currentItem?.coverAssetId, currentItem?.documentAssetId]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const response = await fetch(`/api/content?collection=${collection}&id=${encodeURIComponent(id)}`, { method: "DELETE", headers: versionedHeaders(false) });
    const result = await response.json() as ContentApiPayload;
    if (!response.ok || !applyVersionedContent(result)) throw new Error(result.error ?? "Não foi possível excluir o item.");
    const cleanup = await Promise.all(assetIds.map((assetId) => deleteAssetBestEffort(assetId)));
    closeEditor();
    setStatusMessage(cleanup.every(Boolean)
      ? "Item excluído permanentemente; arquivos associados também foram removidos."
      : "Item excluído. Um arquivo permaneceu privado e requer nova tentativa de limpeza.");
  };

  const reorder = async (collection: EditableCollection, orderedIds: string[]) => {
    const response = await fetch("/api/content", { method: "PUT", headers: versionedHeaders(), body: JSON.stringify({ collection, orderedIds }) });
    const result = await response.json() as ContentApiPayload;
    if (!response.ok || !applyVersionedContent(result)) {
      setStatusMessage(result.error ?? "Não foi possível reordenar.");
      return;
    }
    setStatusMessage("Ordem atualizada.");
  };

  const saveIdentity = async (field: "name" | "role" | "location" | "description", value: string) => {
    const response = await fetch("/api/content?collection=identity&id=primary", { method: "PATCH", headers: versionedHeaders(), body: JSON.stringify({ [field]: value }) });
    const result = await response.json() as ContentApiPayload;
    if (!response.ok || !applyVersionedContent(result)) throw new Error(result.error ?? "Não foi possível salvar o texto.");
    setStatusMessage("Texto salvo.");
  };

  const savePage = async (page: EditablePage, fields: Record<string, string>) => {
    const response = await fetch(`/api/content?collection=${page}&id=primary`, { method: "PATCH", headers: versionedHeaders(), body: JSON.stringify(fields) });
    const result = await response.json() as ContentApiPayload;
    if (!response.ok || !applyVersionedContent(result)) throw new Error(result.error ?? "Não foi possível salvar a página.");
    setStatusMessage("Texto salvo.");
  };

  const signOut = () => {
    window.location.href = `/signout-with-chatgpt?return_to=${encodeURIComponent(window.location.pathname)}`;
  };

  const navigate = (nextRoute: Route) => {
    window.history.pushState({}, "", editMode ? `${nextRoute}?edit=1` : nextRoute);
    focusPageAfterNavigationRef.current = true;
    setRoute(nextRoute);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  useLayoutEffect(() => {
    const syncRoute = () => {
      const nextRoute = normalizeSiteRoute(window.location.pathname);
      if (nextRoute) {
        focusPageAfterNavigationRef.current = true;
        setRoute(nextRoute);
      }
    };
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    document.title = routeDefinition(route).title;
    if (!focusPageAfterNavigationRef.current) return;
    focusPageAfterNavigationRef.current = false;
    requestAnimationFrame(() => pageRef.current?.focus({ preventScroll: true }));
  }, [route]);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const revealTargets = pageRef.current?.querySelectorAll<HTMLElement>(".hero-reveal, .reveal") ?? [];
      if (revealTargets.length) {
        gsap.fromTo(
          revealTargets,
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: 0.78, ease: "power3.out", stagger: 0.05, clearProps: "opacity,transform" },
        );
      }

      const imageTargets = pageRef.current?.querySelectorAll<HTMLElement>(".image-reveal") ?? [];
      imageTargets.forEach((element) => {
        gsap.fromTo(element, { opacity: 0.72, scale: 0.96 }, {
          opacity: 1,
          scale: 1,
          duration: 0.7,
          ease: "power2.out",
          clearProps: "opacity,transform",
          scrollTrigger: { trigger: element, start: "top 88%", once: true },
        });
      });

      const studyTargets = pageRef.current?.querySelectorAll<HTMLElement>(".study-card-reveal") ?? [];
      studyTargets.forEach((element) => {
        gsap.fromTo(element, { opacity: 0, y: 20 }, {
          opacity: 1,
          y: 0,
          duration: 0.68,
          ease: "power3.out",
          clearProps: "opacity,transform",
          scrollTrigger: { trigger: element, start: "top 86%", once: true },
        });
      });

      const pinTarget = pageRef.current?.querySelector<HTMLElement>(".study-stage-pin");
      const pinSection = pageRef.current?.querySelector<HTMLElement>(".study-stage");
      if (pinTarget && pinSection && window.matchMedia("(min-width: 900px)").matches) {
        ScrollTrigger.create({ trigger: pinSection, pin: pinTarget, start: "top top+=100", end: "bottom bottom-=100", pinSpacing: false });
      }
    });
    return () => media.revert();
  }, { scope: pageRef, dependencies: [route], revertOnUpdate: true });

  let page: ReactNode;
  if (route === "/sobre") page = <AboutPage onNavigate={navigate} />;
  else if (route === "/trajetoria") page = <TrajectoryPage onNavigate={navigate} />;
  else if (route === "/projetos") page = <ProjectsPage onNavigate={navigate} />;
  else if (route === "/caderno") page = <JournalPage onNavigate={navigate} />;
  else if (route === "/formacao") page = <FormationPage onNavigate={navigate} />;
  else if (route === "/contato") page = <ContactPage onNavigate={navigate} />;
  else page = <HomePage onNavigate={navigate} />;

  const closeEditor = () => {
    setDrawer(null);
    const target = focusBeforeDrawerRef.current;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
      focusBeforeDrawerRef.current = null;
    });
  };

  const editorController: EditorController = {
    content,
    ownerAvailable,
    editMode,
    canEdit,
    drawer,
    statusMessage,
    openEditor: (collection, id) => {
      focusBeforeDrawerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setDrawer({ collection, id });
    },
    closeEditor,
    viewAsVisitor,
    signOut,
    saveItem,
    setItemStatus,
    deleteItem,
    reorder,
    saveIdentity,
    savePage,
    setStatusMessage,
  };

  return (
    <EditorContext.Provider value={editorController}>
      <div className="site-app">
        <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
        <div className="site-surface" inert={drawer ? true : undefined} aria-hidden={drawer ? true : undefined}>
          <SiteHeader route={route} onNavigate={navigate} />
          <main id="main-content" className="page-shell" ref={pageRef} tabIndex={-1}>{page}</main>
          <SiteFooter onNavigate={navigate} />
          <OwnerBar />
        </div>
        <EditorDrawer />
      </div>
    </EditorContext.Provider>
  );
}
