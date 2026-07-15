import assert from "node:assert/strict";
import test from "node:test";

import { parseAnimeDescription } from "./description-format.js";

function textFrom(blocks) {
  return blocks.flatMap((block) => block.type === "paragraph" ? block.content : block.items.flat()).filter((part) => part.type === "text").map((part) => part.value).join("");
}

test("turns consecutive breaks into readable paragraphs", () => {
  const blocks = parseAnimeDescription("First paragraph.<br><br>Second paragraph.");
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks.map((block) => block.type), ["paragraph", "paragraph"]);
});

test("keeps bold text from a b tag", () => {
  const blocks = parseAnimeDescription("<b>Special episode</b>");
  assert.equal(blocks[0].content[0].bold, true);
  assert.equal(textFrom(blocks), "Special episode");
});

test("keeps italic text from an i tag", () => {
  const blocks = parseAnimeDescription("<i>Watch after episode 12.</i>");
  assert.equal(blocks[0].content[0].italic, true);
  assert.equal(textFrom(blocks), "Watch after episode 12.");
});

test("decodes common and numeric HTML entities", () => {
  const blocks = parseAnimeDescription("Fish &amp; chips, &quot;quotes&quot; and &#39;apostrophes&#39;.");
  assert.equal(textFrom(blocks), "Fish & chips, \"quotes\" and 'apostrophes'.");
});

test("removes script tags and their content", () => {
  const blocks = parseAnimeDescription('<script>alert("unsafe")</script>Safe text');
  assert.equal(textFrom(blocks), "Safe text");
});

test("ignores inline event handlers on an allowed tag", () => {
  const blocks = parseAnimeDescription('<b onclick="alert(1)">Safe text</b>');
  assert.equal(textFrom(blocks), "Safe text");
  assert.equal(blocks[0].content[0].bold, true);
});

test("keeps plain text", () => {
  assert.equal(textFrom(parseAnimeDescription("A plain description.")), "A plain description.");
});

test("handles empty and missing descriptions", () => {
  assert.deepEqual(parseAnimeDescription(null), []);
  assert.deepEqual(parseAnimeDescription("   "), []);
});
