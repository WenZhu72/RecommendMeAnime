import { Fragment, type ReactNode } from "react";

import { parseAnimeDescription } from "@/lib/description-format";

type DescriptionInline = ReturnType<typeof parseAnimeDescription>[number] extends infer Block
  ? Block extends { content: (infer Inline)[] }
    ? Inline
    : Block extends { items: (infer Inline)[][] }
      ? Inline
      : never
  : never;

function renderInline(content: DescriptionInline[], prefix: string): ReactNode[] {
  return content.map((part, index) => {
    const key = `${prefix}-${index}`;
    if (part.type === "break") return <br key={key} />;

    let value: ReactNode = part.value;
    if (part.bold) value = <strong className="font-semibold text-slate-100">{value}</strong>;
    if (part.italic) value = <em className="italic">{value}</em>;
    return <Fragment key={key}>{value}</Fragment>;
  });
}

export function AnimeDescription({ description }: { description: string | null | undefined }) {
  const blocks = parseAnimeDescription(description);
  if (blocks.length === 0) return null;

  return (
    <div className="mt-6 max-w-3xl space-y-4 text-base leading-7 text-slate-300 sm:text-[1.05rem]">
      {blocks.map((block, index) => {
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={`list-${index}`} className={`ml-5 space-y-2 pl-1 marker:text-slate-400 ${block.ordered ? "list-decimal" : "list-disc"}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`list-${index}-${itemIndex}`}>{renderInline(item, `list-${index}-${itemIndex}`)}</li>
              ))}
            </List>
          );
        }

        return <p key={`paragraph-${index}`}>{renderInline(block.content, `paragraph-${index}`)}</p>;
      })}
    </div>
  );
}
