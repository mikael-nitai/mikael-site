const ALLOWED_TAGS = new Set([
  "p",
  "h2",
  "h3",
  "strong",
  "em",
  "a",
  "blockquote",
  "ul",
  "ol",
  "li",
  "pre",
  "code",
  "br",
]);

/**
 * Keeps the small rich-text subset used by the editor safe to render.
 * Content is sanitized again at the edge, so the public page never trusts a
 * browser-provided HTML payload.
 */
export function sanitizeRichText(value: string): string {
  return value
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (match, rawTag: string, rawAttributes: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (tag !== "a") return `<${match.startsWith("</") ? "/" : ""}${tag}>`;

      const hrefMatch = rawAttributes.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "";
      if (!href || !/^(https?:\/\/|mailto:|\/)/i.test(href)) return "<a>";
      return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">`;
    });
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function plainTextFromRichText(value: string): string {
  return value
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveSummary(value: string, maxLength = 180): string {
  const text = plainTextFromRichText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function deriveReadingTime(value: string): string {
  const words = plainTextFromRichText(value).split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 180))} min de leitura`;
}
