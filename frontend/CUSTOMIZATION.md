# RecommendMeAnime frontend architecture and customization

This document is the handoff for the redesigned frontend. It explains the component boundaries, interactive behavior, responsive rules, and the root files to edit when the product evolves.

## Architecture

The frontend uses the Next.js App Router. Pages fetch through typed functions in `src/lib/api`; those functions call the FastAPI backend, which remains the only AniList integration boundary.

```text
Next.js page or client component
  -> src/lib/api/*.ts
  -> FastAPI /api routes
  -> backend service mapping
  -> AniList client
  -> typed Anime / AnimeListResponse data
```

Server Components own route parsing and initial data loading. Client Components are limited to behavior that requires browser state: theme switching, auto-hiding navigation, carousel timing, URL navigation, dropdown interaction, watchlist persistence, and recommendation results.

This separation is intentional for future accounts and personalization:

- Presentational components accept typed data rather than importing a data source.
- Catalogue options live in configuration rather than inside forms.
- Watchlist persistence stays behind `useWatchlist`; it can later be backed by an account API without changing cards.
- The carousel accepts `Anime[]`; trending is only the current provider.
- All browse state is URL-owned and bookmarkable.

## Reusable components

### New components

`src/components/theme/ThemeToggle.tsx`

- Applies `light` or `dark` to the root document.
- Persists an explicit choice in `localStorage`.
- Updates `color-scheme` and the browser theme color.
- Uses semantic sun/moon icons with an accessible control label.

`src/components/home/HeroCarousel.tsx`

- Accepts a curated fallback `Anime[]` and an optional autoplay interval.
- Reads saved recommendation preferences in the browser and replaces fallback titles only when personalized results succeed.
- Stores up to 24 unique recommendations and renders a bounded virtual window for multi-card momentum.
- Delegates press, intent, drag, and settlement transitions to a typed interaction hook shared by mouse, touch, and pen input.
- Captures only confirmed horizontal drags, preserves native vertical touch scrolling, and updates motion through animation frames rather than React renders.
- Projects recent pointer velocity for multi-card flicks, then uses a damped spring for physical settlement and snap-back gestures.
- Rotates every six seconds by default.
- Pauses on pointer hover, keyboard focus, explicit pause, reduced motion, or an inactive tab.
- Uses only `coverImage` in a fixed 2:3 poster frame; it never substitutes `bannerImage`.
- Exposes accessible previous, next, pagination, and pause/resume controls.

`src/components/browse/GenreDropdown.tsx`

- Controlled by a selected genre array and an `onApply` callback.
- Provides local search, multi-select checkboxes, clear/apply actions, a scrollable option area, outside-click dismissal, and Escape-key dismissal.
- Stages changes locally so checking several genres causes one catalogue request.

`src/components/anime/AnimeDetailHero.tsx`

- Owns the integrated banner, cover, title, actions, description, genres, and metadata composition.
- Accepts a plain `Anime` plus display-ready metadata.
- Omits the banner layer and all banner spacing when no banner is available.
- Uses an artwork-derived CSS variable for its theme-aware fade.

### Refactored shared components

`NavBar` owns global navigation, active state, mobile expansion, theme control, and scroll visibility. `Hero` owns homepage copy/actions and composes hero-specific `HeroSearch` and `HeroCarousel` components. `BrowseFilters` owns URL-backed catalogue controls. `Pagination` changes only the page parameter and handles pending results state. `AnimeCard` and `AnimeGrid` remain the canonical catalogue presentation across home, browse, search, watchlist, related titles, and recommendation results.

The primitive layer remains in `src/components/ui`:

- `Button` / `ButtonLink`: action variants, sizing, loading, disabled, and focus states.
- `Input`: shared field surface and invalid/disabled/focus behavior.
- `GenreBadge`: compact genre metadata.
- `PageHeader` / `SectionHeader`: route and section hierarchy.
- `LoadingCards`: card-grid skeleton with matching geometry.
- `EmptyState` / `ErrorMessage`: semantic zero/error states without decorative filler.
- `Icons`: small, consistent SVG controls. The owning control supplies the accessible label.

## Theme system

Dark is the product default. On first visit, the inline bootstrap in `src/app/layout.tsx` checks `prefers-color-scheme`; an explicit stored choice wins on later visits. The script runs in the document head before React hydration, which prevents a flash of the wrong theme.

The storage key is `recommend-me-anime-theme`. The document receives both `data-theme` and a `light`/`dark` class. Components do not contain separate theme branches: they consume semantic tokens such as `canvas`, `surface`, `line`, `ink`, and `brand`.

The reduced-motion block in `src/app/globals.css` shortens global transitions and animations. Stateful components also avoid autoplay or nonessential scroll motion when reduced motion is requested.

## Hero recommendations and personalization

`src/app/page.tsx` fetches a hero-only top-rated pool in parallel with the unchanged Trending and Popular requests. `src/lib/hero-recommendations.ts` requires a score of at least 85, popularity of at least 10,000, complete poster metadata, and randomly samples up to 24 unique titles.

```text
getTopRatedAnime()
  -> selectFallbackHeroAnime()
  -> Hero fallbackRecommendations={heroFallback}
  -> HeroCarousel fallbackItems={fallbackRecommendations}
```

When saved questionnaire preferences exist, `HeroCarousel` requests recommendations and swaps them in only after valid poster results return. Until then, and whenever that request fails, the fallback label remains explicitly community-based. Carousel copy never claims that fallback titles are personalized.

## Dynamic detail fade

AniList exposes a representative color with cover artwork. The backend now returns that value as the additive `Anime.color` field. `AnimeDetailHero` validates the value as a six-digit hex color and assigns it to `--artwork-accent`; invalid or absent values fall back to the product purple.

The `.anime-detail-banner-fade` rule in `globals.css` uses `color-mix()` to combine:

- the artwork accent;
- the active theme canvas;
- the active theme surface.

The result transitions the banner into the details surface rather than fading every image to black. A separate low-opacity image overlay protects readability. When `bannerImage` is null, neither the image nor the banner-specific top padding is rendered.

## Auto-hiding navigation

`NavBar.tsx` uses a passive scroll handler that tracks direction and accumulates movement from the point where that direction began.

- It stays visible within 72px of the document top.
- It ignores movement smaller than the 12px threshold to prevent flicker.
- A meaningful downward movement translates it out of view.
- A meaningful upward movement restores it.
- Focus entering the header, opening the mobile menu, or navigating always restores it.
- The global reduced-motion rule removes the animated transition for users who request it.

The transform changes only the sticky header; it does not cause document reflow.

## Browse controls and pagination

`BrowseFilters` is a compact responsive toolbar containing search, genre, format, season, year, sort, and More controls. Minimum score lives in the expandable More area. Every committed change writes `URLSearchParams`, preserves unrelated filters, and removes `page`.

Multiple genres are represented by repeated query parameters:

```text
/browse?genre=Fantasy&genre=Adventure
```

The frontend query helper serializes arrays as repeated keys. FastAPI validates up to ten genre values and forwards them to AniList's `genre_in` filter. Existing single-genre URLs remain compatible.

Before filter navigation begins, `BrowseFilters` emits the internal `recommendmeanime:browse-filter-change` event. Mounted pagination responds immediately with `Updating results...` and `1 / -`; it never continues to show totals from the previous filter set. The new server response remounts pagination with recalculated `currentPage`, `lastPage`, and `total` values.

## Responsive organization

The interface is mobile-first rather than a scaled desktop layout.

- Base: 320px minimum, two-column anime grid, stacked hero, single-column controls.
- `sm` (640px): larger type/gutters, three-column cards, paired browse controls, detail cover/title grid.
- `md` (768px): wider informational layouts.
- `lg` (1024px): desktop navigation, four-column cards, two-column homepage hero.
- `xl` (1280px): five-column cards and the single-row browse toolbar.

`Container.tsx` owns the global content width and page gutters. `AnimeGrid.tsx` and `LoadingCards.tsx` deliberately share column and gap rules. The carousel uses a wider mobile ratio and a taller desktop ratio. The detail hero changes composition at `sm` and does not reserve desktop banner geometry on small screens.

## Root customization map

The main visual source of truth is `src/app/globals.css`. Its token sections are commented in the file.

| What to customize | Root location | Tokens / rule |
| --- | --- | --- |
| Dark colors | `src/app/globals.css` | `@theme --color-*` |
| Light colors | `src/app/globals.css` | `html.light --color-*` |
| Typography | `src/app/globals.css` | `--font-sans`; component type scales use shared Tailwind intervals |
| Spacing and sizing | `src/app/globals.css` | `--spacing-control`, `--spacing-nav`, `--container-content` |
| Page width and gutters | `src/components/layout/Container.tsx` | `max-w-content`, `px-5`, `sm:px-7`, `lg:px-10` |
| Breakpoints | `src/app/globals.css` | `--breakpoint-sm/md/lg/xl` |
| Border radius | `src/app/globals.css` | `--radius-control/card/panel` |
| Shadows | `src/app/globals.css` | `--shadow-card/card-hover/panel`, plus light overrides |
| Animation easing/keyframes | `src/app/globals.css` | `--ease-product`, `--animate-*`, `@keyframes` |
| Reduced motion | `src/app/globals.css` | `prefers-reduced-motion` media query |
| Artwork/banner blend | `src/app/globals.css` | `.anime-detail-banner-fade` |
| Catalogue labels/options | `src/config/catalogue.ts` | genres, formats, seasons, sorts, years |
| Buttons and control sizes | `src/components/ui/Button.tsx`, `src/components/ui/Input.tsx` | variant and size maps, `fieldStyles` |
| Card columns and gaps | `src/components/search/AnimeGrid.tsx` | responsive grid classes |
| Hero colours and glow | `src/app/globals.css` | `.home-hero`, `.hero-recommendation-card` |
| Hero spacing and typography | `src/components/home/Hero.tsx` | hero grid, heading, and copy utilities |
| Hero search styling | `src/components/home/HeroSearch.tsx` | form surface and focus/hover utilities |
| Carousel geometry and perspective | `src/app/globals.css` | `.hero-recommendation-*` rules |
| Carousel timing, gestures, and spring | `src/components/home/HeroCarousel.tsx` | autoplay, swipe-threshold/velocity, stiffness, and damping constants |
| Hero recommendation rules | `src/lib/hero-recommendations.ts` | exported score, popularity, and item-limit constants |
| Navbar scroll thresholds | `src/components/layout/NavBar.tsx` | `TOP_LOCK_PX`, `SCROLL_THRESHOLD_PX` |

When changing the palette, edit semantic tokens rather than searching for raw colors. Explicit black/white values that remain in components are image overlays or text rendered directly over artwork, where their role is independent of the website theme.
