import { beforeEach, describe, expect, it, vi } from "vitest";

type AssetRow = {
  id: string;
  ownerUserId: string;
  objectKey: string;
  kind: "image" | "document";
  fileName: string;
  contentType: string;
  size: number;
  checksumSha256: string;
  altText: string;
  isPublic: boolean;
  lifecycleState: "pending" | "linked" | "orphaned" | "deleting";
  linkedCollection: string | null;
  linkedItemId: string | null;
  createdAt: string;
  updatedAt: string;
};

const state = vi.hoisted(() => ({
  owner: { userId: "owner-test-id", email: "owner@example.test", name: "Owner" } as Record<string, string> | null,
  viewer: null as Record<string, string> | null,
  row: null as AssetRow | null,
  reference: undefined as { collection: string; itemId: string; isPublic: boolean } | undefined,
  failPut: false,
  puts: [] as Array<{ key: string; options: unknown }>,
  bucketDeletes: [] as string[],
  metadataDeletes: 0,
}));

vi.mock("../app/chatgpt-auth", () => ({
  getOwnerChatGPTUser: async () => state.owner,
  getChatGPTUser: async () => state.viewer,
  isOwnerUser: (user: { userId?: string } | null) => user?.userId === "owner-test-id",
}));

vi.mock("../lib/content-store", () => ({
  loadEditorContentRecord: async () => ({ content: {}, version: 1, updatedAt: new Date(0).toISOString() }),
  findAssetReference: () => state.reference,
}));

vi.mock("../lib/runtime", () => ({
  getRuntimeEnv: () => ({
    UPLOADS: {
      put: async (key: string, _bytes: ArrayBuffer, options: unknown) => {
        state.puts.push({ key, options });
        if (state.failPut) throw new Error("R2 failure");
      },
      delete: async (key: string) => { state.bucketDeletes.push(key); },
      get: async () => state.row ? {
        body: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
        size: state.row.size,
        httpEtag: '"test-etag"',
        customMetadata: { sha256: state.row.checksumSha256 },
      } : null,
    },
  }),
}));

vi.mock("../db", () => ({
  getDb: () => ({
    insert: () => ({
      values: async (value: AssetRow) => { state.row = { ...value, linkedCollection: null, linkedItemId: null }; },
    }),
    select: () => ({
      from: () => ({ where: () => ({ get: async () => state.row }) }),
    }),
    delete: () => ({
      where: () => {
        state.metadataDeletes += 1;
        state.row = null;
        return Promise.resolve();
      },
    }),
  }),
}));

import { GET, POST } from "../app/api/assets/route";

function uploadRequest(file: File, kind: "image" | "document", isPublic?: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  form.set("altText", "Arquivo temporário de teste");
  if (isPublic !== undefined) form.set("isPublic", isPublic);
  return new Request("https://app.test/api/assets", { method: "POST", body: form });
}

function pdfFile(name = "certificado.pdf", bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])) {
  return new File([bytes], name, { type: "application/pdf" });
}

function seedRow(overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    ownerUserId: "owner-test-id",
    objectKey: "assets/test.pdf",
    kind: "document",
    fileName: "test.pdf",
    contentType: "application/pdf",
    size: 5,
    checksumSha256: "checksum",
    altText: "Documento de teste",
    isPublic: false,
    lifecycleState: "pending",
    linkedCollection: null,
    linkedItemId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  state.owner = { userId: "owner-test-id", email: "owner@example.test", name: "Owner" };
  state.viewer = null;
  state.row = null;
  state.reference = undefined;
  state.failPut = false;
  state.puts.length = 0;
  state.bucketDeletes.length = 0;
  state.metadataDeletes = 0;
});

describe("real asset route validation and compensation", () => {
  it("requires server-side owner authorization", async () => {
    state.owner = null;
    const response = await POST(uploadRequest(pdfFile(), "document"));
    expect(response.status).toBe(403);
    expect(state.puts).toHaveLength(0);
  });

  it("accepts a signature-valid PDF only as private/pending", async () => {
    const response = await POST(uploadRequest(pdfFile(), "document", "false"));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      asset: {
        kind: "document",
        fileName: "certificado.pdf",
        contentType: "application/pdf",
        isPublic: false,
        lifecycleState: "pending",
      },
    });
    expect(state.row).toMatchObject({ isPublic: false, lifecycleState: "pending", ownerUserId: "owner-test-id" });
    expect(state.puts).toHaveLength(1);
  });

  for (const malformed of ["true", "1", "False", "0"]) {
    it(`rejects client-controlled publication value ${JSON.stringify(malformed)}`, async () => {
      const response = await POST(uploadRequest(pdfFile(), "document", malformed));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("privados") });
      expect(state.puts).toHaveLength(0);
    });
  }

  it("rejects a MIME type outside the document allowlist", async () => {
    const response = await POST(uploadRequest(new File(["plain text"], "notes.txt", { type: "text/plain" }), "document"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/extensão|Tipo de arquivo/) });
  });

  it("rejects bytes whose signature disagrees with the declared MIME", async () => {
    const fakePng = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "fake.png", { type: "image/png" });
    const response = await POST(uploadRequest(fakePng, "image"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("não corresponde") });
  });

  it("rejects a document beyond the 15 MiB boundary", { timeout: 30_000 }, async () => {
    const bytes = new Uint8Array(15 * 1024 * 1024 + 1);
    bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const response = await POST(uploadRequest(pdfFile("oversized.pdf", bytes), "document"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("limite") });
    expect(state.puts).toHaveLength(0);
  });

  it("removes D1 metadata and R2 object when storage fails after insertion", async () => {
    state.failPut = true;
    const response = await POST(uploadRequest(pdfFile(), "document"));
    expect(response.status).toBe(503);
    expect(state.metadataDeletes).toBe(1);
    expect(state.bucketDeletes).toHaveLength(1);
    expect(state.row).toBeNull();
  });
});

describe("real asset route privacy projection", () => {
  it("denies private metadata to visitors while exposing the safe owner shape", async () => {
    state.row = seedRow();
    const url = `https://app.test/api/assets?id=${state.row.id}&metadata=1`;
    expect((await GET(new Request(url))).status).toBe(403);

    state.viewer = { userId: "owner-test-id" };
    const ownerResponse = await GET(new Request(url));
    expect(ownerResponse.status).toBe(200);
    await expect(ownerResponse.json()).resolves.toEqual({
      asset: {
        id: state.row.id,
        kind: "document",
        fileName: "test.pdf",
        contentType: "application/pdf",
        size: 5,
        altText: "Documento de teste",
        isPublic: false,
        createdAt: new Date(0).toISOString(),
        referenced: false,
        lifecycleState: "pending",
      },
    });
  });

  it("does not trust isPublic without a current published reference", async () => {
    state.row = seedRow({
      isPublic: true,
      lifecycleState: "linked",
      linkedCollection: "learning",
      linkedItemId: "learning-1",
    });
    const url = `https://app.test/api/assets?id=${state.row.id}&metadata=1`;
    expect((await GET(new Request(url))).status).toBe(403);

    state.reference = { collection: "learning", itemId: "learning-1", isPublic: true };
    const response = await GET(new Request(url));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ asset: { isPublic: true, referenced: true } });
  });
});
