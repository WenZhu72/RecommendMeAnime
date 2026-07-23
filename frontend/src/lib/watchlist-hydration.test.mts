import assert from "node:assert/strict";
import test from "node:test";

import { getWatchlistButtonState } from "./watchlist-button-state.ts";
import {
  getBrowserHydrationSnapshot,
  getServerHydrationSnapshot,
  selectHydrationSafeWatchlistState,
} from "./watchlist-hydration.ts";

test("a streamed WatchlistButton has identical server and first hydration state", () => {
  const storedItems = [{ id: 1, title: "Saved anime" }];
  const server = selectHydrationSafeWatchlistState(
    storedItems,
    true,
    getServerHydrationSnapshot(),
  );
  // useSyncExternalStore intentionally supplies getServerSnapshot during the
  // browser's hydration render, even when the provider already loaded storage.
  const firstClientHydration = selectHydrationSafeWatchlistState(
    storedItems,
    true,
    getServerHydrationSnapshot(),
  );

  const serverButton = getWatchlistButtonState(
    "Saved anime",
    server.items.some((item) => item.id === 1),
    server.isHydrated,
    true,
  );
  const firstClientButton = getWatchlistButtonState(
    "Saved anime",
    firstClientHydration.items.some((item) => item.id === 1),
    firstClientHydration.isHydrated,
    true,
  );

  assert.deepEqual(firstClientHydration, server);
  assert.deepEqual(firstClientButton, serverButton);
  assert.deepEqual(serverButton, {
    appearance: "unsaved",
    disabled: true,
    filled: false,
    label: "Add Saved anime to watchlist",
    pressed: false,
    title: "Add Saved anime to watchlist",
    visibleText: null,
  });
});

test("stored watchlist state becomes visible only after consumer hydration", () => {
  const storedItems = [{ id: 1, title: "Saved anime" }];
  const hydrated = selectHydrationSafeWatchlistState(
    storedItems,
    true,
    getBrowserHydrationSnapshot(),
  );
  const button = getWatchlistButtonState(
    "Saved anime",
    hydrated.items.some((item) => item.id === 1),
    hydrated.isHydrated,
    false,
  );

  assert.equal(hydrated.items, storedItems);
  assert.equal(hydrated.isHydrated, true);
  assert.deepEqual(button, {
    appearance: "saved",
    disabled: false,
    filled: true,
    label: "Remove Saved anime from watchlist",
    pressed: true,
    title: undefined,
    visibleText: "Saved to watchlist",
  });
});

test("provider storage readiness cannot bypass the consumer hydration gate", () => {
  const state = selectHydrationSafeWatchlistState(
    [{ id: 1 }],
    true,
    getServerHydrationSnapshot(),
  );

  assert.deepEqual(state, { items: [], isHydrated: false });
});
