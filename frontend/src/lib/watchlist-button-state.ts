export type WatchlistButtonState = {
  appearance: "saved" | "unsaved";
  disabled: boolean;
  filled: boolean;
  label: string;
  pressed: boolean;
  title: string | undefined;
  visibleText: string | null;
};

export function getWatchlistButtonState(
  animeTitle: string,
  saved: boolean,
  isHydrated: boolean,
  compact: boolean,
): WatchlistButtonState {
  const label = saved
    ? `Remove ${animeTitle} from watchlist`
    : `Add ${animeTitle} to watchlist`;

  return {
    appearance: saved ? "saved" : "unsaved",
    disabled: !isHydrated,
    filled: saved,
    label,
    pressed: saved,
    title: compact ? label : undefined,
    visibleText: compact ? null : saved ? "Saved to watchlist" : "Add to watchlist",
  };
}
