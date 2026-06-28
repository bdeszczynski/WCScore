import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(name) {
    this.values.add(name);
  }

  remove(name) {
    this.values.delete(name);
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
    if ([".quiz-feedback", ".quiz-flag", ".quiz-question", ".quiz-options", ".quiz-flower", ".eyebrow", "#quiz-title"].includes(selector)) {
      return new FakeElement();
    }
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
  const viewButtons = ["score", "standings", "matches"].map((viewTab) => new FakeElement({ viewTab }));
  const viewPanels = ["score", "standings", "matches", "scorers"].map((view) => new FakeElement({ view }));

  const elements = new Map(
    [
      "#last-updated",
      "#app-story",
      "#score-strip",
      "#standings-body",
      "#winner-standings",
      "#top-scorers-list",
      "#top-scorers-updated",
      "#odds-list",
      "#odds-source",
      "#odds-updated",
      "#winner-picks",
      "#knockout-ladder",
      "#match-list",
      "#match-filter",
      ".ladder-heading",
      ".topbar-actions",
    ].map((selector) => [selector, new FakeElement()]),
  );

  return {
    body: new FakeElement(),
    addEventListener() {},
    createElement: () => new FakeElement(),
    querySelector: (selector) => elements.get(selector) || null,
    querySelectorAll: (selector) => {
      if (selector === "[data-ladder-round]") return ladderButtons;
      if (selector === "[data-view-tab]") return viewButtons;
      if (selector === "[data-view]") return viewPanels;
      return [];
    },
    elements,
    ladderButtons,
    viewButtons,
    viewPanels,
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
    const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
    const appJs = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
    const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
    const data = JSON.parse(await readFile(new URL("../public/data/world-cup.json", import.meta.url), "utf8"));
    data.commentary = {
      updatedAt: "2026-06-17T08:00:00.000Z",
      text: "Prediction: Sara. VAR-bot sees Spain warming up while Bruno starts negotiating with goal difference.",
    };
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
    data.topScorers = {
      source: "football-data.org scorers",
      updatedAt: "2026-06-20T10:00:00.000Z",
      type: "football_data_scorers",
      scorers: [
        { rank: 1, player: "Kylian Mbappe", team: "France", goals: 5, assists: 2, penalties: 1 },
        { rank: 2, player: "Cristiano Ronaldo", team: "Portugal", goals: 4, assists: null, penalties: null },
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
      assert.match(styles, /\.topbar-actions\[hidden\]\s*\{[^}]*display:\s*none;/);
      assert.match(styles, /\.quiz-flower-photo\s*\{[^}]*width:\s*min\(320px,\s*78vw\)/);
      assert.doesNotMatch(html, /https:\/\/loremflickr\.com/);
      assert.doesNotMatch(html, /https:\/\/live\.staticflickr\.com/);
      assert.match(appJs, /quiz\.js\?v=3/);
      assert.match(adminHtml, /Refresh data/);
      assert.match(adminHtml, /actions\/workflows\/update-world-cup-data\.yml/);
      assert.match(adminHtml, /Publish to Pages/);
      assert.match(adminHtml, /actions\/workflows\/deploy-pages\.yml/);
      assert.match(adminHtml, /Update game results/);
      assert.match(adminHtml, /edit\/master\/public\/data\/manual-results\.json/);
      assert.match(html, /<option value="knockout">Knockout<\/option>/);
      assert.match(serviceWorker, /admin\.html/);
      assert.match(serviceWorker, /quiz\.js\?v=3/);
      assert.match(serviceWorker, /flower-sprite-v1\.jpg/);

      await import(`../src/app.js?render-test=${Date.now()}`);
      await waitForRender(document);

      assert.match(document.querySelector("#score-strip").innerHTML, /score-card/);
      assert.match(document.querySelector("#app-story").innerHTML, /Poland/);
      assert.equal(document.querySelector(".topbar-actions").hidden, false);
      assert.match(document.querySelector("#standings-body").innerHTML, /<tr>/);
      assert.match(document.querySelector("#standings-body").innerHTML, /<td>\d+<\/td>/);
      assert.match(document.querySelector("#winner-standings").innerHTML, /Spain/);
      assert.match(document.querySelector("#winner-standings").innerHTML, /<span>GP<\/span>/);
      assert.match(document.querySelector("#winner-standings").innerHTML, /Netherlands/);
      assert.doesNotMatch(document.querySelector("#winner-standings").innerHTML, /Brazil/);
      assert.match(document.querySelector("#top-scorers-list").innerHTML, /Kylian Mbappe/);
      assert.match(document.querySelector("#top-scorers-list").innerHTML, /Goals/);
      assert.match(document.querySelector("#top-scorers-updated").textContent, /Updated/);
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
      assert.match(document.querySelector("#match-list").innerHTML, /LAST 32/);
      assert.doesNotMatch(document.querySelector("#match-list").innerHTML, /GROUP_STAGE/);
      assert.match(document.querySelector("#match-list").innerHTML, /Match 73/);
      assert.match(document.querySelector("#match-list").innerHTML, /Bracket slot/);
      assert.match(document.querySelector("#match-list").innerHTML, /South Africa/);
      document.viewButtons[1].dispatch("click");
      assert.match(document.querySelector("#app-story").innerHTML, /VAR-bot says/);
      assert.match(document.querySelector("#app-story").innerHTML, /Prediction: Sara/);
      assert.equal(document.querySelector(".topbar-actions").hidden, true);
      document.viewButtons[2].dispatch("click");
      assert.equal(document.querySelector(".topbar-actions").hidden, true);
      document.viewButtons[0].dispatch("click");
      assert.match(document.querySelector("#app-story").innerHTML, /Poland/);
      assert.equal(document.querySelector(".topbar-actions").hidden, false);
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
