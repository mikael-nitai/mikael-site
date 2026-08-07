import { getOwnerChatGPTUser } from "../../chatgpt-auth";
import {
  isEditableCollection,
  isEditorialStatus,
  publicEditorContent,
  sortEditorContent,
  type EditableCollection,
  type EditorContent,
  type EditorialStatus,
} from "../../../content/editorial";
import { loadEditorContent, saveEditorContent } from "../../../lib/content-store";
import {
  deriveReadingTime,
  deriveSummary,
  sanitizeRichText,
} from "../../../lib/sanitize";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const wantsEditor = new URL(request.url).searchParams.get("editor") === "1";
  if (wantsEditor && !(await getOwnerChatGPTUser())) {
    return Response.json({ error: "Não autorizado." }, { status: 403 });
  }

  try {
    const content = await loadEditorContent();
    return Response.json({ content: wantsEditor ? content : publicEditorContent(content) });
  } catch (error) {
    console.error("Falha ao carregar conteúdo editorial", error);
    return Response.json({ error: "O conteúdo ainda não está disponível." }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await getOwnerChatGPTUser())) return unauthorizedResponse();

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!isRecord(input) || typeof input.collection !== "string" || !isEditableCollection(input.collection)) {
    return Response.json({ error: "Coleção inválida." }, { status: 400 });
  }

  try {
    const content = await loadEditorContent();
    const item = normalizeNewItem(input.collection, input.item, content);
    if ("error" in item) return Response.json({ error: item.error }, { status: 400 });

    const next = {
      ...content,
      [input.collection]: [
        ...content[input.collection],
        item.value,
      ],
    } as EditorContent;
    await saveEditorContent(next);
    return Response.json({ content: next }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar conteúdo editorial", error);
    return Response.json({ error: "Não foi possível salvar o item." }, { status: 503 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  if (!(await getOwnerChatGPTUser())) return unauthorizedResponse();
  const params = new URL(request.url).searchParams;
  const collection = params.get("collection");
  const id = params.get("id");
  if (collection === "identity" && id === "primary") {
    let identityInput: unknown;
    try {
      identityInput = await request.json();
    } catch {
      return Response.json({ error: "JSON inválido." }, { status: 400 });
    }
    if (!isRecord(identityInput)) return Response.json({ error: "Alterações inválidas." }, { status: 400 });
    try {
      const content = await loadEditorContent();
      const identity = {
        ...content.identity,
        ...(typeof identityInput.name === "string" ? { name: identityInput.name.trim() } : {}),
        ...(typeof identityInput.role === "string" ? { role: identityInput.role.trim() } : {}),
        ...(typeof identityInput.location === "string" ? { location: identityInput.location.trim() } : {}),
        ...(typeof identityInput.description === "string" ? { description: identityInput.description.trim() } : {}),
      };
      if (!identity.description) return Response.json({ error: "A descrição não pode ficar vazia." }, { status: 400 });
      const next = { ...content, identity };
      await saveEditorContent(next);
      return Response.json({ content: next });
    } catch (error) {
      console.error("Falha ao atualizar identidade editorial", error);
      return Response.json({ error: "Não foi possível salvar a identidade." }, { status: 503 });
    }
  }
  if (!isEditableCollection(collection) || !id) {
    return Response.json({ error: "Item inválido." }, { status: 400 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!isRecord(input)) return Response.json({ error: "Alterações inválidas." }, { status: 400 });

  try {
    const content = await loadEditorContent();
    const entries = content[collection];
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) return Response.json({ error: "Item não encontrado." }, { status: 404 });

    const current = entries[index];
    const nextItem = normalizeExistingItem(collection, current, input);
    if ("error" in nextItem) return Response.json({ error: nextItem.error }, { status: 400 });
    const nextEntries = entries.map((entry, entryIndex) => (entryIndex === index ? nextItem.value : entry));
    const next = { ...content, [collection]: nextEntries } as EditorContent;
    await saveEditorContent(next);
    return Response.json({ content: next });
  } catch (error) {
    console.error("Falha ao atualizar conteúdo editorial", error);
    return Response.json({ error: "Não foi possível salvar as alterações." }, { status: 503 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  if (!(await getOwnerChatGPTUser())) return unauthorizedResponse();
  const params = new URL(request.url).searchParams;
  const collection = params.get("collection");
  const id = params.get("id");
  if (!isEditableCollection(collection) || !id) {
    return Response.json({ error: "Item inválido." }, { status: 400 });
  }

  try {
    const content = await loadEditorContent();
    const entries = content[collection];
    if (!entries.some((entry) => entry.id === id)) {
      return Response.json({ error: "Item não encontrado." }, { status: 404 });
    }
    const next = {
      ...content,
      [collection]: entries.filter((entry) => entry.id !== id),
    } as EditorContent;
    await saveEditorContent(next);
    return Response.json({ content: next });
  } catch (error) {
    console.error("Falha ao remover conteúdo editorial", error);
    return Response.json({ error: "Não foi possível remover o item." }, { status: 503 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!(await getOwnerChatGPTUser())) return unauthorizedResponse();
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!isRecord(input) || typeof input.collection !== "string" || !isEditableCollection(input.collection) || !Array.isArray(input.orderedIds)) {
    return Response.json({ error: "Ordem inválida." }, { status: 400 });
  }

  try {
    const content = await loadEditorContent();
    const ids = input.orderedIds.filter((value): value is string => typeof value === "string");
    const orderById = new Map(ids.map((id, index) => [id, index]));
    const next = {
      ...content,
      [input.collection]: content[input.collection].map((entry, index) => ({
        ...entry,
        order: orderById.get(entry.id) ?? index,
      })),
    } as EditorContent;
    await saveEditorContent(next);
    return Response.json({ content: sortEditorContent(next) });
  } catch (error) {
    console.error("Falha ao reordenar conteúdo editorial", error);
    return Response.json({ error: "Não foi possível reordenar os itens." }, { status: 503 });
  }
}

function unauthorizedResponse(): Response {
  return Response.json({ error: "Apenas o proprietário pode editar este conteúdo." }, { status: 403 });
}

function normalizeNewItem(
  collection: EditableCollection,
  rawItem: unknown,
  content: EditorContent,
): { value: EditorContent[EditableCollection][number] } | { error: string } {
  if (!isRecord(rawItem)) return { error: "Preencha os dados do item." };
  const base = {
    id: `${collection}-${crypto.randomUUID()}`,
    editorialStatus: normalizeStatus(rawItem.editorialStatus) ?? "draft",
    order: content[collection].length,
  };

  if (collection === "timeline") {
    if (!requiredText(rawItem.title)) return { error: "O título do marco é obrigatório." };
    return {
      value: {
        ...base,
        period: text(rawItem.period) || "Agora",
        title: text(rawItem.title),
        institution: text(rawItem.institution) || undefined,
        description: text(rawItem.description),
        category: text(rawItem.category) || "Trajetória",
      },
    };
  }
  if (collection === "projects") {
    if (!requiredText(rawItem.title) || !requiredText(rawItem.description)) {
      return { error: "Título e descrição curta são obrigatórios." };
    }
    return {
      value: {
        ...base,
        title: text(rawItem.title),
        description: text(rawItem.description),
        status: text(rawItem.status) || "Em andamento",
        period: text(rawItem.period) || "Em construção",
        image: text(rawItem.image) || "https://picsum.photos/seed/mikael-project/1200/900",
        imageAlt: text(rawItem.imageAlt) || text(rawItem.title),
        technologies: list(rawItem.technologies),
        body: sanitizeRichText(text(rawItem.body)),
        github: optionalUrl(rawItem.github),
        demo: optionalUrl(rawItem.demo),
        coverAssetId: text(rawItem.coverAssetId) || undefined,
      },
    };
  }
  if (collection === "notes") {
    if (!requiredText(rawItem.title) || !requiredText(rawItem.body)) {
      return { error: "Título e texto são obrigatórios." };
    }
    const body = sanitizeRichText(text(rawItem.body));
    return {
      value: {
        ...base,
        title: text(rawItem.title),
        body,
        summary: deriveSummary(body),
        date: text(rawItem.date) || todayLabel(),
        area: text(rawItem.area) || "Caderno",
        readingTime: deriveReadingTime(body),
        tags: list(rawItem.tags),
        coverAssetId: text(rawItem.coverAssetId) || undefined,
      },
    };
  }
  if (collection === "learning") {
    if (!requiredText(rawItem.title) || !requiredText(rawItem.institution) || !requiredText(rawItem.year)) {
      return { error: "Nome, instituição e ano são obrigatórios." };
    }
    return {
      value: {
        ...base,
        title: text(rawItem.title),
        institution: text(rawItem.institution),
        year: text(rawItem.year),
        category: text(rawItem.category) || "Formação",
        hours: text(rawItem.hours) || undefined,
        description: text(rawItem.description) || undefined,
        coverAssetId: text(rawItem.coverAssetId) || undefined,
        documentAssetId: text(rawItem.documentAssetId) || undefined,
        documentPublic: rawItem.documentPublic === true,
      },
    };
  }
  if (!requiredText(rawItem.value)) return { error: "O interesse é obrigatório." };
  return { value: { ...base, value: text(rawItem.value) } };
}

function normalizeExistingItem(
  collection: EditableCollection,
  current: EditorContent[EditableCollection][number],
  changes: Record<string, unknown>,
): { value: EditorContent[EditableCollection][number] } | { error: string } {
  const merged = { ...current, ...changes } as Record<string, unknown>;
  const status = normalizeStatus(merged.editorialStatus);
  if (merged.editorialStatus !== undefined && !status) return { error: "Status inválido." };
  if (status) merged.editorialStatus = status;
  merged.order = typeof merged.order === "number" ? merged.order : current.order;

  if (collection === "notes") {
    if (!requiredText(merged.title) || !requiredText(merged.body)) return { error: "Título e texto são obrigatórios." };
    merged.body = sanitizeRichText(text(merged.body));
    merged.summary = deriveSummary(text(merged.body));
    merged.readingTime = deriveReadingTime(text(merged.body));
    merged.tags = list(merged.tags);
  }
  if (collection === "projects") {
    if (!requiredText(merged.title) || !requiredText(merged.description)) return { error: "Título e descrição curta são obrigatórios." };
    merged.technologies = list(merged.technologies);
    merged.github = optionalUrl(merged.github);
    merged.demo = optionalUrl(merged.demo);
  }
  if (collection === "timeline" && !requiredText(merged.title)) return { error: "O título do marco é obrigatório." };
  if (collection === "learning" && (!requiredText(merged.title) || !requiredText(merged.institution) || !requiredText(merged.year))) {
    return { error: "Nome, instituição e ano são obrigatórios." };
  }
  if (collection === "interests" && !requiredText(merged.value)) return { error: "O interesse é obrigatório." };
  return { value: merged as EditorContent[EditableCollection][number] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requiredText(value: unknown): boolean {
  return text(value).length > 0;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeStatus(value: unknown): EditorialStatus | null {
  return isEditorialStatus(value) ? value : null;
}

function optionalUrl(value: unknown): string | undefined {
  const candidate = text(value);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
}
