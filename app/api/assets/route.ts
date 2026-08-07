import { eq } from "drizzle-orm";
import { getOwnerChatGPTUser, getChatGPTUser, isOwnerUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { contentAssets } from "../../../db/schema";
import { getRuntimeEnv } from "../../../lib/runtime";

export const dynamic = "force-dynamic";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Arquivo inválido." }, { status: 400 });

  try {
    const db = getDb();
    const asset = await db.select().from(contentAssets).where(eq(contentAssets.id, id)).get();
    if (!asset) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });

    const user = await getChatGPTUser();
    if (!asset.isPublic && !isOwnerUser(user)) return Response.json({ error: "Arquivo privado." }, { status: 403 });
    const bucket = getRuntimeEnv().UPLOADS;
    if (!bucket) return Response.json({ error: "Armazenamento indisponível." }, { status: 503 });
    const object = await bucket.get(asset.objectKey);
    if (!object) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });

    return new Response(object.body, {
      headers: {
        "Content-Type": asset.contentType,
        "Content-Length": String(asset.size),
        "Cache-Control": asset.isPublic ? "public, max-age=3600" : "private, no-store",
        "Content-Disposition": `inline; filename="${safeFileName(asset.fileName)}"`,
      },
    });
  } catch (error) {
    console.error("Falha ao carregar asset", error);
    return Response.json({ error: "Não foi possível carregar o arquivo." }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const user = await getOwnerChatGPTUser();
  if (!user) return Response.json({ error: "Apenas o proprietário pode enviar arquivos." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "document" ? "document" : "image";
  const isPublic = form.get("isPublic") === "true";
  const altText = typeof form.get("altText") === "string" ? String(form.get("altText")).slice(0, 240) : "";
  if (!(file instanceof File)) return Response.json({ error: "Selecione um arquivo." }, { status: 400 });

  const allowedTypes = kind === "document" ? DOCUMENT_TYPES : IMAGE_TYPES;
  const maxSize = kind === "document" ? 15 * 1024 * 1024 : 8 * 1024 * 1024;
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Tipo de arquivo não permitido." }, { status: 400 });
  if (file.size > maxSize) return Response.json({ error: "O arquivo excede o limite permitido." }, { status: 400 });

  const bucket = getRuntimeEnv().UPLOADS;
  if (!bucket) return Response.json({ error: "Armazenamento indisponível." }, { status: 503 });

  const id = crypto.randomUUID();
  const objectKey = `assets/${user.userId}/${id}${extensionFor(file.type)}`;
  try {
    await bucket.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type, cacheControl: isPublic ? "public, max-age=3600" : "private, no-store" },
      customMetadata: { ownerUserId: user.userId, kind },
    });
    const db = getDb();
    const asset = {
      id,
      ownerUserId: user.userId,
      objectKey,
      kind,
      fileName: file.name || `arquivo${extensionFor(file.type)}`,
      contentType: file.type,
      size: file.size,
      altText,
      isPublic,
    } as const;
    await db.insert(contentAssets).values(asset);
    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    await bucket.delete(objectKey).catch(() => undefined);
    console.error("Falha ao salvar asset", error);
    return Response.json({ error: "Não foi possível salvar o arquivo." }, { status: 503 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const user = await getOwnerChatGPTUser();
  if (!user) return Response.json({ error: "Apenas o proprietário pode remover arquivos." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Arquivo inválido." }, { status: 400 });

  try {
    const db = getDb();
    const asset = await db.select().from(contentAssets).where(eq(contentAssets.id, id)).get();
    if (!asset || asset.ownerUserId !== user.userId) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    await getRuntimeEnv().UPLOADS?.delete(asset.objectKey);
    await db.delete(contentAssets).where(eq(contentAssets.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Falha ao remover asset", error);
    return Response.json({ error: "Não foi possível remover o arquivo." }, { status: 503 });
  }
}

function extensionFor(contentType: string): string {
  return contentType === "image/jpeg" ? ".jpg" : contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : contentType === "image/gif" ? ".gif" : ".pdf";
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 120) || "arquivo";
}
