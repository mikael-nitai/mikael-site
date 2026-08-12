import { getOwnerChatGPTUser, type ChatGPTUser } from "../../chatgpt-auth";
import {
  isEditableCollection,
  isEditorialStatus,
  publicEditorContent,
  type EditableCollection,
  type EditorContent,
  type EditorialStatus,
} from "../../../content/editorial";
import {
  AssetReferenceError,
  ContentConflictError,
  loadEditorContentRecord,
  saveEditorContent,
  type EditorContentRecord,
} from "../../../lib/content-store";
import {
  deriveReadingTime,
  deriveSummary,
  plainTextFromRichText,
  sanitizeRichText,
} from "../../../lib/sanitize";

export const dynamic = "force-dynamic";

const MAX_JSON_BYTES = 256 * 1024;
const ITEM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_IMAGE_FALLBACK = "/og-sky.jpg";
const QUESTION_IMAGE_FALLBACK = "/og-sky.jpg";

type EditableItem = EditorContent[EditableCollection][number];

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class PreconditionRequiredError extends Error {
  constructor() {
    super("Informe a versão editorial no cabeçalho If-Match.");
    this.name = "PreconditionRequiredError";
  }
}

export async function GET(request: Request): Promise<Response> {
  const wantsEditor = new URL(request.url).searchParams.get("editor") === "1";
  if (wantsEditor && !(await getOwnerChatGPTUser())) return unauthorizedResponse();

  try {
    const record = await loadEditorContentRecord();
    return contentResponse(wantsEditor ? record.content : publicEditorContent(record.content), record);
  } catch (error) {
    console.error("Falha ao carregar conteúdo editorial", error);
    return jsonResponse({ error: "O conteúdo ainda não está disponível." }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const user = await getOwnerChatGPTUser();
  if (!user) return unauthorizedResponse();
  const requestGuard = writeRequestGuard(request, true);
  if (requestGuard) return requestGuard;

  try {
    const input = await readJsonRecord(request);
    assertOnlyKeys(input, ["collection", "item"]);
    if (typeof input.collection !== "string" || !isEditableCollection(input.collection)) {
      throw new ValidationError("Coleção inválida.");
    }
    const rawItem = asRecord(input.item, "Preencha os dados do item.");
    const record = await loadEditorContentRecord();
    const item = normalizeItem(input.collection, rawItem, record.content);
    const next = {
      ...record.content,
      [input.collection]: [...record.content[input.collection], item],
    } as EditorContent;
    return await persistMutation(request, record, next, user, 201);
  } catch (error) {
    return mutationErrorResponse(error, "Não foi possível salvar o item.");
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await getOwnerChatGPTUser();
  if (!user) return unauthorizedResponse();
  const requestGuard = writeRequestGuard(request, true);
  if (requestGuard) return requestGuard;
  const params = new URL(request.url).searchParams;
  const collection = params.get("collection");
  const id = params.get("id");

  try {
    if (!id || !ITEM_ID_PATTERN.test(id)) throw new ValidationError("Item inválido.");
    const input = await readJsonRecord(request);
    const record = await loadEditorContentRecord();

    if (collection === "identity" && id === "primary") {
      const next = { ...record.content, identity: normalizeIdentity(record.content, input) };
      return await persistMutation(request, record, next, user);
    }
    if (collection === "home" || collection === "about" || collection === "contact") {
      if (id !== "primary") throw new ValidationError("Página inválida.");
      const next = { ...record.content, [collection]: normalizePage(collection, record.content, input) };
      return await persistMutation(request, record, next, user);
    }
    if (!isEditableCollection(collection)) throw new ValidationError("Item inválido.");

    const entries = record.content[collection];
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) return jsonResponse({ error: "Item não encontrado." }, { status: 404 });
    const nextItem = normalizeItem(collection, input, record.content, entries[index]);
    const nextEntries = entries.map((entry, entryIndex) => entryIndex === index ? nextItem : entry);
    const next = { ...record.content, [collection]: nextEntries } as EditorContent;
    return await persistMutation(request, record, next, user);
  } catch (error) {
    return mutationErrorResponse(error, "Não foi possível salvar as alterações.");
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const user = await getOwnerChatGPTUser();
  if (!user) return unauthorizedResponse();
  const requestGuard = writeRequestGuard(request, false);
  if (requestGuard) return requestGuard;
  const params = new URL(request.url).searchParams;
  const collection = params.get("collection");
  const id = params.get("id");

  try {
    if (!isEditableCollection(collection) || !id || !ITEM_ID_PATTERN.test(id)) {
      throw new ValidationError("Item inválido.");
    }
    const record = await loadEditorContentRecord();
    const entries = record.content[collection];
    if (!entries.some((entry) => entry.id === id)) {
      return jsonResponse({ error: "Item não encontrado." }, { status: 404 });
    }
    const remaining = entries
      .filter((entry) => entry.id !== id)
      .map((entry, order) => ({ ...entry, order }));
    const next = {
      ...record.content,
      [collection]: remaining,
    } as EditorContent;
    return await persistMutation(request, record, next, user);
  } catch (error) {
    return mutationErrorResponse(error, "Não foi possível remover o item.");
  }
}

export async function PUT(request: Request): Promise<Response> {
  const user = await getOwnerChatGPTUser();
  if (!user) return unauthorizedResponse();
  const requestGuard = writeRequestGuard(request, true);
  if (requestGuard) return requestGuard;

  try {
    const input = await readJsonRecord(request);
    assertOnlyKeys(input, ["collection", "orderedIds"]);
    if (typeof input.collection !== "string" || !isEditableCollection(input.collection)
      || !Array.isArray(input.orderedIds)) {
      throw new ValidationError("Ordem inválida.");
    }
    const record = await loadEditorContentRecord();
    const entries = record.content[input.collection];
    if (input.orderedIds.length !== entries.length
      || input.orderedIds.some((value) => typeof value !== "string" || !ITEM_ID_PATTERN.test(value))) {
      throw new ValidationError("A ordem deve conter todos os itens exatamente uma vez.");
    }
    const ids = input.orderedIds as string[];
    const received = new Set(ids);
    const expected = new Set(entries.map((entry) => entry.id));
    if (received.size !== ids.length || received.size !== expected.size
      || [...received].some((value) => !expected.has(value))) {
      throw new ValidationError("A ordem deve conter todos os itens exatamente uma vez.");
    }
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const reordered = ids.map((orderedId, order) => ({ ...byId.get(orderedId)!, order }));
    const next = { ...record.content, [input.collection]: reordered } as EditorContent;
    return await persistMutation(request, record, next, user);
  } catch (error) {
    return mutationErrorResponse(error, "Não foi possível reordenar os itens.");
  }
}

async function persistMutation(
  request: Request,
  record: EditorContentRecord,
  content: EditorContent,
  user: ChatGPTUser,
  status = 200,
): Promise<Response> {
  const expectedVersion = expectedVersionFromRequest(request);
  if (expectedVersion !== record.version) throw new ContentConflictError();
  const saved = await saveEditorContent(content, {
    expectedVersion,
    ownerUserId: user.userId,
    previousContent: record.content,
  });
  return contentResponse(saved.content, saved, status);
}

function normalizeIdentity(content: EditorContent, input: Record<string, unknown>): EditorContent["identity"] {
  const fields = ["name", "role", "location", "description"] as const;
  assertOnlyKeys(input, fields);
  assertNotEmpty(input);
  const identity = { ...content.identity };
  for (const field of fields) {
    if (hasOwn(input, field)) identity[field] = requiredString(input[field], field, field === "description" ? 2_000 : 240);
  }
  for (const field of fields) {
    if (!identity[field]) throw new ValidationError("Os campos de identidade não podem ficar vazios.");
  }
  return identity;
}

function normalizePage(
  page: "home" | "about" | "contact",
  content: EditorContent,
  input: Record<string, unknown>,
): EditorContent[typeof page] {
  const fields = page === "home"
    ? ["overviewTitle", "overviewDescription", "closingEyebrow", "closingTitle", "closingDescription", "closingActionLabel"] as const
    : page === "about"
      ? ["title", "body"] as const
      : ["eyebrow", "title", "description", "emptyEyebrow", "emptyTitle", "emptyDescription", "backLabel"] as const;
  assertOnlyKeys(input, fields);
  assertNotEmpty(input);
  const next = { ...content[page] } as Record<string, string>;
  for (const field of fields) {
    if (hasOwn(input, field)) next[field] = requiredString(input[field], field, field.includes("Description") || field === "body" ? 20_000 : 500);
  }
  if (Object.values(next).some((value) => !value.trim())) {
    throw new ValidationError("Os textos da página não podem ficar vazios.");
  }
  return next as EditorContent[typeof page];
}

function normalizeItem(
  collection: EditableCollection,
  raw: Record<string, unknown>,
  content: EditorContent,
  current?: EditableItem,
): EditableItem {
  const allowed = allowedItemKeys(collection);
  assertOnlyKeys(raw, allowed);
  assertNotEmpty(raw);

  const merged = { ...(current as unknown as Record<string, unknown> | undefined), ...raw };
  const base = {
    id: current?.id ?? `${collection}-${crypto.randomUUID()}`,
    editorialStatus: normalizedStatus(merged.editorialStatus, current ? undefined : "draft"),
    order: current?.order ?? content[collection].reduce((maximum, entry) => Math.max(maximum, entry.order), -1) + 1,
  };
  const wasPlaceholder = current && "placeholder" in current && current.placeholder === true;
  if (hasOwn(raw, "placeholder") && (raw.placeholder !== false || !wasPlaceholder)) {
    throw new ValidationError("placeholder aceita somente false para promover conteúdo temporário.");
  }
  const placeholder = raw.placeholder === false
    ? {}
    : wasPlaceholder ? { placeholder: true as const } : {};

  if (collection === "timeline") {
    return {
      ...base,
      period: optionalString(merged.period, "period", 120) ?? "Agora",
      title: requiredString(merged.title, "title", 240),
      institution: optionalString(merged.institution, "institution", 240),
      description: requiredString(merged.description, "description", 4_000),
      category: optionalString(merged.category, "category", 120) ?? "Trajetória",
    };
  }
  if (collection === "projects") {
    const title = requiredString(merged.title, "title", 240);
    const coverAssetId = assetId(merged.coverAssetId, "coverAssetId");
    const image = coverAssetId
      ? assetUrl(coverAssetId)
      : safeImageSource(merged.image, PROJECT_IMAGE_FALLBACK);
    const body = optionalString(merged.body, "body", 100_000);
    return {
      ...base,
      ...placeholder,
      title,
      description: requiredString(merged.description, "description", 4_000),
      status: optionalString(merged.status, "status", 120) ?? "Em andamento",
      period: optionalString(merged.period, "period", 120) ?? "Em construção",
      image,
      imageAlt: optionalString(merged.imageAlt, "imageAlt", 500) ?? title,
      technologies: stringList(merged.technologies, "technologies"),
      body: body ? sanitizeRichText(body) : undefined,
      github: optionalHttpsUrl(merged.github, "github"),
      demo: optionalHttpsUrl(merged.demo, "demo"),
      coverAssetId,
    };
  }
  if (collection === "notes") {
    const body = sanitizeRichText(requiredString(merged.body, "body", 100_000));
    if (!plainTextFromRichText(body)) throw new ValidationError("O texto da nota é obrigatório.");
    return {
      ...base,
      ...placeholder,
      title: requiredString(merged.title, "title", 240),
      body,
      summary: deriveSummary(body),
      date: optionalString(merged.date, "date", 120) ?? todayLabel(),
      area: optionalString(merged.area, "area", 120) ?? "Caderno",
      readingTime: deriveReadingTime(body),
      tags: stringList(merged.tags, "tags"),
      coverAssetId: assetId(merged.coverAssetId, "coverAssetId"),
    };
  }
  if (collection === "learning") {
    if (hasOwn(raw, "documentPublic") && typeof raw.documentPublic !== "boolean") {
      throw new ValidationError("documentPublic deve ser um booleano.");
    }
    const documentPublic = merged.documentPublic === undefined && !current ? false : merged.documentPublic;
    if (typeof documentPublic !== "boolean") {
      throw new ValidationError("documentPublic deve ser um booleano.");
    }
    const documentAssetId = assetId(merged.documentAssetId, "documentAssetId");
    return {
      ...base,
      ...placeholder,
      title: requiredString(merged.title, "title", 240),
      institution: requiredString(merged.institution, "institution", 240),
      year: requiredString(merged.year, "year", 80),
      category: optionalString(merged.category, "category", 120) ?? "Formação",
      hours: optionalString(merged.hours, "hours", 80),
      description: optionalString(merged.description, "description", 4_000),
      coverAssetId: assetId(merged.coverAssetId, "coverAssetId"),
      documentAssetId,
      documentPublic: documentAssetId ? documentPublic : false,
    };
  }
  if (collection === "questions") {
    const title = requiredString(merged.title, "title", 240);
    const coverAssetId = assetId(merged.coverAssetId, "coverAssetId");
    return {
      ...base,
      title,
      text: requiredString(merged.text, "text", 10_000),
      image: coverAssetId ? assetUrl(coverAssetId) : safeImageSource(merged.image, QUESTION_IMAGE_FALLBACK),
      imageAlt: optionalString(merged.imageAlt, "imageAlt", 500) ?? title,
      coverAssetId,
    };
  }
  if (collection === "contacts") {
    return {
      ...base,
      label: requiredString(merged.label, "label", 120),
      value: requiredString(merged.value, "value", 500),
      href: optionalContactUrl(merged.href),
      note: optionalString(merged.note, "note", 2_000),
    };
  }
  return {
    ...base,
    value: requiredString(merged.value, "value", 240),
  };
}

function allowedItemKeys(collection: EditableCollection): readonly string[] {
  if (collection === "timeline") return ["period", "title", "institution", "description", "category", "editorialStatus"];
  if (collection === "projects") return ["title", "description", "status", "period", "image", "imageAlt", "technologies", "body", "github", "demo", "coverAssetId", "placeholder", "editorialStatus"];
  if (collection === "notes") return ["title", "body", "date", "area", "tags", "coverAssetId", "placeholder", "editorialStatus"];
  if (collection === "learning") return ["title", "institution", "year", "category", "hours", "description", "coverAssetId", "documentAssetId", "documentPublic", "placeholder", "editorialStatus"];
  if (collection === "questions") return ["title", "text", "image", "imageAlt", "coverAssetId", "editorialStatus"];
  if (collection === "contacts") return ["label", "value", "href", "note", "editorialStatus"];
  return ["value", "editorialStatus"];
}

function normalizedStatus(value: unknown, fallback?: EditorialStatus): EditorialStatus {
  if (value === undefined && fallback) return fallback;
  if (!isEditorialStatus(value)) throw new ValidationError("Status editorial inválido.");
  return value;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new ValidationError(`O campo ${field} deve ser texto.`);
  const normalized = value.trim();
  if (!normalized) throw new ValidationError(`O campo ${field} é obrigatório.`);
  if (normalized.length > maxLength) throw new ValidationError(`O campo ${field} excede o limite permitido.`);
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new ValidationError(`O campo ${field} deve ser texto.`);
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) throw new ValidationError(`O campo ${field} excede o limite permitido.`);
  return normalized;
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new ValidationError(`O campo ${field} deve ser uma lista.`);
  if (value.length > 50) throw new ValidationError(`O campo ${field} contém itens demais.`);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") throw new ValidationError(`O campo ${field} contém um valor inválido.`);
    const normalized = item.trim();
    if (!normalized || normalized.length > 120) throw new ValidationError(`O campo ${field} contém um valor inválido.`);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function assetId(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !ASSET_ID_PATTERN.test(value)) {
    throw new ValidationError(`O campo ${field} contém um identificador de arquivo inválido.`);
  }
  return value.toLowerCase();
}

function assetUrl(id: string): string {
  return `/api/assets?id=${encodeURIComponent(id)}`;
}

function optionalHttpsUrl(value: unknown, field: string): string | undefined {
  const candidate = optionalString(value, field, 2_048);
  if (!candidate) return undefined;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new ValidationError(`O campo ${field} deve conter uma URL válida.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new ValidationError(`O campo ${field} aceita somente URLs HTTPS.`);
  }
  return url.toString();
}

function optionalContactUrl(value: unknown): string | undefined {
  const candidate = optionalString(value, "href", 2_048);
  if (!candidate) return undefined;
  if (/^(mailto:|tel:)/i.test(candidate)) {
    if (/[\r\n]/.test(candidate) || !/^(mailto:[^\s@]+@[^\s@]+|tel:\+?[0-9(). -]{5,30})$/i.test(candidate)) {
      throw new ValidationError("O link de contato é inválido.");
    }
    return candidate;
  }
  return optionalHttpsUrl(candidate, "href");
}

function safeImageSource(value: unknown, fallback: string): string {
  const candidate = optionalString(value, "image", 2_048);
  if (!candidate) return fallback;
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\")) {
    let url: URL;
    try {
      url = new URL(candidate, "https://app.local");
    } catch {
      throw new ValidationError("A URL da imagem é inválida.");
    }
    if (url.origin === "https://app.local") return `${url.pathname}${url.search}`;
  }
  return optionalHttpsUrl(candidate, "image") ?? fallback;
}

function expectedVersionFromRequest(request: Request): number {
  const header = request.headers.get("if-match");
  if (header === null) throw new PreconditionRequiredError();
  const match = header.trim().match(/^(?:W\/)?"([1-9][0-9]*)"$|^([1-9][0-9]*)$/);
  const parsed = match ? Number(match[1] ?? match[2]) : Number.NaN;
  if (!Number.isSafeInteger(parsed)) throw new ValidationError("Cabeçalho If-Match inválido.");
  return parsed;
}

async function readJsonRecord(request: Request): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new ValidationError("O JSON excede o limite permitido.");
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ValidationError("JSON inválido.");
  }
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new ValidationError("O JSON excede o limite permitido.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError("JSON inválido.");
  }
  return asRecord(parsed, "O JSON deve ser um objeto.");
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ValidationError(message);
  return value as Record<string, unknown>;
}

function assertOnlyKeys(input: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(input).find((key) => !allowedSet.has(key));
  if (unexpected) throw new ValidationError(`Campo inesperado: ${unexpected}.`);
}

function assertNotEmpty(input: Record<string, unknown>): void {
  if (Object.keys(input).length === 0) throw new ValidationError("Nenhuma alteração foi informada.");
}

function hasOwn(input: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function contentResponse(
  content: EditorContent,
  record: Pick<EditorContentRecord, "version" | "updatedAt">,
  status = 200,
): Response {
  return jsonResponse(
    { content, version: record.version },
    { status, headers: { ETag: `"${record.version}"`, "Last-Modified": new Date(record.updatedAt).toUTCString() } },
  );
}

function mutationErrorResponse(error: unknown, fallback: string): Response {
  if (error instanceof PreconditionRequiredError) {
    return jsonResponse({ error: error.message }, { status: 428 });
  }
  if (error instanceof ValidationError || error instanceof AssetReferenceError) {
    return jsonResponse({ error: error.message }, { status: 400 });
  }
  if (error instanceof ContentConflictError) {
    return jsonResponse({ error: error.message }, { status: 409 });
  }
  console.error(fallback, error);
  return jsonResponse({ error: fallback }, { status: 503 });
}

function unauthorizedResponse(): Response {
  return jsonResponse({ error: "Apenas o proprietário pode editar este conteúdo." }, { status: 403 });
}

function writeRequestGuard(request: Request, requiresJson: boolean): Response | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin !== null && origin !== new URL(request.url).origin)
    || (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none")) {
    return jsonResponse({ error: "Origem da requisição não autorizada." }, { status: 403 });
  }
  if (requiresJson && !/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return jsonResponse({ error: "Content-Type deve ser application/json." }, { status: 415 });
  }
  return null;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(body, { ...init, headers });
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
}
