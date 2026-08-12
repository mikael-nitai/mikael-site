import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const repositoryPath = fileURLToPath(root);
const SITE_ORIGIN = "https://site.test";
const OWNER_ID = "owner-test-id";
const OWNER_EMAIL = "owner@example.test";

globalThis.__backendContractEnv = {};
globalThis.__backendContractHeaders = new Headers();

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function executeMigration(database, source) {
  for (const statement of source.split("--> statement-breakpoint")) {
    if (statement.trim()) database.exec(statement);
  }
}

class SqliteD1PreparedStatement {
  constructor(client, sql, bindings = []) {
    this.client = client;
    this.sql = sql;
    this.bindings = bindings;
  }

  bind(...bindings) {
    return new SqliteD1PreparedStatement(this.client, this.sql, bindings.map((value) => value === undefined ? null : value));
  }

  async all() {
    return this.#executeRows();
  }

  async raw() {
    const { results, columns } = this.#executeRows();
    return results.map((row) => columns.map((column) => row[column]));
  }

  async run() {
    return this.#executeRun();
  }

  async first(column) {
    const { results } = this.#executeRows();
    const row = results[0] ?? null;
    return column && row ? row[column] ?? null : row;
  }

  executeForBatch() {
    const statement = this.client.database.prepare(this.sql);
    this.client.maybeFail(this.sql);
    const columns = statement.columns().map(({ name }) => name);
    if (columns.length > 0) {
      const results = statement.all(...this.bindings).map((row) => ({ ...row }));
      return { success: true, results, meta: { changes: results.length }, columns };
    }
    const result = statement.run(...this.bindings);
    return { success: true, results: [], meta: { changes: Number(result.changes) }, columns: [] };
  }

  #executeRows() {
    const statement = this.client.database.prepare(this.sql);
    this.client.maybeFail(this.sql);
    const columns = statement.columns().map(({ name }) => name);
    const results = statement.all(...this.bindings).map((row) => ({ ...row }));
    return { success: true, results, meta: { changes: results.length }, columns };
  }

  #executeRun() {
    const statement = this.client.database.prepare(this.sql);
    this.client.maybeFail(this.sql);
    const result = statement.run(...this.bindings);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
}

class SqliteD1Database {
  constructor() {
    this.database = new DatabaseSync(":memory:");
    this.failures = [];
  }

  prepare(sql) {
    return new SqliteD1PreparedStatement(this, sql);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.executeForBatch());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  failNext(pattern, message = "Falha D1 injetada pelo teste") {
    this.failures.push({ pattern, message });
  }

  maybeFail(sql) {
    const index = this.failures.findIndex(({ pattern }) => pattern.test(sql));
    if (index < 0) return;
    const [{ message }] = this.failures.splice(index, 1);
    throw new Error(message);
  }

  close() {
    this.database.close();
  }
}

class MemoryR2Bucket {
  constructor() {
    this.objects = new Map();
    this.failNextPut = false;
    this.failNextDelete = false;
  }

  async put(key, value, options = {}) {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error("Falha R2 put injetada pelo teste");
    }
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value.slice(0))
      : new Uint8Array(await new Response(value).arrayBuffer());
    this.objects.set(key, {
      bytes,
      httpMetadata: { ...(options.httpMetadata ?? {}) },
      customMetadata: { ...(options.customMetadata ?? {}) },
      httpEtag: `"test-${bytes.byteLength}"`,
    });
  }

  async get(key) {
    const stored = this.objects.get(key);
    if (!stored) return null;
    return {
      body: stored.bytes.slice(),
      size: stored.bytes.byteLength,
      httpMetadata: { ...stored.httpMetadata },
      customMetadata: { ...stored.customMetadata },
      httpEtag: stored.httpEtag,
    };
  }

  async delete(key) {
    if (this.failNextDelete) {
      this.failNextDelete = false;
      throw new Error("Falha R2 delete injetada pelo teste");
    }
    this.objects.delete(key);
  }
}

async function bundleBackendModule(entryPoint) {
  const { build } = await loadEsbuild();
  const result = await build({
    absWorkingDir: repositoryPath,
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "silent",
    plugins: [{
      name: "backend-contract-runtime",
      setup(context) {
        context.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "cloudflare-workers", namespace: "contract" }));
        context.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "next-headers", namespace: "contract" }));
        context.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "next-navigation", namespace: "contract" }));
        context.onLoad({ filter: /^cloudflare-workers$/, namespace: "contract" }, () => ({
          contents: "export const env = globalThis.__backendContractEnv;",
        }));
        context.onLoad({ filter: /^next-headers$/, namespace: "contract" }, () => ({
          contents: "export async function headers() { return globalThis.__backendContractHeaders; }",
        }));
        context.onLoad({ filter: /^next-navigation$/, namespace: "contract" }, () => ({
          contents: "export function redirect(path) { throw new Error(`Unexpected redirect to ${path}`); }",
        }));
      },
    }],
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

async function loadEsbuild() {
  try {
    return await import("esbuild");
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    const pnpmModules = new URL("node_modules/.pnpm/", root);
    const packageDirectory = (await readdir(pnpmModules)).find((name) => /^esbuild@[^_]+$/.test(name));
    if (!packageDirectory) throw error;
    return import(new URL(`node_modules/.pnpm/${packageDirectory}/node_modules/esbuild/lib/main.js`, root));
  }
}

const backendRoutes = Promise.all([
  bundleBackendModule("app/api/content/route.ts"),
  bundleBackendModule("app/api/assets/route.ts"),
]).then(([content, assets]) => ({ content, assets }));

async function createBackendHarness() {
  const [migration0, migration1, routes] = await Promise.all([
    read("drizzle/0000_wide_black_knight.sql"),
    read("drizzle/0001_asset_lifecycle.sql"),
    backendRoutes,
  ]);
  const d1 = new SqliteD1Database();
  executeMigration(d1.database, migration0);
  executeMigration(d1.database, migration1);
  const r2 = new MemoryR2Bucket();
  Object.assign(globalThis.__backendContractEnv, {
    DB: d1,
    UPLOADS: r2,
    MIKAEL_OWNER_USER_ID: OWNER_ID,
    MIKAEL_OWNER_EMAIL: OWNER_EMAIL,
  });
  globalThis.__backendContractHeaders = ownerIdentityHeaders();
  return { d1, r2, routes };
}

function ownerIdentityHeaders() {
  return new Headers({
    "oai-authenticated-user-id": OWNER_ID,
    "oai-authenticated-user-email": OWNER_EMAIL,
    "oai-authenticated-user-full-name": "Owner%20Test",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });
}

function setIdentity(kind = "owner") {
  globalThis.__backendContractHeaders = kind === "owner" ? ownerIdentityHeaders() : new Headers();
}

function writeHeaders(version, contentType = "application/json", origin = SITE_ORIGIN) {
  const headers = new Headers({ Origin: origin, "Sec-Fetch-Site": origin === SITE_ORIGIN ? "same-origin" : "cross-site" });
  if (contentType) headers.set("Content-Type", contentType);
  if (version !== undefined) headers.set("If-Match", `"${version}"`);
  return headers;
}

async function callContent(route, { method = "GET", path = "/api/content", body, version, identity = "owner", origin = SITE_ORIGIN, contentType = "application/json" } = {}) {
  setIdentity(identity);
  const init = { method, headers: method === "GET" ? new Headers() : writeHeaders(version, contentType, origin) };
  if (body !== undefined) init.body = JSON.stringify(body);
  return route[method](new Request(`${SITE_ORIGIN}${path}`, init));
}

async function jsonBody(response) {
  const body = await response.json();
  return { response, body };
}

async function expectedLoggedFailure(action) {
  const original = console.error;
  console.error = () => {};
  try {
    return await action();
  } finally {
    console.error = original;
  }
}

async function uploadAsset(route, { name, type, bytes, kind, isPublic = "false", altText = "Asset temporário" }) {
  setIdentity("owner");
  const form = new FormData();
  form.append("file", new File([bytes], name, { type }));
  form.append("kind", kind);
  form.append("isPublic", isPublic);
  form.append("altText", altText);
  const headers = new Headers({ Origin: SITE_ORIGIN, "Sec-Fetch-Site": "same-origin" });
  return route.POST(new Request(`${SITE_ORIGIN}/api/assets`, { method: "POST", headers, body: form }));
}

async function callAsset(route, { method = "GET", id, metadata = false, version, identity = "owner" } = {}) {
  setIdentity(identity);
  const query = new URLSearchParams({ id });
  if (metadata) query.set("metadata", "1");
  const headers = method === "GET" ? new Headers() : writeHeaders(version, undefined);
  return route[method](new Request(`${SITE_ORIGIN}/api/assets?${query}`, { method, headers }));
}

function contentRow(d1) {
  const row = d1.database.prepare("SELECT payload, version FROM site_content WHERE id = 'primary'").get();
  return row ? { content: JSON.parse(row.payload), version: row.version } : null;
}

function assetRow(d1, id) {
  const row = d1.database.prepare("SELECT * FROM content_assets WHERE id = ?").get(id);
  return row ? { ...row } : null;
}

test("asset lifecycle migration backfills current references and revokes stale visibility", async () => {
  const database = new DatabaseSync(":memory:");
  executeMigration(database, await read("drizzle/0000_wide_black_knight.sql"));

  const payload = {
    learning: [
      {
        id: "learning-public",
        editorialStatus: "published",
        coverAssetId: "cover-public",
        documentAssetId: "document-public",
        documentPublic: true,
      },
      {
        id: "learning-malformed",
        editorialStatus: "published",
        documentAssetId: "document-malformed",
        documentPublic: "false",
      },
    ],
    projects: [],
    notes: [],
    questions: [],
  };
  database.prepare("INSERT INTO site_content (id, payload) VALUES (?, ?)")
    .run("primary", JSON.stringify(payload));
  const insertAsset = database.prepare(`INSERT INTO content_assets
    (id, owner_user_id, object_key, kind, file_name, content_type, size, is_public)
    VALUES (?, 'owner', ?, ?, ?, ?, 10, ?)`);
  insertAsset.run("cover-public", "cover-public", "image", "cover.png", "image/png", 0);
  insertAsset.run("document-public", "document-public", "document", "public.pdf", "application/pdf", 0);
  insertAsset.run("document-malformed", "document-malformed", "document", "private.pdf", "application/pdf", 1);
  insertAsset.run("stale-public", "stale-public", "image", "stale.png", "image/png", 1);

  executeMigration(database, await read("drizzle/0001_asset_lifecycle.sql"));
  const rows = database.prepare(`SELECT id, is_public, lifecycle_state, linked_collection, linked_item_id
    FROM content_assets ORDER BY id`).all();
  const byId = new Map(rows.map((row) => [row.id, row]));

  assert.deepEqual({ ...byId.get("cover-public") }, {
    id: "cover-public",
    is_public: 1,
    lifecycle_state: "linked",
    linked_collection: "learning",
    linked_item_id: "learning-public",
  });
  assert.equal(byId.get("document-public").is_public, 1);
  assert.equal(byId.get("document-malformed").is_public, 0, "a string must never publish a document");
  assert.deepEqual({ ...byId.get("stale-public") }, {
    id: "stale-public",
    is_public: 0,
    lifecycle_state: "orphaned",
    linked_collection: null,
    linked_item_id: null,
  });
  assert.equal(database.prepare("SELECT version FROM site_content WHERE id = 'primary'").get().version, 1);
  database.close();
});

test("public projection and asset route keep publication server-derived", async () => {
  const [editorial, assetRoute, contentRoute, store] = await Promise.all([
    read("content/editorial.ts"),
    read("app/api/assets/route.ts"),
    read("app/api/content/route.ts"),
    read("lib/content-store.ts"),
  ]);

  assert.match(editorial, /entry\.documentPublic === true && documentAssetId/);
  assert.doesNotMatch(editorial, /entry\.documentPublic \? entry/);
  assert.match(contentRoute, /typeof raw\.documentPublic !== "boolean"/);
  assert.match(contentRoute, /received\.size !== ids\.length/);
  assert.match(assetRoute, /sniffContentType\(new Uint8Array\(bytes\)\) !== contentType/);
  assert.match(assetRoute, /reference\?\.isPublic === true/);
  assert.match(assetRoute, /Somente o texto alternativo pode ser alterado diretamente/);
  assert.match(store, /WHERE id = \? AND version = \?/);
  assert.match(store, /lifecycle_state = 'orphaned'/);
});

const temporaryItems = {
  timeline: {
    period: "Temporário",
    title: "Marco editorial temporário",
    institution: "Ambiente de teste",
    description: "Registro criado apenas no banco em memória.",
    category: "Teste",
    editorialStatus: "draft",
  },
  projects: {
    title: "Projeto editorial temporário",
    description: "Projeto criado apenas para validar o contrato editorial.",
    status: "Temporário",
    period: "Teste",
    image: "https://example.test/project.png",
    imageAlt: "Capa temporária do projeto",
    technologies: ["Teste", "D1"],
    body: "<p>Texto <strong>temporário</strong>.</p>",
    github: "",
    demo: "https://example.test/demo",
    editorialStatus: "draft",
  },
  notes: {
    title: "Post editorial temporário",
    body: "<p>Post criado apenas para validar persistência e sanitização.</p>",
    date: "Temporário",
    area: "Teste",
    tags: ["temporário", "post"],
    editorialStatus: "draft",
  },
  learning: {
    title: "Certificado editorial temporário",
    institution: "Ambiente de teste",
    year: "Temporário",
    category: "Teste",
    hours: "1 h",
    description: "Formação temporária sem publicação real.",
    documentPublic: false,
    editorialStatus: "draft",
  },
  interests: {
    value: "Interesse editorial temporário",
    editorialStatus: "draft",
  },
  questions: {
    title: "Pergunta editorial temporária",
    text: "Como validar este fluxo sem tocar produção?",
    image: "https://example.test/question.png",
    imageAlt: "Capa temporária da pergunta",
    editorialStatus: "draft",
  },
  contacts: {
    label: "Contato editorial temporário",
    value: "Canal apenas de teste",
    href: "https://example.test/contact",
    note: "Não publicar em produção.",
    editorialStatus: "draft",
  },
};

test("every temporary editorial category persists, publishes, hides, restores, reorders and deletes under CAS", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { content: route } = harness.routes;

  let result = await jsonBody(await callContent(route, { path: "/api/content?editor=1" }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.version, 1);
  let version = result.body.version;
  const ids = new Map();

  for (const [collection, item] of Object.entries(temporaryItems)) {
    result = await jsonBody(await callContent(route, {
      method: "POST",
      body: { collection, item },
      version,
    }));
    assert.equal(result.response.status, 201, `${collection} should be accepted`);
    assert.equal(result.body.version, version + 1);
    version = result.body.version;
    const matchField = collection === "interests" ? "value" : collection === "contacts" ? "label" : "title";
    const created = result.body.content[collection].find((entry) => entry[matchField] === item[matchField]);
    assert.ok(created?.id, `${collection} should receive a server id`);
    assert.equal(created.editorialStatus, "draft");
    ids.set(collection, created.id);
    assert.equal(contentRow(harness.d1).version, version, `${collection} should persist its version in D1`);
  }

  result = await jsonBody(await callContent(route, { identity: "anonymous" }));
  assert.equal(result.response.status, 200);
  for (const [collection, id] of ids) {
    assert.equal(result.body.content[collection].some((entry) => entry.id === id), false, `${collection} draft must stay private`);
  }

  for (const [collection, id] of ids) {
    result = await jsonBody(await callContent(route, {
      method: "PATCH",
      path: `/api/content?collection=${collection}&id=${encodeURIComponent(id)}`,
      body: { editorialStatus: "published" },
      version,
    }));
    assert.equal(result.response.status, 200, `${collection} should publish`);
    version = result.body.version;

    const publicResult = await jsonBody(await callContent(route, { identity: "anonymous" }));
    assert.ok(publicResult.body.content[collection].some((entry) => entry.id === id), `${collection} published item should be public`);

    result = await jsonBody(await callContent(route, {
      method: "PATCH",
      path: `/api/content?collection=${collection}&id=${encodeURIComponent(id)}`,
      body: { editorialStatus: "hidden" },
      version,
    }));
    assert.equal(result.response.status, 200, `${collection} should hide reversibly`);
    version = result.body.version;
    const hiddenPublicResult = await jsonBody(await callContent(route, { identity: "anonymous" }));
    assert.equal(hiddenPublicResult.body.content[collection].some((entry) => entry.id === id), false, `${collection} hidden item must be private`);

    result = await jsonBody(await callContent(route, {
      method: "PATCH",
      path: `/api/content?collection=${collection}&id=${encodeURIComponent(id)}`,
      body: { editorialStatus: "published" },
      version,
    }));
    assert.equal(result.response.status, 200, `${collection} should restore`);
    version = result.body.version;
  }

  const staleTarget = ids.get("notes");
  const stale = await jsonBody(await callContent(route, {
    method: "PATCH",
    path: `/api/content?collection=notes&id=${encodeURIComponent(staleTarget)}`,
    body: { title: "Sobrescrita obsoleta" },
    version: version - 1,
  }));
  assert.equal(stale.response.status, 409);
  assert.equal(contentRow(harness.d1).version, version);
  assert.notEqual(contentRow(harness.d1).content.notes.find(({ id }) => id === staleTarget).title, "Sobrescrita obsoleta");

  for (const collection of ids.keys()) {
    const editorResult = await jsonBody(await callContent(route, { path: "/api/content?editor=1" }));
    const currentIds = editorResult.body.content[collection].map((entry) => entry.id);
    const reorderedIds = [...currentIds].reverse();
    result = await jsonBody(await callContent(route, {
      method: "PUT",
      body: { collection, orderedIds: reorderedIds },
      version,
    }));
    assert.equal(result.response.status, 200, `${collection} should reorder`);
    version = result.body.version;
    assert.deepEqual(result.body.content[collection].map((entry) => entry.order), result.body.content[collection].map((_, index) => index));

    const invalidOrder = reorderedIds.length > 1
      ? [reorderedIds[0], reorderedIds[0], ...reorderedIds.slice(2)]
      : ["unknown-item-id"];
    const duplicateOrder = await jsonBody(await callContent(route, {
      method: "PUT",
      body: { collection, orderedIds: invalidOrder },
      version,
    }));
    assert.equal(duplicateOrder.response.status, 400, `${collection} invalid order must be rejected`);
    assert.equal(contentRow(harness.d1).version, version);
  }

  for (const [collection, id] of ids) {
    result = await jsonBody(await callContent(route, {
      method: "DELETE",
      path: `/api/content?collection=${collection}&id=${encodeURIComponent(id)}`,
      version,
      contentType: undefined,
    }));
    assert.equal(result.response.status, 200, `${collection} should delete permanently`);
    version = result.body.version;
    assert.equal(result.body.content[collection].some((entry) => entry.id === id), false);
    assert.deepEqual(result.body.content[collection].map((entry) => entry.order), result.body.content[collection].map((_, index) => index), `${collection} delete must compact order`);
  }
});

test("content validation rejects malformed temporary payloads without advancing D1 version", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { content: route } = harness.routes;
  const initial = await jsonBody(await callContent(route, { path: "/api/content?editor=1" }));
  const version = initial.body.version;
  const invalidItems = [
    ["timeline", { ...temporaryItems.timeline, title: "" }],
    ["projects", { ...temporaryItems.projects, technologies: "Teste,D1" }],
    ["projects", { ...temporaryItems.projects, github: "javascript:alert(1)" }],
    ["notes", { ...temporaryItems.notes, tags: ["válida", 3] }],
    ["learning", { ...temporaryItems.learning, documentPublic: "false" }],
    ["interests", { ...temporaryItems.interests, value: " " }],
    ["questions", { ...temporaryItems.questions, image: "data:text/html,test" }],
    ["contacts", { ...temporaryItems.contacts, href: "mailto:test@example.test%0d%0aBcc:x@example.test" }],
  ];

  for (const [collection, item] of invalidItems) {
    const result = await jsonBody(await callContent(route, {
      method: "POST",
      body: { collection, item },
      version,
    }));
    assert.equal(result.response.status, 400, `${collection} malformed payload must be rejected`);
    assert.equal(contentRow(harness.d1).version, version);
  }

  const anonymous = await jsonBody(await callContent(route, {
    method: "POST",
    body: { collection: "interests", item: temporaryItems.interests },
    version,
    identity: "anonymous",
  }));
  assert.equal(anonymous.response.status, 403);
  assert.equal(contentRow(harness.d1).version, version);

  const crossSite = await jsonBody(await callContent(route, {
    method: "POST",
    body: { collection: "interests", item: temporaryItems.interests },
    version,
    origin: "https://attacker.test",
  }));
  assert.equal(crossSite.response.status, 403);
  assert.equal(contentRow(harness.d1).version, version);

  const wrongType = await jsonBody(await callContent(route, {
    method: "POST",
    body: { collection: "interests", item: temporaryItems.interests },
    version,
    contentType: "text/plain",
  }));
  assert.equal(wrongType.response.status, 415);
  assert.equal(contentRow(harness.d1).version, version);

  const withoutPrecondition = await jsonBody(await callContent(route, {
    method: "POST",
    body: { collection: "interests", item: temporaryItems.interests },
  }));
  assert.equal(withoutPrecondition.response.status, 428);
  assert.match(withoutPrecondition.body.error, /If-Match/i);
  assert.equal(contentRow(harness.d1).version, version);
});

test("seed placeholders can be explicitly promoted to real editorial records", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { content: route } = harness.routes;
  let result = await jsonBody(await callContent(route, { path: "/api/content?editor=1" }));
  let version = result.body.version;

  for (const collection of ["projects", "notes", "learning"]) {
    const placeholder = result.body.content[collection].find((entry) => entry.placeholder === true);
    assert.ok(placeholder, `${collection} seed should expose a temporary record`);
    const substantive = structuredClone(temporaryItems[collection]);
    substantive.placeholder = false;
    substantive.editorialStatus = "published";
    result = await jsonBody(await callContent(route, {
      method: "PATCH",
      path: `/api/content?collection=${collection}&id=${encodeURIComponent(placeholder.id)}`,
      body: substantive,
      version,
    }));
    assert.equal(result.response.status, 200, `${collection} should allow temporary-to-real promotion`);
    version = result.body.version;
    const promoted = result.body.content[collection].find((entry) => entry.id === placeholder.id);
    assert.equal(Object.hasOwn(promoted, "placeholder"), false, `${collection} should no longer be labeled temporary`);
    const publicResult = await jsonBody(await callContent(route, { identity: "anonymous" }));
    const publicPromoted = publicResult.body.content[collection].find((entry) => entry.id === placeholder.id);
    assert.ok(publicPromoted);
    assert.equal(Object.hasOwn(publicPromoted, "placeholder"), false);
  }

  const forbidden = await jsonBody(await callContent(route, {
    method: "PATCH",
    path: "/api/content?collection=projects&id=project-2",
    body: { placeholder: true },
    version,
  }));
  assert.equal(forbidden.response.status, 400, "the owner cannot mark arbitrary real content as fabricated placeholder through this escape hatch");
  assert.equal(contentRow(harness.d1).version, version);
});

test("corrupt persisted JSON fails closed and can never be overwritten through a normal edit", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { content: route } = harness.routes;
  await jsonBody(await callContent(route, { path: "/api/content?editor=1" }));
  harness.d1.database.prepare("UPDATE site_content SET payload = ?, version = 7 WHERE id = 'primary'").run("{");

  const editorGet = await expectedLoggedFailure(async () => jsonBody(await callContent(route, { path: "/api/content?editor=1" })));
  assert.equal(editorGet.response.status, 503);
  assert.equal(harness.d1.database.prepare("SELECT payload FROM site_content WHERE id = 'primary'").get().payload, "{");

  const write = await expectedLoggedFailure(async () => jsonBody(await callContent(route, {
    method: "PATCH",
    path: "/api/content?collection=identity&id=primary",
    body: { description: "Esta edição não pode apagar dados corrompidos silenciosamente." },
    version: 7,
  })));
  assert.equal(write.response.status, 503);
  const persisted = harness.d1.database.prepare("SELECT payload, version FROM site_content WHERE id = 'primary'").get();
  assert.equal(persisted.payload, "{");
  assert.equal(persisted.version, 7);
});

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n% temporary contract fixture\n");
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
const GIF_BYTES = new TextEncoder().encode("GIF89a");
const WEBP_BYTES = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

test("cover assets for every supported category publish, revoke, replace, detach and clean up through D1 and R2", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { content: contentRoute, assets: assetRoute } = harness.routes;
  let result = await jsonBody(await callContent(contentRoute, { path: "/api/content?editor=1" }));
  let version = result.body.version;
  const records = new Map();

  for (const collection of ["projects", "notes", "learning", "questions"]) {
    const upload = await jsonBody(await uploadAsset(assetRoute, {
      name: `${collection}-temporary.png`,
      type: "image/png",
      bytes: PNG_BYTES,
      kind: "image",
      altText: `Capa temporária de ${collection}`,
    }));
    assert.equal(upload.response.status, 201, `${collection} cover upload should succeed`);
    assert.equal(upload.body.asset.isPublic, false);
    assert.equal(upload.body.asset.lifecycleState, "pending");
    assert.equal(upload.body.asset.referenced, false);
    const assetId = upload.body.asset.id;
    const pending = assetRow(harness.d1, assetId);
    assert.equal(pending.lifecycle_state, "pending");
    assert.equal(pending.is_public, 0);
    assert.ok(harness.r2.objects.has(pending.object_key));

    const visitorBeforeLink = await callAsset(assetRoute, { id: assetId, identity: "anonymous" });
    assert.equal(visitorBeforeLink.status, 403);
    const ownerMetadata = await jsonBody(await callAsset(assetRoute, { id: assetId, metadata: true }));
    assert.equal(ownerMetadata.response.status, 200);
    assert.deepEqual({
      isPublic: ownerMetadata.body.asset.isPublic,
      referenced: ownerMetadata.body.asset.referenced,
      lifecycleState: ownerMetadata.body.asset.lifecycleState,
    }, { isPublic: false, referenced: false, lifecycleState: "pending" });

    const item = structuredClone(temporaryItems[collection]);
    item.title = `${item.title} com capa`;
    item.editorialStatus = "published";
    item.coverAssetId = assetId;
    if (collection === "projects" || collection === "questions") {
      item.image = `/api/assets?id=${encodeURIComponent(assetId)}`;
      item.imageAlt = `Capa temporária de ${collection}`;
    }
    result = await jsonBody(await callContent(contentRoute, {
      method: "POST",
      body: { collection, item },
      version,
    }));
    assert.equal(result.response.status, 201, `${collection} should associate its cover`);
    version = result.body.version;
    const created = result.body.content[collection].find((entry) => entry.title === item.title);
    assert.ok(created?.id);
    assert.equal(created.coverAssetId, assetId);
    if (collection === "projects" || collection === "questions") {
      assert.equal(created.image, `/api/assets?id=${encodeURIComponent(assetId)}`);
    }
    records.set(collection, { itemId: created.id, assetId });

    const linked = assetRow(harness.d1, assetId);
    assert.deepEqual({
      isPublic: linked.is_public,
      state: linked.lifecycle_state,
      collection: linked.linked_collection,
      itemId: linked.linked_item_id,
    }, { isPublic: 1, state: "linked", collection, itemId: created.id });
    const visitorAfterLink = await callAsset(assetRoute, { id: assetId, identity: "anonymous" });
    assert.equal(visitorAfterLink.status, 200, `${collection} published cover should be public`);

    result = await jsonBody(await callContent(contentRoute, {
      method: "PATCH",
      path: `/api/content?collection=${collection}&id=${encodeURIComponent(created.id)}`,
      body: { editorialStatus: "hidden" },
      version,
    }));
    assert.equal(result.response.status, 200);
    version = result.body.version;
    assert.equal(assetRow(harness.d1, assetId).is_public, 0);
    assert.equal((await callAsset(assetRoute, { id: assetId, identity: "anonymous" })).status, 403, `${collection} hidden cover URL must be revoked`);

    result = await jsonBody(await callContent(contentRoute, {
      method: "PATCH",
      path: `/api/content?collection=${collection}&id=${encodeURIComponent(created.id)}`,
      body: { editorialStatus: "published" },
      version,
    }));
    assert.equal(result.response.status, 200);
    version = result.body.version;
    assert.equal((await callAsset(assetRoute, { id: assetId, identity: "anonymous" })).status, 200, `${collection} restored cover should be public again`);
  }

  const project = records.get("projects");
  result = await jsonBody(await callContent(contentRoute, {
    method: "DELETE",
    path: `/api/content?collection=projects&id=${encodeURIComponent(project.itemId)}`,
    version,
    contentType: undefined,
  }));
  assert.equal(result.response.status, 200);
  version = result.body.version;
  assert.deepEqual({
    state: assetRow(harness.d1, project.assetId).lifecycle_state,
    isPublic: assetRow(harness.d1, project.assetId).is_public,
  }, { state: "orphaned", isPublic: 0 });
  assert.equal((await callAsset(assetRoute, { id: project.assetId, identity: "anonymous" })).status, 403);
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: project.assetId })).status, 200);
  assert.equal(assetRow(harness.d1, project.assetId), null);

  const note = records.get("notes");
  const replacementUpload = await jsonBody(await uploadAsset(assetRoute, {
    name: "notes-replacement.png",
    type: "image/png",
    bytes: PNG_BYTES,
    kind: "image",
  }));
  assert.equal(replacementUpload.response.status, 201);
  const replacementId = replacementUpload.body.asset.id;
  result = await jsonBody(await callContent(contentRoute, {
    method: "PATCH",
    path: `/api/content?collection=notes&id=${encodeURIComponent(note.itemId)}`,
    body: { coverAssetId: replacementId },
    version,
  }));
  assert.equal(result.response.status, 200);
  version = result.body.version;
  assert.equal(assetRow(harness.d1, note.assetId).lifecycle_state, "orphaned");
  assert.equal(assetRow(harness.d1, note.assetId).is_public, 0);
  assert.equal(assetRow(harness.d1, replacementId).lifecycle_state, "linked");
  assert.equal(assetRow(harness.d1, replacementId).is_public, 1);
  assert.equal((await callAsset(assetRoute, { id: note.assetId, identity: "anonymous" })).status, 403, "replaced URL must be revoked");
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: note.assetId })).status, 200);
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: replacementId })).status, 409, "referenced asset cannot be deleted");

  result = await jsonBody(await callContent(contentRoute, {
    method: "PATCH",
    path: `/api/content?collection=notes&id=${encodeURIComponent(note.itemId)}`,
    body: { coverAssetId: null },
    version,
  }));
  assert.equal(result.response.status, 200);
  version = result.body.version;
  assert.equal(assetRow(harness.d1, replacementId).lifecycle_state, "orphaned");
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: replacementId })).status, 200);

  for (const collection of ["learning", "questions"]) {
    const record = records.get(collection);
    const body = { coverAssetId: null };
    if (collection === "questions") body.image = "";
    result = await jsonBody(await callContent(contentRoute, {
      method: "PATCH",
      path: `/api/content?collection=${collection}&id=${encodeURIComponent(record.itemId)}`,
      body,
      version,
    }));
    assert.equal(result.response.status, 200);
    version = result.body.version;
    assert.equal(assetRow(harness.d1, record.assetId).lifecycle_state, "orphaned");
    assert.equal((await callAsset(assetRoute, { method: "DELETE", id: record.assetId })).status, 200);
  }
});

test("certificate documents remain private by default and expose no id until explicit publication", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { content: contentRoute, assets: assetRoute } = harness.routes;
  let result = await jsonBody(await callContent(contentRoute, { path: "/api/content?editor=1" }));
  let version = result.body.version;

  const upload = await jsonBody(await uploadAsset(assetRoute, {
    name: "certificado-temporario.pdf",
    type: "application/pdf",
    bytes: PDF_BYTES,
    kind: "document",
    altText: "Certificado temporário",
  }));
  assert.equal(upload.response.status, 201);
  const documentId = upload.body.asset.id;

  const learningItem = {
    ...structuredClone(temporaryItems.learning),
    title: "Certificado privado temporário",
    documentAssetId: documentId,
    documentPublic: false,
    editorialStatus: "published",
  };
  result = await jsonBody(await callContent(contentRoute, {
    method: "POST",
    body: { collection: "learning", item: learningItem },
    version,
  }));
  assert.equal(result.response.status, 201);
  version = result.body.version;
  const item = result.body.content.learning.find((entry) => entry.title === learningItem.title);
  assert.ok(item?.id);
  assert.deepEqual({
    state: assetRow(harness.d1, documentId).lifecycle_state,
    isPublic: assetRow(harness.d1, documentId).is_public,
  }, { state: "linked", isPublic: 0 });
  assert.equal((await callAsset(assetRoute, { id: documentId, identity: "anonymous" })).status, 403);

  let publicResult = await jsonBody(await callContent(contentRoute, { identity: "anonymous" }));
  let publicItem = publicResult.body.content.learning.find((entry) => entry.id === item.id);
  assert.ok(publicItem);
  assert.equal(publicItem.documentPublic, false);
  assert.equal(Object.hasOwn(publicItem, "documentAssetId"), false);

  result = await jsonBody(await callContent(contentRoute, {
    method: "PATCH",
    path: `/api/content?collection=learning&id=${encodeURIComponent(item.id)}`,
    body: { documentPublic: true },
    version,
  }));
  assert.equal(result.response.status, 200);
  version = result.body.version;
  assert.equal(assetRow(harness.d1, documentId).is_public, 1);
  publicResult = await jsonBody(await callContent(contentRoute, { identity: "anonymous" }));
  publicItem = publicResult.body.content.learning.find((entry) => entry.id === item.id);
  assert.equal(publicItem.documentAssetId, documentId);
  const publicDocument = await callAsset(assetRoute, { id: documentId, identity: "anonymous" });
  assert.equal(publicDocument.status, 200);
  assert.equal(publicDocument.headers.get("content-type"), "application/pdf");
  assert.equal(publicDocument.headers.get("content-security-policy"), "sandbox");
  assert.deepEqual(new Uint8Array(await publicDocument.arrayBuffer()), PDF_BYTES);

  result = await jsonBody(await callContent(contentRoute, {
    method: "PATCH",
    path: `/api/content?collection=learning&id=${encodeURIComponent(item.id)}`,
    body: { editorialStatus: "hidden" },
    version,
  }));
  assert.equal(result.response.status, 200);
  version = result.body.version;
  assert.equal((await callAsset(assetRoute, { id: documentId, identity: "anonymous" })).status, 403);
  publicResult = await jsonBody(await callContent(contentRoute, { identity: "anonymous" }));
  assert.equal(publicResult.body.content.learning.some((entry) => entry.id === item.id), false);

  result = await jsonBody(await callContent(contentRoute, {
    method: "PATCH",
    path: `/api/content?collection=learning&id=${encodeURIComponent(item.id)}`,
    body: { editorialStatus: "published" },
    version,
  }));
  assert.equal(result.response.status, 200);
  version = result.body.version;
  assert.equal((await callAsset(assetRoute, { id: documentId, identity: "anonymous" })).status, 200);

  result = await jsonBody(await callContent(contentRoute, {
    method: "PATCH",
    path: `/api/content?collection=learning&id=${encodeURIComponent(item.id)}`,
    body: { documentAssetId: null, documentPublic: false },
    version,
  }));
  assert.equal(result.response.status, 200);
  assert.deepEqual({
    state: assetRow(harness.d1, documentId).lifecycle_state,
    isPublic: assetRow(harness.d1, documentId).is_public,
  }, { state: "orphaned", isPublic: 0 });
  assert.equal((await callAsset(assetRoute, { id: documentId, identity: "anonymous" })).status, 403);
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: documentId })).status, 200);
});

test("upload validation rejects forged, public, malformed and oversized temporary files before persistence", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { assets: route } = harness.routes;
  const invalidUploads = [
    { name: "forged.png", type: "image/png", bytes: PDF_BYTES, kind: "image", expected: "conteúdo" },
    { name: "wrong-extension.pdf", type: "image/png", bytes: PNG_BYTES, kind: "image", expected: "extensão" },
    { name: "plain.txt", type: "text/plain", bytes: new TextEncoder().encode("plain"), kind: "document", expected: "Tipo" },
    { name: "public.png", type: "image/png", bytes: PNG_BYTES, kind: "image", isPublic: "true", expected: "privados" },
    { name: "unknown.png", type: "image/png", bytes: PNG_BYTES, kind: "avatar", expected: "inválido" },
  ];

  for (const invalid of invalidUploads) {
    const result = await jsonBody(await uploadAsset(route, invalid));
    assert.equal(result.response.status, 400, invalid.name);
    assert.match(result.body.error, new RegExp(invalid.expected, "i"));
    assert.equal(harness.d1.database.prepare("SELECT COUNT(*) AS total FROM content_assets").get().total, 0);
    assert.equal(harness.r2.objects.size, 0);
  }

  setIdentity("owner");
  const duplicateForm = new FormData();
  duplicateForm.append("file", new File([PNG_BYTES], "duplicate.png", { type: "image/png" }));
  duplicateForm.append("kind", "image");
  duplicateForm.append("kind", "image");
  duplicateForm.append("isPublic", "false");
  const duplicateResponse = await route.POST(new Request(`${SITE_ORIGIN}/api/assets`, {
    method: "POST",
    headers: new Headers({ Origin: SITE_ORIGIN, "Sec-Fetch-Site": "same-origin" }),
    body: duplicateForm,
  }));
  assert.equal(duplicateResponse.status, 400);

  const oversizedForm = new FormData();
  oversizedForm.append("file", new File([PNG_BYTES], "oversized.png", { type: "image/png" }));
  oversizedForm.append("kind", "image");
  const oversizedResponse = await route.POST(new Request(`${SITE_ORIGIN}/api/assets`, {
    method: "POST",
    headers: new Headers({
      Origin: SITE_ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      "Content-Length": String(16 * 1024 * 1024),
    }),
    body: oversizedForm,
  }));
  assert.equal(oversizedResponse.status, 400);
  assert.equal(harness.d1.database.prepare("SELECT COUNT(*) AS total FROM content_assets").get().total, 0);

  const valid = await jsonBody(await uploadAsset(route, {
    name: "private.png",
    type: "image/png",
    bytes: PNG_BYTES,
    kind: "image",
  }));
  assert.equal(valid.response.status, 201);
  const id = valid.body.asset.id;
  setIdentity("owner");
  const visibilityPatch = await jsonBody(await route.PATCH(new Request(`${SITE_ORIGIN}/api/assets?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: writeHeaders(undefined),
    body: JSON.stringify({ isPublic: true }),
  })));
  assert.equal(visibilityPatch.response.status, 400);
  assert.equal(assetRow(harness.d1, id).is_public, 0);
  assert.equal((await callAsset(route, { id, identity: "anonymous" })).status, 403);
  assert.equal((await callAsset(route, { method: "DELETE", id })).status, 200);
});

test("the complete allowed MIME and extension matrix uploads privately and can be cleaned up", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { assets: route } = harness.routes;
  const validFiles = [
    ["image", "photo.jpg", "image/jpeg", JPEG_BYTES],
    ["image", "photo.jpeg", "image/jpeg", JPEG_BYTES],
    ["image", "cover.png", "image/png", PNG_BYTES],
    ["image", "cover.webp", "image/webp", WEBP_BYTES],
    ["image", "cover.gif", "image/gif", GIF_BYTES],
    ["document", "certificate.pdf", "application/pdf", PDF_BYTES],
    ["document", "certificate.jpg", "image/jpeg", JPEG_BYTES],
    ["document", "certificate.png", "image/png", PNG_BYTES],
  ];

  for (const [kind, name, type, bytes] of validFiles) {
    const upload = await jsonBody(await uploadAsset(route, { kind, name, type, bytes }));
    assert.equal(upload.response.status, 201, `${kind} ${type} should upload`);
    assert.equal(upload.body.asset.kind, kind);
    assert.equal(upload.body.asset.contentType, type);
    assert.equal(upload.body.asset.isPublic, false);
    assert.equal(upload.body.asset.lifecycleState, "pending");
    assert.equal((await callAsset(route, { id: upload.body.asset.id, identity: "anonymous" })).status, 403);
    assert.equal((await callAsset(route, { id: upload.body.asset.id, identity: "owner" })).status, 200);
    assert.equal((await callAsset(route, { method: "DELETE", id: upload.body.asset.id })).status, 200);
  }
  assert.equal(harness.d1.database.prepare("SELECT COUNT(*) AS total FROM content_assets").get().total, 0);
  assert.equal(harness.r2.objects.size, 0);
});

test("asset references enforce owner, kind and single editorial attachment", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { content: contentRoute, assets: assetRoute } = harness.routes;
  let result = await jsonBody(await callContent(contentRoute, { path: "/api/content?editor=1" }));
  let version = result.body.version;

  const imageUpload = await jsonBody(await uploadAsset(assetRoute, {
    name: "reference.png",
    type: "image/png",
    bytes: PNG_BYTES,
    kind: "image",
  }));
  const documentUpload = await jsonBody(await uploadAsset(assetRoute, {
    name: "reference.pdf",
    type: "application/pdf",
    bytes: PDF_BYTES,
    kind: "document",
  }));
  const imageId = imageUpload.body.asset.id;
  const documentId = documentUpload.body.asset.id;

  let invalid = await jsonBody(await callContent(contentRoute, {
    method: "POST",
    body: {
      collection: "projects",
      item: { ...structuredClone(temporaryItems.projects), coverAssetId: documentId },
    },
    version,
  }));
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.body.error, /tipo/i);
  assert.equal(contentRow(harness.d1).version, version);
  assert.equal(assetRow(harness.d1, documentId).lifecycle_state, "pending");

  invalid = await jsonBody(await callContent(contentRoute, {
    method: "POST",
    body: {
      collection: "learning",
      item: { ...structuredClone(temporaryItems.learning), documentAssetId: imageId },
    },
    version,
  }));
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.body.error, /tipo/i);
  assert.equal(contentRow(harness.d1).version, version);

  result = await jsonBody(await callContent(contentRoute, {
    method: "POST",
    body: {
      collection: "projects",
      item: {
        ...structuredClone(temporaryItems.projects),
        title: "Projeto proprietário da referência",
        coverAssetId: imageId,
        editorialStatus: "published",
      },
    },
    version,
  }));
  assert.equal(result.response.status, 201);
  version = result.body.version;
  const project = result.body.content.projects.find(({ title }) => title === "Projeto proprietário da referência");

  invalid = await jsonBody(await callContent(contentRoute, {
    method: "POST",
    body: {
      collection: "questions",
      item: {
        ...structuredClone(temporaryItems.questions),
        title: "Pergunta tentando reutilizar referência",
        coverAssetId: imageId,
      },
    },
    version,
  }));
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.body.error, /só pode ser vinculado/i);
  assert.equal(contentRow(harness.d1).version, version);

  const foreignId = "00000000-0000-4000-8000-000000000099";
  harness.d1.database.prepare(`INSERT INTO content_assets
    (id, owner_user_id, object_key, kind, file_name, content_type, size, alt_text, is_public, lifecycle_state, updated_at)
    VALUES (?, 'other-owner', ?, 'image', 'foreign.png', 'image/png', ?, '', 0, 'pending', CURRENT_TIMESTAMP)`)
    .run(foreignId, `assets/${foreignId}.png`, PNG_BYTES.byteLength);
  await harness.r2.put(`assets/${foreignId}.png`, PNG_BYTES.buffer, {
    customMetadata: { assetId: foreignId, kind: "image", sha256: "legacy" },
  });
  invalid = await jsonBody(await callContent(contentRoute, {
    method: "PATCH",
    path: `/api/content?collection=projects&id=${encodeURIComponent(project.id)}`,
    body: { coverAssetId: foreignId },
    version,
  }));
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.body.error, /não pertence/i);
  assert.equal(contentRow(harness.d1).version, version);
  assert.equal(assetRow(harness.d1, imageId).is_public, 1);

  result = await jsonBody(await callContent(contentRoute, {
    method: "DELETE",
    path: `/api/content?collection=projects&id=${encodeURIComponent(project.id)}`,
    version,
    contentType: undefined,
  }));
  assert.equal(result.response.status, 200);
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: imageId })).status, 200);
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: documentId })).status, 200);
});

test("D1 and R2 failures roll back or tombstone safely and remain retryable", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { content: contentRoute, assets: assetRoute } = harness.routes;
  let result = await jsonBody(await callContent(contentRoute, { path: "/api/content?editor=1" }));
  let version = result.body.version;

  harness.r2.failNextPut = true;
  const r2PutFailure = await expectedLoggedFailure(async () => jsonBody(await uploadAsset(assetRoute, {
    name: "r2-put-failure.png",
    type: "image/png",
    bytes: PNG_BYTES,
    kind: "image",
  })));
  assert.equal(r2PutFailure.response.status, 503);
  assert.equal(harness.d1.database.prepare("SELECT COUNT(*) AS total FROM content_assets").get().total, 0);
  assert.equal(harness.r2.objects.size, 0);

  harness.d1.failNext(/insert into "content_assets"/i);
  const d1InsertFailure = await expectedLoggedFailure(async () => jsonBody(await uploadAsset(assetRoute, {
    name: "d1-insert-failure.png",
    type: "image/png",
    bytes: PNG_BYTES,
    kind: "image",
  })));
  assert.equal(d1InsertFailure.response.status, 503);
  assert.equal(harness.d1.database.prepare("SELECT COUNT(*) AS total FROM content_assets").get().total, 0);
  assert.equal(harness.r2.objects.size, 0);

  const batchUpload = await jsonBody(await uploadAsset(assetRoute, {
    name: "batch-rollback.png",
    type: "image/png",
    bytes: PNG_BYTES,
    kind: "image",
  }));
  assert.equal(batchUpload.response.status, 201);
  const batchAssetId = batchUpload.body.asset.id;
  harness.d1.failNext(/UPDATE content_assets/i);
  const failedAssociation = await expectedLoggedFailure(async () => jsonBody(await callContent(contentRoute, {
    method: "POST",
    body: {
      collection: "projects",
      item: {
        ...structuredClone(temporaryItems.projects),
        title: "Projeto com batch interrompido",
        coverAssetId: batchAssetId,
        editorialStatus: "published",
      },
    },
    version,
  })));
  assert.equal(failedAssociation.response.status, 503);
  assert.equal(contentRow(harness.d1).version, version, "content update must roll back with asset reconciliation");
  assert.equal(contentRow(harness.d1).content.projects.some(({ title }) => title === "Projeto com batch interrompido"), false);
  assert.deepEqual({
    state: assetRow(harness.d1, batchAssetId).lifecycle_state,
    isPublic: assetRow(harness.d1, batchAssetId).is_public,
  }, { state: "pending", isPublic: 0 });
  assert.equal((await callAsset(assetRoute, { id: batchAssetId, identity: "anonymous" })).status, 403);
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: batchAssetId })).status, 200);

  const staleUpload = await jsonBody(await uploadAsset(assetRoute, {
    name: "stale-association.png",
    type: "image/png",
    bytes: PNG_BYTES,
    kind: "image",
  }));
  const staleId = staleUpload.body.asset.id;
  const staleAssociation = await jsonBody(await callContent(contentRoute, {
    method: "POST",
    body: {
      collection: "questions",
      item: {
        ...structuredClone(temporaryItems.questions),
        title: "Pergunta com versão obsoleta",
        coverAssetId: staleId,
        editorialStatus: "published",
      },
    },
    version: version + 10,
  }));
  assert.equal(staleAssociation.response.status, 409);
  assert.equal(contentRow(harness.d1).version, version);
  assert.equal(assetRow(harness.d1, staleId).lifecycle_state, "pending");
  assert.equal(assetRow(harness.d1, staleId).is_public, 0);
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: staleId })).status, 200);

  const deleteUpload = await jsonBody(await uploadAsset(assetRoute, {
    name: "delete-retry.png",
    type: "image/png",
    bytes: PNG_BYTES,
    kind: "image",
  }));
  const deleteId = deleteUpload.body.asset.id;
  const deleteKey = assetRow(harness.d1, deleteId).object_key;
  harness.r2.failNextDelete = true;
  const failedR2Delete = await expectedLoggedFailure(async () => jsonBody(await callAsset(assetRoute, { method: "DELETE", id: deleteId })));
  assert.equal(failedR2Delete.response.status, 503);
  assert.equal(assetRow(harness.d1, deleteId).lifecycle_state, "deleting");
  assert.equal(assetRow(harness.d1, deleteId).is_public, 0);
  assert.ok(harness.r2.objects.has(deleteKey));
  assert.equal((await callAsset(assetRoute, { id: deleteId })).status, 409);
  assert.equal((await callAsset(assetRoute, { id: deleteId, identity: "anonymous" })).status, 403);
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: deleteId })).status, 200);
  assert.equal(assetRow(harness.d1, deleteId), null);
  assert.equal(harness.r2.objects.has(deleteKey), false);

  const metadataDeleteUpload = await jsonBody(await uploadAsset(assetRoute, {
    name: "metadata-delete-retry.png",
    type: "image/png",
    bytes: PNG_BYTES,
    kind: "image",
  }));
  const metadataDeleteId = metadataDeleteUpload.body.asset.id;
  const metadataDeleteKey = assetRow(harness.d1, metadataDeleteId).object_key;
  harness.d1.failNext(/delete from "content_assets"/i);
  const failedMetadataDelete = await expectedLoggedFailure(async () => jsonBody(await callAsset(assetRoute, { method: "DELETE", id: metadataDeleteId })));
  assert.equal(failedMetadataDelete.response.status, 503);
  assert.equal(assetRow(harness.d1, metadataDeleteId).lifecycle_state, "deleting");
  assert.equal(harness.r2.objects.has(metadataDeleteKey), false);
  assert.equal((await callAsset(assetRoute, { method: "DELETE", id: metadataDeleteId })).status, 200);
  assert.equal(assetRow(harness.d1, metadataDeleteId), null);
});

test("asset byte integrity and public metadata fail closed", async (context) => {
  const harness = await createBackendHarness();
  context.after(() => harness.d1.close());
  const { content: contentRoute, assets: assetRoute } = harness.routes;
  let result = await jsonBody(await callContent(contentRoute, { path: "/api/content?editor=1" }));
  let version = result.body.version;
  const upload = await jsonBody(await uploadAsset(assetRoute, {
    name: "integrity.png",
    type: "image/png",
    bytes: PNG_BYTES,
    kind: "image",
    altText: "Capa de integridade",
  }));
  const id = upload.body.asset.id;
  result = await jsonBody(await callContent(contentRoute, {
    method: "POST",
    body: {
      collection: "questions",
      item: {
        ...structuredClone(temporaryItems.questions),
        title: "Pergunta de integridade",
        coverAssetId: id,
        editorialStatus: "published",
      },
    },
    version,
  }));
  assert.equal(result.response.status, 201);
  version = result.body.version;

  const publicMetadata = await jsonBody(await callAsset(assetRoute, { id, metadata: true, identity: "anonymous" }));
  assert.equal(publicMetadata.response.status, 200);
  assert.deepEqual(Object.keys(publicMetadata.body.asset).sort(), [
    "altText",
    "contentType",
    "createdAt",
    "fileName",
    "id",
    "isPublic",
    "kind",
    "referenced",
    "size",
  ]);
  assert.equal(publicMetadata.body.asset.isPublic, true);
  assert.equal(publicMetadata.body.asset.referenced, true);

  const row = assetRow(harness.d1, id);
  const stored = harness.r2.objects.get(row.object_key);
  stored.customMetadata.sha256 = "0".repeat(64);
  const checksumFailure = await expectedLoggedFailure(async () => jsonBody(await callAsset(assetRoute, { id, identity: "anonymous" })));
  assert.equal(checksumFailure.response.status, 503);
  assert.match(checksumFailure.body.error, /integridade/i);

  stored.customMetadata.sha256 = row.checksum_sha256;
  stored.bytes = Uint8Array.from([...stored.bytes, 0x01]);
  const sizeFailure = await expectedLoggedFailure(async () => jsonBody(await callAsset(assetRoute, { id, identity: "anonymous" })));
  assert.equal(sizeFailure.response.status, 503);
  assert.match(sizeFailure.body.error, /integridade/i);

  harness.r2.objects.delete(row.object_key);
  const missingObject = await jsonBody(await callAsset(assetRoute, { id, identity: "anonymous" }));
  assert.equal(missingObject.response.status, 404);
  assert.equal(assetRow(harness.d1, id).lifecycle_state, "linked", "metadata remains available for reconciliation/retry");
  assert.equal(assetRow(harness.d1, id).is_public, 1, "authorization still requires the current published reference");
});
