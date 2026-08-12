import { expect, test, type Locator, type Page } from "@playwright/test";
import type { EditableCollection } from "../content/editorial";
import { startOwnerHarness, type OwnerHarness } from "./support/owner-harness";

test.describe.configure({ timeout: 120_000 });

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const pdf = Buffer.from("%PDF-1.4\n% deterministic test document\n%%EOF", "utf8");

type CollectionCase = {
  collection: EditableCollection;
  path: string;
  addName: string;
  title: string;
  coverLabel?: string;
  fill: (dialog: Locator, title: string) => Promise<void>;
  edit: (dialog: Locator) => Promise<string | void>;
};

const collectionCases: CollectionCase[] = [
  {
    collection: "timeline",
    path: "/trajetoria",
    addName: "Adicionar marco",
    title: "Marco temporário da matriz",
    fill: async (dialog, title) => {
      await dialog.getByRole("textbox", { name: "Título" }).fill(title);
      await dialog.getByRole("textbox", { name: "Descrição curta" }).fill("Registro temporário para validar o fluxo completo da trajetória.");
      await dialog.getByRole("textbox", { name: "Categoria" }).fill("Teste editorial");
    },
    edit: async (dialog) => { await dialog.getByRole("textbox", { name: "Descrição curta" }).fill("Trajetória temporária revisada e salva novamente."); },
  },
  {
    collection: "projects",
    path: "/projetos",
    addName: "Adicionar projeto",
    title: "Projeto temporário da matriz",
    coverLabel: "Capa do projeto",
    fill: async (dialog, title) => {
      await dialog.getByRole("textbox", { name: "Título" }).fill(title);
      await dialog.getByRole("textbox", { name: "Descrição curta" }).fill("Projeto de teste criado somente na memória do navegador.");
      await dialog.getByText("Mais opções", { exact: true }).click();
      await dialog.getByRole("textbox", { name: "Tecnologias" }).fill("Teste, Playwright");
    },
    edit: async (dialog) => { await dialog.getByRole("textbox", { name: "Rótulo de status" }).fill("Revisado no teste"); },
  },
  {
    collection: "notes",
    path: "/caderno",
    addName: "Nova nota",
    title: "Nota temporária da matriz",
    coverLabel: "Imagem de capa",
    fill: async (dialog, title) => {
      await dialog.getByRole("textbox", { name: "Título" }).fill(title);
      await dialog.locator("[contenteditable='true']").fill("Texto temporário e suficientemente concreto para validar o post completo.");
      await dialog.getByText("Mais opções", { exact: true }).click();
      await dialog.getByRole("textbox", { name: "Tags" }).fill("teste, regressão");
    },
    edit: async (dialog) => { await dialog.getByRole("textbox", { name: "Área" }).fill("Área revisada no teste"); },
  },
  {
    collection: "learning",
    path: "/formacao",
    addName: "Adicionar formação",
    title: "Formação temporária da matriz",
    coverLabel: "Capa opcional",
    fill: async (dialog, title) => {
      await dialog.getByRole("textbox", { name: "Nome" }).fill(title);
      await dialog.getByRole("textbox", { name: "Instituição" }).fill("Contexto de teste, não publicado");
      await dialog.getByRole("textbox", { name: "Ano / período" }).fill("Temporário");
      await dialog.getByRole("textbox", { name: "Descrição" }).fill("Registro temporário usado apenas pela suíte E2E.");
    },
    edit: async (dialog) => { await dialog.getByRole("textbox", { name: "Horas" }).fill("Carga temporária revisada"); },
  },
  {
    collection: "questions",
    path: "/",
    addName: "Adicionar pergunta",
    title: "Pergunta temporária da matriz",
    coverLabel: "Imagem da pergunta",
    fill: async (dialog, title) => {
      await dialog.getByRole("textbox", { name: "Título da pergunta" }).fill(title);
      await dialog.getByRole("textbox", { name: "Texto da pergunta" }).fill("Como validar este fluxo sem persistir nenhum dado real?");
      await dialog.getByRole("textbox", { name: "Texto alternativo" }).fill("Imagem abstrata usada no teste");
    },
    edit: async (dialog) => { await dialog.getByRole("textbox", { name: "Texto da pergunta" }).fill("Pergunta revisada após recarregar a capa relativa."); },
  },
  {
    collection: "interests",
    path: "/",
    addName: "Adicionar interesse",
    title: "Interesse temporário da matriz",
    fill: async (dialog, title) => {
      await dialog.getByRole("textbox", { name: "Interesse" }).fill(title);
    },
    edit: async (dialog) => {
      const edited = "Interesse temporário revisado";
      await dialog.getByRole("textbox", { name: "Interesse" }).fill(edited);
      return edited;
    },
  },
  {
    collection: "contacts",
    path: "/contato",
    addName: "Adicionar contato",
    title: "Canal temporário da matriz",
    fill: async (dialog, title) => {
      await dialog.getByRole("textbox", { name: "Nome do canal" }).fill(title);
      await dialog.getByRole("textbox", { name: "Contato exibido" }).fill("Contato de teste não persistido");
      await dialog.getByRole("textbox", { name: "Nota curta" }).fill("Somente para regressão automatizada.");
    },
    edit: async (dialog) => { await dialog.getByRole("textbox", { name: "Nota curta" }).fill("Nota temporária revisada após refresh."); },
  },
];

function item(page: Page, title: string) {
  return page.locator(
    ".timeline-item, .project-mini-card, .project-large-card, .note-row, .learning-row, .study-card, .contact-card-entry, .interest-editor-item",
  ).filter({ hasText: title }).first();
}

function itemLabel(collection: EditableCollection, candidate: Record<string, unknown>) {
  if (collection === "interests") return String(candidate.value);
  if (collection === "contacts") return String(candidate.label);
  return String(candidate.title);
}

async function openItem(page: Page, title: string) {
  const container = item(page, title);
  await expect(container).toBeVisible();
  const edit = container.getByRole("button", { name: /^(Editar|Renomear)$/ }).first();
  await edit.click();
  return page.getByRole("dialog");
}

async function createPublished(page: Page, harness: OwnerHarness, entry: CollectionCase, title = entry.title, withCover = true) {
  await page.getByRole("button", { name: entry.addName, exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await entry.fill(dialog, title);
  if (entry.coverLabel && withCover) {
    await dialog.getByLabel(entry.coverLabel).setInputFiles({
      name: `${entry.collection}-cover.png`,
      mimeType: "image/png",
      buffer: png,
    });
  }
  await dialog.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Alteração salva.", { exact: true })).toBeVisible();

  const stored = harness.content()[entry.collection].find((candidate) => {
    if (entry.collection === "interests") return "value" in candidate && candidate.value === title;
    if (entry.collection === "contacts") return "label" in candidate && candidate.label === title;
    return "title" in candidate && candidate.title === title;
  });
  expect(stored).toMatchObject({ editorialStatus: "published" });
  return stored!;
}

test.describe("complete editorial collection matrix", () => {
  for (const entry of collectionCases) {
    test(`${entry.collection}: create, publish, reorder, refresh, hide, restore and delete`, async ({ page }) => {
      const harness = await startOwnerHarness(page, entry.path);
      const stored = await createPublished(page, harness, entry);
      let visibleTitle = entry.title;
      await expect(item(page, visibleTitle)).toBeVisible();

      const coverId = "coverAssetId" in stored && typeof stored.coverAssetId === "string" ? stored.coverAssetId : null;
      if (entry.coverLabel) {
        expect(coverId).toBeTruthy();
        expect(harness.assets.get(coverId!)).toMatchObject({
          kind: "image",
          isPublic: true,
          referenced: true,
          lifecycleState: "linked",
        });
      }

      const reorderedTitle = `Auxiliar de ordem: ${entry.collection}`;
      const reorderedItem = await createPublished(page, harness, entry, reorderedTitle, false);
      const idsBeforeReorder = harness.content()[entry.collection].map((candidate) => candidate.id);
      expect(idsBeforeReorder.at(-1)).toBe(reorderedItem.id);
      const reorderRequestStart = harness.requests.length;
      const moveUp = item(page, reorderedTitle).getByRole("button", { name: `Mover ${reorderedTitle} para cima`, exact: true });
      await expect(moveUp).toBeEnabled();
      await Promise.all([
        page.waitForResponse((response) => response.url().endsWith("/api/content") && response.request().method() === "PUT"),
        moveUp.click(),
      ]);
      await expect(page.getByText("Ordem atualizada.", { exact: true })).toBeVisible();
      const idsAfterReorder = harness.content()[entry.collection].map((candidate) => candidate.id);
      expect(idsAfterReorder.indexOf(reorderedItem.id)).toBe(idsBeforeReorder.indexOf(reorderedItem.id) - 1);
      const reorderRequest = harness.requests.slice(reorderRequestStart)
        .find((request) => request.method === "PUT" && request.path === "/api/content");
      expect(reorderRequest?.body).toMatchObject({ collection: entry.collection, orderedIds: idsAfterReorder });
      expect(new Set(idsAfterReorder).size).toBe(idsAfterReorder.length);
      expect([...idsAfterReorder].sort()).toEqual([...idsBeforeReorder].sort());

      await harness.reloadEditor();
      expect(harness.content()[entry.collection].map((candidate) => candidate.id)).toEqual(idsAfterReorder);
      const orderedEntries = harness.content()[entry.collection] as Array<Record<string, unknown> & { id: string }>;
      const firstLabel = itemLabel(entry.collection, orderedEntries[0]);
      const lastLabel = itemLabel(entry.collection, orderedEntries.at(-1)!);
      await expect(page.getByRole("button", {
        name: `Mover ${firstLabel} para cima`,
        exact: true,
      })).toBeDisabled();
      await expect(page.getByRole("button", {
        name: `Mover ${lastLabel} para baixo`,
        exact: true,
      })).toBeDisabled();
      if (entry.collection !== "interests") {
        await expect(item(page, reorderedTitle).getByRole("group", {
          name: new RegExp(`^Reordenar ${reorderedTitle}, posição \\d+ de ${idsAfterReorder.length}$`),
        })).toBeVisible();
      }
      const visitorContentForOrder = page.waitForResponse((response) => response.url().endsWith("/api/content") && response.request().method() === "GET");
      await page.getByRole("button", { name: "Visualizar como visitante" }).click();
      await visitorContentForOrder;
      await expect(page.getByRole("button", { name: `Mover ${reorderedTitle} para cima`, exact: true })).toHaveCount(0);

      await harness.reloadEditor();
      await expect(item(page, visibleTitle)).toBeVisible();

      let dialog = await openItem(page, visibleTitle);
      visibleTitle = (await entry.edit(dialog)) ?? visibleTitle;
      await dialog.getByRole("button", { name: "Publicar", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await harness.reloadEditor();
      await expect(item(page, visibleTitle)).toBeVisible();

      dialog = await openItem(page, visibleTitle);
      await dialog.getByRole("button", { name: "Ocultar", exact: true }).click();
      await expect(page.getByText(/Item ocultado/)).toBeVisible();
      expect(harness.content()[entry.collection].find((candidate) => candidate.id === stored.id)).toMatchObject({ editorialStatus: "hidden" });
      if (coverId) expect(harness.assets.get(coverId)?.isPublic).toBe(false);

      dialog = await openItem(page, visibleTitle);
      const hiddenState = dialog.getByRole("combobox", { name: "Visibilidade" });
      await expect(hiddenState).toHaveValue("hidden");
      visibleTitle = (await entry.edit(dialog)) ?? visibleTitle;
      await dialog.getByRole("button", { name: "Salvar mantendo oculto", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect(harness.content()[entry.collection].find((candidate) => candidate.id === stored.id)).toMatchObject({ editorialStatus: "hidden" });

      const visitorContent = page.waitForResponse((response) => response.url().endsWith("/api/content") && response.request().method() === "GET");
      await page.getByRole("button", { name: "Visualizar como visitante" }).click();
      await visitorContent;
      await expect(page.getByText(visibleTitle, { exact: true })).toHaveCount(0);
      await harness.reloadEditor();

      dialog = await openItem(page, visibleTitle);
      await dialog.getByRole("button", { name: "Restaurar como rascunho" }).click();
      await expect(page.getByText(/Item restaurado como rascunho/)).toBeVisible();
      expect(harness.content()[entry.collection].find((candidate) => candidate.id === stored.id)).toMatchObject({ editorialStatus: "draft" });

      dialog = await openItem(page, visibleTitle);
      await dialog.getByText("Exclusão permanente", { exact: true }).click();
      const deletionRequestStart = harness.requests.length;
      page.once("dialog", (confirmation) => confirmation.accept());
      await dialog.getByRole("button", { name: "Excluir permanentemente" }).click();
      await expect(page.getByText(/Item excluído permanentemente/)).toBeVisible();
      expect(harness.content()[entry.collection].some((candidate) => candidate.id === stored.id)).toBe(false);
      if (coverId) {
        await expect.poll(() => harness.deletedAssetIds.includes(coverId)).toBe(true);
        expect(harness.assets.has(coverId)).toBe(false);
        const deletionRequests = harness.requests.slice(deletionRequestStart);
        expect(deletionRequests.findIndex((request) => request.method === "DELETE" && request.path.startsWith("/api/content?")))
          .toBeLessThan(deletionRequests.findIndex((request) => request.method === "DELETE" && request.path === `/api/assets?id=${coverId}`));
      }
    });
  }
});

async function editInline(page: Page, label: string, value: string, occurrence = 0) {
  const trigger = page.getByRole("button", { name: label, exact: true }).nth(occurrence);
  await trigger.click();
  const field = page.getByRole("textbox", { name: label, exact: true }).nth(occurrence);
  await expect(field).toBeFocused();
  await field.fill(value);
  await field.locator("xpath=ancestor::form[1]").getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(field).toHaveCount(0);
}

test.describe("identity, page copy and CTA matrix", () => {
  test("all identity fields save and survive an editor refresh", async ({ page }) => {
    const harness = await startOwnerHarness(page);
    const fields = [
      ["Editar função", "Função temporária de teste"],
      ["Editar localização", "Local temporário de teste"],
      ["Editar nome", "Nome temporário de teste"],
      ["Editar apresentação", "Apresentação temporária usada somente na memória da suíte."],
    ] as const;
    for (const [label, value] of fields) await editInline(page, label, value);
    expect(harness.content().identity).toMatchObject({
      role: fields[0][1],
      location: fields[1][1],
      name: fields[2][1],
      description: fields[3][1],
    });
    await harness.reloadEditor();
    for (const [, value] of fields) await expect(page.locator("body")).toContainText(value);
  });

  for (const surface of [
    { name: "home CTA", path: "/", label: "Editar botão", value: "CTA temporário da matriz", expectedPath: "/api/content?collection=home&id=primary" },
    { name: "about copy", path: "/sobre", label: "Editar título", value: "Título temporário sobre", expectedPath: "/api/content?collection=about&id=primary" },
    { name: "contact copy", path: "/contato", label: "Editar introdução", value: "Introdução temporária para validar o contato.", expectedPath: "/api/content?collection=contact&id=primary" },
  ]) {
    test(`${surface.name} saves through its page contract and persists`, async ({ page }) => {
      const harness = await startOwnerHarness(page, surface.path);
      await editInline(page, surface.label, surface.value);
      expect(harness.requests.some((request) => request.method === "PATCH" && request.path === surface.expectedPath)).toBe(true);
      await harness.reloadEditor();
      await expect(page.locator("body")).toContainText(surface.value);
    });
  }
});

test.describe("certificate, document and upload lifecycle", () => {
  async function openLearning(page: Page, title: string) {
    await page.getByRole("button", { name: "Adicionar formação", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Nome" }).fill(title);
    await dialog.getByRole("textbox", { name: "Instituição" }).fill("Instituição temporária de teste");
    await dialog.getByRole("textbox", { name: "Ano / período" }).fill("Temporário");
    return dialog;
  }

  test("private PDF exposes owner metadata/preview but remains forbidden to a visitor", async ({ page }) => {
    const harness = await startOwnerHarness(page, "/formacao");
    const dialog = await openLearning(page, "Certificado privado temporário");
    await dialog.getByLabel("Certificado / documento (privado por padrão)").setInputFiles({
      name: "certificado-privado.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await dialog.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    const learning = harness.content().learning.find((entry) => entry.title === "Certificado privado temporário")!;
    const asset = harness.assets.get(learning.documentAssetId!)!;
    expect(learning.documentPublic).toBe(false);
    expect(asset).toMatchObject({ kind: "document", fileName: "certificado-privado.pdf", isPublic: false, referenced: true });
    const visitorStatus = await page.evaluate(async (id) => (await fetch(`/api/assets?id=${id}&metadata=1`, {
      headers: { "x-test-visitor": "1" },
    })).status, asset.id);
    expect(visitorStatus).toBe(403);

    await harness.reloadEditor();
    const editor = await openItem(page, "Certificado privado temporário");
    await editor.getByText("Mais opções e documentos", { exact: true }).click();
    await expect(editor.getByText("certificado-privado.pdf", { exact: true })).toBeVisible();
    await expect(editor.locator("iframe[title^='Prévia de']")).toHaveCount(1);
  });

  test("explicit confirmation publishes a document and revocation makes its old URL private", async ({ page }) => {
    const harness = await startOwnerHarness(page, "/formacao");
    let dialog = await openLearning(page, "Certificado público temporário");
    await dialog.getByLabel("Certificado / documento (privado por padrão)").setInputFiles({
      name: "certificado-publico.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await dialog.getByText("Mais opções e documentos", { exact: true }).click();
    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog.getByRole("checkbox", { name: "Tornar o documento público" }).check();
    await dialog.getByRole("button", { name: "Publicar", exact: true }).click();

    const learning = harness.content().learning.find((entry) => entry.title === "Certificado público temporário")!;
    const assetId = learning.documentAssetId!;
    expect(harness.assets.get(assetId)?.isPublic).toBe(true);
    expect(await page.evaluate(async (id) => (await fetch(`/api/assets?id=${id}&metadata=1`, {
      headers: { "x-test-visitor": "1" },
    })).status, assetId)).toBe(200);

    dialog = await openItem(page, learning.title);
    await dialog.getByRole("button", { name: "Ocultar", exact: true }).click();
    expect(harness.assets.get(assetId)?.isPublic).toBe(false);
    expect(await page.evaluate(async (id) => (await fetch(`/api/assets?id=${id}`, {
      headers: { "x-test-visitor": "1" },
    })).status, assetId)).toBe(403);
  });

  for (const failure of [
    { name: "invalid upload", status: 400, error: "O conteúdo do arquivo não corresponde ao tipo declarado." },
    { name: "storage failure", status: 503, error: "Não foi possível salvar o arquivo." },
  ]) {
    test(`${failure.name} keeps the draft open and does not create content`, async ({ page }) => {
      const harness = await startOwnerHarness(page, "/formacao");
      const title = `Certificado ${failure.name} temporário`;
      const dialog = await openLearning(page, title);
      await dialog.getByLabel("Certificado / documento (privado por padrão)").setInputFiles({
        name: "arquivo-invalido.pdf",
        mimeType: "application/pdf",
        buffer: pdf,
      });
      harness.rejectNextUpload(failure.status, failure.error);
      await dialog.getByRole("button", { name: "Publicar", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText(failure.error);
      await expect(dialog).toBeVisible();
      expect(harness.content().learning.some((entry) => entry.title === title)).toBe(false);
      expect(harness.assets.size).toBe(0);
    });
  }

  test("a successful upload is compensated when the following content save fails", async ({ page }) => {
    const harness = await startOwnerHarness(page, "/formacao");
    const dialog = await openLearning(page, "Certificado com falha D1 temporária");
    await dialog.getByLabel("Certificado / documento (privado por padrão)").setInputFiles({
      name: "compensacao.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await page.route("**/api/content", (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Falha D1 simulada após o upload." }),
    }), { times: 1 });
    await dialog.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Falha D1 simulada");
    await expect.poll(() => harness.deletedAssetIds.length).toBe(1);
    expect(harness.assets.size).toBe(0);
  });

  test("replacing and then removing a document cleans both superseded assets", async ({ page }) => {
    const harness = await startOwnerHarness(page, "/formacao");
    let dialog = await openLearning(page, "Certificado substituível temporário");
    await dialog.getByLabel("Certificado / documento (privado por padrão)").setInputFiles({
      name: "documento-antigo.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await dialog.getByRole("button", { name: "Salvar rascunho" }).click();
    const firstId = harness.content().learning.find((entry) => entry.title === "Certificado substituível temporário")!.documentAssetId!;

    dialog = await openItem(page, "Certificado substituível temporário");
    await dialog.getByText("Mais opções e documentos", { exact: true }).click();
    await dialog.getByLabel("Certificado / documento (privado por padrão)").setInputFiles({
      name: "documento-novo.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await dialog.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect.poll(() => harness.deletedAssetIds.includes(firstId)).toBe(true);
    const secondId = harness.content().learning.find((entry) => entry.title === "Certificado substituível temporário")!.documentAssetId!;
    expect(secondId).not.toBe(firstId);

    dialog = await openItem(page, "Certificado substituível temporário");
    await dialog.getByText("Mais opções e documentos", { exact: true }).click();
    await dialog.getByRole("button", { name: "Remover anexo" }).click();
    await dialog.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect.poll(() => harness.deletedAssetIds.includes(secondId)).toBe(true);
    expect(harness.content().learning.find((entry) => entry.title === "Certificado substituível temporário")!.documentAssetId).toBeNull();
  });

  test("permanent deletion waits for content success before cleaning cover and document", async ({ page }) => {
    const harness = await startOwnerHarness(page, "/formacao");
    let dialog = await openLearning(page, "Certificado completo para exclusão temporária");
    await dialog.getByText("Mais opções e documentos", { exact: true }).click();
    await dialog.getByLabel("Capa opcional").setInputFiles({ name: "capa-delete.png", mimeType: "image/png", buffer: png });
    await dialog.getByLabel("Certificado / documento (privado por padrão)").setInputFiles({ name: "documento-delete.pdf", mimeType: "application/pdf", buffer: pdf });
    await dialog.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => harness.content().learning.find((entry) => entry.title === "Certificado completo para exclusão temporária")).toBeTruthy();
    const stored = harness.content().learning.find((entry) => entry.title === "Certificado completo para exclusão temporária")!;
    const ids = [stored.coverAssetId!, stored.documentAssetId!];

    dialog = await openItem(page, stored.title);
    await dialog.getByText("Exclusão permanente", { exact: true }).click();
    const start = harness.requests.length;
    let failDeleteOnce = true;
    await page.route(`**/api/content?collection=learning&id=${stored.id}`, (route) => {
      if (route.request().method() !== "DELETE" || !failDeleteOnce) return route.fallback();
      failDeleteOnce = false;
      return route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "Conflito antes da exclusão." }),
      });
    });
    page.once("dialog", async (confirmation) => { await confirmation.accept(); });
    await Promise.all([
      page.waitForResponse((response) => response.url().includes(`/api/content?collection=learning&id=${stored.id}`) && response.request().method() === "DELETE"),
      dialog.getByRole("button", { name: "Excluir permanentemente" }).click(),
    ]);
    await expect(dialog.getByRole("alert")).toContainText("Conflito antes da exclusão");
    expect(harness.deletedAssetIds).toEqual([]);
    expect(ids.every((id) => harness.assets.has(id))).toBe(true);

    page.once("dialog", async (confirmation) => { await confirmation.accept(); });
    await dialog.getByRole("button", { name: "Excluir permanentemente" }).click();
    await expect.poll(() => ids.every((id) => harness.deletedAssetIds.includes(id))).toBe(true);
    const sequence = harness.requests.slice(start);
    const contentDelete = sequence.findIndex((request) => request.method === "DELETE" && request.path.startsWith("/api/content?"));
    const assetDeletes = ids.map((id) => sequence.findIndex((request) => request.method === "DELETE" && request.path === `/api/assets?id=${id}`));
    expect(contentDelete).toBeGreaterThanOrEqual(0);
    for (const assetDelete of assetDeletes) expect(assetDelete).toBeGreaterThan(contentDelete);
  });

  test("permanent deletion retries transient cleanup and reports the late success", async ({ page }) => {
    const harness = await startOwnerHarness(page, "/formacao");
    const title = "Certificado com retry de limpeza temporário";
    let dialog = await openLearning(page, title);
    await dialog.getByLabel("Certificado / documento (privado por padrão)").setInputFiles({
      name: "documento-retry.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await dialog.getByRole("button", { name: "Salvar rascunho" }).click();
    const stored = harness.content().learning.find((entry) => entry.title === title)!;
    const assetId = stored.documentAssetId!;
    harness.rejectAssetDeletes(assetId, 2);
    const requestStart = harness.requests.length;

    dialog = await openItem(page, title);
    await dialog.getByText("Exclusão permanente", { exact: true }).click();
    page.once("dialog", async (confirmation) => { await confirmation.accept(); });
    await dialog.getByRole("button", { name: "Excluir permanentemente" }).click();

    await expect(page.getByText(
      "Item excluído permanentemente; arquivos associados também foram removidos.",
      { exact: true },
    )).toBeVisible();
    await expect.poll(() => harness.requests.slice(requestStart).filter((request) => (
      request.method === "DELETE" && request.path === `/api/assets?id=${assetId}`
    )).length).toBe(3);
    expect(harness.content().learning.some((entry) => entry.id === stored.id)).toBe(false);
    expect(harness.deletedAssetIds).toContain(assetId);
    expect(harness.assets.has(assetId)).toBe(false);
  });

  test("three cleanup failures keep the orphan private and never claim removal", async ({ page }) => {
    const harness = await startOwnerHarness(page, "/formacao");
    const title = "Certificado com limpeza pendente temporário";
    let dialog = await openLearning(page, title);
    await dialog.getByLabel("Certificado / documento (privado por padrão)").setInputFiles({
      name: "documento-pendente.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
    await dialog.getByRole("button", { name: "Salvar rascunho" }).click();
    const stored = harness.content().learning.find((entry) => entry.title === title)!;
    const assetId = stored.documentAssetId!;
    harness.rejectAssetDeletes(assetId, 3);
    const requestStart = harness.requests.length;

    dialog = await openItem(page, title);
    await dialog.getByText("Exclusão permanente", { exact: true }).click();
    page.once("dialog", async (confirmation) => { await confirmation.accept(); });
    await dialog.getByRole("button", { name: "Excluir permanentemente" }).click();

    await expect(page.getByText(
      "Item excluído. Um arquivo permaneceu privado e requer nova tentativa de limpeza.",
      { exact: true },
    )).toBeVisible();
    expect(harness.requests.slice(requestStart).filter((request) => (
      request.method === "DELETE" && request.path === `/api/assets?id=${assetId}`
    ))).toHaveLength(3);
    expect(harness.content().learning.some((entry) => entry.id === stored.id)).toBe(false);
    expect(harness.deletedAssetIds).not.toContain(assetId);
    expect(harness.assets.get(assetId)).toMatchObject({
      isPublic: false,
      referenced: false,
      lifecycleState: "orphaned",
    });
    await expect(page.getByText(/arquivos associados também foram removidos/i)).toHaveCount(0);
  });
});

test("owner editing remains usable without horizontal overflow at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startOwnerHarness(page, "/trajetoria");
  await page.getByRole("button", { name: "Adicionar marco", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await dialog.getByRole("textbox", { name: "Título" }).fill("Marco mobile temporário");
  await dialog.getByRole("textbox", { name: "Descrição curta" }).fill("Fluxo mobile de teste.");
  await dialog.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Marco mobile temporário", { exact: true })).toBeVisible();
});
