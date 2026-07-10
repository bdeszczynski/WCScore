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
  stageKind,
} from "../src/scoring.js";

describe("stageKind", () => {
  it("treats football-data LAST_32 as a knockout stage", () => {
    assert.equal(stageKind("LAST_32"), "knockout");
  });

  it("does not classify quarter-finals as finals", () => {
    assert.equal(stageKind("QUARTER_FINALS"), "knockout");
    assert.equal(stageKind("Quarter-finals"), "knockout");
    assert.equal(stageKind("FINAL"), "final");
  });
});

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

  it("scores knockout penalty winners as wins and penalty losers with one consolation point", () => {
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
      points: 3,
      win: 1,
      draw: 0,
      loss: 0,
      gf: 1,
      ga: 1,
      penaltyBonus: 0,
    });
    assert.deepEqual(scoreMatchForTeam(match, "Japan"), {
      points: 1,
      win: 0,
      draw: 0,
      loss: 1,
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
        homeTeam: "Morocco",
        awayTeam: "Japan",
        homeGoals: 2,
        awayGoals: 0,
      },
      {
        stage: "Round of 16",
        status: "finished",
        homeTeam: "Netherlands",
        awayTeam: "Morocco",
        homeGoals: 1,
        awayGoals: 1,
        winnerAfterPenalties: "Morocco",
      },
      {
        stage: "Group A",
        status: "scheduled",
        homeTeam: "Morocco",
        awayTeam: "Norway",
        homeGoals: null,
        awayGoals: null,
      },
    ];

    assert.deepEqual(aggregateTeam(matches, "Morocco", "Bruno"), {
      teamName: "Morocco",
      owner: "Bruno",
      points: 6,
      win: 2,
      draw: 0,
      loss: 0,
      gf: 3,
      ga: 1,
      gd: 2,
      penaltyBonus: 0,
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
  it("does not give semi-final bonus points for reaching a quarter-final", () => {
    const matches = [{ stage: "QUARTER_FINALS", status: "scheduled", homeTeam: "Morocco", awayTeam: "France" }];

    assert.deepEqual(bonusStatus(matches, "Morocco"), {
      semiReached: false,
      wonCup: false,
      points: 0,
    });
  });

  it("gives three points for reaching a semi-final", () => {
    const matches = [{ stage: "Semi-finals", status: "scheduled", homeTeam: "Morocco", awayTeam: "France" }];

    assert.deepEqual(bonusStatus(matches, "Morocco"), {
      semiReached: true,
      wonCup: false,
      points: 3,
    });
  });

  it("gives three points when a team wins a quarter-final before semi-final fixtures are loaded", () => {
    const matches = [{ stage: "QUARTER_FINALS", status: "finished", homeTeam: "France", awayTeam: "Morocco", homeGoals: 2, awayGoals: 0 }];

    assert.deepEqual(bonusStatus(matches, "France"), {
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
