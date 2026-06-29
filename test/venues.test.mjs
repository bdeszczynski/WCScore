import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { parseVenue } from "../scripts/update-data.mjs";

async function loadData() {
  return JSON.parse(await readFile(new URL("../public/data/world-cup.json", import.meta.url), "utf8"));
}

function findMatch(data, homeTeam, awayTeam) {
  return data.matches.find((match) => match.homeTeam === homeTeam && match.awayTeam === awayTeam);
}

function stageKind(stage = "") {
  const value = String(stage).toLowerCase();
  if (value.includes("group")) return "group";
  if (value.includes("semi")) return "semi";
  if (value.includes("final") && !value.includes("semi")) return "final";
  if (value.includes("round") || value.includes("last") || value.includes("quarter") || value.includes("knockout")) return "knockout";
  return "unknown";
}

describe("venue metadata", () => {
  it("has stadium metadata and Wikipedia links for every loaded group-stage match", async () => {
    const data = await loadData();
    const requiredMatches = data.matches.filter((match) => stageKind(match.stage) === "group");
    const missing = requiredMatches.filter((match) => !match.venue || !match.venueCountry || !match.venueWikiUrl);

    assert.deepEqual(missing, []);
    for (const match of requiredMatches) {
      assert.match(match.venueWikiUrl, /^https:\/\/en\.wikipedia\.org\/wiki\//);
    }
  });

  it("matches known venue source rows for representative fixtures", async () => {
    const data = await loadData();
    const expected = [
      ["Mexico", "South Africa", "Estadio Azteca", "Mexico"],
      ["Canada", "Bosnia-Herzegovina", "BMO Field", "Canada"],
      ["United States", "Australia", "Lumen Field", "United States"],
      ["Turkey", "Paraguay", "Levi's Stadium", "United States"],
      ["Spain", "Cape Verde Islands", "Mercedes-Benz Stadium", "United States"],
    ];

    for (const [homeTeam, awayTeam, venue, venueCountry] of expected) {
      const match = findMatch(data, homeTeam, awayTeam);
      assert.ok(match, `${homeTeam} vs ${awayTeam} should exist`);
      assert.equal(match.venue, venue);
      assert.equal(match.venueCountry, venueCountry);
    }
  });

  it("parses venue name, city, host country, and stadium Wikipedia link from Wikipedia stadium fields", () => {
    assert.deepEqual(parseVenue("[[Estadio Azteca]], [[Mexico City]]"), {
      venue: "Estadio Azteca",
      venueCity: "Mexico City",
      venueCountry: "Mexico",
      venueWikiUrl: "https://en.wikipedia.org/wiki/Estadio_Azteca",
    });
  });
});
