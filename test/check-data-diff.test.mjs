import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateDataDiff } from "../scripts/check-data-diff.mjs";

const basePlayers = [
  {
    name: "Bruno",
    pointsTeams: [{ name: "Morocco" }, { name: "Japan" }, { name: "Norway" }, { name: "Mexico" }],
    winnerPicks: [{ name: "France" }, { name: "Portugal" }],
  },
  {
    name: "Sara",
    pointsTeams: [{ name: "Switzerland" }, { name: "Brazil" }, { name: "Egypt" }, { name: "South Korea" }],
    winnerPicks: [{ name: "Spain" }, { name: "Netherlands" }],
  },
];

const baseMatches = [
  {
    id: "finished-1",
    stage: "GROUP_STAGE",
    homeTeam: "Morocco",
    awayTeam: "Japan",
    status: "finished",
    homeGoals: 2,
    awayGoals: 1,
  },
  {
    id: "scheduled-1",
    stage: "GROUP_STAGE",
    homeTeam: "Norway",
    awayTeam: "Mexico",
    status: "scheduled",
    homeGoals: null,
    awayGoals: null,
  },
  { id: "pick-1", stage: "GROUP_STAGE", homeTeam: "France", awayTeam: "Portugal", status: "scheduled" },
  { id: "pick-2", stage: "GROUP_STAGE", homeTeam: "Switzerland", awayTeam: "Brazil", status: "scheduled" },
  { id: "pick-3", stage: "GROUP_STAGE", homeTeam: "Egypt", awayTeam: "South Korea", status: "scheduled" },
  { id: "pick-4", stage: "GROUP_STAGE", homeTeam: "Spain", awayTeam: "Netherlands", status: "scheduled" },
];

function data(overrides = {}) {
  return {
    players: structuredClone(basePlayers),
    matches: structuredClone(baseMatches),
    ...overrides,
  };
}

describe("validateDataDiff", () => {
  it("allows an ordinary update with the same finished scores and selected teams", () => {
    assert.deepEqual(validateDataDiff(data(), data()), []);
  });

  it("fails when match count drops to zero", () => {
    assert.match(validateDataDiff(data(), data({ matches: [] })).join("\n"), /dropped from 6 to 0/);
  });

  it("fails when a finished match regresses to scheduled", () => {
    const next = data();
    next.matches[0] = { ...next.matches[0], status: "scheduled", homeGoals: null, awayGoals: null };

    assert.match(validateDataDiff(data(), next).join("\n"), /regressed to scheduled/);
  });

  it("fails when a finished match score is rewritten", () => {
    const next = data();
    next.matches[0] = { ...next.matches[0], homeGoals: 3 };

    assert.match(validateDataDiff(data(), next).join("\n"), /score changed/);
  });

  it("allows the known Netherlands vs Morocco shootout score correction", () => {
    const previous = data({
      matches: [
        ...baseMatches,
        {
          id: "537418",
          stage: "LAST_32",
          homeTeam: "Netherlands",
          awayTeam: "Morocco",
          status: "finished",
          homeGoals: 4,
          awayGoals: 3,
        },
      ],
    });
    const next = data({
      matches: [
        ...baseMatches,
        {
          id: "537418",
          stage: "LAST_32",
          homeTeam: "Netherlands",
          awayTeam: "Morocco",
          status: "finished",
          homeGoals: 1,
          awayGoals: 1,
          winnerAfterPenalties: "Morocco",
        },
      ],
    });

    assert.deepEqual(validateDataDiff(previous, next), []);
  });

  it("fails when a selected team is removed from player picks", () => {
    const next = data();
    next.players[0].pointsTeams = next.players[0].pointsTeams.filter((team) => team.name !== "Japan");

    assert.match(validateDataDiff(data(), next).join("\n"), /Bruno is missing selected pointsTeams team: Japan/);
  });

  it("fails when a selected team is not present in loaded matches", () => {
    const next = data({
      matches: baseMatches.filter((match) => ![match.homeTeam, match.awayTeam].includes("Netherlands")),
    });

    assert.match(validateDataDiff(data(), next).join("\n"), /selected team is not present in loaded matches: Netherlands/);
  });
});
