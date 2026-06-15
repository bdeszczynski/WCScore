import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../public/data/world-cup.json", import.meta.url), "utf8"));
const requiredPlayers = ["Bruno", "Sara"];

for (const playerName of requiredPlayers) {
  const player = data.players.find((entry) => entry.name === playerName);
  if (!player) throw new Error(`Missing player ${playerName}`);
  if (player.pointsTeams.length !== 4) throw new Error(`${playerName} must have 4 points teams`);
  if (player.winnerPicks.length !== 2) throw new Error(`${playerName} must have 2 winner picks`);
}

for (const match of data.matches) {
  if (!match.id || !match.homeTeam || !match.awayTeam) {
    throw new Error(`Invalid match entry: ${JSON.stringify(match)}`);
  }
  if (!match.venue || !match.venueCountry || !match.venueWikiUrl) {
    throw new Error(`Match is missing venue metadata: ${match.id}`);
  }
  if (!String(match.venueWikiUrl).startsWith("https://en.wikipedia.org/wiki/")) {
    throw new Error(`Match has unsafe venue wiki URL: ${match.id}`);
  }
  if (match.status === "finished") {
    if (!Number.isFinite(match.homeGoals) || !Number.isFinite(match.awayGoals)) {
      throw new Error(`Finished match is missing score: ${match.id}`);
    }
  }
}

if (!data.odds?.source || !data.odds?.updatedAt || !Array.isArray(data.odds?.teams)) {
  throw new Error("Missing odds source, update time, or team rows");
}

if (data.odds.teams.filter((entry) => Number(entry.rank) <= 10).length < 10) {
  throw new Error("Odds data must include at least 10 ranked favorites");
}

for (const entry of data.odds.teams) {
  const decimal = Number(entry.decimal);
  if (!entry.team || !Number.isFinite(decimal) || decimal <= 1) {
    throw new Error(`Invalid odds entry: ${JSON.stringify(entry)}`);
  }
  if (entry.probability !== undefined) {
    const probability = Number(entry.probability);
    if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
      throw new Error(`Invalid odds probability: ${JSON.stringify(entry)}`);
    }
  }
  if (entry.startingProbability !== undefined) {
    const startingProbability = Number(entry.startingProbability);
    if (!Number.isFinite(startingProbability) || startingProbability <= 0 || startingProbability >= 1) {
      throw new Error(`Invalid starting odds probability: ${JSON.stringify(entry)}`);
    }
  }
}

console.log(`Data OK: ${data.players.length} players, ${data.matches.length} matches`);
