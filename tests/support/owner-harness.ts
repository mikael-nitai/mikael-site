import { Buffer } from "node:buffer";
import { expect, type Page, type Request as PlaywrightRequest, type Route } from "@playwright/test";
import {
  publicEditorContent,
  seedEditorContent,
  type EditableCollection,
  type EditorContent,
} from "../../content/editorial";

type TestItem = Record<string, unknown> & { id: string; editorialStatus: "draft" | "published" | "hidden"; order: number };

export type TestAsset = {
  id: string;
  kind: "image" | "document";
  fileName: string;
  contentType: string;
  size: number;
  altText: string;
  isPublic: boolean;
  referenced: boolean;
  lifecycleState: "pending" | "linked" | "orphaned";
};

export type RecordedRequest = {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
};

export type OwnerHarness = {
  content: () => EditorContent;
  version: () => number;
  assets: Map<string, TestAsset>;
  requests: RecordedRequest[];
  deletedAssetIds: string[];
  rejectNextUpload: (status: number, error: string) => void;
  rejectAssetDeletes: (id: string, attempts: number, status?: number, error?: string) => void;
  reloadEditor: () => Promise<void>;
};

type UploadFailure = { status: number; error: string };
type DeleteFailure = { remaining: number; status: number; error: string };

function json(route: Route, status: number, value: unknown) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
}

function bodyOf(request: PlaywrightRequest): Record<string, unknown> | null {
  if (!request.postData()) return null;
  try {
    return request.postDataJSON() as Record<string, unknown>;
  } catch {
    return null;
  }
}

function multipartField(raw: string, name: string): string | undefined {
  const match = raw.match(new RegExp(`name="${name}"\\r?\\n\\r?\\n([^\\r\\n]*)`));
  return match?.[1];
}

function reconcileAssets(content: EditorContent, assets: Map<string, TestAsset>) {
  for (const asset of assets.values()) {
    asset.isPublic = false;
    asset.referenced = false;
    if (asset.lifecycleState === "linked") asset.lifecycleState = "orphaned";
  }
  const link = (id: string | undefined, isPublic: boolean) => {
    if (!id) return;
    const asset = assets.get(id);
    if (!asset) return;
    asset.referenced = true;
    asset.isPublic = isPublic;
    asset.lifecycleState = "linked";
  };
  for (const item of content.projects) link(item.coverAssetId, item.editorialStatus === "published");
  for (const item of content.notes) link(item.coverAssetId, item.editorialStatus === "published");
  for (const item of content.questions) link(item.coverAssetId, item.editorialStatus === "published");
  for (const item of content.learning) {
    link(item.coverAssetId, item.editorialStatus === "published");
    link(item.documentAssetId, item.editorialStatus === "published" && item.documentPublic === true);
  }
}

export async function startOwnerHarness(page: Page, pathname = "/"): Promise<OwnerHarness> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let content = structuredClone(seedEditorContent());
  let version = 1;
  let nextId = 1;
  let uploadFailure: UploadFailure | null = null;
  const deleteFailures = new Map<string, DeleteFailure>();
  const assets = new Map<string, TestAsset>();
  const requests: RecordedRequest[] = [];
  const deletedAssetIds: string[] = [];

  await page.route("**/api/session", (route) => json(route, 200, {
    authenticated: true,
    canEdit: true,
    displayName: "Proprietário de teste",
  }));

  await page.route("**/api/assets**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const id = url.searchParams.get("id");
    requests.push({ method: request.method(), path: `${url.pathname}${url.search}`, body: null });

    if (request.method() === "POST") {
      if (uploadFailure) {
        const failure = uploadFailure;
        uploadFailure = null;
        await json(route, failure.status, { error: failure.error });
        return;
      }
      const postData = request.postDataBuffer();
      const raw = postData ? Buffer.from(postData as Uint8Array).toString("latin1") : "";
      const fileName = raw.match(/filename="([^"]+)"/)?.[1] ?? "arquivo.bin";
      const contentType = raw.match(/filename="[^"]+"\r?\nContent-Type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? "application/octet-stream";
      const kind = multipartField(raw, "kind") === "document" ? "document" : "image";
      const altText = multipartField(raw, "altText") ?? "";
      const assetId = `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`;
      nextId += 1;
      const asset: TestAsset = {
        id: assetId,
        kind,
        fileName,
        contentType,
        size: request.postDataBuffer()?.byteLength ?? 0,
        altText,
        isPublic: false,
        referenced: false,
        lifecycleState: "pending",
      };
      assets.set(assetId, asset);
      await json(route, 201, { asset });
      return;
    }

    const asset = id ? assets.get(id) : undefined;
    if (!asset) {
      await json(route, 404, { error: "Arquivo não encontrado." });
      return;
    }
    if (request.method() === "GET") {
      const visitor = request.headers()["x-test-visitor"] === "1";
      if (visitor && !asset.isPublic) {
        await json(route, 403, { error: "Arquivo privado." });
        return;
      }
      if (url.searchParams.get("metadata") === "1") {
        await json(route, 200, { asset });
      } else {
        await route.fulfill({
          status: 200,
          body: asset.kind === "document" ? "%PDF-1.4\n% test-only" : "test-image",
          headers: {
            "Content-Type": asset.contentType,
            "Cache-Control": asset.isPublic ? "public, max-age=0, must-revalidate" : "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      return;
    }
    if (request.method() === "DELETE") {
      const failure = deleteFailures.get(asset.id);
      if (failure && failure.remaining > 0) {
        failure.remaining -= 1;
        await json(route, failure.status, { error: failure.error });
        return;
      }
      if (asset.referenced) {
        await json(route, 409, { error: "Remova o vínculo editorial antes de excluir o arquivo." });
        return;
      }
      assets.delete(asset.id);
      deletedAssetIds.push(asset.id);
      await json(route, 200, { ok: true });
      return;
    }
    await json(route, 400, { error: "Operação de asset não simulada." });
  });

  await page.route("**/api/content**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = bodyOf(request);
    requests.push({ method: request.method(), path: `${url.pathname}${url.search}`, body });
    if (request.method() === "GET") {
      const visibleContent = url.searchParams.get("editor") === "1" ? content : publicEditorContent(content);
      await json(route, 200, { content: visibleContent, version });
      return;
    }
    if (request.headers()["if-match"] !== `"${version}"`) {
      await json(route, 409, { error: "Conflito de versão simulado." });
      return;
    }

    const collection = url.searchParams.get("collection");
    const id = url.searchParams.get("id");
    if (request.method() === "POST" && body) {
      const nextCollection = body.collection as EditableCollection | undefined;
      const rawItem = body.item;
      if (nextCollection && Array.isArray(content[nextCollection]) && rawItem && typeof rawItem === "object") {
        const entries = content[nextCollection] as TestItem[];
        const item = {
          ...(rawItem as Record<string, unknown>),
          id: `test-created-${nextCollection}-${entries.length + 1}`,
          order: entries.length,
        } as TestItem;
        content = { ...content, [nextCollection]: [...entries, item] } as EditorContent;
        version += 1;
        reconcileAssets(content, assets);
        await json(route, 201, { content, version });
        return;
      }
    }
    if (request.method() === "PATCH" && collection && id && body) {
      if (["home", "about", "contact", "identity"].includes(collection)) {
        content = {
          ...content,
          [collection]: { ...(content[collection as keyof EditorContent] as Record<string, unknown>), ...body },
        } as EditorContent;
      } else if (Array.isArray(content[collection as EditableCollection])) {
        const entries = content[collection as EditableCollection] as TestItem[];
        content = {
          ...content,
          [collection]: entries.map((entry) => entry.id === id ? { ...entry, ...body } : entry),
        } as EditorContent;
      }
      version += 1;
      reconcileAssets(content, assets);
      await json(route, 200, { content, version });
      return;
    }
    if (request.method() === "DELETE" && collection && id && Array.isArray(content[collection as EditableCollection])) {
      const entries = content[collection as EditableCollection] as TestItem[];
      content = { ...content, [collection]: entries.filter((entry) => entry.id !== id) } as EditorContent;
      version += 1;
      reconcileAssets(content, assets);
      await json(route, 200, { content, version });
      return;
    }
    if (request.method() === "PUT" && body && typeof body.collection === "string" && Array.isArray(body.orderedIds)) {
      const target = body.collection as EditableCollection;
      const entries = content[target] as TestItem[];
      const byId = new Map(entries.map((entry) => [entry.id, entry]));
      content = {
        ...content,
        [target]: (body.orderedIds as string[]).map((entryId, order) => ({ ...byId.get(entryId)!, order })),
      } as EditorContent;
      version += 1;
      await json(route, 200, { content, version });
      return;
    }
    await json(route, 400, { error: "Operação de teste não simulada." });
  });

  const editorUrl = `${pathname}?edit=1`;
  const initialContent = page.waitForResponse((response) => response.url().includes("/api/content?editor=1") && response.request().method() === "GET");
  await page.goto(editorUrl, { waitUntil: "networkidle" });
  await initialContent;
  await expect(page.getByText("Modo de edição", { exact: true })).toBeVisible();

  return {
    content: () => structuredClone(content),
    version: () => version,
    assets,
    requests,
    deletedAssetIds,
    rejectNextUpload: (status, error) => { uploadFailure = { status, error }; },
    rejectAssetDeletes: (id, attempts, status = 503, error = "Falha transitória simulada na limpeza.") => {
      deleteFailures.set(id, { remaining: attempts, status, error });
    },
    reloadEditor: async () => {
      const contentLoaded = page.waitForResponse((response) => response.url().includes("/api/content?editor=1") && response.request().method() === "GET");
      await page.goto(editorUrl, { waitUntil: "networkidle" });
      await contentLoaded;
      await expect(page.getByText("Modo de edição", { exact: true })).toBeVisible();
    },
  };
}
