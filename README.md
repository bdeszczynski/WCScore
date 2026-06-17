# World Cup Challenge Score

Static score tracker for Bruno vs Sara. It uses no database and no authentication:

- `index.html`, `styles.css`, and `src/app.js` render the dashboard.
- `admin.html` links to the manual GitHub Actions and result override controls.
- `manifest.webmanifest`, `sw.js`, and `public/icons/` make it installable as a PWA.
- `public/data/world-cup.json` is the generated runtime data file.
- `public/data/manual-results.json` is a ready-made match list for manual result overrides, applied after API refreshes only when `manualOverride` is `true`.
- `.github/workflows/update-world-cup-data.yml` refreshes that JSON from GitHub's native schedule at 10:00 Dubai time, or on manual/external dispatch, then deploys GitHub Pages.
- `.github/workflows/deploy-pages.yml` can republish the current repo to GitHub Pages without refreshing data.

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

Balance update: in the running app, Sara keeps Brazil as a points team and Spain replaces Brazil as a winner/bonus pick. This gives Sara two separate bonus teams, matching Bruno.

## Data pipeline

Runtime dashboard data lives in `public/data/world-cup.json`. Manual result corrections live separately in `public/data/manual-results.json` and are folded into `world-cup.json` by the updater. The site is static, so visitors only read local JSON files; no browser-side API tokens, database, or server are involved.

The scheduled updater runs in GitHub Actions from the native GitHub schedule at 10:00 Dubai time. It also runs when triggered manually or by an external cron service. It writes a refreshed `world-cup.json`, validates it, auto-commits the file when anything changed, and deploys the static site to GitHub Pages.

GitHub's native `schedule` trigger is best-effort and can be delayed or dropped under load. For a more reliable daily trigger, use an external cron service such as cron-job.org to call the workflow dispatch API:

- URL: `https://api.github.com/repos/bdeszczynski/WCScore/actions/workflows/update-world-cup-data.yml/dispatches`
- Method: `POST`
- Body: `{"ref":"master"}`
- Headers:
  - `Accept: application/vnd.github+json`
  - `Authorization: Bearer YOUR_GITHUB_TOKEN`
  - `X-GitHub-Api-Version: 2026-03-10`
  - `Content-Type: application/json`

Use a fine-grained GitHub personal access token limited to this repository with **Actions: Read and write** permission. Do not commit this token to the repo or put it in the app. Store it only in the external cron service's secret/header configuration. Recommended external trigger times are 07:10 and 07:40 Dubai time, leaving GitHub's native 10:00 schedule as a later fallback.

Match schedule and results:

- Primary source: `football-data.org`, using the `FOOTBALL_DATA_TOKEN` repository secret.
- Usage: fixture IDs, teams, kickoff times, match status, scores, groups, and match numbers.
- Fallback: public Wikipedia fixture tables if the football-data token is unavailable locally.
- Manual corrections: `public/data/manual-results.json` mirrors the match list. API results win by default; a match row overrides API data only when `manualOverride` is `true`.
- The app is not live-second scoring. Results update only after the source updates, the scheduled workflow runs, and Pages deploys.

Venue metadata:

- Source: Wikipedia fixture/stadium data plus a small manual override table for rows that are awkward to parse.
- Usage: match stadium name, city, host country, and Wikipedia stadium link.
- Stored on each match as `venue`, `venueCity`, `venueCountry`, and `venueWikiUrl`.
- Scheduled result updates preserve this metadata when refreshing football-data match rows.

World Cup winner odds:

- Primary source: Polymarket public `world-cup-winner` event.
- Fallback: public World Cup winner odds articles from The Sun.
- Usage: Top 10 favorites panel, selected-team market chances on bonus cards, and market-share calculations.
- These are outright tournament chances, not per-match chances.
- Starting chances are manual baselines in `public/data/starting-chances.json`; the updater preserves them.

Upcoming match odds:

- First source: football-data.org match odds, if the token/account returns `homeWin`, `draw`, and `awayWin`.
- Current practical source: Native Stats public World Cup page at `https://native-stats.org/competition/WC/`.
- Fallback: fixture-specific Polymarket match markets, only when a market contains both teams as outcomes.
- Usage: small win-chance badges next to teams in the upcoming Matches tab.
- Native Stats and football-data H/D/A decimal odds are converted into normalized implied probabilities. Draw probability is stored in `matchOdds`, while the UI shows only the home and away team win chances next to team names.

Suggested GitHub secrets:

- `FOOTBALL_DATA_TOKEN`

## Tests

Tests use Node's built-in `node:test` runner and `node:assert/strict`; no extra test framework is required.

`npm run check` runs the JSON shape checker, the JSON diff checker, and all Node tests:

- `scripts/check-data.mjs` validates the current `public/data/world-cup.json` structure, including player picks, match venue metadata, and odds rows/source/update markers.
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
- Polymarket winner markets are ranked by probability and converted to decimal odds.
- Selected teams outside the visible top 10 are still kept for bonus-card chances.
- Closed, inactive, and placeholder Polymarket markets are ignored.
- Manual `startingProbability` values are preserved but not auto-created.
- The Sun article odds parser works as the fallback source.
- Fixture-specific Polymarket match markets parse only when both teams are real outcomes.
- football-data.org H/D/A odds convert to normalized match probabilities.
- Native Stats upcoming match odds parse from the public World Cup table and map by football-data match ID.

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
- Confirms the Matches tab renders the knockout ladder cards and flag chips.
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
