import { expect, test, type APIRequestContext } from "@playwright/test";

const ownerHeaders = {
  "oai-authenticated-user-id": "owner-test-id",
  "oai-authenticated-user-email": "owner-test@example.test",
  "oai-authenticated-user-full-name": "Owner%20Test",
  "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
};

async function ownerContent(request: APIRequestContext) {
  const response = await request.get("/api/content?editor=1", { headers: ownerHeaders });
  expect(response.status()).toBe(200);
  return response.json() as Promise<{ content: Record<string, Array<Record<string, unknown>>>; version: number }>;
}

function writeHeaders(version: number) {
  return { ...ownerHeaders, "content-type": "application/json", "if-match": `"${version}"` };
}

test.describe("real Vinext/Miniflare API boundary", () => {
  test("owner headers, CAS, persistence and cleanup cross the HTTP runtime", async ({ request }) => {
    const marker = `HTTP temporário ${Date.now()}`;
    let record = await ownerContent(request);
    const startVersion = record.version;

    const createdResponse = await request.post("/api/content", {
      headers: writeHeaders(record.version),
      data: {
        collection: "interests",
        item: { value: marker, editorialStatus: "draft" },
      },
    });
    expect(createdResponse.status()).toBe(201);
    record = await createdResponse.json();
    expect(record.version).toBe(startVersion + 1);
    const created = record.content.interests.find((entry) => entry.value === marker)!;
    expect(created).toBeTruthy();

    const stale = await request.patch(`/api/content?collection=interests&id=${created.id}`, {
      headers: writeHeaders(startVersion),
      data: { editorialStatus: "published" },
    });
    expect(stale.status()).toBe(409);

    const persisted = await ownerContent(request);
    expect(persisted.version).toBe(record.version);
    expect(persisted.content.interests).toContainEqual(expect.objectContaining({ id: created.id, value: marker, editorialStatus: "draft" }));

    const removed = await request.delete(`/api/content?collection=interests&id=${created.id}`, {
      headers: { ...ownerHeaders, "if-match": `"${persisted.version}"` },
    });
    expect(removed.status()).toBe(200);
    const removedBody = await removed.json() as typeof persisted;
    expect(removedBody.content.interests.some((entry) => entry.id === created.id)).toBe(false);
  });

  test("a PDF is private on upload, public only through content, then revoked and deleted", async ({ request }) => {
    const marker = `Certificado HTTP temporário ${Date.now()}`;
    const upload = await request.post("/api/assets", {
      headers: ownerHeaders,
      multipart: {
        file: {
          name: "certificado-http-temporario.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% integration test\n%%EOF"),
        },
        kind: "document",
        isPublic: "false",
        altText: "Documento temporário da integração HTTP",
      },
    });
    expect(upload.status()).toBe(201);
    const uploaded = await upload.json() as { asset: { id: string; isPublic: boolean; lifecycleState: string } };
    expect(uploaded.asset).toMatchObject({ isPublic: false, lifecycleState: "pending" });

    const anonymousPrivate = await request.get(`/api/assets?id=${uploaded.asset.id}&metadata=1`);
    expect(anonymousPrivate.status()).toBe(403);
    const ownerPrivate = await request.get(`/api/assets?id=${uploaded.asset.id}&metadata=1`, { headers: ownerHeaders });
    expect(ownerPrivate.status()).toBe(200);

    let record = await ownerContent(request);
    const created = await request.post("/api/content", {
      headers: writeHeaders(record.version),
      data: {
        collection: "learning",
        item: {
          title: marker,
          institution: "Ambiente Miniflare descartável",
          year: "Temporário",
          category: "Teste",
          description: "Item descartável para validar privacidade através do runtime real.",
          documentAssetId: uploaded.asset.id,
          documentPublic: true,
          editorialStatus: "published",
        },
      },
    });
    expect(created.status()).toBe(201);
    record = await created.json();
    const item = record.content.learning.find((entry) => entry.title === marker)!;
    expect(item).toBeTruthy();
    expect((await request.get(`/api/assets?id=${uploaded.asset.id}&metadata=1`)).status()).toBe(200);

    const hidden = await request.patch(`/api/content?collection=learning&id=${item.id}`, {
      headers: writeHeaders(record.version),
      data: { editorialStatus: "hidden" },
    });
    expect(hidden.status()).toBe(200);
    record = await hidden.json();
    expect((await request.get(`/api/assets?id=${uploaded.asset.id}`)).status()).toBe(403);

    const deletedItem = await request.delete(`/api/content?collection=learning&id=${item.id}`, {
      headers: { ...ownerHeaders, "if-match": `"${record.version}"` },
    });
    expect(deletedItem.status()).toBe(200);
    const deletedAsset = await request.delete(`/api/assets?id=${uploaded.asset.id}`, { headers: ownerHeaders });
    expect([200, 404]).toContain(deletedAsset.status());
    expect((await request.get(`/api/assets?id=${uploaded.asset.id}&metadata=1`, { headers: ownerHeaders })).status()).toBe(404);
  });

  test("anonymous writes and malformed visibility never reach storage", async ({ request }) => {
    const anonymous = await request.post("/api/content", {
      headers: { "content-type": "application/json" },
      data: { collection: "interests", item: { value: "Não salvar", editorialStatus: "published" } },
    });
    expect(anonymous.status()).toBe(403);

    const malformed = await request.post("/api/assets", {
      headers: ownerHeaders,
      multipart: {
        file: { name: "nao-publicar.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
        kind: "document",
        isPublic: "true",
        altText: "Teste inválido",
      },
    });
    expect(malformed.status()).toBe(400);
  });
});
