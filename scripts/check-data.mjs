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
  if (match.status === "finished") {
    if (!Number.isFinite(match.homeGoals) || !Number.isFinite(match.awayGoals)) {
      throw new Error(`Finished match is missing score: ${match.id}`);
    }
  }
}

console.log(`Data OK: ${data.players.length} players, ${data.matches.length} matches`);
