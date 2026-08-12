import { and, eq, ne } from "drizzle-orm";
import { getOwnerChatGPTUser, getChatGPTUser, isOwnerUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { contentAssets } from "../../../db/schema";
import { findAssetReference, loadEditorContentRecord } from "../../../lib/content-store";
import { getRuntimeEnv } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

const ASSET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024;
const MAX_MULTIPART_SIZE = MAX_DOCUMENT_SIZE + 128 * 1024;
const MAX_JSON_SIZE = 16 * 1024;

type AssetRow = typeof contentAssets.$inferSelect;

class AssetInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetInputError";
  }
}

export async function GET(request: Request): Promise<Response> {
  let id: string;
  let wantsMetadata: boolean;
  try {
    const params = strictAssetParams(request.url, true);
    id = params.id;
    wantsMetadata = params.metadata;
  } catch (error) {
    return inputErrorResponse(error);
  }

  try {
    const db = getDb();
    const asset = await db.select().from(contentAssets).where(eq(contentAssets.id, id)).get();
    if (!asset) return jsonResponse({ error: "Arquivo não encontrado." }, { status: 404 });

    const user = await getChatGPTUser();
    const isOwner = isOwnerUser(user) && user?.userId === asset.ownerUserId;
    const content = await loadEditorContentRecord();
    const reference = findAssetReference(content.content, asset.id);
    const isEffectivelyPublic = asset.lifecycleState === "linked"
      && asset.isPublic === true
      && reference?.isPublic === true
      && asset.linkedCollection === reference.collection
      && asset.linkedItemId === reference.itemId;
    if (!isOwner && !isEffectivelyPublic) {
      return jsonResponse({ error: "Arquivo privado." }, { status: 403 });
    }

    if (wantsMetadata) {
      return jsonResponse({
        asset: safeAssetMetadata(asset, Boolean(reference), isEffectivelyPublic, isOwner),
      });
    }
    if (asset.lifecycleState === "deleting") {
      return jsonResponse({ error: "O arquivo está sendo removido." }, { status: 409 });
    }

    const bucket = getRuntimeEnv().UPLOADS;
    if (!bucket) return jsonResponse({ error: "Armazenamento indisponível." }, { status: 503 });
    const object = await bucket.get(asset.objectKey);
    if (!object) return jsonResponse({ error: "Arquivo não encontrado." }, { status: 404 });
    if (object.size !== asset.size
      || (asset.checksumSha256 && object.customMetadata?.sha256 !== asset.checksumSha256)) {
      console.error("Asset com metadados divergentes", { id: asset.id });
      return jsonResponse({ error: "A integridade do arquivo não pôde ser confirmada." }, { status: 503 });
    }

    const headers = new Headers({
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.size),
      "Cache-Control": isEffectivelyPublic ? "public, max-age=0, must-revalidate" : "private, no-store",
      "Content-Disposition": contentDisposition(asset.fileName),
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    });
    if (object.httpEtag) headers.set("ETag", object.httpEtag);
    if (asset.kind === "document") headers.set("Content-Security-Policy", "sandbox");
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Falha ao carregar asset", error);
    return jsonResponse({ error: "Não foi possível carregar o arquivo." }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const user = await getOwnerChatGPTUser();
  if (!user) return jsonResponse({ error: "Apenas o proprietário pode enviar arquivos." }, { status: 403 });
  const requestGuard = writeRequestGuard(request, "multipart/form-data");
  if (requestGuard) return requestGuard;

  let form: FormData;
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_SIZE) {
      throw new AssetInputError("O envio excede o limite permitido.");
    }
    form = await request.formData();
    validateFormShape(form);
  } catch (error) {
    return inputErrorResponse(error);
  }

  const file = form.get("file");
  const rawKind = form.get("kind");
  const rawVisibility = form.get("isPublic");
  const rawAltText = form.get("altText");
  if (!(file instanceof File)) return jsonResponse({ error: "Selecione um arquivo." }, { status: 400 });
  if (rawKind !== "image" && rawKind !== "document") {
    return jsonResponse({ error: "Tipo de asset inválido." }, { status: 400 });
  }
  if (rawVisibility !== null && rawVisibility !== "false") {
    return jsonResponse({ error: "Uploads são privados até o conteúdo ser publicado." }, { status: 400 });
  }
  if (rawAltText !== null && typeof rawAltText !== "string") {
    return jsonResponse({ error: "Texto alternativo inválido." }, { status: 400 });
  }

  const kind = rawKind;
  const contentType = file.type.trim().toLowerCase();
  const allowedTypes = kind === "document" ? DOCUMENT_TYPES : IMAGE_TYPES;
  const maxSize = kind === "document" ? MAX_DOCUMENT_SIZE : MAX_IMAGE_SIZE;
  let fileName: string;
  let bytes: ArrayBuffer;
  try {
    fileName = validatedFileName(file.name, contentType);
    if (!allowedTypes.has(contentType)) throw new AssetInputError("Tipo de arquivo não permitido.");
    if (file.size < 1 || file.size > maxSize) throw new AssetInputError("O arquivo excede o limite permitido.");
    bytes = await file.arrayBuffer();
    if (bytes.byteLength !== file.size || sniffContentType(new Uint8Array(bytes)) !== contentType) {
      throw new AssetInputError("O conteúdo do arquivo não corresponde ao tipo declarado.");
    }
  } catch (error) {
    return inputErrorResponse(error);
  }

  const bucket = getRuntimeEnv().UPLOADS;
  if (!bucket) return jsonResponse({ error: "Armazenamento indisponível." }, { status: 503 });
  const id = crypto.randomUUID();
  const objectKey = `assets/${id}${extensionFor(contentType)}`;
  const checksumSha256 = await sha256Hex(bytes);
  const altText = typeof rawAltText === "string" ? rawAltText.trim() : "";
  if (altText.length > 500) return jsonResponse({ error: "O texto alternativo excede o limite permitido." }, { status: 400 });

  const db = getDb();
  let metadataInserted = false;
  try {
    const createdAt = new Date().toISOString();
    await db.insert(contentAssets).values({
      id,
      ownerUserId: user.userId,
      objectKey,
      kind,
      fileName,
      contentType,
      size: file.size,
      checksumSha256,
      altText,
      isPublic: false,
      lifecycleState: "pending",
      createdAt,
      updatedAt: createdAt,
    });
    metadataInserted = true;
    await bucket.put(objectKey, bytes, {
      httpMetadata: { contentType, cacheControl: "private, no-store" },
      customMetadata: { assetId: id, kind, sha256: checksumSha256 },
    });
    const asset = await db.select().from(contentAssets).where(eq(contentAssets.id, id)).get();
    if (!asset) throw new Error("Metadados do asset não encontrados após o upload.");
    return jsonResponse({ asset: safeAssetMetadata(asset, false, false, true) }, { status: 201 });
  } catch (error) {
    if (metadataInserted) {
      await db.delete(contentAssets).where(eq(contentAssets.id, id)).catch(() => undefined);
    }
    await bucket.delete(objectKey).catch(() => undefined);
    console.error("Falha ao salvar asset", error);
    return jsonResponse({ error: "Não foi possível salvar o arquivo." }, { status: 503 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await getOwnerChatGPTUser();
  if (!user) return jsonResponse({ error: "Apenas o proprietário pode alterar arquivos." }, { status: 403 });
  const requestGuard = writeRequestGuard(request, "application/json");
  if (requestGuard) return requestGuard;

  let id: string;
  let input: Record<string, unknown>;
  try {
    id = strictAssetParams(request.url, false).id;
    input = await readJsonRecord(request);
    const keys = Object.keys(input);
    if (keys.length !== 1 || keys[0] !== "altText" || typeof input.altText !== "string") {
      throw new AssetInputError("Somente o texto alternativo pode ser alterado diretamente.");
    }
    if (input.altText.trim().length > 500) throw new AssetInputError("O texto alternativo excede o limite permitido.");
  } catch (error) {
    return inputErrorResponse(error);
  }

  try {
    const db = getDb();
    const asset = await db.select().from(contentAssets).where(eq(contentAssets.id, id)).get();
    if (!asset || asset.ownerUserId !== user.userId) {
      return jsonResponse({ error: "Arquivo não encontrado." }, { status: 404 });
    }
    if (asset.lifecycleState === "deleting") {
      return jsonResponse({ error: "O arquivo está sendo removido." }, { status: 409 });
    }
    const altText = (input.altText as string).trim();
    const updatedAt = new Date().toISOString();
    const updated = await db.update(contentAssets)
      .set({ altText, updatedAt })
      .where(and(eq(contentAssets.id, id), eq(contentAssets.ownerUserId, user.userId)))
      .returning()
      .get();
    if (!updated) return jsonResponse({ error: "Arquivo não encontrado." }, { status: 404 });
    const content = await loadEditorContentRecord();
    const reference = findAssetReference(content.content, id);
    const effectivePublic = updated.isPublic === true && updated.lifecycleState === "linked" && reference?.isPublic === true;
    return jsonResponse({ asset: safeAssetMetadata(updated, Boolean(reference), effectivePublic, true) });
  } catch (error) {
    console.error("Falha ao atualizar asset", error);
    return jsonResponse({ error: "Não foi possível atualizar o arquivo." }, { status: 503 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const user = await getOwnerChatGPTUser();
  if (!user) return jsonResponse({ error: "Apenas o proprietário pode remover arquivos." }, { status: 403 });
  const requestGuard = writeRequestGuard(request);
  if (requestGuard) return requestGuard;

  let id: string;
  try {
    id = strictAssetParams(request.url, false).id;
  } catch (error) {
    return inputErrorResponse(error);
  }

  try {
    const db = getDb();
    const asset = await db.select().from(contentAssets).where(eq(contentAssets.id, id)).get();
    if (!asset || asset.ownerUserId !== user.userId) {
      return jsonResponse({ error: "Arquivo não encontrado." }, { status: 404 });
    }
    const content = await loadEditorContentRecord();
    if (findAssetReference(content.content, id) || asset.lifecycleState === "linked") {
      return jsonResponse({ error: "Remova o vínculo editorial antes de excluir o arquivo." }, { status: 409 });
    }

    const deletingAt = new Date().toISOString();
    const deleting = await db.update(contentAssets)
      .set({ lifecycleState: "deleting", isPublic: false, updatedAt: deletingAt })
      .where(and(
        eq(contentAssets.id, id),
        eq(contentAssets.ownerUserId, user.userId),
        ne(contentAssets.lifecycleState, "linked"),
      ))
      .returning()
      .get();
    if (!deleting) {
      return jsonResponse({ error: "O arquivo passou a ser referenciado; tente novamente." }, { status: 409 });
    }

    const bucket = getRuntimeEnv().UPLOADS;
    if (!bucket) return jsonResponse({ error: "Armazenamento indisponível." }, { status: 503 });
    await bucket.delete(deleting.objectKey);
    await db.delete(contentAssets).where(and(
      eq(contentAssets.id, id),
      eq(contentAssets.ownerUserId, user.userId),
      eq(contentAssets.lifecycleState, "deleting"),
    ));
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Falha ao remover asset", error);
    return jsonResponse({
      error: "Não foi possível concluir a remoção. O arquivo foi mantido privado e a operação pode ser repetida.",
    }, { status: 503 });
  }
}

function strictAssetParams(urlValue: string, allowMetadata: boolean): { id: string; metadata: boolean } {
  const params = new URL(urlValue).searchParams;
  const allowed = allowMetadata ? new Set(["id", "metadata"]) : new Set(["id"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) throw new AssetInputError("Parâmetros inválidos.");
  }
  const id = params.get("id");
  if (!id || !ASSET_ID_PATTERN.test(id)) throw new AssetInputError("Arquivo inválido.");
  const rawMetadata = params.get("metadata");
  if (rawMetadata !== null && rawMetadata !== "1") throw new AssetInputError("Parâmetro metadata inválido.");
  return { id: id.toLowerCase(), metadata: rawMetadata === "1" };
}

function validateFormShape(form: FormData): void {
  const allowed = new Set(["file", "kind", "isPublic", "altText"]);
  for (const key of form.keys()) {
    if (!allowed.has(key) || form.getAll(key).length !== 1) throw new AssetInputError("Formulário de upload inválido.");
  }
}

function validatedFileName(value: string, contentType: string): string {
  const name = value.trim().normalize("NFC");
  const containsUnsafeCharacter = [...name].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || character === "/" || character === "\\";
  });
  if (!name || name.length > 160 || containsUnsafeCharacter || name === "." || name === "..") {
    throw new AssetInputError("Nome de arquivo inválido.");
  }
  const extension = name.includes(".") ? `.${name.split(".").pop()!.toLowerCase()}` : "";
  const allowed = extensionsFor(contentType);
  if (!allowed.includes(extension)) throw new AssetInputError("A extensão não corresponde ao tipo do arquivo.");
  return name;
}

function extensionsFor(contentType: string): string[] {
  if (contentType === "image/jpeg") return [".jpg", ".jpeg"];
  if (contentType === "image/png") return [".png"];
  if (contentType === "image/webp") return [".webp"];
  if (contentType === "image/gif") return [".gif"];
  if (contentType === "application/pdf") return [".pdf"];
  return [];
}

function extensionFor(contentType: string): string {
  return contentType === "image/jpeg" ? ".jpg" : extensionsFor(contentType)[0] ?? "";
}

function sniffContentType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
    || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "image/gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes.length >= 12
    && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function readJsonRecord(request: Request): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_SIZE) throw new AssetInputError("JSON muito grande.");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_SIZE) throw new AssetInputError("JSON muito grande.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AssetInputError("JSON inválido.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AssetInputError("Alterações inválidas.");
  }
  return parsed as Record<string, unknown>;
}

function safeAssetMetadata(asset: AssetRow, referenced: boolean, isPublic: boolean, isOwner: boolean) {
  return {
    id: asset.id,
    kind: asset.kind,
    fileName: asset.fileName,
    contentType: asset.contentType,
    size: asset.size,
    altText: asset.altText,
    isPublic,
    createdAt: asset.createdAt,
    referenced,
    ...(isOwner ? { lifecycleState: asset.lifecycleState } : {}),
  };
}

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 120) || "arquivo";
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function inputErrorResponse(error: unknown): Response {
  const message = error instanceof AssetInputError ? error.message : "Requisição de arquivo inválida.";
  return jsonResponse({ error: message }, { status: 400 });
}

function writeRequestGuard(request: Request, contentType?: string): Response | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin !== null && origin !== new URL(request.url).origin)
    || (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none")) {
    return jsonResponse({ error: "Origem da requisição não autorizada." }, { status: 403 });
  }
  if (contentType && !new RegExp(`^${contentType.replace("/", "\\/")}(?:\\s*;|$)`, "i")
    .test(request.headers.get("content-type") ?? "")) {
    return jsonResponse({ error: `Content-Type deve ser ${contentType}.` }, { status: 415 });
  }
  return null;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(body, { ...init, headers });
}
