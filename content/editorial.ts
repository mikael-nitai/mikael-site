import {
  siteData,
  type LearningEntry,
  type NoteEntry,
  type ProjectEntry,
  type TimelineEntry,
} from "./siteData";

export type EditorialStatus = "draft" | "published" | "hidden";
export type EditableCollection = "timeline" | "projects" | "notes" | "learning" | "interests";

export type EditorialMeta = {
  id: string;
  editorialStatus: EditorialStatus;
  order: number;
};

export type EditableTimelineEntry = TimelineEntry & EditorialMeta;

export type EditableProjectEntry = ProjectEntry & EditorialMeta & {
  body?: string;
  github?: string;
  demo?: string;
  coverAssetId?: string;
};

export type EditableNoteEntry = NoteEntry & EditorialMeta & {
  body: string;
  tags: string[];
  coverAssetId?: string;
};

export type EditableLearningEntry = LearningEntry & EditorialMeta & {
  hours?: string;
  description?: string;
  coverAssetId?: string;
  documentAssetId?: string;
  documentPublic: boolean;
};

export type EditableInterest = EditorialMeta & {
  value: string;
};

export type EditorIdentity = {
  name: string;
  role: string;
  location: string;
  description: string;
};

export type EditorContent = {
  identity: EditorIdentity;
  timeline: EditableTimelineEntry[];
  projects: EditableProjectEntry[];
  notes: EditableNoteEntry[];
  learning: EditableLearningEntry[];
  interests: EditableInterest[];
  tools: string[];
};

function meta(prefix: string, index: number): EditorialMeta {
  return {
    id: `${prefix}-${index + 1}`,
    editorialStatus: "published",
    order: index,
  };
}

export function seedEditorContent(): EditorContent {
  return {
    identity: { ...siteData.identity },
    timeline: siteData.timeline.map((entry, index) => ({ ...entry, ...meta("timeline", index) })),
    projects: siteData.projects.map((entry, index) => ({ ...entry, ...meta("project", index), body: entry.description })),
    notes: siteData.notes.map((entry, index) => ({
      ...entry,
      ...meta("note", index),
      body: `<p>${entry.summary}</p>`,
      tags: [],
    })),
    learning: siteData.learning.map((entry, index) => ({
      ...entry,
      ...meta("learning", index),
      documentPublic: false,
    })),
    interests: siteData.interests.map((value, index) => ({ ...meta("interest", index), value })),
    tools: [...siteData.tools],
  };
}

export function sortEditorContent(content: EditorContent): EditorContent {
  return {
    ...content,
    timeline: [...content.timeline].sort((a, b) => a.order - b.order),
    projects: [...content.projects].sort((a, b) => a.order - b.order),
    notes: [...content.notes].sort((a, b) => a.order - b.order),
    learning: [...content.learning].sort((a, b) => a.order - b.order),
    interests: [...content.interests].sort((a, b) => a.order - b.order),
  };
}

export function publicEditorContent(content: EditorContent): EditorContent {
  const published = <T extends EditorialMeta>(entries: T[]) =>
    entries.filter((entry) => entry.editorialStatus === "published");

  return sortEditorContent({
    ...content,
    timeline: published(content.timeline),
    projects: published(content.projects),
    notes: published(content.notes),
    learning: published(content.learning),
    interests: published(content.interests),
  });
}

export function isEditableCollection(value: string | null): value is EditableCollection {
  return value === "timeline" || value === "projects" || value === "notes" || value === "learning" || value === "interests";
}

export function isEditorialStatus(value: unknown): value is EditorialStatus {
  return value === "draft" || value === "published" || value === "hidden";
}
