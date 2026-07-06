import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { COUNTRY_CODES, flagUrlForTeam } from "../src/flags.js";

describe("country flags", () => {
  it("has a flag code for every team loaded in match data", async () => {
    const data = JSON.parse(await readFile(new URL("../public/data/world-cup.json", import.meta.url), "utf8"));
    const teams = [...new Set(data.matches.flatMap((match) => [match.homeTeam, match.awayTeam]))].sort();
    const missing = teams.filter((team) => !COUNTRY_CODES[team]);

    assert.deepEqual(missing, []);
  });

  it("renders CDN flags for previously missing match teams", () => {
    for (const team of ["Curaçao", "Austria", "Ghana", "Jordan", "United States"]) {
      assert.match(flagUrlForTeam(team), /^https:\/\/flagcdn\.com\/w40\/[a-z-]+\.png$/, `${team} should render a CDN flag`);
    }
  });

  it("uses CDN flags for Scotland, Saudi Arabia, and England", () => {
    assert.equal(flagUrlForTeam("Scotland"), "https://flagcdn.com/w40/gb-sct.png");
    assert.equal(flagUrlForTeam("Saudi Arabia"), "https://flagcdn.com/w40/sa.png");
    assert.equal(flagUrlForTeam("England"), "https://flagcdn.com/w40/gb-eng.png");
  });

  it("renders the United States flag from match and prediction-market aliases", () => {
    assert.equal(flagUrlForTeam("United States"), "https://flagcdn.com/w40/us.png");
    assert.equal(flagUrlForTeam("USA"), "https://flagcdn.com/w40/us.png");
    assert.equal(flagUrlForTeam("US"), "https://flagcdn.com/w40/us.png");
  });

  it("can request higher-resolution quiz flags without changing inline defaults", () => {
    assert.equal(flagUrlForTeam("Scotland"), "https://flagcdn.com/w40/gb-sct.png");
    assert.equal(flagUrlForTeam("Scotland", 320), "https://flagcdn.com/w320/gb-sct.png");
  });
});
