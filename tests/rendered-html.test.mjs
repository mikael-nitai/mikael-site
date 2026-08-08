import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the personal site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Mikael — Física, Astrofísica e aprendizagem<\/title>/i);
  assert.match(html, /Bacharelado em Física/i);
  assert.match(html, /Um espaço pessoal para registrar/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
});

test("the starter loading surface is removed from the product", async () => {
  const [page, layout, packageJson, stylesheet] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(stylesheet, /grid-auto-flow:\s*dense/);
  assert.match(stylesheet, /prefers-reduced-motion/);
});

test("direct public routes render the site shell", async () => {
  const response = await render("/contato");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Mikael/);
});
