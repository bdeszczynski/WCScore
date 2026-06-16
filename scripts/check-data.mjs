import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../public/data/world-cup.json", import.meta.url), "utf8"));
const startingChances = JSON.parse(await readFile(new URL("../public/data/starting-chances.json", import.meta.url), "utf8"));
const manualResults = JSON.parse(await readFile(new URL("../public/data/manual-results.json", import.meta.url), "utf8"));
const requiredPlayers = ["Bruno", "Sara"];

function normalizeTeam(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ");
}

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

if (!Array.isArray(manualResults.matches)) {
  throw new Error("Manual results must contain a matches array");
}

const matchIds = new Set(data.matches.map((match) => String(match.id)));
for (const override of manualResults.matches) {
  if (!override.id || !matchIds.has(String(override.id))) {
    throw new Error(`Manual result override references unknown match: ${JSON.stringify(override)}`);
  }
  if (override.status !== undefined && !["scheduled", "finished"].includes(override.status)) {
    throw new Error(`Manual result override has invalid status: ${JSON.stringify(override)}`);
  }
  if ((override.homeGoals === undefined) !== (override.awayGoals === undefined)) {
    throw new Error(`Manual result override must set both scores together: ${JSON.stringify(override)}`);
  }
  if (override.homeGoals !== undefined || override.awayGoals !== undefined) {
    if (!Number.isFinite(Number(override.homeGoals)) || !Number.isFinite(Number(override.awayGoals))) {
      throw new Error(`Manual result override has invalid score: ${JSON.stringify(override)}`);
    }
  }
}

if (!data.odds?.source || !data.odds?.updatedAt || !Array.isArray(data.odds?.teams)) {
  throw new Error("Missing odds source, update time, or team rows");
}

if (!Array.isArray(startingChances.teams) || !startingChances.teams.length) {
  throw new Error("Missing starting chances rows");
}

let previousStartingProbability = Number.POSITIVE_INFINITY;
const startingProbabilityByTeam = new Map();
for (const entry of startingChances.teams) {
  const probability = Number(entry.startingProbability);
  if (!entry.team || !Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    throw new Error(`Invalid starting chances entry: ${JSON.stringify(entry)}`);
  }
  if (probability > previousStartingProbability) {
    throw new Error(`Starting chances are not sorted descending at ${entry.team}`);
  }
  previousStartingProbability = probability;
  startingProbabilityByTeam.set(normalizeTeam(entry.team), probability);
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
    const expectedStartingProbability = startingProbabilityByTeam.get(normalizeTeam(entry.team));
    if (expectedStartingProbability && startingProbability !== expectedStartingProbability) {
      throw new Error(`Starting odds probability does not match manual baseline: ${JSON.stringify(entry)}`);
    }
  }
}

if (data.matchOdds !== undefined) {
  if (!data.matchOdds?.source || !data.matchOdds?.updatedAt || !Array.isArray(data.matchOdds?.matches)) {
    throw new Error("Invalid match odds block");
  }
  const matchIds = new Set(data.matches.map((match) => match.id));
  for (const entry of data.matchOdds.matches) {
    if (!matchIds.has(entry.matchId)) throw new Error(`Match odds reference unknown match: ${JSON.stringify(entry)}`);
    for (const key of ["homeProbability", "awayProbability"]) {
      const probability = Number(entry[key]);
      if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
        throw new Error(`Invalid match odds probability: ${JSON.stringify(entry)}`);
      }
    }
    if (entry.drawProbability !== null && entry.drawProbability !== undefined) {
      const probability = Number(entry.drawProbability);
      if (!Number.isFinite(probability) || probability < 0 || probability >= 1) {
        throw new Error(`Invalid draw odds probability: ${JSON.stringify(entry)}`);
      }
    }
  }
}

console.log(`Data OK: ${data.players.length} players, ${data.matches.length} matches`);
