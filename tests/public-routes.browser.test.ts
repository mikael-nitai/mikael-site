import { expect, test, type Page, type TestInfo } from "@playwright/test";

const routeCases = [
  { path: "/", heading: "Mikael", title: "Mikael — Física, Astrofísica e aprendizagem" },
  { path: "/sobre", heading: "Uma formação em andamento, vista de perto.", title: "Sobre — Mikael" },
  { path: "/trajetoria", heading: "Um caminho que ainda está começando.", title: "Trajetória — Mikael" },
  { path: "/projetos", heading: "A estrutura está pronta para receber trabalho real.", title: "Projetos — Mikael" },
  { path: "/caderno", heading: "Notas pequenas para não perder o fio.", title: "Caderno — Mikael" },
  { path: "/formacao", heading: "Um índice para cursos, atividades e certificados.", title: "Formação complementar — Mikael" },
  { path: "/contato", heading: "Um canal público entra aqui quando estiver definido.", title: "Contato — Mikael" },
] as const;

const viewportCases = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "wide-1600", width: 1600, height: 1000 },
] as const;

type BrowserIssues = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
};

function collectBrowserIssues(page: Page): BrowserIssues {
  const issues: BrowserIssues = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      issues.consoleErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => issues.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/cdn-cgi/")) return;
    const failure = request.failure()?.errorText ?? "failed";
    // Vinext may abort an already-successful streamed RSC response once the
    // client transition has consumed it. The destination is asserted below;
    // all other failed application requests remain regression failures.
    if (failure === "net::ERR_ABORTED" && url.searchParams.has("_rsc") && request.headers()["rsc"] === "1") return;
    issues.failedRequests.push(`${request.method()} ${url.pathname}: ${failure}`);
  });
  return issues;
}

function expectCleanBrowser(issues: BrowserIssues) {
  expect(issues.consoleErrors, "browser console warnings/errors").toEqual([]);
  expect(issues.pageErrors, "uncaught browser exceptions").toEqual([]);
  expect(issues.failedRequests, "failed application requests").toEqual([]);
}

async function initialHtml(page: Page, path: string) {
  const response = await page.request.get(path, { headers: { accept: "text/html" } });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^text\/html\b/i);
  return response.text();
}

test.describe("server-rendered public routes", () => {
  for (const route of routeCases) {
    test(`${route.path} returns route-specific HTML, metadata and hydration`, async ({ page }) => {
      const html = await initialHtml(page, route.path);
      expect(html).toContain(route.heading);
      expect(html).toContain(`<title>${route.title}</title>`);
      if (route.path !== "/") {
        expect(html).not.toMatch(/<h1[^>]*>\s*Mikael\s*<\/h1>/i);
      }

      const issues = collectBrowserIssues(page);
      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      await expect(page).toHaveTitle(route.title);
      expect(await page.locator("h1").count()).toBe(1);
      const headingLevels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((headings) => (
        headings.map((heading) => Number(heading.tagName.slice(1)))
      ));
      expect(headingLevels[0]).toBe(1);
      for (let index = 1; index < headingLevels.length; index += 1) {
        expect(headingLevels[index], `heading ${index + 1} in ${route.path} must not skip a level`)
          .toBeLessThanOrEqual(headingLevels[index - 1] + 1);
      }

      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      expectCleanBrowser(issues);
    });
  }

  test("unknown routes are genuine 404 responses", async ({ request }) => {
    for (const path of ["/nao-existe", "/projetos/item-inexistente"]) {
      const response = await request.get(path, { headers: { accept: "text/html" } });
      expect(response.status(), path).toBe(404);
    }
  });
});

test.describe("responsive public surface", () => {
  for (const viewport of viewportCases) {
    test(`${viewport.name} has no horizontal overflow or missing image text alternatives`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const issues = collectBrowserIssues(page);
      await page.goto("/", { waitUntil: "networkidle" });

      const audit = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        missingAlt: [...document.images].filter((image) => !image.hasAttribute("alt")).length,
        h1Count: document.querySelectorAll("h1").length,
      }));
      expect(audit.overflow).toBeLessThanOrEqual(0);
      expect(audit.missingAlt).toBe(0);
      expect(audit.h1Count).toBe(1);
      expectCleanBrowser(issues);
    });
  }
});

test.describe("navigation and anonymous editor gate", () => {
  test("internal navigation supports click, back/forward and a modifier-openable anchor", async ({ page, context }) => {
    const issues = collectBrowserIssues(page);
    await page.goto("/", { waitUntil: "networkidle" });

    await page.getByRole("link", { name: "Ver projetos" }).click();
    await expect(page).toHaveURL(/\/projetos$/);
    await expect(page.getByRole("heading", { level: 1, name: routeCases[3].heading })).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.goBack({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/$/);
    await page.goForward({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/projetos$/);

    const href = await page.getByRole("link", { name: "Voltar ao início" }).getAttribute("href");
    expect(href).toBe("/");
    const newTab = await context.newPage();
    await newTab.goto(href!, { waitUntil: "networkidle" });
    await expect(newTab.getByRole("heading", { level: 1, name: "Mikael" })).toBeVisible();
    await newTab.close();
    expectCleanBrowser(issues);
  });

  for (const activation of ["mouse", "keyboard"] as const) {
    test(`Editar site reaches the anonymous /edit gate by ${activation}`, async ({ page }) => {
      const issues = collectBrowserIssues(page);
      await page.goto("/", { waitUntil: "networkidle" });
      const entry = page.getByRole("link", { name: "Editar site" });
      await expect(entry).toHaveAttribute("href", "/edit");
      if (activation === "mouse") await entry.click();
      else {
        await entry.focus();
        await page.keyboard.press("Enter");
      }

      await expect(page).toHaveURL(/\/edit$/);
      await expect(page.getByRole("heading", { level: 1, name: "Entre para editar o site." })).toBeVisible();
      await expect(page.getByRole("link", { name: "Entrar com ChatGPT" })).toHaveAttribute(
        "href",
        /\/signin-with-chatgpt\?return_to=%2Fedit/,
      );
      expectCleanBrowser(issues);
    });
  }

  test("anonymous editor gate returns to the public site", async ({ page }) => {
    const issues = collectBrowserIssues(page);
    await page.goto("/edit", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Voltar ao site" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Mikael" })).toBeVisible();
    expectCleanBrowser(issues);
  });
});

test.describe("document structure", () => {
  test("does not nest interactive controls", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    expect(await page.locator("a button, button a, a input, a textarea, button input, button textarea").count()).toBe(0);
  });

  test("the interest marquee exposes only one semantic copy", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const tracks = page.locator(".marquee-track");
    await expect(tracks).toHaveCount(1);
    const text = (await tracks.innerText()).trim();
    expect(text.length).toBeGreaterThan(0);
    await expect(tracks).toHaveAttribute("aria-hidden", "true");
    const semanticList = page.locator(".interest-marquee .sr-only");
    await expect(semanticList).toHaveCount(1);
    await expect(semanticList).toContainText("Física");
  });
});

test.describe("mobile menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("closed links are unfocusable; Escape, outside click and navigation close the menu", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const toggle = page.locator(".menu-toggle");
    const nav = page.locator("#mobile-navigation");

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(nav).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", { name: "Sobre" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();

    await toggle.click();
    await page.locator("main").click({ position: { x: 10, y: 400 } });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await nav.getByRole("link", { name: "Sobre" }).click();
    await expect(page).toHaveURL(/\/sobre$/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("motion policy", () => {
  test("reduced motion is honored before client scripts run", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      const records: string[] = [];
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          const element = mutation.target;
          if (!(element instanceof HTMLElement)) continue;
          if (!element.matches(".hero-reveal, .reveal, .image-reveal, .study-card-reveal")) continue;
          const style = element.getAttribute("style") ?? "";
          if (/opacity:\s*0(?:;|$)|translate\([^)]*26px|scale\(0\.|brightness\(0\./.test(style)) records.push(style);
        }
      });
      observer.observe(document, { subtree: true, attributes: true, attributeFilter: ["style"] });
      Object.defineProperty(window, "__motionAudit", { value: records });
    });

    const issues = collectBrowserIssues(page);
    await page.goto("/", { waitUntil: "networkidle" });
    const state = await page.evaluate(() => ({
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      violations: (window as Window & { __motionAudit?: string[] }).__motionAudit ?? [],
      marqueeAnimation: getComputedStyle(document.querySelector(".marquee-track")!).animationName,
      activeAnimations: document.getAnimations().filter((animation) => animation.playState === "running").length,
    }));
    expect(state.reduced).toBe(true);
    expect(state.violations).toEqual([]);
    expect(state.marqueeAnimation).toBe("none");
    expect(state.activeAnimations).toBe(0);
    expectCleanBrowser(issues);
  });
});

test.afterEach(async ({ page }, testInfo: TestInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  await testInfo.attach("url", { body: page.url(), contentType: "text/plain" });
});
