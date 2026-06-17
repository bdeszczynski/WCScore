import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyManualResultOverrides,
  generateVarBotCommentary,
  getFootballDataToken,
  parseFootballDataMatchOdds,
  parseNativeStatsMatchOdds,
  parsePolymarketMatchMarket,
  parsePolymarketWinnerEvent,
  parseSunWinnerOdds,
  syncManualResultSkeleton,
} from "../scripts/update-data.mjs";

const sampleCommentaryData = {
  updatedAt: "2026-06-17T08:00:00.000Z",
  players: [
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
  ],
  matches: [
    {
      id: "1",
      stage: "GROUP_STAGE",
      status: "finished",
      homeTeam: "Norway",
      awayTeam: "Egypt",
      homeGoals: 2,
      awayGoals: 0,
    },
    {
      id: "2",
      stage: "GROUP_STAGE",
      status: "finished",
      homeTeam: "Brazil",
      awayTeam: "Japan",
      homeGoals: 1,
      awayGoals: 1,
    },
  ],
  odds: {
    teams: [
      { team: "France", probability: 0.16, startingProbability: 0.174 },
      { team: "Portugal", probability: 0.1, startingProbability: 0.105 },
      { team: "Spain", probability: 0.18, startingProbability: 0.182 },
      { team: "Netherlands", probability: 0.06, startingProbability: 0.058 },
    ],
  },
};

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

describe("applyManualResultOverrides", () => {
  it("applies manual scores after API data and marks the result source", () => {
    const [match] = applyManualResultOverrides(
      [
        {
          id: "537327",
          homeTeam: "Mexico",
          awayTeam: "South Africa",
          status: "finished",
          homeGoals: 2,
          awayGoals: 0,
          winnerAfterPenalties: null,
        },
      ],
      {
        matches: [
          {
            id: "537327",
            manualOverride: true,
            status: "finished",
            homeGoals: 3,
            awayGoals: 1,
            note: "Manual correction after source lag",
          },
        ],
      },
    );

    assert.deepEqual(
      {
        status: match.status,
        homeGoals: match.homeGoals,
        awayGoals: match.awayGoals,
        winnerAfterPenalties: match.winnerAfterPenalties,
        resultSource: match.resultSource,
        resultNote: match.resultNote,
      },
      {
        status: "finished",
        homeGoals: 3,
        awayGoals: 1,
        winnerAfterPenalties: null,
        resultSource: "manual",
        resultNote: "Manual correction after source lag",
      },
    );
  });

  it("ignores ready-made rows until manualOverride is true", () => {
    const [match] = applyManualResultOverrides(
      [
        {
          id: "537327",
          homeTeam: "Mexico",
          awayTeam: "South Africa",
          status: "finished",
          homeGoals: 2,
          awayGoals: 0,
          winnerAfterPenalties: null,
        },
      ],
      {
        matches: [
          {
            id: "537327",
            manualOverride: false,
            status: "finished",
            homeGoals: 3,
            awayGoals: 1,
          },
        ],
      },
    );

    assert.equal(match.homeGoals, 2);
    assert.equal(match.awayGoals, 0);
    assert.equal(match.resultSource, undefined);
  });

  it("rejects manual overrides for unknown matches", () => {
    assert.throws(
      () => applyManualResultOverrides([{ id: "known", homeTeam: "Spain", awayTeam: "France" }], { matches: [{ id: "missing" }] }),
      /unknown match id: missing/,
    );
  });
});

describe("syncManualResultSkeleton", () => {
  it("keeps inactive manual rows aligned with API data", () => {
    const synced = syncManualResultSkeleton(
      [
        {
          id: "537327",
          matchNumber: 1,
          stage: "GROUP_STAGE",
          group: "GROUP_A",
          kickoff: "2026-06-11T19:00:00Z",
          homeTeam: "Mexico",
          awayTeam: "South Africa",
          status: "finished",
          homeGoals: 2,
          awayGoals: 0,
          winnerAfterPenalties: null,
        },
      ],
      {
        matches: [
          {
            id: "537327",
            manualOverride: false,
            status: "finished",
            homeGoals: 9,
            awayGoals: 9,
            note: "Old inactive value",
          },
        ],
      },
    );

    assert.equal(synced.matches[0].manualOverride, false);
    assert.equal(synced.matches[0].homeGoals, 2);
    assert.equal(synced.matches[0].awayGoals, 0);
    assert.equal(synced.matches[0].note, "Old inactive value");
  });

  it("preserves active manual override scores while refreshing match metadata", () => {
    const synced = syncManualResultSkeleton(
      [
        {
          id: "537327",
          matchNumber: 2,
          stage: "GROUP_STAGE",
          group: "GROUP_A",
          kickoff: "2026-06-11T19:00:00Z",
          homeTeam: "Mexico",
          awayTeam: "South Africa",
          status: "finished",
          homeGoals: 2,
          awayGoals: 0,
          winnerAfterPenalties: null,
        },
      ],
      {
        matches: [
          {
            id: "537327",
            manualOverride: true,
            status: "finished",
            homeGoals: 3,
            awayGoals: 1,
            winnerAfterPenalties: null,
            note: "Manual correction",
          },
        ],
      },
    );

    assert.equal(synced.matches[0].matchNumber, 2);
    assert.equal(synced.matches[0].manualOverride, true);
    assert.equal(synced.matches[0].homeGoals, 3);
    assert.equal(synced.matches[0].awayGoals, 1);
    assert.equal(synced.matches[0].note, "Manual correction");
  });
});

describe("generateVarBotCommentary", () => {
  it("skips commentary when no OpenAI key is configured", async () => {
    const previous = { updatedAt: "2026-06-16T00:00:00.000Z", text: "Previous recap" };
    assert.deepEqual(await generateVarBotCommentary(sampleCommentaryData, previous, { apiKey: "" }), previous);
  });

  it("keeps previous commentary when the LLM request fails", async () => {
    const previous = { updatedAt: "2026-06-16T00:00:00.000Z", text: "Previous recap" };
    const commentary = await generateVarBotCommentary(sampleCommentaryData, previous, {
      apiKey: "test-key",
      silent: true,
      fetchImpl: async () => ({ ok: false, status: 500 }),
    });

    assert.deepEqual(commentary, previous);
  });

  it("stores short VAR-bot commentary from a successful LLM response", async () => {
    const commentary = await generateVarBotCommentary(sampleCommentaryData, null, {
      apiKey: "test-key",
      fetchImpl: async (_url, request) => {
        const payload = JSON.parse(request.body);
        assert.match(payload.input[0].content, /VAR-bot recap/);
        assert.match(payload.input[0].content, /Prediction/);
        assert.match(payload.input[0].content, /trash-talky/);
        assert.match(payload.input[1].content, /winnerPickBonus/);
        return {
          ok: true,
          json: async () => ({
            output_text: "Prediction: Bruno. Norway is doing the heavy lifting while Sara's spreadsheet is asking Spain for emergency services.",
          }),
        };
      },
    });

    assert.match(commentary.text, /Prediction: Bruno/);
    assert.ok(commentary.text.length <= 420);
    assert.ok(commentary.updatedAt);
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

  it("preserves existing starting chances and applies the manual baseline table", () => {
    const rows = parsePolymarketWinnerEvent(
      { markets: [market("France", 0.15), market("Spain", 0.16)] },
      { currentRows: [{ team: "France", startingProbability: 0.12 }] },
    );

    assert.equal(rows.find((row) => row.team === "France").startingProbability, 0.12);
    assert.equal(rows.find((row) => row.team === "Spain").startingProbability, 0.182);
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

describe("parsePolymarketMatchMarket", () => {
  const match = {
    id: "wc-1",
    homeTeam: "Brazil",
    awayTeam: "Japan",
  };

  it("parses fixture-specific three-way match markets", () => {
    const row = parsePolymarketMatchMarket(
      {
        question: "Brazil vs Japan: who will win?",
        outcomes: JSON.stringify(["Brazil", "Draw", "Japan"]),
        outcomePrices: JSON.stringify(["0.62", "0.24", "0.14"]),
        active: true,
        closed: false,
        slug: "brazil-vs-japan-who-will-win",
        volumeNum: 1234.56,
      },
      match,
    );

    assert.deepEqual(row, {
      matchId: "wc-1",
      homeTeam: "Brazil",
      awayTeam: "Japan",
      homeProbability: 0.62,
      drawProbability: 0.24,
      awayProbability: 0.14,
      question: "Brazil vs Japan: who will win?",
      url: "https://polymarket.com/event/brazil-vs-japan-who-will-win",
      volume: 1234.56,
    });
  });

  it("rejects unrelated or binary markets", () => {
    assert.equal(
      parsePolymarketMatchMarket(
        {
          question: "Will Brazil win the World Cup?",
          outcomes: JSON.stringify(["Yes", "No"]),
          outcomePrices: JSON.stringify(["0.1", "0.9"]),
          active: true,
          closed: false,
        },
        match,
      ),
      null,
    );
    assert.equal(
      parsePolymarketMatchMarket(
        {
          question: "Brazil vs Korea: who will win?",
          outcomes: JSON.stringify(["Brazil", "Draw", "South Korea"]),
          outcomePrices: JSON.stringify(["0.62", "0.24", "0.14"]),
          active: true,
          closed: false,
        },
        match,
      ),
      null,
    );
  });
});

describe("parseFootballDataMatchOdds", () => {
  const match = {
    id: "537333",
    homeTeam: "France",
    awayTeam: "Senegal",
  };

  it("converts decimal home/draw/away odds into normalized match probabilities", () => {
    const row = parseFootballDataMatchOdds(
      {
        odds: {
          homeWin: 1.8,
          draw: 3.5,
          awayWin: 5,
        },
      },
      match,
    );

    assert.deepEqual(row, {
      matchId: "537333",
      homeTeam: "France",
      awayTeam: "Senegal",
      homeProbability: 0.5335,
      drawProbability: 0.2744,
      awayProbability: 0.1921,
      question: "France vs Senegal",
      url: null,
      volume: null,
    });
  });

  it("returns null when football-data has no odds values", () => {
    assert.equal(parseFootballDataMatchOdds({ odds: { homeWin: null, draw: null, awayWin: null } }, match), null);
  });
});

describe("parseNativeStatsMatchOdds", () => {
  it("parses Native Stats upcoming H/D/A odds and maps by match id", () => {
    const rows = parseNativeStatsMatchOdds(
      `
        <tbody id="next_matches" phx-update="stream">
          <tr id="next-375307">
            <th>2026/06/15, 18h00</th>
            <td>
              <span class="hidden text-gray-200 align-middle md:inline-block">Spain</span>
              <span class="hidden text-gray-200 align-middle sm:inline-block max-w-4 md:hidden">Spain</span>
              <span class="inline-block sm:hidden text-gray-200 ">ESP</span>
              <span class="hidden text-gray-200 align-middle md:inline-block">Cape Verde Islands</span>
              <span class="hidden text-gray-200 align-middle sm:inline-block max-w-4 md:hidden">Cape Verde Islands</span>
              <span class="inline-block sm:hidden text-gray-200 ">CPV</span>
            </td>
            <td class="whitespace-nowrap"><span phx-click="[[&quot;navigate&quot;,{&quot;href&quot;:&quot;/match/537369&quot;}]]"></span></td>
            <td class="whitespace-nowrap">1.08 / 9.87 / 26.22</td>
          </tr>
        </tbody>
      `,
      [{ id: "537369", homeTeam: "Spain", awayTeam: "Cape Verde Islands" }],
    );

    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      matchId: "537369",
      homeTeam: "Spain",
      awayTeam: "Cape Verde Islands",
      homeProbability: 0.8691,
      drawProbability: 0.0951,
      awayProbability: 0.0358,
      question: "Spain vs Cape Verde Islands",
      url: "https://native-stats.org/competition/WC/",
      volume: null,
    });
  });
});
