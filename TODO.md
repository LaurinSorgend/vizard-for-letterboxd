# TODO

## Quick wins

- [x] Launch the year-in-review carousel deck and poster export for any past year from `YearRecap`
- [x] Show franchise completion (`seen / total`) in `FranchisesSection` using `library.collections`
- [x] Surface already-parsed personal data on the dashboard: diary tags (`film.tags`), rewatch opinion shifts (`film.entries`), and reviews (`film.review`)
- [x] Add a year picker to the daily heatmap in `WhenSection`
- [x] Export upcoming release dates as `.ics` from `ReleaseCalendar`

## Larger features

- [x] Global dashboard filter bar (year/date range, movies vs. series, diary-logged only, tag, hearted only)
- [x] "Best match for your taste" sort in `Watchlist` (reusing `buildTasteProfile` from `releases/similarity.ts`) + watchlist backlog/streaming-coverage summary
- [x] Two-library comparison ("Compare with a friend"): taste overlap, biggest disagreements, shared directors/genres, and "watch together" watchlist intersections
- [x] Parse Letterboxd custom lists (`lists/*.csv`) for list stats and filtering
- [ ] Add search and facet filters to `Mosaic` ("Every film you have watched") and an enriched CSV/JSON export of the library

## Technical & UX polish

- [x] Move saved snapshots in `store.ts` from `localStorage` to `IndexedDB` (removes the ~5 MB cap and lets watchlist items keep full cast/keywords)
- [x] Fix bar-label overflow and vertical alignment in canvas share cards (`src/lib/wrapped/cards.ts`)
- [x] Review date formatting where including the year makes sense
- [x] Make `Unmatched` actionable: link each film to Letterboxd, allow retrying unmatched titles at any failure rate, and consider optional local TMDB ID overrides
- [x] Keep franchise `parts` stubs in `server/collections.ts` so `FranchisesSection` can list missing films in a series
- [x] Clean up lockfile/tooling mismatch (`package-lock.json` alongside `pnpm-lock.yaml`, `README.md` `npm` references)
