import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DATA_PATH = "public/data/world-cup.json";
const DATA_FILE = new URL(`../${DATA_PATH}`, import.meta.url);
const ALLOWED_SCORE_CORRECTIONS = new Set(["537418:4-3:1-1:Morocco"]);

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ");
}

function selectedTeamsByPlayer(data, playerName, key) {
  const player = data.players?.find((entry) => entry.name === playerName);
  return (player?.[key] || []).map((team) => team.name);
}

function matchLabel(match) {
  return `${match.id || "unknown"} (${match.homeTeam || "TBC"} vs ${match.awayTeam || "TBC"})`;
}

function resultWinner(match) {
  if (!Number.isFinite(match?.homeGoals) || !Number.isFinite(match?.awayGoals)) return "";
  if (match.homeGoals > match.awayGoals) return match.homeTeam || "";
  if (match.awayGoals > match.homeGoals) return match.awayTeam || "";
  return "";
}

function isAllowedScoreCorrection(previousMatch, nextMatch) {
  const key = [
    previousMatch.id,
    `${previousMatch.homeGoals}-${previousMatch.awayGoals}`,
    `${nextMatch.homeGoals}-${nextMatch.awayGoals}`,
    nextMatch.winnerAfterPenalties || "",
  ].join(":");
  if (ALLOWED_SCORE_CORRECTIONS.has(key)) return true;

  const nextIsShootoutCorrection =
    nextMatch.winnerAfterPenalties &&
    nextMatch.homeGoals === nextMatch.awayGoals &&
    resultWinner(previousMatch) &&
    normalizeName(resultWinner(previousMatch)) === normalizeName(nextMatch.winnerAfterPenalties);

  return Boolean(nextIsShootoutCorrection);
}

export function validateDataDiff(previous, next) {
  const issues = [];
  const previousMatches = Array.isArray(previous?.matches) ? previous.matches : [];
  const nextMatches = Array.isArray(next?.matches) ? next.matches : [];

  if (previousMatches.length > 0 && nextMatches.length === 0) {
    issues.push(`Match count dropped from ${previousMatches.length} to 0.`);
  }

  const nextMatchesById = new Map(nextMatches.map((match) => [String(match.id), match]));
  for (const previousMatch of previousMatches) {
    if (previousMatch.status !== "finished") continue;
    const nextMatch = nextMatchesById.get(String(previousMatch.id));
    if (!nextMatch) {
      issues.push(`Finished match disappeared: ${matchLabel(previousMatch)}.`);
      continue;
    }
    if (nextMatch.status !== "finished") {
      issues.push(`Finished match regressed to ${nextMatch.status || "unknown"}: ${matchLabel(previousMatch)}.`);
      continue;
    }
    if (
      (previousMatch.homeGoals !== nextMatch.homeGoals || previousMatch.awayGoals !== nextMatch.awayGoals) &&
      !isAllowedScoreCorrection(previousMatch, nextMatch)
    ) {
      issues.push(
        `Finished match score changed for ${matchLabel(previousMatch)}: ${previousMatch.homeGoals}-${previousMatch.awayGoals} became ${nextMatch.homeGoals}-${nextMatch.awayGoals}.`,
      );
    }
  }

  for (const playerName of ["Bruno", "Sara"]) {
    for (const key of ["pointsTeams", "winnerPicks"]) {
      const previousTeams = selectedTeamsByPlayer(previous, playerName, key);
      const nextTeams = new Set(selectedTeamsByPlayer(next, playerName, key).map(normalizeName));
      for (const teamName of previousTeams) {
        if (!nextTeams.has(normalizeName(teamName))) {
          issues.push(`${playerName} is missing selected ${key} team: ${teamName}.`);
        }
      }
    }
  }

  const matchTeams = new Set(
    nextMatches.flatMap((match) => [match.homeTeam, match.awayTeam]).filter(Boolean).map(normalizeName),
  );
  for (const player of next?.players || []) {
    for (const team of [...(player.pointsTeams || []), ...(player.winnerPicks || [])]) {
      if (!matchTeams.has(normalizeName(team.name))) {
        issues.push(`${player.name}'s selected team is not present in loaded matches: ${team.name}.`);
      }
    }
  }

  return issues;
}

async function readPreviousData() {
  const { stdout } = await execFileAsync("git", ["show", `HEAD:${DATA_PATH}`], { cwd: new URL("..", import.meta.url) });
  return JSON.parse(stdout);
}

async function main() {
  const previous = await readPreviousData();
  const next = JSON.parse(await readFile(DATA_FILE, "utf8"));
  const issues = validateDataDiff(previous, next);

  if (issues.length) {
    throw new Error(`Suspicious ${DATA_PATH} change:\n- ${issues.join("\n- ")}`);
  }

  console.log(`Data diff OK: ${next.matches.length} matches checked`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
