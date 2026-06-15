import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getFootballDataToken } from "../scripts/update-data.mjs";

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
