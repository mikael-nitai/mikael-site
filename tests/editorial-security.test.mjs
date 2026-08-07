import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contentRoute = new URL("../app/api/content/route.ts", import.meta.url);
const assetsRoute = new URL("../app/api/assets/route.ts", import.meta.url);

test("content editor API guards private reads and every write", async () => {
  const source = await readFile(contentRoute, "utf8");
  assert.match(source, /wantsEditor && !\(await getOwnerChatGPTUser\(\)\)/);
  assert.ok((source.match(/if \(!\(await getOwnerChatGPTUser\(\)\)\)/g) ?? []).length >= 4);
  assert.match(source, /publicEditorContent\(content\)/);
});

test("asset API enforces owner writes and private object reads", async () => {
  const source = await readFile(assetsRoute, "utf8");
  assert.match(source, /getOwnerChatGPTUser/);
  assert.match(source, /!asset\.isPublic && !isOwnerUser\(user\)/);
  assert.match(source, /ownerUserId !== user\.userId/);
});
