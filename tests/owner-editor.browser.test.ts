import { expect, test, type Page } from "@playwright/test";
import { startOwnerHarness } from "./support/owner-harness";

async function startOwnerPage(page: Page) {
  await startOwnerHarness(page);
}

test.describe("owner editor interactions", () => {
  test("creates and publishes an item through the contextual editor", async ({ page }) => {
    await startOwnerPage(page);
    const writes: Array<Record<string, unknown>> = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/content") {
        writes.push(request.postDataJSON() as Record<string, unknown>);
      }
    });

    await page.getByRole("button", { name: "Adicionar projeto" }).click();
    const dialog = page.getByRole("dialog", { name: "Adicionar projeto" });
    await dialog.getByRole("textbox", { name: "Título" }).fill("Projeto de teste automatizado");
    await dialog.getByRole("textbox", { name: "Descrição curta" }).fill("Item temporário criado apenas no estado em memória do navegador.");
    await dialog.getByRole("button", { name: "Publicar" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Alteração salva.", { exact: true })).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      collection: "projects",
      item: { title: "Projeto de teste automatizado", editorialStatus: "published" },
    });
  });

  test("sends the loaded version and keeps stale edits open on conflict", async ({ page }) => {
    await startOwnerPage(page);
    const edit = page.getByRole("button", { name: "Editar botão" }).first();
    await edit.click();
    const field = page.getByRole("textbox", { name: "Editar botão" });
    await field.fill("Mudança concorrente temporária");

    await page.route("**/api/content?collection=home&id=primary", async (route) => {
      expect(route.request().headers()["if-match"]).toBe('"1"');
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "O conteúdo foi alterado em outra sessão. Recarregue antes de salvar novamente." }),
      });
    }, { times: 1 });

    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("alterado em outra sessão");
    await expect(field).toBeVisible();
    await expect(field).toBeEditable();
    await expect(field).toHaveValue("Mudança concorrente temporária");
  });

  test("inline CTA editing is outside the link and supports cancel and save errors", async ({ page }) => {
    await startOwnerPage(page);
    const edit = page.getByRole("button", { name: "Editar botão" }).first();
    const link = page.getByRole("link", { name: /Abrir espelho/ });
    await expect(edit).toBeVisible();
    expect(await edit.evaluate((element) => Boolean(element.closest("a")))).toBe(false);

    await edit.click();
    const field = page.getByRole("textbox", { name: "Editar botão" });
    await expect(field).toBeFocused();
    await field.fill("Mudança temporária");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(link).toBeVisible();
    await expect(field).toHaveCount(0);

    await edit.click();
    await field.fill("Mudança temporária");
    await page.route("**/api/content?collection=home&id=primary", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Falha simulada de salvamento." }) });
      } else await route.continue();
    }, { times: 1 });
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Falha simulada de salvamento");
    await expect(field).toBeFocused();
    await expect(page).toHaveURL(/\/?edit=1$/);
  });

  test("drawer moves, traps and restores focus and closes with Escape", async ({ page }) => {
    await startOwnerPage(page);
    const opener = page.getByRole("button", { name: "Editar", exact: true }).first();
    await opener.focus();
    await opener.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("aria-describedby", /editor-drawer-description/);
    await expect(dialog.getByRole("textbox").first()).toBeFocused();

    const escaped = await dialog.evaluate((element) => {
      const active = document.activeElement;
      return Boolean(active && !element.contains(active));
    });
    expect(escaped).toBe(false);
    for (let index = 0; index < 24; index += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("hide is reversible and permanent deletion is a distinct confirmed action", async ({ page }) => {
    await startOwnerPage(page);
    const opener = page.getByRole("button", { name: "Editar", exact: true }).first();
    const requests: Array<{ method: string; body: unknown }> = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/content?collection=") && ["PATCH", "DELETE"].includes(request.method())) {
        requests.push({ method: request.method(), body: request.postData() ? request.postDataJSON() : null });
      }
    });

    await opener.click();
    await page.getByRole("button", { name: "Ocultar", exact: true }).click();
    await expect(page.getByText(/Item ocultado/)).toBeVisible();
    expect(requests.at(-1)).toMatchObject({ method: "PATCH", body: { editorialStatus: "hidden" } });

    const hiddenOpener = page.getByRole("button", { name: "Editar", exact: true }).first();
    await hiddenOpener.click();
    await page.getByRole("button", { name: "Restaurar como rascunho" }).click();
    await expect(page.getByText(/Item restaurado como rascunho/)).toBeVisible();
    expect(requests.at(-1)).toMatchObject({ method: "PATCH", body: { editorialStatus: "draft" } });

    await page.getByRole("button", { name: "Editar", exact: true }).first().click();
    await page.getByText("Exclusão permanente", { exact: true }).click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Excluir permanentemente" }).click();
    expect(requests.some(({ method }) => method === "DELETE")).toBe(false);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Excluir permanentemente" }).click();
    await expect(page.getByText(/Item excluído permanentemente/)).toBeVisible();
    expect(requests.at(-1)?.method).toBe("DELETE");
  });
});
