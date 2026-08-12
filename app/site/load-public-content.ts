import { publicEditorContent, seedEditorContent, type EditorContent } from "../../content/editorial";
import { loadEditorContent } from "../../lib/content-store";

export async function loadPublicSiteContent(): Promise<EditorContent> {
  try {
    return publicEditorContent(await loadEditorContent());
  } catch (error) {
    console.warn("Conteúdo D1 indisponível durante a renderização; usando o seed público.", error);
    return publicEditorContent(seedEditorContent());
  }
}
