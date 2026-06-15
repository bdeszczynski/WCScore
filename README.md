# World Cup Challenge Score

Static score tracker for Bruno vs Sara. It uses no database and no authentication:

- `index.html`, `styles.css`, and `src/app.js` render the dashboard.
- `manifest.webmanifest`, `sw.js`, and `public/icons/` make it installable as a PWA.
- `public/data/world-cup.json` is the only state file.
- `.github/workflows/update-world-cup-data.yml` refreshes that JSON at 08:00 and 20:00 Dubai time.
- GitHub Pages deploys the repo as a static site and redeploys when GitHub Actions commits refreshed data.

## Scoring

Points teams:

- Win: 3 points
- Draw: 1 point
- Knockout penalty loss: 1 extra point
- Ranking tiebreakers shown in the interface: goal difference, then goals scored

Winner selections:

Bonus points:

- Any selected team reaches the semi-finals: 3 points
- Any selected team wins the World Cup: 7 points
- Duplicate selections by the same player count once for bonus points

## Picks

Pick rules:

- The four points teams had to be outside the top 8 teams by World Cup winner odds.
- Sara had one exemption from that rule: Brazil.
- The two winner selections were bonus picks and could be any teams.

Bruno points teams: Morocco, Japan, Norway, Mexico

Sara points teams: Switzerland, Brazil, Egypt, South Korea

Bruno winner selections: France, Portugal

Sara winner selections: Brazil, Netherlands

## Data updates

The scheduled updater makes an API call to `football-data.org` when `FOOTBALL_DATA_TOKEN` is present. GitHub Actions passes that token from the `FOOTBALL_DATA_TOKEN` repository secret, and the API response is the primary result source for the 08:00 and 20:00 Dubai refreshes.

If no token is configured, the updater tries a public Wikipedia fallback and preserves the existing JSON if no fresh matches are found. Wikipedia is useful as a backup, but it is not reliable enough to be the main live-score source.

Venue metadata is stored directly on each match in `public/data/world-cup.json` as `venue`, `venueCity`, `venueCountry`, and `venueWikiUrl`. The one-time `npm run venues` command enriches those fields from Wikipedia fixture tables, with a small manual override table for fixed schedule rows that Wikipedia exposes differently. Scheduled football-data.org updates preserve existing venue metadata when refreshing results.

Winner odds are refreshed from the public Oddschecker World Cup Winner page with no API key. The updater keeps the first ten listed contenders and marks any Bruno/Sara selected teams in the interface. If Oddschecker cannot be read, it falls back to public World Cup odds articles.

Suggested GitHub secrets:

- `FOOTBALL_DATA_TOKEN`

## Tests

Tests use Node's built-in `node:test` runner and `node:assert/strict`; no extra test framework is required.

`npm run check` runs the JSON shape checker, the JSON diff checker, and all Node tests:

- `scripts/check-data.mjs` validates the current `public/data/world-cup.json` structure.
- `scripts/check-data-diff.mjs` compares the current `public/data/world-cup.json` against the previous committed version.

`test/scoring.test.mjs` covers the challenge rules:

- Group wins score 3 points and draws score 1 point.
- Unfinished matches and unrelated teams are ignored.
- Knockout penalty losers receive the draw point plus 1 extra penalty-loss point.
- Team totals aggregate points, played matches, goals for, goals against, goal difference, and penalty bonuses.
- Remaining group matches count only unfinished group-stage games for selected teams.
- Semi-final qualification gives 3 bonus points.
- Winning the World Cup gives 7 bonus points in addition to the semi-final bonus.
- Duplicate point-team and winner-pick selections count once for bonus scoring.
- Overall leader ties break by total score, then goal difference, then goals for.
- Players remain tied when total score, goal difference, and goals for are all equal.

`test/update-data.test.mjs` covers the data updater token handling:

- Scheduled/manual workflow updates fail if `FOOTBALL_DATA_TOKEN` is required but blank.
- Configured tokens are trimmed and used.
- Local fallback updates are allowed when the token is not required.

`test/check-data-diff.test.mjs` covers suspicious `world-cup.json` changes:

- Match count dropping to zero fails.
- Finished matches cannot become scheduled again.
- Finished match scores cannot be rewritten silently.
- Previously selected teams cannot disappear from player picks.
- Selected teams must remain present in the loaded match list.

`test/app-render.test.mjs` is a render smoke test:

- Loads the real `public/data/world-cup.json` into a fake DOM.
- Imports the real app entrypoint.
- Confirms the Score, Standings, and Matches sections render content.
- Confirms Matches render venue links and host-country flags.
- Confirms match stages display `GROUP STAGE` instead of raw `GROUP_STAGE`.

`test/venues.test.mjs` covers stadium metadata:

- Every loaded match has venue name, host country, and a Wikipedia stadium link.
- Representative fixtures match known venue rows from the published schedule.
- Wikipedia `stadium` fields parse into venue, city, host country, and stadium page URL.

## Local commands

```bash
npm run check
npm run icons
npm run update:data
npm run venues
npm run serve
```

Then open `http://localhost:4173`.

## GitHub Pages

The `Deploy static site` workflow publishes the repository root to GitHub Pages on every push to `master`. The repository uses Pages source `GitHub Actions`.
