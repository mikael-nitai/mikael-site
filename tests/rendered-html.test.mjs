import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

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

test("the production client stays inside explicit payload regression budgets", async () => {
  const chunkDirectory = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const cssDirectory = new URL("../dist/client/_next/static/css/", import.meta.url);
  const [chunkNames, cssNames, portrait] = await Promise.all([
    readdir(chunkDirectory),
    readdir(cssDirectory),
    stat(new URL("../dist/client/mikael-portrait.webp", import.meta.url)),
  ]);
  const javascript = await Promise.all(
    chunkNames.filter((name) => name.endsWith(".js")).map((name) => stat(new URL(name, chunkDirectory))),
  );
  const stylesheets = await Promise.all(
    cssNames.filter((name) => name.endsWith(".css")).map((name) => stat(new URL(name, cssDirectory))),
  );
  const javascriptBytes = javascript.reduce((total, file) => total + file.size, 0);
  const cssBytes = stylesheets.reduce((total, file) => total + file.size, 0);

  assert.ok(javascriptBytes < 650_000, `client JavaScript grew to ${javascriptBytes} bytes`);
  assert.ok(Math.max(...javascript.map((file) => file.size)) < 225_000, "a client JavaScript chunk exceeded 225 kB");
  assert.ok(cssBytes < 75_000, `client CSS grew to ${cssBytes} bytes`);
  assert.ok(portrait.size < 150_000, `portrait grew to ${portrait.size} bytes`);
});
