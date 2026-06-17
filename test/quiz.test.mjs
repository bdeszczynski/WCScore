import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCapitalQuizQuestion,
  buildFlagQuizOptions,
  flagQuestionForTeam,
  FLOWER_REWARDS,
  flowerImageUrl,
  pickFlowerReward,
} from "../src/quiz.js";

const stableRandom = () => 0.5;

describe("quiz helpers", () => {
  it("uses a World Cup country flag with similar non-tournament distractors allowed", () => {
    const teams = ["Australia", "France", "Japan", "Morocco"];
    const options = buildFlagQuizOptions("Australia", teams, stableRandom);
    const question = flagQuestionForTeam("Australia");

    assert.equal(question.correct, "Australia");
    assert.equal(question.imageUrl, "https://flagcdn.com/w320/au.png");
    assert.deepEqual(options, ["Australia", "New Zealand", "Fiji"]);
  });

  it("uses hard lookalike choices such as Ivory Coast against Ireland", () => {
    const options = buildFlagQuizOptions("Ivory Coast", ["Ivory Coast", "England", "Spain"], stableRandom);

    assert.deepEqual(options, ["Ivory Coast", "Ireland", "Italy"]);
  });

  it("builds a capital question with three plausible choices", () => {
    const question = buildCapitalQuizQuestion(["Japan", "Brazil", "Norway"], stableRandom);

    assert.equal(question.country, "Japan");
    assert.equal(question.correct, "Tokyo");
    assert.deepEqual(question.options, ["Tokyo", "Kyoto", "Osaka"]);
  });

  it("keeps exactly 25 named flower rewards and emits a local SVG image URL", () => {
    const reward = pickFlowerReward(() => 0);

    assert.equal(FLOWER_REWARDS.length, 25);
    assert.equal(reward.name, "Rose");
    assert.equal(reward.imageUrl, flowerImageUrl("Rose", 0));
    assert.match(reward.imageUrl, /^data:image\/svg\+xml;charset=UTF-8,/);
    assert.match(decodeURIComponent(reward.imageUrl), /aria-label="Rose"/);
  });
});
