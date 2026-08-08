import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { siteContent } from "../db/schema";
import {
  seedEditorContent,
  sortEditorContent,
  type EditorContent,
} from "../content/editorial";

const PRIMARY_CONTENT_ID = "primary";

export async function loadEditorContent(): Promise<EditorContent> {
  const db = getDb();
  let row = await db
    .select()
    .from(siteContent)
    .where(eq(siteContent.id, PRIMARY_CONTENT_ID))
    .get();

  if (!row) {
    const seed = seedEditorContent();
    await db.insert(siteContent).values({
      id: PRIMARY_CONTENT_ID,
      payload: JSON.stringify(seed),
    });
    row = await db
      .select()
      .from(siteContent)
      .where(eq(siteContent.id, PRIMARY_CONTENT_ID))
      .get();
  }

  if (!row) throw new Error("O conteúdo inicial não pôde ser criado.");
  return sortEditorContent(parseEditorContent(row.payload));
}

export async function saveEditorContent(content: EditorContent): Promise<EditorContent> {
  const db = getDb();
  const payload = JSON.stringify(sortEditorContent(content));
  const updatedAt = new Date().toISOString();
  const existing = await db
    .select({ id: siteContent.id })
    .from(siteContent)
    .where(eq(siteContent.id, PRIMARY_CONTENT_ID))
    .get();

  if (existing) {
    await db
      .update(siteContent)
      .set({ payload, updatedAt })
      .where(eq(siteContent.id, PRIMARY_CONTENT_ID));
  } else {
    await db.insert(siteContent).values({
      id: PRIMARY_CONTENT_ID,
      payload,
      updatedAt,
    });
  }

  return sortEditorContent(content);
}

function parseEditorContent(payload: string): EditorContent {
  try {
    const parsed = JSON.parse(payload) as Partial<EditorContent>;
    const seed = seedEditorContent();
    return {
      ...seed,
      ...parsed,
      identity: { ...seed.identity, ...(parsed.identity ?? {}) },
      home: { ...seed.home, ...(parsed.home ?? {}) },
      about: { ...seed.about, ...(parsed.about ?? {}) },
      contact: { ...seed.contact, ...(parsed.contact ?? {}) },
      timeline: Array.isArray(parsed.timeline) ? parsed.timeline : seed.timeline,
      projects: Array.isArray(parsed.projects) ? parsed.projects : seed.projects,
      notes: Array.isArray(parsed.notes) ? parsed.notes : seed.notes,
      learning: Array.isArray(parsed.learning) ? parsed.learning : seed.learning,
      interests: Array.isArray(parsed.interests) ? parsed.interests : seed.interests,
      questions: Array.isArray(parsed.questions)
        ? parsed.questions.map((question, index) => ({
          ...seed.questions[index % seed.questions.length],
          ...question,
          image: question.image || seed.questions[index % seed.questions.length].image,
          imageAlt: question.imageAlt || seed.questions[index % seed.questions.length].imageAlt,
        }))
        : seed.questions,
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : seed.contacts,
      tools: Array.isArray(parsed.tools) ? parsed.tools : seed.tools,
    };
  } catch {
    return seedEditorContent();
  }
}
