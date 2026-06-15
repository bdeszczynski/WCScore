import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateTeam,
  bonusStatus,
  comparePlayerTotals,
  countRemainingGroupMatches,
  getPlayerBonusSelections,
  isFinished,
  scoreMatchForTeam,
} from "../src/scoring.js";

describe("isFinished", () => {
  it("treats missing future knockout slots as unfinished", () => {
    assert.equal(isFinished(null), false);
    assert.equal(scoreMatchForTeam(null, "Brazil"), null);
  });
});

describe("scoreMatchForTeam", () => {
  it("scores group wins, draws, and losses", () => {
    assert.deepEqual(
      scoreMatchForTeam(
        {
          stage: "Group A",
          status: "finished",
          homeTeam: "Mexico",
          awayTeam: "Japan",
          homeGoals: 2,
          awayGoals: 0,
        },
        "Mexico",
      ),
      { points: 3, win: 1, draw: 0, loss: 0, gf: 2, ga: 0, penaltyBonus: 0 },
    );

    assert.deepEqual(
      scoreMatchForTeam(
        {
          stage: "Group A",
          status: "finished",
          homeTeam: "Mexico",
          awayTeam: "Japan",
          homeGoals: 1,
          awayGoals: 1,
        },
        "Japan",
      ),
      { points: 1, win: 0, draw: 1, loss: 0, gf: 1, ga: 1, penaltyBonus: 0 },
    );
  });

  it("ignores unfinished matches and matches for other teams", () => {
    const scheduled = {
      stage: "Group A",
      status: "scheduled",
      homeTeam: "Mexico",
      awayTeam: "Japan",
      homeGoals: null,
      awayGoals: null,
    };
    const finished = { ...scheduled, status: "finished", homeGoals: 1, awayGoals: 0 };

    assert.equal(scoreMatchForTeam(scheduled, "Mexico"), null);
    assert.equal(scoreMatchForTeam(finished, "Brazil"), null);
  });

  it("adds one extra point for a knockout penalty loss after the match draw point", () => {
    const match = {
      stage: "Round of 16",
      status: "finished",
      homeTeam: "Brazil",
      awayTeam: "Japan",
      homeGoals: 1,
      awayGoals: 1,
      winnerAfterPenalties: "Brazil",
    };

    assert.deepEqual(scoreMatchForTeam(match, "Brazil"), {
      points: 1,
      win: 0,
      draw: 1,
      loss: 0,
      gf: 1,
      ga: 1,
      penaltyBonus: 0,
    });
    assert.deepEqual(scoreMatchForTeam(match, "Japan"), {
      points: 2,
      win: 0,
      draw: 1,
      loss: 0,
      gf: 1,
      ga: 1,
      penaltyBonus: 1,
    });
  });
});

describe("aggregateTeam", () => {
  it("sums points, goals, played matches, and penalty bonuses", () => {
    const matches = [
      {
        stage: "Group A",
        status: "finished",
        homeTeam: "Mexico",
        awayTeam: "Japan",
        homeGoals: 2,
        awayGoals: 0,
      },
      {
        stage: "Round of 16",
        status: "finished",
        homeTeam: "Mexico",
        awayTeam: "Brazil",
        homeGoals: 1,
        awayGoals: 1,
        winnerAfterPenalties: "Brazil",
      },
      {
        stage: "Group A",
        status: "scheduled",
        homeTeam: "Mexico",
        awayTeam: "Norway",
        homeGoals: null,
        awayGoals: null,
      },
    ];

    assert.deepEqual(aggregateTeam(matches, "Mexico", "Bruno"), {
      teamName: "Mexico",
      owner: "Bruno",
      points: 5,
      win: 1,
      draw: 1,
      loss: 0,
      gf: 3,
      ga: 1,
      gd: 2,
      penaltyBonus: 1,
      played: 2,
    });
  });
});

describe("countRemainingGroupMatches", () => {
  it("counts only unfinished group games for the selected team", () => {
    const matches = [
      { stage: "Group A", status: "scheduled", homeTeam: "Mexico", awayTeam: "Japan" },
      { stage: "Group A", status: "finished", homeTeam: "Mexico", awayTeam: "Brazil", homeGoals: 1, awayGoals: 0 },
      { stage: "Quarter-finals", status: "scheduled", homeTeam: "Mexico", awayTeam: "France" },
      { stage: "Group B", status: "scheduled", homeTeam: "Brazil", awayTeam: "France" },
    ];

    assert.equal(countRemainingGroupMatches(matches, "Mexico"), 1);
  });
});

describe("bonusStatus", () => {
  it("gives three points for reaching a semi-final", () => {
    const matches = [{ stage: "Semi-finals", status: "scheduled", homeTeam: "Morocco", awayTeam: "France" }];

    assert.deepEqual(bonusStatus(matches, "Morocco"), {
      semiReached: true,
      wonCup: false,
      points: 3,
    });
  });

  it("gives semi-final plus champion points for winning the final", () => {
    const matches = [
      { stage: "Semi-finals", status: "finished", homeTeam: "Morocco", awayTeam: "France", homeGoals: 2, awayGoals: 1 },
      { stage: "Final", status: "finished", homeTeam: "Morocco", awayTeam: "Brazil", homeGoals: 1, awayGoals: 0 },
    ];

    assert.deepEqual(bonusStatus(matches, "Morocco"), {
      semiReached: true,
      wonCup: true,
      points: 10,
    });
  });
});

describe("getPlayerBonusSelections", () => {
  it("deduplicates teams selected as both point teams and winner picks", () => {
    const selections = getPlayerBonusSelections({
      pointsTeams: [{ name: "Brazil" }, { name: "South Korea" }],
      winnerPicks: [{ name: "Brazil" }, { name: "Netherlands" }],
    });

    assert.deepEqual(selections, [
      { name: "Brazil", roles: ["points team", "winner pick"] },
      { name: "South Korea", roles: ["points team"] },
      { name: "Netherlands", roles: ["winner pick"] },
    ]);
  });
});

describe("comparePlayerTotals", () => {
  it("uses goal difference as the leader tie-breaker when total points are equal", () => {
    const bruno = { name: "Bruno", total: 12, gd: 3, gf: 8 };
    const sara = { name: "Sara", total: 12, gd: 1, gf: 10 };

    assert.deepEqual([sara, bruno].sort(comparePlayerTotals), [bruno, sara]);
  });

  it("uses goals for as the leader tie-breaker when total points and goal difference are equal", () => {
    const bruno = { name: "Bruno", total: 12, gd: 3, gf: 8 };
    const sara = { name: "Sara", total: 12, gd: 3, gf: 10 };

    assert.deepEqual([bruno, sara].sort(comparePlayerTotals), [sara, bruno]);
  });

  it("leaves players tied when total points, goal difference, and goals for are equal", () => {
    const bruno = { name: "Bruno", total: 12, gd: 3, gf: 8 };
    const sara = { name: "Sara", total: 12, gd: 3, gf: 8 };

    assert.equal(comparePlayerTotals(bruno, sara), 0);
    assert.equal(comparePlayerTotals(sara, bruno), 0);
  });
});
