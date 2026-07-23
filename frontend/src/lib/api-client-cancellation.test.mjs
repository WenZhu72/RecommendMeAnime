import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceRoot = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, sourceRoot), "utf8");
}

test("personalized Hero requests remain abortable through response-body parsing", async () => {
  const [client, recommendations, carousel] = await Promise.all([
    source("lib/api/client.ts"),
    source("lib/api/recommendations.ts"),
    source("components/home/HeroCarousel.tsx"),
  ]);

  const bodyRead = client.indexOf("payload = await response.json()");
  const listenerCleanup = client.indexOf('signal?.removeEventListener("abort", abortForCaller)');
  assert.ok(bodyRead >= 0);
  assert.ok(listenerCleanup > bodyRead);
  assert.match(recommendations, /signal\?: AbortSignal/);
  assert.match(carousel, /controller\.abort\(\)/);
});
