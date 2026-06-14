# World Cup Challenge Score

Static score tracker for Bruno vs Sara. It uses no database and no authentication:

- `index.html`, `styles.css`, and `src/app.js` render the dashboard.
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

- Selected team reaches the semi-finals: 3 points
- Selected team wins the World Cup: 7 points

## Picks

Bruno points teams: Morocco, Japan, Norway, Mexico

Sara points teams: Switzerland, Brazil, Egypt, South Korea

Bruno winner selections: France, Portugal

Sara winner selections: Brazil, Netherlands

## Data updates

The updater tries `football-data.org` first when `FOOTBALL_DATA_TOKEN` is present. That should be the primary result source for the scheduled 08:00 and 20:00 Dubai refreshes.

If no token is configured, the updater tries a public Wikipedia fallback and preserves the existing JSON if no fresh matches are found. Wikipedia is useful as a backup, but it is not reliable enough to be the main live-score source.

Winner odds are refreshed when `ODDS_API_KEY` is configured. Without that key, the odds panel stays visible and shows the manual values from `public/data/world-cup.json`.

Suggested GitHub secrets:

- `FOOTBALL_DATA_TOKEN`
- `ODDS_API_KEY`

Optional GitHub variable:

- `ODDS_API_SPORT_KEY`, defaults to `soccer_fifa_world_cup_winner`

## Local commands

```bash
npm run check
npm run update:data
npm run serve
```

Then open `http://localhost:4173`.

## GitHub Pages

The `Deploy static site` workflow publishes the repository root to GitHub Pages on every push to `master`. The repository uses Pages source `GitHub Actions`.
