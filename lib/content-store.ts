import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { contentAssets, siteContent } from "../db/schema";
import {
  seedEditorContent,
  sortEditorContent,
  type EditableCollection,
  type EditorContent,
} from "../content/editorial";
import { getRuntimeEnv } from "./runtime";

const PRIMARY_CONTENT_ID = "primary";
const LEGACY_PLACEHOLDER_IMAGES = new Set([
  "https://picsum.photos/seed/spiral-galaxy-notes/1200/900",
  "https://picsum.photos/seed/observatory-night/1200/900",
  "https://picsum.photos/seed/quiet-observation/1200/900",
  "https://picsum.photos/seed/deep-field/1200/900",
  "https://picsum.photos/seed/analog-notes/1200/900",
]);

export type EditorContentRecord = {
  content: EditorContent;
  version: number;
  updatedAt: string;
};

export type AssetReference = {
  id: string;
  kind: "image" | "document";
  collection: EditableCollection;
  itemId: string;
  isPublic: boolean;
};

export class ContentConflictError extends Error {
  constructor() {
    super("O conteúdo foi alterado em outra sessão. Recarregue antes de salvar novamente.");
    this.name = "ContentConflictError";
  }
}

export class AssetReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetReferenceError";
  }
}

export async function loadEditorContent(): Promise<EditorContent> {
  return (await loadEditorContentRecord()).content;
}

export async function loadEditorContentRecord(): Promise<EditorContentRecord> {
  const db = getDb();
  let row = await db
    .select()
    .from(siteContent)
    .where(eq(siteContent.id, PRIMARY_CONTENT_ID))
    .get();

  if (!row) {
    const seed = seedEditorContent();
    await db
      .insert(siteContent)
      .values({ id: PRIMARY_CONTENT_ID, payload: JSON.stringify(seed), version: 1 })
      .onConflictDoNothing();
    row = await db
      .select()
      .from(siteContent)
      .where(eq(siteContent.id, PRIMARY_CONTENT_ID))
      .get();
  }

  if (!row) throw new Error("O conteúdo inicial não pôde ser criado.");
  return {
    content: sortEditorContent(parseEditorContent(row.payload)),
    version: Number.isSafeInteger(row.version) && row.version > 0 ? row.version : 1,
    updatedAt: row.updatedAt,
  };
}

export async function saveEditorContent(
  content: EditorContent,
  options: {
    expectedVersion: number;
    ownerUserId: string;
    previousContent: EditorContent;
  },
): Promise<EditorContentRecord> {
  if (!Number.isSafeInteger(options.expectedVersion) || options.expectedVersion < 1) {
    throw new ContentConflictError();
  }

  const sorted = sortEditorContent(content);
  const references = collectAssetReferences(sorted);
  const previousReferences = collectAssetReferences(options.previousContent);
  const previousById = new Map(previousReferences.map((reference) => [reference.id, reference]));
  const changedReferences = references.filter((reference) => {
    const previous = previousById.get(reference.id);
    return !previous
      || previous.kind !== reference.kind
      || previous.collection !== reference.collection
      || previous.itemId !== reference.itemId
      || previous.isPublic !== reference.isPublic;
  });
  await validateAssetReferences(changedReferences, previousReferences, options.ownerUserId);

  const database = getRuntimeEnv().DB;
  if (!database) throw new Error("Cloudflare D1 binding `DB` indisponível.");

  const payload = JSON.stringify(sorted);
  const updatedAt = new Date().toISOString();
  const nextVersion = options.expectedVersion + 1;
  const contentBindings: Array<string | number> = [
    payload,
    updatedAt,
    PRIMARY_CONTENT_ID,
    options.expectedVersion,
  ];
  let contentSql = `UPDATE site_content
    SET payload = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?`;

  for (const reference of changedReferences) {
    contentSql += ` AND EXISTS (
      SELECT 1 FROM content_assets
      WHERE id = ? AND owner_user_id = ? AND kind = ?
        AND lifecycle_state IN ('pending', 'linked', 'orphaned')
    )`;
    contentBindings.push(reference.id, options.ownerUserId, reference.kind);
  }
  contentSql += " RETURNING version, updated_at";

  const statements: D1PreparedStatement[] = [
    database.prepare(contentSql).bind(...contentBindings),
  ];
  const exactContentGuard = `EXISTS (
    SELECT 1 FROM site_content
    WHERE id = ? AND version = ? AND payload = ?
  )`;

  for (const reference of changedReferences) {
    statements.push(database.prepare(`UPDATE content_assets
      SET is_public = ?, lifecycle_state = 'linked', linked_collection = ?,
        linked_item_id = ?, updated_at = ?
      WHERE id = ? AND owner_user_id = ? AND ${exactContentGuard}`)
      .bind(
        reference.isPublic ? 1 : 0,
        reference.collection,
        reference.itemId,
        updatedAt,
        reference.id,
        options.ownerUserId,
        PRIMARY_CONTENT_ID,
        nextVersion,
        payload,
      ));
  }

  const nextIds = new Set(references.map((reference) => reference.id));
  for (const previous of previousReferences) {
    if (nextIds.has(previous.id)) continue;
    statements.push(database.prepare(`UPDATE content_assets
      SET is_public = 0, lifecycle_state = 'orphaned', linked_collection = NULL,
        linked_item_id = NULL, updated_at = ?
      WHERE id = ? AND owner_user_id = ? AND ${exactContentGuard}`)
      .bind(
        updatedAt,
        previous.id,
        options.ownerUserId,
        PRIMARY_CONTENT_ID,
        nextVersion,
        payload,
      ));
  }

  const results = await database.batch(statements);
  const saved = (results[0]?.results ?? []) as Array<{ version?: unknown; updated_at?: unknown }>;
  const savedVersion = saved[0]?.version;
  if (typeof savedVersion !== "number" || savedVersion !== nextVersion) {
    throw new ContentConflictError();
  }

  return {
    content: sorted,
    version: savedVersion,
    updatedAt: typeof saved[0]?.updated_at === "string" ? saved[0].updated_at : updatedAt,
  };
}

export function collectAssetReferences(content: EditorContent): AssetReference[] {
  const references: AssetReference[] = [];
  const seen = new Set<string>();
  const add = (reference: AssetReference) => {
    if (seen.has(reference.id)) {
      throw new AssetReferenceError("Cada arquivo só pode ser vinculado a um item editorial.");
    }
    seen.add(reference.id);
    references.push(reference);
  };

  for (const entry of content.projects) {
    if (entry.coverAssetId) add({
      id: entry.coverAssetId,
      kind: "image",
      collection: "projects",
      itemId: entry.id,
      isPublic: entry.editorialStatus === "published",
    });
  }
  for (const entry of content.notes) {
    if (entry.coverAssetId) add({
      id: entry.coverAssetId,
      kind: "image",
      collection: "notes",
      itemId: entry.id,
      isPublic: entry.editorialStatus === "published",
    });
  }
  for (const entry of content.learning) {
    if (entry.coverAssetId) add({
      id: entry.coverAssetId,
      kind: "image",
      collection: "learning",
      itemId: entry.id,
      isPublic: entry.editorialStatus === "published",
    });
    if (entry.documentAssetId) add({
      id: entry.documentAssetId,
      kind: "document",
      collection: "learning",
      itemId: entry.id,
      isPublic: entry.editorialStatus === "published" && entry.documentPublic === true,
    });
  }
  for (const entry of content.questions) {
    if (entry.coverAssetId) add({
      id: entry.coverAssetId,
      kind: "image",
      collection: "questions",
      itemId: entry.id,
      isPublic: entry.editorialStatus === "published",
    });
  }
  return references;
}

export function findAssetReference(content: EditorContent, id: string): AssetReference | undefined {
  return collectAssetReferences(content).find((reference) => reference.id === id);
}

async function validateAssetReferences(
  references: AssetReference[],
  previousReferences: AssetReference[],
  ownerUserId: string,
): Promise<void> {
  if (references.length === 0) return;
  const db = getDb();
  const rows = await db
    .select({
      id: contentAssets.id,
      ownerUserId: contentAssets.ownerUserId,
      kind: contentAssets.kind,
      lifecycleState: contentAssets.lifecycleState,
      linkedCollection: contentAssets.linkedCollection,
      linkedItemId: contentAssets.linkedItemId,
    })
    .from(contentAssets)
    .where(inArray(contentAssets.id, references.map((reference) => reference.id)))
    .all();
  const byId = new Map(rows.map((row) => [row.id, row]));
  const previousIds = new Set(previousReferences.map((reference) => reference.id));

  for (const reference of references) {
    const asset = byId.get(reference.id);
    if (!asset || asset.ownerUserId !== ownerUserId) {
      throw new AssetReferenceError("O arquivo vinculado não existe ou não pertence ao proprietário.");
    }
    if (asset.kind !== reference.kind) {
      throw new AssetReferenceError("O tipo do arquivo não corresponde ao campo editorial.");
    }
    if (asset.lifecycleState === "deleting") {
      throw new AssetReferenceError("O arquivo vinculado está sendo removido.");
    }
    if (asset.lifecycleState === "linked" && !previousIds.has(reference.id)
      && (asset.linkedCollection !== reference.collection || asset.linkedItemId !== reference.itemId)) {
      throw new AssetReferenceError("O arquivo já está vinculado a outro item editorial.");
    }
  }
}

function parseEditorContent(payload: string): EditorContent {
  const parsedValue: unknown = JSON.parse(payload);
  if (typeof parsedValue !== "object" || parsedValue === null || Array.isArray(parsedValue)) {
    throw new Error("O conteúdo editorial persistido é inválido.");
  }
  const parsed = parsedValue as Partial<EditorContent>;
  const seed = seedEditorContent();
  return {
      ...seed,
      ...parsed,
      identity: { ...seed.identity, ...(parsed.identity ?? {}) },
      home: { ...seed.home, ...(parsed.home ?? {}) },
      about: { ...seed.about, ...(parsed.about ?? {}) },
      contact: { ...seed.contact, ...(parsed.contact ?? {}) },
      timeline: Array.isArray(parsed.timeline) ? parsed.timeline : seed.timeline,
      projects: Array.isArray(parsed.projects)
        ? parsed.projects.map((project, index) => ({
          ...project,
          image: localizeLegacyPlaceholderImage(project.image) || seed.projects[index % seed.projects.length].image,
        }))
        : seed.projects,
      notes: Array.isArray(parsed.notes) ? parsed.notes : seed.notes,
      learning: Array.isArray(parsed.learning)
        ? parsed.learning.map((entry) => ({ ...entry, documentPublic: entry.documentPublic === true }))
        : seed.learning,
      interests: Array.isArray(parsed.interests) ? parsed.interests : seed.interests,
      questions: Array.isArray(parsed.questions)
        ? parsed.questions.map((question, index) => ({
          ...seed.questions[index % seed.questions.length],
          ...question,
          image: localizeLegacyPlaceholderImage(question.image) || seed.questions[index % seed.questions.length].image,
          imageAlt: question.imageAlt || seed.questions[index % seed.questions.length].imageAlt,
        }))
        : seed.questions,
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : seed.contacts,
      tools: Array.isArray(parsed.tools) ? parsed.tools : seed.tools,
  };
}

function localizeLegacyPlaceholderImage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return LEGACY_PLACEHOLDER_IMAGES.has(value) ? "/og-sky.jpg" : value;
}
