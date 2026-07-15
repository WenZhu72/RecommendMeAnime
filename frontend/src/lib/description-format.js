/** @typedef {{ type: "text", value: string, bold: boolean, italic: boolean } | { type: "break" }} DescriptionInline */
/** @typedef {{ type: "paragraph", content: DescriptionInline[] } | { type: "list", ordered: boolean, items: DescriptionInline[][] }} DescriptionBlock */

const NAMED_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: "\u00a0",
  quot: '"',
};

const HIDDEN_TAGS = new Set(["embed", "form", "iframe", "object", "script", "style"]);
const TAG_PATTERN = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(?:\s[^<>]*)?\/?>/g;

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-zA-Z]+);/gi, (entity, encoded) => {
    const lower = encoded.toLowerCase();
    if (lower in NAMED_ENTITIES) return NAMED_ENTITIES[lower];

    const codePoint = lower.startsWith("#x")
      ? Number.parseInt(lower.slice(2), 16)
      : lower.startsWith("#")
        ? Number.parseInt(lower.slice(1), 10)
        : Number.NaN;

    try {
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    } catch {
      return entity;
    }
  });
}

function hasVisibleContent(content) {
  return content.some((part) => part.type === "break" || part.value.trim().length > 0);
}

/**
 * Converts a deliberately small, AniList-compatible subset of HTML into a
 * safe rendering model. It never creates DOM nodes or carries attributes
 * through to the caller.
 *
 * @param {string | null | undefined} description
 * @returns {DescriptionBlock[]}
 */
export function parseAnimeDescription(description) {
  if (!description || !description.trim()) return [];

  /** @type {DescriptionBlock[]} */
  const blocks = [];
  /** @type {DescriptionInline[]} */
  let paragraph = [];
  /** @type {{ type: "list", ordered: boolean, items: DescriptionInline[][] } | null} */
  let list = null;
  /** @type {DescriptionInline[] | null} */
  let listItem = null;
  let boldDepth = 0;
  let italicDepth = 0;
  let hiddenDepth = 0;

  const finishParagraph = () => {
    if (hasVisibleContent(paragraph)) blocks.push({ type: "paragraph", content: paragraph });
    paragraph = [];
  };

  const finishList = () => {
    if (list && list.items.some(hasVisibleContent)) blocks.push(list);
    list = null;
    listItem = null;
  };

  const currentContent = () => listItem ?? paragraph;

  const addBreak = () => {
    const content = currentContent();
    if (listItem) {
      content.push({ type: "break" });
      return;
    }
    if (content.at(-1)?.type === "break") {
      content.pop();
      finishParagraph();
      return;
    }
    content.push({ type: "break" });
  };

  const addText = (rawValue) => {
    if (hiddenDepth > 0) return;
    const value = decodeEntities(rawValue.replace(/<[^>]*>/g, ""));
    const lines = value.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line) {
        currentContent().push({
          type: "text",
          value: line,
          bold: boldDepth > 0,
          italic: italicDepth > 0,
        });
      }
      if (index < lines.length - 1) addBreak();
    });
  };

  const handleTag = (rawTag) => {
    const closing = rawTag.startsWith("</");
    const match = /^<\/?([a-zA-Z][a-zA-Z0-9:-]*)/.exec(rawTag);
    if (!match) return;
    const tag = match[1].toLowerCase();

    if (HIDDEN_TAGS.has(tag)) {
      hiddenDepth = Math.max(0, hiddenDepth + (closing ? -1 : 1));
      return;
    }
    if (hiddenDepth > 0) return;

    if (tag === "b" || tag === "strong") {
      boldDepth = Math.max(0, boldDepth + (closing ? -1 : 1));
      return;
    }
    if (tag === "i" || tag === "em") {
      italicDepth = Math.max(0, italicDepth + (closing ? -1 : 1));
      return;
    }
    if (tag === "br") {
      if (!closing) addBreak();
      return;
    }
    if (tag === "p") {
      finishParagraph();
      return;
    }
    if (tag === "ul" || tag === "ol") {
      if (closing) {
        finishList();
      } else {
        finishParagraph();
        finishList();
        list = { type: "list", ordered: tag === "ol", items: [] };
      }
      return;
    }
    if (tag === "li") {
      if (!closing) {
        if (!list) {
          finishParagraph();
          list = { type: "list", ordered: false, items: [] };
        }
        listItem = [];
        list.items.push(listItem);
      }
    }
  };

  const input = description.replace(/<!--[\s\S]*?-->/g, "");
  let cursor = 0;
  for (const match of input.matchAll(TAG_PATTERN)) {
    addText(input.slice(cursor, match.index));
    handleTag(match[0]);
    cursor = (match.index ?? 0) + match[0].length;
  }
  addText(input.slice(cursor));
  finishParagraph();
  finishList();

  return blocks;
}
