import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(name, force) {
    const shouldAdd = force ?? !this.values.has(name);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(dataset = {}) {
    this.innerHTML = "";
    this.textContent = "";
    this.hidden = false;
    this.dataset = dataset;
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.style = {
      setProperty() {},
    };
  }

  addEventListener(eventName, handler) {
    this.listeners.set(eventName, handler);
  }

  append() {}

  closest(selector) {
    return selector === "[data-ladder-round]" && this.dataset.ladderRound ? this : null;
  }

  dispatch(eventName, target = this) {
    this.listeners.get(eventName)?.({ target });
  }

  remove() {}
  setAttribute() {}

  querySelector(selector) {
    if ([".quiz-feedback", ".quiz-flag", ".quiz-options"].includes(selector)) return new FakeElement();
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

function createFakeDocument() {
  const ladderButtons = ["round32", "round16", "third", "qf", "sf", "thirdMatch", "final"].map(
    (round) => new FakeElement({ ladderRound: round }),
  );
  ladderButtons[0].classList.toggle("active", true);

  const elements = new Map(
    [
      "#last-updated",
      "#score-strip",
      "#standings-body",
      "#goal-standings",
      "#odds-list",
      "#odds-source",
      "#odds-updated",
      "#winner-picks",
      "#knockout-ladder",
      "#match-list",
      "#match-filter",
      ".ladder-heading",
    ].map((selector) => [selector, new FakeElement()]),
  );

  return {
    body: new FakeElement(),
    addEventListener() {},
    createElement: () => new FakeElement(),
    querySelector: (selector) => elements.get(selector) || null,
    querySelectorAll: (selector) => (selector === "[data-ladder-round]" ? ladderButtons : []),
    elements,
    ladderButtons,
  };
}

async function waitForRender(document) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (document.querySelector("#score-strip").innerHTML) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("app render smoke test", () => {
  it("renders content into the score, standings, and matches tabs", async () => {
    const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
    const adminHtml = await readFile(new URL("../admin.html", import.meta.url), "utf8");
    const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
    const data = JSON.parse(await readFile(new URL("../public/data/world-cup.json", import.meta.url), "utf8"));
    const upcoming = data.matches.find((match) => match.status !== "finished");
    data.matchOdds = {
      source: "Polymarket match markets",
      updatedAt: "2026-06-15T00:00:00.000Z",
      type: "prediction_market_match",
      matches: [
        {
          matchId: upcoming.id,
          homeTeam: upcoming.homeTeam,
          awayTeam: upcoming.awayTeam,
          homeProbability: 0.55,
          drawProbability: 0.25,
          awayProbability: 0.2,
          question: `${upcoming.homeTeam} vs ${upcoming.awayTeam}: who will win?`,
          url: "https://polymarket.com/event/test",
          volume: 100,
        },
      ],
    };
    const document = createFakeDocument();

    const previousDocument = globalThis.document;
    const previousFetch = globalThis.fetch;
    const previousNavigator = globalThis.navigator;

    globalThis.document = document;
    globalThis.fetch = async () =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });

    try {
      assert.match(html, /href="admin\.html"/);
      assert.doesNotMatch(html, /Trigger data refresh/);
      assert.doesNotMatch(html, /actions\/workflows\/update-world-cup-data\.yml/);
      assert.doesNotMatch(html, /Publish to Pages/);
      assert.doesNotMatch(html, /actions\/workflows\/deploy-pages\.yml/);
      assert.match(adminHtml, /Refresh data/);
      assert.match(adminHtml, /actions\/workflows\/update-world-cup-data\.yml/);
      assert.match(adminHtml, /Publish to Pages/);
      assert.match(adminHtml, /actions\/workflows\/deploy-pages\.yml/);
      assert.match(adminHtml, /Update game results/);
      assert.match(adminHtml, /edit\/master\/public\/data\/manual-results\.json/);
      assert.match(serviceWorker, /admin\.html/);

      await import(`../src/app.js?render-test=${Date.now()}`);
      await waitForRender(document);

      assert.match(document.querySelector("#score-strip").innerHTML, /score-card/);
      assert.match(document.querySelector("#standings-body").innerHTML, /<tr>/);
      assert.match(document.querySelector("#odds-list").innerHTML, /odds-row/);
      assert.match(document.querySelector("#winner-picks").innerHTML, /chance-line/);
      assert.match(document.querySelector("#winner-picks").innerHTML, /Market/);
      assert.match(document.querySelector("#winner-picks").innerHTML, /<button\s+class="info-dot"/);
      assert.match(document.querySelector("#winner-picks").innerHTML, /Start/);
      assert.match(document.querySelector("#winner-picks").innerHTML, /Selected team probability divided by total loaded Polymarket probability/);
      assert.match(document.querySelector("#knockout-ladder").innerHTML, /ladder-card/);
      assert.match(document.querySelector("#knockout-ladder").innerHTML, /ladder-flag/);
      assert.ok(document.querySelectorAll("[data-ladder-round]").length >= 7);
      document.querySelector(".ladder-heading").dispatch("click", document.ladderButtons[1]);
      assert.equal(document.querySelector("#knockout-ladder").dataset.round, "round16");
      assert.match(document.querySelector("#knockout-ladder").innerHTML, /round16-card/);
      assert.match(document.querySelector("#knockout-ladder").innerHTML, />89</);
      assert.notEqual(document.querySelector("#odds-source").textContent, "Loading");
      assert.notEqual(document.querySelector("#odds-updated").textContent, "Loading");
      assert.match(document.querySelector("#match-list").innerHTML, /match-card/);
      assert.match(document.querySelector("#match-list").innerHTML, /match-market-chance/);
      assert.match(document.querySelector("#match-list").innerHTML, /GROUP STAGE/);
      assert.doesNotMatch(document.querySelector("#match-list").innerHTML, /GROUP_STAGE/);
      assert.match(document.querySelector("#match-list").innerHTML, /venue-link/);
      assert.match(document.querySelector("#match-list").innerHTML, /venue-host-flag/);
    } finally {
      globalThis.document = previousDocument;
      globalThis.fetch = previousFetch;
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: previousNavigator,
      });
    }
  });
});
