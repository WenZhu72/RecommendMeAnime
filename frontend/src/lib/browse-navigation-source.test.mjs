import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceRoot = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, sourceRoot), "utf8");
}

test("Browse navigation derives its pending destination from React optimistic state", async () => {
  const navigation = await source("components/browse/BrowseNavigation.tsx");

  assert.match(navigation, /useOptimistic\(committedQuery\)/);
  assert.match(navigation, /startTransition\(\(\) => \{\s*setNavigationQuery\(nextQuery\);\s*router\.push/s);
  assert.doesNotMatch(navigation, /useRef|useState/);
});

test("Browse filter disclosure remounts when history restores a minimum score", async () => {
  const page = await source("app/browse/page.tsx");

  assert.match(page, /key=\{`\$\{search \?\? ""\}:\$\{minimumScore \?\? ""\}`\}/);
});
