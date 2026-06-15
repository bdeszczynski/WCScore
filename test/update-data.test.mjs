import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getFootballDataToken, parsePolymarketWinnerEvent, parseSunWinnerOdds } from "../scripts/update-data.mjs";

describe("getFootballDataToken", () => {
  it("throws when the workflow requires a token but GitHub passes an empty value", () => {
    assert.throws(
      () =>
        getFootballDataToken({
          FOOTBALL_DATA_TOKEN: "",
          REQUIRE_FOOTBALL_DATA_TOKEN: "1",
        }),
      /FOOTBALL_DATA_TOKEN is required/,
    );
  });

  it("returns the configured token when present", () => {
    assert.equal(
      getFootballDataToken({
        FOOTBALL_DATA_TOKEN: "  configured-token  ",
        REQUIRE_FOOTBALL_DATA_TOKEN: "1",
      }),
      "configured-token",
    );
  });

  it("allows local fallback data updates when the token is not required", () => {
    assert.equal(getFootballDataToken({}), null);
  });
});

describe("parsePolymarketWinnerEvent", () => {
  function market(team, probability, overrides = {}) {
    return {
      question: `Will ${team} win the 2026 FIFA World Cup?`,
      groupItemTitle: team,
      outcomePrices: JSON.stringify([String(probability), String(1 - probability)]),
      active: true,
      closed: false,
      ...overrides,
    };
  }

  it("ranks the top 10 by market probability and converts chance to decimal odds", () => {
    const event = {
      markets: [market("France", 0.15), market("Spain", 0.16), market("Brazil", 0.1), market("Portugal", 0.09)],
    };

    const rows = parsePolymarketWinnerEvent(event, { limit: 3 });

    assert.deepEqual(
      rows.map((row) => row.team),
      ["Spain", "France", "Brazil"],
    );
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[0].probability, 0.16);
    assert.equal(rows[0].decimal, 6.25);
    assert.equal(rows[0].bookmaker, "Polymarket market probability");
  });

  it("stores selected teams even when they are outside the visible top 10", () => {
    const teams = [
      "Spain",
      "France",
      "Brazil",
      "England",
      "Portugal",
      "Argentina",
      "Germany",
      "Netherlands",
      "Morocco",
      "Belgium",
      "Japan",
      "Norway",
    ];
    const event = {
      markets: teams.map((team, index) => market(team, 0.2 - index * 0.01)),
    };

    const rows = parsePolymarketWinnerEvent(event, {
      limit: 10,
      selectedTeams: new Set(["norway"]),
    });

    assert.equal(rows.filter((row) => row.rank <= 10).length, 10);
    assert.ok(rows.some((row) => row.team === "Norway" && row.rank === 12));
  });

  it("preserves manual starting chances but does not create new baselines", () => {
    const rows = parsePolymarketWinnerEvent(
      { markets: [market("France", 0.15), market("Spain", 0.16)] },
      { currentRows: [{ team: "France", startingProbability: 0.12 }] },
    );

    assert.equal(rows.find((row) => row.team === "France").startingProbability, 0.12);
    assert.equal(rows.find((row) => row.team === "Spain").startingProbability, undefined);
  });

  it("ignores closed markets, inactive markets, and placeholder teams", () => {
    const rows = parsePolymarketWinnerEvent({
      markets: [
        market("France", 0.15, { closed: true }),
        market("Spain", 0.16, { active: false }),
        market("Other", 0.2),
        market("Team AM", 0.1),
        market("Brazil", 0.11),
      ],
    });

    assert.deepEqual(
      rows.map((row) => row.team),
      ["Brazil"],
    );
  });
});

describe("parseSunWinnerOdds", () => {
  it("parses article odds as a fallback source and preserves manual starting chances", () => {
    const html = `
      <p>Spain +450 with BetMGM</p>
      <p>France +475 with FanDuel</p>
      <p>England +700 with BetMGM</p>
      <p>Portugal +850 with DraftKings</p>
      <p>Brazil +900 with DraftKings</p>
      <p>Netherlands 20/1 with bet365</p>
    `;

    const rows = parseSunWinnerOdds(html, {
      limit: 5,
      selectedTeams: new Set(["netherlands"]),
      currentRows: [{ team: "Netherlands", startingProbability: 0.04 }],
    });

    assert.deepEqual(
      rows.slice(0, 5).map((row) => row.team),
      ["Spain", "France", "England", "Portugal", "Brazil"],
    );
    assert.ok(rows.some((row) => row.team === "Netherlands" && row.startingProbability === 0.04));
    assert.equal(rows[0].bookmaker, "The Sun public odds article");
  });
});
